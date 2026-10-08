import React from 'react';
import { useStore, uid } from '../lib/store.js';
import { computeOrderTotals } from '../lib/pricing.js';
import { peso, pesoShort } from '../lib/money.js';
import { Avatar, Icon, Modal, fmtTime, useToast } from '../components/ui.jsx';
import { shiftSummary } from '../lib/reports.js';
import Checkout from './Checkout.jsx';
import OrdersView from './OrdersView.jsx';
import ShiftView from './ShiftView.jsx';

// Category stripes use the client's palette.
// Top-level filters the cashier sees first. Categories fall under one group each.
export const GROUPS = [
  { id: 'drinks', name: 'Drinks', color: '#F9A66C', cats: ['coffee', 'noncoffee', 'frappe'] },
  { id: 'meals', name: 'Meals', color: '#F17A7E', cats: ['meals'] },
  { id: 'snacks', name: 'Snacks', color: '#FFC94B', cats: ['pastry'] },
];
const groupOf = (catId) => (GROUPS.find((g) => g.cats.includes(catId)) || GROUPS[2]).id;

export function promoTouches(promo, product) {
  if (!promo.active) return false;
  const r = promo.rules || {};
  if (promo.type === 'percent_off') return r.categoryId === product.categoryId || (r.productIds || []).includes(product.id);
  if (promo.type === 'buy_x_get_y') return r.productId === product.id;
  if (promo.type === 'bundle_price' || promo.type === 'fixed_off') return (r.productIds || []).includes(product.id);
  return false;
}

export function PosTopBar({ staff, shift, onLock, children, live }) {
  const offline = useStore((s) => s.offline);
  const company = useStore((s) => s.company);
  return (
    <header className="topbar">
      <span className="brand"><span className="brand-mark">T</span>{company.name}</span>
      {shift && <span className="pill neutral">{shift.label} shift · opened {fmtTime(shift.openedAt)}</span>}
      {offline ? <span className="pill bad"><span className="dot" />Offline</span> : <span className="pill good"><span className="dot" />Online</span>}
      {live}
      <div className="spacer" />
      {children}
      {staff && <span className="who"><Avatar staff={staff} />{staff.name.split(' ')[0]}</span>}
      {onLock && <button className="btn sm" onClick={onLock}><Icon name="lock" size={16} />Lock</button>}
    </header>
  );
}

