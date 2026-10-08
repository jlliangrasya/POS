import React from 'react';
import { store, useStore, uid } from '../lib/store.js';
import { peso, toCentavos } from '../lib/money.js';
import { Modal, useToast } from '../components/ui.jsx';
import VoucherModal, { voucherValue } from '../screens/VoucherModal.jsx';

const TYPE_LABEL = {
  percent_off: 'Percent off',
  buy_x_get_y: 'Buy X get Y',
  bundle_price: 'Combo price',
  min_spend: 'Minimum spend',
};
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function describe(p, products, categories) {
  const r = p.rules;
  const pn = (id) => (products.find((x) => x.id === id) || { name: '?' }).name;
  if (p.type === 'percent_off') return `${r.percent}% off ${r.categoryId ? `all ${categories.find((c) => c.id === r.categoryId).name.toLowerCase()}` : (r.productIds || []).map(pn).join(', ')}`;
  if (p.type === 'buy_x_get_y') return `Buy ${r.buy} ${pn(r.productId)}, get ${r.get} free`;
  if (p.type === 'bundle_price') return `${r.productIds.map(pn).join(' + ')} for ${peso(r.price)}`;
  if (p.type === 'min_spend') return `${peso(r.amount)} off orders ${peso(r.min)} and up`;
  return '';
}

