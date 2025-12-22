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

// Get username from URL
const urlParams = new URLSearchParams(window.location.search);
const profileUsername = urlParams.get('user');

if (!profileUsername) {
    window.location.href = '/HTML code/home-page.html';
}

// Helper functions
function openModal(modal) { modal.style.display = "flex"; }
function closeModal(modal) { modal.style.display = "none"; }

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

async function fetchWithAuth(url, options = {}) {
    const token = getToken();
    
    const headers = new Headers(options.headers || {});
    if (token) {
        headers.append('Authorization', `Bearer ${token}`);
    }
    if (options.body && !(options.body instanceof FormData)) {
        headers.append('Content-Type', 'application/json');
    }

    const response = await fetch(url, { ...options, headers });

    if (response.status === 401) {
        const currentPage = window.location.pathname;
        if (currentPage.includes('profile.html')) {
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

// Initialize page
let currentUser = null;
let currentGalleryImages = [];
let currentGalleryIndex = 0;

// Get current logged-in user
console.log('Fetching current user profile...');
fetchWithAuth('/api/profile')
    .then(data => {
        console.log('Current user data:', data);
        currentUser = data;
        loadProfile();
    })
    .catch(e => {
        console.error("Could not load user info:", e);
        alert('Failed to load user info. Please log in again.');
        window.location.href = '/HTML code/log-in.html';
    });

// Load profile data
async function loadProfile() {
    try {
        console.log('Loading profile for username:', profileUsername);
        const response = await fetch(`/api/user/${profileUsername}`);
        console.log('Profile response status:', response.status);
        const profileData = await response.json();
        console.log('Profile data received:', profileData);
        
        if (!response.ok) {
            alert('User not found');
            window.location.href = '/HTML code/home-page.html';
            return;
        }
        
        // Update profile UI
        console.log('Profile pic URL:', profileData.profile_pic);
        const profilePicElement = document.getElementById('profilePic');
        profilePicElement.src = profileData.profile_pic || '/pictures/Default PFP.png';
        profilePicElement.onerror = function() {
            console.error('Failed to load profile picture, using default');
            this.src = '/pictures/Default PFP.png';
        };
        
        document.getElementById('profileUsername').textContent = profileData.username;
        document.getElementById('profileDescription').textContent = profileData.description || 'No description';
        document.getElementById('postCount').textContent = profileData.post_count;
        document.getElementById('followerCount').textContent = profileData.follower_count;
        document.getElementById('followingCount').textContent = profileData.following_count;
        document.getElementById('profileEmail').textContent = profileData.email ? `📧 ${profileData.email}` : '';
        document.getElementById('profilePhone').textContent = profileData.phone ? `📞 ${profileData.phone}` : '';
        document.getElementById('profileJoined').textContent = `📅 Joined ${new Date(profileData.reg_date).toLocaleDateString()}`;
        
        // Show appropriate buttons
        const isOwnProfile = currentUser && currentUser.username === profileUsername;
        
        if (isOwnProfile) {
            document.getElementById('editProfileBtn').style.display = 'inline-block';
            document.getElementById('editProfileBtn').onclick = () => {
                window.location.href = '/HTML code/settings.html';
            };
        } else {
            document.getElementById('followBtn').style.display = 'inline-block';
            document.getElementById('dmBtn').style.display = 'inline-block';
            document.getElementById('dmBtn').onclick = () => {
                window.location.href = `/HTML code/messages.html?user=${profileUsername}`;
            };
            checkFollowStatus();
        }
        
        // Load posts
        const postsContainer = document.getElementById('postsContainer');
        postsContainer.innerHTML = '';
        
        if (profileData.posts.length === 0) {
            postsContainer.innerHTML = '<p style="text-align: center; color: #666;">No posts yet</p>';
        } else {
            profileData.posts.forEach(post => {
                const postCard = createPostElement(post, isOwnProfile);
                postsContainer.appendChild(postCard);
            });
        }
        
    } catch (error) {
        console.error('Failed to load profile:', error);
        alert('Failed to load profile');
        window.location.href = '/HTML code/home-page.html';
    }
}

async function checkFollowStatus() {
    try {
        const data = await fetchWithAuth(`/api/is-following/${profileUsername}`);
        const followBtn = document.getElementById('followBtn');
        
        if (data.is_following) {
            followBtn.textContent = 'Unfollow';
            followBtn.classList.add('following');
        } else {
            followBtn.textContent = 'Follow';
            followBtn.classList.remove('following');
        }
        
        followBtn.onclick = toggleFollow;
    } catch (error) {
        console.error('Failed to check follow status:', error);
    }
}

async function toggleFollow() {
    const followBtn = document.getElementById('followBtn');
    const isFollowing = followBtn.classList.contains('following');
    
    try {
        if (isFollowing) {
            await fetchWithAuth(`/api/unfollow/${profileUsername}`, { method: 'POST' });
            followBtn.textContent = 'Follow';
            followBtn.classList.remove('following');
            
            // Update follower count
            const count = parseInt(document.getElementById('followerCount').textContent);
            document.getElementById('followerCount').textContent = count - 1;
        } else {
            await fetchWithAuth(`/api/follow/${profileUsername}`, { method: 'POST' });
            followBtn.textContent = 'Unfollow';
            followBtn.classList.add('following');
            
            // Update follower count
            const count = parseInt(document.getElementById('followerCount').textContent);
            document.getElementById('followerCount').textContent = count + 1;
        }
    } catch (error) {
        console.error('Failed to toggle follow:', error);
        alert('Failed to update follow status');
    }
}

function createPostElement(post, isOwner) {
    const postCard = document.createElement("div");
    postCard.className = "post-card";

    // Create image grid
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
    
    // Menu for owner
    const menuHTML = isOwner ? `
        <div class="post-menu-container">
            <button class="post-menu-btn" data-post-id="${post.id}">⋮</button>
            <div class="post-menu-dropdown">
                <button class="delete-option" data-post-id="${post.id}">🗑️ Delete</button>
            </div>
        </div>
    ` : '';

    const authorPicUrl = post.author_profile_pic || '/pictures/Default PFP.png';
    console.log('Post author pic URL:', authorPicUrl, 'for user:', post.author_username);
    
    postCard.innerHTML = `
        <div class="poster-info">
            <img src="${authorPicUrl}" alt="Profile" class="poster-pic" onerror="this.src='/pictures/Default PFP.png'">
            <span class="poster-name" data-username="${post.author_username}">${post.author_username}</span>
            ${menuHTML}
        </div>
        <div class="post-content">
            <h3>${post.title}</h3>
            <p><strong>Price:</strong> ${post.price || 'N/A'}</p>
            <p>${post.description}</p>
            <p><strong>Contact:</strong> ${post.contact}</p>
            <p style="font-size: 0.8em; color: #777; margin-top: 10px;">Posted: ${postDate}</p>
        </div>
        ${imagesHTML}
    `;
    
    // Image gallery listeners
    const imageWrappers = postCard.querySelectorAll('.grid-image-wrapper');
    imageWrappers.forEach((wrapper) => {
        wrapper.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = parseInt(wrapper.getAttribute('data-index'));
            openGallery(post.images, index);
        });
    });
    
    // Menu listeners
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
                        
                        // Update post count
                        const count = parseInt(document.getElementById('postCount').textContent);
                        document.getElementById('postCount').textContent = count - 1;
                    } catch (error) {
                        console.error('Failed to delete post:', error);
                        alert('Failed to delete post: ' + error.message);
                    }
                }
            });
        }
    }
    
    return postCard;
}

