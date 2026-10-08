import React from 'react';
import { store, useStore, uid } from '../lib/store.js';
import { peso, toCentavos, fromCentavos } from '../lib/money.js';
import { Modal, useToast } from '../components/ui.jsx';

const CAT_COLOR = { coffee: '#F9A66C', noncoffee: '#9DBFA8', frappe: '#F17A7E', pastry: '#FFC94B', meals: '#F9A66C' };

const VAT_LABEL = { vatable: 'VATable', exempt: 'VAT-exempt', zero_rated: 'Zero-rated' };

export default function Products() {
  const products = useStore((s) => s.products);
  const categories = useStore((s) => s.categories);
  const [edit, setEdit] = React.useState(null);
  const [cat, setCat] = React.useState('all');
  const [q, setQ] = React.useState('');
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = products.filter((p) => (cat === 'all' || p.categoryId === cat) && words.every((w) => p.name.toLowerCase().includes(w)));
  return (
    <>
      <div className="page-head">
        <div><span className="label">Menu</span><h1>Products</h1></div>
        <div className="spacer" />
        <button className="btn primary" onClick={() => setEdit({ id: null, name: '', categoryId: categories[0].id, price: '', unitCost: '', vatType: 'vatable', available: true })}>Add product</button>
      </div>
      <input id="prod-search" type="search" className="input" style={{ maxWidth: 360 }} placeholder="Search products" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search products" />
      <div className="cats">
        <button aria-pressed={cat === 'all'} onClick={() => setCat('all')}>All</button>
        {categories.map((c) => <button key={c.id} data-cat={c.id} style={{ '--cat': CAT_COLOR[c.id] }} aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>{c.name}</button>)}
      </div>
      <section className="panel">
        <div className="tablewrap">
          <table className="t">
            <thead><tr><th>Product</th><th>Category</th><th className="r">Price</th><th className="r">Unit cost</th><th className="r">Profit / item</th><th>VAT</th><th>Available</th><th /></tr></thead>
            <tbody>
              {shown.map((p) => {
                const profit = Math.round(p.price / 1.12) - p.unitCost;
                return (
                  <tr key={p.id}>
                    <td><strong>{p.name}</strong></td>
                    <td className="muted">{categories.find((c) => c.id === p.categoryId).name}</td>
                    <td className="r">{peso(p.price)}</td>
                    <td className="r">{peso(p.unitCost)}</td>
                    <td className="r">{peso(profit)} <span className="muted small">({Math.round((profit / (p.price / 1.12)) * 100)}%)</span></td>
                    <td><span className="pill neutral">{VAT_LABEL[p.vatType]}</span></td>
                    <td>
                      <input type="checkbox" className="toggle" aria-label={`${p.name} available`} checked={p.available}
                        onChange={(e) => store.update((d) => { d.products.find((x) => x.id === p.id).available = e.target.checked; })} />
                    </td>
                    <td><button className="btn sm" onClick={() => setEdit({ ...p, price: fromCentavos(p.price), unitCost: fromCentavos(p.unitCost) })}>Edit</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="small muted">Profit per item is the price without VAT, less unit cost. Turn off Available to show an item as sold out on the cashier tablet right away.</p>
      </section>
      {edit && <ProductForm initial={edit} categories={categories} onClose={() => setEdit(null)} />}
    </>
  );
}

function ProductForm({ initial, categories, onClose }) {
  const [f, setF] = React.useState(initial);
  const toast = useToast();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const valid = f.name.trim() && toCentavos(f.price) > 0;
  const save = () => {
    const row = { ...f, name: f.name.trim(), price: toCentavos(f.price), unitCost: toCentavos(f.unitCost) };
    store.update((d) => {
      if (row.id) Object.assign(d.products.find((x) => x.id === row.id), row);
      else d.products.push({ ...row, id: uid('p'), sort: d.products.length });
    });
    toast(`${row.name} saved. The cashier tablet has the new price.`);
    onClose();
  };
  return (
    <Modal title={f.id ? 'Edit product' : 'Add product'} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!valid} onClick={save}>Save</button></>}>
      <label className="field"><span>Name</span><input id="p-name" className="input" value={f.name} onChange={set('name')} /></label>
      <div className="grid2">
        <label className="field"><span>Category</span>
          <select id="p-cat" className="select" value={f.categoryId} onChange={set('categoryId')}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        </label>
        <label className="field"><span>VAT</span>
          <select id="p-vat" className="select" value={f.vatType} onChange={set('vatType')}>{Object.entries(VAT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </label>
        <label className="field"><span>Selling price (₱, VAT included)</span><input id="p-price" className="input mono" inputMode="decimal" value={f.price} onChange={set('price')} /></label>
        <label className="field"><span>Unit cost (₱)</span><input id="p-cost" className="input mono" inputMode="decimal" value={f.unitCost} onChange={set('unitCost')} /></label>
      </div>
      {toCentavos(f.price) > 0 && (
        <div className="callout info">Profit per item: {peso(Math.round(toCentavos(f.price) / 1.12) - toCentavos(f.unitCost))} after VAT and cost.</div>
      )}
    </Modal>
  );
}
