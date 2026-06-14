/* ============================================
   RepoChat — Chat Message Component
   ============================================ */

import React, { useEffect, useRef, useContext } from 'react';
import hljs from 'highlight.js';
import { marked } from 'marked';
import { RepoContext } from '../App';

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

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export default function ChatMessage({ role, content, sources = [], onShowChunkPreview, isHistory = false }) {
  const contentRef = useRef(null);
  const { selectedRepo } = useContext(RepoContext);

  // Highlight code blocks and make file paths clickable after content renders
  useEffect(() => {
    if (!contentRef.current || !content) return;

    // Syntax highlight all code blocks
    contentRef.current.querySelectorAll('pre code').forEach((block) => {
      if (!block.textContent.trim()) {
        block.parentElement.style.display = 'none';
        return;
      }
      hljs.highlightElement(block);
    });

    // Make inline code paths clickable
    contentRef.current.querySelectorAll('code').forEach((codeEl) => {
      if (codeEl.parentElement.tagName === 'PRE') return;

      const text = codeEl.textContent.trim();
      const pathRegex = /^[\w.-]+\/.*?\.[\w]+$/;
      const fileRegex = /^[\w.-]+\.(?:py|js|ts|go|rs|java|cpp|c|md|css|html|json|yml|yaml|sh|txt|jsx|tsx)$/;

      if (pathRegex.test(text) || fileRegex.test(text)) {
        codeEl.classList.add('interactive-path');
        codeEl.title = 'Click to view file';

        codeEl.addEventListener('click', (e) => {
          e.preventDefault();
          const sourceChunk = sources.find(
            (s) => s.file === text || s.file.endsWith('/' + text)
          );
          if (sourceChunk) {
            onShowChunkPreview(sourceChunk);
          } else if (selectedRepo?.github_url) {
            let url = selectedRepo.github_url;
            if (url.endsWith('/')) url = url.slice(0, -1);
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
  }, [content, sources, selectedRepo, onShowChunkPreview]);

  // Avatar SVGs
  const userSvg = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );

  const aiSvg = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" />
    </svg>
  );

  // For history messages that used the simple "U" / "AI" avatar text
  const avatar = isHistory
    ? (role === 'user' ? 'U' : 'AI')
    : (role === 'user' ? userSvg : aiSvg);

  return (
    <div className={`message ${role}`}>
      <div className="message-avatar">{avatar}</div>
      <div className="message-body">
        {isHistory && (
          <div className="message-role">{role === 'user' ? 'You' : 'RepoChat'}</div>
        )}
        <div
          className="message-content"
          ref={contentRef}
          dangerouslySetInnerHTML={{
            __html: content ? marked.parse(content) : '',
          }}
        />

        {/* Source tags */}
        {sources.length > 0 && (
          <div className="message-sources">
            {sources.map((s, i) => {
              const fileName = s.file.split('/').pop();
              return (
                <span
                  key={i}
                  className="source-tag"
                  title={`Click to preview — ${s.file}`}
                  onClick={() => onShowChunkPreview(s)}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                    <polyline points="13 2 13 9 20 9" />
                  </svg>
                  {escapeHtml(fileName)}:{s.start}-{s.end}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
