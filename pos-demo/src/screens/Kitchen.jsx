import React from 'react';
import { useStore, useNow } from '../lib/store.js';
import { setStatus, toggleItemServed, nextStatus, NEXT_LABEL, LATE_MINUTES } from '../lib/orders.js';
import { Icon, minsSince, fmtTime } from '../components/ui.jsx';
import { PosTopBar } from './Pos.jsx';

const COLS = [
  { status: 'pending', title: 'New', pill: 'info' },
  { status: 'preparing', title: 'Preparing', pill: 'promo' },
  { status: 'ready', title: 'Ready to serve', pill: 'good' },
];

export default function Kitchen() {
  const offline = useStore((s) => s.offline);
  const shift = useStore((s) => s.shifts.find((x) => x.status === 'open'));
  const orders = useStore((s) => s.orders.filter((o) => o.synced && ['pending', 'preparing', 'ready'].includes(o.status)));
  const served = useStore((s) => s.orders.filter((o) => shift && o.shiftId === shift.id && o.status === 'served' && o.servedAt));
  const now = useNow(10000);

  const sorted = [...orders].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const avg = served.length ? Math.round(served.reduce((s, o) => s + (new Date(o.servedAt) - new Date(o.createdAt)), 0) / served.length / 60000) : null;
  const lateCount = sorted.filter((o) => minsSince(o.createdAt, now) >= LATE_MINUTES).length;

  return (
    <>
      <PosTopBar shift={shift}>
        <span className="pill neutral">{sorted.length} waiting</span>
        {lateCount > 0 && <span className="pill bad">{lateCount} over {LATE_MINUTES} min</span>}
        {avg !== null && <span className="pill neutral">Avg serving time {avg} min</span>}
      </PosTopBar>
      {offline && (
        <div className="offline-banner"><Icon name="wifi" size={18} />Offline. New orders from the cashier will appear here once the internet is back.</div>
      )}
      <main className="kitchen">
        <div className="kcols">
          {COLS.map((c) => {
            const list = sorted.filter((o) => o.status === c.status);
            return (
              <section key={c.status} className="kcol" aria-label={c.title}>
                <div className="kcol-head"><h2>{c.title}</h2><span className={`pill ${c.pill}`}>{list.length}</span></div>
                {list.length === 0 && <div className="empty small">Nothing here</div>}
                {list.map((o) => {
                  const waited = minsSince(o.createdAt, now);
                  const late = waited >= LATE_MINUTES;
                  return (
                    <article key={o.id} className={`kcard ${late ? 'late' : o.status}`}>
                      <div className="row">
                        <span className="kno">{o.no}</span>
                        <strong style={{ minWidth: 0 }}>{o.customer}</strong>
                        <div className="spacer" />
                        <span className="timer" style={{ color: late ? 'var(--bad)' : 'var(--muted)' }}>{waited} min</span>
                      </div>
                      <div className="row small muted" style={{ gap: 8 }}>
                        <span>{o.type === 'dine_in' ? `Dine in · Table ${o.table || '—'}` : 'Take out'}</span>
                        <span>Ordered {fmtTime(o.createdAt)}</span>
                      </div>
                      {late && <span className="pill bad">Waiting too long</span>}
                      <div>
                        {o.items.map((i) => (
                          <label key={i.key} className={`kitem${i.served ? ' done' : ''}`}>
                            <input type="checkbox" checked={i.served} onChange={() => toggleItemServed(o.id, i.key)} aria-label={`Served ${i.name}`} />
                            <span className="kname">
                              <strong>{i.qty}×</strong> {i.name}
                              {i.addons && i.addons.length > 0 && <span className="muted"> · {i.addons.join(', ')}</span>}
                              {i.notes && <><br /><span className="small" style={{ color: 'var(--promo)' }}>{i.notes}</span></>}
                            </span>
                          </label>
                        ))}
                      </div>
                      <button className={`btn block ${o.status === 'ready' ? 'primary' : ''}`} onClick={() => setStatus(o.id, nextStatus(o.status))}>
                        {NEXT_LABEL[o.status]}
                      </button>
                    </article>
                  );
                })}
              </section>
            );
          })}
        </div>
      </main>
    </>
  );
}
