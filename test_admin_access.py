#!/usr/bin/env python3
"""
Test admin panel access and functionality
"""
import requests
import json

BASE_URL = "http://localhost:5000"

def test_login():
    """Test login as AgroKuchingOfficial"""
    print("🔐 Testing admin login...")
    
    login_data = {
        "username": "AgroKuchingOfficial",
        "password": "admin123"  # You may need to update this
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/login", json=login_data)
        if response.status_code == 200:
            data = response.json()
            token = data.get('token')
            print(f"✅ Login successful! Token: {token[:20]}...")
            return token
        else:
            print(f"❌ Login failed: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"❌ Login error: {str(e)}")
        return None

def test_admin_check(token):
    """Test admin privilege check"""
    print("🛡️ Testing admin privileges...")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        response = requests.get(f"{BASE_URL}/api/admin/check", headers=headers)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Admin check successful: {data}")
            return data.get('is_admin', False)
        else:
            print(f"❌ Admin check failed: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Admin check error: {str(e)}")
        return False

def test_admin_stats(token):
    """Test admin stats endpoint"""
    print("📊 Testing admin stats...")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        response = requests.get(f"{BASE_URL}/api/admin/stats", headers=headers)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Admin stats: {data}")
            return True
        else:
            print(f"❌ Admin stats failed: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Admin stats error: {str(e)}")
        return False

def test_posts_loading():
    """Test if posts are loading"""
    print("📝 Testing posts loading...")
    
    try:
        response = requests.get(f"{BASE_URL}/api/posts")
        if response.status_code == 200:
            posts = response.json()
            print(f"✅ Posts loaded successfully: {len(posts)} posts found")
            return True
        else:
            print(f"❌ Posts loading failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Posts loading error: {str(e)}")
        return False

def main():
    print("🧪 Testing AgroKuching Admin Panel")
    print("=" * 50)
    
    # Test posts loading first (no auth required)
    posts_ok = test_posts_loading()
    
    # Test admin login
    token = test_login()
    if not token:
        print("\n❌ Cannot proceed without valid login token")
        return
    
    # Test admin privileges
    is_admin = test_admin_check(token)
    if not is_admin:
        print("\n❌ User does not have admin privileges")
        return
    
    # Test admin stats
    stats_ok = test_admin_stats(token)
    
    print("\n" + "=" * 50)
    if posts_ok and is_admin and stats_ok:
        print("✅ ALL TESTS PASSED!")
        print("🎉 Admin panel is working correctly!")
        print(f"\n🌐 Access admin panel at: {BASE_URL}/HTML code/admin-working.html")
    else:
        print("❌ Some tests failed. Check the errors above.")

if __name__ == "__main__":
    main()