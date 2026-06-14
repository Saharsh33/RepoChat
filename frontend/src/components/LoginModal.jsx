/* ============================================
   RepoChat — Login Modal Component
   ============================================ */

import React, { useState } from 'react';
import { login, register, getGoogleLoginUrl } from '../api.js';

export default function LoginModal({ onSuccess }) {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      if (isLoginMode) {
        await login(username, password);
      } else {
        await register(username, password);
      }
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = getGoogleLoginUrl();
  };

  return (
    <div className="modal-overlay" style={{ display: 'flex' }}>
      <div className="modal-content">
        {/* Logo */}
        <div className="logo" style={{ justifyContent: 'center', marginBottom: '24px' }}>
          <span className="logo-text" style={{ fontSize: '24px' }}>RepoChat</span>
        </div>

        {/* Login / Signup Toggle */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
          <button
            id="toggle-login"
            onClick={() => { setIsLoginMode(true); setError(''); }}
            style={{
              flex: 1,
              padding: '8px',
              borderBottom: `2px solid ${isLoginMode ? 'var(--accent-primary)' : 'transparent'}`,
              color: isLoginMode ? 'var(--text-primary)' : 'var(--text-muted)',
            }}
          >
            Login
          </button>
          <button
            id="toggle-signup"
            onClick={() => { setIsLoginMode(false); setError(''); }}
            style={{
              flex: 1,
              padding: '8px',
              borderBottom: `2px solid ${!isLoginMode ? 'var(--accent-primary)' : 'transparent'}`,
              color: !isLoginMode ? 'var(--text-primary)' : 'var(--text-muted)',
            }}
          >
            Sign Up
          </button>
        </div>

        {/* Auth Form */}
        <form id="auth-form" onSubmit={handleSubmit}>
          <input
            type="text"
            id="auth-username"
            placeholder="Username"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ marginBottom: '12px' }}
          />
          <input
            type="password"
            id="auth-password"
            placeholder="Password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ marginBottom: '12px' }}
          />
          <button
            type="submit"
            id="auth-btn"
            disabled={submitting}
            style={{ width: '100%' }}
          >
            {submitting
              ? (isLoginMode ? 'Logging in...' : 'Signing up...')
              : (isLoginMode ? 'Login' : 'Sign Up')}
          </button>
        </form>

        {/* Error */}
        {error && (
          <p
            id="auth-error"
            style={{
              color: 'var(--error)',
              fontSize: '13px',
              marginTop: '10px',
              textAlign: 'center',
            }}
          >
            {error}
          </p>
        )}

        {/* Divider */}
        <div style={{ textAlign: 'center', margin: '16px 0', color: 'var(--text-muted)', fontSize: '12px' }}>
          OR
        </div>

        {/* Google OAuth */}
        <button
          id="google-auth-btn"
          onClick={handleGoogleLogin}
          style={{
            width: '100%',
            padding: '12px',
            background: 'white',
            color: 'black',
            borderRadius: '8px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          <img src="https://www.svgrepo.com/show/475656/google-color.svg" width="18" alt="Google" />
          Continue with Google
        </button>
      </div>
    </div>
  );
}
