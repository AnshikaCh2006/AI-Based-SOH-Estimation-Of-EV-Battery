
import joblib
import pandas as pd

from pathlib import Path
from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error,
    r2_score,
    accuracy_score,
    classification_report,
    confusion_matrix
)

PROJECT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_DIR / "data"
MODEL_DIR = PROJECT_DIR / "models"
RESULTS_DIR = PROJECT_DIR / "results"

TEST_PATH = DATA_DIR / "test_batteries.csv"

SOH_MODEL_PATH = MODEL_DIR / "soh_model.joblib"
ANOMALY_MODEL_PATH = MODEL_DIR / "anomaly_model.joblib"
TYPE_MODEL_PATH = MODEL_DIR / "anomaly_type_model.joblib"


def load_bundle(path):
    """Load a saved model bundle."""
    if not path.exists():
        print(f"\nModel not found: {path}")
        return None

    return joblib.load(path)


def evaluate_soh(test_df):
    """Evaluate the SOH regression model."""
    bundle = load_bundle(SOH_MODEL_PATH)

    if bundle is None:
        return

    model = bundle["model"]
    features = bundle["features"]
    target = bundle["target"]

    X_test = test_df[features]
    y_test = test_df[target]
    predictions = model.predict(X_test)

    mae = mean_absolute_error(y_test, predictions)
    rmse = mean_squared_error(y_test, predictions) ** 0.5
    r2 = r2_score(y_test, predictions)

    print("\n" + "=" * 50)
    print("SOH MODEL EVALUATION")
    print("=" * 50)
    print(f"Mean Absolute Error: {mae:.3f}")
    print(f"Root Mean Squared Error: {rmse:.3f}")
    print(f"R2 Score: {r2:.4f}")

    results = pd.DataFrame({
        "battery_id": test_df["battery_id"],
        "actual_soh": y_test,
        "predicted_soh": predictions
    })

    results["absolute_error"] = (
        results["actual_soh"] - results["predicted_soh"]
    ).abs()

    results.to_csv(
        RESULTS_DIR / "soh_evaluation.csv",
        index=False
    )


def evaluate_anomalies(test_df):
    """Evaluate normal versus anomaly classification."""
    bundle = load_bundle(ANOMALY_MODEL_PATH)

    if bundle is None:
        return

    model = bundle["model"]
    features = bundle["features"]
    target = bundle["target"]

    X_test = test_df[features]
    y_test = test_df[target].astype(int)
    predictions = model.predict(X_test)

    print("\n" + "=" * 50)
    print("ANOMALY MODEL EVALUATION")
    print("=" * 50)
    print(f"Accuracy: {accuracy_score(y_test, predictions):.4f}")

    print("\nClassification Report:")
    print(classification_report(
        y_test,
        predictions,
        labels=[0, 1],
        target_names=["Normal", "Anomaly"],
        zero_division=0
    ))

    print("Confusion Matrix:")
    print(confusion_matrix(y_test, predictions, labels=[0, 1]))

    results = pd.DataFrame({
        "battery_id": test_df["battery_id"],
        "actual_anomaly": y_test,
        "predicted_anomaly": predictions
    })

    results.to_csv(
        RESULTS_DIR / "anomaly_evaluation.csv",
        index=False
    )


def evaluate_anomaly_types(test_df):
    """Evaluate anomaly type classification."""
    bundle = load_bundle(TYPE_MODEL_PATH)

    if bundle is None:
        print("\nSkipping anomaly type evaluation.")
        return

    model = bundle["model"]
    features = bundle["features"]
    target = bundle["target"]

    anomaly_df = test_df[
        (test_df["anomaly_label"] == 1)
        & test_df[target].notna()
        & (test_df[target].astype(str).str.strip() != "")
    ].copy()

    if anomaly_df.empty:
        print("\nNo labelled anomalies available for type evaluation.")
        return

    X_test = anomaly_df[features]
    y_test = anomaly_df[target].astype(str)
    predictions = model.predict(X_test)

    print("\n" + "=" * 50)
    print("ANOMALY TYPE MODEL EVALUATION")
    print("=" * 50)
    print(f"Accuracy: {accuracy_score(y_test, predictions):.4f}")

    print("\nClassification Report:")
    print(classification_report(
        y_test,
        predictions,
        zero_division=0
    ))

    results = pd.DataFrame({
        "battery_id": anomaly_df["battery_id"],
        "actual_type": y_test,
        "predicted_type": predictions
    })

    results.to_csv(
        RESULTS_DIR / "anomaly_type_evaluation.csv",
        index=False
    )


def main():
    print("EV BATTERY MODEL EVALUATION")

    if not TEST_PATH.exists():
        print(f"Test dataset not found: {TEST_PATH}")
        return

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    test_df = pd.read_csv(TEST_PATH)

    evaluate_soh(test_df)
    evaluate_anomalies(test_df)
    evaluate_anomaly_types(test_df)

    print("\nEvaluation finished.")
    print(f"Results folder: {RESULTS_DIR}")


if __name__ == "__main__":
    main()
