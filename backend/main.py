import os, sqlite3
from pathlib import Path
import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

HERE = Path(__file__).resolve().parent
DB_PATH = Path(os.getenv("EV_BATTERY_DB", str(HERE / "battery_database.db")))
SOH_PATH = Path(os.getenv("SOH_MODEL_PATH", str(HERE / "models" / "soh_model.joblib")))
ANOMALY_PATH = Path(os.getenv("ANOMALY_MODEL_PATH", str(HERE / "models" / "anomaly_model.joblib")))

app = FastAPI(title="EV Battery Monitoring API", version="1.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
                   allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

FEATURES = ["cycle", "rated_capacity_ah", "voltage_mean", "voltage_min", "voltage_max",
            "current_mean", "temperature_mean", "temperature_max", "discharge_time_min",
            "soc_start_percent", "soc_end_percent", "internal_resistance_mohm"]

class PredictionInput(BaseModel):
    battery_id: str = Field(min_length=1, max_length=100)
    cycle: float = 150
    rated_capacity_ah: float = 2.0
    voltage_mean: float = 3.7
    voltage_min: float = 3.2
    voltage_max: float = 4.1
    current_mean: float = 1.0
    temperature_mean: float = 30.0
    temperature_max: float = 35.0
    discharge_time_min: float = 90.0
    soc_start_percent: float = 100.0
    soc_end_percent: float = 20.0
    internal_resistance_mohm: float = 45.0

def connect():
    if not DB_PATH.exists():
        raise HTTPException(503, f"SQLite database not found: {DB_PATH}")
    return sqlite3.connect(DB_PATH)

def table_exists(conn, name):
    return conn.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (name,)).fetchone() is not None

def clean_records(rows):
    result = []
    for row in rows:
        item = {}
        for key, value in row.items():
            if isinstance(value, (np.integer,)): value = int(value)
            elif isinstance(value, (np.floating,)): value = float(value)
            elif pd.isna(value) if not isinstance(value, (str, bytes, dict, list)) else False: value = None
            item[key] = value
        result.append(item)
    return result

@app.get("/api/health")
def health():
    return {"api": "online", "database_exists": DB_PATH.exists(),
            "soh_model_exists": SOH_PATH.exists(), "anomaly_model_exists": ANOMALY_PATH.exists()}

@app.get("/api/overview")
def overview():
    with connect() as conn:
        conn.row_factory = sqlite3.Row
        if not table_exists(conn, "battery_readings"):
            raise HTTPException(503, "battery_readings table is missing. Run database.py first.")
        readings = [dict(r) for r in conn.execute("SELECT * FROM battery_readings ORDER BY cycle ASC").fetchall()]
        alerts = [dict(r) for r in conn.execute("SELECT * FROM anomaly_alerts ORDER BY id DESC LIMIT 12").fetchall()] if table_exists(conn, "anomaly_alerts") else []
        predictions = [dict(r) for r in conn.execute("SELECT * FROM predictions ORDER BY id DESC LIMIT 20").fetchall()] if table_exists(conn, "predictions") else []
    df = pd.DataFrame(readings)
    if df.empty:
        return {"batteries": [], "readings": [], "alerts": alerts, "predictions": predictions, "summary": {}}
    for col in ["cycle", "soh_percent", "anomaly_label"]:
        if col in df: df[col] = pd.to_numeric(df[col], errors="coerce")
    return {"batteries": sorted(df["battery_id"].dropna().astype(str).unique().tolist()),
            "readings": clean_records(readings), "alerts": alerts, "predictions": predictions,
            "summary": {"battery_count": int(df.battery_id.nunique()), "record_count": int(len(df)),
                        "anomaly_count": int((df.anomaly_label == 1).sum()) if "anomaly_label" in df else 0,
                        "mean_soh": float(df.soh_percent.mean()) if "soh_percent" in df else None}}

@app.post("/api/predict")
def predict(payload: PredictionInput):
    if not SOH_PATH.exists() or not ANOMALY_PATH.exists():
        raise HTTPException(503, "Train both ML models and copy them into backend/models/.")
    try:
        soh_bundle, anomaly_bundle = joblib.load(SOH_PATH), joblib.load(ANOMALY_PATH)
        values = {name: getattr(payload, name) for name in FEATURES}
        frame = pd.DataFrame([values], columns=FEATURES)
        soh = float(soh_bundle["model"].predict(frame)[0])
        classifier = anomaly_bundle["model"]
        label = int(classifier.predict(frame)[0])
        probability = None
        if hasattr(classifier, "predict_proba"):
            probs = classifier.predict_proba(frame)[0]
            classes = list(classifier.named_steps["classifier"].classes_)
            if 1 in classes: probability = float(probs[classes.index(1)] * 100)
        with connect() as conn:
            conn.execute("""INSERT INTO predictions
                (battery_id, predicted_soh, anomaly_prediction, anomaly_probability, predicted_anomaly_type)
                VALUES (?, ?, ?, ?, ?)""",
                (payload.battery_id, soh, label, probability, "Unclassified" if label else None))
            if label:
                conn.execute("""INSERT INTO anomaly_alerts (battery_id, anomaly_type, severity, message)
                    VALUES (?, ?, ?, ?)""",
                    (payload.battery_id, "Unclassified", "Requires review",
                     "The model flagged this input. Review the readings before taking action."))
            conn.commit()
        return {"battery_id": payload.battery_id, "predicted_soh": soh,
                "anomaly_prediction": label, "anomaly_probability": probability,
                "note": "Synthetic-data model estimate; not validated for safety decisions."}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(500, f"Prediction failed: {exc}")
