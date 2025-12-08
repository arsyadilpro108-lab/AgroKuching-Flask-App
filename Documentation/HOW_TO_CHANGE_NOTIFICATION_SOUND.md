# 🔊 How to Change the Notification Sound

## Quick Guide

### Method 1: Use Your Own Sound File (Recommended)

1. **Get a sound file** (MP3, WAV, or OGG format)
   - Download from the internet
   - Record your own
   - Use a sound from your computer

2. **Place the file in the `sounds` folder**
   ```
   sounds/
   └── notification.mp3  ← Your sound file here
   ```

3. **Update the path in `messages.js`** (already done!)
   ```javascript
   const audio = new Audio('/sounds/notification.mp3');
   ```

4. **Adjust the volume** (optional)
   ```javascript
   audio.volume = 0.5; // 0.0 (silent) to 1.0 (full volume)
   ```

5. **Refresh your browser** - Done!

---

## Method 2: Use Different Sound Files for Different Events

You can have different sounds for different types of notifications:

### In `messages.js`, update the function:

```javascript
// Play notification sound
function playNotificationSound(type = 'message') {
    try {
        let soundFile;
        
        switch(type) {
            case 'message':
                soundFile = '/sounds/message.mp3';
                break;
            case 'typing':
                soundFile = '/sounds/typing.mp3';
                break;
            case 'sent':
                soundFile = '/sounds/sent.mp3';
                break;
            default:
                soundFile = '/sounds/notification.mp3';
        }
        
        const audio = new Audio(soundFile);
        audio.volume = 0.5;
        audio.play().catch(e => console.log('Could not play sound:', e));
    } catch (e) {
        console.log('Notification sound error:', e);
    }
}
```

Then call it with different types:
```javascript
playNotificationSound('message');  // For new messages
playNotificationSound('sent');     // For sent messages
playNotificationSound('typing');   // For typing indicator
```

---

## Method 3: Disable the Sound

To turn off notification sounds completely:

### Option A: Comment out the function call
In `messages.js`, find and comment out:
```javascript
// playNotificationSound();
```

### Option B: Set volume to 0
```javascript
audio.volume = 0; // Muted
```

### Option C: Add a toggle button
Add this to your HTML and JavaScript to let users control it.

---

## 🎵 Where to Find Free Notification Sounds

### Recommended Websites:
1. **Zapsplat** - https://www.zapsplat.com/
   - Free sound effects
   - No attribution required

2. **Freesound** - https://freesound.org/
   - Large library
   - Creative Commons licensed

3. **Notification Sounds** - https://notificationsounds.com/
   - Specifically for notifications
   - Free downloads

4. **Mixkit** - https://mixkit.co/free-sound-effects/
   - High quality
   - Free for commercial use

### Popular Notification Sound Types:
- 🔔 Bell sounds
- 📱 Phone notification sounds
- 💬 Message pop sounds
- ✨ Subtle beeps
- 🎵 Musical notes

---

## 📝 Supported Audio Formats

| Format | Extension | Browser Support | Recommended |
|--------|-----------|-----------------|-------------|
| MP3    | .mp3      | ✅ All browsers | ⭐ Best     |
| WAV    | .wav      | ✅ All browsers | Large files |
| OGG    | .ogg      | ✅ Most browsers| Good        |
| M4A    | .m4a      | ⚠️ Some browsers| Not recommended |

**Recommendation:** Use MP3 for best compatibility and file size.

---

## 🎚️ Volume Guidelines

```javascript
audio.volume = 0.1;  // Very quiet (10%)
audio.volume = 0.3;  // Quiet (30%)
audio.volume = 0.5;  // Medium (50%) ← Default
audio.volume = 0.7;  // Loud (70%)
audio.volume = 1.0;  // Maximum (100%)
```

**Tip:** Start with 0.5 and adjust based on your preference.

---

## 🔧 Troubleshooting

### Sound not playing?

1. **Check file path**
   - Make sure the file is in the `sounds` folder
   - Check the filename matches exactly (case-sensitive)

2. **Check browser console**
   - Press F12
   - Look for errors in the Console tab

3. **Check file format**
   - Use MP3 for best compatibility
   - Make sure the file isn't corrupted

4. **Check browser permissions**
   - Some browsers block autoplay
   - User must interact with page first

5. **Check volume**
   - Make sure volume isn't set to 0
   - Check system volume

### Sound is too loud/quiet?

Adjust the volume in `messages.js`:
```javascript
audio.volume = 0.3; // Change this value
```

### Want different sounds for different users?

You can customize based on the sender:
```javascript
function playNotificationSound(username) {
    let soundFile = '/sounds/notification.mp3';
    
    // Custom sounds for specific users
    if (username === 'john') {
        soundFile = '/sounds/john.mp3';
    } else if (username === 'jane') {
        soundFile = '/sounds/jane.mp3';
    }
    
    const audio = new Audio(soundFile);
    audio.volume = 0.5;
    audio.play().catch(e => console.log('Could not play sound:', e));
}
```

---

## 📱 Mobile Considerations

On mobile devices:
- Sounds may not play until user interacts with the page
- Volume may be controlled by system settings
- Some browsers restrict autoplay

**Solution:** The first time a user opens the chat, they should tap/click something to enable sounds.

---

## 🎨 Advanced: Create Your Own Sound

### Using Audacity (Free):
1. Download Audacity: https://www.audacityteam.org/
2. Record or import a sound
3. Trim to 0.5-2 seconds
4. Export as MP3
5. Place in `sounds` folder

### Quick Tips:
- Keep it short (0.5-2 seconds)
- Not too loud or jarring
- Test on different devices
- Consider accessibility (some users may be sensitive to sounds)

---

## 🔄 Quick Reference

### Current Setup:
```
File: messages.js
Line: ~694
Function: playNotificationSound()
Sound: /sounds/notification.mp3
Volume: 0.5 (50%)
```

### To Change:
1. Replace `sounds/notification.mp3` with your sound file
2. Or update the path in `messages.js`
3. Refresh browser

---

## ✅ Checklist

- [ ] Sound file is in MP3 format
- [ ] File is placed in `sounds` folder
- [ ] Path in `messages.js` matches filename
- [ ] Volume is set appropriately (0.3-0.7)
- [ ] Browser is refreshed
- [ ] Sound plays when receiving a message

---

**Need help?** Check the browser console (F12) for error messages!
