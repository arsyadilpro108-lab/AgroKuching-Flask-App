"""
AgroKuching - Main Application Entry Point
This file imports and runs the main Flask application from the Python code folder.
"""

import sys
import os

# Get the directory where this script is located
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Add Python code folder to path
python_code_path = os.path.join(BASE_DIR, 'Python code')
if python_code_path not in sys.path:
    sys.path.insert(0, python_code_path)

# Change to the base directory so relative paths work
os.chdir(BASE_DIR)

# Import and run the main application
try:
    from main_app import app, socketio, init_db
    
    if __name__ == '__main__':
        print("=" * 50)
        print("Starting AgroKuching Server...")
        print(f"Base Directory: {BASE_DIR}")
        print(f"Python Path: {python_code_path}")
        print("=" * 50)
        
        init_db()
        socketio.run(app, host='0.0.0.0', port=5000, debug=True, allow_unsafe_werkzeug=True)
except Exception as e:
    print(f"ERROR: Failed to start server: {e}")
    import traceback
    traceback.print_exc()
    input("Press Enter to exit...")
