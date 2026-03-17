// --- Global API Configuration ---
const API_BASE_URL = ''; // The server is on the same origin
const TOKEN_KEY = 'authToken';

// Global variables for search and posts
let isSearchMode = false;
let searchQuery = '';
let searchTimeout;
let currentUserRole = 'user';
let currentUserData = null;
let currentUsername = null;

// Helper to get token from either localStorage or sessionStorage
function getToken() {
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
}

// Helper to remove token from both storages
function removeToken() {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
}

// Play notification sound
function playNotificationSound(type = 'default') {
    try {
        // Use different sounds for different notification types
        let soundFile = '/sounds/notification.mp3';
        
        if (type === 'follower') {
            soundFile = '/sounds/follower.mp3'; // You can add a different sound for followers
        } else if (type === 'message') {
            soundFile = '/sounds/notification.mp3';
        }
        
        const audio = new Audio(soundFile);
        audio.volume = 0.5;
        audio.play().catch(e => {
            // Fallback to default sound if custom sound doesn't exist
            if (soundFile !== '/sounds/notification.mp3') {
                const fallback = new Audio('/sounds/notification.mp3');
                fallback.volume = 0.5;
                fallback.play().catch(err => console.log('Could not play sound:', err));
            }
        });
    } catch (e) {
        console.log('Notification sound error:', e);
    }
}

// Show browser notification
function showBrowserNotification(title, body, icon) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
            body: body,
            icon: icon || '/pictures/Start__1_-removebg-preview-modified.png',
            badge: '/pictures/Start__1_-removebg-preview-modified.png'
        });
    }
}

// Request notification permission on page load
if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
}

// --- Helper Functions ---

function openModal(modal) { modal.style.display = "flex"; }
function closeModal(modal) { modal.style.display = "none"; }

/**
 * A helper function to make authenticated API calls.
 * It automatically adds the JWT token to the request headers.
 */
async function fetchWithAuth(url, options = {}) {
    const token = getToken();
    
    // Prepare headers
    const headers = new Headers(options.headers || {});
    if (token) {
        headers.append('Authorization', `Bearer ${token}`);
    }
    if (options.body && !(options.body instanceof FormData)) {
        headers.append('Content-Type', 'application/json');
    }

    const response = await fetch(url, { ...options, headers });

    if (response.status === 401) {
        // Token is invalid or expired - only redirect if we're on a protected page
        const currentPage = window.location.pathname;
        if (currentPage.includes('home-page.html') || currentPage.includes('settings.html')) {
            removeToken();
            alert('Your session has expired. Please log in again.');
            window.location.href = '/HTML code/log-in.html';
        }
        throw new Error('Unauthorized');
    }
    
    const data = await response.json();
    
    if (!response.ok) {
        throw new Error(data.message || 'API request failed');
    }
    
    return data;
}

/**
 * Converts a file to a Base64 string.
 */
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

