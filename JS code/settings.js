// Image Crop Functionality
let selectedImage = null;
let cropCanvas = null;
let cropCtx = null;
let scale = 1;
let offsetX = 0;
let offsetY = 0;
let isDragging = false;
let startX = 0;
let startY = 0;

// Profile picture input handler
document.getElementById('profilePicInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = function(event) {
            selectedImage = new Image();
            selectedImage.onload = function() {
                openCropModal();
            };
            selectedImage.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }
});

function openCropModal() {
    const modal = document.getElementById('cropModal');
    modal.style.display = 'flex';
    
    cropCanvas = document.getElementById('cropCanvas');
    cropCtx = cropCanvas.getContext('2d');
    
    // Set canvas size
    const containerWidth = 400;
    const containerHeight = 400;
    cropCanvas.width = containerWidth;
    cropCanvas.height = containerHeight;
    
    // Reset values
    scale = 1;
    offsetX = 0;
    offsetY = 0;
    document.getElementById('zoomSlider').value = 1;
    
    drawImage();
    setupCropControls();
}

function drawImage() {
    if (!selectedImage || !cropCtx) return;
    
    cropCtx.clearRect(0, 0, cropCanvas.width, cropCanvas.height);
    
    // Calculate scaled dimensions
    const scaledWidth = selectedImage.width * scale;
    const scaledHeight = selectedImage.height * scale;
    
    // Center the image initially
    const x = (cropCanvas.width - scaledWidth) / 2 + offsetX;
    const y = (cropCanvas.height - scaledHeight) / 2 + offsetY;
    
    // Draw image
    cropCtx.drawImage(selectedImage, x, y, scaledWidth, scaledHeight);
    
    // Draw circular crop overlay
    cropCtx.save();
    cropCtx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    cropCtx.fillRect(0, 0, cropCanvas.width, cropCanvas.height);
    
    const centerX = cropCanvas.width / 2;
    const centerY = cropCanvas.height / 2;
    const radius = Math.min(cropCanvas.width, cropCanvas.height) / 2 - 20;
    
    cropCtx.globalCompositeOperation = 'destination-out';
    cropCtx.beginPath();
    cropCtx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    cropCtx.fill();
    
    cropCtx.globalCompositeOperation = 'source-over';
    cropCtx.strokeStyle = '#fff';
    cropCtx.lineWidth = 2;
    cropCtx.beginPath();
    cropCtx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    cropCtx.stroke();
    cropCtx.restore();
}

function setupCropControls() {
    // Zoom slider
    document.getElementById('zoomSlider').addEventListener('input', function(e) {
        scale = parseFloat(e.target.value);
        drawImage();
    });
    
    // Mouse drag
    cropCanvas.addEventListener('mousedown', function(e) {
        isDragging = true;
        startX = e.offsetX - offsetX;
        startY = e.offsetY - offsetY;
    });
    
    cropCanvas.addEventListener('mousemove', function(e) {
        if (isDragging) {
            offsetX = e.offsetX - startX;
            offsetY = e.offsetY - startY;
            drawImage();
        }
    });
    
    cropCanvas.addEventListener('mouseup', function() {
        isDragging = false;
    });
    
    cropCanvas.addEventListener('mouseleave', function() {
        isDragging = false;
    });
    
    // Touch support
    cropCanvas.addEventListener('touchstart', function(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = cropCanvas.getBoundingClientRect();
        isDragging = true;
        startX = touch.clientX - rect.left - offsetX;
        startY = touch.clientY - rect.top - offsetY;
    });
    
    cropCanvas.addEventListener('touchmove', function(e) {
        e.preventDefault();
        if (isDragging) {
            const touch = e.touches[0];
            const rect = cropCanvas.getBoundingClientRect();
            offsetX = touch.clientX - rect.left - startX;
            offsetY = touch.clientY - rect.top - startY;
            drawImage();
        }
    });
    
    cropCanvas.addEventListener('touchend', function() {
        isDragging = false;
    });
}

// Confirm crop
document.getElementById('confirmCrop').addEventListener('click', function() {
    if (!selectedImage) return;
    
    // Create a new canvas for the cropped circular image
    const outputCanvas = document.createElement('canvas');
    const outputCtx = outputCanvas.getContext('2d');
    const size = 300; // Output size
    outputCanvas.width = size;
    outputCanvas.height = size;
    
    // Calculate crop area
    const centerX = cropCanvas.width / 2;
    const centerY = cropCanvas.height / 2;
    const radius = Math.min(cropCanvas.width, cropCanvas.height) / 2 - 20;
    
    // Calculate source coordinates
    const scaledWidth = selectedImage.width * scale;
    const scaledHeight = selectedImage.height * scale;
    const imgX = (cropCanvas.width - scaledWidth) / 2 + offsetX;
    const imgY = (cropCanvas.height - scaledHeight) / 2 + offsetY;
    
    // Draw circular clipped image
    outputCtx.save();
    outputCtx.beginPath();
    outputCtx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    outputCtx.closePath();
    outputCtx.clip();
    
    // Calculate scaling for output
    const scaleRatio = size / (radius * 2);
    const outputScaledWidth = scaledWidth * scaleRatio;
    const outputScaledHeight = scaledHeight * scaleRatio;
    const outputX = (size / 2) - (centerX - imgX) * scaleRatio;
    const outputY = (size / 2) - (centerY - imgY) * scaleRatio;
    
    outputCtx.drawImage(selectedImage, outputX, outputY, outputScaledWidth, outputScaledHeight);
    outputCtx.restore();
    
    // Convert to blob and update preview
    outputCanvas.toBlob(function(blob) {
        const url = URL.createObjectURL(blob);
        document.getElementById('profilePreview').src = url;
        
        // Store the blob for upload
        window.croppedProfileBlob = blob;
        
        closeCropModal();
    }, 'image/png');
});

