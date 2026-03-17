#!/usr/bin/env python3
"""
Database Migration Script for AgroKuching Moderation System
This script adds the necessary columns and tables for the moderation system.
"""

import sqlite3
import os
from datetime import datetime

# Database path
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_PATH = os.path.join(ROOT_DIR, 'agrokuching.db')

def migrate_database():
    """Migrate the database to add moderation features"""
    print("Starting database migration...")
    
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    try:
        # Add new columns to users table
        print("Adding new columns to users table...")
        
        # Check if columns already exist
        cursor.execute("PRAGMA table_info(users)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'role' not in columns:
            cursor.execute("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'")
            print("✓ Added 'role' column")
        
        if 'status' not in columns:
            cursor.execute("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'")
            print("✓ Added 'status' column")
        
        if 'banned_until' not in columns:
            cursor.execute("ALTER TABLE users ADD COLUMN banned_until TEXT")
            print("✓ Added 'banned_until' column")
        
        if 'ban_reason' not in columns:
            cursor.execute("ALTER TABLE users ADD COLUMN ban_reason TEXT")
            print("✓ Added 'ban_reason' column")
        
        # Create moderation tables
        print("Creating moderation tables...")
        
        # User Reports Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                reporter_id INTEGER NOT NULL,
                reported_user_id INTEGER NOT NULL,
                reported_post_id INTEGER,
                reason TEXT NOT NULL,
                description TEXT,
                status TEXT DEFAULT 'pending',
                created_date TEXT NOT NULL,
                resolved_date TEXT,
                resolved_by INTEGER,
                FOREIGN KEY (reporter_id) REFERENCES users(id),
                FOREIGN KEY (reported_user_id) REFERENCES users(id),
                FOREIGN KEY (reported_post_id) REFERENCES posts(id),
                FOREIGN KEY (resolved_by) REFERENCES users(id)
            );
        """)
        print("✓ Created user_reports table")
        
        # Moderation Actions Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS moderation_actions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                moderator_id INTEGER NOT NULL,
                target_user_id INTEGER NOT NULL,
                action_type TEXT NOT NULL,
                reason TEXT NOT NULL,
                duration_hours INTEGER,
                created_date TEXT NOT NULL,
                expires_date TEXT,
                FOREIGN KEY (moderator_id) REFERENCES users(id),
                FOREIGN KEY (target_user_id) REFERENCES users(id)
            );
        """)
        print("✓ Created moderation_actions table")
        
        # Warnings Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS warnings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                moderator_id INTEGER NOT NULL,
                reason TEXT NOT NULL,
                message TEXT,
                created_date TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (moderator_id) REFERENCES users(id)
            );
        """)
        print("✓ Created warnings table")
        
        # Deleted Posts Archive Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS deleted_posts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                original_post_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                price TEXT,
                description TEXT NOT NULL,
                contact TEXT NOT NULL,
                images TEXT,
                post_date TEXT NOT NULL,
                deleted_date TEXT NOT NULL,
                deleted_by INTEGER NOT NULL,
                deletion_reason TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (deleted_by) REFERENCES users(id)
            );
        """)
        print("✓ Created deleted_posts table")
        
        # Set AgroKuchingOfficial as admin
        print("Setting up admin user...")
        cursor.execute("UPDATE users SET role = 'admin' WHERE username = 'AgroKuchingOfficial'")
        if cursor.rowcount > 0:
            print("✓ AgroKuchingOfficial has been granted admin privileges")
        else:
            print("⚠ AgroKuchingOfficial user not found. Admin role will be set when user registers.")
        
        # Commit all changes
        conn.commit()
        print("\n✅ Database migration completed successfully!")
        
        # Show summary
        cursor.execute("SELECT COUNT(*) FROM users")
        user_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM users WHERE role = 'admin'")
        admin_count = cursor.fetchone()[0]
        
        print(f"\nDatabase Summary:")
        print(f"- Total users: {user_count}")
        print(f"- Admin users: {admin_count}")
        print(f"- Moderation system: Ready")
        
    except Exception as e:
        print(f"❌ Migration failed: {str(e)}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == '__main__':
    migrate_database()