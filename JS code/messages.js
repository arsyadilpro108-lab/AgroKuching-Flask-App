// Authentication
const TOKEN_KEY = 'authToken';

function getToken() {
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
}

function removeToken() {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
}

if (!getToken()) {
    window.location.replace('/HTML code/log-in.html');
}

// Initialize SocketIO - use current host
console.log('🔌 Initializing SocketIO connection...');
const socket = io({
    transports: ['polling', 'websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
    upgrade: true
});

console.log('Socket object created:', socket);

socket.on('connect', () => {
    console.log('✅ SocketIO connected!', socket.id);
    updateConnectionStatus(true);
    
    // Rejoin room if we were disconnected
    if (currentUser) {
        socket.emit('join', { user_id: currentUser.id });
    }
});

socket.on('disconnect', () => {
    console.log('❌ SocketIO disconnected');
    updateConnectionStatus(false);
});

socket.on('connect_error', (error) => {
    console.error('❌ SocketIO connection error:', error);
    updateConnectionStatus(false);
});

// Update connection status indicator
function updateConnectionStatus(isConnected) {
    const statusIndicator = document.getElementById('connectionStatus');
    if (statusIndicator) {
        if (isConnected) {
            statusIndicator.textContent = '';
            statusIndicator.style.display = 'none';
        } else {
            statusIndicator.textContent = 'Connecting...';
            statusIndicator.style.display = 'block';
        }
    }
}

let currentUser = null;
let currentChatUser = null;
let conversations = [];

// Fetch with auth
async function fetchWithAuth(url, options = {}) {
    const token = getToken();
    const headers = new Headers(options.headers || {});
    if (token) {
        headers.append('Authorization', `Bearer ${token}`);
    }
    if (options.body && typeof options.body === 'string') {
        headers.append('Content-Type', 'application/json');
    }

    const response = await fetch(url, { ...options, headers });

    if (response.status === 401) {
        removeToken();
        alert('Your session has expired. Please log in again.');
        window.location.href = '/HTML code/log-in.html';
        throw new Error('Unauthorized');
    }

    return response.json();
}

// Load current user and join their room
async function init() {
    try {
        currentUser = await fetchWithAuth('/api/profile');
        console.log('Current user loaded:', currentUser);
        
        // Join user's room for receiving messages
        socket.emit('join', { user_id: currentUser.id });
        console.log('Joined room: user_' + currentUser.id);
        
        // Request notification permission
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
        
        // Load conversations
        await loadConversations();
        
        // Check if there's a user parameter in URL
        const urlParams = new URLSearchParams(window.location.search);
        const username = urlParams.get('user');
        if (username) {
            openChat(username);
        } else if (isMobile()) {
            // On mobile, ensure sidebar is visible by default
            document.querySelector('.conversations-sidebar')?.classList.remove('hide-mobile');
            document.querySelector('.chat-area')?.classList.remove('show-mobile');
        }
    } catch (error) {
        console.error('Failed to initialize:', error);
    }
}

// Show browser notification
function showNotification(title, body, icon) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
            body: body,
            icon: icon || '/pictures/Start__1_-removebg-preview-modified.png',
            badge: '/pictures/Start__1_-removebg-preview-modified.png'
        });
    }
}

