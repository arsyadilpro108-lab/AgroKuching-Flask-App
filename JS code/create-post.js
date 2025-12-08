// Check authentication
const TOKEN_KEY = 'authToken';

function getToken() {
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
}

function removeToken() {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
}

// Redirect if not logged in
if (!getToken()) {
    window.location.replace('/HTML code/log-in.html');
}

// Helper to convert file to Base64
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

// Image preview
const postImagesInput = document.getElementById("postImages");
const imagePreview = document.getElementById("imagePreview");

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

// Form submission
const postForm = document.getElementById("postForm");
const submitBtn = postForm.querySelector('.submit-btn');

postForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    // Disable button to prevent double submission
    submitBtn.disabled = true;
    submitBtn.textContent = 'Posting...';
    
    const imagesBase64 = [];
    const files = postImagesInput.files;

    // Convert all files to Base64
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
        const token = getToken();
        const response = await fetch('/api/posts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(postData)
        });

        if (response.status === 401) {
            removeToken();
            alert('Your session has expired. Please log in again.');
            window.location.href = '/HTML code/log-in.html';
            return;
        }

        const data = await response.json();

        if (response.ok) {
            // Success - redirect to home page
            window.location.href = '/HTML code/home-page.html';
        } else {
            alert('Error: ' + data.message);
            submitBtn.disabled = false;
            submitBtn.textContent = 'Post';
        }

    } catch (error) {
        console.error("Failed to create post:", error);
        alert('Could not connect to the server. Please try again.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Post';
    }
});


// --- Message Notification Badge ---
async function updateMessageBadge() {
    try {
        const token = getToken();
        const response = await fetch('/api/conversations', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const conversations = await response.json();
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
