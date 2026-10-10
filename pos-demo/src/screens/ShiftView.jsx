import React from 'react';
import { store, useStore, useNow, uid } from '../lib/store.js';
import { shiftSummary, validOrders } from '../lib/reports.js';
import { peso, toCentavos } from '../lib/money.js';
import { dayKey } from '../lib/seed.js';
import { fmtTime, useToast } from '../components/ui.jsx';
import { EXPENSE_CATS } from '../admin/Expenses.jsx';
import { VoucherGenerator } from './VoucherModal.jsx';

const DENOMS = [1000, 500, 200, 100, 50, 20, 10, 5, 1];
export const METHOD_COLOR = { cash: 'apricot', gcash: 'teal', maya: 'marigold', card: 'coral' };
const TOP_COLORS = ['coral', 'apricot', 'marigold', 'teal', 'coral'];

/** The cashier's shift dashboard. Closing the shift happens here too, on one screen. */
export default function ShiftView({ staff, shift, onShiftClosed, onCollect }) {
  const orders = useStore((s) => s.orders);
  const expenses = useStore((s) => s.expenses);
  const attendance = useStore((s) => s.attendance);
  const company = useStore((s) => s.company);
  const toast = useToast();
  const now = useNow(30000);
  const sum = shiftSummary(shift, orders, expenses);
  const mine = validOrders(orders.filter((o) => o.shiftId === shift.id));
  const unserved = mine.filter((o) => !['served', 'void'].includes(o.status)).length;
  const timeIn = attendance.find((a) => a.staffId === staff.id && !a.timeOut);

  const [closing, setClosing] = React.useState(false);
  const [mode, setMode] = React.useState('total'); // total | denoms
  const [counted, setCounted] = React.useState('');
  const [denoms, setDenoms] = React.useState({});
  const [showVoucher, setShowVoucher] = React.useState(false);

  const denomTotal = DENOMS.reduce((s, d) => s + d * 100 * (parseInt(denoms[d], 10) || 0), 0);
  const countedC = mode === 'total' ? toCentavos(counted) : denomTotal;
  const hasCount = mode === 'total' ? counted !== '' : denomTotal > 0;
  const diff = countedC - sum.expectedCash;

  // Top items this shift
  const items = {};
  mine.forEach((o) => o.items.forEach((i) => { items[i.name] = (items[i.name] || 0) + i.qty; }));
  const top = Object.entries(items).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topMax = top.length ? top[0][1] : 1;
  const hrs = Math.max(0, (now - new Date(shift.openedAt)) / 3600000);

  const close = () => {
    const at = new Date().toISOString();
    const record = {
      ...shift, status: 'closed', closedAt: at, closedBy: staff.id, countedCash: countedC,
      expectedCash: sum.expectedCash, overShort: diff, expensesTotal: sum.expenses,
    };
    onShiftClosed({ record, sum });
    store.update((d) => {
      Object.assign(d.shifts.find((x) => x.id === shift.id), record);
      const a = d.attendance.find((x) => x.staffId === staff.id && !x.timeOut);
      if (a) a.timeOut = at;
    });
    toast(`${shift.label} shift closed. You are timed out.`);
  };

  return (
    <section className="shift-view" aria-label="My shift">
      <div className="page-head">
        <div>
          <span className="label">{company.name} · {shift.label} shift</span>
          <h1>My shift</h1>
          <span className="muted small">
            Opened {fmtTime(shift.openedAt)} · {hrs.toFixed(1)} hours so far
            {timeIn ? ` · you timed in at ${fmtTime(timeIn.timeIn)}` : ''}
          </span>
        </div>
        <div className="spacer" />
        {!closing && <button className="btn hot lg" onClick={() => setClosing(true)}>End shift and count cash</button>}
      </div>

      <div className="kpis">
        <Kpi label="Total sales" value={peso(sum.net)} sub={sum.unpaidTotal ? `${peso(sum.unpaidTotal)} not paid yet` : `${peso(sum.discounts)} in discounts`} />
        <Kpi label="Orders" value={sum.count} sub={unserved ? `${unserved} not yet served` : 'All served'} />
        <Kpi label="Cash in drawer" value={peso(sum.expectedCash)} sub={`includes ${peso(shift.startingCash)} starting cash`} />
        <Kpi label="Expenses" value={peso(sum.expenses)} sub={sum.expenseCount ? `${sum.expenseCount} paid from the drawer` : 'None yet'} />
      </div>

      {closing && (
        <section className="panel close-panel">
          <div className="row">
            <h2>Count the cash drawer</h2>
            <div className="spacer" />
            <div className="seg" role="group" aria-label="Count method">
              <button aria-pressed={mode === 'total'} onClick={() => setMode('total')}>Type total</button>
              <button aria-pressed={mode === 'denoms'} onClick={() => setMode('denoms')}>Count by bills</button>
            </div>
          </div>
          {unserved > 0 && <div className="callout warn">{unserved} order{unserved > 1 ? 's are' : ' is'} not yet served. They stay on the kitchen screen for the next shift.</div>}
          {sum.unpaidCount > 0 && (
            <div className="callout bad row" style={{ gap: 8 }}>
              <span style={{ flex: 1, minWidth: 200 }}>
                <strong>{sum.unpaidCount} order{sum.unpaidCount > 1 ? 's' : ''} ({peso(sum.unpaidTotal)}) not paid yet.</strong> Collect before you close.
                Anything left moves to the next shift's Unpaid tab and shows on the owner's report.
              </span>
              {onCollect && <button className="btn sm" onClick={onCollect}>Go to Unpaid</button>}
            </div>
          )}
          {mode === 'total' ? (
            <label className="field" style={{ maxWidth: 360 }}>
              <span>Total cash counted (₱)</span>
              <input id="counted" className="input mono big-input" inputMode="decimal" autoFocus value={counted} onChange={(e) => setCounted(e.target.value)} placeholder="0.00" />
            </label>
          ) : (
            <div className="denoms">
              {DENOMS.map((d) => (
                <label key={d} className="denom">
                  <span className="mono">₱{d}</span>
                  <span className="muted">×</span>
                  <input id={`denom-${d}`} className="input mono" inputMode="numeric" placeholder="0" value={denoms[d] || ''}
                    onChange={(e) => setDenoms({ ...denoms, [d]: e.target.value.replace(/\D/g, '') })} />
                </label>
              ))}
              <div className="sumrow" style={{ gridColumn: '1 / -1' }}><strong>Counted</strong><strong>{peso(denomTotal)}</strong></div>
            </div>
          )}
          <div className="compare">
            <div><span className="label">Expected</span><span className="v num">{peso(sum.expectedCash)}</span></div>
            <div><span className="label">Counted</span><span className="v num">{hasCount ? peso(countedC) : '—'}</span></div>
            <div className={hasCount ? (diff === 0 ? 'ok' : diff < 0 ? 'short' : 'over') : ''}>
              <span className="label">Difference</span>
              <span className="v num">{!hasCount ? '—' : diff === 0 ? 'Balanced' : diff < 0 ? `Short ${peso(-diff)}` : `Over ${peso(diff)}`}</span>
            </div>
          </div>
          <p className="small muted" style={{ margin: 0 }}>
            Expected = {peso(shift.startingCash)} starting cash + {peso(sum.byMethod.cash)} cash received − {peso(sum.expenses)} expenses
          </p>
          <div className="row">
            <button className="btn" onClick={() => setClosing(false)}>Not yet</button>
            <div className="spacer" />
            <button className="btn hot lg" disabled={!hasCount} onClick={close}>Close shift and time out</button>
          </div>
        </section>
      )}

      <div className="twocol">
        <section className="panel">
          <h3>Where the sales are</h3>
          <SalesBreakdown shift={shift} sum={sum} />
          <p className="small muted">Match GCash and Maya totals with the phone app before closing.</p>
        </section>
        <section className="panel">
          <h3>Top items this shift</h3>
          {top.length === 0 ? <p className="muted">No sales yet.</p> : (
            <div className="stack" style={{ gap: 10 }}>
              {top.map(([name, qty], idx) => (
                <div key={name} className="stack" style={{ gap: 4 }}>
                  <div className="sumrow"><span>{name}</span><span>{qty} sold</span></div>
                  <div className={`bar c-${TOP_COLORS[idx]}`}><i style={{ width: `${(qty / topMax) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <ShiftExpenses staff={staff} shift={shift} cashAvailable={sum.expectedCash} />

      <section className="panel">
        <div className="row">
          <h3>Vouchers</h3>
          <span className="small muted">Give a one-use code to a customer.</span>
          <div className="spacer" />
          {!showVoucher && <button className="btn" onClick={() => setShowVoucher(true)}>Generate voucher</button>}
        </div>
        {showVoucher && <VoucherGenerator staff={staff} showList={false} />}
      </section>
    </section>
  );
}

/** Total sales = cash on hand + GCash (and other e-payments) + expenses paid from the drawer. */
export function SalesBreakdown({ shift, sum }) {
  const rows = [
    ['Cash on hand', sum.cashOnHand, `cash in drawer less ${peso(shift.startingCash)} starting cash`],
    ['GCash', sum.byMethod.gcash],
    ['Maya', sum.byMethod.maya],
    ['Card', sum.byMethod.card],
    ['Expenses', sum.expenses, 'paid from the drawer'],
    ['Not paid yet', sum.uncollected, 'pay-later orders not collected this shift'],
    ['Less: collected for earlier shifts', -sum.collectedEarlier, 'pay-later orders from a past shift'],
  ].filter(([label, v]) => v !== 0 || ['Cash on hand', 'GCash', 'Expenses'].includes(label));
  return (
    <div className="tablewrap">
      <table className="t">
        <tbody>
          {rows.map(([label, v, note]) => (
            <tr key={label}>
              <td>{label}{note && <div className="small muted">{note}</div>}</td>
              <td className="r">{v < 0 ? `−${peso(-v)}` : peso(v)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot><tr><td>Total sales</td><td className="r">{peso(sum.net)}</td></tr></tfoot>
      </table>
    </div>
  );
}

/** Money taken out of the cash drawer during the shift: ice, LPG, a quick supply run. */
function ShiftExpenses({ staff, shift, cashAvailable }) {
  const list = useStore((s) => s.expenses.filter((e) => e.shiftId === shift.id));
  const toast = useToast();
  const [f, setF] = React.useState({ category: 'Supplies', amount: '', notes: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const amt = toCentavos(f.amount);
  const tooMuch = amt > cashAvailable;
  const canAdd = amt > 0 && f.notes.trim() && !tooMuch;

  const add = (e) => {
    e.preventDefault();
    if (!canAdd) return;
    const at = new Date();
    store.update((d) => {
      d.expenses.push({
        id: uid('e'), date: dayKey(at), at: at.toISOString(), category: f.category, amount: amt,
        notes: f.notes.trim(), createdBy: staff.id, shiftId: shift.id,
      });
    });
    toast(`${peso(amt)} taken from the drawer for ${f.notes.trim()}.`);
    setF({ ...f, amount: '', notes: '' });
  };
  const remove = (x) => {
    store.update((d) => { d.expenses = d.expenses.filter((e) => e.id !== x.id); });
    toast(`Removed: ${x.notes} (${peso(x.amount)}).`);
  };

  return (
    <section className="panel">
      <div className="row">
        <h3>Shift expenses</h3>
        <span className="small muted">Cash taken out of the drawer during this shift. Keep the receipt.</span>
      </div>
      <form className="stack" style={{ gap: 10 }} onSubmit={add}>
        <div className="grid3">
          <label className="field"><span>What for</span>
            <input id="sx-notes" className="input" placeholder="e.g. Ice, 3 bags" value={f.notes} onChange={set('notes')} />
          </label>
          <label className="field"><span>Category</span>
            <select id="sx-cat" className="select" value={f.category} onChange={set('category')}>{EXPENSE_CATS.map((c) => <option key={c}>{c}</option>)}</select>
          </label>
          <label className="field"><span>Amount (₱)</span>
            <input id="sx-amt" className="input mono" inputMode="decimal" value={f.amount} onChange={set('amount')} />
          </label>
        </div>
        <div className="row">
          {tooMuch && <span className="small" style={{ color: 'var(--bad)' }}>Only {peso(cashAvailable)} is in the drawer.</span>}
          <div className="spacer" />
          <button className="btn primary" type="submit" disabled={!canAdd}>Take from drawer</button>
        </div>
      </form>
      {list.length > 0 && (
        <div className="tablewrap">
          <table className="t">
            <thead><tr><th>Time</th><th>What for</th><th>Category</th><th className="r">Amount</th><th /></tr></thead>
            <tbody>
              {[...list].sort((a, b) => (b.at || '').localeCompare(a.at || '')).map((x) => (
                <tr key={x.id}>
                  <td>{fmtTime(x.at)}</td><td>{x.notes}</td><td className="muted">{x.category}</td>
                  <td className="r">{peso(x.amount)}</td>
                  <td className="r"><button className="btn ghost sm" onClick={() => remove(x)} aria-label={`Remove ${x.notes}`}>✕</button></td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td colSpan={3}>Total</td><td className="r">{peso(list.reduce((s, x) => s + x.amount, 0))}</td><td /></tr></tfoot>
          </table>
        </div>
      )}
    </section>
  );
}

/** Shown after the cashier closes the shift, before the tablet locks. */
export function ShiftClosed({ staff, summary, onDone }) {
  const { record, sum: s } = summary;
  return (
    <section className="shift-view">
      <div className="closed-hero">
        <span className={`pill ${record.overShort === 0 ? 'good' : record.overShort < 0 ? 'bad' : 'warn'}`}>
          {record.overShort === 0 ? 'Drawer balanced' : record.overShort < 0 ? `Short ${peso(-record.overShort)}` : `Over ${peso(record.overShort)}`}
        </span>
        <h1>Shift closed. Salamat, {staff.name.split(' ')[0]}!</h1>
        <p className="muted">Timed out at {fmtTime(record.closedAt)}. The summary is saved in the owner's reports.</p>
      </div>
      <div className="kpis">
        <Kpi label="Total sales" value={peso(s.net)} />
        <Kpi label="Orders" value={s.count} />
        <Kpi label="Cash expected" value={peso(record.expectedCash)} />
        <Kpi label="Cash counted" value={peso(record.countedCash)} />
      </div>
      <section className="panel" style={{ maxWidth: 560 }}>
        <h3>Where the sales are</h3>
        <SalesBreakdown shift={record} sum={s} />
      </section>
      <div className="row">
        <button className="btn hot lg" onClick={onDone}>Done, lock the tablet</button>
      </div>
    </section>
  );
}

function Kpi({ label, value, sub }) {
  return (
    <div className="kpi">
      <span className="label">{label}</span>
      <span className="v">{value}</span>
      {sub && <span className="small muted">{sub}</span>}
    </div>
  );
}
