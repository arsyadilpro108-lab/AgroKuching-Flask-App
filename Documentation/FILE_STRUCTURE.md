# 📁 AgroKuching File Structure

## Project Organization

```
AgroKuching/
├── app.py                          # Main entry point (runs the application)
│
├── Python code/                    # All Python backend code
│   └── main_app.py                # Flask application with all routes
│
├── JS code/                        # All JavaScript files
│   ├── messages.js                # Real-time chat functionality
│   ├── home-page.js               # Home page functionality
│   ├── create-post.js             # Create post functionality
│   └── profile.js                 # Profile page functionality
│
├── HTML code/                      # All HTML pages
│   ├── main-page.html             # Landing page
│   ├── log-in.html                # Login page
│   ├── sign-up.html               # Registration page
│   ├── home-page.html             # User home feed
│   ├── messages.html              # Real-time chat interface
│   ├── profile.html               # User profile page
│   ├── create-post.html           # Create new post
│   ├── settings.html              # User settings
│   ├── START_HERE.html            # Setup guide
│   ├── test_socketio.html         # SocketIO connection tester
│   ├── test_sounds.html           # Sound testing page
│   └── test_realtime_chat.html    # Chat feature demo
│
├── CSS code/                       # All CSS stylesheets
│   ├── messages.css               # Chat interface styles
│   ├── home-page.css              # Home page styles
│   ├── profile.css                # Profile page styles
│   ├── create-post.css            # Create post styles
│   ├── log-in.css                 # Login page styles
│   ├── sign-up.css                # Sign up page styles
│   ├── main-page.css              # Landing page styles
│   └── settings.css               # Settings page styles
│
├── pictures/                       # Image assets
│   ├── Default PFP.png            # Default profile picture
│   ├── main backrgound.jpg        # Main background image
│   └── ...
│
├── sounds/                         # Audio files
│   ├── notification.mp3           # Chat notification sound
│   └── README.txt                 # Sound setup guide
│
├── agrokuching.db                   # SQLite database
├── agrokuching.db.backup            # Database backup
│
└── Documentation/                  # Guides and documentation
    ├── README_REALTIME_CHAT.md
    ├── QUICK_START.md
    ├── TROUBLESHOOTING.md
    ├── HOW_TO_CHANGE_NOTIFICATION_SOUND.md
    └── FILE_STRUCTURE.md (this file)
```

## How Files Are Connected

### 1. Application Flow

```
User Browser
    ↓
app.py (root)
    ↓
Python code/main_app.py (Flask routes)
    ↓
HTML code/*.html (pages)
    ↓
JS code/*.js (functionality)
    ↓
CSS code/*.css (styling)
```

### 2. File References

#### HTML Files Reference:
- **CSS**: `/CSS code/filename.css`
- **JS**: `/JS code/filename.js`
- **Images**: `/pictures/filename.png`
- **Sounds**: `/sounds/filename.mp3`

#### Python (main_app.py) Serves:
- HTML from: `ROOT_DIR/HTML code/`
- CSS from: `ROOT_DIR/CSS code/`
- JS from: `ROOT_DIR/JS code/`
- Images from: `ROOT_DIR/pictures/`
- Sounds from: `ROOT_DIR/sounds/`

### 3. URL Routes

| URL | File Served | Purpose |
|-----|-------------|---------|
| `/` | HTML code/main-page.html | Landing page |
| `/HTML code/log-in.html` | HTML code/log-in.html | Login |
| `/HTML code/messages.html` | HTML code/messages.html | Chat |
| `/JS code/messages.js` | JS code/messages.js | Chat logic |
| `/CSS code/messages.css` | CSS code/messages.css | Chat styles |
| `/pictures/Default PFP.png` | pictures/Default PFP.png | Images |
| `/sounds/notification.mp3` | sounds/notification.mp3 | Sounds |

## Starting the Application

### Method 1: Using app.py (Recommended)
```bash
python app.py
```

### Method 2: Using the batch file
```bash
RESTART_SERVER.bat
```

### What Happens:
1. `app.py` imports from `Python code/main_app.py`
2. Flask server starts on `http://localhost:5000`
3. All routes are configured to serve files from organized folders
4. Database is created/accessed in root directory

## Adding New Files

### Adding a New HTML Page:
1. Create file in `HTML code/` folder
2. Reference CSS: `<link rel="stylesheet" href="/CSS code/your-style.css">`
3. Reference JS: `<script src="/JS code/your-script.js"></script>`

### Adding a New JavaScript File:
1. Create file in `JS code/` folder
2. Reference in HTML: `<script src="/JS code/your-script.js"></script>`
3. Flask will automatically serve it

### Adding a New CSS File:
1. Create file in `CSS code/` folder
2. Reference in HTML: `<link rel="stylesheet" href="/CSS code/your-style.css">`

### Adding a New Python Module:
1. Create file in `Python code/` folder
2. Import in `main_app.py`: `from module_name import function`

## Important Notes

### ✅ Correct Paths:
```html
<!-- HTML files -->
<link rel="stylesheet" href="/CSS code/messages.css">
<script src="/JS code/messages.js"></script>
<img src="/pictures/Default PFP.png">
<audio src="/sounds/notification.mp3">
```

### ❌ Incorrect Paths:
```html
<!-- Don't use these -->
<script src="/messages.js">  <!-- Old path -->
<script src="messages.js">   <!-- Relative path -->
<script src="../JS code/messages.js">  <!-- Relative path -->
```

## Database Location

The SQLite database (`agrokuching.db`) remains in the **root directory** for easy access and backup.

## Benefits of This Structure

1. **Organization**: Easy to find files by type
2. **Scalability**: Easy to add new files
3. **Maintenance**: Clear separation of concerns
4. **Collaboration**: Team members know where to find things
5. **Deployment**: Clean structure for production

## File Naming Conventions

- **HTML**: `kebab-case.html` (e.g., `home-page.html`)
- **CSS**: `kebab-case.css` (e.g., `home-page.css`)
- **JS**: `kebab-case.js` (e.g., `home-page.js`)
- **Python**: `snake_case.py` (e.g., `main_app.py`)
- **Images**: `Title Case.png` (e.g., `Default PFP.png`)

## Troubleshooting

### Files Not Loading?
1. Check the browser console (F12) for 404 errors
2. Verify file paths start with `/` (absolute paths)
3. Check file exists in correct folder
4. Restart the Flask server

### CSS/JS Not Updating?
1. Hard refresh: `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac)
2. Clear browser cache
3. Add version parameter: `?v=2` to the file path

### Import Errors in Python?
1. Make sure `Python code` folder is in the path
2. Check `app.py` has correct import statement
3. Verify file names match import statements

## Quick Reference

### Start Server:
```bash
python app.py
```

### Access Application:
```
http://localhost:5000
```

### Test Pages:
- Main: `http://localhost:5000/`
- Login: `http://localhost:5000/HTML code/log-in.html`
- Messages: `http://localhost:5000/HTML code/messages.html`
- Test SocketIO: `http://localhost:5000/HTML code/test_socketio.html`
- Test Sounds: `http://localhost:5000/HTML code/test_sounds.html`

---

**Last Updated:** December 2024  
**Version:** 2.0 (Organized Structure)
