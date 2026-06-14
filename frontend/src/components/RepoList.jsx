/* ============================================
   RepoChat — Repo List Component
   ============================================ */

import React, { useContext } from 'react';
import { RepoContext } from '../App';
import RepoItem from './RepoItem';

export default function RepoList({ onCloseSidebar }) {
  const { repos } = useContext(RepoContext);

  if (repos.length === 0) {
    return (
      <div id="repo-list" className="repo-list">
        <div className="empty-state">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.4">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <p>No repos yet. Add one above.</p>
        </div>
      </div>
    );
  }

  return (
    <div id="repo-list" className="repo-list">
      {repos.map((repo) => (
        <RepoItem key={repo.id} repo={repo} onCloseSidebar={onCloseSidebar} />
      ))}
    </div>
  );
}