// --- Settings Page Logic ---
async function handleSettingsLogic() {
    const usernameInput = document.getElementById("usernameInput");
    const emailInput = document.getElementById("emailInput");
    const phoneInput = document.getElementById("phoneInput");
    const descriptionInput = document.getElementById("descriptionInput");
    const regDate = document.getElementById("regDate");
    const passwordInput = document.getElementById("passwordInput");
    const saveSettingsBtn = document.getElementById("saveSettings");
    const profilePicInput = document.getElementById("profilePicInput");
    const profilePreview = document.getElementById("profilePreview");
    const changePasswordLink = document.getElementById("changePasswordLink");
    const changePasswordModal = document.getElementById("changePasswordModal");

    if (!usernameInput) return;

    // Load current user data
    try {
        const data = await fetchWithAuth('/api/profile');
        usernameInput.value = data.username;
        emailInput.value = data.email;
        phoneInput.value = data.phone || '';
        descriptionInput.value = data.description || '';
        regDate.value = new Date(data.reg_date).toLocaleDateString();
        profilePreview.src = data.profile_pic || '/pictures/Default PFP.png';
    } catch (error) {
        console.error("Failed to load profile:", error);
    }

    // Change Password Modal
    changePasswordLink.addEventListener("click", (e) => {
        e.preventDefault();
        changePasswordModal.style.display = "flex";
    });

    document.getElementById("cancelChangePassword").addEventListener("click", () => {
        changePasswordModal.style.display = "none";
        document.getElementById("currentPasswordModal").value = "";
        document.getElementById("newPasswordModal").value = "";
    });

    // Password visibility toggles for modal
    document.getElementById("toggleCurrentPasswordModal").addEventListener("click", function() {
        const input = document.getElementById("currentPasswordModal");
        const svg = this.querySelector('svg');
        if (input.type === "password") {
            input.type = "text";
            svg.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
        } else {
            input.type = "password";
            svg.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
        }
    });

    document.getElementById("toggleNewPasswordModal").addEventListener("click", function() {
        const input = document.getElementById("newPasswordModal");
        const svg = this.querySelector('svg');
        if (input.type === "password") {
            input.type = "text";
            svg.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
        } else {
            input.type = "password";
            svg.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
        }
    });

    document.getElementById("confirmChangePassword").addEventListener("click", async () => {
        const currentPassword = document.getElementById("currentPasswordModal").value;
        const newPassword = document.getElementById("newPasswordModal").value;

        if (!currentPassword || !newPassword) {
            alert("Please fill in both fields");
            return;
        }

        if (newPassword.length < 6) {
            alert("New password must be at least 6 characters");
            return;
        }

        try {
            // First verify current password by trying to login
            const loginResponse = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: usernameInput.value,
                    password: currentPassword
                })
            });

            if (!loginResponse.ok) {
                alert("Current password is incorrect");
                return;
            }

            // Update password
            const result = await fetchWithAuth('/api/profile', {
                method: 'PUT',
                body: JSON.stringify({ password: newPassword })
            });

            alert("Password changed successfully!");
            changePasswordModal.style.display = "none";
            document.getElementById("currentPasswordModal").value = "";
            document.getElementById("newPasswordModal").value = "";
        } catch (error) {
            console.error("Failed to change password:", error);
            alert("Error changing password");
        }
    });

    // Profile Picture Preview
    profilePicInput.addEventListener("change", (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                profilePreview.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    // Save Settings
    saveSettingsBtn.addEventListener("click", async () => {
        let profilePicBase64 = null;
        
        if (profilePicInput.files && profilePicInput.files.length > 0) {
            try {
                profilePicBase64 = await fileToBase64(profilePicInput.files[0]);
            } catch (error) {
                console.error("Error converting image:", error);
                alert("Error reading image file.");
                return;
            }
        } else {
            if (profilePreview.src.startsWith('data:image')) {
                profilePicBase64 = profilePreview.src;
            } else {
                profilePicBase64 = profilePreview.src; 
            }
        }
        
        const updateData = {
            username: usernameInput.value,
            email: emailInput.value,
            phone: phoneInput.value,
            description: descriptionInput.value,
            profile_pic: profilePicBase64
        };

        try {
            const result = await fetchWithAuth('/api/profile', {
                method: 'PUT',
                body: JSON.stringify(updateData)
            });
            alert(result.message);
        } catch (error) {
            console.error("Failed to save settings:", error);
            alert(`Error: ${error.message}`);
        }
    });
}

// --- Home Page Logic ---
async function handleHomePageLogic() {
    console.log('=== handleHomePageLogic called ===');
    const postContainer = document.getElementById("postContainer");
    console.log('postContainer element:', postContainer);
    const postModal = document.getElementById("postModal");
    const closeModalBtn = document.getElementById("closeModal");
    const postForm = document.getElementById("postForm");
    const editModal = document.getElementById("editModal");
    const closeEditModalBtn = document.getElementById("closeEditModal");
    const editForm = document.getElementById("editForm");
    const imagePreview = document.getElementById("imagePreview");
    const postImagesInput = document.getElementById("postImages");
    const searchInput = document.getElementById("searchInput");
    const profileBtn = document.getElementById("profileBtn");
    const profileDropdown = document.getElementById("profileDropdown");
    const logoutLink = document.getElementById("logoutLink");
    const logoutModal = document.getElementById("logoutModal");
    const confirmLogout = document.getElementById("confirmLogout");
    const cancelLogout = document.getElementById("cancelLogout");
    const searchDropdown = document.getElementById("searchDropdown");
    const clearSearch = document.getElementById("clearSearch");
    const imageGallery = document.getElementById("imageGallery");
    const galleryImage = document.getElementById("galleryImage");
    const galleryPrev = document.getElementById("galleryPrev");
    const galleryNext = document.getElementById("galleryNext");
    const galleryCounter = document.getElementById("galleryCounter");
    const closeGallery = document.getElementById("closeGallery");

    if (!postContainer) return;

    // Gallery state
    let currentGalleryImages = [];
    let currentGalleryIndex = 0;

    // Load Header Profile Pic
    fetchWithAuth('/api/profile')
        .then(data => {
            if (!profileBtn) return;
            if (data.profile_picture && data.profile_picture !== 'null' && data.profile_picture !== '') {
                profileBtn.innerHTML = '';
                const img = document.createElement('img');
                img.src = data.profile_picture;
                img.style = "width: 100%; height: 100%; object-fit: cover;";
                img.onerror = function() { profileBtn.innerHTML = '👤'; };
                profileBtn.appendChild(img);
            } else {
                profileBtn.innerHTML = '👤';
            }
        })
        .catch(() => { if (profileBtn) profileBtn.innerHTML = '👤'; });

    // Check admin role independently — runs regardless of profile fetch result
    const token = getToken();
    if (token) {
        fetch('/api/admin/check', {
            headers: { 'Authorization': 'Bearer ' + token }
        })
        .then(r => r.json())
        .then(adminData => {
            if (adminData && adminData.is_admin) {
                const adminLink = document.getElementById('adminLink');
                if (adminLink) {
                    adminLink.style.display = 'block';
                    console.log('✅ Admin link shown on home page');
                }
            }
        })
        .catch(() => {});
    }

    // Modal/Dropdown Listeners
    // Facebook-style create post box
    const createPostBox = document.getElementById('createPostBox');
    
    if (createPostBox) {
        createPostBox.addEventListener('click', () => {
            window.location.href = '/HTML code/create-post.html';
        });
    }
    if (closeModalBtn) closeModalBtn.addEventListener("click", () => closeModal(postModal));
    if (closeEditModalBtn) closeEditModalBtn.addEventListener("click", () => closeModal(editModal));
    
    if (profileBtn && profileDropdown) {
        profileBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            profileDropdown.classList.toggle("show");
        });
    }
    
    window.addEventListener("click", (e) => {
        if (profileDropdown && !e.target.closest('.profile-menu')) {
            profileDropdown.classList.remove("show");
        }
        if (postModal && e.target === postModal) closeModal(postModal);
        if (editModal && e.target === editModal) closeModal(editModal);
        if (logoutModal && e.target === logoutModal) closeModal(logoutModal);
        if (imageGallery && e.target === imageGallery) closeModal(imageGallery);
        
        // Close post menus when clicking outside
        document.querySelectorAll('.post-menu-dropdown.show').forEach(menu => {
            menu.classList.remove('show');
        });
        
        // Close search dropdown when clicking outside
        if (searchDropdown && !e.target.closest('.search-container')) {
            searchDropdown.classList.remove('show');
        }
    });

    // Gallery controls
    if (closeGallery) closeGallery.addEventListener("click", () => closeModal(imageGallery));
    
    // Facebook-style Gallery zoom functionality
    let zoomLevel = 1;
    let isZoomed = false;
    let isDragging = false;
    let startX, startY, translateX = 0, translateY = 0;
    let initialPinchDistance = 0;
    let initialZoom = 1;
    let pinchCenterX = 0;
    let pinchCenterY = 0;
    let lastTouchTime = 0;
    let velocityX = 0;
    let velocityY = 0;
    let lastMoveTime = 0;
    let lastMoveX = 0;
    let lastMoveY = 0;

    function updateGallery() {
        galleryImage.src = currentGalleryImages[currentGalleryIndex];
        galleryCounter.textContent = `${currentGalleryIndex + 1} / ${currentGalleryImages.length}`;
        resetZoom();
    }

    function resetZoom() {
        zoomLevel = 1;
        isZoomed = false;
        translateX = 0;
        translateY = 0;
        galleryImage.style.transform = 'scale(1) translate(0, 0)';
        galleryImage.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        galleryImage.classList.remove('zoomed');
    }

    function openGallery(images, startIndex = 0) {
        currentGalleryImages = images;
        currentGalleryIndex = startIndex;
        updateGallery();
        openModal(imageGallery);
    }

    function getPinchDistance(touches) {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    function getPinchCenter(touches) {
        return {
            x: (touches[0].clientX + touches[1].clientX) / 2,
            y: (touches[0].clientY + touches[1].clientY) / 2
        };
    }

    function constrainPan() {
        const rect = galleryImage.getBoundingClientRect();
        const parent = galleryImage.parentElement.getBoundingClientRect();
        
        const scaledWidth = rect.width;
        const scaledHeight = rect.height;
        const parentWidth = parent.width;
        const parentHeight = parent.height;
        
        // Calculate max pan distances
        const maxX = Math.max(0, (scaledWidth - parentWidth) / 2 / zoomLevel);
        const maxY = Math.max(0, (scaledHeight - parentHeight) / 2 / zoomLevel);
        
        // Constrain translation
        translateX = Math.max(-maxX, Math.min(maxX, translateX));
        translateY = Math.max(-maxY, Math.min(maxY, translateY));
    }

    function applyTransform(transition = false) {
        if (transition) {
            galleryImage.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        } else {
            galleryImage.style.transition = 'none';
        }
        galleryImage.style.transform = `scale(${zoomLevel}) translate(${translateX}px, ${translateY}px)`;
    }

    // Double tap to zoom (Facebook style)
    let tapCount = 0;
    let tapTimer = null;
    
    galleryImage.addEventListener('touchend', (e) => {
        if (e.touches.length === 0 && !isDragging) {
            tapCount++;
            
            if (tapCount === 1) {
                tapTimer = setTimeout(() => {
                    tapCount = 0;
                }, 300);
            } else if (tapCount === 2) {
                clearTimeout(tapTimer);
                tapCount = 0;
                e.preventDefault();
                
                if (zoomLevel > 1) {
                    resetZoom();
                } else {
                    const rect = galleryImage.getBoundingClientRect();
                    const touch = e.changedTouches[0];
                    const x = (touch.clientX - rect.left - rect.width / 2) / zoomLevel;
                    const y = (touch.clientY - rect.top - rect.height / 2) / zoomLevel;
                    
                    zoomLevel = 2.5;
                    isZoomed = true;
                    translateX = -x * 1.5;
                    translateY = -y * 1.5;
                    constrainPan();
                    applyTransform(true);
                    galleryImage.classList.add('zoomed');
                }
            }
        }
    });

    // Double click to zoom (desktop)
    galleryImage.addEventListener('dblclick', (e) => {
        e.preventDefault();
        
        if (zoomLevel > 1) {
            resetZoom();
        } else {
            const rect = galleryImage.getBoundingClientRect();
            const x = (e.clientX - rect.left - rect.width / 2) / zoomLevel;
            const y = (e.clientY - rect.top - rect.height / 2) / zoomLevel;
            
            zoomLevel = 2.5;
            isZoomed = true;
            translateX = -x * 1.5;
            translateY = -y * 1.5;
            constrainPan();
            applyTransform(true);
            galleryImage.classList.add('zoomed');
        }
    });

    // Pinch to zoom (Facebook style - smooth and centered)
    galleryImage.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            e.preventDefault();
            tapCount = 0;
            clearTimeout(tapTimer);
            
            initialPinchDistance = getPinchDistance(e.touches);
            initialZoom = zoomLevel;
            
            const center = getPinchCenter(e.touches);
            const rect = galleryImage.getBoundingClientRect();
            pinchCenterX = (center.x - rect.left - rect.width / 2) / zoomLevel - translateX;
            pinchCenterY = (center.y - rect.top - rect.height / 2) / zoomLevel - translateY;
            
            applyTransform(false);
        } else if (e.touches.length === 1) {
            isDragging = true;
            startX = e.touches[0].clientX - translateX;
            startY = e.touches[0].clientY - translateY;
            lastMoveX = e.touches[0].clientX;
            lastMoveY = e.touches[0].clientY;
            lastMoveTime = Date.now();
            velocityX = 0;
            velocityY = 0;
            applyTransform(false);
        }
    });

    galleryImage.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2) {
            e.preventDefault();
            tapCount = 0;
            
            const currentDistance = getPinchDistance(e.touches);
            const scale = currentDistance / initialPinchDistance;
            zoomLevel = Math.max(1, Math.min(4, initialZoom * scale));
            
            // Zoom towards pinch center
            const center = getPinchCenter(e.touches);
            const rect = galleryImage.getBoundingClientRect();
            const currentCenterX = (center.x - rect.left - rect.width / 2) / zoomLevel;
            const currentCenterY = (center.y - rect.top - rect.height / 2) / zoomLevel;
            
            translateX = currentCenterX - pinchCenterX;
            translateY = currentCenterY - pinchCenterY;
            
            if (zoomLevel > 1) {
                isZoomed = true;
                galleryImage.classList.add('zoomed');
            } else {
                isZoomed = false;
                translateX = 0;
                translateY = 0;
                galleryImage.classList.remove('zoomed');
            }
            
            constrainPan();
            applyTransform(false);
            
        } else if (e.touches.length === 1 && isDragging) {
            e.preventDefault();
            tapCount = 0;
            
            const currentX = e.touches[0].clientX;
            const currentY = e.touches[0].clientY;
            const currentTime = Date.now();
            
            translateX = currentX - startX;
            translateY = currentY - startY;
            
            // Calculate velocity for momentum
            const timeDelta = currentTime - lastMoveTime;
            if (timeDelta > 0) {
                velocityX = (currentX - lastMoveX) / timeDelta;
                velocityY = (currentY - lastMoveY) / timeDelta;
            }
            
            lastMoveX = currentX;
            lastMoveY = currentY;
            lastMoveTime = currentTime;
            
            constrainPan();
            applyTransform(false);
        }
    });

    galleryImage.addEventListener('touchend', (e) => {
        if (e.touches.length === 0) {
            if (isDragging && (Math.abs(velocityX) > 0.5 || Math.abs(velocityY) > 0.5)) {
                // Apply momentum
                const momentumX = velocityX * 100;
                const momentumY = velocityY * 100;
                translateX += momentumX;
                translateY += momentumY;
                constrainPan();
                applyTransform(true);
            }
            
            isDragging = false;
            
            if (zoomLevel <= 1.05) {
                resetZoom();
            } else {
                constrainPan();
                applyTransform(true);
            }
        }
    });

    // Mouse wheel zoom (Facebook style)
    galleryImage.addEventListener('wheel', (e) => {
        e.preventDefault();
        
        const rect = galleryImage.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left - rect.width / 2) / zoomLevel - translateX;
        const mouseY = (e.clientY - rect.top - rect.height / 2) / zoomLevel - translateY;
        
        const delta = e.deltaY > 0 ? 0.85 : 1.15;
        const oldZoom = zoomLevel;
        zoomLevel = Math.max(1, Math.min(4, zoomLevel * delta));
        
        if (zoomLevel > 1) {
            // Zoom towards mouse position
            const zoomRatio = zoomLevel / oldZoom;
            translateX = (e.clientX - rect.left - rect.width / 2) / zoomLevel - mouseX;
            translateY = (e.clientY - rect.top - rect.height / 2) / zoomLevel - mouseY;
            
            isZoomed = true;
            galleryImage.classList.add('zoomed');
            constrainPan();
            applyTransform(false);
        } else {
            resetZoom();
        }
    });

    // Mouse drag (Facebook style with constraints)
    galleryImage.addEventListener('mousedown', (e) => {
        e.preventDefault();
        isDragging = true;
        startX = e.clientX - translateX;
        startY = e.clientY - translateY;
        lastMoveX = e.clientX;
        lastMoveY = e.clientY;
        lastMoveTime = Date.now();
        velocityX = 0;
        velocityY = 0;
        galleryImage.style.cursor = 'grabbing';
        applyTransform(false);
    });

    window.addEventListener('mousemove', (e) => {
        if (isDragging) {
            const currentTime = Date.now();
            
            translateX = e.clientX - startX;
            translateY = e.clientY - startY;
            
            // Calculate velocity
            const timeDelta = currentTime - lastMoveTime;
            if (timeDelta > 0) {
                velocityX = (e.clientX - lastMoveX) / timeDelta;
                velocityY = (e.clientY - lastMoveY) / timeDelta;
            }
            
            lastMoveX = e.clientX;
            lastMoveY = e.clientY;
            lastMoveTime = currentTime;
            
            constrainPan();
            applyTransform(false);
        }
    });

    window.addEventListener('mouseup', () => {
        if (isDragging) {
            // Apply momentum
            if (Math.abs(velocityX) > 0.5 || Math.abs(velocityY) > 0.5) {
                translateX += velocityX * 100;
                translateY += velocityY * 100;
                constrainPan();
                applyTransform(true);
            }
            
            isDragging = false;
            galleryImage.style.cursor = isZoomed ? 'grab' : 'default';
        }
    });

    // Reset zoom when changing images
    galleryPrev.addEventListener("click", () => {
        currentGalleryIndex = (currentGalleryIndex - 1 + currentGalleryImages.length) % currentGalleryImages.length;
        updateGallery();
    });

    galleryNext.addEventListener("click", () => {
        currentGalleryIndex = (currentGalleryIndex + 1) % currentGalleryImages.length;
        updateGallery();
    });
    
    // Logout Logic
    if (logoutLink && logoutModal) {
        logoutLink.addEventListener("click", (e) => {
            e.preventDefault();
            openModal(logoutModal);
            profileDropdown.classList.remove("show");
        });
    }
    if (cancelLogout) cancelLogout.addEventListener("click", () => closeModal(logoutModal));
    if (confirmLogout) {
        confirmLogout.addEventListener("click", () => {
            removeToken();
            window.location.href = '/HTML code/main-page.html';
        });
    }

    // Delete Account
    const deleteAccountLink = document.getElementById("deleteAccountLink");
    if (deleteAccountLink) {
        deleteAccountLink.addEventListener("click", async (e) => {
            e.preventDefault();
            profileDropdown.classList.remove("show");
            
            const confirmation = confirm('Are you sure you want to delete your account? This action cannot be undone. All your posts and data will be permanently deleted.');
            
            if (confirmation) {
                const doubleConfirm = confirm('This is your last chance. Are you absolutely sure you want to delete your account?');
                
                if (doubleConfirm) {
                    try {
                        await fetchWithAuth('/api/delete-account', {
                            method: 'DELETE'
                        });
                        
                        removeToken();
                        alert('Your account has been deleted.');
                        window.location.href = '/HTML code/log-in.html';
                    } catch (error) {
                        console.error('Failed to delete account:', error);
                        alert('Failed to delete account: ' + error.message);
                    }
                }
            }
        });
    }
    
    // New Post Image Preview
    if (postImagesInput && imagePreview) {
        postImagesInput.addEventListener("change", () => {
            imagePreview.innerHTML = "";
            Array.from(postImagesInput.files).forEach(file => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = document.createElement("img");
                    img.src = e.target.result;
                    imagePreview.appendChild(img);
                };
                reader.readAsDataURL(file);
            });
        });
    }

    // Create New Post
    if (postForm) {
        postForm.addEventListener("submit", async (e) => {
            e.preventDefault();
        
        const imagesBase64 = [];
        const files = postImagesInput.files;

        for (let i = 0; i < files.length; i++) {
            try {
                const base64 = await fileToBase64(files[i]);
                imagesBase64.push(base64);
            } catch (error) {
                console.error("Error converting image:", error);
            }
        }
        
        const postData = {
            title: document.getElementById("postTitle").value,
            price: document.getElementById("postPrice").value,
            description: document.getElementById("postDescription").value,
            contact: document.getElementById("postContact").value,
            images: imagesBase64
        };

        try {
            await fetchWithAuth('/api/posts', {
                method: 'POST',
                body: JSON.stringify(postData)
            });
            
            closeModal(postModal);
            postForm.reset();
            imagePreview.innerHTML = "";
            loadPosts();
        } catch (error) {
            console.error("Failed to create post:", error);
            alert(`Error: ${error.message}`);
        }
        });
    }

    // Edit Post Modal
    const editImagesInput = document.getElementById("editImages");
    const editImagePreview = document.getElementById("editImagePreview");
    let currentEditPostId = null;
    let currentEditPostImages = [];

    editImagesInput.addEventListener("change", () => {
        editImagePreview.innerHTML = "";
        Array.from(editImagesInput.files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = document.createElement("img");
                img.src = e.target.result;
                editImagePreview.appendChild(img);
            };
            reader.readAsDataURL(file);
        });
    });

    function openEditModal(post) {
        currentEditPostId = post.id;
        currentEditPostImages = post.images || [];
        
        document.getElementById("editTitle").value = post.title;
        document.getElementById("editPrice").value = post.price;
        document.getElementById("editDescription").value = post.description;
        document.getElementById("editContact").value = post.contact;
        
        // Show current images
        editImagePreview.innerHTML = "";
        currentEditPostImages.forEach(imgSrc => {
            const img = document.createElement("img");
            img.src = imgSrc;
            editImagePreview.appendChild(img);
        });
        
        openModal(editModal);
    }

    editForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        let imagesBase64 = currentEditPostImages;
        
        // If new images are selected, use them
        if (editImagesInput.files.length > 0) {
            imagesBase64 = [];
            for (let i = 0; i < editImagesInput.files.length; i++) {
                try {
                    const base64 = await fileToBase64(editImagesInput.files[i]);
                    imagesBase64.push(base64);
                } catch (error) {
                    console.error("Error converting image:", error);
                }
            }
        }
        
        const postData = {
            title: document.getElementById("editTitle").value,
            price: document.getElementById("editPrice").value,
            description: document.getElementById("editDescription").value,
            contact: document.getElementById("editContact").value,
            images: imagesBase64
        };

        try {
            await fetchWithAuth(`/api/posts/${currentEditPostId}`, {
                method: 'PUT',
                body: JSON.stringify(postData)
            });
            
            closeModal(editModal);
            editForm.reset();
            editImagePreview.innerHTML = "";
            loadPosts(); // Reload posts to show updated version
        } catch (error) {
            console.error("Failed to update post:", error);
            alert(`Error: ${error.message}`);
        }
    });

    // Get current user info
    console.log('Fetching current user profile...');
    fetchWithAuth('/api/profile')
        .then(data => {
            console.log('Current user loaded:', data.username);
            currentUsername = data.username;
            
            // Set up profile link
            const profileLink = document.getElementById('profileLink');
            if (profileLink) {
                profileLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    window.location.href = `/HTML code/profile.html?user=${data.username}`;
                });
            }
        })
        .catch(e => console.error("Could not load user info:", e));

    // Load All Posts

    async function loadPosts() {
        console.log('🔄 Starting loadPosts function...');
        
        try {
            const response = await fetch('/api/posts?t=' + Date.now());
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const postsData = await response.json();
            console.log('✅ Successfully loaded', postsData.length, 'posts');
            
            // Clear container and render posts
            postContainer.innerHTML = "";
            
            if (postsData.length === 0) {
                postContainer.innerHTML = '<p style="text-align: center; padding: 40px; color: #666;">No posts yet. Be the first to post!</p>';
            } else {
                console.log('🎨 Rendering posts...');
                postsData.forEach((post, index) => {
                    console.log(`Rendering post ${index + 1}: ${post.title}`);
                    const postCard = createPostElement(post);
                    postContainer.appendChild(postCard);
                });
                console.log('✅ All posts rendered successfully');
            }
            
        } catch (error) {
            console.error('❌ Failed to load posts:', error);
            postContainer.innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <p style="color: red; margin-bottom: 10px;">Failed to load posts</p>
                    <p style="color: #666; font-size: 14px;">Error: ${error.message}</p>
                    <button onclick="window.location.reload()" style="margin-top: 15px; padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">Refresh Page</button>
                </div>
            `;
        }
    }
    
    // Render a Single Post Card
    function createPostElement(post) {
        console.log('🎨 Creating post element for:', post.title);
        
        const postCard = document.createElement("div");
        postCard.className = "post-card";

        // Create simple image display
        let imagesHTML = '';
        if (post.images && post.images.length > 0) {
            const imageCount = post.images.length;
            const displayCount = Math.min(imageCount, 4);
            const gridClass = `grid-${displayCount}`;
            
            imagesHTML = `<div class="post-images-grid ${gridClass}">`;
            
            for (let i = 0; i < displayCount; i++) {
                const isLast = i === 3 && imageCount > 4;
                const remaining = imageCount - 4;
                
                imagesHTML += `
                    <div class="grid-image-wrapper" data-index="${i}">
                        <img src="${post.images[i]}" class="grid-image-bg" alt="">
                        <img src="${post.images[i]}" class="grid-image" alt="${post.title}">
                        ${isLast ? `<div class="grid-image-overlay">+${remaining}</div>` : ''}
                    </div>
                `;
            }
            
            imagesHTML += '</div>';
        }
        
        const postDate = new Date(post.post_date).toLocaleString();

        // Simple menu for now - just show for post authors
        const isAuthor = currentUsername && currentUsername === post.author_username;
        const menuHTML = isAuthor ? `
            <div class="post-menu-container">
                <button class="post-menu-btn" data-post-id="${post.id}">⋮</button>
                <div class="post-menu-dropdown">
                    <button class="edit-option" data-post-id="${post.id}">✏️ Edit</button>
                    <button class="delete-option" data-post-id="${post.id}">🗑️ Delete</button>
                </div>
            </div>
        ` : '';

        // DM button (only show if not own post)
        const dmButton = isAuthor ? '' : `<button class="dm-user-btn" data-username="${post.author_username}">💬 DM User</button>`;
        
        postCard.innerHTML = `
            <div class="poster-info">
                <img src="${(post.author_profile_pic && post.author_profile_pic !== 'null' && post.author_profile_pic !== '') ? post.author_profile_pic : '/pictures/Default PFP.png'}" alt="Profile" class="poster-pic" onerror="this.src='/pictures/Default PFP.png'">
                <span class="poster-name" data-username="${post.author_username}">${post.author_username}</span>
                ${menuHTML}
            </div>
            <div class="post-content">
                <h3>${post.title}</h3>
                <p><strong>Price:</strong> ${post.price || 'N/A'}</p>
                <p>${post.description}</p>
                <p><strong>Contact:</strong> ${post.contact}</p>
            </div>
            ${imagesHTML}
            ${dmButton}
            <p style="font-size: 0.8em; color: #777; margin-top: 10px;">Posted: ${postDate}</p>
        `;
        
        // Add basic event listeners
        try {
            // Profile click
            const posterName = postCard.querySelector('.poster-name');
            if (posterName) {
                posterName.addEventListener('click', (e) => {
                    e.stopPropagation();
                    window.location.href = `/HTML code/profile.html?user=${e.target.dataset.username}`;
                });
            }
            
            // DM button
            const dmBtn = postCard.querySelector('.dm-user-btn');
            if (dmBtn) {
                dmBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const username = dmBtn.dataset.username;
                    window.location.href = `/HTML code/messages.html?user=${username}`;
                });
            }
            
            // Simple menu functionality
            const menuBtn = postCard.querySelector('.post-menu-btn');
            const menuDropdown = postCard.querySelector('.post-menu-dropdown');
            
            if (menuBtn && menuDropdown) {
                menuBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    document.querySelectorAll('.post-menu-dropdown.show').forEach(menu => {
                        if (menu !== menuDropdown) menu.classList.remove('show');
                    });
                    menuDropdown.classList.toggle('show');
                });

                // Edit button
                const editBtn = menuDropdown.querySelector('.edit-option');
                if (editBtn) {
                    editBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        menuDropdown.classList.remove('show');
                        openEditModal(post);
                    });
                }

                // Delete button
                const deleteBtn = menuDropdown.querySelector('.delete-option');
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        menuDropdown.classList.remove('show');
                        if (confirm('Are you sure you want to delete this post?')) {
                            try {
                                await fetchWithAuth(`/api/posts/${post.id}`, {
                                    method: 'DELETE'
                                });
                                postCard.remove();
                            } catch (error) {
                                console.error('Failed to delete post:', error);
                                alert('Failed to delete post: ' + error.message);
                            }
                        }
                    });
                }
            }
            
        } catch (error) {
            console.error('Error adding event listeners to post:', error);
        }

        console.log('✅ Post element created successfully');
        return postCard;
    }
    
    // Search functionality setup

    // Live search dropdown
    if (searchInput && searchDropdown && clearSearch) {
        searchInput.addEventListener('input', () => {
            const query = searchInput.value.trim();
            
            if (query) {
                clearSearch.style.display = 'block';
                
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    performLiveSearch(query);
                }, 300);
            } else {
                clearSearch.style.display = 'none';
                searchDropdown.classList.remove('show');
            }
        });
    }

    // Clear search button
    if (clearSearch) {
        clearSearch.addEventListener('click', () => {
            searchInput.value = '';
            clearSearch.style.display = 'none';
            searchDropdown.classList.remove('show');
            
            if (isSearchMode) {
                isSearchMode = false;
                searchQuery = '';
                loadPosts();
            }
        });
    }

    // Refresh button
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            refreshBtn.classList.add('spinning');
            console.log('Manual refresh triggered');
            
            try {
                await loadPosts();
                showNotification('Posts refreshed!', 'success');
            } catch (error) {
                console.error('Manual refresh failed:', error);
                showNotification('Failed to refresh posts', 'error');
            } finally {
                setTimeout(() => {
                    refreshBtn.classList.remove('spinning');
                }, 1000);
            }
        });
    } else {
        console.log('Refresh button not found, skipping refresh functionality');
    }

    // Helper function to show notifications
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 6px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
            max-width: 300px;
        `;
        
        const colors = {
            success: '#28a745',
            error: '#dc3545',
            info: '#007bff'
        };
        notification.style.backgroundColor = colors[type] || colors.info;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    async function performLiveSearch(query) {
        try {
            const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
            const data = await response.json();
            
            if (data.users && data.users.length > 0) {
                searchDropdown.innerHTML = '';
                
                data.users.slice(0, 5).forEach(user => {
                    const item = document.createElement('div');
                    item.className = 'search-dropdown-item';
                    item.innerHTML = `
                        <img src="${(user.profile_pic && user.profile_pic !== 'null' && user.profile_pic !== '') ? user.profile_pic : '/pictures/Default PFP.png'}" alt="${user.username}" onerror="this.src='/pictures/Default PFP.png'">
                        <div class="search-dropdown-item-info">
                            <div class="search-dropdown-item-name">${user.username}</div>
                            <div class="search-dropdown-item-desc">${user.description || 'No description'}</div>
                        </div>
                    `;
                    
                    item.addEventListener('click', () => {
                        window.location.href = `/HTML code/profile.html?user=${user.username}`;
                    });
                    
                    searchDropdown.appendChild(item);
                });
                
                searchDropdown.classList.add('show');
            } else {
                searchDropdown.classList.remove('show');
            }
        } catch (error) {
            console.error('Search failed:', error);
        }
    }

    if (searchInput) {
        searchInput.addEventListener("keypress", async (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const query = searchInput.value.trim();
                
                if (query === '') {
                    // Empty search - show all posts
                    isSearchMode = false;
                    searchQuery = '';
                    loadPosts();
                    return;
                }
                
                // Perform search
                isSearchMode = true;
                searchQuery = query;
                await performSearch(query);
            }
        });
    }

    async function performSearch(query) {
        try {
            const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
            if (!response.ok) throw new Error('Search failed');
            
            const data = await response.json();
            
            postContainer.innerHTML = "";
            
            // Show users first if any found
            if (data.users && data.users.length > 0) {
                const usersSection = document.createElement('div');
                usersSection.className = 'search-section';
                usersSection.innerHTML = '<h2 class="section-title">Users</h2>';
                
                data.users.forEach(user => {
                    const userCard = createUserCard(user);
                    usersSection.appendChild(userCard);
                });
                
                postContainer.appendChild(usersSection);
            }
            
            // Show posts
            if (data.posts && data.posts.length > 0) {
                const postsSection = document.createElement('div');
                postsSection.className = 'search-section';
                postsSection.innerHTML = '<h2 class="section-title">Posts</h2>';
                
                data.posts.forEach(post => {
                    const postCard = createPostElement(post);
                    postsSection.appendChild(postCard);
                });
                
                postContainer.appendChild(postsSection);
            }
            
            // Show no results message
            if ((!data.users || data.users.length === 0) && (!data.posts || data.posts.length === 0)) {
                postContainer.innerHTML = `
                    <div class="no-results">
                        <h2>No results found for "${query}"</h2>
                        <p>Try searching with different keywords</p>
                        <button onclick="document.getElementById('searchInput').value=''; document.getElementById('searchInput').dispatchEvent(new KeyboardEvent('keypress', {key: 'Enter'}));" class="clear-search-btn">Clear Search</button>
                    </div>
                `;
            }
            
        } catch (error) {
            console.error("Search failed:", error);
            alert('Search failed. Please try again.');
        }
    }

    function createUserCard(user) {
        const userCard = document.createElement('div');
        userCard.className = 'user-card';
        
        userCard.innerHTML = `
            <img src="${(user.profile_pic && user.profile_pic !== 'null' && user.profile_pic !== '') ? user.profile_pic : '/pictures/Default PFP.png'}" alt="${user.username}" class="user-card-pic" onerror="this.src='/pictures/Default PFP.png'">
            <div class="user-card-info">
                <h3 class="user-card-name">${user.username}</h3>
                <p class="user-card-desc">${user.description || 'No description'}</p>
                <p class="user-card-joined">Joined: ${new Date(user.reg_date).toLocaleDateString()}</p>
            </div>
            <button class="view-profile-btn" data-username="${user.username}">View Profile</button>
        `;
        
        // Add click listener to view profile button
        userCard.querySelector('.view-profile-btn').addEventListener('click', () => {
            window.location.href = `/HTML code/profile.html?user=${user.username}`;
        });
        
        return userCard;
    }

    // Helper to compare two sets
    function setsEqual(a, b) {
        return a.size === b.size && [...a].every(value => b.has(value));
    }

    // Auto-refresh posts every 5 seconds (only when not in search mode)
    let lastPostCount = 0;
    let lastPostIds = new Set();

    setInterval(async () => {
        if (isSearchMode) return;

        try {
            const response = await fetch('/api/posts?t=' + Date.now());
            if (!response.ok) return;

            const postsData = await response.json();
            const currentPostIds = new Set(postsData.map(post => post.id));
            const countChanged = postsData.length !== lastPostCount;
            const idsChanged = !setsEqual(currentPostIds, lastPostIds);

            if (countChanged || idsChanged) {
                console.log('Posts changed, refreshing...');
                lastPostCount = postsData.length;
                lastPostIds = currentPostIds;

                postContainer.innerHTML = '';
                if (postsData.length === 0) {
                    postContainer.innerHTML = '<p style="text-align: center; padding: 40px; color: #666;">No posts yet. Be the first to post!</p>';
                } else {
                    postsData.forEach(post => {
                        const postCard = createPostElement(post);
                        postContainer.appendChild(postCard);
                    });
                }
            }
        } catch (error) {
            console.error('Auto-refresh failed:', error);
        }
    }, 5000);

    // Initial load
    console.log('🚀 Starting initial post load...');
    await loadPosts();
    // Seed the refresh tracker with current state so it doesn't re-render immediately
    try {
        const r = await fetch('/api/posts?t=' + Date.now());
        if (r.ok) {
            const initial = await r.json();
            lastPostCount = initial.length;
            lastPostIds = new Set(initial.map(p => p.id));
        }
    } catch(e) {}
    console.log('✅ handleHomePageLogic setup complete');
}

