import React from 'react';
import { store, useStore } from '../lib/store.js';
import { peso, toCentavos, fromCentavos } from '../lib/money.js';
import { dayKey } from '../lib/seed.js';
import { Avatar, ROLE_LABEL } from '../components/ui.jsx';
import { hoursOf } from './Staff.jsx';

function cutoffs(now = new Date()) {
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  const mk = (a, b) => ({ from: dayKey(a), to: dayKey(b), label: `${a.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}–${b.getDate()}` });
  const lastDay = (yy, mm) => new Date(yy, mm + 1, 0);
  if (d <= 15) return [mk(new Date(y, m, 1), new Date(y, m, 15)), mk(new Date(y, m - 1, 16), lastDay(y, m - 1))];
  return [mk(new Date(y, m, 16), lastDay(y, m)), mk(new Date(y, m, 1), new Date(y, m, 15))];
}

export function computePayroll(staff, attendance, period) {
  return staff.map((s) => {
    const recs = attendance.filter((a) => a.staffId === s.id && a.timeOut && a.date >= period.from && a.date <= period.to);
    const days = new Set(recs.map((a) => a.date)).size;
    const hours = recs.reduce((t, a) => t + hoursOf(a), 0);
    const ot = recs.reduce((t, a) => t + Math.max(0, hoursOf(a) - 9), 0); // 9-hour shift includes a 1-hour break
    const late = recs.reduce((t, a) => t + (a.lateMinutes || 0), 0);
    const hourly = s.rate / 8;
    const basic = days * s.rate;
    const otPay = Math.round(ot * hourly * 1.25);
    const lateDed = Math.round((hourly / 60) * late);
    return { staff: s, days, hours, ot, late, basic, otPay, lateDed, gross: basic + otPay - lateDed };
  });
}

export default function Payroll() {
  const staff = useStore((s) => s.staff);
  const attendance = useStore((s) => s.attendance);
  const deductions = useStore((s) => s.deductions || {});
  const periods = cutoffs();
  const [pi, setPi] = React.useState(0);
  const period = periods[pi];
  const pkey = `${period.from}_${period.to}`;
  const rows = computePayroll(staff, attendance, period);
  const ded = (id) => ((deductions[pkey] || {})[id]) || 0;
  const setDed = (id, v) => store.update((d) => {
    d.deductions = d.deductions || {};
    d.deductions[pkey] = d.deductions[pkey] || {};
    d.deductions[pkey][id] = toCentavos(v);
  });
  const totals = rows.reduce((t, r) => ({ gross: t.gross + r.gross, ded: t.ded + ded(r.staff.id), net: t.net + r.gross - ded(r.staff.id) }), { gross: 0, ded: 0, net: 0 });

  return (
    <>
      <div className="page-head">
        <div><span className="label">Business plan</span><h1>Payroll</h1></div>
        <div className="spacer" />
        <div className="seg" role="group" aria-label="Cut-off">
          {periods.map((p, i) => <button key={p.from} aria-pressed={pi === i} onClick={() => setPi(i)}>{i === 0 ? 'This cut-off' : 'Last cut-off'} ({p.label})</button>)}
        </div>
      </div>

      <div className="kpis">
        <div className="kpi"><span className="label">Gross pay</span><span className="v">{peso(totals.gross)}</span></div>
        <div className="kpi"><span className="label">Deductions</span><span className="v">{peso(totals.ded)}</span></div>
        <div className="kpi"><span className="label">Net pay</span><span className="v">{peso(totals.net)}</span></div>
        <div className="kpi"><span className="label">Staff paid</span><span className="v">{rows.filter((r) => r.days).length}</span></div>
      </div>

      <section className="panel">
        <div className="tablewrap">
          <table className="t">
            <thead>
              <tr><th>Staff</th><th className="r">Days</th><th className="r">Hours</th><th className="r">Basic</th><th className="r">Overtime</th><th className="r">Late</th><th className="r">Gross</th><th>Deductions (₱)</th><th className="r">Net pay</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.staff.id}>
                  <td><span className="who"><Avatar staff={r.staff} size={26} /><span>{r.staff.name}<br /><span className="small muted">{ROLE_LABEL[r.staff.role]} · {peso(r.staff.rate)}/day</span></span></span></td>
                  <td className="r">{r.days}</td>
                  <td className="r">{r.hours.toFixed(1)}</td>
                  <td className="r">{peso(r.basic)}</td>
                  <td className="r">{r.otPay ? `${peso(r.otPay)}` : '—'}<br /><span className="small muted">{r.ot ? `${r.ot.toFixed(1)} h` : ''}</span></td>
                  <td className="r">{r.lateDed ? `−${peso(r.lateDed)}` : '—'}<br /><span className="small muted">{r.late ? `${r.late} min` : ''}</span></td>
                  <td className="r"><strong>{peso(r.gross)}</strong></td>
                  <td>
                    <input id={`ded-${r.staff.id}`} className="input mono" style={{ width: 110 }} inputMode="decimal" placeholder="0.00"
                      defaultValue={ded(r.staff.id) ? fromCentavos(ded(r.staff.id)) : ''} key={pkey + r.staff.id}
                      onBlur={(e) => setDed(r.staff.id, e.target.value)} aria-label={`Deductions for ${r.staff.name}`} />
                  </td>
                  <td className="r"><strong>{peso(r.gross - ded(r.staff.id))}</strong></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><td colSpan={6}>Total</td><td className="r">{peso(totals.gross)}</td><td className="mono">{peso(totals.ded)}</td><td className="r">{peso(totals.net)}</td></tr>
            </tfoot>
          </table>
        </div>
        <p className="small muted">
          Computed from face time-in records: days worked × daily rate, plus overtime past 9 hours at 125%, less late minutes.
          Type SSS, PhilHealth, Pag-IBIG and cash advances in Deductions.
        </p>
      </section>
    </>
  );
}
