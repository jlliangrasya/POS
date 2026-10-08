import React from 'react';
import { store, useStore, uid } from '../lib/store.js';
import { peso, toCentavos, fromCentavos } from '../lib/money.js';
import { Modal, PAY_LABEL, useToast } from '../components/ui.jsx';

const METHODS = ['cash', 'gcash', 'maya', 'card'];

export default function Checkout({ staff, shift, cart, totals, voucher, hasSenior, meta, onClose, onDone }) {
  const offline = useStore((s) => s.offline);
  const company = useStore((s) => s.company);
  const toast = useToast();
  const [rows, setRows] = React.useState([{ method: 'cash', amount: fromCentavos(totals.total), ref: '' }]);
  const [tendered, setTendered] = React.useState('');
  const [scName, setScName] = React.useState('');
  const [scId, setScId] = React.useState('');
  const [done, setDone] = React.useState(null);

  const paid = rows.reduce((s, r) => s + toCentavos(r.amount), 0);
  const remaining = totals.total - paid;
  const cashRow = rows.find((r) => r.method === 'cash');
  const cashDue = cashRow ? toCentavos(cashRow.amount) : 0;
  const tenderedC = tendered === '' ? cashDue : toCentavos(tendered);
  const change = cashRow ? tenderedC - cashDue : 0;
  const needsRef = rows.some((r) => r.method !== 'cash' && !r.ref.trim());
  const canPay = remaining === 0 && (!cashRow || change >= 0) && (!hasSenior || (scName.trim() && scId.trim())) && !needsRef;

  const setRow = (i, patch) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const quick = [cashDue, Math.ceil(cashDue / 10000) * 10000, Math.ceil(cashDue / 50000) * 50000, Math.ceil(cashDue / 100000) * 100000]
    .filter((v, i, a) => v > 0 && a.indexOf(v) === i);

  const pay = () => {
    const now = new Date().toISOString();
    let order;
    store.update((d) => {
      const sh = d.shifts.find((x) => x.id === shift.id);
      sh.seq += 1;
      order = {
        id: uid('o'),
        no: `${sh.deviceCode}-${String(sh.seq).padStart(3, '0')}`,
        shiftId: sh.id,
        customer: meta.customer.trim() || 'Walk-in',
        type: meta.orderType,
        table: meta.orderType === 'dine_in' ? meta.table.trim() : '',
        items: totals.lines.map((l) => ({ ...l, served: false })),
        discounts: totals.discounts,
        subtotal: totals.subtotal, discountTotal: totals.discountTotal, vatAmount: totals.vatAmount,
        vatableSales: totals.vatableSales, vatExemptSales: totals.vatExemptSales, total: totals.total,
        payments: rows.map((r) => ({ method: r.method, amount: toCentavos(r.amount), ref: r.ref.trim() })),
        tendered: cashRow ? tenderedC : 0, change: cashRow ? change : 0,
        seniorInfo: hasSenior ? { name: scName.trim(), idNo: scId.trim() } : null,
        status: 'pending', createdAt: now, servedAt: null, createdBy: staff.id, synced: !d.offline,
      };
      d.orders.push(order);
      if (voucher) {
        const v = d.vouchers.find((x) => x.id === voucher.id);
        v.redeemedAt = now; v.redeemedOrderId = order.id;
      }
    });
    setDone(order);
    toast(offline ? `Order ${order.no} saved on this tablet. It will sync when online.` : `Order ${order.no} sent to the kitchen.`);
  };

  if (done) {
    return (
      <Modal title={`Order ${done.no}`} onClose={onDone} footer={<button className="btn primary lg" onClick={onDone}>New order</button>}>
        {done.change > 0 && <div className="callout good"><strong>Change: {peso(done.change)}</strong></div>}
        <OrderSlip order={done} company={company} staff={staff} />
      </Modal>
    );
  }

  return (
    <Modal
      title="Payment"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Back</button>
          <button className="btn primary lg" disabled={!canPay} onClick={pay}>Confirm payment</button>
        </>
      }
    >
      <div className="row">
        <div className="stack" style={{ gap: 2 }}>
          <span className="label">Amount due</span>
          <span className="num" style={{ fontFamily: 'var(--display)', fontSize: '2rem', fontWeight: 700 }}>{peso(totals.total)}</span>
        </div>
        <div className="spacer" />
        {totals.discountTotal > 0 && <span className="pill promo">Saved {peso(totals.discountTotal)}</span>}
      </div>

      {rows.map((r, i) => (
        <div className="stack" key={i} style={{ gap: 8 }}>
          {rows.length > 1 && <span className="label">Payment {i + 1}</span>}
          <div className="paygrid">
            {METHODS.map((m) => (
              <button key={m} className="paybtn" aria-pressed={r.method === m} onClick={() => setRow(i, { method: m })}>{PAY_LABEL[m]}</button>
            ))}
          </div>
          <div className="grid2">
            <label className="field">
              <span>Amount (₱)</span>
              <input id={`pay-amt-${i}`} className="input mono" inputMode="decimal" value={r.amount} onChange={(e) => setRow(i, { amount: e.target.value })} />
            </label>
            {r.method !== 'cash' && (
              <label className="field">
                <span>{r.method === 'card' ? 'Approval code' : 'Reference no.'}</span>
                <input id={`pay-ref-${i}`} className="input mono" value={r.ref} onChange={(e) => setRow(i, { ref: e.target.value })} placeholder="Required" />
              </label>
            )}
          </div>
        </div>
      ))}

      <div className="row">
        {rows.length < 2 ? (
          <button className="btn sm" onClick={() => setRows((rs) => [...rs.map((r) => ({ ...r, amount: fromCentavos(Math.floor(totals.total / 2)) })), { method: 'gcash', amount: fromCentavos(totals.total - Math.floor(totals.total / 2)), ref: '' }])}>
            Split payment
          </button>
        ) : (
          <button className="btn sm" onClick={() => setRows([{ ...rows[0], amount: fromCentavos(totals.total) }])}>Single payment</button>
        )}
        <div className="spacer" />
        {remaining !== 0 && <span className="pill bad">{remaining > 0 ? `${peso(remaining)} left to pay` : `${peso(-remaining)} too much`}</span>}
      </div>

      {cashRow && (
        <div className="stack" style={{ gap: 8 }}>
          <label className="field">
            <span>Cash received (₱)</span>
            <input id="tendered" className="input mono" inputMode="decimal" placeholder={fromCentavos(cashDue)} value={tendered} onChange={(e) => setTendered(e.target.value)} />
          </label>
          <div className="quickcash">
            {quick.map((q) => <button key={q} className="btn sm" onClick={() => setTendered(fromCentavos(q))}>{peso(q)}</button>)}
          </div>
          <div className={`callout ${change < 0 ? 'bad' : 'good'}`}>
            {change < 0 ? `Short by ${peso(-change)}` : <>Change: <strong>{peso(change)}</strong></>}
          </div>
        </div>
      )}

      {hasSenior && (
        <div className="stack" style={{ gap: 8 }}>
          <span className="label">Senior Citizen / PWD details (required)</span>
          <div className="grid2">
            <input id="sc-name" className="input" placeholder="Name on ID" value={scName} onChange={(e) => setScName(e.target.value)} />
            <input id="sc-id" className="input mono" placeholder="OSCA / PWD ID no." value={scId} onChange={(e) => setScId(e.target.value)} />
          </div>
        </div>
      )}
    </Modal>
  );
}

