// Forgot Password Flow
let currentStep = 1;
let userData = null;
let verificationCode = null;

// Step 1: Search for account
document.getElementById('searchBtn').addEventListener('click', async () => {
    const searchInput = document.getElementById('searchInput').value.trim();
    const errorMsg = document.getElementById('errorMessage');
    
    if (!searchInput) {
        showError(errorMsg, 'Please enter your email or username');
        return;
    }
    
    try {
        // Try to find account by email or username
        const response = await fetch('/api/find-account', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ search: searchInput })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            userData = data;
            showStep(2);
            displayAccountInfo();
        } else {
            showError(errorMsg, data.message || 'Account not found');
        }
    } catch (error) {
        showError(errorMsg, 'Could not connect to server. Please try again.');
    }
});

// Step 2: Choose reset method and send code
document.getElementById('continueBtn').addEventListener('click', async () => {
    const errorMsg = document.getElementById('step2Error');
    
    try {
        const response = await fetch('/api/send-reset-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                email: userData.email,
                username: userData.username 
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showStep(3);
            setupCodeInputs();
        } else {
            showError(errorMsg, data.message || 'Failed to send code');
        }
    } catch (error) {
        showError(errorMsg, 'Could not send code. Please try again.');
    }
});

// Back button
document.getElementById('backBtn').addEventListener('click', () => {
    showStep(1);
});

// Step 3: Verify code
document.getElementById('verifyBtn').addEventListener('click', () => {
    const code = getEnteredCode();
    const errorMsg = document.getElementById('step3Error');
    
    if (code.length !== 6) {
        showError(errorMsg, 'Please enter the 6-digit code');
        return;
    }
    
    // Store code and proceed — server will verify on final reset
    verificationCode = code;
    showStep(4);
    setupPasswordToggles();
});

// Resend code
document.getElementById('resendCode').addEventListener('click', async (e) => {
    e.preventDefault();
    
    try {
        const response = await fetch('/api/send-reset-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                email: userData.email,
                username: userData.username 
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert('New code sent to your email!');
        }
    } catch (error) {
        alert('Failed to resend code. Please try again.');
    }
});

// Step 4: Reset password
document.getElementById('resetBtn').addEventListener('click', async () => {
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const errorMsg = document.getElementById('step4Error');
    
    if (!newPassword || !confirmPassword) {
        showError(errorMsg, 'Please fill in both fields');
        return;
    }
    
    if (newPassword.length < 6) {
        showError(errorMsg, 'Password must be at least 6 characters');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showError(errorMsg, 'Passwords do not match');
        return;
    }
    
    try {
        const response = await fetch('/api/reset-password-verified', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                username: userData.username,
                email: userData.email,
                new_password: newPassword,
                code: verificationCode
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showStep(5);
        } else {
            showError(errorMsg, data.message || 'Failed to reset password');
        }
    } catch (error) {
        showError(errorMsg, 'Could not reset password. Please try again.');
    }
});

// Helper functions
function showStep(step) {
    document.querySelectorAll('.step').forEach(s => s.style.display = 'none');
    document.getElementById(`step${step}`).style.display = 'block';
    currentStep = step;
}

function showError(element, message) {
    element.textContent = message;
    element.classList.add('show');
    setTimeout(() => element.classList.remove('show'), 5000);
}

function displayAccountInfo() {
    document.getElementById('accountUsername').textContent = userData.username;
    document.getElementById('accountEmail').textContent = userData.email;
    document.getElementById('accountPic').src = userData.profile_pic || '/pictures/Default PFP.png';
    
    // Mask email
    const email = userData.email;
    const [name, domain] = email.split('@');
    const maskedName = name[0] + '*'.repeat(name.length - 2) + name[name.length - 1];
    document.getElementById('maskedEmail').textContent = `${maskedName}@${domain}`;
}

function setupCodeInputs() {
    const inputs = document.querySelectorAll('.code-input');
    
    inputs.forEach((input, index) => {
        input.addEventListener('input', (e) => {
            if (e.target.value.length === 1 && index < inputs.length - 1) {
                inputs[index + 1].focus();
            }
        });
        
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                inputs[index - 1].focus();
            }
        });
        
        // Only allow numbers
        input.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '');
        });
    });
    
    inputs[0].focus();
}

function getEnteredCode() {
    let code = '';
    for (let i = 1; i <= 6; i++) {
        code += document.getElementById(`code${i}`).value;
    }
    return code;
}

function clearCodeInputs() {
    for (let i = 1; i <= 6; i++) {
        document.getElementById(`code${i}`).value = '';
    }
    document.getElementById('code1').focus();
}

function setupPasswordToggles() {
    // Toggle new password
    document.getElementById('toggleNew').addEventListener('click', function() {
        const input = document.getElementById('newPassword');
        const svg = this.querySelector('svg');
        togglePasswordVisibility(input, svg);
    });
    
    // Toggle confirm password
    document.getElementById('toggleConfirm').addEventListener('click', function() {
        const input = document.getElementById('confirmPassword');
        const svg = this.querySelector('svg');
        togglePasswordVisibility(input, svg);
    });
}

function togglePasswordVisibility(input, svg) {
    if (input.type === 'password') {
        input.type = 'text';
        svg.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
    } else {
        input.type = 'password';
        svg.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
    }
}

// Allow Enter key to proceed
document.getElementById('searchInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('searchBtn').click();
});