// Load conversations list
async function loadConversations() {
    try {
        conversations = await fetchWithAuth('/api/conversations');
        
        const conversationsList = document.getElementById('conversationsList');
        conversationsList.innerHTML = '';
        
        if (conversations.length === 0) {
            conversationsList.innerHTML = '<p class="loading">No conversations yet</p>';
            return;
        }
        
        // Calculate total unread count
        const totalUnread = conversations.reduce((sum, conv) => sum + (conv.unread_count || 0), 0);
        
        // Update page title with unread count
        if (totalUnread > 0) {
            document.title = `(${totalUnread}) Messages - AgroKuching`;
        } else {
            document.title = 'Messages - AgroKuching';
        }
        
        conversations.forEach(conv => {
            const item = document.createElement('div');
            item.className = 'conversation-item';
            item.dataset.username = conv.username;
            
            // Highlight if this conversation is active
            if (currentChatUser === conv.username) {
                item.classList.add('active');
            }
            
            const img = document.createElement('img');
            const convPic = conv.profile_pic;
            img.src = (convPic && convPic !== 'null' && convPic !== '') ? convPic : '/pictures/Default PFP.png';
            img.alt = conv.username;
            img.onerror = function() {
                this.src = '/pictures/Default PFP.png';
            };
            img.onclick = (e) => {
                e.stopPropagation();
                window.location.href = `/HTML code/profile.html?user=${conv.username}`;
            };
            
            const conversationInfo = document.createElement('div');
            conversationInfo.className = 'conversation-info';
            
            const conversationName = document.createElement('div');
            conversationName.className = 'conversation-name';
            conversationName.textContent = conv.username;
            conversationName.onclick = (e) => {
                e.stopPropagation();
                window.location.href = `/HTML code/profile.html?user=${conv.username}`;
            };
            conversationName.style.cursor = 'pointer';
            
            const conversationLastMessage = document.createElement('div');
            conversationLastMessage.className = 'conversation-last-message';
            conversationLastMessage.dataset.username = conv.username; // For updating typing status
            conversationLastMessage.textContent = conv.last_message || 'No messages yet';
            
            conversationInfo.appendChild(conversationName);
            conversationInfo.appendChild(conversationLastMessage);
            
            item.appendChild(img);
            item.appendChild(conversationInfo);
            
            if (conv.unread_count > 0) {
                const unreadBadge = document.createElement('div');
                unreadBadge.className = 'conversation-unread';
                unreadBadge.textContent = conv.unread_count;
                item.appendChild(unreadBadge);
            }
            
            item.addEventListener('click', () => openChat(conv.username));
            conversationsList.appendChild(item);
        });
    } catch (error) {
        console.error('Failed to load conversations:', error);
    }
}

// Check if mobile
function isMobile() {
    return window.innerWidth <= 768;
}

// Open chat with a user - OPTIMIZED FOR INSTANT RESPONSE
async function openChat(username) {
    currentChatUser = username;
    
    // INSTANT UI UPDATES - Do all synchronous updates first
    const chatHeader = document.getElementById('chatHeader');
    const chatUsername = document.getElementById('chatUsername');
    const chatUserPic = document.getElementById('chatUserPic');
    const messageInputArea = document.getElementById('messageInputArea');
    
    // Update active conversation
    document.querySelectorAll('.conversation-item').forEach(item => {
        item.classList.toggle('active', item.dataset.username === username);
    });
    
    // Show chat UI immediately
    chatHeader.style.display = 'flex';
    chatUsername.textContent = username;
    messageInputArea.style.display = 'flex';
    
    // Get user profile pic from conversations
    const conversation = conversations.find(c => c.username === username);
    if (conversation) {
        const convPic = conversation.profile_pic;
        const picUrl = (convPic && convPic !== 'null' && convPic !== '') ? convPic : '/pictures/Default PFP.png';
        
        chatUserPic.src = picUrl;
        chatUserPic.onerror = function() { this.src = '/pictures/Default PFP.png'; };
        
        // Also set typing indicator profile pic
        const typingPic = document.getElementById('typingUserPic');
        if (typingPic) {
            typingPic.src = picUrl;
            typingPic.onerror = function() { this.src = '/pictures/Default PFP.png'; };
        }
    }
    
    // Make username and pic clickable to go to profile
    chatUsername.onclick = () => window.location.href = `/HTML code/profile.html?user=${username}`;
    chatUserPic.onclick = () => window.location.href = `/HTML code/profile.html?user=${username}`;
    
    // Mobile: Hide sidebar and show chat
    if (isMobile()) {
        document.querySelector('.conversations-sidebar').classList.add('hide-mobile');
        document.querySelector('.chat-area').classList.add('show-mobile');
    }
    
    // Clear unread badge immediately
    const conversationItem = document.querySelector(`.conversation-item[data-username="${username}"]`);
    if (conversationItem) {
        const unreadBadge = conversationItem.querySelector('.conversation-unread');
        if (unreadBadge) {
            unreadBadge.remove();
        }
    }
    
    // Load messages (INSTANT if cached)
    loadMessages(username);
    
    // Background tasks (non-blocking)
    checkUserOnlineStatus(username);
    loadConversations().catch(err => console.error('Failed to reload conversations:', err));
}

