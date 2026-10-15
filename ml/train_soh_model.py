
import pandas as pd
import joblib

from pathlib import Path
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error,
    r2_score
)

# Project paths
PROJECT_DIR = Path(__file__).resolve().parent.parent

TRAIN_PATH = PROJECT_DIR / "data" / "train_batteries.csv"
TEST_PATH = PROJECT_DIR / "data" / "test_batteries.csv"

MODEL_DIR = PROJECT_DIR / "models"
MODEL_DIR.mkdir(parents=True, exist_ok=True)

# Input features used to predict battery SOH
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

TARGET = "soh_percent"


def main():
    print("=" * 50)
    print(" EV BATTERY SOH PREDICTION MODEL")
    print("=" * 50)

    # Check dataset files
    if not TRAIN_PATH.exists() or not TEST_PATH.exists():
        print("\nERROR: Training ya testing CSV nahi mili.")
        print("Dono files ko project ke data folder mein rakhein.")
        return

    # Load training and testing datasets
    train_df = pd.read_csv(TRAIN_PATH)
    test_df = pd.read_csv(TEST_PATH)

    # Validate required columns
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

    # Prepare input and target values
    X_train = train_df[FEATURES]
    y_train = train_df[TARGET]

    X_test = test_df[FEATURES]
    y_test = test_df[TARGET]

    # Create the machine learning pipeline
    model = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("regressor", RandomForestRegressor(
            n_estimators=200,
            random_state=42,
            n_jobs=-1
        ))
    ])

    # Train model
    print("\nTraining model...")
    model.fit(X_train, y_train)

    # Predict SOH on unseen test batteries
    predictions = model.predict(X_test)

    # Evaluate performance
    mae = mean_absolute_error(y_test, predictions)
    mse = mean_squared_error(y_test, predictions)
    rmse = mse ** 0.5
    r2 = r2_score(y_test, predictions)

    print("\n--- MODEL PERFORMANCE ---")
    print(f"MAE:  {mae:.3f} percentage points")
    print(f"RMSE: {rmse:.3f} percentage points")
    print(f"R2 Score: {r2:.4f}")

    # Display sample predictions
    results = pd.DataFrame({
        "Actual_SOH": y_test.to_numpy(),
        "Predicted_SOH": predictions
    })

    results["Absolute_Error"] = (
        results["Actual_SOH"] - results["Predicted_SOH"]
    ).abs()

    print("\n--- SAMPLE PREDICTIONS ---")
    print(results.head(10).round(2).to_string(index=False))

    # Save predictions for later analysis
    results_path = PROJECT_DIR / "soh_predictions.csv"
    results.to_csv(results_path, index=False)

    # Save trained model and feature names
    model_path = MODEL_DIR / "soh_model.joblib"

    joblib.dump({
        "model": model,
        "features": FEATURES,
        "target": TARGET
    }, model_path)

    print("\nModel saved at:")
    print(model_path)

    print("\nPredictions saved at:")
    print(results_path)

    print("\nSOH model training completed!")


if __name__ == "__main__":
    main()
