import sqlite3

def check_db():
    conn = sqlite3.connect("accounting.db")
    cursor = conn.cursor()
    
    # Query all user tables in SQLite database
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = [t[0] for t in cursor.fetchall() if not t[0].startswith("sqlite_")]
    
    print("\nDATABASE INSPECTOR")
    print("=" * 70)
    print(f"Found {len(tables)} tables: {', '.join(tables)}")
    print("=" * 70)
    
    for table in tables:
        print(f"\nTable: {table.upper()}")
        print("-" * 70)
        try:
            # Fetch Column Metadata
            cursor.execute(f"PRAGMA table_info({table});")
            columns = [c[1] for c in cursor.fetchall()]
            print("Columns:", " | ".join(columns))
            print("-" * 70)
            
            # Fetch Rows
            cursor.execute(f"SELECT * FROM {table} LIMIT 15;")
            rows = cursor.fetchall()
            if not rows:
                print("  (Empty Table)")
            for row in rows:
                # Format print values
                print(" | ".join(str(val) for val in row))
        except Exception as e:
            print(f"Error querying table {table}: {e}")
        print("-" * 70)
            
    conn.close()

if __name__ == "__main__":
    check_db()
