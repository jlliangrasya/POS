import React from 'react';
import { useStore } from '../lib/store.js';
import { validOrders, orderCost } from '../lib/reports.js';
import { peso, pesoShort } from '../lib/money.js';
import { dayKey } from '../lib/seed.js';
import { PAY_LABEL, fmtDateLong } from '../components/ui.jsx';
import { METHOD_COLOR } from '../screens/ShiftView.jsx';

const RANGES = [
  { id: 'today', label: 'Today', days: 1 },
  { id: '7', label: 'Last 7 days', days: 7 },
  { id: '14', label: 'Last 14 days', days: 14 },
];

export function rangeStart(days) {
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (days - 1));
  return d;
}

export function payrollCostFor(attendance, staff, fromKey) {
  return attendance.filter((a) => a.date >= fromKey && a.timeOut).reduce((s, a) => {
    const st = staff.find((x) => x.id === a.staffId);
    return s + (st ? st.rate : 0);
  }, 0);
}

function SalesChart({ days }) {
  // Daily net sales, one bar per day. Single series: the title names it, no legend.
  const [hover, setHover] = React.useState(null);
  const W = 640, H = 220, padL = 52, padB = 26, padT = 12, padR = 8;
  const max = Math.max(...days.map((d) => d.net), 1);
  const step = max > 2000000 ? 1000000 : max > 1000000 ? 500000 : 250000;
  const top = Math.ceil(max / step) * step;
  const ticks = []; for (let v = 0; v <= top; v += step) ticks.push(v);
  const y = (v) => padT + (H - padT - padB) * (1 - v / top);
  const bw = (W - padL - padR) / days.length;
  return (
    <div className="chart" style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Net sales per day">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth="1" />
            <text x={padL - 8} y={y(t) + 4} textAnchor="end">{pesoShort(t).replace('₱', '₱')}</text>
          </g>
        ))}
        {days.map((d, i) => {
          const x = padL + i * bw + 1;
          const w = Math.max(2, bw - 2 - Math.min(10, bw * 0.25));
          const h = Math.max(0, y(0) - y(d.net));
          const r = Math.min(4, w / 2, h);
          const bx = x + (bw - 2 - w) / 2;
          const yy = y(d.net);
          const path = h > 0
            ? `M${bx},${y(0)} V${yy + r} Q${bx},${yy} ${bx + r},${yy} H${bx + w - r} Q${bx + w},${yy} ${bx + w},${yy + r} V${y(0)} Z`
            : '';
          const showLabel = days.length <= 7 || i % 2 === (days.length - 1) % 2;
          return (
            <g key={d.key} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={padL + i * bw} y={padT} width={bw} height={H - padT - padB} fill="transparent" />
              {path && <path d={path} fill="var(--accent)" opacity={hover === null || hover === i ? 1 : 0.45} />}
              {showLabel && <text x={padL + i * bw + bw / 2} y={H - 8} textAnchor="middle">{d.label}</text>}
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div className="small" style={{ position: 'absolute', top: 0, right: 0, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: '6px 10px', boxShadow: 'var(--shadow)' }}>
          <strong>{fmtDateLong(days[hover].date)}</strong><br />{peso(days[hover].net)} · {days[hover].count} orders
        </div>
      )}
    </div>
  );
}