// Go back to conversations (mobile)
function goBackToConversations() {
    if (isMobile()) {
        document.querySelector('.conversations-sidebar').classList.remove('hide-mobile');
        document.querySelector('.chat-area').classList.remove('show-mobile');
        currentChatUser = null;
        
        // Hide chat header
        document.getElementById('chatHeader').style.display = 'none';
        document.getElementById('messageInputArea').style.display = 'none';
    }
}

// Message cache for instant loading
const messageCache = new Map();
const messageCacheTimestamp = new Map();
const CACHE_DURATION = 30000; // 30 seconds

// Load messages with a user - OPTIMIZED FOR ZERO DELAY
async function loadMessages(username) {
    try {
        const messagesArea = document.getElementById('messagesArea');
        const hadCache = messageCache.has(username);
        const cacheTime = messageCacheTimestamp.get(username);
        const cacheAge = cacheTime ? Date.now() - cacheTime : Infinity;
        const isCacheFresh = cacheAge < CACHE_DURATION;
        
        // INSTANT DISPLAY: Show cached messages immediately (if available)
        if (hadCache) {
            console.log('⚡ INSTANT: Loading from cache');
            const cachedMessages = messageCache.get(username);
            
            // Clear and render in one go
            messagesArea.innerHTML = '';
            const fragment = document.createDocumentFragment();
            cachedMessages.forEach(msg => {
                const messageElement = createMessageElement(msg, false);
                if (messageElement) fragment.appendChild(messageElement);
            });
            messagesArea.appendChild(fragment);
            
            // Instant scroll
            messagesArea.scrollTop = messagesArea.scrollHeight;
            
            // If cache is fresh, skip API call entirely
            if (isCacheFresh) {
                console.log('✅ Cache is fresh, skipping API call');
                return;
            }
        }
        
        // Fetch fresh messages (only if no cache or cache is stale)
        const messages = await fetchWithAuth(`/api/messages/${username}`);
        
        // Update cache
        messageCache.set(username, messages);
        messageCacheTimestamp.set(username, Date.now());
        
        // Only re-render if we didn't show cache OR messages changed
        if (!hadCache) {
            console.log('🔄 First load, rendering messages');
            messagesArea.innerHTML = '';
            const fragment = document.createDocumentFragment();
            messages.forEach(msg => {
                const messageElement = createMessageElement(msg, false);
                if (messageElement) fragment.appendChild(messageElement);
            });
            messagesArea.appendChild(fragment);
            messagesArea.scrollTop = messagesArea.scrollHeight;
        } else {
            // Check if messages actually changed
            const cachedMessages = messageCache.get(username);
            const lastCachedId = cachedMessages[cachedMessages.length - 1]?.id;
            const lastNewId = messages[messages.length - 1]?.id;
            
            if (lastCachedId !== lastNewId || messages.length !== cachedMessages.length) {
                console.log('🔄 Messages changed, updating display');
                messagesArea.innerHTML = '';
                const fragment = document.createDocumentFragment();
                messages.forEach(msg => {
                    const messageElement = createMessageElement(msg, false);
                    if (messageElement) fragment.appendChild(messageElement);
                });
                messagesArea.appendChild(fragment);
                messagesArea.scrollTop = messagesArea.scrollHeight;
            }
        }
        
        // Update typing indicator profile pic
        if (messages.length > 0) {
            const otherUserMsg = messages.find(m => m.sender_username === username);
            if (otherUserMsg && otherUserMsg.sender_profile_pic) {
                const typingPic = document.getElementById('typingUserPic');
                if (typingPic) {
                    typingPic.src = otherUserMsg.sender_profile_pic;
                    typingPic.onerror = function() {
                        this.src = '/pictures/Default PFP.png';
                    };
                }
            }
        }
    } catch (error) {
        console.error('Failed to load messages:', error);
        const messagesArea = document.getElementById('messagesArea');
        messagesArea.innerHTML = '<div class="loading-messages" style="color: red;">Failed to load messages</div>';
    }
}