// Gallery
const imageGallery = document.getElementById("imageGallery");
const galleryImage = document.getElementById("galleryImage");
const galleryPrev = document.getElementById("galleryPrev");
const galleryNext = document.getElementById("galleryNext");
const galleryCounter = document.getElementById("galleryCounter");
const closeGallery = document.getElementById("closeGallery");

closeGallery.addEventListener("click", () => closeModal(imageGallery));

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
    
    const maxX = Math.max(0, (scaledWidth - parentWidth) / 2 / zoomLevel);
    const maxY = Math.max(0, (scaledHeight - parentHeight) / 2 / zoomLevel);
    
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

// Pinch to zoom (Facebook style)
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

// Mouse drag (Facebook style)
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

// Navigation with zoom reset
galleryPrev.addEventListener("click", () => {
    currentGalleryIndex = (currentGalleryIndex - 1 + currentGalleryImages.length) % currentGalleryImages.length;
    updateGallery();
});

galleryNext.addEventListener("click", () => {
    currentGalleryIndex = (currentGalleryIndex + 1) % currentGalleryImages.length;
    updateGallery();
});

window.addEventListener("click", (e) => {
    if (e.target === imageGallery) closeModal(imageGallery);
    
    document.querySelectorAll('.post-menu-dropdown.show').forEach(menu => {
        menu.classList.remove('show');
    });
});

