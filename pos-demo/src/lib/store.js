// Demo store: one state object saved in this browser and shared live across open tabs.
// In the real build this is replaced by Dexie (local) + Supabase sync.
import React from 'react';
import { buildSeed } from './seed.js';

const KEY = 'tasa-pos-demo-v3';
let state = load();
const listeners = new Set();
let channel = null;
try { channel = new BroadcastChannel('tasa-pos-demo'); } catch (e) { channel = null; }

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* storage blocked: fall back to fresh data */ }
  return buildSeed();
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
}

function emit() { listeners.forEach((l) => l()); }

if (channel) {
  channel.onmessage = (ev) => {
    if (ev.data && ev.data.type === 'state') { state = ev.data.state; emit(); }
  };
}

export const store = {
  get: () => state,
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  /** @param {(draft:any)=>void} fn */
  update(fn) {
    const draft = structuredClone(state);
    fn(draft);
    state = draft;
    save();
    emit();
    // The device session (who is logged in) stays per tab; everything else is shared.
    if (channel) channel.postMessage({ type: 'state', state });
  },
  reset() {
    state = buildSeed();
    save();
    emit();
    if (channel) channel.postMessage({ type: 'state', state });
  },
};

export function useStore(selector = (s) => s) {
  const s = React.useSyncExternalStore(store.subscribe, store.get);
  return selector(s);
}

export const uid = (p = 'id') =>
  `${p}-${(typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10)}`;

/** Re-render every `ms` so timers on screen stay current. */
export function useNow(ms = 30000) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}