// --- Main Execution ---
console.log('=== Main Execution Starting ===');
(function() {
    const currentPage = window.location.pathname;
    const token = getToken();
    
    console.log('Current page:', currentPage);
    console.log('Token exists:', !!token);
    console.log('Document ready state:', document.readyState);

    // For protected pages, check if user is logged in
    if (currentPage.includes('home-page.html') || currentPage.includes('settings.html')) {
        console.log('On protected page');
        
        if (!token) {
            console.log('No token, redirecting to login');
            window.location.replace('/HTML code/log-in.html');
            return;
        }
        
        console.log('Token found, initializing page');
        
        // Initialize the appropriate page
        if (document.readyState === 'loading') {
            console.log('Document still loading, waiting for DOMContentLoaded');
            document.addEventListener('DOMContentLoaded', function() {
                console.log('DOMContentLoaded fired');
                if (currentPage.includes('settings.html')) {
                    handleSettingsLogic();
                } else if (currentPage.includes('home-page.html')) {
                    console.log('Calling handleHomePageLogic');
                    handleHomePageLogic();
                }
            });
        } else {
            console.log('Document already loaded, initializing immediately');
            if (currentPage.includes('settings.html')) {
                handleSettingsLogic();
            } else if (currentPage.includes('home-page.html')) {
                console.log('Calling handleHomePageLogic');
                handleHomePageLogic();
            }
        }
    } else {
        console.log('Not on protected page');
    }
})();
console.log('=== Main Execution Complete ===');


