import sqlite3

conn = sqlite3.connect('agrokuching.db')
cursor = conn.cursor()

# Update Syxnergy specifically
cursor.execute("""
    UPDATE users 
    SET profile_pic = '/pictures/Default PFP.png' 
    WHERE username = 'Syxnergy'
""")

rows = cursor.rowcount
conn.commit()

print(f"Updated {rows} user(s)")

# Verify
cursor.execute("SELECT username, profile_pic FROM users WHERE username = 'Syxnergy'")
user = cursor.fetchone()
if user:
    print(f"Syxnergy's profile_pic is now: {user[1]}")

conn.close()