export function OrderSlip({ order, company, staff }) {
  return (
    <div className="slip" aria-label="Order slip">
      <div className="c"><strong>{company.name.toUpperCase()}</strong></div>
      <div className="c">{company.branch}</div>
      <div className="c">ORDER SLIP · NOT AN OFFICIAL RECEIPT</div>
      <hr />
      <div className="r"><span>Order</span><span>{order.no}</span></div>
      <div className="r"><span>Date</span><span>{new Date(order.createdAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}</span></div>
      <div className="r"><span>Customer</span><span>{order.customer}</span></div>
      <div className="r"><span>{order.type === 'dine_in' ? 'Dine in' : 'Take out'}</span><span>{order.table ? `Table ${order.table}` : ''}</span></div>
      <div className="r"><span>Cashier</span><span>{staff ? staff.name : ''}</span></div>
      <hr />
      {order.items.map((l) => (
        <div key={l.key}>
          <div className="r"><span>{l.qty} × {l.name}</span><span>{peso(l.gross)}</span></div>
          {l.addons && l.addons.length > 0 && <div>&nbsp;&nbsp;+ {l.addons.join(', ')}</div>}
          {l.discount > 0 && <div className="r"><span>&nbsp;&nbsp;{l.discountLabel}</span><span>-{peso(l.discount)}</span></div>}
        </div>
      ))}
      <hr />
      <div className="r"><span>Subtotal</span><span>{peso(order.subtotal)}</span></div>
      {order.discounts.filter((d) => d.source !== 'promo' && d.source !== 'senior').map((d) => (
        <div className="r" key={d.label}><span>{d.label}</span><span>-{peso(d.amount)}</span></div>
      ))}
      <div className="r"><strong>TOTAL</strong><strong>{peso(order.total)}</strong></div>
      <hr />
      <div className="r"><span>VATable sales</span><span>{peso(order.vatableSales)}</span></div>
      <div className="r"><span>VAT 12%</span><span>{peso(order.vatAmount)}</span></div>
      <div className="r"><span>VAT-exempt sales</span><span>{peso(order.vatExemptSales)}</span></div>
      <hr />
      {order.payments.map((p, i) => (
        <div className="r" key={i}><span>{PAY_LABEL[p.method]}{p.ref ? ` #${p.ref}` : ''}</span><span>{peso(p.amount)}</span></div>
      ))}
      {order.tendered > 0 && <div className="r"><span>Cash received</span><span>{peso(order.tendered)}</span></div>}
      {order.change > 0 && <div className="r"><span>Change</span><span>{peso(order.change)}</span></div>}
      {order.seniorInfo && <><hr /><div>SC/PWD: {order.seniorInfo.name}</div><div>ID no.: {order.seniorInfo.idNo}</div></>}
      <hr />
      <div className="c">Salamat po!</div>
    </div>
  );
}
