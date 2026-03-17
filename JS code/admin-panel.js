// Admin Panel JavaScript

// Authentication
const TOKEN_KEY = 'authToken';

function getToken() {
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
}

function removeToken() {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
}

// Check if user is admin/moderator
async function checkAdminAccess() {
    const token = getToken();
    if (!token) {
        window.location.href = '/HTML code/log-in.html';
        return false;
    }

    try {
        const response = await fetch('/api/profile', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Unauthorized');
        }

        const user = await response.json();
        
        if (user.role !== 'admin' && user.role !== 'moderator') {
            alert('Access denied. Admin or moderator privileges required.');
            window.location.href = '/HTML code/home-page.html';
            return false;
        }

        document.getElementById('admin-username').textContent = user.username;
        return true;
    } catch (error) {
        console.error('Access check failed:', error);
        window.location.href = '/HTML code/log-in.html';
        return false;
    }
}

// API Helper
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

    if (response.status === 401 || response.status === 403) {
        alert('Access denied or session expired');
        window.location.href = '/HTML code/log-in.html';
        throw new Error('Unauthorized');
    }
    
    const data = await response.json();
    
    if (!response.ok) {
        throw new Error(data.message || 'API request failed');
    }
    
    return data;
}

// Navigation
function showSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Remove active class from nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Show selected section
    document.getElementById(`${sectionName}-section`).classList.add('active');
    
    // Add active class to nav item
    document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');
    
    // Update page title
    const titles = {
        dashboard: 'Dashboard',
        users: 'User Management',
        posts: 'Post Management',
        reports: 'Reports',
        moderation: 'Moderation Log'
    };
    document.getElementById('page-title').textContent = titles[sectionName];
    
    // Load section data
    switch (sectionName) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'users':
            loadUsers();
            break;
        case 'posts':
            loadPosts();
            break;
        case 'reports':
            loadReports();
            break;
        case 'moderation':
            loadModerationLog();
            break;
    }
}

// Dashboard
async function loadDashboard() {
    try {
        const data = await fetchWithAuth('/api/admin/dashboard');
        
        // Update stats
        document.getElementById('total-users').textContent = data.stats.total_users;
        document.getElementById('active-users').textContent = data.stats.active_users;
        document.getElementById('banned-users').textContent = data.stats.banned_users;
        document.getElementById('total-posts').textContent = data.stats.total_posts;
        document.getElementById('posts-today').textContent = data.stats.posts_today;
        document.getElementById('pending-reports').textContent = data.stats.pending_reports;
        
        // Load recent users
        const recentUsersContainer = document.getElementById('recent-users');
        recentUsersContainer.innerHTML = '';
        
        if (data.recent_users.length === 0) {
            recentUsersContainer.innerHTML = '<div class="empty-state">No recent users</div>';
        } else {
            data.recent_users.forEach(user => {
                const userElement = document.createElement('div');
                userElement.className = 'recent-item';
                userElement.innerHTML = `
                    <div class="recent-item-info">
                        <div class="recent-item-title">${user.username}</div>
                        <div class="recent-item-meta">Joined ${new Date(user.reg_date).toLocaleDateString()}</div>
                    </div>
                    <span class="recent-item-status status-${user.status}">${user.status}</span>
                `;
                recentUsersContainer.appendChild(userElement);
            });
        }
        
        // Load recent reports
        const recentReportsContainer = document.getElementById('recent-reports');
        recentReportsContainer.innerHTML = '';
        
        if (data.recent_reports.length === 0) {
            recentReportsContainer.innerHTML = '<div class="empty-state">No pending reports</div>';
        } else {
            data.recent_reports.forEach(report => {
                const reportElement = document.createElement('div');
                reportElement.className = 'recent-item';
                reportElement.innerHTML = `
                    <div class="recent-item-info">
                        <div class="recent-item-title">${report.reason}</div>
                        <div class="recent-item-meta">${report.reporter} → ${report.reported_user}</div>
                    </div>
                    <span class="recent-item-status status-${report.status}">${report.status}</span>
                `;
                recentReportsContainer.appendChild(reportElement);
            });
        }
        
    } catch (error) {
        console.error('Failed to load dashboard:', error);
        alert('Failed to load dashboard data');
    }
}

// Users Management
let currentUsersPage = 1;
let usersSearchTimeout;