// Header functionality
// Post button removed - using create post box on home page instead

const profileBtn = document.getElementById('profileBtn');
const profileDropdown = document.getElementById('profileDropdown');

// Load header profile pic
fetchWithAuth('/api/profile')
    .then(data => {
        if (data.profile_picture && data.profile_picture !== 'null' && data.profile_picture !== '') {
            profileBtn.innerHTML = '';
            const img = document.createElement('img');
            img.src = data.profile_picture;
            img.style = "width: 100%; height: 100%; object-fit: cover;";
            img.onerror = function() {
                // If image fails to load, show default icon
                profileBtn.innerHTML = '👤';
            };
            profileBtn.appendChild(img);
        } else {
            // Show default icon if no profile picture
            profileBtn.innerHTML = '👤';
        }
    })
    .catch(e => {
        console.error("Could not load header pic:", e);
        profileBtn.innerHTML = '👤';
    });

profileBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    profileDropdown.classList.toggle("show");
});

window.addEventListener("click", (e) => {
    if (!e.target.closest('.profile-menu')) {
        profileDropdown.classList.remove("show");
    }
});

// Logout
// Profile link
const profileLink = document.getElementById("profileLink");
if (profileLink) {
    profileLink.addEventListener("click", async (e) => {
        e.preventDefault();
        profileDropdown.classList.remove("show");
        
        // Get current user's username
        const token = getToken();
        if (token) {
            try {
                const response = await fetch('/api/profile', {
                    headers: {
                        'Authorization': 'Bearer ' + token
                    }
                });
                if (response.ok) {
                    const data = await response.json();
                    window.location.href = `/HTML code/profile.html?user=${data.username}`;
                }
            } catch (error) {
                console.error('Error loading profile:', error);
            }
        }
    });
}

const logoutModal = document.getElementById("logoutModal");
const logoutLink = document.getElementById("logoutLink");
const confirmLogout = document.getElementById("confirmLogout");
const cancelLogout = document.getElementById("cancelLogout");

logoutLink.addEventListener("click", (e) => {
    e.preventDefault();
    openModal(logoutModal);
    profileDropdown.classList.remove("show");
});

cancelLogout.addEventListener("click", () => closeModal(logoutModal));

confirmLogout.addEventListener("click", () => {
    removeToken();
    window.location.href = '/HTML code/main-page.html';
});

window.addEventListener("click", (e) => {
    if (e.target === logoutModal) closeModal(logoutModal);
});

// Search functionality
const searchInput = document.getElementById('searchInput');
const clearSearch = document.getElementById('clearSearch');
const searchDropdown = document.getElementById('searchDropdown');

let searchTimeout;

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

searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        const query = searchInput.value.trim();
        if (query) {
            window.location.href = `/HTML code/home-page.html?search=${encodeURIComponent(query)}`;
        }
    }
});

clearSearch.addEventListener('click', () => {
    searchInput.value = '';
    clearSearch.style.display = 'none';
    searchDropdown.classList.remove('show');
});

