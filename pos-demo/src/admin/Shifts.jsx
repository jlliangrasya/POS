import React from 'react';
import { store, useStore } from '../lib/store.js';
import { shiftSummary, unpaidOrders, balanceDue } from '../lib/reports.js';
import { peso } from '../lib/money.js';
import { Modal, PAY_LABEL, STATUS_LABEL, fmtTime, fmtDateLong, useToast } from '../components/ui.jsx';
import { OrderSlip } from '../screens/Checkout.jsx';
import { SalesBreakdown } from '../screens/ShiftView.jsx';

function OverShort({ v }) {
  if (v === undefined || v === null) return <span className="muted">—</span>;
  if (v === 0) return <span className="pill good">Balanced</span>;
  return v < 0 ? <span className="pill bad">Short {peso(-v)}</span> : <span className="pill warn">Over {peso(v)}</span>;
}

export default function Shifts() {
  const shifts = useStore((s) => s.shifts);
  const orders = useStore((s) => s.orders);
  const expenses = useStore((s) => s.expenses);
  const staff = useStore((s) => s.staff);
  const [open, setOpen] = React.useState(null);
  const unpaid = unpaidOrders(orders);
  const list = [...shifts].sort((a, b) => b.openedAt.localeCompare(a.openedAt));
  const nm = (id) => (staff.find((s) => s.id === id) || { name: '—' }).name;
  const shortTotal = shifts.filter((s) => s.overShort < 0).reduce((t, s) => t + s.overShort, 0);

  return (
    <>
      <div className="page-head">
        <div><span className="label">Cash control</span><h1>Shifts and orders</h1></div>
        <div className="spacer" />
        {unpaid.length > 0 && <span className="pill warn">Unpaid now: {unpaid.length} · {peso(unpaid.reduce((t, o) => t + balanceDue(o), 0))}</span>}
        {shortTotal < 0 && <span className="pill bad">Shortages, last 14 days: {peso(-shortTotal)}</span>}
      </div>
      <section className="panel">
        <p className="small muted">Every shift starts at ₱0.00 and is kept here. Tap a shift to see its orders.</p>
        <div className="tablewrap">
          <table className="t">
            <thead><tr><th>Date</th><th>Shift</th><th>Cashier</th><th className="r">Orders</th><th className="r">Total sales</th><th className="r">Expenses</th><th className="r">Cash expected</th><th className="r">Counted</th><th>Drawer</th><th /></tr></thead>
            <tbody>
              {list.map((s) => {
                const sum = shiftSummary(s, orders, expenses);
                return (
                  <tr key={s.id}>
                    <td>{fmtDateLong(s.openedAt)}</td>
                    <td>{s.label}</td>
                    <td>{nm(s.openedBy)}</td>
                    <td className="r">{sum.count}</td>
                    <td className="r">{peso(sum.net)}</td>
                    <td className="r">{sum.expenses ? peso(sum.expenses) : <span className="muted">—</span>}</td>
                    <td className="r">{peso(s.status === 'open' ? sum.expectedCash : s.expectedCash)}</td>
                    <td className="r">{s.status === 'open' ? '—' : peso(s.countedCash)}</td>
                    <td>{s.status === 'open' ? <span className="pill info">Open now</span> : <OverShort v={s.overShort} />}</td>
                    <td><button className="btn sm" onClick={() => setOpen(s.id)}>View</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      {open && <ShiftDetail shift={shifts.find((s) => s.id === open)} onClose={() => setOpen(null)} />}
    </>
  );
}

function ShiftDetail({ shift, onClose }) {
  const allOrders = useStore((s) => s.orders);
  const orders = allOrders.filter((o) => o.shiftId === shift.id);
  const expenses = useStore((s) => s.expenses);
  const staff = useStore((s) => s.staff);
  const company = useStore((s) => s.company);
  const toast = useToast();
  const [view, setView] = React.useState(null);
  const [voiding, setVoiding] = React.useState(false);
  const sum = shiftSummary(shift, allOrders, expenses);
  const shiftExpenses = expenses.filter((e) => e.shiftId === shift.id);
  const sorted = [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const order = view && orders.find((o) => o.id === view);

  if (order) {
    return (
      <Modal title={`Order ${order.no}`} onClose={() => { setView(null); setVoiding(false); }}
        footer={order.status === 'void' ? <span className="pill bad">Voided</span> : voiding ? (
          <><span className="small muted">Void this order? Sales and reports will exclude it.</span>
            <button className="btn" onClick={() => setVoiding(false)}>Keep</button>
            <button className="btn primary" onClick={() => {
              store.update((d) => { d.orders.find((x) => x.id === order.id).status = 'void'; });
              toast(`Order ${order.no} voided.`); setVoiding(false);
            }}>Void order</button></>
        ) : <button className="btn danger" onClick={() => setVoiding(true)}>Void order</button>}>
        <OrderSlip order={order} company={company} staff={staff.find((s) => s.id === order.createdBy)} />
      </Modal>
    );
  }

  return (
    <Modal title={`${shift.label} shift · ${fmtDateLong(shift.openedAt)}`} onClose={onClose} wide>
      <div className="kpis">
        <div className="kpi"><span className="label">Orders</span><span className="v">{sum.count}</span></div>
        <div className="kpi"><span className="label">Total sales</span><span className="v">{peso(sum.net)}</span></div>
        <div className="kpi"><span className="label">Expenses</span><span className="v">{peso(sum.expenses)}</span></div>
        <div className="kpi"><span className="label">Not paid yet</span><span className="v">{peso(sum.unpaidTotal)}</span></div>
      </div>
      <div className="twocol">
        <section>
          <h3>Where the sales are</h3>
          <SalesBreakdown shift={shift} sum={sum} />
        </section>
        <section>
          <h3>Expenses from the drawer</h3>
          {shiftExpenses.length === 0 ? <p className="muted small">None this shift.</p> : (
            <div className="tablewrap">
              <table className="t">
                <tbody>
                  {shiftExpenses.map((e) => (
                    <tr key={e.id}><td>{fmtTime(e.at)}</td><td>{e.notes}<div className="small muted">{e.category}</div></td><td className="r">{peso(e.amount)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
      <div className="tablewrap">
        <table className="t">
          <thead><tr><th>Order</th><th>Time</th><th>Customer</th><th>Paid by</th><th>Status</th><th className="r">Total</th><th /></tr></thead>
          <tbody>
            {sorted.map((o) => (
              <tr key={o.id} style={o.status === 'void' ? { opacity: 0.55 } : null}>
                <td className="mono">{o.no}</td>
                <td>{fmtTime(o.createdAt)}</td>
                <td>{o.customer}</td>
                <td>{o.payments.length ? o.payments.map((p) => PAY_LABEL[p.method]).join(' + ') : balanceDue(o) > 0 ? <span className="pill warn">Unpaid</span> : '—'}</td>
                <td>{STATUS_LABEL[o.status]}</td>
                <td className="r">{peso(o.total)}</td>
                <td><button className="btn sm" onClick={() => setView(o.id)}>Slip</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