async function loadUsers(page = 1, search = '', status = '') {
    try {
        currentUsersPage = page;
        const params = new URLSearchParams({
            page: page,
            limit: 20,
            search: search,
            status: status
        });
        
        const data = await fetchWithAuth(`/api/admin/users?${params}`);
        
        const tbody = document.getElementById('users-table-body');
        tbody.innerHTML = '';
        
        if (data.users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No users found</td></tr>';
        } else {
            data.users.forEach(user => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>
                        <div class="user-info-cell">
                            <img src="${user.profile_pic || '/pictures/Default PFP.png'}" alt="${user.username}" class="user-avatar" onerror="this.src='/pictures/Default PFP.png'">
                            <div class="user-details">
                                <h4>${user.username}</h4>
                                <p>ID: ${user.id}</p>
                            </div>
                        </div>
                    </td>
                    <td>${user.email}</td>
                    <td><span class="role-badge role-${user.role}">${user.role}</span></td>
                    <td>
                        <span class="recent-item-status status-${user.status}">${user.status}</span>
                        ${user.banned_until ? `<br><small>Until: ${new Date(user.banned_until).toLocaleString()}</small>` : ''}
                    </td>
                    <td>${new Date(user.reg_date).toLocaleDateString()}</td>
                    <td>
                        <div class="action-buttons">
                            ${user.status === 'banned' ? 
                                `<button class="btn btn-sm btn-success" onclick="unbanUser(${user.id})">Unban</button>` :
                                `<button class="btn btn-sm btn-danger" onclick="banUser(${user.id}, '${user.username}')">Ban</button>`
                            }
                            <button class="btn btn-sm btn-warning" onclick="warnUser(${user.id}, '${user.username}')">Warn</button>
                            ${user.role !== 'admin' ? 
                                `<button class="btn btn-sm btn-primary" onclick="promoteUser(${user.id}, '${user.username}', '${user.role}')">Promote</button>` : 
                                ''
                            }
                        </div>
                    </td>
                `;
                tbody.appendChild(row);
            });
        }
        
        // Update pagination
        updatePagination('users', data.page, Math.ceil(data.total / 20));
        
    } catch (error) {
        console.error('Failed to load users:', error);
        alert('Failed to load users');
    }
}

// Posts Management
let currentPostsPage = 1;
let postsSearchTimeout;

async function loadPosts(page = 1, search = '') {
    try {
        currentPostsPage = page;
        const params = new URLSearchParams({
            page: page,
            limit: 20,
            search: search
        });
        
        const data = await fetchWithAuth(`/api/admin/posts?${params}`);
        
        const tbody = document.getElementById('posts-table-body');
        tbody.innerHTML = '';
        
        if (data.posts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">No posts found</td></tr>';
        } else {
            data.posts.forEach(post => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>
                        <div class="user-details">
                            <h4>${post.title}</h4>
                            <p>${post.description.substring(0, 100)}${post.description.length > 100 ? '...' : ''}</p>
                        </div>
                    </td>
                    <td>
                        <div class="user-info-cell">
                            <img src="${post.author_profile_pic || '/pictures/Default PFP.png'}" alt="${post.username}" class="user-avatar" onerror="this.src='/pictures/Default PFP.png'">
                            <div class="user-details">
                                <h4>${post.username}</h4>
                            </div>
                        </div>
                    </td>
                    <td>${post.price || 'N/A'}</td>
                    <td>${new Date(post.post_date).toLocaleDateString()}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn-sm btn-danger" onclick="deletePost(${post.id}, '${post.title}')">Delete</button>
                        </div>
                    </td>
                `;
                tbody.appendChild(row);
            });
        }
        
        // Update pagination
        updatePagination('posts', data.page, Math.ceil(data.total / 20));
        
    } catch (error) {
        console.error('Failed to load posts:', error);
        alert('Failed to load posts');
    }
}

