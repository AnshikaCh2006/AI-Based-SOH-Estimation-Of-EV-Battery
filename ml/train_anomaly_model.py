
import pandas as pd
import joblib

from pathlib import Path
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix
)

# Project folder paths
PROJECT_DIR = Path(__file__).resolve().parent.parent

TRAIN_PATH = PROJECT_DIR / "data" / "train_batteries.csv"
TEST_PATH = PROJECT_DIR / "data" / "test_batteries.csv"

MODEL_DIR = PROJECT_DIR / "models"
MODEL_DIR.mkdir(parents=True, exist_ok=True)

# Features used to detect anomalies
FEATURES = [
    "cycle",
    "rated_capacity_ah",
    "voltage_mean",
    "voltage_min",
    "voltage_max",
    "current_mean",
    "temperature_mean",
    "temperature_max",
    "discharge_time_min",
    "soc_start_percent",
    "soc_end_percent",
    "internal_resistance_mohm"
]

TARGET = "anomaly_label"


def main():
    print("=" * 50)
    print(" EV BATTERY ANOMALY DETECTION MODEL")
    print("=" * 50)

    # Check whether files exist
    if not TRAIN_PATH.exists() or not TEST_PATH.exists():
        print("\nERROR: Training ya testing CSV nahi mili.")
        print("Dono files ko data folder mein rakhein.")
        return

    # Load datasets
    train_df = pd.read_csv(TRAIN_PATH)
    test_df = pd.read_csv(TEST_PATH)

    # Validate columns
    required_columns = FEATURES + [TARGET]

    for name, df in [
        ("Training", train_df),
        ("Testing", test_df)
    ]:
        missing = [
            col for col in required_columns
            if col not in df.columns
        ]

        if missing:
            print(f"\n{name} dataset mein columns missing hain:")
            print(missing)
            return

    # Prepare training and testing data
    X_train = train_df[FEATURES]
    y_train = train_df[TARGET].astype(int)

    X_test = test_df[FEATURES]
    y_test = test_df[TARGET].astype(int)

    # Build model pipeline
    model = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("classifier", RandomForestClassifier(
            n_estimators=200,
            class_weight="balanced",
            random_state=42,
            n_jobs=-1
        ))
    ])

    # Train model
    print("\nTraining anomaly detection model...")
    model.fit(X_train, y_train)

    # Predict anomalies on test batteries
    predictions = model.predict(X_test)

    # Evaluate results
    print("\n--- MODEL PERFORMANCE ---")
    print("Accuracy:", round(accuracy_score(y_test, predictions), 4))

    print("\nClassification Report:")
    print(classification_report(
        y_test,
        predictions,
        labels=[0, 1],
        target_names=["Normal", "Anomaly"],
        zero_division=0
    ))

    print("\nConfusion Matrix:")
    print("Rows = Actual, Columns = Predicted")
    print(confusion_matrix(
        y_test,
        predictions,
        labels=[0, 1]
    ))

    # Save predictions
    results = pd.DataFrame({
        "actual_anomaly": y_test.to_numpy(),
        "predicted_anomaly": predictions,
        "actual_battery_id": test_df["battery_id"].to_numpy()
    })

    results_path = PROJECT_DIR / "anomaly_predictions.csv"
    results.to_csv(results_path, index=False)

    # Save trained model
    model_path = MODEL_DIR / "anomaly_model.joblib"

    joblib.dump({
        "model": model,
        "features": FEATURES,
        "target": TARGET
    }, model_path)

    print("\nModel saved at:")
    print(model_path)

    print("\nPredictions saved at:")
    print(results_path)

    print("\nAnomaly detection training completed!")


if __name__ == "__main__":
    main()
