"""
Test script to verify file paths are correct
"""
import os
import sys

print("=" * 60)
print("TESTING FILE PATHS")
print("=" * 60)

# Get base directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
print(f"\n1. Base Directory: {BASE_DIR}")

# Check Python code folder
python_code = os.path.join(BASE_DIR, 'Python code')
print(f"\n2. Python code folder: {python_code}")
print(f"   Exists: {os.path.exists(python_code)}")

# Check main_app.py
main_app = os.path.join(python_code, 'main_app.py')
print(f"\n3. main_app.py: {main_app}")
print(f"   Exists: {os.path.exists(main_app)}")

# Check other folders
folders = ['HTML code', 'JS code', 'CSS code', 'pictures', 'sounds']
print(f"\n4. Checking folders:")
for folder in folders:
    folder_path = os.path.join(BASE_DIR, folder)
    exists = os.path.exists(folder_path)
    print(f"   {folder}: {exists}")
    if exists:
        files = os.listdir(folder_path)
        print(f"      Files: {len(files)}")

# Check database
db_path = os.path.join(BASE_DIR, 'agrokuching.db')
print(f"\n5. Database: {db_path}")
print(f"   Exists: {os.path.exists(db_path)}")

# Try importing
print(f"\n6. Testing import:")
sys.path.insert(0, python_code)
try:
    from main_app import app, socketio
    print("   ✅ Import successful!")
    print(f"   Flask app: {app}")
    print(f"   SocketIO: {socketio}")
except Exception as e:
    print(f"   ❌ Import failed: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 60)
print("TEST COMPLETE")
print("=" * 60)
