import React from 'react';
import { store, useStore, uid } from '../lib/store.js';
import { peso, toCentavos } from '../lib/money.js';
import { Modal, useToast } from '../components/ui.jsx';
import { dayKey } from '../lib/seed.js';

const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const makeCode = () => `TASA-${Array.from({ length: 4 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('')}`;

export function voucherValue(v) { return v.valueType === 'percent' ? `${v.value}% off` : `${peso(v.value)} off`; }

/** Voucher generator: used inline on the cashier's My shift screen and in a modal for the owner. */
export function VoucherGenerator({ staff, showList = true }) {
  const vouchers = useStore((s) => s.vouchers);
  const toast = useToast();
  const [type, setType] = React.useState('fixed');
  const [value, setValue] = React.useState('50');
  const [days, setDays] = React.useState('30');
  const [made, setMade] = React.useState(null);

  const create = () => {
    const v = {
      id: uid('v'), code: makeCode(), valueType: type,
      value: type === 'percent' ? Math.min(100, parseInt(value, 10) || 0) : toCentavos(value),
      expiresAt: dayKey(new Date(Date.now() + (parseInt(days, 10) || 30) * 864e5)), createdBy: staff ? staff.id : 'owner', redeemedAt: null,
    };
    store.update((d) => { d.vouchers.unshift(v); });
    setMade(v);
    toast(`Voucher ${v.code} created.`);
  };

  return (
    <div className="stack">
      <div className="grid3">
        <label className="field">
          <span>Type</span>
          <select id="v-type" className="select" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="fixed">Peso amount</option>
            <option value="percent">Percent</option>
          </select>
        </label>
        <label className="field">
          <span>{type === 'percent' ? 'Percent off' : 'Amount off (₱)'}</span>
          <input id="v-value" className="input mono" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
        </label>
        <label className="field">
          <span>Valid for (days)</span>
          <input id="v-days" className="input mono" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
        </label>
      </div>
      <button className="btn primary" onClick={create}>Generate voucher</button>
      {made && (
        <div className="callout good">
          <div className="mono" style={{ fontSize: '1.4rem', fontWeight: 600 }}>{made.code}</div>
          {voucherValue(made)} · valid until {made.expiresAt} · one use only
        </div>
      )}
      {showList && (
        <div className="tablewrap">
          <table className="t">
            <thead><tr><th>Code</th><th>Value</th><th>Expires</th><th>Status</th></tr></thead>
            <tbody>
              {vouchers.slice(0, 5).map((v) => (
                <tr key={v.id}>
                  <td className="mono">{v.code}</td>
                  <td>{voucherValue(v)}</td>
                  <td>{v.expiresAt}</td>
                  <td>{v.redeemedAt ? <span className="pill neutral">Used</span> : <span className="pill good">Unused</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function VoucherModal({ staff, onClose }) {
  return (
    <Modal title="Generate voucher" onClose={onClose}>
      <VoucherGenerator staff={staff} />
    </Modal>
  );
}
