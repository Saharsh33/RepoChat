/* ============================================
   RepoChat — Vite Entry Point
   ============================================ */

import './style.css';
import 'highlight.js/styles/github.css';
import { initApp } from './app.js';

// Render the app shell into #app
document.querySelector('#app').innerHTML = `
  <!-- Sidebar -->
  <aside class="sidebar" id="sidebar">
    <div class="sidebar-header">
      <div class="logo">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
        <span class="logo-text">RepoChat</span>
      </div>
    </div>

    <!-- Add Repo Form -->
    <div class="add-repo-section">
      <h3 class="section-title">Add Repository</h3>
      <form id="add-repo-form" class="add-repo-form">
        <input
          type="url"
          id="repo-url-input"
          placeholder="https://github.com/user/repo"
          required
          autocomplete="off"
        />
        <button type="submit" id="add-repo-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Ingest
        </button>
      </form>
    </div>

    <!-- Repo List -->
    <div class="repo-list-section">
      <h3 class="section-title">Your Repositories</h3>
      <div id="repo-list" class="repo-list">
        <div class="empty-state">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.4">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          </svg>
          <p>No repos yet. Add one above.</p>
        </div>
      </div>
    </div>

    <!-- Logout -->
    <div class="sidebar-footer">
      <button id="logout-btn" class="logout-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
          <polyline points="16 17 21 12 16 7"></polyline>
          <line x1="21" y1="12" x2="9" y2="12"></line>
        </svg>
        Logout
      </button>
    </div>
  </aside>

  <!-- Mobile sidebar toggle -->
  <button class="sidebar-toggle" id="sidebar-toggle" aria-label="Toggle sidebar">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="3" y1="12" x2="21" y2="12"></line>
      <line x1="3" y1="6" x2="21" y2="6"></line>
      <line x1="3" y1="18" x2="21" y2="18"></line>
    </svg>
  </button>

  <!-- Main Chat Area -->
  <main class="chat-area" id="chat-area">
    <!-- Welcome screen -->
    <div class="welcome-screen" id="welcome-screen">
      <div class="welcome-content">
        <div class="welcome-icon">
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="url(#grad)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <defs>
              <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#5b9ef5"/>
                <stop offset="100%" style="stop-color:#7ab4f7"/>
              </linearGradient>
            </defs>
            <polyline points="16 18 22 12 16 6"></polyline>
            <polyline points="8 6 2 12 8 18"></polyline>
          </svg>
        </div>
        <h1>Talk to your codebase</h1>
        <p>Add a GitHub repository, wait for ingestion, then start asking questions about the code.</p>
      </div>
    </div>

    <!-- Chat interface (hidden until a repo is selected) -->
    <div class="chat-interface" id="chat-interface" style="display:none;">
      <div class="chat-header" id="chat-header">
        <div class="chat-header-info">
          <span class="chat-repo-name" id="chat-repo-name">repo-name</span>
          <span class="chat-repo-status" id="chat-repo-status">ready</span>
        </div>
      </div>

      <div class="messages-container" id="messages-container">
        <div class="messages" id="messages"></div>
      </div>

      <div class="chat-input-area" id="chat-input-area">
        <form id="chat-form" class="chat-form">
          <div class="input-wrapper">
            <textarea
              id="chat-input"
              placeholder="Ask about this repository..."
              rows="1"
              required
              autocomplete="off"
            ></textarea>
            <button type="submit" id="send-btn" aria-label="Send message">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="19" x2="12" y2="5"></line>
                <polyline points="5 12 12 5 19 12"></polyline>
              </svg>
            </button>
          </div>
          <span class="input-hint">Press Enter to send, Shift+Enter for new line</span>
        </form>
      </div>
    </div>
  </main>
`;

// Boot the app
import { checkAuthAndInit } from './app.js';
checkAuthAndInit();
