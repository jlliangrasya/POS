import React from 'react';
import { useStore } from '../lib/store.js';
import { Icon } from '../components/ui.jsx';
import Reports from './Reports.jsx';
import Products from './Products.jsx';
import Promos from './Promos.jsx';
import Expenses from './Expenses.jsx';
import Staff from './Staff.jsx';
import Payroll from './Payroll.jsx';
import Shifts from './Shifts.jsx';

const NAV = [
  { id: 'reports', label: 'Reports', icon: 'chart', el: Reports },
  { id: 'shifts', label: 'Shifts and orders', icon: 'list', el: Shifts },
  { id: 'products', label: 'Products', icon: 'box', el: Products },
  { id: 'promos', label: 'Promos and vouchers', icon: 'tag', el: Promos },
  { id: 'staff', label: 'Staff and attendance', icon: 'users', el: Staff },
  { id: 'expenses', label: 'Expenses', icon: 'wallet', el: Expenses, plan: true },
  { id: 'payroll', label: 'Payroll', icon: 'cash', el: Payroll, plan: true },
];

export default function Admin() {
  const company = useStore((s) => s.company);
  const offline = useStore((s) => s.offline);
  const [page, setPage] = React.useState('reports');
  const Page = NAV.find((n) => n.id === page).el;
  return (
    <>
      <header className="topbar">
        <span className="brand"><span className="brand-mark">T</span>{company.name}</span>
        <span className="pill neutral">{company.branch}</span>
        <span className="pill info">Business plan</span>
        <div className="spacer" />
        {offline && <span className="pill bad"><span className="dot" />Offline: reports show what this device has</span>}
        <span className="who"><span className="avatar" style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}>LG</span>Liza (Owner)</span>
      </header>
      <div className="admin">
        <nav className="sidenav" aria-label="Owner menu">
          {NAV.map((n) => (
            <button key={n.id} aria-current={page === n.id ? 'page' : undefined} onClick={() => { setPage(n.id); window.scrollTo(0, 0); }}>
              <Icon name={n.icon} size={18} />{n.label}
            </button>
          ))}
        </nav>
        <main className="content"><Page /></main>
      </div>
    </>
  );
}