let replyingTo = null;

// Create message element (optimized for batch rendering)
function createMessageElement(msg, animate = false) {
    if (!currentUser) {
        console.error('currentUser not loaded yet');
        return null;
    }
    
    const isSent = msg.sender_id === currentUser.id || msg.sender_username === currentUser.username;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;
    messageDiv.dataset.messageId = msg.id;
    
    let time = 'Now';
    try {
        if (msg.sent_date) {
            const date = new Date(msg.sent_date);
            if (!isNaN(date.getTime())) {
                time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
        }
    } catch (e) {
        console.error('Error parsing date:', msg.sent_date, e);
    }
    
    // Reply preview
    let replyHTML = '';
    if (msg.reply_to && msg.reply_message) {
        replyHTML = `
            <div class="reply-preview">
                <div class="reply-line"></div>
                <div class="reply-content">
                    <div class="reply-sender">${escapeHtml(msg.reply_sender_username || 'User')}</div>
                    <div class="reply-text">${escapeHtml(msg.reply_message)}</div>
                </div>
            </div>
        `;
    }
    
    const avatarImg = document.createElement('img');
    const profilePic = msg.sender_profile_pic;
    avatarImg.src = (profilePic && profilePic !== 'null' && profilePic !== '') ? profilePic : '/pictures/Default PFP.png';
    avatarImg.alt = msg.sender_username;
    avatarImg.className = 'message-avatar';
    avatarImg.style.cursor = 'pointer';
    avatarImg.onclick = () => window.location.href = `/HTML code/profile.html?user=${msg.sender_username}`;
    avatarImg.onerror = function() {
        this.src = '/pictures/Default PFP.png';
    };
    
    // Message status indicator
    let statusIcon = '';
    if (isSent) {
        if (msg.is_read) {
            statusIcon = '<span class="message-status read">✓✓</span>';
        } else {
            statusIcon = '<span class="message-status delivered">✓✓</span>';
        }
    }
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.innerHTML = `
        ${replyHTML}
        <div class="message-text">${escapeHtml(msg.message)}</div>
        <div class="message-time">${time} ${statusIcon}</div>
    `;
    
    const messageActions = document.createElement('div');
    messageActions.className = 'message-actions';
    
    if (isSent) {
        const editBtn = document.createElement('button');
        editBtn.className = 'message-action-btn edit-btn';
        editBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>';
        editBtn.title = 'Edit';
        editBtn.onclick = () => editMessage(msg.id, msg.message);
        messageActions.appendChild(editBtn);
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'message-action-btn delete-btn';
        deleteBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
        deleteBtn.title = 'Delete';
        deleteBtn.onclick = () => deleteMessage(msg.id);
        messageActions.appendChild(deleteBtn);
    } else {
        const replyBtn = document.createElement('button');
        replyBtn.className = 'message-action-btn reply-btn';
        replyBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 14 4 9 9 4"></polyline><path d="M20 20v-7a4 4 0 0 0-4-4H4"></path></svg>';
        replyBtn.title = 'Reply';
        replyBtn.onclick = () => replyToMessage(msg.id, msg.message, msg.sender_username);
        messageActions.appendChild(replyBtn);
    }
    
    // Only show avatar for received messages (WhatsApp style)
    if (!isSent) {
        messageDiv.appendChild(avatarImg);
    }
    messageDiv.appendChild(messageContent);
    messageDiv.appendChild(messageActions);
    
    // Only animate if specified (for new messages, not initial load)
    if (animate) {
        messageDiv.style.opacity = '0';
        messageDiv.style.transform = 'translateY(10px)';
        requestAnimationFrame(() => {
            messageDiv.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
            messageDiv.style.opacity = '1';
            messageDiv.style.transform = 'translateY(0)';
        });
    }
    
    return messageDiv;
}

// Append message to chat (wrapper for backward compatibility)
function appendMessage(msg, animate = true) {
    const messagesArea = document.getElementById('messagesArea');
    const messageElement = createMessageElement(msg, animate);
    if (messageElement) {
        messagesArea.appendChild(messageElement);
    }
}

// Reply to message
function replyToMessage(messageId, messageText, senderUsername) {
    replyingTo = messageId;
    const replyIndicator = document.getElementById('replyIndicator');
    replyIndicator.style.display = 'flex';
    replyIndicator.innerHTML = `
        <div class="reply-info">
            <div class="reply-to-label">Replying to ${senderUsername}</div>
            <div class="reply-to-text">${messageText}</div>
        </div>
        <button class="cancel-reply-btn" onclick="cancelReply()">✕</button>
    `;
    document.getElementById('messageInput').focus();
}

// Cancel reply
function cancelReply() {
    replyingTo = null;
    document.getElementById('replyIndicator').style.display = 'none';
}

// Edit message
let editingMessageId = null;

function editMessage(messageId, currentText) {
    editingMessageId = messageId;
    const input = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    
    // Set input value to current message
    input.value = currentText;
    input.focus();
    
    // Change send button to "Update"
    sendBtn.textContent = 'Update';
    sendBtn.style.background = '#ff9800';
    
    // Show edit indicator
    const replyIndicator = document.getElementById('replyIndicator');
    replyIndicator.style.display = 'flex';
    replyIndicator.innerHTML = `
        <div class="reply-info">
            <div class="reply-to-label">Editing message</div>
            <div class="reply-to-text">${escapeHtml(currentText)}</div>
        </div>
        <button class="cancel-reply-btn" onclick="cancelEdit()">✕</button>
    `;
}

function cancelEdit() {
    editingMessageId = null;
    const input = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const replyIndicator = document.getElementById('replyIndicator');
    
    input.value = '';
    sendBtn.textContent = 'Send';
    sendBtn.style.background = '';
    replyIndicator.style.display = 'none';
}

// Delete message
async function deleteMessage(messageId) {
    if (!confirm('Delete this message?')) return;
    
    try {
        await fetchWithAuth(`/api/messages/${messageId}`, {
            method: 'DELETE'
        });
        
        // Remove message from UI
        const messageDiv = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageDiv) {
            messageDiv.remove();
        }
    } catch (error) {
        console.error('Failed to delete message:', error);
        alert('Failed to delete message');
    }
}

