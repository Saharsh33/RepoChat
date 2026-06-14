/* ============================================
   RepoChat — React Entry Point
   ============================================ */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './style.css';
import 'highlight.js/styles/github.css';

ReactDOM.createRoot(document.getElementById('app')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
