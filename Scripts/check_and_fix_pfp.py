import sqlite3

# Connect to database
conn = sqlite3.connect('agrokuching.db')
cursor = conn.cursor()

# Check Syxnergy's profile picture
print("Checking Syxnergy's profile picture:")
cursor.execute("SELECT id, username, profile_pic FROM users WHERE username = 'Syxnergy'")
user = cursor.fetchone()

if user:
    print(f"User ID: {user[0]}")
    print(f"Username: {user[1]}")
    print(f"Current profile_pic: {user[2]}")
    
    # Update to default
    print("\nUpdating to default profile picture...")
    cursor.execute("""
        UPDATE users 
        SET profile_pic = '/pictures/Default PFP.png' 
        WHERE username = 'Syxnergy'
    """)
    conn.commit()
    
    # Verify update
    cursor.execute("SELECT profile_pic FROM users WHERE username = 'Syxnergy'")
    new_pic = cursor.fetchone()
    print(f"New profile_pic: {new_pic[0]}")
    print("\n✅ Updated successfully!")
else:
    print("User 'Syxnergy' not found")

# Show all users
print("\n" + "="*50)
print("All users and their profile pictures:")
print("="*50)
cursor.execute("SELECT id, username, profile_pic FROM users")
users = cursor.fetchall()
for user in users:
    print(f"ID: {user[0]}, Username: {user[1]}, PFP: {user[2]}")

conn.close()
