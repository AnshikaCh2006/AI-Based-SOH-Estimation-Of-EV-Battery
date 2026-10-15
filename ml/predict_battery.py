
import pandas as pd
import joblib

from pathlib import Path
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report
)

PROJECT_DIR = Path(__file__).resolve().parent.parent

TRAIN_PATH = PROJECT_DIR / "data" / "train_batteries.csv"
TEST_PATH = PROJECT_DIR / "data" / "test_batteries.csv"

MODEL_DIR = PROJECT_DIR / "models"
MODEL_DIR.mkdir(parents=True, exist_ok=True)

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

TARGET = "anomaly_type"


def main():
    print("=" * 55)
    print("EV BATTERY ANOMALY TYPE CLASSIFICATION")
    print("=" * 55)

    if not TRAIN_PATH.exists() or not TEST_PATH.exists():
        print("ERROR: Training or testing CSV file not found.")
        print("Place both CSV files inside the data folder.")
        return

    train_df = pd.read_csv(TRAIN_PATH)
    test_df = pd.read_csv(TEST_PATH)

    required_columns = FEATURES + [TARGET, "anomaly_label"]

    for name, df in [
        ("Training", train_df),
        ("Testing", test_df)
    ]:
        missing = [
            column for column in required_columns
            if column not in df.columns
        ]

        if missing:
            print(f"{name} dataset is missing columns: {missing}")
            return

    # Keep only records with an anomaly and a valid anomaly type.
    train_anomalies = train_df[
        (train_df["anomaly_label"] == 1)
        & train_df[TARGET].notna()
        & (train_df[TARGET].astype(str).str.strip() != "")
    ].copy()

    test_anomalies = test_df[
        (test_df["anomaly_label"] == 1)
        & test_df[TARGET].notna()
        & (test_df[TARGET].astype(str).str.strip() != "")
    ].copy()

    if train_anomalies.empty:
        print("ERROR: No labelled anomalies found in training data.")
        return

    if test_anomalies.empty:
        print("ERROR: No labelled anomalies found in testing data.")
        print("Type-classification evaluation cannot be performed.")
        return

    X_train = train_anomalies[FEATURES]
    y_train = train_anomalies[TARGET].astype(str)

    X_test = test_anomalies[FEATURES]
    y_test = test_anomalies[TARGET].astype(str)

    # Check whether each test category exists in training data.
    unseen_types = sorted(set(y_test) - set(y_train))

    if unseen_types:
        print("ERROR: Some anomaly types in testing data")
        print("do not appear in training data:")
        print(unseen_types)
        print("A category-aware data split is needed.")
        return

    model = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("classifier", RandomForestClassifier(
            n_estimators=200,
            class_weight="balanced",
            random_state=42,
            n_jobs=-1
        ))
    ])

    print("\nTraining anomaly type classifier...")
    model.fit(X_train, y_train)

    predictions = model.predict(X_test)

    print("\n--- MODEL PERFORMANCE ---")
    print("Accuracy:", round(
        accuracy_score(y_test, predictions), 4
    ))

    print("\nClassification Report:")
    print(classification_report(
        y_test,
        predictions,
        labels=sorted(set(y_train) | set(y_test)),
        zero_division=0
    ))

    # Save the model
    model_path = MODEL_DIR / "anomaly_type_model.joblib"

    joblib.dump({
        "model": model,
        "features": FEATURES,
        "target": TARGET
    }, model_path)

    # Save predictions for analysis
    results = pd.DataFrame({
        "actual_anomaly_type": y_test.to_numpy(),
        "predicted_anomaly_type": predictions
    })

    results_path = PROJECT_DIR / "anomaly_type_predictions.csv"
    results.to_csv(results_path, index=False)

    print("\nModel saved to:")
    print(model_path)

    print("\nPredictions saved to:")
    print(results_path)

    print("\nAnomaly type classification completed.")


if __name__ == "__main__":
    main()
