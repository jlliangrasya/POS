import React from 'react';
import { store, useStore, useNow } from '../lib/store.js';
import { shiftSummary, validOrders } from '../lib/reports.js';
import { peso, toCentavos } from '../lib/money.js';
import { PAY_LABEL, fmtTime, useToast } from '../components/ui.jsx';
import { VoucherGenerator } from './VoucherModal.jsx';

const DENOMS = [1000, 500, 200, 100, 50, 20, 10, 5, 1];
export const METHOD_COLOR = { cash: 'apricot', gcash: 'teal', maya: 'marigold', card: 'coral' };
const TOP_COLORS = ['coral', 'apricot', 'marigold', 'teal', 'coral'];

/** The cashier's shift dashboard. Closing the shift happens here too, on one screen. */
export default function ShiftView({ staff, shift, onShiftClosed }) {
  const orders = useStore((s) => s.orders);
  const attendance = useStore((s) => s.attendance);
  const company = useStore((s) => s.company);
  const toast = useToast();
  const now = useNow(30000);
  const sum = shiftSummary(shift, orders);
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
  const methodMax = Math.max(...Object.values(sum.byMethod), 1);
  const hrs = Math.max(0, (now - new Date(shift.openedAt)) / 3600000);

  const close = () => {
    const at = new Date().toISOString();
    const record = { ...shift, status: 'closed', closedAt: at, closedBy: staff.id, countedCash: countedC, expectedCash: sum.expectedCash, overShort: diff };
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
        <Kpi label="Net sales" value={peso(sum.net)} sub={`${peso(sum.discounts)} in discounts`} />
        <Kpi label="Orders" value={sum.count} sub={unserved ? `${unserved} not yet served` : 'All served'} />
        <Kpi label="Cash in drawer" value={peso(sum.expectedCash)} sub={`includes ${peso(shift.startingCash)} starting cash`} />
        <Kpi label="Average order" value={peso(sum.count ? Math.round(sum.net / sum.count) : 0)} />
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
          <div className="row">
            <button className="btn" onClick={() => setClosing(false)}>Not yet</button>
            <div className="spacer" />
            <button className="btn hot lg" disabled={!hasCount} onClick={close}>Close shift and time out</button>
          </div>
        </section>
      )}

      <div className="twocol">
        <section className="panel">
          <h3>Payments received</h3>
          <div className="stack" style={{ gap: 12 }}>
            {Object.entries(sum.byMethod).map(([m, v]) => (
              <div key={m} className="stack" style={{ gap: 4 }}>
                <div className="sumrow"><span>{PAY_LABEL[m]}</span><span>{peso(v)}</span></div>
                <div className={`bar c-${METHOD_COLOR[m]}`}><i style={{ width: `${(v / methodMax) * 100}%` }} /></div>
              </div>
            ))}
          </div>
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
        <Kpi label="Net sales" value={peso(s.net)} />
        <Kpi label="Orders" value={s.count} />
        <Kpi label="Cash expected" value={peso(record.expectedCash)} />
        <Kpi label="Cash counted" value={peso(record.countedCash)} />
      </div>
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
