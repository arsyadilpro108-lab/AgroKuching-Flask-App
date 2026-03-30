// AgroKuching Admin Panel
const TOKEN_KEY = 'authToken'; // must match the key used by login/home-page
const token = () => localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || '';
const authHeader = () => ({ 'Authorization': 'Bearer ' + token(), 'Content-Type': 'application/json' });

async function api(method, url, body) {
    try {
        const opts = { method, headers: authHeader() };
        if (body) opts.body = JSON.stringify(body);
        const r = await fetch(url, opts);
        return await r.json();
    } catch (e) {
        return { error: e.message };
    }
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    if (!token()) {
        window.location.href = '/HTML code/log-in.html';
        return;
    }

    const check = await api('GET', '/api/admin/check');
    if (!check || !check.is_admin) {
        document.getElementById('authLoaderMsg').textContent = 'Access denied. Redirecting...';
        setTimeout(() => { window.location.href = '/HTML code/home-page.html'; }, 1000);
        return;
    }

    // Auth passed — hide loader and show page
    document.getElementById('authLoader').style.display = 'none';
    document.getElementById('adminUsername').textContent = check.username;

    loadStats();

    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.addEventListener('click', e => {
            e.preventDefault();
            showSection(item.dataset.section);
        });
    });

    const toggle = document.getElementById('profileToggle');
    const menu = document.getElementById('profileDropdown');
    toggle.addEventListener('click', e => { e.stopPropagation(); menu.classList.toggle('show'); });
    document.addEventListener('click', () => menu.classList.remove('show'));

    document.getElementById('logoutBtn').addEventListener('click', e => {
        e.preventDefault();
        localStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(TOKEN_KEY);
        window.location.href = '/HTML code/log-in.html';
    });

    document.getElementById('banConfirmBtn').addEventListener('click', confirmBan);
    document.getElementById('roleConfirmBtn').addEventListener('click', confirmRole);
    document.getElementById('userSearch').addEventListener('input', filterUsers);
    document.getElementById('userStatusFilter').addEventListener('change', filterUsers);
});

// ── Section Navigation ────────────────────────────────────────────────────────
const sectionLoaders = { users: loadUsers, posts: loadPosts, reports: loadReports, banned: loadBanned };

function showSection(name) {
    document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    const link = document.querySelector(`.sidebar-item[data-section="${name}"]`);
    const section = document.getElementById(`${name}-section`);
    if (link) link.classList.add('active');
    if (section) section.classList.add('active');
    if (sectionLoaders[name]) sectionLoaders[name]();
}

// ── Stats (dashboard only) ────────────────────────────────────────────────────
async function loadStats() {
    const data = await api('GET', '/api/admin/stats');
    if (!data || data.error) return;
    setText('totalUsers', data.total_users ?? '—');
    setText('totalPosts', data.total_posts ?? '—');
    setText('totalMessages', data.total_messages ?? '—');
    setText('pendingReports', data.pending_reports ?? '—');
    setText('usersCount', data.total_users ?? '—');
    setText('postsCount', data.total_posts ?? '—');
    const rc = document.getElementById('reportsCount');
    if (rc) rc.textContent = data.pending_reports ?? '—';
}

// ── Users ─────────────────────────────────────────────────────────────────────
let cachedUsers = null;

async function loadUsers() {
    if (!cachedUsers) {
        setTableLoading('usersTableBody', 6);
        cachedUsers = await api('GET', '/api/admin/users') || [];
    }
    filterUsers();
}

function filterUsers() {
    if (!cachedUsers) return;
    const q = document.getElementById('userSearch').value.toLowerCase();
    const status = document.getElementById('userStatusFilter').value;
    const filtered = cachedUsers.filter(u =>
        (!q || u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) &&
        (!status || (u.status || 'active') === status)
    );
    renderUsers(filtered);
}

