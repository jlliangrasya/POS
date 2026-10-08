import React from 'react';

export function Modal({ title, onClose, children, footer, wide }) {
  React.useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose && onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}>
      <div className={`modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <div className="spacer" />
          {onClose && <button className="btn ghost sm" onClick={onClose} aria-label="Close">✕</button>}
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Avatar({ staff, size = 30 }) {
  if (!staff) return null;
  const initials = staff.name.split(' ').map((p) => p[0]).slice(0, 2).join('');
  return (
    <span className="avatar" style={{ width: size, height: size, background: `hsl(${staff.hue} 45% 42%)`, fontSize: size * 0.36 }}>
      {initials}
    </span>
  );
}

const PATHS = {
  pos: 'M4 5h16v10H4zM8 19h8M12 15v4',
  kitchen: 'M6 3v8a3 3 0 0 0 6 0V3M9 3v18M17 3c-1.7 1-3 3.4-3 6s1 4 3 4v8',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  box: 'M3 7l9-4 9 4-9 4-9-4zM3 7v10l9 4 9-4V7M12 11v10',
  tag: 'M3 12V3h9l9 9-9 9-9-9zM7.5 7.5h.01',
  wallet: 'M3 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7zm0 0V6a2 2 0 0 1 2-2h11M17 13h.01',
  users: 'M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 20v-2a4 4 0 0 0-3-3.9M16 2.1a4 4 0 0 1 0 7.8',
  cash: 'M2 6h20v12H2zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 12h.01M18 12h.01',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  ticket: 'M3 7a2 2 0 0 0 0 4v6h18v-6a2 2 0 0 1 0-4V3H3zM13 3v18',
  wifi: 'M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 20h.01M2 9a15 15 0 0 1 20 0',
  back: 'M15 18l-6-6 6-6',
};

export function Icon({ name, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

const ToastCtx = React.createContext(() => {});
export function ToastProvider({ children }) {
  const [msg, setMsg] = React.useState(null);
  const show = React.useCallback((m) => {
    setMsg(m);
    clearTimeout(show.t);
    show.t = setTimeout(() => setMsg(null), 2600);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg && <div className="toast" role="status">{msg}</div>}
    </ToastCtx.Provider>
  );
}
export const useToast = () => React.useContext(ToastCtx);

export const fmtTime = (iso) => (iso ? new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' }) : '—');
export const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
export const fmtDateLong = (iso) => new Date(iso).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' });
export const minsSince = (iso, now = Date.now()) => Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));

export const ROLE_LABEL = { cashier: 'Cashier', kitchen: 'Kitchen / barista', server: 'Server' };
export const PAY_LABEL = { cash: 'Cash', gcash: 'GCash', maya: 'Maya', card: 'Card' };
export const STATUS_LABEL = { pending: 'New', preparing: 'Preparing', ready: 'Ready', served: 'Served', void: 'Void' };
