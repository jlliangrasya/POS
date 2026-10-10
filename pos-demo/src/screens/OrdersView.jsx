import React from 'react';
import { useStore, useNow } from '../lib/store.js';
import { setStatus, toggleItemServed, nextStatus, NEXT_LABEL, LATE_MINUTES } from '../lib/orders.js';
import { peso } from '../lib/money.js';
import { balanceDue } from '../lib/reports.js';
import { STATUS_LABEL, PAY_LABEL, fmtTime, minsSince } from '../components/ui.jsx';
import { OrderSlip } from './Checkout.jsx';

const STATUS_PILL = { pending: 'promo', preparing: 'warn', ready: 'good', served: 'neutral', void: 'bad' };

/** Full-screen orders list for the cashier. Replaces the menu while the Orders tab is open. */
export default function OrdersView({ shift, staff }) {
  const orders = useStore((s) => s.orders.filter((o) => o.shiftId === shift.id));
  const allStaff = useStore((s) => s.staff);
  const company = useStore((s) => s.company);
  const now = useNow(15000);
  const [tab, setTab] = React.useState('open');
  const [q, setQ] = React.useState('');
  const [selected, setSelected] = React.useState(null);

  const match = (o) => {
    const t = q.trim().toLowerCase();
    return !t || o.customer.toLowerCase().includes(t) || o.no.toLowerCase().includes(t) || (o.table && `table ${o.table}`.includes(t));
  };
  const open = orders.filter((o) => !['served', 'void'].includes(o.status)).filter(match).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const all = orders.filter(match).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const openCount = orders.filter((o) => !['served', 'void'].includes(o.status)).length;
  const late = open.filter((o) => minsSince(o.createdAt, now) >= LATE_MINUTES).length;
  const sel = selected && orders.find((o) => o.id === selected);

  return (
    <section className="orders-view" aria-label="Orders">
      <div className="orders-toolbar">
        <div className="seg" role="group" aria-label="Which orders">
          <button aria-pressed={tab === 'open'} onClick={() => setTab('open')}>Not yet served · {openCount}</button>
          <button aria-pressed={tab === 'all'} onClick={() => setTab('all')}>All orders · {orders.length}</button>
        </div>
        {late > 0 && tab === 'open' && <span className="pill bad">{late} waiting over {LATE_MINUTES} min</span>}
        <div className="spacer" />
        <input id="order-search" className="input" style={{ maxWidth: 260 }} placeholder="Search name, order #, table" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {tab === 'open' && (open.length === 0 ? (
        <div className="empty big">
          <strong>{q ? 'No matching orders' : 'Everyone has been served'}</strong>
          <span className="small">Orders stay here until they are marked served.</span>
        </div>
      ) : (
        <div className="order-grid">
          {open.map((o) => {
            const waited = minsSince(o.createdAt, now);
            const isLate = waited >= LATE_MINUTES;
            const left = o.items.filter((i) => !i.served).length;
            return (
              <article key={o.id} className={`kcard ${isLate ? 'late' : o.status}`}>
                <div className="row" style={{ gap: 8 }}>
                  <span className="kno">{o.no}</span>
                  <strong className="ocust">{o.customer}</strong>
                  <div className="spacer" />
                  <span className="timer" style={{ color: isLate ? 'var(--bad)' : 'var(--muted)' }}>{waited} min</span>
                </div>
                <div className="row small" style={{ gap: 8 }}>
                  <span className={`pill ${STATUS_PILL[o.status]}`}>{STATUS_LABEL[o.status]}</span>
                  <span className="muted">{o.type === 'dine_in' ? `Table ${o.table || '—'}` : 'Take out'}</span>
                  {!o.synced && <span className="pill warn">Not sent yet</span>}
                  {balanceDue(o) > 0 && <span className="pill warn">Pay later</span>}
                </div>
                <div className="kitems">
                  {o.items.map((i) => (
                    <label key={i.key} className={`kitem${i.served ? ' done' : ''}`}>
                      <input type="checkbox" checked={i.served} onChange={() => toggleItemServed(o.id, i.key)} aria-label={`Served ${i.name}`} />
                      <span className="kname"><strong>{i.qty}×</strong> {i.name}{i.notes ? <span className="muted"> · {i.notes}</span> : null}</span>
                    </label>
                  ))}
                </div>
                {o.items.length > 4 && <div className="more-hint">{o.items.length} items · scroll to see all</div>}
                <div className="row" style={{ gap: 8 }}>
                  {o.status === 'ready' ? (
                    <button className="btn primary block" onClick={() => setStatus(o.id, 'served')}>Mark served</button>
                  ) : (
                    <>
                      <button className="btn" style={{ flex: 1 }} onClick={() => setStatus(o.id, nextStatus(o.status))}>{NEXT_LABEL[o.status]}</button>
                      <button className="btn primary" style={{ flex: 1 }} onClick={() => setStatus(o.id, 'served')}>
                        {left === o.items.length ? 'All served' : `Served (${left} left)`}
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ))}

      {tab === 'all' && (
        <div className="orders-split">
          <div className="panel" style={{ padding: 0 }}>
            <div className="tablewrap">
              <table className="t clickable">
                <thead><tr><th>Order</th><th>Time</th><th>Customer</th><th>Paid by</th><th>Status</th><th className="r">Total</th></tr></thead>
                <tbody>
                  {all.map((o) => (
                    <tr key={o.id} aria-selected={selected === o.id} onClick={() => setSelected(o.id)} tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter') setSelected(o.id); }}>
                      <td className="mono">{o.no}</td>
                      <td>{fmtTime(o.createdAt)}</td>
                      <td>{o.customer}</td>
                      <td>{o.payments.length ? o.payments.map((p) => PAY_LABEL[p.method]).join(' + ') : balanceDue(o) > 0 ? <span className="pill warn">Unpaid</span> : '—'}</td>
                      <td><span className={`pill ${STATUS_PILL[o.status]}`}>{STATUS_LABEL[o.status]}</span></td>
                      <td className="r">{peso(o.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <aside className="panel slip-panel">
            {sel ? (
              <>
                <div className="row"><h3>Order {sel.no}</h3><div className="spacer" /><button className="btn ghost sm" onClick={() => setSelected(null)}>Close</button></div>
                <OrderSlip order={sel} company={company} staff={allStaff.find((s) => s.id === sel.createdBy)} />
                <p className="small muted">Only the owner can void an order.</p>
              </>
            ) : (
              <div className="empty"><strong>Tap an order</strong><span className="small">Its order slip shows here.</span></div>
            )}
          </aside>
        </div>
      )}
    </section>
  );
}
