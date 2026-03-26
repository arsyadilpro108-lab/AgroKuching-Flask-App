#!/usr/bin/env python3
"""
Test API endpoints to see which one is working
"""

import sqlite3
import subprocess
import time

def test_api_endpoints():
    print("🧪 Testing API Endpoints...")
    
    # Test regular posts endpoint
    print("\n1. Testing /api/posts endpoint...")
    try:
        result = subprocess.run([
            'curl', '-s', 'http://127.0.0.1:5000/api/posts'
        ], capture_output=True, text=True, timeout=10)
        
        if result.returncode == 0:
            response = result.stdout
            if response.startswith('['):
                import json
                posts = json.loads(response)
                print(f"✅ /api/posts works: {len(posts)} posts returned")
                for post in posts[:2]:
                    print(f"   - {post['title'][:30]}... by {post['author_username']}")
            else:
                print(f"❌ /api/posts returned: {response[:100]}...")
        else:
            print(f"❌ /api/posts failed: {result.stderr}")
    except Exception as e:
        print(f"❌ /api/posts test failed: {e}")
    
    # Test posts with role endpoint (requires auth)
    print("\n2. Testing /api/posts/with-role endpoint...")
    print("   (This requires authentication, so it might fail)")
    try:
        result = subprocess.run([
            'curl', '-s', 'http://127.0.0.1:5000/api/posts/with-role'
        ], capture_output=True, text=True, timeout=10)
        
        if result.returncode == 0:
            response = result.stdout
            print(f"   Response: {response[:100]}...")
        else:
            print(f"   Failed: {result.stderr}")
    except Exception as e:
        print(f"   Test failed: {e}")
    
    # Check database directly
    print("\n3. Database verification...")
    db = sqlite3.connect('agrokuching.db')
    cursor = db.cursor()
    
    cursor.execute("""
        SELECT p.id, p.title, u.username as author_username, u.profile_pic as author_profile_pic 
        FROM posts p
        JOIN users u ON p.user_id = u.id
        ORDER BY p.post_date DESC
    """)
    posts = cursor.fetchall()
    print(f"✅ Database query works: {len(posts)} posts found")
    for post in posts:
        print(f"   - ID: {post[0]}, Title: {post[1][:30]}..., Author: {post[2]}")
    
    db.close()

if __name__ == '__main__':
    test_api_endpoints()