// Send message
async function sendMessage() {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();
    
    console.log('📤 sendMessage called:', { message, currentChatUser, currentUser, editingMessageId });
    
    if (!message || !currentChatUser) {
        console.log('❌ Message empty or no chat user selected');
        return;
    }
    
    // Check if we're editing a message
    if (editingMessageId) {
        await updateMessage(editingMessageId, message);
        return;
    }
    
    // Clear input immediately for better UX
    input.value = '';
    
    // Stop typing indicator
    if (typingTimeout) {
        clearTimeout(typingTimeout);
    }
    if (isCurrentlyTyping) {
        const conversation = conversations.find(c => c.username === currentChatUser);
        if (conversation) {
            socket.emit('typing', {
                receiver_id: conversation.other_user_id,
                sender_username: currentUser.username,
                is_typing: false
            });
        }
        isCurrentlyTyping = false;
    }
    
    try {
        console.log('📡 Sending message to API...');
        const result = await fetchWithAuth(`/api/messages/${currentChatUser}`, {
            method: 'POST',
            body: JSON.stringify({ 
                message,
                reply_to: replyingTo
            })
        });
        
        console.log('✅ Message sent successfully:', result);
        
        // Append message locally with sending status
        const tempMsg = {
            id: result.id,
            sender_id: currentUser.id,
            sender_username: currentUser.username,
            sender_profile_pic: currentUser.profile_pic,
            message: message,
            sent_date: result.sent_date,
            is_read: 0,
            status: 'sent',
            reply_to: replyingTo,
            reply_message: replyingTo ? document.querySelector(`[data-message-id="${replyingTo}"] .message-text`)?.textContent : null,
            reply_sender_username: replyingTo ? document.querySelector(`[data-message-id="${replyingTo}"]`)?.classList.contains('sent') ? currentUser.username : currentChatUser : null
        };
        
        console.log('📝 Appending message to UI:', tempMsg);
        appendMessage(tempMsg);
        
        // Update cache with new message
        if (messageCache.has(currentChatUser)) {
            const cachedMessages = messageCache.get(currentChatUser);
            cachedMessages.push(tempMsg);
            messageCache.set(currentChatUser, cachedMessages);
            messageCacheTimestamp.set(currentChatUser, Date.now());
        }
        
        // Clear reply
        cancelReply();
        
        // Scroll to bottom
        const messagesArea = document.getElementById('messagesArea');
        messagesArea.scrollTop = messagesArea.scrollHeight;
        
        // Reload conversations to update last message (without sound)
        await loadConversations();
    } catch (error) {
        console.error('❌ Failed to send message:', error);
        alert('Failed to send message');
        // Restore message to input on error
        input.value = message;
    }
}

