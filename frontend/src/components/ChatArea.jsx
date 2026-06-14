/* ============================================
   RepoChat — Chat Area Component
   ============================================ */

import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import hljs from 'highlight.js';
import { marked } from 'marked';
import { getRepoStatus, chatStream, fetchMessages } from '../api.js';
import { ToastContext, RepoContext } from '../App';
import ChatMessage from './ChatMessage';
import ChunkPreview from './ChunkPreview';

const MESSAGES_LIMIT = 20;

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export default function ChatArea() {
  const { selectedRepoId, selectedRepo, repos, setRepos } = useContext(RepoContext);
  const showToast = useContext(ToastContext);

  // Chat state
  const [messages, setMessages] = useState([]); // { role, content, sources?, isHistory? }
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState('');
  const [streamSources, setStreamSources] = useState([]);

  // History pagination
  const [historyMessages, setHistoryMessages] = useState([]);
  const [currentSkip, setCurrentSkip] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Status polling
  const [localStatus, setLocalStatus] = useState(selectedRepo?.status || '');
  const pollingRef = useRef(null);

  // Chunk preview
  const [previewSource, setPreviewSource] = useState(null);

  // Refs
  const messagesContainerRef = useRef(null);
  const chatInputRef = useRef(null);

  // ---- Reset state when repo changes ----
  useEffect(() => {
    setMessages([]);
    setHistoryMessages([]);
    setCurrentSkip(0);
    setHasMore(true);
    setStreamContent('');
    setStreamSources([]);
    setIsStreaming(false);
    setPreviewSource(null);

    if (selectedRepo) {
      setLocalStatus(selectedRepo.status);
      loadHistory(true);
    }

    return () => stopPolling();
  }, [selectedRepoId]);

  // ---- Status polling ----
  useEffect(() => {
    if (!selectedRepo) return;
    if (selectedRepo.status !== 'ready' && selectedRepo.status !== 'error') {
      startPolling(selectedRepo.id);
    }
    return () => stopPolling();
  }, [selectedRepoId]);

  const startPolling = useCallback((repoId) => {
    stopPolling();
    pollingRef.current = setInterval(async () => {
      try {
        const data = await getRepoStatus(repoId);
        setLocalStatus(data.status);

        // Update repo in context
        setRepos((prev) =>
          prev.map((r) => (r.id === repoId ? { ...r, ...data } : r))
        );

        if (data.status === 'ready' || data.status === 'error') {
          stopPolling();
          showToast(
            data.status === 'ready'
              ? `${data.repo_name} is ready!`
              : `Error ingesting ${data.repo_name}`,
            data.status === 'ready' ? 'success' : 'error'
          );
        }
      } catch (err) {
        console.error('Status poll error:', err);
      }
    }, 3000);
  }, [setRepos, showToast]);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // ---- Load chat history ----
  const loadHistory = useCallback(async (isInitial = false) => {
    if (!hasMore && !isInitial) return;
    const skip = isInitial ? 0 : currentSkip;

    setLoadingHistory(true);
    try {
      const msgs = await fetchMessages(selectedRepoId, skip, MESSAGES_LIMIT);

      if (msgs.length < MESSAGES_LIMIT) {
        setHasMore(false);
      }

      const formatted = msgs.map((m) => ({
        role: m.role,
        content: m.content,
        isHistory: true,
      }));

      if (isInitial) {
        setHistoryMessages(formatted);
        setCurrentSkip(msgs.length);
      } else {
        setHistoryMessages((prev) => [...formatted, ...prev]);
        setCurrentSkip((prev) => prev + msgs.length);
      }
    } catch (err) {
      console.error('Failed to load history', err);
    } finally {
      setLoadingHistory(false);
    }
  }, [selectedRepoId, currentSkip, hasMore]);

  // ---- Scroll to bottom ----
  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamContent, historyMessages]);

  // ---- Send message ----
  const handleSend = useCallback(async (query) => {
    if (!query.trim() || isStreaming || !selectedRepoId) return;

    if (selectedRepo?.status !== 'ready') {
      showToast('Repository is not ready yet. Please wait for ingestion to complete.', 'info');
      return;
    }

    // Add user message
    setMessages((prev) => [...prev, { role: 'user', content: query }]);
    setIsStreaming(true);
    setStreamContent('');
    setStreamSources([]);

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
              setStreamSources(sources);
            } else if (event.type === 'token') {
              fullResponse += event.content;
              setStreamContent(fullResponse);
            }
          } catch {
            /* skip malformed events */
          }
        }
      }

      // Finalize assistant message
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: fullResponse, sources },
      ]);
      setStreamContent('');
      setStreamSources([]);
    } catch (err) {
      console.error('Stream error:', err);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${err.message}`, sources: [] },
      ]);
      showToast('Failed to get response', 'error');
    } finally {
      setIsStreaming(false);
      if (chatInputRef.current) chatInputRef.current.focus();
    }
  }, [isStreaming, selectedRepoId, selectedRepo, showToast]);

  // ---- No repo selected: welcome screen ----
  if (!selectedRepoId || !selectedRepo) {
    return (
      <div className="welcome-screen" id="welcome-screen" style={{ display: 'flex' }}>
        <div className="welcome-content">
          <div className="welcome-icon">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="url(#grad)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <defs>
                <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={{ stopColor: '#5b9ef5' }} />
                  <stop offset="100%" style={{ stopColor: '#7ab4f7' }} />
                </linearGradient>
              </defs>
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
          </div>
          <h1>Talk to your codebase</h1>
          <p>Add a GitHub repository, wait for ingestion, then start asking questions about the code.</p>
        </div>
      </div>
    );
  }

  // ---- Status badge class ----
  const statusClass =
    localStatus === 'ready' ? 'ready'
    : localStatus === 'pending' ? 'pending'
    : localStatus === 'error' ? 'error'
    : 'processing';

  return (
    <div className="chat-interface" id="chat-interface" style={{ display: 'flex' }}>
      {/* Header */}
      <div className="chat-header" id="chat-header">
        <div className="chat-header-info">
          <span className="chat-repo-name" id="chat-repo-name">{selectedRepo.repo_name}</span>
          <span className={`chat-repo-status ${statusClass}`} id="chat-repo-status">
            {localStatus}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="messages-container" id="messages-container" ref={messagesContainerRef}>
        <div className="messages" id="messages">
          {/* Load More button */}
          {hasMore && historyMessages.length > 0 && (
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <button
                id="load-more-btn"
                onClick={() => loadHistory(false)}
                disabled={loadingHistory}
                style={{
                  background: 'var(--bg-tertiary)',
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '13px',
                  color: 'var(--accent-primary)',
                  border: '1px solid var(--border-medium)',
                }}
              >
                {loadingHistory ? 'Loading...' : 'Load Older Messages'}
              </button>
            </div>
          )}

          {/* History messages */}
          {historyMessages.map((msg, i) => (
            <ChatMessage
              key={`hist-${i}`}
              role={msg.role}
              content={msg.content}
              isHistory={true}
              onShowChunkPreview={setPreviewSource}
            />
          ))}

          {/* Current session messages */}
          {messages.map((msg, i) => (
            <ChatMessage
              key={`msg-${i}`}
              role={msg.role}
              content={msg.content}
              sources={msg.sources || []}
              onShowChunkPreview={setPreviewSource}
            />
          ))}

          {/* Streaming assistant message */}
          {isStreaming && (
            <div className="message assistant">
              <div className="message-avatar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" />
                </svg>
              </div>
              <div className="message-body">
                <StreamingContent content={streamContent} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <ChatInput
        ref={chatInputRef}
        onSend={handleSend}
        disabled={isStreaming}
      />

      {/* Chunk Preview Modal */}
      {previewSource && (
        <ChunkPreview
          source={previewSource}
          onClose={() => setPreviewSource(null)}
        />
      )}
    </div>
  );
}

// ---- Streaming Content sub-component ----
function StreamingContent({ content }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    if (content) {
      ref.current.innerHTML = marked.parse(content);
      ref.current.querySelectorAll('pre code').forEach((b) => {
        if (!b.textContent.trim()) {
          b.parentElement.style.display = 'none';
          return;
        }
        hljs.highlightElement(b);
      });
    } else {
      // Typing indicator
      ref.current.innerHTML = `
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
    }
  }, [content]);

  return <div className="message-content" ref={ref} />;
}

// ---- Chat Input sub-component ----
const ChatInput = React.forwardRef(function ChatInput({ onSend, disabled }, ref) {
  const [value, setValue] = useState('');
  const textareaRef = useRef(null);

  // Expose focus via ref
  React.useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
  }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!value.trim() || disabled) return;
    onSend(value.trim());
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleInput = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  };

  return (
    <div className="chat-input-area" id="chat-input-area">
      <form id="chat-form" className="chat-form" onSubmit={handleSubmit}>
        <div className="input-wrapper">
          <textarea
            ref={textareaRef}
            id="chat-input"
            placeholder="Ask about this repository..."
            rows="1"
            required
            autoComplete="off"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
          />
          <button
            type="submit"
            id="send-btn"
            aria-label="Send message"
            disabled={disabled}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
          </button>
        </div>
        <span className="input-hint">Press Enter to send, Shift+Enter for new line</span>
      </form>
    </div>
  );
});
