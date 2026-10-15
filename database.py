
import sqlite3
import pandas as pd

from pathlib import Path

PROJECT_DIR = Path(__file__).resolve().parent
DATA_PATH = PROJECT_DIR / "data" / "ev_battery_synthetic_master.csv"
DATABASE_PATH = PROJECT_DIR / "battery_database.db"

READING_COLUMNS = [
    "battery_id",
    "chemistry",
    "cycle",
    "timestamp",
    "rated_capacity_ah",
    "actual_capacity_ah",
    "voltage_mean",
    "voltage_min",
    "voltage_max",
    "current_mean",
    "temperature_mean",
    "temperature_max",
    "discharge_time_min",
    "soc_start_percent",
    "soc_end_percent",
    "internal_resistance_mohm",
    "soh_percent",
    "health_status",
    "anomaly_label",
    "anomaly_type",
    "anomaly_severity",
    "anomaly_score_synthetic",
    "split"
]


def create_database():
    """Create database tables if they do not already exist."""

    with sqlite3.connect(DATABASE_PATH) as connection:
        cursor = connection.cursor()

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS battery_readings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                battery_id TEXT NOT NULL,
                chemistry TEXT,
                cycle INTEGER,
                timestamp TEXT,
                rated_capacity_ah REAL,
                actual_capacity_ah REAL,
                voltage_mean REAL,
                voltage_min REAL,
                voltage_max REAL,
                current_mean REAL,
                temperature_mean REAL,
                temperature_max REAL,
                discharge_time_min REAL,
                soc_start_percent REAL,
                soc_end_percent REAL,
                internal_resistance_mohm REAL,
                soh_percent REAL,
                health_status TEXT,
                anomaly_label INTEGER,
                anomaly_type TEXT,
                anomaly_severity TEXT,
                anomaly_score_synthetic REAL,
                split TEXT,
                UNIQUE (battery_id, cycle, timestamp)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS predictions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                battery_id TEXT,
                predicted_soh REAL,
                anomaly_prediction INTEGER,
                anomaly_probability REAL,
                predicted_anomaly_type TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS anomaly_alerts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                battery_id TEXT,
                anomaly_type TEXT,
                severity TEXT,
                message TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                acknowledged INTEGER DEFAULT 0
            )
        """)

        connection.commit()

    print("Database and tables created successfully.")
    print(f"Database location: {DATABASE_PATH}")


def import_master_dataset():
    """Import master CSV records without duplicating existing rows."""

    if not DATA_PATH.exists():
        print(f"Dataset not found: {DATA_PATH}")
        print("Place the master CSV file inside the data folder.")
        return

    df = pd.read_csv(DATA_PATH)

    missing_columns = [
        column for column in READING_COLUMNS
        if column not in df.columns
    ]

    if missing_columns:
        print("Missing required CSV columns:", missing_columns)
        return

    # Convert missing values to SQL-compatible NULL values.
    df = df[READING_COLUMNS].astype(object)
    df = df.where(pd.notna(df), None)

    columns_sql = ", ".join(READING_COLUMNS)
    placeholders = ", ".join(["?"] * len(READING_COLUMNS))

    insert_sql = f"""
        INSERT OR IGNORE INTO battery_readings
        ({columns_sql})
        VALUES ({placeholders})
    """

    records = [
        tuple(row)
        for row in df.itertuples(index=False, name=None)
    ]

    with sqlite3.connect(DATABASE_PATH) as connection:
        cursor = connection.cursor()

        cursor.executemany(insert_sql, records)
        inserted = cursor.rowcount

        connection.commit()

        total = connection.execute(
            "SELECT COUNT(*) FROM battery_readings"
        ).fetchone()[0]

    print(f"New records imported: {inserted}")
    print(f"Total records in database: {total}")


def show_database_summary():
    """Display the stored record counts."""

    with sqlite3.connect(DATABASE_PATH) as connection:
        for table in [
            "battery_readings",
            "predictions",
            "anomaly_alerts"
        ]:
            count = connection.execute(
                f"SELECT COUNT(*) FROM {table}"
            ).fetchone()[0]

            print(f"{table}: {count} records")


def main():
    print("=" * 50)
    print("EV BATTERY DATABASE SETUP")
    print("=" * 50)

    create_database()
    import_master_dataset()
    show_database_summary()

    print("\nDatabase setup completed.")


if __name__ == "__main__":
    main()