// Update message (edit)
async function updateMessage(messageId, newText) {
    const input = document.getElementById('messageInput');
    
    try {
        console.log('📝 Updating message:', messageId, newText);
        
        await fetchWithAuth(`/api/messages/${messageId}`, {
            method: 'PUT',
            body: JSON.stringify({ message: newText })
        });
        
        console.log('✅ Message updated successfully');
        
        // Update message in UI
        const messageDiv = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageDiv) {
            const messageText = messageDiv.querySelector('.message-text');
            if (messageText) {
                messageText.textContent = newText;
                
                // Add edited indicator
                let editedLabel = messageDiv.querySelector('.edited-label');
                if (!editedLabel) {
                    editedLabel = document.createElement('span');
                    editedLabel.className = 'edited-label';
                    editedLabel.textContent = '(edited)';
                    const messageTime = messageDiv.querySelector('.message-time');
                    if (messageTime) {
                        messageTime.insertBefore(editedLabel, messageTime.firstChild);
                    }
                }
            }
        }
        
        // Clear edit mode
        cancelEdit();
        
    } catch (error) {
        console.error('❌ Failed to update message:', error);
        alert('Failed to update message');
        // Restore message to input on error
        input.value = newText;
    }
}

// Listen for new messages via SocketIO
socket.on('new_message', (msg) => {
    console.log('🔔 New message received via SocketIO:', msg);
    
    // Don't process messages we sent ourselves
    if (msg.sender_id === currentUser.id) {
        console.log('Ignoring our own message from SocketIO');
        return;
    }
    
    // Update cache for this conversation
    const senderUsername = msg.sender_username;
    if (messageCache.has(senderUsername)) {
        const cachedMessages = messageCache.get(senderUsername);
        cachedMessages.push(msg);
        messageCache.set(senderUsername, cachedMessages);
        messageCacheTimestamp.set(senderUsername, Date.now());
    }
    
    // If the message is from the current chat user, append it
    if (currentChatUser && msg.sender_username === currentChatUser) {
        console.log('Message is from current chat user, appending...');
        
        // Check if message already exists (avoid duplicates)
        const existingMsg = document.querySelector(`[data-message-id="${msg.id}"]`);
        if (!existingMsg) {
            appendMessage(msg);
            
            // Scroll to bottom
            const messagesArea = document.getElementById('messagesArea');
            messagesArea.scrollTop = messagesArea.scrollHeight;
            
            // Mark as read immediately
            fetchWithAuth(`/api/messages/${currentChatUser}`);
            
            // NO SOUND when actively in chat with this person
            // (Messages are already visible, no need for notification)
        }
    } else {
        console.log('Message is from different user or no chat open');
        
        // Show notification for new message
        showNotification(
            `New message from ${msg.sender_username}`,
            msg.message,
            msg.sender_profile_pic
        );
        
        // Play notification sound
        playNotificationSound();
    }
    
    // Always reload conversations to show new message and update unread count
    loadConversations();
});

