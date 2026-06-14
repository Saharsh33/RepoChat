/* ============================================
   RepoChat — Toast Component
   ============================================ */

import React, { useEffect, useRef } from 'react';

export default function Toast({ toasts, onRemove }) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onRemove }) {
  const ref = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (ref.current) {
        ref.current.style.opacity = '0';
        ref.current.style.transform = 'translateX(20px)';
        ref.current.style.transition = '300ms ease';
      }
      setTimeout(() => onRemove(toast.id), 300);
    }, 3200);

    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  return (
    <div ref={ref} className={`toast ${toast.type}`}>
      {toast.message}
    </div>
  );
}