function renderUsers(users) {
    const tbody = document.getElementById('usersTableBody');
    if (!users.length) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:#888">No users found</td></tr>'; return; }
    tbody.innerHTML = users.map(u => `
        <tr>
            <td><div class="user-info">
                <img src="${u.profile_pic || '/pictures/Default PFP.png'}" class="user-avatar" onerror="this.src='/pictures/Default PFP.png'">
                <strong>${esc(u.username)}</strong>
            </div></td>
            <td>${esc(u.email)}</td>
            <td><span class="status-badge ${u.role || 'user'}">${u.role || 'user'}</span></td>
            <td><span class="status-badge ${u.status || 'active'}">${u.status || 'active'}</span></td>
            <td>${fmtDate(u.reg_date)}</td>
            <td><div class="action-buttons">
                <button class="btn-icon" style="background:rgba(243,156,18,.1);color:#f39c12" title="Change Role" onclick="openRoleModal(${u.id},'${u.role || 'user'}','${esc(u.username)}')"><i class="fas fa-user-shield"></i></button>
                ${(u.status === 'banned')
                    ? `<button class="btn-icon" style="background:rgba(66,184,131,.1);color:#42b883" title="Unban" onclick="unbanUser(${u.id},'${esc(u.username)}')"><i class="fas fa-user-check"></i></button>`
                    : `<button class="btn-icon delete" title="Ban" onclick="openBanModal(${u.id},'${esc(u.username)}')"><i class="fas fa-ban"></i></button>`}
            </div></td>
        </tr>`).join('');
}

// ── Posts ─────────────────────────────────────────────────────────────────────
let cachedPosts = null;

async function loadPosts() {
    if (!cachedPosts) {
        document.getElementById('postsGrid').innerHTML = '<div class="loading"><div class="spinner"></div> Loading...</div>';
        cachedPosts = await api('GET', '/api/admin/posts') || [];
    }
    renderPosts(cachedPosts);
}

function renderPosts(posts) {
    const grid = document.getElementById('postsGrid');
    if (!posts.length) { grid.innerHTML = '<div style="padding:40px;text-align:center;color:#888">No posts found</div>'; return; }
    grid.innerHTML = posts.map(p => {
        const img = p.images && p.images.length ? `<img src="${p.images[0]}" class="post-image" loading="lazy" onerror="this.style.display='none'">` : '';
        return `<div class="post-card">
            ${img}
            <div class="post-content">
                <div class="post-title">${esc(p.title || 'Untitled')}</div>
                <div class="post-meta"><span>by ${esc(p.author_username)}</span><span>${fmtDate(p.post_date)}</span></div>
                <p style="font-size:13px;color:#606770;margin-bottom:12px">${esc((p.description || '').substring(0, 80))}${(p.description || '').length > 80 ? '...' : ''}</p>
                <button class="btn-danger" style="font-size:12px;padding:6px 12px" onclick="deletePost(${p.id})"><i class="fas fa-trash"></i> Delete</button>
            </div>
        </div>`;
    }).join('');
}

async function deletePost(postId) {
    const reason = prompt('Reason for deletion:');
    if (reason === null) return;
    const res = await api('DELETE', `/api/admin/posts/${postId}`, { reason: reason || 'Deleted by admin' });
    toast(res.message || 'Post deleted');
    cachedPosts = null; // invalidate cache
    loadPosts();
    loadStats();
}

// ── Reports ───────────────────────────────────────────────────────────────────
async function loadReports() {
    setTableLoading('reportsTableBody', 6);
    const reports = await api('GET', '/api/admin/reports') || [];
    const tbody = document.getElementById('reportsTableBody');
    if (!reports.length) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:#888">No reports</td></tr>'; return; }
    const colors = { pending: '#f39c12', resolved: '#42b883', dismissed: '#888' };
    tbody.innerHTML = reports.map(r => `<tr>
        <td>${esc(r.reporter_username)}</td>
        <td>${esc(r.reported_username)}</td>
        <td>${esc(r.reason)}</td>
        <td><span class="status-badge" style="background:${colors[r.status]}22;color:${colors[r.status]}">${r.status}</span></td>
        <td>${fmtDate(r.created_date)}</td>
        <td><div class="action-buttons">
            ${r.status === 'pending' ? `
            <button class="btn-icon edit" title="Resolve" onclick="resolveReport(${r.id},'resolved')"><i class="fas fa-check"></i></button>
            <button class="btn-icon" style="background:#f5f5f5;color:#888" title="Dismiss" onclick="resolveReport(${r.id},'dismissed')"><i class="fas fa-times"></i></button>` : '—'}
        </div></td>
    </tr>`).join('');
}

