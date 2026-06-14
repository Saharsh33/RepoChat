/* ============================================
   RepoChat — Chunk Preview Modal Component
   ============================================ */

import React, { useEffect, useRef, useContext } from 'react';
import hljs from 'highlight.js';
import { RepoContext } from '../App';


export default function ChunkPreview({ source, onClose }) {
  const { selectedRepo } = useContext(RepoContext);
  const codeRef = useRef(null);

  // Syntax highlight on mount
  useEffect(() => {
    if (codeRef.current) {
      hljs.highlightElement(codeRef.current);
    }
  }, [source]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  if (!source) return null;

  // Language detection from extension
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

  // Line numbers
  const startLine = parseInt(source.start, 10) || 1;
  const lines = (source.content || 'No content available').split('\n');
  const lineNumbers = lines.map((_, i) => startLine + i);

  // Clean file path for GitHub link
  let cleanPath = source.file;
  if (cleanPath.includes('/repos/')) {
    const subParts = cleanPath.split('/repos/')[1].split('/');
    subParts.shift();
    cleanPath = subParts.join('/');
  } else if (cleanPath.startsWith('./')) {
    cleanPath = cleanPath.substring(2);
  }

  let githubBase = selectedRepo?.github_url || '';
  if (githubBase.endsWith('/')) githubBase = githubBase.slice(0, -1);
  if (githubBase.endsWith('.git')) githubBase = githubBase.slice(0, -4);

  return (
    <div
      className="chunk-preview-overlay"
      id="chunk-preview-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="chunk-preview-card">
        {/* Header */}
        <div className="chunk-preview-header">
          <div className="chunk-preview-file-info">
            <div className="chunk-preview-filename">{source.file}</div>
            <div className="chunk-preview-lines">Lines {source.start}–{source.end}</div>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {githubBase && (
              <a
                href={`${githubBase}/blob/main/${cleanPath}#L${source.start}-L${source.end}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '6px 12px', background: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)', borderRadius: '6px',
                  fontSize: '12px', fontWeight: '500', textDecoration: 'none',
                  border: '1px solid var(--border-medium)',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
                </svg>
                View on GitHub
              </a>
            )}
            <button
              className="chunk-preview-close"
              id="chunk-preview-close"
              aria-label="Close preview"
              onClick={onClose}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Code body */}
        <div
          className="chunk-preview-body"
          style={{
            display: 'flex', background: '#f6f8fa',
            borderBottomLeftRadius: 'var(--radius-lg)',
            borderBottomRightRadius: 'var(--radius-lg)',
            overflowY: 'auto', overflowX: 'hidden',
          }}
        >
          <div style={{
            padding: '16px 0 16px 16px', textAlign: 'right',
            color: '#6e7681', userSelect: 'none',
            fontFamily: 'var(--font-mono)', fontSize: '13px',
            lineHeight: '1.6', borderRight: '1px solid #d0d7de',
            paddingRight: '12px',
          }}>
            {lineNumbers.map((n) => <div key={n}>{n}</div>)}
          </div>
          <pre style={{ flex: 1, paddingLeft: '12px', margin: 0 }}>
            <code ref={codeRef} className={lang ? `language-${lang}` : ''}>
              {source.content || 'No content available'}
            </code>
          </pre>
        </div>
      </div>
    </div>
  );
}
