/* ============================================
   RepoChat — Add Repo Form Component
   ============================================ */

import React, { useState, useContext } from 'react';
import { addRepo, fetchRepos } from '../api.js';
import { ToastContext, RepoContext } from '../App';

export default function AddRepoForm() {
  const [url, setUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const showToast = useContext(ToastContext);
  const { setRepos, setSelectedRepoId } = useContext(RepoContext);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;

    setSubmitting(true);
    try {
      const data = await addRepo(url.trim());
      showToast('Repository ingestion started!', 'success');
      setUrl('');

      const repos = await fetchRepos();
      setRepos(repos);
      setSelectedRepoId(data.repo_id);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form id="add-repo-form" className="add-repo-form" onSubmit={handleSubmit}>
      <input
        type="url"
        id="repo-url-input"
        placeholder="https://github.com/user/repo"
        required
        autoComplete="off"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <button type="submit" id="add-repo-btn" disabled={submitting}>
        {submitting ? (
          <>
            <span className="spinner" /> Ingesting...
          </>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Ingest
          </>
        )}
      </button>
    </form>
  );
}
