#!/usr/bin/env python3
"""
Test script to verify admin panel functionality
"""

import sqlite3
import os

# Database path
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_PATH = os.path.join(ROOT_DIR, 'agrokuching.db')

def test_admin_user():
    """Test if AgroKuchingOfficial has admin privileges"""
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    try:
        # Check if AgroKuchingOfficial exists and has admin role
        cursor.execute("SELECT id, username, role FROM users WHERE username = 'AgroKuchingOfficial'")
        user = cursor.fetchone()
        
        if user:
            user_id, username, role = user
            print(f"✅ User found: {username} (ID: {user_id})")
            print(f"✅ Role: {role}")
            
            if role == 'admin':
                print("✅ AgroKuchingOfficial has admin privileges!")
                return True
            else:
                print("❌ AgroKuchingOfficial does not have admin privileges")
                return False
        else:
            print("❌ AgroKuchingOfficial user not found")
            return False
            
    except Exception as e:
        print(f"❌ Error checking admin user: {str(e)}")
        return False
    finally:
        conn.close()

def test_database_structure():
    """Test if all moderation tables exist"""
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    required_tables = ['user_reports', 'moderation_actions', 'warnings', 'deleted_posts']
    
    try:
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        existing_tables = [table[0] for table in cursor.fetchall()]
        
        print("\n📊 Database Structure Check:")
        print(f"Existing tables: {existing_tables}")
        
        all_exist = True
        for table in required_tables:
            if table in existing_tables:
                print(f"✅ {table} table exists")
            else:
                print(f"❌ {table} table missing")
                all_exist = False
        
        # Check if users table has new columns
        cursor.execute("PRAGMA table_info(users)")
        columns = [column[1] for column in cursor.fetchall()]
        
        required_columns = ['role', 'status', 'banned_until', 'ban_reason']
        print(f"\nUsers table columns: {columns}")
        
        for column in required_columns:
            if column in columns:
                print(f"✅ users.{column} column exists")
            else:
                print(f"❌ users.{column} column missing")
                all_exist = False
        
        return all_exist
        
    except Exception as e:
        print(f"❌ Error checking database structure: {str(e)}")
        return False
    finally:
        conn.close()

def main():
    print("🔧 Testing Admin Panel Setup...")
    print("=" * 50)
    
    # Test database structure
    db_ok = test_database_structure()
    
    # Test admin user
    admin_ok = test_admin_user()
    
    print("\n" + "=" * 50)
    if db_ok and admin_ok:
        print("✅ Admin Panel Setup: SUCCESSFUL")
        print("🎉 AgroKuchingOfficial can now access the admin panel!")
        print("\n📋 Admin Panel Features Available:")
        print("   • User Management (ban, warn, promote)")
        print("   • Post Management (delete posts)")
        print("   • Reports System (view and resolve reports)")
        print("   • Dashboard with statistics")
        print("   • Moderation Log")
    else:
        print("❌ Admin Panel Setup: FAILED")
        print("Please check the errors above")

if __name__ == '__main__':
    main()