import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { STATUTS, initials } from '../utils.js';

// ───────── Notifications (toasts) ─────────
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
const TOAST_ICON = { ok: '✓', error: '!', info: 'i' };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, type = 'ok') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span className="toast-icon">{TOAST_ICON[t.type]}</span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ───────── Fenêtre modale (Échap et clic extérieur pour fermer) ─────────
export function Modal({ title, onClose, children, footer, wide = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmModal({ title, message, confirmLabel = 'Confirmer', danger = false, busy = false, onConfirm, onClose }) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Retour
          </button>
          <button className={`btn ${danger ? 'btn-danger-solid' : 'btn-primary'}`} onClick={onConfirm} disabled={busy}>
            {busy ? 'Patientez…' : confirmLabel}
          </button>
        </>
      }
    >
      <p className="confirm-text">{message}</p>
    </Modal>
  );
}

// ───────── Petits composants ─────────
export function Avatar({ nom, id = 0, size = 48 }) {
  const hue = (id * 47 + 20) % 360;
  return (
    <div
      className="avatar"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `linear-gradient(135deg, hsl(${hue} 65% 42%), hsl(${(hue + 40) % 360} 65% 34%))`,
      }}
      aria-hidden="true"
    >
      {initials(nom)}
    </div>
  );
}

export function StatusBadge({ statut }) {
  const s = STATUTS[statut] || { label: statut, tone: 'info' };
  return <span className={`badge badge-${s.tone}`}>{s.label}</span>;
}

export function Empty({ icon = '📭', title, text, action }) {
  return (
    <div className="empty">
      <div className="empty-icon" aria-hidden="true">
        {icon}
      </div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

export function SkeletonCards({ n = 6 }) {
  return (
    <div className="grid" aria-busy="true">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="card skeleton-card">
          <div className="skeleton" style={{ width: 52, height: 52, borderRadius: 16 }} />
          <div className="skeleton" style={{ width: '70%', height: 16 }} />
          <div className="skeleton" style={{ width: '45%', height: 12 }} />
          <div className="skeleton" style={{ width: '100%', height: 44 }} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonRows({ n = 3 }) {
  return (
    <div className="list" aria-busy="true">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="card skeleton" style={{ height: 88 }} />
      ))}
    </div>
  );
}