async function performLiveSearch(query) {
    try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        if (data.users && data.users.length > 0) {
            searchDropdown.innerHTML = '';
            
            data.users.slice(0, 5).forEach(user => {
                const item = document.createElement('div');
                item.className = 'search-dropdown-item';
                const userPicUrl = user.profile_pic || '/pictures/Default PFP.png';
                item.innerHTML = `
                    <img src="${userPicUrl}" alt="${user.username}" onerror="this.src='/pictures/Default PFP.png'">
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

window.addEventListener('click', (e) => {
    if (!e.target.closest('.search-container')) {
        searchDropdown.classList.remove('show');
    }
});


// Followers/Following Modal
const followersModal = document.getElementById('followersModal');
const closeFollowersModal = document.getElementById('closeFollowersModal');
const followersList = document.getElementById('followersList');
const followersTabs = document.querySelectorAll('.followers-tab');

let currentTab = 'followers';

closeFollowersModal.addEventListener('click', () => closeModal(followersModal));

window.addEventListener('click', (e) => {
    if (e.target === followersModal) closeModal(followersModal);
});

// Make follower/following counts clickable
document.getElementById('followerCount').style.cursor = 'pointer';
document.getElementById('followingCount').style.cursor = 'pointer';

document.getElementById('followerCount').parentElement.addEventListener('click', () => {
    currentTab = 'followers';
    openFollowersModal('followers');
});

document.getElementById('followingCount').parentElement.addEventListener('click', () => {
    currentTab = 'following';
    openFollowersModal('following');
});

followersTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        followersTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentTab = tab.dataset.tab;
        loadFollowersList(currentTab);
    });
});

async function openFollowersModal(tab) {
    currentTab = tab;
    
    followersTabs.forEach(t => {
        if (t.dataset.tab === tab) {
            t.classList.add('active');
        } else {
            t.classList.remove('active');
        }
    });
    
    openModal(followersModal);
    await loadFollowersList(tab);
}

async function loadFollowersList(type) {
    try {
        followersList.innerHTML = '<p style="text-align: center; padding: 20px;">Loading...</p>';
        
        const response = await fetch(`/api/user/${profileUsername}/${type}`);
        const users = await response.json();
        
        followersList.innerHTML = '';
        
        if (users.length === 0) {
            followersList.innerHTML = `<p style="text-align: center; padding: 40px; color: #666;">No ${type} yet</p>`;
            return;
        }
        
        for (const user of users) {
            const item = document.createElement('div');
            item.className = 'follower-item';
            
            // Check if current user is following this user
            let isFollowing = false;
            let followButton = '';
            
            if (currentUser && currentUser.username !== user.username) {
                try {
                    const followStatus = await fetchWithAuth(`/api/is-following/${user.username}`);
                    isFollowing = followStatus.is_following;
                    
                    followButton = `<button class="follower-item-btn ${isFollowing ? 'following' : 'follow'}" data-username="${user.username}">
                        ${isFollowing ? 'Following' : 'Follow'}
                    </button>`;
                } catch (e) {
                    console.error('Error checking follow status:', e);
                }
            }
            
            const userPicUrl = user.profile_pic || '/pictures/Default PFP.png';
            
            item.innerHTML = `
                <img src="${userPicUrl}" alt="${user.username}" onerror="this.src='/pictures/Default PFP.png'">
                <div class="follower-item-info">
                    <div class="follower-item-name">${user.username}</div>
                    <div class="follower-item-username">${user.description || 'No description'}</div>
                </div>
                ${followButton}
            `;
            
            // Click on item to go to profile
            item.addEventListener('click', (e) => {
                if (!e.target.classList.contains('follower-item-btn')) {
                    window.location.href = `/HTML code/profile.html?user=${user.username}`;
                }
            });
            
            // Follow/Unfollow button
            const btn = item.querySelector('.follower-item-btn');
            if (btn) {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const username = btn.dataset.username;
                    const isCurrentlyFollowing = btn.classList.contains('following');
                    
                    try {
                        if (isCurrentlyFollowing) {
                            await fetchWithAuth(`/api/unfollow/${username}`, { method: 'POST' });
                            btn.textContent = 'Follow';
                            btn.classList.remove('following');
                            btn.classList.add('follow');
                        } else {
                            await fetchWithAuth(`/api/follow/${username}`, { method: 'POST' });
                            btn.textContent = 'Following';
                            btn.classList.remove('follow');
                            btn.classList.add('following');
                        }
                    } catch (error) {
                        console.error('Failed to toggle follow:', error);
                        alert('Failed to update follow status');
                    }
                });
            }
            
            followersList.appendChild(item);
        }
    } catch (error) {
        console.error('Failed to load followers list:', error);
        followersList.innerHTML = '<p style="text-align: center; padding: 40px; color: red;">Failed to load list</p>';
    }
}


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