// Play notification sound
function playNotificationSound() {
    try {
        // Option 1: Use a custom sound file (recommended)
        // Place your sound file in the 'sounds' folder and update the path below
        const audio = new Audio('/sounds/notification.mp3');
        
        // Option 2: Use a different built-in sound (uncomment to use)
        // const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGGS57OihUBELTKXh8bllHAU2jdXvzn0vBSh+zPDajzsKElyx6OyrWBUIQ5zd8sFuJAUuhM/z24k2Bxdju+zooVARC0yl4fG5ZRwFNo3V7859LwUofsz');
        
        audio.volume = 0.5; // Adjust volume (0.0 to 1.0)
        audio.play().catch(e => console.log('Could not play sound:', e));
    } catch (e) {
        console.log('Notification sound error:', e);
    }
}

// Listen for message deletions
socket.on('message_deleted', (data) => {
    console.log('🗑️ Message deleted:', data.message_id);
    const messageDiv = document.querySelector(`[data-message-id="${data.message_id}"]`);
    if (messageDiv) {
        messageDiv.remove();
    }
});

// Listen for message edits
socket.on('message_edited', (data) => {
    console.log('✏️ Message edited:', data);
    const messageDiv = document.querySelector(`[data-message-id="${data.message_id}"]`);
    if (messageDiv) {
        const messageText = messageDiv.querySelector('.message-text');
        if (messageText) {
            messageText.textContent = data.new_message;
            
            // Add edited indicator
            let editedLabel = messageDiv.querySelector('.edited-label');
            if (!editedLabel) {
                editedLabel = document.createElement('span');
                editedLabel.className = 'edited-label';
                editedLabel.textContent = '(edited)';
                const messageTime = messageDiv.querySelector('.message-time');
                if (messageTime) {
                    messageTime.insertBefore(editedLabel, messageTime.firstChild);
                }
            }
        }
    }
});

// Listen for message read status
socket.on('messages_read', (data) => {
    console.log('👁️ Messages marked as read by:', data.username);
    
    // Update all sent messages to this user as read
    if (currentChatUser === data.username) {
        document.querySelectorAll('.message.sent .message-status.delivered').forEach(status => {
            status.classList.remove('delivered');
            status.classList.add('read');
        });
    }
});

// Listen for typing indicator
socket.on('user_typing', (data) => {
    console.log('⌨️ User typing:', data);
    
    // Update conversation list (left sidebar) - WhatsApp style
    const conversationLastMessage = document.querySelector(`.conversation-last-message[data-username="${data.username}"]`);
    if (conversationLastMessage) {
        if (data.is_typing) {
            // Store original message
            if (!conversationLastMessage.dataset.originalMessage) {
                conversationLastMessage.dataset.originalMessage = conversationLastMessage.textContent;
            }
            // Show "typing..."
            conversationLastMessage.textContent = 'typing...';
            conversationLastMessage.style.color = '#007bff';
            conversationLastMessage.style.fontStyle = 'italic';
        } else {
            // Restore original message
            if (conversationLastMessage.dataset.originalMessage) {
                conversationLastMessage.textContent = conversationLastMessage.dataset.originalMessage;
                delete conversationLastMessage.dataset.originalMessage;
            }
            conversationLastMessage.style.color = '';
            conversationLastMessage.style.fontStyle = '';
        }
    }
    
    // Update chat area if this is the current chat
    if (currentChatUser && data.username === currentChatUser) {
        const typingIndicator = document.getElementById('typingIndicator');
        const typingStatus = document.getElementById('chatTypingStatus');
        
        if (data.is_typing) {
            // Show typing indicator in messages area
            typingIndicator.style.display = 'flex';
            
            // Show "typing..." in header
            if (typingStatus) {
                typingStatus.style.display = 'block';
            }
            
            // Scroll to bottom
            const messagesArea = document.getElementById('messagesArea');
            messagesArea.scrollTop = messagesArea.scrollHeight;
        } else {
            // Hide typing indicator
            typingIndicator.style.display = 'none';
            
            // Hide "typing..." in header
            if (typingStatus) {
                typingStatus.style.display = 'none';
            }
        }
    }
});

// Typing indicator
let typingTimeout = null;
let isCurrentlyTyping = false;

