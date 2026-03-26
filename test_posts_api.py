#!/usr/bin/env python3
"""
Test script to check if posts API is working
"""

import requests
import json

def test_posts_api():
    """Test if the posts API is returning data"""
    try:
        # Test the posts endpoint
        response = requests.get('http://localhost:5000/api/posts')
        
        print(f"Posts API Status: {response.status_code}")
        
        if response.status_code == 200:
            posts = response.json()
            print(f"Number of posts returned: {len(posts)}")
            
            if posts:
                print("Sample post:")
                print(json.dumps(posts[0], indent=2))
            else:
                print("No posts found in database")
        else:
            print(f"Error response: {response.text}")
            
    except Exception as e:
        print(f"Error testing posts API: {str(e)}")

if __name__ == '__main__':
    test_posts_api()