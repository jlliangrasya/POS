import React from 'react';
import { useStore, useNow } from '../lib/store.js';
import { PAY_REMINDER_MINUTES } from '../lib/orders.js';
import { balanceDue, unpaidOrders } from '../lib/reports.js';
import { peso } from '../lib/money.js';
import { STATUS_LABEL, fmtTime, minsSince } from '../components/ui.jsx';
import Checkout from './Checkout.jsx';

const STAGES = [
  { id: 'due', title: 'Served · collect now', hint: 'Done eating soon. Ask for payment.' },
  { id: 'eating', title: 'Eating', hint: 'Served less than ' },
  { id: 'kitchen', title: 'In the kitchen', hint: 'Not served yet.' },
];

/** Where a pay-later order is in its path from kitchen to payment. */
export function payStage(o, now = Date.now()) {
  if (o.status !== 'served') return 'kitchen';
  return minsSince(o.servedAt || o.createdAt, now) >= PAY_REMINDER_MINUTES ? 'due' : 'eating';
}

/** Pay-later orders across all shifts, grouped by how close they are to paying. */
export default function UnpaidView({ staff, shift }) {
  const unpaid = useStore((s) => unpaidOrders(s.orders));
  const shifts = useStore((s) => s.shifts);
  const now = useNow(15000);
  // A snapshot: once paid, the order leaves `unpaid` but the receipt still shows.
  const [collecting, setCollecting] = React.useState(null);
  const total = unpaid.reduce((s, o) => s + balanceDue(o), 0);

  return (
    <section className="orders-view" aria-label="Unpaid orders">
      <div className="orders-toolbar">
        <h2 style={{ margin: 0 }}>Pay after eating</h2>
        <span className="pill warn">{unpaid.length} unpaid · {peso(total)}</span>
        <div className="spacer" />
        <span className="small muted">Choose “Pay after eating” at payment to add an order here.</span>
      </div>

      {unpaid.length === 0 ? (
        <div className="empty big">
          <strong>Everyone has paid</strong>
          <span className="small">Orders paid after the meal show here until you collect.</span>
        </div>
      ) : STAGES.map((st) => {
        const list = unpaid.filter((o) => payStage(o, now) === st.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        if (!list.length) return null;
        return (
          <div key={st.id} className="stack" style={{ gap: 10 }}>
            <div className="row" style={{ gap: 8 }}>
              <h3 style={{ margin: 0 }}>{st.title}</h3>
              <span className={`pill ${st.id === 'due' ? 'bad' : 'neutral'}`}>{list.length}</span>
              <span className="small muted">{st.id === 'eating' ? `${st.hint}${PAY_REMINDER_MINUTES} min ago.` : st.hint}</span>
            </div>
            <div className="order-grid">
              {list.map((o) => {
                const sh = shifts.find((x) => x.id === o.shiftId);
                const fromEarlier = o.shiftId !== shift.id;
                return (
                  <article key={o.id} className={`kcard ${st.id === 'due' ? 'late' : o.status === 'served' ? 'ready' : o.status}`}>
                    <div className="row" style={{ gap: 8 }}>
                      <span className="kno">{o.no}</span>
                      <strong className="ocust">{o.customer}</strong>
                      <div className="spacer" />
                      <strong className="num">{peso(balanceDue(o))}</strong>
                    </div>
                    <div className="row small" style={{ gap: 8 }}>
                      <span className="muted">{o.type === 'dine_in' ? `Table ${o.table || '—'}` : 'Take out'}</span>
                      <span className="muted">Ordered {fmtTime(o.createdAt)}</span>
                      {o.status === 'served'
                        ? <span className={`pill ${st.id === 'due' ? 'bad' : 'good'}`}>Served {minsSince(o.servedAt || o.createdAt, now)} min ago</span>
                        : <span className="pill neutral">{STATUS_LABEL[o.status]}</span>}
                      {fromEarlier && <span className="pill warn">From {sh ? `${sh.label.toLowerCase()} shift` : 'earlier shift'}</span>}
                    </div>
                    <div className="small muted">{o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}</div>
                    <button className={`btn block ${st.id === 'due' ? 'hot' : 'primary'}`} onClick={() => setCollecting(o)}>
                      Collect {peso(balanceDue(o))}
                    </button>
                  </article>
                );
              })}
            </div>
          </div>
        );
      })}

      {collecting && (
        <Checkout
          staff={staff} shift={shift} collect={collecting}
          meta={{ customer: '', orderType: 'dine_in', table: '' }}
          onClose={() => setCollecting(null)} onDone={() => setCollecting(null)}
        />
      )}
    </section>
  );
}
