
import pandas as pd
from pathlib import Path

# Project folder ka path
PROJECT_DIR = Path(__file__).resolve().parent.parent

# Master dataset ka path
DATA_PATH = PROJECT_DIR / "data" / "ev_battery_synthetic_master.csv"


def main():
    print("=" * 50)
    print(" EV BATTERY SOH DATASET INSPECTION")
    print("=" * 50)

    # Check whether the dataset exists
    if not DATA_PATH.exists():
        print("\nERROR: Dataset file nahi mili!")
        print("Check karein ki CSV data folder ke andar hai:")
        print(DATA_PATH)
        return

    # Load dataset
    df = pd.read_csv(DATA_PATH)

    # Basic information
    print("\n1. Dataset loaded successfully!")
    print("Total rows:", df.shape[0])
    print("Total columns:", df.shape[1])

    print("\n2. Column names:")
    print(df.columns.tolist())

    print("\n3. First 5 records:")
    print(df.head())

    print("\n4. Dataset information:")
    df.info()

    print("\n5. Missing values per column:")
    print(df.isnull().sum())

    print("\n6. Number of unique batteries:")
    print(df["battery_id"].nunique())

    print("\n7. Anomaly distribution:")
    print(df["anomaly_label"].value_counts())

    print("\n8. Anomaly types:")
    print(df["anomaly_type"].value_counts(dropna=False))

    print("\n9. Battery SOH statistics:")
    print(df["soh_percent"].describe())

    print("\n10. Health status distribution:")
    print(df["health_status"].value_counts(dropna=False))

    print("\n" + "=" * 50)
    print(" DATASET INSPECTION COMPLETED")
    print("=" * 50)


if __name__ == "__main__":
    main()