// Reports Management
async function loadReports(status = 'pending') {
    try {
        const params = new URLSearchParams({ status: status });
        const data = await fetchWithAuth(`/api/admin/reports?${params}`);
        
        const container = document.getElementById('reports-container');
        container.innerHTML = '';
        
        if (data.reports.length === 0) {
            container.innerHTML = '<div class="empty-state"><h3>No reports found</h3><p>No reports with the selected status</p></div>';
        } else {
            data.reports.forEach(report => {
                const reportCard = document.createElement('div');
                reportCard.className = 'report-card';
                reportCard.innerHTML = `
                    <div class="report-header">
                        <div class="report-info">
                            <h4>Report #${report.id}</h4>
                            <p><strong>Reporter:</strong> ${report.reporter_username}</p>
                            <p><strong>Reported User:</strong> ${report.reported_username}</p>
                            ${report.post_title ? `<p><strong>Post:</strong> ${report.post_title}</p>` : ''}
                        </div>
                        <div class="report-meta">
                            <p>${new Date(report.created_date).toLocaleString()}</p>
                            <span class="recent-item-status status-${report.status}">${report.status}</span>
                        </div>
                    </div>
                    <div class="report-content">
                        <div class="report-reason">Reason: ${report.reason}</div>
                        <div class="report-description">${report.description || 'No additional details provided'}</div>
                    </div>
                    ${report.status === 'pending' ? `
                        <div class="report-actions">
                            <button class="btn btn-primary" onclick="openReportModal(${report.id})">Resolve</button>
                        </div>
                    ` : ''}
                `;
                container.appendChild(reportCard);
            });
        }
        
    } catch (error) {
        console.error('Failed to load reports:', error);
        alert('Failed to load reports');
    }
}

// Moderation Actions
async function banUser(userId, username) {
    const reason = prompt(`Enter reason for banning ${username}:`);
    if (!reason) return;
    
    const duration = prompt('Enter ban duration in hours (leave empty for permanent ban):');
    const durationHours = duration ? parseInt(duration) : null;
    
    if (duration && isNaN(durationHours)) {
        alert('Invalid duration. Please enter a number.');
        return;
    }
    
    try {
        await fetchWithAuth(`/api/admin/users/${userId}/ban`, {
            method: 'POST',
            body: JSON.stringify({
                reason: reason,
                duration_hours: durationHours
            })
        });
        
        alert('User banned successfully');
        loadUsers(currentUsersPage);
    } catch (error) {
        console.error('Failed to ban user:', error);
        alert('Failed to ban user: ' + error.message);
    }
}

async function unbanUser(userId) {
    if (!confirm('Are you sure you want to unban this user?')) return;
    
    try {
        await fetchWithAuth(`/api/admin/users/${userId}/unban`, {
            method: 'POST'
        });
        
        alert('User unbanned successfully');
        loadUsers(currentUsersPage);
    } catch (error) {
        console.error('Failed to unban user:', error);
        alert('Failed to unban user: ' + error.message);
    }
}

async function warnUser(userId, username) {
    const reason = prompt(`Enter warning reason for ${username}:`);
    if (!reason) return;
    
    const message = prompt('Enter additional message (optional):') || '';
    
    try {
        await fetchWithAuth(`/api/admin/users/${userId}/warn`, {
            method: 'POST',
            body: JSON.stringify({
                reason: reason,
                message: message
            })
        });
        
        alert('Warning issued successfully');
    } catch (error) {
        console.error('Failed to warn user:', error);
        alert('Failed to warn user: ' + error.message);
    }
}

async function promoteUser(userId, username, currentRole) {
    const newRole = prompt(`Enter new role for ${username} (user/moderator/admin):`, currentRole === 'user' ? 'moderator' : 'user');
    if (!newRole || !['user', 'moderator', 'admin'].includes(newRole)) {
        alert('Invalid role. Please enter: user, moderator, or admin');
        return;
    }
    
    if (!confirm(`Are you sure you want to change ${username}'s role to ${newRole}?`)) return;
    
    try {
        await fetchWithAuth(`/api/admin/users/${userId}/promote`, {
            method: 'POST',
            body: JSON.stringify({
                role: newRole
            })
        });
        
        alert('User role updated successfully');
        loadUsers(currentUsersPage);
    } catch (error) {
        console.error('Failed to update user role:', error);
        alert('Failed to update user role: ' + error.message);
    }
}

async function deletePost(postId, title) {
    const reason = prompt(`Enter reason for deleting post "${title}":`);
    if (!reason) return;
    
    if (!confirm(`Are you sure you want to delete the post "${title}"?`)) return;
    
    try {
        await fetchWithAuth(`/api/admin/posts/${postId}/delete`, {
            method: 'DELETE',
            body: JSON.stringify({
                reason: reason
            })
        });
        
        alert('Post deleted successfully');
        loadPosts(currentPostsPage);
    } catch (error) {
        console.error('Failed to delete post:', error);
        alert('Failed to delete post: ' + error.message);
    }
}

