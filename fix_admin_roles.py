import sqlite3

db = sqlite3.connect('agrokuching.db')
db.execute("UPDATE users SET role='admin' WHERE username IN ('AgroKuchingOfficial', 'Arsoliz')")
db.commit()

rows = db.execute("SELECT username, role FROM users WHERE username IN ('AgroKuchingOfficial', 'Arsoliz')").fetchall()
for r in rows:
    print(f"{r[0]} -> {r[1]}")

db.close()
print("Done.")
