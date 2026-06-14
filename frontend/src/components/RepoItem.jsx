/* ============================================
   RepoChat — Repo Item Component
   ============================================ */

import React, { useState, useContext, useEffect, useRef } from 'react';
import { deleteRepo, fetchRepos } from '../api.js';
import { ToastContext, RepoContext } from '../App';


export default function RepoItem({ repo, onCloseSidebar }) {
  const { selectedRepoId, setSelectedRepoId, setRepos } = useContext(RepoContext);
  const showToast = useContext(ToastContext);
  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const menuRef = useRef(null);

  const isActive = repo.id === selectedRepoId;
  const statusClass =
    repo.status === 'ready' ? 'ready'
    : repo.status === 'pending' ? 'pending'
    : repo.status === 'error' ? 'error'
    : 'processing';

  const handleClick = () => {
    setSelectedRepoId(repo.id);
    if (window.innerWidth <= 768 && onCloseSidebar) {
      onCloseSidebar();
    }
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    setMenuPos({ x: e.clientX, y: e.clientY });
    setShowMenu(true);
  };

  const handleDelete = async () => {
    setShowMenu(false);
    if (!confirm(`Delete "${repo.repo_name}"? This removes all indexed chunks and chat history.`)) {
      return;
    }

    try {
      await deleteRepo(repo.id);
      showToast('Repository deletion started', 'success');

      if (selectedRepoId === repo.id) {
        setSelectedRepoId(null);
      }

      // Optimistic removal
      setRepos((prev) => prev.filter((r) => r.id !== repo.id));

      // Refresh after backend processes
      setTimeout(async () => {
        try {
          const updated = await fetchRepos();
          setRepos(updated);
        } catch (err) {
          console.error('Failed to refresh repos after delete:', err);
        }
      }, 2000);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Close context menu on outside click
  useEffect(() => {
    if (!showMenu) return;

    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };

    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [showMenu]);

  return (
    <>
      <div
        className={`repo-item ${isActive ? 'active' : ''}`}
        data-repo-id={repo.id}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        <div className="repo-item-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
          </svg>
        </div>
        <div className="repo-item-info">
          <div className="repo-item-name">{repo.repo_name}</div>
          <div className="repo-item-status">
            <span className={`status-dot ${statusClass}`} />
            <span style={{ color: 'var(--text-muted)' }}>
              {repo.status}{repo.total_chunks ? ` · ${repo.total_chunks} chunks` : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Context Menu */}
      {showMenu && (
        <div
          ref={menuRef}
          className="repo-context-menu"
          style={{
            display: 'block',
            left: `${Math.max(8, Math.min(menuPos.x, window.innerWidth - 160))}px`,
            top: `${Math.max(8, Math.min(menuPos.y, window.innerHeight - 40))}px`,
          }}
        >
          <button
            type="button"
            className="repo-context-menu-item danger"
            onClick={handleDelete}
          >
            Delete repository
          </button>
        </div>
      )}
    </>
  );
}
