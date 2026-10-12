// admin.js - Frontend logic for admin dashboard

const API_BASE = 'http://localhost:5000/api'; // Backend API base URL
let authToken = null;

// Utility: fetch with auth header
async function apiFetch(path, options = {}) {
  const headers = options.headers || {};
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  const resp = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: resp.statusText }));
    throw err;
  }
  // If response is CSV, return text
  const contentType = resp.headers.get('content-type');
  if (contentType && contentType.includes('text/csv')) {
    return resp.text();
  }
  return resp.json();
}

// ----- UI Helpers -----
function $(sel) { return document.querySelector(sel); }
function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }

// ----- Auth -----
async function login(event) {
  event.preventDefault();
  const email = $('#email').value.trim();
  const password = $('#password').value;
  const errorEl = $('#login-error');
  hide(errorEl);
  try {
    console.log('Attempting login with', {email, password});
    const data = await apiFetch('/admin/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
    console.log('Login response', data);
    authToken = data.token;
    localStorage.setItem('adminToken', authToken);
    showDashboard();
  } catch (err) {
    errorEl.textContent = err.error || 'Login failed';
    show(errorEl);
  }
}

function logout() {
  authToken = null;
  localStorage.removeItem('adminToken');
  hide($('#dashboard-view'));
  show($('#login-view'));
}

function initAuth() {
  const stored = localStorage.getItem('adminToken');
  if (stored) {
    authToken = stored;
    showDashboard();
  }
}

// ----- Dashboard -----
async function loadStats() {
  const stats = await apiFetch('/admin/stats');
  const container = $('#stats-cards');
  container.innerHTML = '';
  const cards = [
    { label: 'Participants', value: stats.participantCount },
    { label: 'Sessions', value: stats.sessionCount },
    { label: 'Competition', value: stats.competitionCount },
    { label: 'Practice', value: stats.practiceCount },
  ];
  cards.forEach(c => {
    const div = document.createElement('div');
    div.className = 'card';
    div.innerHTML = `<h3>${c.value}</h3><p>${c.label}</p>`;
    container.appendChild(div);
  });
}

// ----- Participants -----
let participantsPage = 1;
const participantsLimit = 20;
async function loadParticipants(page = 1, search = '') {
  const data = await apiFetch(`/admin/participants?search=${encodeURIComponent(search)}&page=${page}&limit=${participantsLimit}`);
  const tbody = $('#participants-table tbody');
  tbody.innerHTML = '';
  data.participants.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${p.participantId}</td><td>${p.displayName || ''}</td><td>${new Date(p.createdAt).toLocaleString()}</td>`;
    tbody.appendChild(tr);
  });
  renderPagination('#participants-pagination', data.page, data.totalPages, (newPage) => {
    participantsPage = newPage;
    loadParticipants(newPage, $('#participant-search').value.trim());
  });
}

$('#participant-search').addEventListener('input', (e) => {
  participantsPage = 1;
  loadParticipants(1, e.target.value.trim());
});

$('#participants-export').addEventListener('click', async () => {
  const csv = await apiFetch('/admin/participants/export');
  downloadCSV(csv, 'participants.csv');
});

// ----- Sessions -----
let sessionsPage = 1;
const sessionsLimit = 20;
async function loadSessions(page = 1, mode = '') {
  const url = `/admin/sessions?mode=${encodeURIComponent(mode)}&page=${page}&limit=${sessionsLimit}`;
  const data = await apiFetch(url);
  const tbody = $('#sessions-table tbody');
  tbody.innerHTML = '';
  data.sessions.forEach(s => {
    const tr = document.createElement('tr');
    const participant = s.participant?.displayName ? `${s.participant.displayName} (${s.participant.participantId})` : s.participant?.participantId || '';
    tr.innerHTML = `<td>${s.sessionId}</td><td>${participant}</td><td>${s.mode}</td><td>${s.status}</td><td>${s.score ?? ''}</td><td>${new Date(s.startTime).toLocaleString()}</td><td>${s.endTime ? new Date(s.endTime).toLocaleString() : ''}</td>`;
    tbody.appendChild(tr);
  });
  renderPagination('#sessions-pagination', data.page, data.totalPages, (newPage) => {
    sessionsPage = newPage;
    loadSessions(newPage, $('#session-mode-filter').value);
  });
}

$('#session-mode-filter').addEventListener('change', (e) => {
  sessionsPage = 1;
  loadSessions(1, e.target.value);
});

$('#sessions-export').addEventListener('click', async () => {
  const csv = await apiFetch('/admin/sessions/export');
  downloadCSV(csv, 'sessions.csv');
});

// ----- Settings -----
async function loadSettings() {
  const resp = await apiFetch('/settings');
  const s = resp.settings;
  $('#timerDuration').value = s.timerDuration ?? '';
  $('#difficulty').value = s.difficulty ?? 'easy';
  $('#sessionsEnabled').checked = s.sessionsEnabled !== false; // default true
}

$('#settings-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('#settings-message');
  hide(msg);
  const updates = {
    timerDuration: Number($('#timerDuration').value),
    difficulty: $('#difficulty').value,
    sessionsEnabled: $('#sessionsEnabled').checked,
  };
  try {
    const ret = await apiFetch('/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    msg.textContent = ret.message || 'Settings saved';
    msg.classList.remove('error');
    show(msg);
    // Refresh UI
    await loadSettings();
  } catch (err) {
    msg.textContent = err.error || 'Failed to save settings';
    msg.classList.add('error');
    show(msg);
  }
});

// ----- Helpers -----
function renderPagination(containerSel, current, totalPages, onPage) {
  const container = $(containerSel);
  container.innerHTML = '';
  if (totalPages <= 1) return;
  const createBtn = (label, page, disabled = false) => {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.disabled = disabled;
    btn.addEventListener('click', () => onPage(page));
    return btn;
  };
  container.appendChild(createBtn('«', Math.max(1, current - 1), current === 1));
  for (let p = 1; p <= totalPages; p++) {
    const btn = createBtn(p, p);
    if (p === current) btn.disabled = true;
    container.appendChild(btn);
  }
  container.appendChild(createBtn('»', Math.min(totalPages, current + 1), current === totalPages));
}

function downloadCSV(content, filename) {
  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function showDashboard() {
  hide($('#login-view'));
  show($('#dashboard-view'));
  // Load all sections
  loadStats();
  loadParticipants();
  loadSessions();
  loadSettings();
}

// ----- Init -----
$('#login-form').addEventListener('submit', login);
$('#logout-btn').addEventListener('click', logout);
initAuth();