function handleTyping() {
    if (!currentChatUser || !currentUser) return;
    
    const input = document.getElementById('messageInput');
    const hasText = input && input.value.trim().length > 0;
    
    // Get receiver user ID
    const conversation = conversations.find(c => c.username === currentChatUser);
    if (!conversation) return;
    
    // Only show typing if there's text in the input
    if (hasText) {
        // Emit typing event
        if (!isCurrentlyTyping) {
            isCurrentlyTyping = true;
            socket.emit('typing', {
                receiver_id: conversation.other_user_id,
                sender_username: currentUser.username,
                is_typing: true
            });
        }
        
        // Clear previous timeout
        if (typingTimeout) {
            clearTimeout(typingTimeout);
        }
        
        // Stop typing after 2 seconds of inactivity
        typingTimeout = setTimeout(() => {
            isCurrentlyTyping = false;
            socket.emit('typing', {
                receiver_id: conversation.other_user_id,
                sender_username: currentUser.username,
                is_typing: false
            });
        }, 2000);
    } else {
        // No text, stop typing indicator immediately
        if (isCurrentlyTyping) {
            isCurrentlyTyping = false;
            socket.emit('typing', {
                receiver_id: conversation.other_user_id,
                sender_username: currentUser.username,
                is_typing: false
            });
        }
        if (typingTimeout) {
            clearTimeout(typingTimeout);
        }
    }
}

// Event listeners
document.getElementById('sendBtn').addEventListener('click', sendMessage);
const messageInput = document.getElementById('messageInput');

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
        // Stop typing indicator
        if (typingTimeout) {
            clearTimeout(typingTimeout);
        }
        if (isCurrentlyTyping) {
            const conversation = conversations.find(c => c.username === currentChatUser);
            if (conversation) {
                socket.emit('typing', {
                    receiver_id: conversation.other_user_id,
                    sender_username: currentUser.username,
                    is_typing: false
                });
            }
            isCurrentlyTyping = false;
        }
    }
});

messageInput.addEventListener('input', handleTyping);

// Utility function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Add back button click handler for mobile
document.getElementById('mobileBackBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    goBackToConversations();
});

// Handle window resize
window.addEventListener('resize', () => {
    if (!isMobile()) {
        // Reset mobile classes on desktop
        document.querySelector('.conversations-sidebar')?.classList.remove('hide-mobile');
        document.querySelector('.chat-area')?.classList.remove('show-mobile');
    }
});

// Check user online status
async function checkUserOnlineStatus(username) {
    try {
        const response = await fetch(`/api/user/${username}/online`);
        const data = await response.json();
        
        updateOnlineStatus(username, data.online);
    } catch (error) {
        console.error('Failed to check online status:', error);
    }
}

// Update online status display
function updateOnlineStatus(username, isOnline) {
    const chatHeader = document.getElementById('chatHeader');
    let statusIndicator = chatHeader.querySelector('.online-status');
    
    if (!statusIndicator) {
        statusIndicator = document.createElement('div');
        statusIndicator.className = 'online-status';
        chatHeader.appendChild(statusIndicator);
    }
    
    if (isOnline) {
        statusIndicator.textContent = 'Online';
        statusIndicator.classList.add('online');
        statusIndicator.classList.remove('offline');
    } else {
        statusIndicator.textContent = '';
        statusIndicator.classList.remove('online');
        statusIndicator.classList.add('offline');
    }
}

// Listen for user online/offline events
socket.on('user_online', (data) => {
    console.log('👤 User came online:', data.user_id);
    
    // Update status if this is the current chat user
    if (currentChatUser) {
        const conversation = conversations.find(c => c.username === currentChatUser);
        if (conversation && conversation.other_user_id === data.user_id) {
            updateOnlineStatus(currentChatUser, true);
        }
    }
    
    // Update conversation list
    loadConversations();
});

socket.on('user_offline', (data) => {
    console.log('👤 User went offline:', data.user_id);
    
    // Update status if this is the current chat user
    if (currentChatUser) {
        const conversation = conversations.find(c => c.username === currentChatUser);
        if (conversation && conversation.other_user_id === data.user_id) {
            updateOnlineStatus(currentChatUser, false);
        }
    }
    
    // Update conversation list
    loadConversations();
});

// Initialize
init();
