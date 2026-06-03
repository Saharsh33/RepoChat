/* ============================================
   RepoChat — App Logic
   ============================================ */

import hljs from 'highlight.js';
import { marked } from 'marked';
import { fetchRepos, addRepo, deleteRepo, getRepoStatus, chatStream, login, register, fetchMessages } from './api.js';

// ---- State ----
let repos = [];
let selectedRepoId = null;
let chatHistory = [];
let isStreaming = false;
let statusPollingInterval = null;
let contextMenuRepoId = null;
let currentSkip = 0;
const MESSAGES_LIMIT = 20;
let hasMoreMessages = true;

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

// ---- Chunk Preview Modal ----
function showChunkPreview(source) {
  // Remove existing overlay if any
  hideChunkPreview();

  const overlay = document.createElement('div');
  overlay.className = 'chunk-preview-overlay';
  overlay.id = 'chunk-preview-overlay';

  // Guess language from file extension for syntax highlighting
  const ext = source.file.split('.').pop().toLowerCase();
  const langMap = {
    js: 'javascript', ts: 'typescript', py: 'python', rb: 'ruby',
    go: 'go', rs: 'rust', java: 'java', cpp: 'cpp', c: 'c',
    cs: 'csharp', php: 'php', swift: 'swift', kt: 'kotlin',
    sh: 'bash', bash: 'bash', zsh: 'bash', yml: 'yaml', yaml: 'yaml',
    json: 'json', html: 'html', css: 'css', scss: 'scss',
    sql: 'sql', md: 'markdown', jsx: 'javascript', tsx: 'typescript',
    vue: 'html', svelte: 'html', toml: 'toml', xml: 'xml',
  };
  const lang = langMap[ext] || '';
  const langAttr = lang ? ` class="language-${lang}"` : '';

  const repo = repos.find((r) => r.id === selectedRepoId);
  const startLine = parseInt(source.start, 10) || 1;
  const lines = (source.content || 'No content available').split('\n');
  const numLines = lines.length;
  let lineNumbersHtml = '';
  for (let i = 0; i < numLines; i++) {
    lineNumbersHtml += `<div>${startLine + i}</div>`;
  }

  // Clean the file path for GitHub
  let cleanPath = source.file;
  if (cleanPath.includes('/repos/')) {
    const subParts = cleanPath.split('/repos/')[1].split('/');
    subParts.shift();
    cleanPath = subParts.join('/');
  } else if (cleanPath.startsWith('./')) {
    cleanPath = cleanPath.substring(2);
  }

  let githubBase = repo && repo.github_url ? repo.github_url : '';
  if (githubBase.endsWith('/')) githubBase = githubBase.slice(0, -1);
  if (githubBase.endsWith('.git')) githubBase = githubBase.slice(0, -4);

  overlay.innerHTML = `
    <div class="chunk-preview-card">
      <div class="chunk-preview-header">
        <div class="chunk-preview-file-info">
          <div class="chunk-preview-filename">${escapeHtml(source.file)}</div>
          <div class="chunk-preview-lines">Lines ${source.start}–${source.end}</div>
        </div>
        <div style="display: flex; gap: 12px; align-items: center;">
          ${githubBase ? `
          <a href="${githubBase}/blob/main/${cleanPath}#L${source.start}-L${source.end}" target="_blank" style="display: flex; align-items: center; gap: 6px; padding: 6px 12px; background: var(--bg-tertiary); color: var(--text-primary); border-radius: 6px; font-size: 12px; font-weight: 500; text-decoration: none; border: 1px solid var(--border-medium); transition: background var(--transition-fast);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>
            View on GitHub
          </a>
          ` : ''}
          <button class="chunk-preview-close" id="chunk-preview-close" aria-label="Close preview">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
      <div class="chunk-preview-body" style="display: flex; background: #f6f8fa; border-bottom-left-radius: var(--radius-lg); border-bottom-right-radius: var(--radius-lg); overflow-y: auto; overflow-x: hidden;">
        <div style="padding: 16px 0 16px 16px; text-align: right; color: #6e7681; user-select: none; font-family: var(--font-mono); font-size: 13px; line-height: 1.6; border-right: 1px solid #d0d7de; padding-right: 12px;">
          ${lineNumbersHtml}
        </div>
        <pre style="flex: 1; padding-left: 12px; margin: 0;"><code${langAttr}>${escapeHtml(source.content || 'No content available')}</code></pre>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Syntax highlight the code block
  const codeBlock = overlay.querySelector('pre code');
  if (codeBlock) {
    hljs.highlightElement(codeBlock);
  }

  // Close handlers
  overlay.querySelector('#chunk-preview-close').addEventListener('click', hideChunkPreview);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) hideChunkPreview();
  });
}

function hideChunkPreview() {
  const existing = document.getElementById('chunk-preview-overlay');
  if (existing) existing.remove();
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

    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showRepoContextMenu(e.clientX, e.clientY, Number(el.dataset.repoId));
    });
  });
}

function hideRepoContextMenu() {
  const menu = document.getElementById('repo-context-menu');
  if (menu) menu.style.display = 'none';
  contextMenuRepoId = null;
}

function showRepoContextMenu(x, y, repoId) {
  let menu = document.getElementById('repo-context-menu');
  if (!menu) {
    menu = document.createElement('div');
    menu.id = 'repo-context-menu';
    menu.className = 'repo-context-menu';
    menu.innerHTML = `
      <button type="button" class="repo-context-menu-item danger" data-action="delete">
        Delete repository
      </button>`;
    document.body.appendChild(menu);

    menu.querySelector('[data-action="delete"]').addEventListener('click', () => {
      const id = contextMenuRepoId;
      hideRepoContextMenu();
      if (id != null) handleDeleteRepo(id);
    });
  }

  contextMenuRepoId = repoId;
  menu.style.display = 'block';

  const menuRect = menu.getBoundingClientRect();
  const left = Math.min(x, window.innerWidth - menuRect.width - 8);
  const top = Math.min(y, window.innerHeight - menuRect.height - 8);
  menu.style.left = `${Math.max(8, left)}px`;
  menu.style.top = `${Math.max(8, top)}px`;
}

async function handleDeleteRepo(repoId) {
  const repo = repos.find((r) => r.id === repoId);
  const repoName = repo?.repo_name || 'this repository';

  if (!confirm(`Delete "${repoName}"? This removes all indexed chunks and chat history.`)) {
    return;
  }

  try {
    await deleteRepo(repoId);
    showToast('Repository deletion started', 'success');

    repos = repos.filter((r) => r.id !== repoId);

    if (selectedRepoId === repoId) {
      selectedRepoId = null;
      chatHistory = [];
      stopStatusPolling();
      document.getElementById('messages').innerHTML = '';
      document.getElementById('welcome-screen').style.display = 'flex';
      document.getElementById('chat-interface').style.display = 'none';
    }

    renderRepoList();

    setTimeout(async () => {
      try {
        repos = await fetchRepos();
        renderRepoList();
      } catch (err) {
        console.error('Failed to refresh repos after delete:', err);
      }
    }, 2000);
  } catch (err) {
    showToast(err.message, 'error');
  }
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
  
  // Inject the Load More button container
  document.getElementById('messages').innerHTML = `
    <div id="load-more-container" style="text-align: center; margin-bottom: 24px; display: none;">
      <button id="load-more-btn" style="background: var(--bg-tertiary); padding: 8px 16px; border-radius: var(--radius-sm); font-size: 13px; color: var(--accent-primary); border: 1px solid var(--border-medium);">Load Older Messages</button>
    </div>
  `;

  document.getElementById('load-more-btn').addEventListener('click', () => loadChatHistory(repoId));

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

  if (window.innerWidth <= 768) {
    document.getElementById('sidebar').classList.remove('open');
  }

  // Reset pagination state and load
  currentSkip = 0;
  hasMoreMessages = true;
  loadChatHistory(repoId, true);
}

// ---- Message helpers ----
function appendMessage(role, content, streaming = false) {
  const messagesEl = document.getElementById('messages');
  const div = document.createElement('div');
  div.className = `message ${role}`;
  const userSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
  const aiSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3z"></path></svg>`;
  const avatarLabel = role === 'user' ? userSvg : aiSvg;

  div.innerHTML = `
    <div class="message-avatar">${avatarLabel}</div>
    <div class="message-body">
      <div class="message-content">${streaming ? '' : marked.parse(content)}</div>
    </div>`;

  messagesEl.appendChild(div);

  if (!streaming && content) {
    div.querySelectorAll('pre code').forEach((block) => {
      if (!block.textContent.trim()) {
        block.parentElement.style.display = 'none';
        return;
      }
      hljs.highlightElement(block);
    });
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

  // Logout
  document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('repochat_jwt_token');
    window.location.reload();
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#repo-context-menu')) {
      hideRepoContextMenu();
    }

    if (
      window.innerWidth <= 768 &&
      sidebar.classList.contains('open') &&
      !sidebar.contains(e.target) &&
      !sidebarToggle.contains(e.target)
    ) {
      sidebar.classList.remove('open');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideRepoContextMenu();
      hideChunkPreview();
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
      <div class="typing-indicator" style="display: flex; align-items: center; gap: 4px; height: 24px; padding: 4px 0;">
        <div class="typing-dot" style="width: 5px; height: 5px; background: var(--text-muted); border-radius: 50%; animation: typing 1.4s infinite ease-in-out both; animation-delay: -0.32s;"></div>
        <div class="typing-dot" style="width: 5px; height: 5px; background: var(--text-muted); border-radius: 50%; animation: typing 1.4s infinite ease-in-out both; animation-delay: -0.16s;"></div>
        <div class="typing-dot" style="width: 5px; height: 5px; background: var(--text-muted); border-radius: 50%; animation: typing 1.4s infinite ease-in-out both;"></div>
      </div>
      <style>
        @keyframes typing {
          0%, 80%, 100% { transform: scale(0); opacity: 0.5; }
          40% { transform: scale(1); opacity: 1; }
        }
      </style>`;

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
              contentEl.querySelectorAll('pre code').forEach((b) => {
                if (!b.textContent.trim()) {
                  b.parentElement.style.display = 'none';
                  return;
                }
                hljs.highlightElement(b);
              });
              scrollToBottom();
            }
          } catch { /* skip malformed events */ }
        }
      }

      // Final render
      contentEl.innerHTML = marked.parse(fullResponse);
      contentEl.querySelectorAll('pre code').forEach((b) => {
        if (!b.textContent.trim()) {
          b.parentElement.style.display = 'none';
          return;
        }
        hljs.highlightElement(b);
      });

      // Make inline code paths clickable without altering LLM's raw markdown response
      contentEl.querySelectorAll('code').forEach(codeEl => {
        // Skip code blocks (which are inside a <pre>)
        if (codeEl.parentElement.tagName === 'PRE') return;
        
        const text = codeEl.textContent.trim();
        const pathRegex = /^[\w.-]+\/.*?\.[\w]+$/; // Looks like a path
        const fileRegex = /^[\w.-]+\.(?:py|js|ts|go|rs|java|cpp|c|md|css|html|json|yml|yaml|sh|txt|jsx|tsx)$/; // Looks like a file
        
        if (pathRegex.test(text) || fileRegex.test(text)) {
          codeEl.classList.add('interactive-path');
          codeEl.title = 'Click to view file';
          
          codeEl.addEventListener('click', (e) => {
            e.preventDefault();
            const sourceChunk = sources.find(s => s.file === text || s.file.endsWith('/' + text));
            if (sourceChunk) {
              showChunkPreview(sourceChunk);
            } else if (repo && repo.github_url) {
              let url = repo.github_url.endsWith('/') ? repo.github_url.slice(0, -1) : repo.github_url;
              if (url.endsWith('.git')) url = url.slice(0, -4);
              
              let cleanPath = text;
              if (cleanPath.includes('/repos/')) {
                const subParts = cleanPath.split('/repos/')[1].split('/');
                subParts.shift();
                cleanPath = subParts.join('/');
              } else if (cleanPath.startsWith('./')) {
                cleanPath = cleanPath.substring(2);
              }
              
              window.open(`${url}/blob/main/${cleanPath}`, '_blank');
            }
          });
        }
      });

      // Sources tags at bottom
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
          tag.title = `Click to preview — ${s.file}`;
          tag.addEventListener('click', () => showChunkPreview(s));
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
export function checkAuthAndInit() {
  // 1. Check if we just returned from Google Auth
  const hash = window.location.hash;
  if (hash.includes('token=')) {
    const token = hash.split('token=')[1].split('&')[0];
    localStorage.setItem('repochat_jwt_token', token);
    window.history.replaceState(null, null, ' '); // Clean URL
  }

  const token = localStorage.getItem('repochat_jwt_token');
  const loginModal = document.getElementById('login-modal');
  const appContainer = document.getElementById('app');

  if (token) {
    loginModal.style.display = 'none';
    appContainer.style.display = 'flex';
    initApp();
  } else {
    appContainer.style.display = 'none';
    loginModal.style.display = 'flex';

    let isLoginMode = true;
    const authForm = document.getElementById('auth-form');
    const authBtn = document.getElementById('auth-btn');
    const errorMsg = document.getElementById('auth-error');
    
    const toggleLogin = document.getElementById('toggle-login');
    const toggleSignup = document.getElementById('toggle-signup');
    const googleBtn = document.getElementById('google-auth-btn');

    // Handle Google Auth redirect
    googleBtn.addEventListener('click', () => {
      // NOTE: Ensure your API_BASE points to the backend (e.g. http://localhost:8000)
      window.location.href = `http://localhost:8000/api/auth/google/login`;
    });

    // Handle Mode Toggling
    toggleLogin.addEventListener('click', () => {
      isLoginMode = true;
      toggleLogin.style.borderColor = 'var(--accent-primary)';
      toggleLogin.style.color = 'var(--text-primary)';
      toggleSignup.style.borderColor = 'transparent';
      toggleSignup.style.color = 'var(--text-muted)';
      authBtn.textContent = 'Login';
      errorMsg.style.display = 'none';
    });

    toggleSignup.addEventListener('click', () => {
      isLoginMode = false;
      toggleSignup.style.borderColor = 'var(--accent-primary)';
      toggleSignup.style.color = 'var(--text-primary)';
      toggleLogin.style.borderColor = 'transparent';
      toggleLogin.style.color = 'var(--text-muted)';
      authBtn.textContent = 'Sign Up';
      errorMsg.style.display = 'none';
    });

    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('auth-username').value;
      const password = document.getElementById('auth-password').value;

      authBtn.disabled = true;
      authBtn.textContent = isLoginMode ? 'Logging in...' : 'Signing up...';
      errorMsg.style.display = 'none';

      try {
        if (isLoginMode) {
          await login(username, password);
        } else {
          await register(username, password);
        }
        
        authForm.reset();
        loginModal.style.display = 'none';
        appContainer.style.display = 'flex';
        initApp();
      } catch (err) {
        errorMsg.textContent = err.message;
        errorMsg.style.display = 'block';
        authBtn.disabled = false;
        authBtn.textContent = isLoginMode ? 'Login' : 'Sign Up';
      }
    });
  }
}
async function loadChatHistory(repoId, isInitialLoad = false) {
  if (!hasMoreMessages) return;
  
  const loadBtn = document.getElementById('load-more-btn');
  const container = document.getElementById('load-more-container');
  if (loadBtn) loadBtn.textContent = 'Loading...';

  try {
    const messages = await fetchMessages(repoId, currentSkip, MESSAGES_LIMIT);
    
    // Check if we've reached the end of the history
    if (messages.length < MESSAGES_LIMIT) {
      hasMoreMessages = false;
      if (container) container.style.display = 'none';
    } else {
      if (container) container.style.display = 'block';
    }

    if (loadBtn) loadBtn.textContent = 'Load Older Messages';

    const messagesContainer = document.getElementById('messages');
    const fragment = document.createDocumentFragment();
    
    // Parse and format the fetched messages
    messages.forEach(msg => {
      const div = document.createElement('div');
      div.className = `message ${msg.role}`;
      const avatarLabel = msg.role === 'user' ? 'U' : 'AI';
      div.innerHTML = `
        <div class="message-avatar">${avatarLabel}</div>
        <div class="message-body">
          <div class="message-role">${msg.role === 'user' ? 'You' : 'RepoChat'}</div>
          <div class="message-content">${marked.parse(msg.content)}</div>
        </div>`;
      
      div.querySelectorAll('pre code').forEach((block) => hljs.highlightElement(block));
      fragment.appendChild(div);
      
      // Keep local history array in sync
      if (isInitialLoad) chatHistory.push(msg); 
    });

    // Insert the older messages right beneath the "Load More" button
    messagesContainer.insertBefore(fragment, container.nextSibling);

    currentSkip += messages.length;

    // Scroll to the bottom if this is the first load
    if (isInitialLoad) {
      scrollToBottom();
      document.getElementById('chat-input').focus();
    }
  } catch (err) {
    console.error("Failed to load history", err);
    if (loadBtn) loadBtn.textContent = 'Error. Try again.';
  }
}