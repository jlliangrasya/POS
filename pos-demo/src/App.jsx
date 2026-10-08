import React from 'react';
import { store, useStore } from './lib/store.js';
import { Icon, ToastProvider, useToast } from './components/ui.jsx';
import Landing from './screens/Landing.jsx';
import PosDevice from './screens/PosDevice.jsx';
import Kitchen from './screens/Kitchen.jsx';
import Admin from './admin/Admin.jsx';

const MODES = ['pos', 'kitchen', 'admin'];
const readHash = () => {
  try { const h = window.location.hash.replace('#', ''); return MODES.includes(h) ? h : 'landing'; } catch (e) { return 'landing'; }
};

const THEME_KEY = 'tasa-pos-theme';
function applyTheme(t) {
  const el = document.documentElement;
  if (t === 'auto') el.removeAttribute('data-theme'); else el.setAttribute('data-theme', t);
}
function useTheme() {
  const [theme, setTheme] = React.useState(() => {
    try { return localStorage.getItem(THEME_KEY) || 'light'; } catch (e) { return 'light'; }
  });
  React.useEffect(() => {
    applyTheme(theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* ignore */ }
  }, [theme]);
  return [theme, setTheme];
}

function DemoBar({ mode, setMode }) {
  const [theme, setTheme] = useTheme();
  const offline = useStore((s) => s.offline);
  const pending = useStore((s) => s.orders.filter((o) => !o.synced).length);
  const toast = useToast();
  const [armed, setArmed] = React.useState(false);

  const setOffline = (v) => {
    store.update((d) => {
      d.offline = v;
      if (!v) d.orders.forEach((o) => { o.synced = true; });
    });
    if (!v && pending) toast(`Back online. ${pending} order${pending > 1 ? 's' : ''} synced to the kitchen and cloud.`);
    else toast(v ? 'Internet is off. The POS keeps working.' : 'Back online.');
  };

  return (
    <div className="demobar">
      <strong>Demo</strong>
      <span className="small" style={{ opacity: 0.8 }}>Example data, saved only in this browser</span>
      <div className="spacer" />
      {mode !== 'landing' && (
        <button className="btn" onClick={() => setMode('landing')}><Icon name="back" size={14} /> Switch screen</button>
      )}
      <div className="theme-seg" role="group" aria-label="Theme">
        {[['light', 'Light'], ['dark', 'Dark'], ['auto', 'Auto']].map(([k, l]) => (
          <button key={k} aria-pressed={theme === k} onClick={() => setTheme(k)}>{l}</button>
        ))}
      </div>
      <label className="switch">
        <input id="demo-offline" type="checkbox" checked={offline} onChange={(e) => setOffline(e.target.checked)} />
        Simulate no internet
      </label>
      <button
        className="btn"
        onClick={() => {
          if (!armed) { setArmed(true); setTimeout(() => setArmed(false), 3000); return; }
          store.reset(); setArmed(false); toast('Demo data reset.');
        }}
      >
        {armed ? 'Tap again to reset' : 'Reset demo'}
      </button>
    </div>
  );
}

export default function App() {
  const [mode, setModeState] = React.useState(readHash);
  const setMode = (m) => {
    setModeState(m);
    try { window.history.replaceState(null, '', m === 'landing' ? window.location.pathname : `#${m}`); } catch (e) { /* ignore */ }
    window.scrollTo(0, 0);
  };
  return (
    <ToastProvider>
      <DemoBar mode={mode} setMode={setMode} />
      <div className="rainbow" aria-hidden="true" />
      {mode === 'landing' && <Landing onPick={setMode} />}
      {mode === 'pos' && <PosDevice />}
      {mode === 'kitchen' && <Kitchen />}
      {mode === 'admin' && <Admin />}
    </ToastProvider>
  );
}
