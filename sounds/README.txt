🔊 NOTIFICATION SOUNDS FOLDER

Place your notification sound files here!

SOUND FILES USED:
1. notification.mp3 - Chat messages & general notifications
2. follower.mp3 - New follower notifications (optional)

QUICK START:
1. Add your sound file to this folder
2. Name it: notification.mp3 (required)
3. Optionally add: follower.mp3 (for new followers)
4. Refresh your browser
5. Done!

SUPPORTED FORMATS:
✅ MP3 (recommended)
✅ WAV
✅ OGG

FILE SIZE:
- Keep it small (under 100KB)
- Short duration (0.5-2 seconds)

CURRENT SETUP:
- Chat messages: /sounds/notification.mp3
- New followers: /sounds/follower.mp3 (falls back to notification.mp3)

WHERE SOUNDS ARE USED:
✅ New chat messages (messages.js)
✅ New followers (home-page.js)
✅ General notifications (home-page.js)

TO CHANGE:
Edit JS code/messages.js or JS code/home-page.js:
const audio = new Audio('/sounds/YOUR_FILE.mp3');

VOLUME:
Adjust in the JS files:
audio.volume = 0.5; // 0.0 to 1.0

TEST YOUR SOUNDS:
Open: http://localhost:5000/HTML code/test_sounds.html

NEED HELP?
Read: HOW_TO_CHANGE_NOTIFICATION_SOUND.md
