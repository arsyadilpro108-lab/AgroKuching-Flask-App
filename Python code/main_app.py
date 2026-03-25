import sqlite3
import os
import jwt
from flask import Flask, jsonify, request, g, send_from_directory
from flask_socketio import SocketIO, emit, join_room, leave_room
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
from datetime import datetime, timedelta, timezone
import json
from dotenv import load_dotenv
load_dotenv()

# --- Configuration ---
app = Flask(__name__, static_folder=None)

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
print(f"ROOT_DIR: {ROOT_DIR}")
print(f"Current file: {__file__}")

DATABASE_URL = os.environ.get('DATABASE_URL', '')
USE_POSTGRES = bool(DATABASE_URL)

# Fix Render's postgres:// -> postgresql:// -> pg8000 needs host/port/dbname parsed
if DATABASE_URL.startswith('postgres://'):
    DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql://', 1)

app.config['DATABASE'] = os.path.join(ROOT_DIR, 'agrokuching.db')
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'a-very-secret-key-that-you-should-change')

print(f"Using {'PostgreSQL' if USE_POSTGRES else 'SQLite'}")

# Verify directories exist
print(f"HTML code exists: {os.path.exists(os.path.join(ROOT_DIR, 'HTML code'))}")
print(f"JS code exists: {os.path.exists(os.path.join(ROOT_DIR, 'JS code'))}")
print(f"CSS code exists: {os.path.exists(os.path.join(ROOT_DIR, 'CSS code'))}")

_async_mode = 'eventlet' if USE_POSTGRES else 'threading'
socketio = SocketIO(app, cors_allowed_origins="*", async_mode=_async_mode, logger=False, engineio_logger=False)

# --- Database Setup ---

if USE_POSTGRES:
    import psycopg2
    import psycopg2.extras

    class PgWrapper:
        """Wraps a psycopg2 connection to accept ? placeholders like SQLite."""
        def __init__(self, conn):
            self._conn = conn

        def execute(self, sql, params=None):
            cur = self._conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            cur.execute(sql.replace('?', '%s'), params)
            return cur

        def cursor(self):
            return self._conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        def commit(self):
            self._conn.commit()

        def rollback(self):
            self._conn.rollback()

        def close(self):
            self._conn.close()

        @property
        def closed(self):
            return self._conn.closed

    def get_db():
        db = getattr(g, '_database', None)
        if db is None or db.closed:
            # Use sslmode=disable for internal Render connections (same datacenter)
            conn = psycopg2.connect(DATABASE_URL, sslmode='disable')
            conn.autocommit = False
            db = g._database = PgWrapper(conn)
        return db

    @app.teardown_appcontext
    def close_connection(exception):
        db = getattr(g, '_database', None)
        if db is not None:
            try:
                db.close()
            except Exception:
                pass

    def last_id(cursor):
        cursor.execute("SELECT lastval()")
        return cursor.fetchone()['lastval']

else:
    def get_db():
        db = getattr(g, '_database', None)
        if db is None:
            db = g._database = sqlite3.connect(app.config['DATABASE'])
            db.row_factory = sqlite3.Row
        return db

    @app.teardown_appcontext
    def close_connection(exception):
        db = getattr(g, '_database', None)
        if db is not None:
            db.close()

    def last_id(cursor):
        return cursor.lastrowid

def init_db():
    with app.app_context():
        db = get_db()
        cursor = db.cursor()

        if USE_POSTGRES:
            # PostgreSQL schema
            statements = [
                """CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    username TEXT UNIQUE NOT NULL,
                    email TEXT NOT NULL,
                    password_hash TEXT NOT NULL,
                    phone TEXT,
                    description TEXT,
                    profile_pic TEXT,
                    reg_date TEXT NOT NULL,
                    role TEXT DEFAULT 'user',
                    status TEXT DEFAULT 'active',
                    banned_until TEXT,
                    ban_reason TEXT
                )""",
                """CREATE TABLE IF NOT EXISTS posts (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id),
                    title TEXT NOT NULL,
                    price TEXT,
                    description TEXT NOT NULL,
                    contact TEXT NOT NULL,
                    images TEXT,
                    post_date TEXT NOT NULL
                )""",
                """CREATE TABLE IF NOT EXISTS followers (
                    id SERIAL PRIMARY KEY,
                    follower_id INTEGER NOT NULL REFERENCES users(id),
                    following_id INTEGER NOT NULL REFERENCES users(id),
                    follow_date TEXT NOT NULL,
                    UNIQUE(follower_id, following_id)
                )""",
                """CREATE TABLE IF NOT EXISTS messages (
                    id SERIAL PRIMARY KEY,
                    sender_id INTEGER NOT NULL REFERENCES users(id),
                    receiver_id INTEGER NOT NULL REFERENCES users(id),
                    message TEXT NOT NULL,
                    sent_date TEXT NOT NULL,
                    is_read INTEGER DEFAULT 0,
                    reply_to INTEGER REFERENCES messages(id)
                )""",
                """CREATE TABLE IF NOT EXISTS notifications (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id),
                    type TEXT NOT NULL,
                    content TEXT NOT NULL,
                    related_user_id INTEGER,
                    related_post_id INTEGER,
                    is_read INTEGER DEFAULT 0,
                    created_date TEXT NOT NULL
                )""",
                """CREATE TABLE IF NOT EXISTS categories (
                    id SERIAL PRIMARY KEY,
                    name TEXT UNIQUE NOT NULL
                )""",
                """CREATE TABLE IF NOT EXISTS post_tags (
                    post_id INTEGER NOT NULL REFERENCES posts(id),
                    category_id INTEGER NOT NULL REFERENCES categories(id),
                    PRIMARY KEY (post_id, category_id)
                )""",
                """CREATE TABLE IF NOT EXISTS moderation_actions (
                    id SERIAL PRIMARY KEY,
                    moderator_id INTEGER NOT NULL REFERENCES users(id),
                    target_user_id INTEGER NOT NULL REFERENCES users(id),
                    action_type TEXT NOT NULL,
                    reason TEXT NOT NULL,
                    duration_hours INTEGER,
                    created_date TEXT NOT NULL,
                    expires_date TEXT
                )""",
                """CREATE TABLE IF NOT EXISTS warnings (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id),
                    moderator_id INTEGER NOT NULL REFERENCES users(id),
                    reason TEXT NOT NULL,
                    message TEXT,
                    created_date TEXT NOT NULL
                )""",
                """CREATE TABLE IF NOT EXISTS user_reports (
                    id SERIAL PRIMARY KEY,
                    reporter_id INTEGER NOT NULL REFERENCES users(id),
                    reported_user_id INTEGER NOT NULL REFERENCES users(id),
                    reported_post_id INTEGER REFERENCES posts(id),
                    reason TEXT NOT NULL,
                    description TEXT,
                    status TEXT DEFAULT 'pending',
                    created_date TEXT NOT NULL,
                    resolved_date TEXT,
                    resolved_by INTEGER REFERENCES users(id)
                )""",
                """INSERT INTO categories (name) VALUES ('Crops'),('Livestock'),('Equipment'),('Seeds'),('Fertilizer'),('Other') ON CONFLICT DO NOTHING""",
                # Indexes
                "CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)",
                "CREATE INDEX IF NOT EXISTS idx_users_status ON users(status)",
                "CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id)",
                "CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id)",
                "CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id)",
                "CREATE INDEX IF NOT EXISTS idx_reports_status ON user_reports(status)",
            ]
            for sql in statements:
                try:
                    cursor.execute(sql)
                except Exception as e:
                    print(f"Warning init_db: {e}")
                    db.rollback()
        else:
            # SQLite schema
            cursor.execute("""CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL, email TEXT NOT NULL,
                password_hash TEXT NOT NULL, phone TEXT, description TEXT,
                profile_pic TEXT, reg_date TEXT NOT NULL,
                role TEXT DEFAULT 'user', status TEXT DEFAULT 'active',
                banned_until TEXT, ban_reason TEXT)""")
            cursor.execute("""CREATE TABLE IF NOT EXISTS posts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL, title TEXT NOT NULL, price TEXT,
                description TEXT NOT NULL, contact TEXT NOT NULL,
                images TEXT, post_date TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id))""")
            cursor.execute("""CREATE TABLE IF NOT EXISTS followers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                follower_id INTEGER NOT NULL, following_id INTEGER NOT NULL,
                follow_date TEXT NOT NULL,
                FOREIGN KEY (follower_id) REFERENCES users(id),
                FOREIGN KEY (following_id) REFERENCES users(id),
                UNIQUE(follower_id, following_id))""")
            cursor.execute("""CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sender_id INTEGER NOT NULL, receiver_id INTEGER NOT NULL,
                message TEXT NOT NULL, sent_date TEXT NOT NULL,
                is_read INTEGER DEFAULT 0, reply_to INTEGER,
                FOREIGN KEY (sender_id) REFERENCES users(id),
                FOREIGN KEY (receiver_id) REFERENCES users(id))""")
            cursor.execute("""CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL, type TEXT NOT NULL,
                content TEXT NOT NULL, related_user_id INTEGER,
                related_post_id INTEGER, is_read INTEGER DEFAULT 0,
                created_date TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id))""")
            cursor.execute("""CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL)""")
            cursor.execute("""CREATE TABLE IF NOT EXISTS post_tags (
                post_id INTEGER NOT NULL, category_id INTEGER NOT NULL,
                FOREIGN KEY (post_id) REFERENCES posts(id),
                FOREIGN KEY (category_id) REFERENCES categories(id),
                PRIMARY KEY (post_id, category_id))""")
            cursor.execute("""CREATE TABLE IF NOT EXISTS moderation_actions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                moderator_id INTEGER NOT NULL, target_user_id INTEGER NOT NULL,
                action_type TEXT NOT NULL, reason TEXT NOT NULL,
                duration_hours INTEGER, created_date TEXT NOT NULL, expires_date TEXT,
                FOREIGN KEY (moderator_id) REFERENCES users(id),
                FOREIGN KEY (target_user_id) REFERENCES users(id))""")
            cursor.execute("""CREATE TABLE IF NOT EXISTS warnings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL, moderator_id INTEGER NOT NULL,
                reason TEXT NOT NULL, message TEXT, created_date TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (moderator_id) REFERENCES users(id))""")
            cursor.execute("""CREATE TABLE IF NOT EXISTS user_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                reporter_id INTEGER NOT NULL, reported_user_id INTEGER NOT NULL,
                reported_post_id INTEGER, reason TEXT NOT NULL, description TEXT,
                status TEXT DEFAULT 'pending', created_date TEXT NOT NULL,
                resolved_date TEXT, resolved_by INTEGER,
                FOREIGN KEY (reporter_id) REFERENCES users(id),
                FOREIGN KEY (reported_user_id) REFERENCES users(id))""")
            try:
                cursor.execute("INSERT OR IGNORE INTO categories (name) VALUES ('Crops'),('Livestock'),('Equipment'),('Seeds'),('Fertilizer'),('Other')")
            except Exception:
                pass
            for col_sql in [
                "ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'",
                "ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'",
                "ALTER TABLE users ADD COLUMN banned_until TEXT",
                "ALTER TABLE users ADD COLUMN ban_reason TEXT",
            ]:
                try:
                    cursor.execute(col_sql)
                except Exception:
                    pass
            for idx in [
                "CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)",
                "CREATE INDEX IF NOT EXISTS idx_users_status ON users(status)",
                "CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id)",
                "CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id)",
                "CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id)",
                "CREATE INDEX IF NOT EXISTS idx_reports_status ON user_reports(status)",
            ]:
                try:
                    cursor.execute(idx)
                except Exception:
                    pass

        db.commit()
        print("Database initialized.")

