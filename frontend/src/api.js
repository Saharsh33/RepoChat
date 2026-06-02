/* ============================================
   RepoChat — API Client
   ============================================
   Centralized API calls. In dev, Vite proxies /api
   to the backend. In production, set VITE_API_BASE.
   ============================================ */

const API_BASE = import.meta.env.VITE_API_BASE || '';

/**
 * Fetch wrapper that injects the API key header
 * when one is set in localStorage.
 */
function apiFetch(path, options = {}) {
  const token = localStorage.getItem('repochat_jwt_token');
  const headers = { ...options.headers };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return fetch(`${API_BASE}${path}`, { ...options, headers });
}

/** List all repos */
export async function fetchRepos() {
  const res = await apiFetch('/api/repos');
  if (!res.ok) throw new Error('Failed to fetch repos');
  return res.json();
}

/** Login and store JWT token */
export async function login(username, password) {
  const formData = new URLSearchParams();
  formData.append('username', username);
  formData.append('password', password);

  // Notice the path changed to /api/auth/token
  const res = await fetch(`${API_BASE}/api/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData,
  });

  if (!res.ok) throw new Error('Login failed');
  const data = await res.json();
  localStorage.setItem('repochat_jwt_token', data.access_token);
  return data;
}

export async function register(username, password) {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) throw new Error('Registration failed. Username might be taken.');
  const data = await res.json();
  localStorage.setItem('repochat_jwt_token', data.access_token);
  return data;
}

/** Add a repo */
export async function addRepo(githubUrl) {
  const res = await apiFetch('/api/repos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ github_url: githubUrl }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to add repo');
  }
  return res.json();
}

/** Delete a repo */
export async function deleteRepo(repoId) {
  const res = await apiFetch(`/api/repos/${repoId}`, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to delete repo');
  }
  return res.json();
}

/** Get repo status */
export async function getRepoStatus(repoId) {
  const res = await apiFetch(`/api/repos/${repoId}/status`);
  return res.json();
}

/**
 * Stream chat via SSE.
 * Returns a ReadableStream reader that yields SSE lines.
 */
export async function chatStream(repoId, query) {
  const params = new URLSearchParams({ repo_id: repoId, query });
  const token = localStorage.getItem('repochat_jwt_token');
  const headers = {};
  if (token) {
     headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}/api/chat/stream?${params}`, { headers });
  if (!res.ok) throw new Error(`Server error: ${res.status}`);
  return res.body.getReader();
}

export async function fetchMessages(repoId, skip = 0, limit = 20) {
  const token = localStorage.getItem('repochat_jwt_token');
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/api/repos/${repoId}/messages?skip=${skip}&limit=${limit}`, { headers });
  if (!res.ok) throw new Error('Failed to fetch messages');
  return res.json();
}
