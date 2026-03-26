#!/usr/bin/env python3
"""
Quick test to verify post deletion is working
"""

import sqlite3

def test_post_deletion():
    print("🧪 Testing Post Deletion...")
    
    # Check database directly
    db = sqlite3.connect('agrokuching.db')
    cursor = db.cursor()
    
    # Count posts in database
    cursor.execute("SELECT COUNT(*) FROM posts")
    db_count = cursor.fetchone()[0]
    print(f"📊 Posts in database: {db_count}")
    
    # Get recent posts from database
    cursor.execute("SELECT id, title, user_id, post_date FROM posts ORDER BY post_date DESC LIMIT 10")
    recent_posts = cursor.fetchall()
    print(f"📝 Recent posts in DB:")
    for post in recent_posts:
        print(f"   ID: {post[0]}, Title: {post[1][:30]}..., User: {post[2]}, Date: {post[3]}")
    
    # Check if there are any moderation actions logged
    try:
        cursor.execute("SELECT COUNT(*) FROM moderation_actions WHERE action_type = 'delete_post'")
        delete_actions = cursor.fetchone()[0]
        print(f"🛡️  Admin delete actions logged: {delete_actions}")
        
        if delete_actions > 0:
            cursor.execute("SELECT * FROM moderation_actions WHERE action_type = 'delete_post' ORDER BY created_date DESC LIMIT 5")
            actions = cursor.fetchall()
            print("📋 Recent delete actions:")
            for action in actions:
                print(f"   Admin ID: {action[1]}, Target User: {action[2]}, Reason: {action[4]}, Date: {action[6]}")
    except:
        print("⚠️  Moderation actions table not found or empty")
    
    db.close()
    
    print("\n💡 To test deletion:")
    print("1. Note the current post count above")
    print("2. Delete a post via admin panel")
    print("3. Run this script again to see if count decreased")
    print("4. Check the home page to see if post disappeared")

if __name__ == '__main__':
    test_post_deletion()