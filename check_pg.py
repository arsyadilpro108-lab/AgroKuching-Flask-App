import psycopg2
import psycopg2.extras

PG_URL = 'postgresql://agrokuching_db_u1jr_user:YIASc4MQMN4ZC0cpadrW7x8EbKwCQeWP@dpg-d72jepsg9agc7399kvug-a.singapore-postgres.render.com/agrokuching_db_u1jr?sslmode=require'

conn = psycopg2.connect(PG_URL)
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
cur.execute("SELECT COUNT(*) as cnt FROM users")
print("Users in Postgres:", cur.fetchone()['cnt'])
cur.execute("SELECT username, role FROM users WHERE username = 'AgroKuchingOfficial'")
row = cur.fetchone()
print("AgroKuchingOfficial found:", row)
conn.close()
