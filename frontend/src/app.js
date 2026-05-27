/* ============================================
   RepoChat — App Logic
   ============================================ */

import hljs from 'highlight.js';
import { marked } from 'marked';
import { fetchRepos, addRepo, getRepoStatus, chatStream } from './api.js';

// ---- State ----
let repos = [];
let selectedRepoId = null;
let chatHistory = [];
let isStreaming = false;
let statusPollingInterval = null;

// Configure marked
marked.setOptions({
  highlight(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  },
  breaks: true,
  gfm: true,
});

// ---- Toast ----
function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = '300ms ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---- Render helpers ----
function renderRepoList() {
  const repoListEl = document.getElementById('repo-list');

  if (repos.length === 0) {
    repoListEl.innerHTML = `
      <div class="empty-state">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.4">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        </svg>
        <p>No repos yet. Add one above.</p>
      </div>`;
    return;
  }

  repoListEl.innerHTML = repos
    .map((r) => {
      const statusClass =
        r.status === 'ready' ? 'ready'
        : r.status === 'pending' ? 'pending'
        : r.status === 'error' ? 'error'
        : 'processing';
      const isActive = r.id === selectedRepoId;
      return `
        <div class="repo-item ${isActive ? 'active' : ''}" data-repo-id="${r.id}">
          <div class="repo-item-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
            </svg>
          </div>
          <div class="repo-item-info">
            <div class="repo-item-name">${escapeHtml(r.repo_name)}</div>
            <div class="repo-item-status">
              <span class="status-dot ${statusClass}"></span>
              <span style="color: var(--text-muted)">${r.status}${r.total_chunks ? ` · ${r.total_chunks} chunks` : ''}</span>
            </div>
          </div>
        </div>`;
    })
    .join('');

  // Attach click listeners
  repoListEl.querySelectorAll('.repo-item').forEach((el) => {
    el.addEventListener('click', () => {
      selectRepo(Number(el.dataset.repoId));
    });
  });
}

function updateStatusBadge(status) {
  const badge = document.getElementById('chat-repo-status');
  badge.textContent = status;
  badge.className =
    'chat-repo-status ' +
    (status === 'ready' ? 'ready'
    : status === 'pending' ? 'pending'
    : status === 'error' ? 'error'
    : 'processing');
}

// ---- Status polling ----
function startStatusPolling(repoId) {
  statusPollingInterval = setInterval(async () => {
    try {
      const data = await getRepoStatus(repoId);
      const idx = repos.findIndex((r) => r.id === repoId);
      if (idx >= 0) repos[idx] = { ...repos[idx], ...data };
      renderRepoList();

      if (selectedRepoId === repoId) updateStatusBadge(data.status);

      if (data.status === 'ready' || data.status === 'error') {
        stopStatusPolling();
        showToast(
          data.status === 'ready'
            ? `${data.repo_name} is ready!`
            : `Error ingesting ${data.repo_name}`,
          data.status === 'ready' ? 'success' : 'error',
        );
      }
    } catch (err) {
      console.error('Status poll error:', err);
    }
  }, 3000);
}

function stopStatusPolling() {
  if (statusPollingInterval) {
    clearInterval(statusPollingInterval);
    statusPollingInterval = null;
  }
}

// ---- Select repo ----
function selectRepo(repoId) {
  selectedRepoId = repoId;
  chatHistory = [];
  document.getElementById('messages').innerHTML = '';

  const repo = repos.find((r) => r.id === repoId);
  if (!repo) return;

  document.getElementById('welcome-screen').style.display = 'none';
  document.getElementById('chat-interface').style.display = 'flex';
  document.getElementById('chat-repo-name').textContent = repo.repo_name;
  updateStatusBadge(repo.status);
  renderRepoList();

  stopStatusPolling();
  if (repo.status !== 'ready' && repo.status !== 'error') {
    startStatusPolling(repoId);
  }

  // Close sidebar on mobile
  if (window.innerWidth <= 768) {
    document.getElementById('sidebar').classList.remove('open');
  }

  document.getElementById('chat-input').focus();
}

// ---- Message helpers ----
function appendMessage(role, content, streaming = false) {
  const messagesEl = document.getElementById('messages');
  const div = document.createElement('div');
  div.className = `message ${role}`;
  const avatarLabel = role === 'user' ? 'U' : 'AI';

  div.innerHTML = `
    <div class="message-avatar">${avatarLabel}</div>
    <div class="message-body">
      <div class="message-role">${role === 'user' ? 'You' : 'RepoChat'}</div>
      <div class="message-content">${streaming ? '' : marked.parse(content)}</div>
    </div>`;

  messagesEl.appendChild(div);

  if (!streaming && content) {
    div.querySelectorAll('pre code').forEach((block) => hljs.highlightElement(block));
  }

  scrollToBottom();
  return div;
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    const container = document.getElementById('messages-container');
    container.scrollTop = container.scrollHeight;
  });
}

