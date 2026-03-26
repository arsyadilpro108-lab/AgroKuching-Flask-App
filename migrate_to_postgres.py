"""Migrate data from local SQLite to Render PostgreSQL."""
import sqlite3
import psycopg2
import psycopg2.extras

SQLITE_DB = 'agrokuching.db'
PG_URL = 'postgresql://agrokuching_db_u1jr_user:YIASc4MQMN4ZC0cpadrW7x8EbKwCQeWP@dpg-d72jepsg9agc7399kvug-a.singapore-postgres.render.com/agrokuching_db_u1jr?sslmode=require'

print("Connecting to SQLite...")
sqlite = sqlite3.connect(SQLITE_DB)
sqlite.row_factory = sqlite3.Row

print("Connecting to PostgreSQL...")
pg = psycopg2.connect(PG_URL)
pg.autocommit = False
cur = pg.cursor()

tables = ['users', 'posts', 'followers', 'messages', 'notifications', 'categories', 'post_tags', 'moderation_actions', 'warnings', 'user_reports']

for table in tables:
    try:
        rows = sqlite.execute(f"SELECT * FROM {table}").fetchall()
        if not rows:
            print(f"  {table}: empty, skipping")
            continue
        cols = rows[0].keys()
        placeholders = ','.join(['%s'] * len(cols))
        col_names = ','.join(cols)
        insert_sql = f"INSERT INTO {table} ({col_names}) VALUES ({placeholders}) ON CONFLICT DO NOTHING"
        data = [tuple(row) for row in rows]
        cur.executemany(insert_sql, data)
        pg.commit()
        print(f"  {table}: {len(data)} rows migrated")
    except Exception as e:
        print(f"  {table}: ERROR - {e}")
        pg.rollback()
        continue

# Reset sequences for SERIAL columns
sequences = [
    ('users', 'id'), ('posts', 'id'), ('followers', 'id'),
    ('messages', 'id'), ('notifications', 'id'), ('categories', 'id'),
    ('moderation_actions', 'id'), ('warnings', 'id'), ('user_reports', 'id')
]
for table, col in sequences:
    try:
        cur.execute(f"SELECT setval(pg_get_serial_sequence('{table}', '{col}'), COALESCE(MAX({col}), 1)) FROM {table}")
    except Exception as e:
        print(f"  sequence {table}.{col}: {e}")

pg.commit()
print("\nSequences updated!")

sqlite.close()
pg.close()
