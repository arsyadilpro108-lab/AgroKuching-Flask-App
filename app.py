import os
from dotenv import load_dotenv
load_dotenv()

# MUST be first — before any other imports
if os.environ.get('DATABASE_URL'):
    import eventlet
    eventlet.monkey_patch()

import sys
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(BASE_DIR, 'Python code'))
os.chdir(BASE_DIR)

from main_app import app, socketio, init_db
init_db()

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True, allow_unsafe_werkzeug=True)