// ---- Init ----
export function initApp() {
  const sidebar = document.getElementById('sidebar');
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const addRepoForm = document.getElementById('add-repo-form');
  const repoUrlInput = document.getElementById('repo-url-input');
  const addRepoBtn = document.getElementById('add-repo-btn');
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');
  const sendBtn = document.getElementById('send-btn');

  // Sidebar toggle
  sidebarToggle.addEventListener('click', () => sidebar.classList.toggle('open'));

  document.addEventListener('click', (e) => {
    if (
      window.innerWidth <= 768 &&
      sidebar.classList.contains('open') &&
      !sidebar.contains(e.target) &&
      !sidebarToggle.contains(e.target)
    ) {
      sidebar.classList.remove('open');
    }
  });

  // Textarea auto-resize
  chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
  });

  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      chatForm.dispatchEvent(new Event('submit'));
    }
  });

  // Add repo
  addRepoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = repoUrlInput.value.trim();
    if (!url) return;

    addRepoBtn.disabled = true;
    addRepoBtn.innerHTML = '<span class="spinner"></span> Ingesting...';

    try {
      const data = await addRepo(url);
      showToast('Repository ingestion started!', 'success');
      repoUrlInput.value = '';

      repos = await fetchRepos();
      renderRepoList();
      selectRepo(data.repo_id);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      addRepoBtn.disabled = false;
      addRepoBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        Ingest`;
    }
  });

  // Chat submit
  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = chatInput.value.trim();
    if (!query || isStreaming || !selectedRepoId) return;

    const repo = repos.find((r) => r.id === selectedRepoId);
    if (repo && repo.status !== 'ready') {
      showToast('Repository is not ready yet. Please wait for ingestion to complete.', 'info');
      return;
    }

    appendMessage('user', query);
    chatHistory.push({ role: 'user', content: query });
    chatInput.value = '';
    chatInput.style.height = 'auto';

    isStreaming = true;
    sendBtn.disabled = true;

    const assistantMsgEl = appendMessage('assistant', '', true);
    const contentEl = assistantMsgEl.querySelector('.message-content');
    contentEl.innerHTML = `
      <div class="typing-indicator">
        <span></span><span></span><span></span>
      </div>`;

    let fullResponse = '';
    let sources = [];

    try {
      const reader = await chatStream(selectedRepoId, query);
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'sources') {
              sources = event.sources || [];
            } else if (event.type === 'token') {
              fullResponse += event.content;
              contentEl.innerHTML = marked.parse(fullResponse);
              contentEl.querySelectorAll('pre code').forEach((b) => hljs.highlightElement(b));
              scrollToBottom();
            }
          } catch { /* skip malformed events */ }
        }
      }

      // Final render
      contentEl.innerHTML = marked.parse(fullResponse);
      contentEl.querySelectorAll('pre code').forEach((b) => hljs.highlightElement(b));

      // Sources
      if (sources.length > 0) {
        const sourcesEl = document.createElement('div');
        sourcesEl.className = 'message-sources';
        sources.forEach((s) => {
          const tag = document.createElement('span');
          tag.className = 'source-tag';
          const fileName = s.file.split('/').pop();
          tag.innerHTML = `
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
              <polyline points="13 2 13 9 20 9"></polyline>
            </svg>
            ${escapeHtml(fileName)}:${s.start}-${s.end}`;
          tag.title = s.file;
          sourcesEl.appendChild(tag);
        });
        assistantMsgEl.querySelector('.message-body').appendChild(sourcesEl);
      }

      chatHistory.push({ role: 'assistant', content: fullResponse });
    } catch (err) {
      console.error('Stream error:', err);
      contentEl.innerHTML = `<p style="color: var(--error);">Error: ${escapeHtml(err.message)}</p>`;
      showToast('Failed to get response', 'error');
    } finally {
      isStreaming = false;
      sendBtn.disabled = false;
      chatInput.focus();
      scrollToBottom();
    }
  });

  // Initial load
  (async () => {
    try {
      repos = await fetchRepos();
      renderRepoList();
    } catch (err) {
      console.error(err);
      showToast('Could not load repositories', 'error');
    }
  })();
}