# --- Authentication (JWT) ---

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            token = auth_header.split(" ")[1] if " " in auth_header else auth_header

        if not token:
            return jsonify({'message': 'Token is missing!'}), 401

        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            
            db = get_db()
            current_user = db.execute("SELECT * FROM users WHERE id = ?", (int(data['sub']),)).fetchone()
            if not current_user:
                return jsonify({'message': 'Token is invalid!'}), 401
            
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token has expired!'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Token is invalid!'}), 401
        except Exception as e:
            return jsonify({'message': 'Token validation failed!'}), 401

        return f(current_user, *args, **kwargs)
    return decorated

# --- API Routes ---

# Authentication
@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    email = data.get('email')

    if not all([username, password, email]):
        return jsonify({'message': 'Missing username, email, or password'}), 400

    password_hash = generate_password_hash(password)
    reg_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    db = get_db()
    try:
        cursor = db.execute(
            "INSERT INTO users (username, email, password_hash, reg_date, profile_pic) VALUES (?, ?, ?, ?, ?)",
            (username, email, password_hash, reg_date, '/pictures/Default PFP.png')
        )
        db.commit()
        
        user_id = cursor.lastrowid
        token = jwt.encode({
            'sub': str(user_id),
            'iat': datetime.now(timezone.utc),
            'exp': datetime.now(timezone.utc) + timedelta(days=1)
        }, app.config['SECRET_KEY'], algorithm="HS256")
        
        return jsonify({'message': 'User registered successfully', 'token': token}), 201
        
    except sqlite3.IntegrityError:
        return jsonify({'message': 'Username already exists'}), 409
    except Exception as e:
        return jsonify({'message': 'Server error', 'error': str(e)}), 500

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({'message': 'Missing username or password'}), 400
    
    db = get_db()
    user = db.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    
    if not user:
        return jsonify({'message': 'Invalid credentials'}), 401

    if check_password_hash(user['password_hash'], password):
        token = jwt.encode({
            'sub': str(user['id']),
            'iat': datetime.now(timezone.utc),
            'exp': datetime.now(timezone.utc) + timedelta(days=1)
        }, app.config['SECRET_KEY'], algorithm="HS256")
        
        return jsonify({'message': 'Login successful', 'token': token}), 200
    
    return jsonify({'message': 'Invalid credentials'}), 401

@app.route('/api/forgot-username', methods=['POST'])
def forgot_username():
    data = request.json
    email = data.get('email')
    
    if not email:
        return jsonify({'message': 'Email is required'}), 400
    
    db = get_db()
    user = db.execute("SELECT username FROM users WHERE email = ?", (email,)).fetchone()
    
    if user:
        return jsonify({'username': user['username']}), 200
    else:
        return jsonify({'message': 'No account found with that email'}), 404

@app.route('/api/forgot-password', methods=['POST'])
def forgot_password():
    data = request.json
    username = data.get('username')
    email = data.get('email')
    
    if not username or not email:
        return jsonify({'message': 'Username and email are required'}), 400
    
    db = get_db()
    user = db.execute("SELECT * FROM users WHERE username = ? AND email = ?", (username, email)).fetchone()
    
    if user:
        return jsonify({'message': 'User verified'}), 200
    else:
        return jsonify({'message': 'Username and email do not match'}), 404