// --- Message Notification Badge ---
async function updateMessageBadge() {
    try {
        const conversations = await fetchWithAuth('/api/conversations');
        const totalUnread = conversations.reduce((sum, conv) => sum + (conv.unread_count || 0), 0);
        
        const badge = document.getElementById('messageBadge');
        if (badge) {
            if (totalUnread > 0) {
                badge.textContent = totalUnread > 99 ? '99+' : totalUnread;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Failed to update message badge:', error);
    }
}

// Update badge on page load
if (document.getElementById('messageBadge')) {
    updateMessageBadge();
    
    // Update badge every 5 seconds
    setInterval(updateMessageBadge, 5000);
}


// ============================================
// REAL-TIME NOTIFICATIONS WITH SOCKETIO
// ============================================

// Initialize SocketIO for real-time notifications
let socket = null;
let currentUserId = null;

// Initialize SocketIO connection
function initializeSocketIO() {
    if (typeof io === 'undefined') {
        console.log('SocketIO not loaded yet');
        return;
    }
    
    console.log('🔌 Initializing SocketIO for notifications...');
    socket = io({
        transports: ['polling', 'websocket'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
        upgrade: true
    });
    
    socket.on('connect', () => {
        console.log('✅ SocketIO connected for notifications!', socket.id);
        
        // Join user's notification room
        if (currentUserId) {
            socket.emit('join', { user_id: currentUserId });
            console.log('Joined notification room: user_' + currentUserId);
        }
    });
    
    socket.on('disconnect', () => {
        console.log('❌ SocketIO disconnected');
    });
    
    socket.on('connect_error', (error) => {
        console.error('❌ SocketIO connection error:', error);
    });
    
    // Listen for new follower notifications
    socket.on('new_follower', (data) => {
        console.log('👤 New follower notification:', data);
        
        // Play notification sound
        playNotificationSound('follower');
        
        // Show browser notification
        showBrowserNotification(
            'New Follower!',
            `${data.follower_username} started following you`,
            data.follower_profile_pic
        );
        
        // Show in-page notification (if you have a notification UI)
        showInPageNotification(`${data.follower_username} started following you`, 'follower');
    });
    
    // Listen for new message notifications (when not on messages page)
    socket.on('new_message', (data) => {
        console.log('💬 New message notification:', data);
        
        // Only show if we're not on the messages page
        if (!window.location.pathname.includes('messages.html')) {
            // Play notification sound
            playNotificationSound('message');
            
            // Show browser notification
            showBrowserNotification(
                `New message from ${data.sender_username}`,
                data.message,
                data.sender_profile_pic
            );
            
            // Show in-page notification
            showInPageNotification(`New message from ${data.sender_username}`, 'message');
        }
    });
}

// Show in-page notification (toast style)
function showInPageNotification(message, type = 'default') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'toast-notification';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'follower' ? '#007bff' : '#28a745'};
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
        max-width: 300px;
        font-size: 14px;
        font-weight: 500;
    `;
    
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 20px;">${type === 'follower' ? '👤' : '💬'}</span>
            <span>${message}</span>
        </div>
    `;
    
    // Add animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(400px);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(400px);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(notification);
    
    // Remove after 5 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 5000);
    
    // Click to dismiss
    notification.onclick = () => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
            notification.remove();
        }, 300);
    };
}

// Get current user ID and initialize SocketIO
async function setupNotifications() {
    try {
        const token = getToken();
        if (!token) return;
        
        // Get current user profile to get user ID
        const response = await fetchWithAuth('/api/profile');
        currentUserId = response.id;
        
        console.log('Current user ID:', currentUserId);
        
        // Initialize SocketIO
        initializeSocketIO();
    } catch (error) {
        console.error('Failed to setup notifications:', error);
    }
}

// Initialize notifications when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupNotifications);
} else {
    setupNotifications();
}