export default function Pos({ staff, shift, onLock, onShiftClosed }) {
  const categories = useStore((s) => s.categories);
  const products = useStore((s) => s.products);
  const addons = useStore((s) => s.addons);
  const promos = useStore((s) => s.promos);
  const discountTypes = useStore((s) => s.discountTypes);
  const vouchers = useStore((s) => s.vouchers);
  const offline = useStore((s) => s.offline);
  const unserved = useStore((s) => s.orders.filter((o) => o.shiftId === shift.id && !['served', 'void'].includes(o.status)).length);
  const allOrders = useStore((s) => s.orders);
  const live = shiftSummary(shift, allOrders);
  const toast = useToast();
  const [view, setView] = React.useState('menu'); // menu | orders | shift
  const [showDisc, setShowDisc] = React.useState(false);
  const [bump, setBump] = React.useState(false);
  const prevNet = React.useRef(live.net);
  React.useEffect(() => {
    if (live.net !== prevNet.current) {
      prevNet.current = live.net;
      setBump(true);
      const t = setTimeout(() => setBump(false), 900);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [live.net]);

  const [group, setGroup] = React.useState('all');
  const [search, setSearch] = React.useState('');
  const searchRef = React.useRef(null);
  const [cat, setCat] = React.useState('all');
  const [cart, setCart] = React.useState([]);
  const [customer, setCustomer] = React.useState('');
  const [orderType, setOrderType] = React.useState('dine_in');
  const [table, setTable] = React.useState('');
  const [customId, setCustomId] = React.useState('');
  const [voucherCode, setVoucherCode] = React.useState('');
  const [voucher, setVoucher] = React.useState(null);
  const [voucherErr, setVoucherErr] = React.useState('');
  const [editing, setEditing] = React.useState(null);
  const [modal, setModal] = React.useState(null); // checkout

  const activePromos = promos.filter((p) => p.active);
  const custom = discountTypes.find((d) => d.id === customId) || null;
  const totals = computeOrderTotals(cart, { promos: activePromos, custom, voucher });
  // Search looks across the whole menu; every word typed must appear in the name or category.
  const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const catName = (id) => (categories.find((c) => c.id === id) || { name: '' }).name.toLowerCase();
  const shown = words.length
    ? products.filter((p) => words.every((w) => p.name.toLowerCase().includes(w) || catName(p.categoryId).includes(w)))
    : products.filter((p) => (group === 'all' || groupOf(p.categoryId) === group) && (cat === 'all' || p.categoryId === cat));
  const onSearchKey = (e) => {
    if (e.key === 'Escape') setSearch('');
    if (e.key === 'Enter') {
      const first = shown.find((p) => p.available);
      if (first) { add(first); setSearch(''); toast(`${first.name} added.`); }
    }
  };
  const subCats = group === 'all' ? [] : categories.filter((c) => groupOf(c.id) === group);
  const pickGroup = (g) => { setGroup(g); setCat('all'); setSearch(''); };

  const add = (p) => {
    setCart((c) => {
      const ex = c.find((l) => l.productId === p.id && !l.addons.length && !l.notes && !l.senior);
      if (ex) return c.map((l) => (l === ex ? { ...l, qty: l.qty + 1 } : l));
      return [...c, { key: uid('l'), productId: p.id, categoryId: p.categoryId, name: p.name, qty: 1,
        basePrice: p.price, baseCost: p.unitCost, unitPrice: p.price, unitCost: p.unitCost, addons: [], notes: '', senior: false }];
    });
  };
  const setQty = (key, d) => setCart((c) => c.flatMap((l) => (l.key !== key ? [l] : l.qty + d <= 0 ? [] : [{ ...l, qty: l.qty + d }])));
  const updateLine = (key, patch) => setCart((c) => c.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const applyVoucher = () => {
    const code = voucherCode.trim().toUpperCase();
    const v = vouchers.find((x) => x.code === code);
    setVoucherErr('');
    if (!v) { setVoucherErr('No voucher with that code.'); return; }
    if (v.redeemedAt) { setVoucherErr(`Already used on ${new Date(v.redeemedAt).toLocaleDateString('en-PH')}.`); return; }
    if (v.expiresAt < new Date().toISOString().slice(0, 10)) { setVoucherErr('This voucher has expired.'); return; }
    setVoucher(v);
    toast(`Voucher ${v.code} applied.`);
  };

  const clear = () => {
    setCart([]); setCustomer(''); setTable(''); setCustomId(''); setVoucher(null); setVoucherCode(''); setVoucherErr(''); setShowDisc(false);
  };

  const hasSenior = cart.some((l) => l.senior);

  return (
    <>
      <PosTopBar
        staff={staff} shift={shift} onLock={onLock}
        live={
          <button className={`live-sales${bump ? ' bump' : ''}`} onClick={() => setView('shift')} title="Open My shift">
            <span className="label">Shift sales</span>
            <span className="num">{peso(live.net)}</span>
            <span className="small muted">{live.count} orders</span>
          </button>
        }
      />
      <nav className="pos-tabs" aria-label="Cashier screens">
        <button data-color="apricot" aria-current={view === 'menu' ? 'page' : undefined} onClick={() => setView('menu')}>
          <Icon name="pos" size={20} />Menu{cart.length > 0 && view !== 'menu' && <span className="pill hotpill">{cart.reduce((n, l) => n + l.qty, 0)} in order</span>}
        </button>
        <button data-color="marigold" aria-current={view === 'orders' ? 'page' : undefined} onClick={() => setView('orders')}>
          <Icon name="list" size={20} />Orders{unserved > 0 && <span className="pill promo">{unserved} to serve</span>}
        </button>
        <button data-color="coral" aria-current={view === 'shift' ? 'page' : undefined} onClick={() => setView('shift')}>
          <Icon name="cash" size={20} />My shift
        </button>
      </nav>
      {offline && (
        <div className="offline-banner">
          <Icon name="wifi" size={18} />No internet. Keep selling: orders are saved on this tablet and sent when the connection returns. The kitchen won't see new orders until then.
        </div>
      )}
      {view === 'orders' && <OrdersView shift={shift} staff={staff} />}
      {view === 'shift' && <ShiftView staff={staff} shift={shift} onShiftClosed={onShiftClosed} />}
      <div className="pos" hidden={view !== 'menu'}>
        <section className="catalog" aria-label="Menu">
          {activePromos.length > 0 && (
            <div className="promo-strip">
              {activePromos.map((p) => <span key={p.id} className="pill promo">{p.name}</span>)}
            </div>
          )}
          <div className="menu-search">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            <input id="menu-search" ref={searchRef} type="search" autoComplete="off" placeholder="Search the menu, e.g. latte, ube, silog"
              value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={onSearchKey} aria-label="Search products" />
            {search && <button className="btn ghost sm" onClick={() => { setSearch(''); searchRef.current && searchRef.current.focus(); }}>Clear</button>}
          </div>
          {words.length > 0 ? (
            <div className="search-note">
              <strong>{shown.length} {shown.length === 1 ? 'item' : 'items'}</strong> match “{search.trim()}”
              {shown.length > 0 && <span className="muted"> · press Enter to add the first one</span>}
            </div>
          ) : (<>
          <div className="groups" role="toolbar" aria-label="Menu groups">
            <button data-group="all" aria-pressed={group === 'all'} onClick={() => pickGroup('all')}>
              All <span className="gcount">{products.length}</span>
            </button>
            {GROUPS.map((g) => (
              <button key={g.id} style={{ '--g': g.color }} aria-pressed={group === g.id} onClick={() => pickGroup(g.id)}>
                {g.name} <span className="gcount">{products.filter((p) => groupOf(p.categoryId) === g.id).length}</span>
              </button>
            ))}
          </div>
          {subCats.length > 1 && (
            <div className="cats sub" role="toolbar" aria-label="Categories" style={{ '--g': GROUPS.find((g) => g.id === group).color }}>
              <button aria-pressed={cat === 'all'} onClick={() => setCat('all')}>All {GROUPS.find((g) => g.id === group).name.toLowerCase()}</button>
              {subCats.map((c) => <button key={c.id} aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>{c.name}</button>)}
            </div>
          )}
          </>)}
          {shown.length === 0 && (
            <div className="empty big">
              <strong>No menu item matches “{search.trim()}”</strong>
              <span className="small">Check the spelling, or try part of the name.</span>
              <button className="btn" onClick={() => setSearch('')}>Clear search</button>
            </div>
          )}
          <div className="products">
            {shown.map((p) => {
              const promo = activePromos.find((pr) => promoTouches(pr, p));
              return (
                <button key={p.id} className="product" style={{ '--cat': GROUPS.find((g) => g.id === groupOf(p.categoryId)).color }} disabled={!p.available} onClick={() => add(p)}>
                  <span className="ptop">
                    <span className="swatch" />
                    {!p.available ? <span className="pill neutral">Sold out</span> : promo ? <span className="pill promo">Promo</span> : null}
                  </span>
                  <span className="name">{p.name}</span>
                  <span className="price num">{pesoShort(p.price)}</span>
                </button>
              );
            })}
          </div>
        </section>

        {cart.length > 0 && view === 'menu' && (
          <button className="mobile-orderbar btn hot lg" onClick={() => document.getElementById('ticket').scrollIntoView({ behavior: 'smooth' })}>
            View order · {cart.reduce((n, l) => n + l.qty, 0)} items · {peso(totals.total)}
          </button>
        )}
        <aside className="ticket" id="ticket" aria-label="Current order">
          <div className="ticket-head">
            <div className="row">
              <h2>New order</h2>
              <div className="spacer" />
              <span className="mono muted small">#{shift.deviceCode}-{String(shift.seq + 1).padStart(3, '0')}</span>
            </div>
            <input id="cust-name" className="input" placeholder="Customer name" value={customer} onChange={(e) => setCustomer(e.target.value)} />
            <div className="row" style={{ gap: 8 }}>
              <div className="seg">
                <button aria-pressed={orderType === 'dine_in'} onClick={() => setOrderType('dine_in')}>Dine in</button>
                <button aria-pressed={orderType === 'take_out'} onClick={() => setOrderType('take_out')}>Take out</button>
              </div>
              {orderType === 'dine_in' && (
                <input id="table-no" className="input" style={{ width: 90, flex: 1 }} placeholder="Table #" inputMode="numeric" value={table} onChange={(e) => setTable(e.target.value)} />
              )}
            </div>
          </div>

          <div className="ticket-lines">
            {cart.length === 0 ? (
              <div className="empty"><strong>No items yet</strong><span className="small">Tap a menu item to add it. For Senior/PWD, tap Edit on the item.</span></div>
            ) : totals.lines.map((l) => (
              <div className="tline" key={l.key}>
                <span className="tname">{l.name}</span>
                <span className="num" style={{ fontWeight: 600 }}>{peso(l.gross)}</span>
                <div className="meta">
                  <span className="qty">
                    <button onClick={() => setQty(l.key, -1)} aria-label={`Remove one ${l.name}`}>−</button>
                    <span className="num">{l.qty}</span>
                    <button onClick={() => setQty(l.key, 1)} aria-label={`Add one ${l.name}`}>+</button>
                  </span>
                  <button className="btn ghost sm" onClick={() => setEditing(l.key)}>Edit</button>
                  {l.senior && <span className="pill info">SC/PWD</span>}
                  {l.discount > 0 && <span className="pill promo">−{peso(l.discount)}</span>}
                </div>
                {(l.addons.length > 0 || l.notes) && (
                  <div className="meta muted">{[...l.addons, l.notes].filter(Boolean).join(' · ')}</div>
                )}
              </div>
            ))}
          </div>

          <div className="ticket-foot">
            {!showDisc && !customId && !voucher ? (
              <button className="btn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={() => setShowDisc(true)} disabled={!cart.length}>
                + Add discount or voucher
              </button>
            ) : (
              <div className="grid2" style={{ gap: 8 }}>
                <select id="custom-disc" className="select" value={customId} onChange={(e) => setCustomId(e.target.value)} aria-label="Discount">
                  <option value="">No discount</option>
                  {discountTypes.map((d) => (
                    <option key={d.id} value={d.id}>{d.name} ({d.valueType === 'percent' ? `${d.value}%` : peso(d.value)})</option>
                  ))}
                </select>
                {voucher ? (
                  <button className="btn" onClick={() => { setVoucher(null); setVoucherCode(''); }}>✕ {voucher.code}</button>
                ) : (
                  <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                    <input id="voucher-code" className="input mono" placeholder="Voucher code" value={voucherCode} disabled={offline}
                      onChange={(e) => setVoucherCode(e.target.value)} style={{ minWidth: 0 }} />
                    <button className="btn sm" disabled={offline || !voucherCode.trim()} onClick={applyVoucher}>Apply</button>
                  </div>
                )}
              </div>
            )}
            {(showDisc || voucher) && offline && !voucher && <span className="small muted">Vouchers need internet so the same code can't be used twice.</span>}
            {voucherErr && <span className="small" style={{ color: 'var(--bad)' }}>{voucherErr}</span>}
            <div className="sumrow muted"><span>Subtotal</span><span>{peso(totals.subtotal)}</span></div>
            {totals.discounts.map((d) => (
              <div className="sumrow disc" key={d.label}><span>{d.label}</span><span>−{peso(d.amount)}</span></div>
            ))}
            <div className="sumrow muted small"><span>VAT 12% (included)</span><span>{peso(totals.vatAmount)}</span></div>
            <div className="sumrow total"><span>Total</span><span>{peso(totals.total)}</span></div>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn" onClick={clear} disabled={!cart.length}>Clear</button>
              <button className="btn hot lg" style={{ flex: 1 }} disabled={!cart.length} onClick={() => setModal('checkout')}>
                Charge {peso(totals.total)}
              </button>
            </div>
          </div>
        </aside>
      </div>

      {editing && (() => {
        const line = cart.find((l) => l.key === editing);
        if (!line) return null;
        const options = addons.filter((a) => a.categories.includes(line.categoryId));
        const toggleAddon = (a) => {
          const has = line.addons.includes(a.name);
          const next = has ? line.addons.filter((n) => n !== a.name) : [...line.addons, a.name];
          const chosen = options.filter((o) => next.includes(o.name));
          updateLine(line.key, {
            addons: next,
            unitPrice: line.basePrice + chosen.reduce((s, o) => s + o.price, 0),
            unitCost: line.baseCost + chosen.reduce((s, o) => s + o.unitCost, 0),
          });
        };
        return (
          <Modal title={line.name} onClose={() => setEditing(null)} footer={<>
            <button className="btn danger" onClick={() => { setCart((c) => c.filter((l) => l.key !== line.key)); setEditing(null); }}>Remove item</button>
            <div className="spacer" />
            <button className="btn primary" onClick={() => setEditing(null)}>Done</button>
          </>}>
            {options.length > 0 && (
              <div className="stack" style={{ gap: 8 }}>
                <span className="label">Add-ons</span>
                <div className="chips" style={{ justifyContent: 'flex-start' }}>
                  {options.map((a) => (
                    <button key={a.id} className="chip" aria-pressed={line.addons.includes(a.name)} onClick={() => toggleAddon(a)}>
                      {a.name} +{pesoShort(a.price)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <label className="field">
              <span>Notes for the kitchen</span>
              <input id="line-notes" className="input" placeholder="e.g. less sugar, no ice" value={line.notes} onChange={(e) => updateLine(line.key, { notes: e.target.value })} />
            </label>
            <label className="row" style={{ cursor: 'pointer' }}>
              <input id="line-senior" type="checkbox" className="toggle" checked={line.senior} onChange={(e) => updateLine(line.key, { senior: e.target.checked })} />
              <span>
                <strong>For a Senior Citizen or PWD</strong><br />
                <span className="small muted">20% off with VAT removed. You'll enter the ID at payment.</span>
              </span>
            </label>
          </Modal>
        );
      })()}

      {modal === 'checkout' && (
        <Checkout
          staff={staff} shift={shift} cart={cart} totals={totals} voucher={voucher} hasSenior={hasSenior}
          meta={{ customer, orderType, table }}
          onClose={() => setModal(null)}
          onDone={() => { clear(); setModal(null); }}
        />
      )}
    </>
  );
}
