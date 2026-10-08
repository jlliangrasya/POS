import React from 'react';
import { store, useStore, uid } from '../lib/store.js';
import { peso, toCentavos } from '../lib/money.js';
import { Avatar, Modal, ROLE_LABEL, fmtTime, fmtDateLong, useToast } from '../components/ui.jsx';

export const hoursOf = (a) => (a.timeOut ? (new Date(a.timeOut) - new Date(a.timeIn)) / 3600000 : 0);

export default function Staff() {
  const staff = useStore((s) => s.staff);
  const attendance = useStore((s) => s.attendance);
  const [adding, setAdding] = React.useState(false);
  const [filter, setFilter] = React.useState('all');
  const inNow = attendance.filter((a) => !a.timeOut);
  const log = [...attendance].sort((a, b) => b.timeIn.localeCompare(a.timeIn))
    .filter((a) => filter === 'all' || (filter === 'flagged' ? a.flagged : a.lateMinutes > 0)).slice(0, 40);
  const name = (id) => staff.find((s) => s.id === id);

  return (
    <>
      <div className="page-head">
        <div><span className="label">Team</span><h1>Staff and attendance</h1></div>
        <div className="spacer" />
        <button className="btn primary" onClick={() => setAdding(true)}>Register staff</button>
      </div>

      <div className="twocol">
        <section className="panel">
          <h3>Staff</h3>
          <div className="tablewrap">
            <table className="t">
              <thead><tr><th>Name</th><th>Role</th><th className="r">Rate</th><th>Face</th></tr></thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.id}>
                    <td><span className="who"><Avatar staff={s} size={26} />{s.name}</span></td>
                    <td>{ROLE_LABEL[s.role]}</td>
                    <td className="r">{peso(s.rate)}/day</td>
                    <td>{s.faceEnrolled ? <span className="pill good">Registered</span> : <span className="pill warn">Not yet</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="panel">
          <h3>On duty now</h3>
          {inNow.length === 0 ? <p className="muted">Nobody is timed in.</p> : inNow.map((a) => (
            <div key={a.id} className="row">
              <Avatar staff={name(a.staffId)} />
              <div className="stack" style={{ gap: 0 }}>
                <strong>{name(a.staffId).name}</strong>
                <span className="small muted">In at {fmtTime(a.timeIn)}{a.lateMinutes ? ` · ${a.lateMinutes} min late` : ''}</span>
              </div>
              <div className="spacer" />
              {a.method === 'pin' ? <span className="pill warn">PIN</span> : <span className="pill good">Face</span>}
            </div>
          ))}
        </section>
      </div>

      <section className="panel">
        <div className="row">
          <h3>Time in and out</h3>
          <div className="spacer" />
          <div className="seg" role="group" aria-label="Filter">
            <button aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All</button>
            <button aria-pressed={filter === 'late'} onClick={() => setFilter('late')}>Late</button>
            <button aria-pressed={filter === 'flagged'} onClick={() => setFilter('flagged')}>PIN logins</button>
          </div>
        </div>
        <div className="tablewrap">
          <table className="t">
            <thead><tr><th>Staff</th><th>Date</th><th>In</th><th>Out</th><th className="r">Hours</th><th>Late</th><th>Method</th></tr></thead>
            <tbody>
              {log.map((a) => (
                <tr key={a.id}>
                  <td>{name(a.staffId).name}</td>
                  <td>{fmtDateLong(a.timeIn)}</td>
                  <td>{fmtTime(a.timeIn)}</td>
                  <td>{a.timeOut ? fmtTime(a.timeOut) : <span className="pill info">On duty</span>}</td>
                  <td className="r">{a.timeOut ? hoursOf(a).toFixed(1) : '—'}</td>
                  <td>{a.lateMinutes ? <span className="pill warn">{a.lateMinutes} min</span> : <span className="muted">—</span>}</td>
                  <td>{a.method === 'pin' ? <span className="pill bad">PIN · check</span> : <span className="pill good">Face</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted">PIN logins are flagged because they skip the face check. Late is counted after a 5-minute grace period.</p>
      </section>
      {adding && <Enroll onClose={() => setAdding(false)} />}
    </>
  );
}

function Enroll({ onClose }) {
  const toast = useToast();
  const [f, setF] = React.useState({ name: '', role: 'cashier', rate: '550', pin: '' });
  const [shots, setShots] = React.useState(0);
  const [consent, setConsent] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const capture = () => {
    setBusy(true);
    let n = shots;
    const t = setInterval(() => {
      n += 1; setShots(n);
      if (n >= 3) { clearInterval(t); setBusy(false); }
    }, 600);
  };
  const ok = f.name.trim() && /^\d{4}$/.test(f.pin) && shots >= 3 && consent;
  const save = () => {
    store.update((d) => {
      d.staff.push({
        id: uid('s'), name: f.name.trim(), role: f.role, shift: 'morning', payType: 'daily', rate: toCentavos(f.rate), pin: f.pin,
        hue: Math.floor(Math.random() * 360), active: true, faceEnrolled: true, consentAt: new Date().toISOString(),
      });
    });
    toast(`${f.name.trim()} registered. They can time in with a face scan now.`);
    onClose();
  };
  return (
    <Modal title="Register staff" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!ok} onClick={save}>Save staff</button></>}>
      <div className="grid2">
        <label className="field"><span>Full name</span><input id="st-name" className="input" value={f.name} onChange={set('name')} /></label>
        <label className="field"><span>Role</span><select id="st-role" className="select" value={f.role} onChange={set('role')}>{Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="field"><span>Daily rate (₱)</span><input id="st-rate" className="input mono" value={f.rate} onChange={set('rate')} /></label>
        <label className="field"><span>4-digit backup PIN</span><input id="st-pin" className="input mono" inputMode="numeric" maxLength={4} value={f.pin} onChange={set('pin')} /></label>
      </div>
      <div className="stack" style={{ alignItems: 'center', gap: 10 }}>
        <div className={`scanner${busy ? ' scanning' : shots >= 3 ? ' ok' : ''}`} style={{ width: 160, height: 160 }}>
          <span className="num" style={{ fontFamily: 'var(--display)', fontSize: '1.6rem', fontWeight: 700 }}>{shots}/3</span>
        </div>
        <button className="btn" disabled={busy || shots >= 3} onClick={capture}>{shots >= 3 ? 'Face registered' : 'Scan face (3 quick shots)'}</button>
        <p className="small muted" style={{ textAlign: 'center' }}>Only a face code is saved, never the photos.</p>
      </div>
      <label className="row small" style={{ cursor: 'pointer', alignItems: 'flex-start', flexWrap: 'nowrap' }}>
        <input id="st-consent" type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 3 }} />
        <span>The staff member agrees to use face scan for attendance. The face code is deleted when they leave.</span>
      </label>
    </Modal>
  );
}