// Cancel crop
document.getElementById('cancelCrop').addEventListener('click', function() {
    closeCropModal();
    document.getElementById('profilePicInput').value = '';
});

function closeCropModal() {
    document.getElementById('cropModal').style.display = 'none';
    selectedImage = null;
    cropCanvas = null;
    cropCtx = null;
}


// Load user settings on page load
async function loadSettings() {
    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    if (!token) {
        window.location.href = '/HTML code/log-in.html';
        return;
    }

    try {
        const response = await fetch('/api/profile', {
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });

        if (response.ok) {
            const data = await response.json();
            document.getElementById('usernameInput').value = data.username || '';
            document.getElementById('emailInput').value = data.email || '';
            document.getElementById('phoneInput').value = data.phone || '';
            document.getElementById('descriptionInput').value = data.description || '';
            document.getElementById('regDate').value = data.registration_date || '';
            document.getElementById('passwordInput').value = '••••••••';
            
            if (data.profile_picture && data.profile_picture !== 'null' && data.profile_picture !== '') {
                document.getElementById('profilePreview').src = data.profile_picture;
            } else {
                document.getElementById('profilePreview').src = '/pictures/Default PFP.png';
            }
        } else {
            alert('Failed to load settings');
        }
    } catch (error) {
        console.error('Error loading settings:', error);
        alert('Could not load settings');
    }
}

// Save settings
document.getElementById('saveSettings').addEventListener('click', async function() {
    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    if (!token) {
        alert('You must be logged in to save settings');
        return;
    }

    const username = document.getElementById('usernameInput').value.trim();
    const email = document.getElementById('emailInput').value.trim();
    const phone = document.getElementById('phoneInput').value.trim();
    const description = document.getElementById('descriptionInput').value.trim();

    if (!username || !email) {
        alert('Username and email are required');
        return;
    }

    const formData = new FormData();
    formData.append('username', username);
    formData.append('email', email);
    formData.append('phone', phone);
    formData.append('description', description);

    // Add cropped profile picture if available
    if (window.croppedProfileBlob) {
        formData.append('profile_picture', window.croppedProfileBlob, 'profile.png');
    }

    try {
        console.log('Saving settings...', { username, email, phone, description, hasProfilePic: !!window.croppedProfileBlob });
        
        const response = await fetch('/api/update-profile', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token
            },
            body: formData
        });

        const data = await response.json();
        console.log('Save response:', data);

        if (response.ok) {
            alert('Settings saved successfully!');
            window.croppedProfileBlob = null; // Clear the blob after upload
            // Reload settings to show updated data
            await loadSettings();
        } else {
            alert(data.message || 'Failed to save settings');
        }
    } catch (error) {
        console.error('Error saving settings:', error);
        alert('Could not save settings. Please try again.');
    }
});

// Password toggle functionality
document.getElementById('togglePassword').addEventListener('click', function() {
    const passwordInput = document.getElementById('passwordInput');
    const svg = this.querySelector('svg');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        svg.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
    } else {
        passwordInput.type = 'password';
        svg.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
    }
});

// Change password modal
document.getElementById('changePasswordLink').addEventListener('click', function(e) {
    e.preventDefault();
    document.getElementById('changePasswordModal').style.display = 'flex';
});

document.getElementById('cancelChangePassword').addEventListener('click', function() {
    document.getElementById('changePasswordModal').style.display = 'none';
    document.getElementById('currentPasswordModal').value = '';
    document.getElementById('newPasswordModal').value = '';
});

document.getElementById('toggleCurrentPasswordModal').addEventListener('click', function() {
    const passwordInput = document.getElementById('currentPasswordModal');
    const svg = this.querySelector('svg');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        svg.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
    } else {
        passwordInput.type = 'password';
        svg.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
    }
});

document.getElementById('toggleNewPasswordModal').addEventListener('click', function() {
    const passwordInput = document.getElementById('newPasswordModal');
    const svg = this.querySelector('svg');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        svg.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
    } else {
        passwordInput.type = 'password';
        svg.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
    }
});

document.getElementById('confirmChangePassword').addEventListener('click', async function() {
    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    const currentPassword = document.getElementById('currentPasswordModal').value.trim();
    const newPassword = document.getElementById('newPasswordModal').value.trim();

    if (!currentPassword || !newPassword) {
        alert('Please fill in all fields');
        return;
    }

    if (newPassword.length < 6) {
        alert('New password must be at least 6 characters');
        return;
    }

    try {
        const response = await fetch('/api/change-password', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                current_password: currentPassword,
                new_password: newPassword
            })
        });

        const data = await response.json();

        if (response.ok) {
            alert('Password changed successfully!');
            document.getElementById('changePasswordModal').style.display = 'none';
            document.getElementById('currentPasswordModal').value = '';
            document.getElementById('newPasswordModal').value = '';
        } else {
            alert(data.message || 'Failed to change password');
        }
    } catch (error) {
        console.error('Error changing password:', error);
        alert('Could not change password. Please try again.');
    }
});

// Load settings when page loads
loadSettings();
