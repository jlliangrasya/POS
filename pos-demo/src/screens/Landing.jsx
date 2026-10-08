import React from 'react';
import { Icon } from '../components/ui.jsx';
import { useStore } from '../lib/store.js';

const CARDS = [
  { mode: 'pos', icon: 'pos', title: 'Cashier tablet', points: ['Face scan time-in', 'Take orders, discounts, promos', 'Cash, GCash, Maya, card', 'Close shift with cash count'] },
  { mode: 'kitchen', icon: 'kitchen', title: 'Kitchen screen(Optional)', points: ['New orders appear live', 'Mark preparing, ready, served', 'Late orders turn red', 'Tick items served one by one'] },
  { mode: 'admin', icon: 'chart', title: 'Owner dashboard', points: ['Sales and profit reports', 'Products, promos, vouchers', 'Expenses and payroll', 'Attendance and shift history'] },
];

export default function Landing({ onPick }) {
  const company = useStore((s) => s.company);
  return (
    <main className="landing">
      <div className="landing-head">
        <span className="brand"><span className="brand-mark">T</span>{company.name} POS</span>
        <h1>Run the counter, the kitchen, and the books from one system</h1>
        <p className="muted">Pick a screen to try. In the café, each one runs on its own tablet or phone.</p>
      </div>
      <div className="landing-cards">
        {CARDS.map((c) => (
          <button key={c.mode} className="landing-card" onClick={() => onPick(c.mode)}>
            <span className="ico"><Icon name={c.icon} size={22} /></span>
            <h2>{c.title}</h2>
            <ul>{c.points.map((p) => <li key={p}>{p}</li>)}</ul>
          </button>
        ))}
      </div>
      <p className="landing-tip">
        Tip: open the cashier tablet and the kitchen screen in two browser tabs side by side. Orders you ring up appear in the kitchen right away.
      </p>
    </main>
  );
}
