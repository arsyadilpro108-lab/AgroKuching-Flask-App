#!/usr/bin/env python3
import sqlite3

# Connect to database
db = sqlite3.connect('agrokuching.db')
cursor = db.cursor()

# Update both users to admin
cursor.execute('UPDATE users SET role = ? WHERE username IN (?, ?)', ('admin', 'AgroKuchingOfficial', 'Arsoliz'))
print(f'Updated {cursor.rowcount} users to admin role')

# Check current admins
cursor.execute('SELECT username, role FROM users WHERE role = ?', ('admin',))
admins = cursor.fetchall()
print('Current admins:', admins)

# Commit and close
db.commit()
db.close()
print('✅ Admin privileges updated successfully!')