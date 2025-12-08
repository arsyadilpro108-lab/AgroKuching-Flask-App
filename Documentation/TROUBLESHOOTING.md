# Real-Time Chat Troubleshooting Guide

## Issue: Messages not appearing instantly / Need to refresh

### Step 1: Check if Flask-SocketIO is installed
```bash
pip install flask-socketio
```

### Step 2: Restart the Flask server
1. Stop the current server (Ctrl+C)
2. Run: `python app.py`
3. Look for this message: `Socket.IO server started`

### Step 3: Check Browser Console
1. Open the messages page
2. Press F12 to open Developer Tools
3. Go to the "Console" tab
4. Look for these messages:
   - `🔌 Initializing SocketIO connection...`
   - `✅ SocketIO connected! <socket-id>`
   - `Current user loaded: <user-data>`
   - `Joined room: user_<id>`

### Step 4: Test SocketIO Connection
1. Open `/test_socketio.html` in your browser
2. Click "Test Connection"
3. You should see: `✅ Socket is connected!`
4. If not, check the error messages

### Step 5: Check Network Tab
1. In Developer Tools, go to "Network" tab
2. Look for "socket.io" requests
3. Check if they're successful (Status 200 or 101)
4. Look for "WS" (WebSocket) connections

### Step 6: Send a Test Message
1. Open two browser windows (or use incognito mode)
2. Log in as different users
3. Open messages in both
4. Send a message from User A
5. Check console in User B's window for:
   - `🔔 New message received via SocketIO:`
   - `Message is from current chat user, appending...`

## Common Issues and Solutions

### Issue: "SocketIO connection error"
**Solution:** Make sure the Flask server is running with SocketIO support
```bash
pip install flask-socketio python-socketio
python app.py
```

### Issue: Messages appear after refresh but not instantly
**Cause:** SocketIO not connecting properly
**Solution:**
1. Check if port 5000 is blocked by firewall
2. Try accessing via `http://localhost:5000` instead of `127.0.0.1`
3. Check browser console for connection errors

### Issue: "Socket is NOT connected"
**Possible causes:**
1. Flask server not running
2. SocketIO not installed
3. CORS issues
4. Firewall blocking WebSocket connections

**Solutions:**
1. Restart Flask server
2. Install: `pip install flask-socketio`
3. Check server logs for errors
4. Try different browser

### Issue: Messages sent but not received by other user
**Check:**
1. Is the other user logged in?
2. Are they in the messages page?
3. Check server console for "User X joined their room"
4. Check browser console for "new_message" event

### Issue: Typing indicator not working
**Check:**
1. SocketIO connection is active
2. Both users are in a chat
3. Browser console shows "user_typing" events
4. Server logs show typing events being emitted

## Debug Mode

### Enable detailed logging:
The app.py file now has logging enabled. Check the server console for:
- `Client connected`
- `User X joined their room and is now online`
- `User X is typing...`
- `Message sent from X to Y`

### Browser Console Commands:
```javascript
// Check if socket is connected
socket.connected

// Check socket ID
socket.id

// Check current user
currentUser

// Check current chat user
currentChatUser

// Manually emit a test event
socket.emit('join', { user_id: 1 })
```

## Testing Checklist

- [ ] Flask server is running
- [ ] Flask-SocketIO is installed
- [ ] Browser console shows "SocketIO connected"
- [ ] User joins their room successfully
- [ ] Can send messages via API
- [ ] Messages appear in sender's chat immediately
- [ ] SocketIO emits "new_message" event
- [ ] Receiver's browser receives "new_message" event
- [ ] Message appears in receiver's chat without refresh

## Still Not Working?

### Check Server Logs:
Look for errors in the Flask server console when:
1. User logs in
2. User opens messages page
3. User sends a message

### Check Browser Console:
Look for errors when:
1. Page loads
2. SocketIO connects
3. Message is sent
4. Message is received

### Network Issues:
1. Check if WebSocket upgrade is successful (Status 101)
2. Look for "socket.io" requests in Network tab
3. Check if polling fallback is working

### Last Resort:
1. Clear browser cache
2. Try incognito/private mode
3. Try different browser
4. Restart computer
5. Check antivirus/firewall settings

## Contact Information
If issues persist, check:
- Flask-SocketIO documentation: https://flask-socketio.readthedocs.io/
- Socket.IO client documentation: https://socket.io/docs/v4/client-api/

## Quick Fix Script
Run this to ensure everything is installed:
```bash
pip install --upgrade flask flask-socketio python-socketio
python app.py
```

Then open two browsers and test!