@app.route('/api/reset-password', methods=['POST'])
def reset_password():
    data = request.json
    username = data.get('username')
    email = data.get('email')
    new_password = data.get('new_password')
    
    if not all([username, email, new_password]):
        return jsonify({'message': 'All fields are required'}), 400
    
    if len(new_password) < 6:
        return jsonify({'message': 'Password must be at least 6 characters'}), 400
    
    db = get_db()
    user = db.execute("SELECT * FROM users WHERE username = ? AND email = ?", (username, email)).fetchone()
    
    if not user:
        return jsonify({'message': 'Username and email do not match'}), 404
    
    try:
        password_hash = generate_password_hash(new_password)
        db.execute("UPDATE users SET password_hash = ? WHERE id = ?", (password_hash, user['id']))
        db.commit()
        
        return jsonify({'message': 'Password reset successfully'}), 200
    except Exception as e:
        db.rollback()
        return jsonify({'message': 'Server error', 'error': str(e)}), 500

# Profile Management
@app.route('/api/profile', methods=['GET'])
@token_required
def get_profile(current_user):
    return jsonify({
        'id': current_user['id'],
        'username': current_user['username'],
        'email': current_user['email'],
        'phone': current_user['phone'],
        'description': current_user['description'],
        'profile_picture': current_user['profile_pic'],
        'registration_date': current_user['reg_date'],
        'role': current_user['role'] if 'role' in current_user.keys() else 'user'
    }), 200

@app.route('/api/profile/mini', methods=['GET'])
def get_mini_profile():
    username = request.args.get('username')
    if not username:
        return jsonify({'message': 'Username required'}), 400
        
    db = get_db()
    user = db.execute("SELECT username, email, phone, description, profile_pic, reg_date FROM users WHERE username = ?", (username,)).fetchone()
    
    if user:
        return jsonify(dict(user)), 200
    else:
        return jsonify({'message': 'User not found'}), 404

@app.route('/api/profile', methods=['PUT'])
@token_required
def update_profile(current_user):
    data = request.json
    
    db = get_db()
    profile_data_row = db.execute("SELECT * FROM users WHERE id = ?", (current_user['id'],)).fetchone()
    profile = dict(profile_data_row)
    
    profile['email'] = data.get('email', profile['email'])
    profile['phone'] = data.get('phone', profile['phone'])
    profile['description'] = data.get('description', profile['description'])
    profile['profile_pic'] = data.get('profile_pic', profile['profile_pic'])
    
    if data.get('password'):
        profile['password_hash'] = generate_password_hash(data['password'])
    else:
        profile['password_hash'] = profile['password_hash']

    try:
        db.execute(
            """
            UPDATE users SET 
            email = ?, phone = ?, description = ?, profile_pic = ?, password_hash = ?
            WHERE id = ?
            """,
            (profile['email'], profile['phone'], profile['description'], 
             profile['profile_pic'], profile['password_hash'], current_user['id'])
        )
        db.commit()
        return jsonify({'message': 'Profile updated successfully'}), 200
    except sqlite3.IntegrityError:
        db.rollback()
        return jsonify({'message': 'Username already in use'}), 409
    except Exception as e:
        db.rollback()
        return jsonify({'message': 'Server error', 'error': str(e)}), 500