// Report Resolution
let currentReportId = null;

function openReportModal(reportId) {
    currentReportId = reportId;
    document.getElementById('report-modal').style.display = 'block';
}

async function resolveReport() {
    if (!currentReportId) return;
    
    const action = document.getElementById('report-action').value;
    const banDuration = document.getElementById('ban-duration').value;
    
    try {
        const body = { action: action };
        if (action === 'ban' && banDuration) {
            body.ban_duration_hours = parseInt(banDuration);
        }
        
        await fetchWithAuth(`/api/admin/reports/${currentReportId}/resolve`, {
            method: 'POST',
            body: JSON.stringify(body)
        });
        
        alert('Report resolved successfully');
        closeModal('report-modal');
        loadReports(document.getElementById('report-status-filter').value);
    } catch (error) {
        console.error('Failed to resolve report:', error);
        alert('Failed to resolve report: ' + error.message);
    }
}

// Moderation Log
async function loadModerationLog() {
    // This would load moderation actions log
    // For now, show a placeholder
    document.getElementById('moderation-log').innerHTML = `
        <div class="empty-state">
            <h3>Moderation Log</h3>
            <p>This feature will show all moderation actions taken by admins and moderators.</p>
        </div>
    `;
}

// Utility Functions
function updatePagination(type, currentPage, totalPages) {
    const container = document.getElementById(`${type}-pagination`);
    container.innerHTML = '';
    
    if (totalPages <= 1) return;
    
    // Previous button
    const prevBtn = document.createElement('button');
    prevBtn.textContent = '← Previous';
    prevBtn.disabled = currentPage === 1;
    prevBtn.onclick = () => {
        if (type === 'users') {
            loadUsers(currentPage - 1, document.getElementById('user-search').value, document.getElementById('user-status-filter').value);
        } else if (type === 'posts') {
            loadPosts(currentPage - 1, document.getElementById('post-search').value);
        }
    };
    container.appendChild(prevBtn);
    
    // Page numbers
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);
    
    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.textContent = i;
        pageBtn.className = i === currentPage ? 'active' : '';
        pageBtn.onclick = () => {
            if (type === 'users') {
                loadUsers(i, document.getElementById('user-search').value, document.getElementById('user-status-filter').value);
            } else if (type === 'posts') {
                loadPosts(i, document.getElementById('post-search').value);
            }
        };
        container.appendChild(pageBtn);
    }
    
    // Next button
    const nextBtn = document.createElement('button');
    nextBtn.textContent = 'Next →';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.onclick = () => {
        if (type === 'users') {
            loadUsers(currentPage + 1, document.getElementById('user-search').value, document.getElementById('user-status-filter').value);
        } else if (type === 'posts') {
            loadPosts(currentPage + 1, document.getElementById('post-search').value);
        }
    };
    container.appendChild(nextBtn);
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
    currentReportId = null;
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        removeToken();
        window.location.href = '/HTML code/log-in.html';
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', async function() {
    // Check admin access
    const hasAccess = await checkAdminAccess();
    if (!hasAccess) return;
    
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const section = this.getAttribute('data-section');
            showSection(section);
        });
    });
    
    // Search functionality
    document.getElementById('user-search').addEventListener('input', function() {
        clearTimeout(usersSearchTimeout);
        usersSearchTimeout = setTimeout(() => {
            loadUsers(1, this.value, document.getElementById('user-status-filter').value);
        }, 500);
    });
    
    document.getElementById('user-status-filter').addEventListener('change', function() {
        loadUsers(1, document.getElementById('user-search').value, this.value);
    });
    
    document.getElementById('post-search').addEventListener('input', function() {
        clearTimeout(postsSearchTimeout);
        postsSearchTimeout = setTimeout(() => {
            loadPosts(1, this.value);
        }, 500);
    });
    
    document.getElementById('report-status-filter').addEventListener('change', function() {
        loadReports(this.value);
    });
    
    // Report action change
    document.getElementById('report-action').addEventListener('change', function() {
        const banDurationGroup = document.getElementById('ban-duration-group');
        banDurationGroup.style.display = this.value === 'ban' ? 'block' : 'none';
    });
    
    // Modal close on outside click
    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    });
    
    // Load initial dashboard
    showSection('dashboard');
});