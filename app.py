import sys, os
from dotenv import load_dotenv
load_dotenv()
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(BASE_DIR, 'Python code'))
os.chdir(BASE_DIR)

# Monkey-patch BEFORE importing anything else (required for eventlet)
DATABASE_URL = os.environ.get('DATABASE_URL', '')
if DATABASE_URL:
    import eventlet
    eventlet.monkey_patch()

from main_app import app, socketio, init_db

# Run init_db inside a request context after eventlet is ready
@app.before_request
def startup():
    if not getattr(app, '_db_initialized', False):
        app._db_initialized = True
        init_db()

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True, allow_unsafe_werkzeug=True)