async function resolveReport(id, action) {
    const res = await api('POST', `/api/admin/reports/${id}/resolve`, { action });
    toast(res.message || `Report ${action}`);
    loadReports();
    loadStats();
}

// ── Banned Users ──────────────────────────────────────────────────────────────
async function loadBanned() {
    setTableLoading('bannedTableBody', 5);
    const users = await api('GET', '/api/admin/users') || [];
    const banned = users.filter(u => u.status === 'banned');
    const tbody = document.getElementById('bannedTableBody');
    if (!banned.length) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:#888">No banned users</td></tr>'; return; }
    tbody.innerHTML = banned.map(u => `<tr>
        <td><div class="user-info">
            <img src="${u.profile_pic || '/pictures/Default PFP.png'}" class="user-avatar" onerror="this.src='/pictures/Default PFP.png'">
            <strong>${esc(u.username)}</strong>
        </div></td>
        <td>${esc(u.email)}</td>
        <td>${fmtDate(u.banned_until)}</td>
        <td>${esc(u.ban_reason || '—')}</td>
        <td><button class="btn-icon" style="background:rgba(66,184,131,.1);color:#42b883" title="Unban" onclick="unbanUser(${u.id},'${esc(u.username)}')"><i class="fas fa-user-check"></i></button></td>
    </tr>`).join('');
}

// ── Ban / Unban ───────────────────────────────────────────────────────────────
function openBanModal(userId, username) {
    document.getElementById('banModalTitle').textContent = `Ban ${username}`;
    document.getElementById('banUserId').value = userId;
    document.getElementById('banReason').value = '';
    document.getElementById('banModal').classList.add('show');
}

async function confirmBan() {
    const userId = document.getElementById('banUserId').value;
    const reason = document.getElementById('banReason').value.trim();
    const days = parseInt(document.getElementById('banDuration').value);
    if (!reason) { alert('Please enter a reason.'); return; }
    const res = await api('POST', `/api/admin/users/${userId}/ban`, { reason, duration_days: days });
    toast(res.message || 'User banned');
    closeModal('banModal');
    cachedUsers = null;
    loadUsers();
}

async function unbanUser(userId, username) {
    if (!confirm(`Unban ${username}?`)) return;
    const res = await api('POST', `/api/admin/users/${userId}/unban`, {});
    toast(res.message || 'User unbanned');
    cachedUsers = null;
    // Reload whichever section is active
    if (document.getElementById('banned-section').classList.contains('active')) loadBanned();
    else loadUsers();
}

// ── Role Change ───────────────────────────────────────────────────────────────
function openRoleModal(userId, currentRole, username) {
    document.getElementById('roleModalTitle').textContent = `Change Role — ${username}`;
    document.getElementById('roleUserId').value = userId;
    document.getElementById('roleSelect').value = currentRole;
    document.getElementById('roleModal').classList.add('show');
}

async function confirmRole() {
    const userId = document.getElementById('roleUserId').value;
    const role = document.getElementById('roleSelect').value;
    const res = await api('POST', `/api/admin/users/${userId}/role`, { role });
    toast(res.message || 'Role updated');
    closeModal('roleModal');
    cachedUsers = null;
    loadUsers();
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function closeModal(id) { document.getElementById(id).classList.remove('show'); }

function esc(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmtDate(d) {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('en-MY', { year:'numeric', month:'short', day:'numeric' }); }
    catch { return d; }
}

function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }

function setTableLoading(tbodyId, cols) {
    const el = document.getElementById(tbodyId);
    if (el) el.innerHTML = `<tr><td colspan="${cols}" class="loading"><div class="spinner"></div> Loading...</td></tr>`;
}

function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 3000);
}

// Close modals on backdrop click
document.addEventListener('click', e => {
    if (e.target.classList.contains('modal')) e.target.classList.remove('show');
});
