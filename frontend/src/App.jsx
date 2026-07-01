/* ============================================
   RepoChat — Root App Component
   ============================================ */

import React, { useState, useEffect, useCallback, createContext } from 'react';
import LoginModal from './components/LoginModal';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import Toast from './components/Toast';
import {
  fetchRepos,
  validateSession,
  clearAuthToken,
} from './api.js';

// ---- Contexts ----
export const ToastContext = createContext(null);
export const RepoContext = createContext(null);

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [repos, setRepos] = useState([]);
  const [selectedRepoId, setSelectedRepoId] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ---- Toast helpers ----
  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ---- Auth check on mount ----
  useEffect(() => {
    async function checkAuth() {
      // Handle Google OAuth callback — token in URL hash
      const hash = window.location.hash;
      if (hash.includes('token=')) {
        const token = hash.split('token=')[1].split('&')[0];
        localStorage.setItem('repochat_jwt_token', token);
        window.history.replaceState(null, null, ' ');
      }

      const token = localStorage.getItem('repochat_jwt_token');
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        await validateSession();
        setIsAuthenticated(true);
      } catch {
        clearAuthToken();
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, []);

  // ---- Load repos when authenticated ----
  const loadRepos = useCallback(async () => {
    try {
      const data = await fetchRepos();
      setRepos(data);
    } catch (err) {
      console.error(err);
      showToast('Could not load repositories', 'error');
    }
  }, [showToast]);
  useEffect(() => {
    if (!isAuthenticated) return;
    loadRepos();
  }, [isAuthenticated, loadRepos]);

  

  // ---- Auth handlers ----
  const handleLoginSuccess = useCallback(() => {
    setIsAuthenticated(true);
  }, []);

  const handleLogout = useCallback(() => {
    clearAuthToken();
    setIsAuthenticated(false);
    setRepos([]);
    setSelectedRepoId(null);
  }, []);

  // ---- Loading state ----
  if (loading) {
    return null; // Or a spinner
  }

  // ---- Render ----
  const selectedRepo = repos.find((r) => r.id === selectedRepoId) || null;

  return (
    <ToastContext.Provider value={showToast}>
      <RepoContext.Provider
        value={{
          repos,
          setRepos,
          selectedRepoId,
          setSelectedRepoId,
          selectedRepo,
          loadRepos,
        }}
      >
        {!isAuthenticated ? (
          <LoginModal onSuccess={handleLoginSuccess} />
        ) : (
          <>
            {/* Sidebar */}
            <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`} id="sidebar">
              <Sidebar
                onLogout={handleLogout}
                onCloseSidebar={() => setSidebarOpen(false)}
              />
            </aside>

            {/* Mobile sidebar toggle */}
            <button
              className="sidebar-toggle"
              id="sidebar-toggle"
              aria-label="Toggle sidebar"
              onClick={() => setSidebarOpen((v) => !v)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>

            {/* Main Chat Area */}
            <main className="chat-area" id="chat-area">
              <ChatArea />
            </main>
          </>
        )}

        {/* Toast container */}
        <Toast toasts={toasts} onRemove={removeToast} />
      </RepoContext.Provider>
    </ToastContext.Provider>
  );
}
