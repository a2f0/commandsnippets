#!/usr/bin/env python
import os
from datetime import datetime

import psycopg2
from dotenv import load_dotenv
from tabulate import tabulate

load_dotenv()

DB_PARAMS = {
    "host": "localhost",
    "port": int(os.getenv("POSTGRES_DOCKER_PORT")),
    "database": os.getenv("POSTGRES_DB"),
    "user": os.getenv("POSTGRES_USER"),
    "password": os.getenv("POSTGRES_PASSWORD"),
}


def query_recent_users():
    """Query users ordered by most recently joined first"""
    try:
        # Connect to the database
        conn = psycopg2.connect(**DB_PARAMS)
        cursor = conn.cursor()

        # Execute the query
        cursor.execute("SELECT * FROM users_user ORDER BY date_joined DESC;")

        # Get column names
        columns = [desc[0] for desc in cursor.description]

        # Fetch all results
        results = cursor.fetchall()

        # Print results in a table format
        print(f"Total users: {len(results)}")
        print(tabulate(results, headers=columns, tablefmt="grid"))

        # Close the connection
        cursor.close()
        conn.close()

    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    print(f"Running user query at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    query_recent_users()
