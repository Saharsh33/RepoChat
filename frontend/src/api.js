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
  const apiKey = localStorage.getItem('repochat_api_key');
  const headers = { ...options.headers };

  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }

  return fetch(`${API_BASE}${path}`, { ...options, headers });
}

/** List all repos */
export async function fetchRepos() {
  const res = await apiFetch('/api/repos');
  if (!res.ok) throw new Error('Failed to fetch repos');
  return res.json();
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
  const apiKey = localStorage.getItem('repochat_api_key');
  const headers = {};
  if (apiKey) headers['X-API-Key'] = apiKey;

  const res = await fetch(`${API_BASE}/api/chat/stream?${params}`, { headers });
  if (!res.ok) throw new Error(`Server error: ${res.status}`);
  return res.body.getReader();
}
