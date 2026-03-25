import os
from dotenv import load_dotenv
load_dotenv()

import sys
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(BASE_DIR, 'Python code'))
os.chdir(BASE_DIR)

from main_app import app, socketio, init_db

_initialized = False

@app.before_request
def startup():
    global _initialized
    if not _initialized:
        _initialized = True
        init_db()

if __name__ == '__main__':
    init_db()
    socketio.run(app, host='0.0.0.0', port=5000, debug=True, allow_unsafe_werkzeug=True)

