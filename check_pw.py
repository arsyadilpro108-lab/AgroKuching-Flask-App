import sqlite3
from werkzeug.security import check_password_hash
db = sqlite3.connect('agrokuching.db')
row = db.execute("SELECT password_hash FROM users WHERE username = 'AgroKuchingOfficial'").fetchone()
print('Hash found:', bool(row))
if row:
    print('Password correct:', check_password_hash(row[0], 'KDPAHAFS4A'))
db.close()
