/* ============================================
   RepoChat — Sidebar Component
   ============================================ */

import React from 'react';
import AddRepoForm from './AddRepoForm';
import RepoList from './RepoList';

export default function Sidebar({ onLogout, onCloseSidebar }) {
  return (
    <>
      {/* Header */}
      <div className="sidebar-header">
        <div className="logo">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span className="logo-text">RepoChat</span>
        </div>
      </div>

      {/* Add Repo */}
      <div className="add-repo-section">
        <h3 className="section-title">Add Repository</h3>
        <AddRepoForm />
      </div>

      {/* Repo List */}
      <div className="repo-list-section">
        <h3 className="section-title">Your Repositories</h3>
        <RepoList onCloseSidebar={onCloseSidebar} />
      </div>

      {/* Logout */}
      <div className="sidebar-footer">
        <button id="logout-btn" className="logout-btn" onClick={onLogout}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Logout
        </button>
      </div>
    </>
  );
}
