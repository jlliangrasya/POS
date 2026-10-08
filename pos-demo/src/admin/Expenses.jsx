import React from 'react';
import { store, useStore, uid } from '../lib/store.js';
import { peso, toCentavos } from '../lib/money.js';
import { dayKey } from '../lib/seed.js';
import { fmtDateLong, useToast } from '../components/ui.jsx';

const CATS = ['Supplies', 'Rent', 'Utilities', 'Repairs', 'Others'];

export default function Expenses() {
  const expenses = useStore((s) => s.expenses);
  const toast = useToast();
  const [f, setF] = React.useState({ date: dayKey(new Date()), category: 'Supplies', amount: '', notes: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const sorted = [...expenses].sort((a, b) => b.date.localeCompare(a.date));
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const byCat = CATS.map((c) => ({ c, v: expenses.filter((e) => e.category === c).reduce((s, e) => s + e.amount, 0) })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
  const max = Math.max(...byCat.map((x) => x.v), 1);

  const add = (e) => {
    e.preventDefault();
    if (!toCentavos(f.amount)) return;
    store.update((d) => { d.expenses.push({ id: uid('e'), date: f.date, category: f.category, amount: toCentavos(f.amount), notes: f.notes.trim(), createdBy: 'owner' }); });
    toast(`${f.category} expense of ${peso(toCentavos(f.amount))} recorded.`);
    setF({ ...f, amount: '', notes: '' });
  };

  return (
    <>
      <div className="page-head">
        <div><span className="label">Business plan</span><h1>Expenses</h1></div>
      </div>
      <form className="panel" onSubmit={add}>
        <h3>Record an expense</h3>
        <div className="grid3">
          <label className="field"><span>Date</span><input id="e-date" type="date" className="input" value={f.date} onChange={set('date')} /></label>
          <label className="field"><span>Category</span><select id="e-cat" className="select" value={f.category} onChange={set('category')}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label className="field"><span>Amount (₱)</span><input id="e-amt" className="input mono" inputMode="decimal" value={f.amount} onChange={set('amount')} /></label>
        </div>
        <div className="row">
          <input id="e-notes" className="input" style={{ flex: 1, minWidth: 200 }} placeholder="What was it for? e.g. Fresh milk, 24 L" value={f.notes} onChange={set('notes')} />
          <button className="btn primary" type="submit" disabled={!toCentavos(f.amount)}>Add expense</button>
        </div>
      </form>
      <div className="twocol">
        <section className="panel">
          <h3>Last 14 days</h3>
          <div className="tablewrap">
            <table className="t">
              <thead><tr><th>Date</th><th>Category</th><th>Notes</th><th className="r">Amount</th></tr></thead>
              <tbody>
                {sorted.map((e) => (
                  <tr key={e.id}><td>{fmtDateLong(e.date + 'T00:00')}</td><td>{e.category}</td><td className="muted">{e.notes}</td><td className="r">{peso(e.amount)}</td></tr>
                ))}
              </tbody>
              <tfoot><tr><td colSpan={3}>Total</td><td className="r">{peso(total)}</td></tr></tfoot>
            </table>
          </div>
        </section>
        <section className="panel">
          <h3>By category</h3>
          <div className="stack" style={{ gap: 10 }}>
            {byCat.map(({ c, v }) => (
              <div key={c} className="stack" style={{ gap: 4 }}>
                <div className="sumrow"><span>{c}</span><span>{peso(v)}</span></div>
                <div className="bar"><i style={{ width: `${(v / max) * 100}%` }} /></div>
              </div>
            ))}
          </div>
          <p className="small muted">Expenses feed the net profit on the Reports page.</p>
        </section>
      </div>
    </>
  );
}