export default function Promos() {
  const promos = useStore((s) => s.promos);
  const products = useStore((s) => s.products);
  const categories = useStore((s) => s.categories);
  const discountTypes = useStore((s) => s.discountTypes);
  const vouchers = useStore((s) => s.vouchers);
  const orders = useStore((s) => s.orders);
  const [form, setForm] = React.useState(false);
  const [vModal, setVModal] = React.useState(false);
  const [dForm, setDForm] = React.useState(false);

  const usage = (name) => {
    let count = 0, disc = 0, sales = 0;
    orders.forEach((o) => {
      const d = o.discounts.find((x) => x.label === name);
      if (d) { count += 1; disc += d.amount; sales += o.total; }
    });
    return { count, disc, sales };
  };

  return (
    <>
      <div className="page-head">
        <div><span className="label">Marketing</span><h1>Promos and vouchers</h1></div>
        <div className="spacer" />
        <button className="btn primary" onClick={() => setForm(true)}>New promo</button>
      </div>

      <section className="panel">
        <h3>Promo campaigns</h3>
        <p className="small muted">Active promos apply automatically at checkout. Cashiers don't need to compute or remember them.</p>
        <div className="tablewrap">
          <table className="t">
            <thead><tr><th>Promo</th><th>Runs</th><th className="r">Orders</th><th className="r">Discount given</th><th className="r">Sales from promo orders</th><th>On</th></tr></thead>
            <tbody>
              {promos.map((p) => {
                const u = usage(p.name);
                return (
                  <tr key={p.id}>
                    <td><strong>{p.name}</strong><br /><span className="small muted">{describe(p, products, categories)}</span></td>
                    <td className="small">{p.schedule}</td>
                    <td className="r">{u.count}</td>
                    <td className="r">{peso(u.disc)}</td>
                    <td className="r">{peso(u.sales)}</td>
                    <td><input type="checkbox" className="toggle" aria-label={`${p.name} on`} checked={p.active}
                      onChange={(e) => store.update((d) => { d.promos.find((x) => x.id === p.id).active = e.target.checked; })} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="twocol">
        <section className="panel">
          <div className="row"><h3>Vouchers</h3><div className="spacer" /><button className="btn sm" onClick={() => setVModal(true)}>Generate voucher</button></div>
          <div className="tablewrap">
            <table className="t">
              <thead><tr><th>Code</th><th>Value</th><th>Expires</th><th>Status</th></tr></thead>
              <tbody>
                {vouchers.map((v) => (
                  <tr key={v.id}>
                    <td className="mono">{v.code}</td><td>{voucherValue(v)}</td><td>{v.expiresAt}</td>
                    <td>{v.redeemedAt ? <span className="pill neutral">Used</span> : <span className="pill good">Unused</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small muted">Each code works once. Cashiers can generate vouchers too.</p>
        </section>
        <section className="panel">
          <div className="row"><h3>Custom discounts</h3><div className="spacer" /><button className="btn sm" onClick={() => setDForm(true)}>Add discount</button></div>
          <div className="tablewrap">
            <table className="t">
              <thead><tr><th>Name</th><th>Value</th><th className="r">Max per order</th></tr></thead>
              <tbody>
                <tr><td>Senior Citizen / PWD</td><td>20% + VAT-exempt</td><td className="r muted">By law</td></tr>
                {discountTypes.map((d) => (
                  <tr key={d.id}><td>{d.name}</td><td>{d.valueType === 'percent' ? `${d.value}%` : peso(d.value)}</td><td className="r">{d.maxPerOrder ? peso(d.maxPerOrder) : '—'}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {form && <PromoForm products={products} categories={categories} onClose={() => setForm(false)} />}
      {vModal && <VoucherModal staff={null} onClose={() => setVModal(false)} />}
      {dForm && <DiscountForm onClose={() => setDForm(false)} />}
    </>
  );
}

function PromoForm({ products, categories, onClose }) {
  const toast = useToast();
  const [f, setF] = React.useState({
    name: '', type: 'percent_off', categoryId: 'frappe', productId: 'brewed', productB: 'ensaymada',
    percent: '15', buy: '1', get: '1', price: '120', min: '500', amount: '50', days: [0, 1, 2, 3, 4], from: '14:00', to: '17:00', allDay: false,
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const toggleDay = (i) => setF({ ...f, days: f.days.includes(i) ? f.days.filter((x) => x !== i) : [...f.days, i].sort() });
  const fmt12 = (t) => { const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };

  const save = () => {
    const rules = {
      percent_off: { categoryId: f.categoryId, percent: Number(f.percent) },
      buy_x_get_y: { productId: f.productId, buy: Number(f.buy), get: Number(f.get) },
      bundle_price: { productIds: [f.productId, f.productB], price: toCentavos(f.price) },
      min_spend: { min: toCentavos(f.min), amount: toCentavos(f.amount) },
    }[f.type];
    const dayText = f.days.length === 7 ? 'Every day' : f.days.map((i) => DAYS[i]).join(', ');
    const schedule = f.allDay ? dayText : `${dayText}, ${fmt12(f.from)}–${fmt12(f.to)}`;
    store.update((d) => { d.promos.unshift({ id: uid('pr'), name: f.name.trim(), type: f.type, rules, schedule, active: true }); });
    toast(`${f.name.trim()} is on. It applies automatically at checkout.`);
    onClose();
  };

  return (
    <Modal title="New promo" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!f.name.trim()} onClick={save}>Save and turn on</button></>}>
      <label className="field"><span>Promo name (shown to the cashier)</span><input id="pr-name" className="input" placeholder="e.g. Payday Frappe Treat" value={f.name} onChange={set('name')} /></label>
      <div className="seg" role="group" aria-label="Promo type">
        {Object.entries(TYPE_LABEL).map(([k, v]) => <button key={k} aria-pressed={f.type === k} onClick={() => setF({ ...f, type: k })}>{v}</button>)}
      </div>
      {f.type === 'percent_off' && (
        <div className="grid2">
          <label className="field"><span>Category</span><select id="pr-cat" className="select" value={f.categoryId} onChange={set('categoryId')}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label className="field"><span>Percent off</span><input id="pr-pct" className="input mono" value={f.percent} onChange={set('percent')} /></label>
        </div>
      )}
      {f.type === 'buy_x_get_y' && (
        <div className="grid3">
          <label className="field"><span>Product</span><select id="pr-prod" className="select" value={f.productId} onChange={set('productId')}>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label className="field"><span>Buy</span><input id="pr-buy" className="input mono" value={f.buy} onChange={set('buy')} /></label>
          <label className="field"><span>Get free</span><input id="pr-get" className="input mono" value={f.get} onChange={set('get')} /></label>
        </div>
      )}
      {f.type === 'bundle_price' && (
        <div className="grid3">
          <label className="field"><span>Item 1</span><select id="pr-a" className="select" value={f.productId} onChange={set('productId')}>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label className="field"><span>Item 2</span><select id="pr-b" className="select" value={f.productB} onChange={set('productB')}>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label className="field"><span>Combo price (₱)</span><input id="pr-price" className="input mono" value={f.price} onChange={set('price')} /></label>
        </div>
      )}
      {f.type === 'min_spend' && (
        <div className="grid2">
          <label className="field"><span>Minimum order (₱)</span><input id="pr-min" className="input mono" value={f.min} onChange={set('min')} /></label>
          <label className="field"><span>Amount off (₱)</span><input id="pr-amt" className="input mono" value={f.amount} onChange={set('amount')} /></label>
        </div>
      )}
      <div className="stack" style={{ gap: 8 }}>
        <span className="label">When it runs</span>
        <div className="chips" style={{ justifyContent: 'flex-start' }}>
          {DAYS.map((d, i) => <button key={d} className="chip" aria-pressed={f.days.includes(i)} onClick={() => toggleDay(i)}>{d}</button>)}
        </div>
        <label className="row small" style={{ cursor: 'pointer' }}>
          <input id="pr-allday" type="checkbox" checked={f.allDay} onChange={(e) => setF({ ...f, allDay: e.target.checked })} /> All day
        </label>
        {!f.allDay && (
          <div className="grid2">
            <label className="field"><span>From</span><input id="pr-from" type="time" className="input" value={f.from} onChange={set('from')} /></label>
            <label className="field"><span>To</span><input id="pr-to" type="time" className="input" value={f.to} onChange={set('to')} /></label>
          </div>
        )}
        <p className="small muted">In the full system, promos switch on and off by themselves on schedule. In this demo, use the On switch.</p>
      </div>
    </Modal>
  );
}

function DiscountForm({ onClose }) {
  const toast = useToast();
  const [f, setF] = React.useState({ name: '', valueType: 'percent', value: '10', max: '100' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = () => {
    store.update((d) => {
      d.discountTypes.push({
        id: uid('d'), name: f.name.trim(), valueType: f.valueType,
        value: f.valueType === 'percent' ? Number(f.value) : toCentavos(f.value), maxPerOrder: toCentavos(f.max) || null,
      });
    });
    toast(`${f.name.trim()} discount added.`);
    onClose();
  };
  return (
    <Modal title="Add discount" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!f.name.trim()} onClick={save}>Save</button></>}>
      <label className="field"><span>Name</span><input id="d-name" className="input" placeholder="e.g. Suki card" value={f.name} onChange={set('name')} /></label>
      <div className="grid3">
        <label className="field"><span>Type</span><select id="d-type" className="select" value={f.valueType} onChange={set('valueType')}><option value="percent">Percent</option><option value="fixed">Peso amount</option></select></label>
        <label className="field"><span>Value</span><input id="d-value" className="input mono" value={f.value} onChange={set('value')} /></label>
        <label className="field"><span>Max per order (₱)</span><input id="d-max" className="input mono" value={f.max} onChange={set('max')} /></label>
      </div>
    </Modal>
  );
}
