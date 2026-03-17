"""
Simple script to view and query the AgroKuching database
"""
import sqlite3
import sys

def connect_db():
    return sqlite3.connect('agrokuching.db')

def show_tables():
    """Show all tables in the database"""
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    print("\n=== TABLES IN DATABASE ===")
    for table in tables:
        print(f"  - {table[0]}")
    conn.close()
    return [t[0] for t in tables]

def show_table_structure(table_name):
    """Show structure of a specific table"""
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute(f"PRAGMA table_info({table_name});")
    columns = cursor.fetchall()
    print(f"\n=== STRUCTURE OF {table_name.upper()} ===")
    for col in columns:
        print(f"  {col[1]} ({col[2]})")
    conn.close()

def show_table_data(table_name, limit=10):
    """Show data from a specific table"""
    conn = connect_db()
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute(f"SELECT * FROM {table_name} LIMIT {limit};")
    rows = cursor.fetchall()
    
    print(f"\n=== DATA FROM {table_name.upper()} (showing {len(rows)} rows) ===")
    if rows:
        # Print column names
        print("  " + " | ".join(rows[0].keys()))
        print("  " + "-" * 80)
        # Print data
        for row in rows:
            print("  " + " | ".join(str(row[key]) for key in row.keys()))
    else:
        print("  (No data)")
    
    conn.close()

def count_records(table_name):
    """Count records in a table"""
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute(f"SELECT COUNT(*) FROM {table_name};")
    count = cursor.fetchone()[0]
    conn.close()
    return count

def main():
    print("=" * 50)
    print("AGROKUCHING DATABASE VIEWER")
    print("=" * 50)
    
    # Show all tables
    tables = show_tables()
    
    # Show counts for each table
    print("\n=== RECORD COUNTS ===")
    for table in tables:
        count = count_records(table)
        print(f"  {table}: {count} records")
    
    # Show structure and data for main tables
    main_tables = ['users', 'posts', 'messages', 'followers']
    for table in main_tables:
        if table in tables:
            show_table_structure(table)
            show_table_data(table, limit=5)
    
    print("\n" + "=" * 50)
    print("To query specific data, use Python's sqlite3 module")
    print("or install a SQLite browser tool")
    print("=" * 50)

if __name__ == '__main__':
    main()