@app.route('/api/update-profile', methods=['POST'])
@token_required
def update_profile_with_file(current_user):
    try:
        username = request.form.get('username')
        email = request.form.get('email')
        phone = request.form.get('phone', '')
        description = request.form.get('description', '')
        
        print(f"Update profile request: username={username}, email={email}, phone={phone}")
        
        if not username or not email:
            return jsonify({'message': 'Username and email are required'}), 400
        
        db = get_db()
        profile_pic = None
        
        # Handle profile picture upload
        if 'profile_picture' in request.files:
            file = request.files['profile_picture']
            if file and file.filename:
                import base64
                # Read file and convert to base64
                file_data = file.read()
                profile_pic = f"data:image/png;base64,{base64.b64encode(file_data).decode('utf-8')}"
                print(f"Profile picture uploaded, size: {len(file_data)} bytes")
        
        # Check if username is being changed and if it conflicts
        if username != current_user['username']:
            existing = db.execute("SELECT id FROM users WHERE username = ? AND id != ?", 
                                 (username, current_user['id'])).fetchone()
            if existing:
                return jsonify({'message': 'Username already taken'}), 409
        
        # Always update all fields, including profile_pic if provided
        if profile_pic:
            db.execute(
                """
                UPDATE users SET 
                username = ?, email = ?, phone = ?, description = ?, profile_pic = ?
                WHERE id = ?
                """,
                (username, email, phone, description, profile_pic, current_user['id'])
            )
            print(f"Updated profile with new picture for user {current_user['id']}")
        else:
            db.execute(
                """
                UPDATE users SET 
                username = ?, email = ?, phone = ?, description = ?
                WHERE id = ?
                """,
                (username, email, phone, description, current_user['id'])
            )
            print(f"Updated profile without picture for user {current_user['id']}")
        
        db.commit()
        return jsonify({'message': 'Profile updated successfully'}), 200
        
    except sqlite3.IntegrityError as e:
        db.rollback()
        print(f"IntegrityError: {e}")
        return jsonify({'message': 'Username already in use'}), 409
    except Exception as e:
        db.rollback()
        print(f"Error updating profile: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'message': 'Server error', 'error': str(e)}), 500

@app.route('/api/change-password', methods=['POST'])
@token_required
def change_password(current_user):
    data = request.json
    current_password = data.get('current_password')
    new_password = data.get('new_password')
    
    if not current_password or not new_password:
        return jsonify({'message': 'Both current and new password are required'}), 400
    
    if len(new_password) < 6:
        return jsonify({'message': 'New password must be at least 6 characters'}), 400
    
    db = get_db()
    user = db.execute("SELECT * FROM users WHERE id = ?", (current_user['id'],)).fetchone()
    
    if not check_password_hash(user['password_hash'], current_password):
        return jsonify({'message': 'Current password is incorrect'}), 401
    
    try:
        new_password_hash = generate_password_hash(new_password)
        db.execute("UPDATE users SET password_hash = ? WHERE id = ?", (new_password_hash, current_user['id']))
        db.commit()
        return jsonify({'message': 'Password changed successfully'}), 200
    except Exception as e:
        db.rollback()
        return jsonify({'message': 'Server error', 'error': str(e)}), 500

# Posts
@app.route('/api/posts', methods=['POST'])
@token_required
def create_post(current_user):
    data = request.json
    
    try:
        db = get_db()
        db.execute(
            """
            INSERT INTO posts (user_id, title, price, description, contact, images, post_date) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                current_user['id'],
                data.get('title'),
                data.get('price'),
                data.get('description'),
                data.get('contact'),
                json.dumps(data.get('images', [])),
                datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            )
        )
        db.commit()
        return jsonify({'message': 'Post created successfully'}), 201
    except Exception as e:
        db.rollback()
        return jsonify({'message': 'Server error', 'error': str(e)}), 500

@app.route('/api/posts', methods=['GET'])
def get_posts():
    try:
        db = get_db()
        posts_rows = db.execute(
            """
            SELECT p.*, u.username as author_username, u.profile_pic as author_profile_pic 
            FROM posts p
            JOIN users u ON p.user_id = u.id
            ORDER BY p.post_date DESC
            """
        ).fetchall()
        
        posts = []
        for row in posts_rows:
            post = dict(row)
            post['images'] = json.loads(post['images'])
            posts.append(post)
        
        response = jsonify(posts)
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate'
        return response, 200
    except Exception as e:
        return jsonify({'message': 'Server error', 'error': str(e)}), 500

@app.route('/api/posts/with-role', methods=['GET'])
@token_required
def get_posts_with_role(current_user):
    """Get posts with current user role information for menu options"""
    try:
        db = get_db()
        posts_rows = db.execute(
            """
            SELECT p.*, u.username as author_username, u.profile_pic as author_profile_pic 
            FROM posts p
            JOIN users u ON p.user_id = u.id
            ORDER BY p.post_date DESC
            """
        ).fetchall()
        
        posts = []
        for row in posts_rows:
            post = dict(row)
            post['images'] = json.loads(post['images'])
            posts.append(post)
        
        # Get current user role
        user_role = db.execute("SELECT role FROM users WHERE id = ?", (current_user['id'],)).fetchone()
        current_role = user_role['role'] if user_role else 'user'
            
        return jsonify({
            'posts': posts,
            'current_user': {
                'id': current_user['id'],
                'username': current_user['username'],
                'role': current_role
            }
        }), 200
    except Exception as e:
        return jsonify({'message': 'Server error', 'error': str(e)}), 500

@app.route('/api/search', methods=['GET'])
def search():
    try:
        query = request.args.get('q', '').strip()
        
        if not query:
            return jsonify({'posts': [], 'users': []}), 200
        
        db = get_db()
        
        # Search posts
        posts_rows = db.execute(
            """
            SELECT p.*, u.username as author_username, u.profile_pic as author_profile_pic 
            FROM posts p
            JOIN users u ON p.user_id = u.id
            WHERE LOWER(p.title) LIKE LOWER(?) OR LOWER(p.description) LIKE LOWER(?) OR LOWER(u.username) LIKE LOWER(?)
            ORDER BY p.post_date DESC
            """,
            (f'%{query}%', f'%{query}%', f'%{query}%')
        ).fetchall()
        
        posts = []
        for row in posts_rows:
            post = dict(row)
            post['images'] = json.loads(post['images'])
            posts.append(post)
        
        # Search users
        users_rows = db.execute(
            """
            SELECT username, email, phone, description, profile_pic, reg_date 
            FROM users 
            WHERE LOWER(username) LIKE LOWER(?)
            ORDER BY username
            LIMIT 10
            """,
            (f'%{query}%',)
        ).fetchall()
        
        users = [dict(row) for row in users_rows]
        
        return jsonify({'posts': posts, 'users': users}), 200
    except Exception as e:
        return jsonify({'message': 'Server error', 'error': str(e)}), 500

@app.route('/api/user/<username>', methods=['GET'])
def get_user_profile(username):
    try:
        print(f"=== Getting profile for username: {username} ===")
        db = get_db()
        
        # Get user info
        user = db.execute(
            "SELECT id, username, email, phone, description, profile_pic, reg_date FROM users WHERE username = ?",
            (username,)
        ).fetchone()
        
        if not user:
            print(f"User not found: {username}")
            return jsonify({'message': 'User not found'}), 404
        
        user_dict = dict(user)
        user_id = user_dict['id']
        print(f"Found user: {user_dict}")
        
        # Get follower count
        follower_count = db.execute(
            "SELECT COUNT(*) as count FROM followers WHERE following_id = ?",
            (user_id,)
        ).fetchone()['count']
        
        # Get following count
        following_count = db.execute(
            "SELECT COUNT(*) as count FROM followers WHERE follower_id = ?",
            (user_id,)
        ).fetchone()['count']
        
        # Get user's posts
        posts_rows = db.execute(
            """
            SELECT p.*, u.username as author_username, u.profile_pic as author_profile_pic 
            FROM posts p
            JOIN users u ON p.user_id = u.id
            WHERE p.user_id = ?
            ORDER BY p.post_date DESC
            """,
            (user_id,)
        ).fetchall()
        
        posts = []
        for row in posts_rows:
            post = dict(row)
            post['images'] = json.loads(post['images'])
            posts.append(post)
        
        user_dict['follower_count'] = follower_count
        user_dict['following_count'] = following_count
        user_dict['posts'] = posts
        user_dict['post_count'] = len(posts)
        
        print(f"Returning profile data: username={user_dict['username']}, posts={len(posts)}")
        return jsonify(user_dict), 200
    except Exception as e:
        print(f"ERROR in get_user_profile: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'message': 'Server error', 'error': str(e)}), 500

@app.route('/api/user/<username>/followers', methods=['GET'])
def get_followers(username):
    try:
        db = get_db()
        
        user = db.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
        if not user:
            return jsonify({'message': 'User not found'}), 404
        
        followers = db.execute(
            """
            SELECT u.id, u.username, u.profile_pic, u.description
            FROM followers f
            JOIN users u ON f.follower_id = u.id
            WHERE f.following_id = ?
            ORDER BY f.follow_date DESC
            """,
            (user['id'],)
        ).fetchall()
        
        return jsonify([dict(f) for f in followers]), 200
    except Exception as e:
        return jsonify({'message': 'Server error', 'error': str(e)}), 500

@app.route('/api/user/<username>/following', methods=['GET'])
def get_following(username):
    try:
        db = get_db()
        
        user = db.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
        if not user:
            return jsonify({'message': 'User not found'}), 404
        
        following = db.execute(
            """
            SELECT u.id, u.username, u.profile_pic, u.description
            FROM followers f
            JOIN users u ON f.following_id = u.id
            WHERE f.follower_id = ?
            ORDER BY f.follow_date DESC
            """,
            (user['id'],)
        ).fetchall()
        
        return jsonify([dict(f) for f in following]), 200
    except Exception as e:
        return jsonify({'message': 'Server error', 'error': str(e)}), 500

@app.route('/api/follow/<username>', methods=['POST'])
@token_required
def follow_user(current_user, username):
    try:
        db = get_db()
        
        # Get target user
        target_user = db.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
        
        if not target_user:
            return jsonify({'message': 'User not found'}), 404
        
        if target_user['id'] == int(current_user['id']):
            return jsonify({'message': 'Cannot follow yourself'}), 400
        
        # Check if already following
        existing = db.execute(
            "SELECT * FROM followers WHERE follower_id = ? AND following_id = ?",
            (int(current_user['id']), target_user['id'])
        ).fetchone()
        
        if existing:
            return jsonify({'message': 'Already following'}), 400
        
        # Add follow
        db.execute(
            "INSERT INTO followers (follower_id, following_id, follow_date) VALUES (?, ?, ?)",
            (int(current_user['id']), target_user['id'], datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
        )
        db.commit()
        
        # Emit real-time notification to the user being followed
        print(f"📤 Emitting new_follower notification to user_{target_user['id']}")
        socketio.emit('new_follower', {
            'follower_id': int(current_user['id']),
            'follower_username': current_user['username'],
            'follower_profile_pic': current_user['profile_pic']
        }, room=f"user_{target_user['id']}")
        
        return jsonify({'message': 'Followed successfully'}), 200
    except Exception as e:
        db.rollback()
        return jsonify({'message': 'Server error', 'error': str(e)}), 500

@app.route('/api/unfollow/<username>', methods=['POST'])
@token_required
def unfollow_user(current_user, username):
    try:
        db = get_db()
        
        # Get target user
        target_user = db.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
        
        if not target_user:
            return jsonify({'message': 'User not found'}), 404
        
        # Remove follow
        db.execute(
            "DELETE FROM followers WHERE follower_id = ? AND following_id = ?",
            (int(current_user['id']), target_user['id'])
        )
        db.commit()
        
        return jsonify({'message': 'Unfollowed successfully'}), 200
    except Exception as e:
        db.rollback()
        return jsonify({'message': 'Server error', 'error': str(e)}), 500

@app.route('/api/is-following/<username>', methods=['GET'])
@token_required
def is_following(current_user, username):
    try:
        db = get_db()
        
        target_user = db.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
        
        if not target_user:
            return jsonify({'is_following': False}), 200
        
        following = db.execute(
            "SELECT * FROM followers WHERE follower_id = ? AND following_id = ?",
            (int(current_user['id']), target_user['id'])
        ).fetchone()
        
        return jsonify({'is_following': following is not None}), 200
    except Exception as e:
        return jsonify({'message': 'Server error', 'error': str(e)}), 500

@app.route('/api/delete-account', methods=['DELETE'])
@token_required
def delete_account(current_user):
    try:
        db = get_db()
        user_id = int(current_user['id'])
        
        # Delete user's posts
        db.execute("DELETE FROM posts WHERE user_id = ?", (user_id,))
        
        # Delete user's followers/following relationships
        db.execute("DELETE FROM followers WHERE follower_id = ? OR following_id = ?", (user_id, user_id))
        
        # Delete the user account
        db.execute("DELETE FROM users WHERE id = ?", (user_id,))
        
        db.commit()
        
        return jsonify({'message': 'Account deleted successfully'}), 200
    except Exception as e:
        db.rollback()
        return jsonify({'message': 'Server error', 'error': str(e)}), 500

@app.route('/api/posts/<int:post_id>', methods=['DELETE'])
@token_required
def delete_post(current_user, post_id):
    try:
        db = get_db()
        # Check if post exists and belongs to current user
        post = db.execute("SELECT * FROM posts WHERE id = ?", (post_id,)).fetchone()
        
        if not post:
            return jsonify({'message': 'Post not found'}), 404
        
        if post['user_id'] != int(current_user['id']):
            return jsonify({'message': 'Unauthorized to delete this post'}), 403
        
        # Delete the post
        db.execute("DELETE FROM posts WHERE id = ?", (post_id,))
        db.commit()
        
        return jsonify({'message': 'Post deleted successfully'}), 200
    except Exception as e:
        db.rollback()
        return jsonify({'message': 'Server error', 'error': str(e)}), 500

@app.route('/api/posts/<int:post_id>', methods=['PUT'])
@token_required
def edit_post(current_user, post_id):
    try:
        db = get_db()
        # Check if post exists and belongs to current user
        post = db.execute("SELECT * FROM posts WHERE id = ?", (post_id,)).fetchone()
        
        if not post:
            return jsonify({'message': 'Post not found'}), 404
        
        if post['user_id'] != int(current_user['id']):
            return jsonify({'message': 'Unauthorized to edit this post'}), 403
        
        data = request.json
        
        # Update the post
        db.execute(
            """
            UPDATE posts SET 
            title = ?, price = ?, description = ?, contact = ?, images = ?
            WHERE id = ?
            """,
            (
                data.get('title', post['title']),
                data.get('price', post['price']),
                data.get('description', post['description']),
                data.get('contact', post['contact']),
                json.dumps(data.get('images', json.loads(post['images']))),
                post_id
            )
        )
        db.commit()
        
        return jsonify({'message': 'Post updated successfully'}), 200
    except Exception as e:
        db.rollback()
        return jsonify({'message': 'Server error', 'error': str(e)}), 500

# Messaging API
@app.route('/api/conversations', methods=['GET'])
@token_required
def get_conversations(current_user):
    try:
        db = get_db()
        user_id = int(current_user['id'])
        
        # Get all unique users the current user has messaged with
        other_users = db.execute("""
            SELECT DISTINCT 
                CASE 
                    WHEN sender_id = ? THEN receiver_id 
                    ELSE sender_id 
                END as other_user_id
            FROM messages
            WHERE sender_id = ? OR receiver_id = ?
        """, (user_id, user_id, user_id)).fetchall()
        
        conversations = []
        for row in other_users:
            other_id = row['other_user_id']
            
            # Get user info
            user_info = db.execute("SELECT username, profile_pic FROM users WHERE id = ?", (other_id,)).fetchone()
            
            if not user_info:
                continue
            
            # Get last message
            last_msg = db.execute("""
                SELECT message, sent_date FROM messages 
                WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
                ORDER BY sent_date DESC LIMIT 1
            """, (user_id, other_id, other_id, user_id)).fetchone()
            
            # Get unread count
            unread = db.execute("""
                SELECT COUNT(*) as count FROM messages 
                WHERE sender_id = ? AND receiver_id = ? AND is_read = 0
            """, (other_id, user_id)).fetchone()
            
            conversations.append({
                'other_user_id': other_id,
                'username': user_info['username'],
                'profile_pic': user_info['profile_pic'],
                'last_message': last_msg['message'] if last_msg else None,
                'last_message_date': last_msg['sent_date'] if last_msg else None,
                'unread_count': unread['count']
            })
        
        # Sort by last message date
        conversations.sort(key=lambda x: x['last_message_date'] or '', reverse=True)
        
        return jsonify(conversations), 200
    except Exception as e:
        print(f"ERROR in get_conversations: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'message': 'Server error', 'error': str(e)}), 500

@app.route('/api/messages/<username>', methods=['GET'])
@token_required
def get_messages(current_user, username):
    try:
        db = get_db()
        user_id = int(current_user['id'])
        
        other_user = db.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
        if not other_user:
            return jsonify({'message': 'User not found'}), 404
        
        other_user_id = other_user['id']
        
        # Get messages between the two users
        messages = db.execute("""
            SELECT m.*, 
                   sender.username as sender_username,
                   sender.profile_pic as sender_profile_pic,
                   reply_msg.message as reply_message,
                   reply_sender.username as reply_sender_username
            FROM messages m
            JOIN users sender ON m.sender_id = sender.id
            LEFT JOIN messages reply_msg ON m.reply_to = reply_msg.id
            LEFT JOIN users reply_sender ON reply_msg.sender_id = reply_sender.id
            WHERE (m.sender_id = ? AND m.receiver_id = ?)
               OR (m.sender_id = ? AND m.receiver_id = ?)
            ORDER BY m.sent_date ASC
        """, (user_id, other_user_id, other_user_id, user_id)).fetchall()
        
        # Mark messages as read
        db.execute("""
            UPDATE messages SET is_read = 1 
            WHERE sender_id = ? AND receiver_id = ? AND is_read = 0
        """, (other_user_id, user_id))
        db.commit()
        
        # Notify sender that messages were read
        socketio.emit('messages_read', {
            'username': current_user['username']
        }, room=f"user_{other_user_id}")
        
        return jsonify([dict(m) for m in messages]), 200
    except Exception as e:
        print(f"ERROR in get_messages: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'message': 'Server error', 'error': str(e)}), 500

@app.route('/api/messages/<int:message_id>', methods=['DELETE'])
@token_required
def delete_message(current_user, message_id):
    try:
        db = get_db()
        user_id = int(current_user['id'])
        
        # Check if message exists and belongs to current user
        message = db.execute("SELECT * FROM messages WHERE id = ?", (message_id,)).fetchone()
        if not message:
            return jsonify({'message': 'Message not found'}), 404
        
        if message['sender_id'] != user_id:
            return jsonify({'message': 'Unauthorized'}), 403
        
        # Delete the message
        db.execute("DELETE FROM messages WHERE id = ?", (message_id,))
        db.commit()
        
        # Emit deletion via SocketIO
        socketio.emit('message_deleted', {
            'message_id': message_id
        }, room=f"user_{message['receiver_id']}")
        
        return jsonify({'message': 'Message deleted'}), 200
    except Exception as e:
        print(f"ERROR in delete_message: {str(e)}")
        import traceback
        traceback.print_exc()
        db.rollback()
        return jsonify({'message': 'Server error', 'error': str(e)}), 500

@app.route('/api/messages/<int:message_id>', methods=['PUT'])
@token_required
def edit_message(current_user, message_id):
    try:
        db = get_db()
        user_id = int(current_user['id'])
        
        # Check if message exists and belongs to current user
        message = db.execute("SELECT * FROM messages WHERE id = ?", (message_id,)).fetchone()
        if not message:
            return jsonify({'message': 'Message not found'}), 404
        
        if message['sender_id'] != user_id:
            return jsonify({'message': 'Unauthorized'}), 403
        
        data = request.json
        new_message = data.get('message', '').strip()
        
        if not new_message:
            return jsonify({'message': 'Message cannot be empty'}), 400
        
        # Update the message
        db.execute("UPDATE messages SET message = ? WHERE id = ?", (new_message, message_id))
        db.commit()
        
        # Emit update via SocketIO
        socketio.emit('message_edited', {
            'message_id': message_id,
            'new_message': new_message
        }, room=f"user_{message['receiver_id']}")
        
        return jsonify({'message': 'Message updated'}), 200
    except Exception as e:
        print(f"ERROR in edit_message: {str(e)}")
        import traceback
        traceback.print_exc()
        db.rollback()
        return jsonify({'message': 'Server error', 'error': str(e)}), 500

@app.route('/api/messages/<username>', methods=['POST'])
@token_required
def send_message(current_user, username):
    try:
        db = get_db()
        user_id = int(current_user['id'])
        
        other_user = db.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
        if not other_user:
            return jsonify({'message': 'User not found'}), 404
        
        data = request.json
        message = data.get('message', '').strip()
        reply_to = data.get('reply_to')
        
        if not message:
            return jsonify({'message': 'Message cannot be empty'}), 400
        
        sent_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        cursor = db.execute("""
            INSERT INTO messages (sender_id, receiver_id, message, sent_date, is_read, reply_to)
            VALUES (?, ?, ?, ?, 0, ?)
        """, (user_id, other_user['id'], message, sent_date, reply_to))
        db.commit()
        
        message_id = cursor.lastrowid
        
        # Emit via SocketIO for live updates
        message_data = {
            'id': message_id,
            'sender_id': user_id,
            'sender_username': current_user['username'],
            'sender_profile_pic': current_user['profile_pic'],
            'receiver_id': other_user['id'],
            'message': message,
            'sent_date': sent_date,
            'is_read': 0
        }
        
        print(f"📤 Emitting new_message to room user_{other_user['id']}: {message_data}")
        socketio.emit('new_message', message_data, room=f"user_{other_user['id']}")
        print(f"✅ Message emitted successfully")
        
        return jsonify({
            'message': 'Message sent',
            'id': message_id,
            'sent_date': sent_date
        }), 201
    except Exception as e:
        print(f"ERROR in send_message: {str(e)}")
        import traceback
        traceback.print_exc()
        db.rollback()
        return jsonify({'message': 'Server error', 'error': str(e)}), 500

# Static File Serving
# ROOT_DIR already defined at the top

@app.route('/HTML code/<path:filename>')
def serve_html(filename):
    return send_from_directory(os.path.join(ROOT_DIR, 'HTML code'), filename)

@app.route('/CSS code/<path:filename>')
def serve_css(filename):
    return send_from_directory(os.path.join(ROOT_DIR, 'CSS code'), filename)

@app.route('/pictures/<path:filename>')
def serve_pictures(filename):
    return send_from_directory(os.path.join(ROOT_DIR, 'pictures'), filename)

@app.route('/sounds/<path:filename>')
def serve_sounds(filename):
    return send_from_directory(os.path.join(ROOT_DIR, 'sounds'), filename)

@app.route('/JS code/<path:filename>')
def serve_js_folder(filename):
    return send_from_directory(os.path.join(ROOT_DIR, 'JS code'), filename)

# Legacy routes for backward compatibility
@app.route('/home-page.js')
def serve_home_js():
    return send_from_directory(os.path.join(ROOT_DIR, 'JS code'), 'home-page.js')

@app.route('/create-post.js')
def serve_create_post_js():
    return send_from_directory(os.path.join(ROOT_DIR, 'JS code'), 'create-post.js')

@app.route('/profile.js')
def serve_profile_js():
    return send_from_directory(os.path.join(ROOT_DIR, 'JS code'), 'profile.js')

@app.route('/messages.js')
def serve_messages_js():
    return send_from_directory(os.path.join(ROOT_DIR, 'JS code'), 'messages.js')

@app.route('/')
def serve_main():
    return send_from_directory(os.path.join(ROOT_DIR, 'HTML code'), 'main-page.html')

# Track online users
online_users = set()

# SocketIO Events
@socketio.on('connect')
def handle_connect():
    print('Client connected')

@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected')

@socketio.on('join')
def handle_join(data):
    user_id = data.get('user_id')
    if user_id:
        join_room(f"user_{user_id}")
        online_users.add(user_id)
        print(f"User {user_id} joined their room and is now online")
        
        # Broadcast online status
        socketio.emit('user_online', {'user_id': user_id})

@socketio.on('leave')
def handle_leave(data):
    user_id = data.get('user_id')
    if user_id:
        leave_room(f"user_{user_id}")
        online_users.discard(user_id)
        print(f"User {user_id} left their room and is now offline")
        
        # Broadcast offline status
        socketio.emit('user_offline', {'user_id': user_id})

@socketio.on('typing')
def handle_typing(data):
    receiver_id = data.get('receiver_id')
    sender_username = data.get('sender_username')
    is_typing = data.get('is_typing', True)
    
    if receiver_id:
        socketio.emit('user_typing', {
            'username': sender_username,
            'is_typing': is_typing
        }, room=f"user_{receiver_id}")

@app.route('/api/user/<username>/online', methods=['GET'])
def check_user_online(username):
    try:
        db = get_db()
        user = db.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
        
        if not user:
            return jsonify({'online': False}), 404
        
        is_online = user['id'] in online_users
        return jsonify({'online': is_online}), 200
    except Exception as e:
        return jsonify({'message': 'Server error', 'error': str(e)}), 500

# Admin API Endpoints
@app.route('/api/admin/check', methods=['GET'])
@token_required
def check_admin_access(current_user):
    """Check if current user has admin privileges"""
    try:
        db = get_db()
        user = db.execute("SELECT role FROM users WHERE id = ?", (current_user['id'],)).fetchone()
        
        if user and user['role'] == 'admin':
            return jsonify({'is_admin': True, 'username': current_user['username']}), 200
        else:
            return jsonify({'is_admin': False}), 403
    except Exception as e:
        return jsonify({'message': 'Server error', 'error': str(e)}), 500

@app.route('/api/admin/users', methods=['GET'])
@token_required
def get_all_users(current_user):
    """Get all users for admin management"""
    try:
        db = get_db()
        # Check admin privileges
        admin_check = db.execute("SELECT role FROM users WHERE id = ?", (current_user['id'],)).fetchone()
        if not admin_check or admin_check['role'] != 'admin':
            return jsonify({'message': 'Admin access required'}), 403
        
        users = db.execute("""
            SELECT id, username, email, role, status, reg_date, 
                   banned_until, ban_reason
            FROM users 
            ORDER BY reg_date DESC
        """).fetchall()
        
        return jsonify([dict(user) for user in users]), 200
    except Exception as e:
        return jsonify({'message': 'Server error', 'error': str(e)}), 500

@app.route('/api/admin/posts', methods=['GET'])
@token_required
def get_all_posts_admin(current_user):
    """Get all posts for admin management"""
    try:
        db = get_db()
        # Check admin privileges
        admin_check = db.execute("SELECT role FROM users WHERE id = ?", (current_user['id'],)).fetchone()
        if not admin_check or admin_check['role'] != 'admin':
            return jsonify({'message': 'Admin access required'}), 403
        
        posts = db.execute("""
            SELECT p.*, u.username as author_username, u.profile_pic as author_profile_pic 
            FROM posts p
            JOIN users u ON p.user_id = u.id
            ORDER BY p.post_date DESC
        """).fetchall()
        
        posts_list = []
        for row in posts:
            post = dict(row)
            post['images'] = json.loads(post['images'])
            posts_list.append(post)
            
        return jsonify(posts_list), 200
    except Exception as e:
        return jsonify({'message': 'Server error', 'error': str(e)}), 500

@app.route('/api/admin/posts/<int:post_id>', methods=['DELETE'])
@token_required
def admin_delete_post(current_user, post_id):
    """Admin delete any post with reason"""
    try:
        db = get_db()
        # Check admin privileges
        admin_check = db.execute("SELECT role FROM users WHERE id = ?", (current_user['id'],)).fetchone()
        if not admin_check or admin_check['role'] != 'admin':
            return jsonify({'message': 'Admin access required'}), 403
        
        data = request.json
        reason = data.get('reason', 'Deleted by admin')
        
        # Get post details before deletion
        post = db.execute("SELECT * FROM posts WHERE id = ?", (post_id,)).fetchone()
        if not post:
            return jsonify({'message': 'Post not found'}), 404
        
        # Log the deletion (if moderation_actions table exists)
        try:
            db.execute("""
                INSERT INTO moderation_actions (moderator_id, target_user_id, action_type, reason, created_date)
                VALUES (?, ?, 'delete_post', ?, ?)
            """, (current_user['id'], post['user_id'], reason, datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
        except:
            pass  # Table might not exist yet
        
        # Delete the post
        db.execute("DELETE FROM posts WHERE id = ?", (post_id,))
        db.commit()
        
        return jsonify({'message': 'Post deleted successfully', 'reason': reason}), 200
    except Exception as e:
        db.rollback()
        return jsonify({'message': 'Server error', 'error': str(e)}), 500

@app.route('/api/posts/<int:post_id>/report', methods=['POST'])
@token_required
def report_post(current_user, post_id):
    """Report a post for moderation"""
    try:
        db = get_db()
        
        # Check if post exists
        post = db.execute("SELECT * FROM posts WHERE id = ?", (post_id,)).fetchone()
        if not post:
            return jsonify({'message': 'Post not found'}), 404
        
        data = request.json
        reason = data.get('reason', 'Inappropriate content')
        description = data.get('description', '')
        
        # Check if user already reported this post
        existing_report = db.execute("""
            SELECT id FROM user_reports 
            WHERE reporter_id = ? AND reported_post_id = ?
        """, (current_user['id'], post_id)).fetchone()
        
        if existing_report:
            return jsonify({'message': 'You have already reported this post'}), 400
        
        # Create report
        db.execute("""
            INSERT INTO user_reports (reporter_id, reported_user_id, reported_post_id, reason, description, status, created_date)
            VALUES (?, ?, ?, ?, ?, 'pending', ?)
        """, (current_user['id'], post['user_id'], post_id, reason, description, datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
        
        db.commit()
        return jsonify({'message': 'Post reported successfully. Thank you for helping keep our community safe.'}), 201
    except Exception as e:
        db.rollback()
        return jsonify({'message': 'Server error', 'error': str(e)}), 500

@app.route('/api/admin/users/<int:user_id>/ban', methods=['POST'])
@token_required
def ban_user(current_user, user_id):
    """Ban a user"""
    try:
        db = get_db()
        # Check admin privileges
        admin_check = db.execute("SELECT role FROM users WHERE id = ?", (current_user['id'],)).fetchone()
        if not admin_check or admin_check['role'] != 'admin':
            return jsonify({'message': 'Admin access required'}), 403
        
        data = request.json
        reason = data.get('reason', 'Banned by admin')
        duration_days = data.get('duration_days', 7)
        
        # Calculate ban end date
        ban_until = datetime.now() + timedelta(days=duration_days)
        
        # Update user status
        db.execute("""
            UPDATE users 
            SET status = 'banned', banned_until = ?, ban_reason = ?
            WHERE id = ?
        """, (ban_until.strftime("%Y-%m-%d %H:%M:%S"), reason, user_id))
        
        # Log the action
        try:
            db.execute("""
                INSERT INTO moderation_actions (moderator_id, target_user_id, action_type, reason, created_date)
                VALUES (?, ?, 'ban_user', ?, ?)
            """, (current_user['id'], user_id, reason, datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
        except:
            pass
        
        db.commit()
        return jsonify({'message': 'User banned successfully'}), 200
    except Exception as e:
        db.rollback()
        return jsonify({'message': 'Server error', 'error': str(e)}), 500

@app.route('/api/admin/users/<int:user_id>/unban', methods=['POST'])
@token_required
def unban_user(current_user, user_id):
    """Unban a user"""
    try:
        db = get_db()
        # Check admin privileges
        admin_check = db.execute("SELECT role FROM users WHERE id = ?", (current_user['id'],)).fetchone()
        if not admin_check or admin_check['role'] != 'admin':
            return jsonify({'message': 'Admin access required'}), 403
        
        # Update user status to active
        db.execute("""
            UPDATE users 
            SET status = 'active', banned_until = NULL, ban_reason = NULL
            WHERE id = ?
        """, (user_id,))
        
        # Log the action
        try:
            db.execute("""
                INSERT INTO moderation_actions (moderator_id, target_user_id, action_type, reason, created_date)
                VALUES (?, ?, 'unban_user', 'Unbanned by admin', ?)
            """, (current_user['id'], user_id, datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
        except:
            pass
        
        db.commit()
        return jsonify({'message': 'User unbanned successfully'}), 200
    except Exception as e:
        db.rollback()
        return jsonify({'message': 'Server error', 'error': str(e)}), 500

@app.route('/api/admin/users/<int:user_id>/role', methods=['POST'])
@token_required
def change_user_role(current_user, user_id):
    """Change a user's role (promote/demote)"""
    try:
        db = get_db()
        admin_check = db.execute("SELECT role FROM users WHERE id = ?", (current_user['id'],)).fetchone()
        if not admin_check or admin_check['role'] != 'admin':
            return jsonify({'message': 'Admin access required'}), 403

        data = request.json
        new_role = data.get('role')
        if new_role not in ('user', 'moderator', 'admin'):
            return jsonify({'message': 'Invalid role'}), 400

        target = db.execute("SELECT username FROM users WHERE id = ?", (user_id,)).fetchone()
        if not target:
            return jsonify({'message': 'User not found'}), 404

        db.execute("UPDATE users SET role = ? WHERE id = ?", (new_role, user_id))
        try:
            db.execute("""
                INSERT INTO moderation_actions (moderator_id, target_user_id, action_type, reason, created_date)
                VALUES (?, ?, 'role_change', ?, ?)
            """, (current_user['id'], user_id, f'Role changed to {new_role}', datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
        except:
            pass
        db.commit()
        return jsonify({'message': f'Role updated to {new_role}'}), 200
    except Exception as e:
        db.rollback()
        return jsonify({'message': 'Server error', 'error': str(e)}), 500


@app.route('/api/admin/users/<int:user_id>/warn', methods=['POST'])
@token_required
def warn_user(current_user, user_id):
    """Issue a warning to a user"""
    try:
        db = get_db()
        admin_check = db.execute("SELECT role FROM users WHERE id = ?", (current_user['id'],)).fetchone()
        if not admin_check or admin_check['role'] != 'admin':
            return jsonify({'message': 'Admin access required'}), 403

        data = request.json
        reason = data.get('reason', 'Violation of community guidelines')

        target = db.execute("SELECT username FROM users WHERE id = ?", (user_id,)).fetchone()
        if not target:
            return jsonify({'message': 'User not found'}), 404

        db.execute("""
            INSERT INTO warnings (user_id, moderator_id, reason, created_date)
            VALUES (?, ?, ?, ?)
        """, (user_id, current_user['id'], reason, datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
        try:
            db.execute("""
                INSERT INTO moderation_actions (moderator_id, target_user_id, action_type, reason, created_date)
                VALUES (?, ?, 'warn_user', ?, ?)
            """, (current_user['id'], user_id, reason, datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
        except:
            pass
        db.commit()
        return jsonify({'message': 'Warning issued successfully'}), 201
    except Exception as e:
        db.rollback()
        return jsonify({'message': 'Server error', 'error': str(e)}), 500


@app.route('/api/admin/users/<int:user_id>/warnings', methods=['GET'])
@token_required
def get_user_warnings(current_user, user_id):
    """Get all warnings for a user"""
    try:
        db = get_db()
        admin_check = db.execute("SELECT role FROM users WHERE id = ?", (current_user['id'],)).fetchone()
        if not admin_check or admin_check['role'] != 'admin':
            return jsonify({'message': 'Admin access required'}), 403

        warnings = db.execute("""
            SELECT w.*, u.username as admin_username
            FROM warnings w
            JOIN users u ON w.moderator_id = u.id
            WHERE w.user_id = ?
            ORDER BY w.created_date DESC
        """, (user_id,)).fetchall()
        return jsonify([dict(w) for w in warnings]), 200
    except Exception as e:
        return jsonify({'message': 'Server error', 'error': str(e)}), 500


@app.route('/api/admin/warnings/<int:warning_id>', methods=['DELETE'])
@token_required
def delete_warning(current_user, warning_id):
    """Remove a warning"""
    try:
        db = get_db()
        admin_check = db.execute("SELECT role FROM users WHERE id = ?", (current_user['id'],)).fetchone()
        if not admin_check or admin_check['role'] != 'admin':
            return jsonify({'message': 'Admin access required'}), 403

        db.execute("DELETE FROM warnings WHERE id = ?", (warning_id,))
        db.commit()
        return jsonify({'message': 'Warning removed'}), 200
    except Exception as e:
        db.rollback()
        return jsonify({'message': 'Server error', 'error': str(e)}), 500


@app.route('/api/admin/reports', methods=['GET'])
@token_required
def get_all_reports(current_user):
    """Get all user reports"""
    try:
        db = get_db()
        admin_check = db.execute("SELECT role FROM users WHERE id = ?", (current_user['id'],)).fetchone()
        if not admin_check or admin_check['role'] != 'admin':
            return jsonify({'message': 'Admin access required'}), 403

        reports = db.execute("""
            SELECT r.*,
                   reporter.username as reporter_username,
                   reported.username as reported_username
            FROM user_reports r
            JOIN users reporter ON r.reporter_id = reporter.id
            JOIN users reported ON r.reported_user_id = reported.id
            ORDER BY r.created_date DESC
        """).fetchall()
        return jsonify([dict(r) for r in reports]), 200
    except Exception as e:
        return jsonify({'message': 'Server error', 'error': str(e)}), 500


@app.route('/api/admin/reports/<int:report_id>/resolve', methods=['POST'])
@token_required
def resolve_report(current_user, report_id):
    """Resolve or dismiss a report"""
    try:
        db = get_db()
        admin_check = db.execute("SELECT role FROM users WHERE id = ?", (current_user['id'],)).fetchone()
        if not admin_check or admin_check['role'] != 'admin':
            return jsonify({'message': 'Admin access required'}), 403

        data = request.json
        action = data.get('action', 'resolved')  # 'resolved' or 'dismissed'
        notes = data.get('notes', '')

        db.execute("""
            UPDATE user_reports SET status = ?, resolved_by = ?, resolved_date = ?
            WHERE id = ?
        """, (action, current_user['id'], datetime.now().strftime("%Y-%m-%d %H:%M:%S"), report_id))
        db.commit()
        return jsonify({'message': f'Report {action}'}), 200
    except Exception as e:
        db.rollback()
        return jsonify({'message': 'Server error', 'error': str(e)}), 500


@app.route('/api/admin/activity', methods=['GET'])
@token_required
def get_activity_log(current_user):
    """Get moderation activity log"""
    try:
        db = get_db()
        admin_check = db.execute("SELECT role FROM users WHERE id = ?", (current_user['id'],)).fetchone()
        if not admin_check or admin_check['role'] != 'admin':
            return jsonify({'message': 'Admin access required'}), 403

        limit = request.args.get('limit', 100, type=int)
        actions = db.execute("""
            SELECT ma.*,
                   a.username as admin_username,
                   t.username as target_username
            FROM moderation_actions ma
            JOIN users a ON ma.moderator_id = a.id
            JOIN users t ON ma.target_user_id = t.id
            ORDER BY ma.created_date DESC
            LIMIT ?
        """, (limit,)).fetchall()
        return jsonify([dict(a) for a in actions]), 200
    except Exception as e:
        return jsonify({'message': 'Server error', 'error': str(e)}), 500


@app.route('/api/admin/warnings/all', methods=['GET'])
@token_required
def get_all_warnings(current_user):
    """Get all warnings across all users in one query"""
    try:
        db = get_db()
        admin_check = db.execute("SELECT role FROM users WHERE id = ?", (current_user['id'],)).fetchone()
        if not admin_check or admin_check['role'] != 'admin':
            return jsonify({'message': 'Admin access required'}), 403

        warnings = db.execute("""
            SELECT w.*,
                   target.username as target_username,
                   target.profile_pic as profile_pic,
                   mod.username as admin_username
            FROM warnings w
            JOIN users target ON w.user_id = target.id
            JOIN users mod ON w.moderator_id = mod.id
            ORDER BY w.created_date DESC
        """).fetchall()
        return jsonify([dict(w) for w in warnings]), 200
    except Exception as e:
        return jsonify({'message': 'Server error', 'error': str(e)}), 500


@app.route('/api/admin/stats', methods=['GET'])
@token_required
def get_admin_stats(current_user):
    """Get platform statistics for admin dashboard"""
    try:
        db = get_db()
        admin_check = db.execute("SELECT role FROM users WHERE id = ?", (current_user['id'],)).fetchone()
        if not admin_check or admin_check['role'] != 'admin':
            return jsonify({'message': 'Admin access required'}), 403

        row = db.execute("""
            SELECT
                (SELECT COUNT(*) FROM users) as total_users,
                (SELECT COUNT(*) FROM posts) as total_posts,
                (SELECT COUNT(*) FROM messages) as total_messages,
                (SELECT COUNT(*) FROM users WHERE role = 'admin') as admin_count,
                (SELECT COUNT(*) FROM users WHERE status = 'banned') as banned_count,
                (SELECT COUNT(*) FROM user_reports WHERE status = 'pending') as pending_reports
        """).fetchone()

        return jsonify(dict(row)), 200
    except Exception as e:
        return jsonify({'message': 'Server error', 'error': str(e)}), 500


# Run Application
if __name__ == '__main__':
    init_db()
    socketio.run(app, host='0.0.0.0', port=5000, debug=True, allow_unsafe_werkzeug=True)