export default function Reports() {
  const orders = useStore((s) => s.orders);
  const expenses = useStore((s) => s.expenses);
  const attendance = useStore((s) => s.attendance);
  const staff = useStore((s) => s.staff);
  const shifts = useStore((s) => s.shifts);
  const [range, setRange] = React.useState('7');
  const days = RANGES.find((r) => r.id === range).days;
  const from = rangeStart(days);
  const fromKey = dayKey(from);
  const inRange = validOrders(orders).filter((o) => new Date(o.createdAt) >= from);

  const net = inRange.reduce((s, o) => s + o.total, 0);
  const vat = inRange.reduce((s, o) => s + o.vatAmount, 0);
  const cogs = inRange.reduce((s, o) => s + orderCost(o), 0);
  const disc = inRange.reduce((s, o) => s + o.discountTotal, 0);
  const exp = expenses.filter((e) => e.date >= fromKey).reduce((s, e) => s + e.amount, 0);
  const pay = payrollCostFor(attendance, staff, fromKey);
  const profit = net - vat - cogs - exp - pay;

  const chartDays = [];
  const nDays = Math.max(days, 7);
  for (let i = nDays - 1; i >= 0; i--) {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
    const k = dayKey(d);
    const list = validOrders(orders).filter((o) => dayKey(o.createdAt) === k);
    chartDays.push({ key: k, date: d.toISOString(), label: d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }), net: list.reduce((s, o) => s + o.total, 0), count: list.length });
  }

  const byMethod = { cash: 0, gcash: 0, maya: 0, card: 0 };
  inRange.forEach((o) => o.payments.forEach((p) => { byMethod[p.method] += p.amount; }));
  const methodMax = Math.max(...Object.values(byMethod), 1);

  const prod = {};
  inRange.forEach((o) => o.items.forEach((i) => {
    const p = prod[i.productId] || (prod[i.productId] = { name: i.name, qty: 0, sales: 0, cost: 0 });
    p.qty += i.qty; p.sales += i.net; p.cost += i.unitCost * i.qty;
  }));
  const best = Object.values(prod).sort((a, b) => b.qty - a.qty);

  const byShift = { Morning: { net: 0, count: 0 }, Evening: { net: 0, count: 0 } };
  inRange.forEach((o) => {
    const sh = shifts.find((s) => s.id === o.shiftId);
    const k = sh ? sh.label : 'Morning';
    byShift[k].net += o.total; byShift[k].count += 1;
  });

  const byCashier = {};
  inRange.forEach((o) => {
    const c = byCashier[o.createdBy] || (byCashier[o.createdBy] = { orders: 0, net: 0, disc: 0 });
    c.orders += 1; c.net += o.total; c.disc += o.discountTotal;
  });

  return (
    <>
      <div className="page-head">
        <div><span className="label">Reports</span><h1>Sales and profit</h1></div>
        <div className="spacer" />
        <div className="seg" role="group" aria-label="Date range">
          {RANGES.map((r) => <button key={r.id} aria-pressed={range === r.id} onClick={() => setRange(r.id)}>{r.label}</button>)}
        </div>
      </div>

      <div className="kpis">
        <div className="kpi"><span className="label">Net sales</span><span className="v">{peso(net)}</span><span className="small muted">after {peso(disc)} in discounts</span></div>
        <div className="kpi"><span className="label">Orders</span><span className="v">{inRange.length}</span><span className="small muted">avg {peso(inRange.length ? Math.round(net / inRange.length) : 0)} per order</span></div>
        <div className="kpi"><span className="label">Gross profit</span><span className="v">{peso(net - vat - cogs)}</span><span className="small muted">sales less VAT and product cost</span></div>
        <div className="kpi"><span className="label">Net profit</span><span className="v" style={{ color: profit < 0 ? 'var(--bad)' : 'var(--good)' }}>{peso(profit)}</span><span className="small muted">after expenses and payroll</span></div>
      </div>

      <div className="twocol">
        <section className="panel">
          <div className="row"><h3>Net sales per day</h3><div className="spacer" /><span className="small muted">Last {nDays} days · hover a bar</span></div>
          <SalesChart days={chartDays} />
        </section>
        <section className="panel">
          <h3>Where the money went</h3>
          <div className="tablewrap">
            <table className="t">
              <tbody>
                <tr><td>Net sales</td><td className="r">{peso(net)}</td></tr>
                <tr><td className="muted">Less VAT 12% (for BIR)</td><td className="r">−{peso(vat)}</td></tr>
                <tr><td className="muted">Less product cost</td><td className="r">−{peso(cogs)}</td></tr>
                <tr><td className="muted">Less expenses</td><td className="r">−{peso(exp)}</td></tr>
                <tr><td className="muted">Less payroll (days worked)</td><td className="r">−{peso(pay)}</td></tr>
              </tbody>
              <tfoot><tr><td>Net profit</td><td className="r" style={{ color: profit < 0 ? 'var(--bad)' : 'var(--good)' }}>{peso(profit)}</td></tr></tfoot>
            </table>
          </div>
          <p className="small muted">Rent and bills count on the day they are paid, so short ranges can swing. Compare 14 days for a fairer view.</p>
        </section>
      </div>

      <div className="twocol">
        <section className="panel">
          <h3>Best sellers</h3>
          <div className="tablewrap">
            <table className="t">
              <thead><tr><th>Item</th><th className="r">Sold</th><th className="r">Sales</th><th className="r">Margin</th></tr></thead>
              <tbody>
                {best.slice(0, 8).map((p) => (
                  <tr key={p.name}>
                    <td>{p.name}</td>
                    <td className="r">{p.qty}</td>
                    <td className="r">{peso(p.sales)}</td>
                    <td className="r">{p.sales ? Math.round(((p.sales / 1.12 - p.cost) / (p.sales / 1.12)) * 100) : 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {best.length > 3 && (
            <p className="small muted">Slowest movers: {best.slice(-3).map((p) => `${p.name} (${p.qty})`).join(', ')}</p>
          )}
        </section>
        <section className="panel">
          <h3>By payment method</h3>
          <div className="stack" style={{ gap: 10 }}>
            {Object.entries(byMethod).map(([m, v]) => (
              <div key={m} className="stack" style={{ gap: 4 }}>
                <div className="sumrow"><span>{PAY_LABEL[m]}</span><span>{peso(v)}</span></div>
                <div className={`bar c-${METHOD_COLOR[m]}`}><i style={{ width: `${(v / methodMax) * 100}%` }} /></div>
              </div>
            ))}
          </div>
          <h3>By shift</h3>
          <div className="tablewrap">
            <table className="t">
              <thead><tr><th>Shift</th><th className="r">Orders</th><th className="r">Net sales</th></tr></thead>
              <tbody>
                {Object.entries(byShift).map(([k, v]) => (
                  <tr key={k}><td>{k} {k === 'Morning' ? '(7 AM–4 PM)' : '(4 PM–12 AM)'}</td><td className="r">{v.count}</td><td className="r">{peso(v.net)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="panel">
        <h3>By cashier</h3>
        <div className="tablewrap">
          <table className="t">
            <thead><tr><th>Cashier</th><th className="r">Orders</th><th className="r">Net sales</th><th className="r">Discounts given</th></tr></thead>
            <tbody>
              {Object.entries(byCashier).map(([id, v]) => (
                <tr key={id}>
                  <td>{(staff.find((s) => s.id === id) || { name: 'Owner' }).name}</td>
                  <td className="r">{v.orders}</td><td className="r">{peso(v.net)}</td><td className="r">{peso(v.disc)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
