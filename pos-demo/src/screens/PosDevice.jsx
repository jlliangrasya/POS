import React from 'react';
import { store, useStore, uid } from '../lib/store.js';
import { currentShiftSlot } from '../lib/seed.js';
import { toCentavos, peso } from '../lib/money.js';
import { Avatar, useToast } from '../components/ui.jsx';
import TimeIn from './TimeIn.jsx';
import Pos, { PosTopBar } from './Pos.jsx';
import { ShiftClosed } from './ShiftView.jsx';

/** The cashier tablet: locked on the time-in screen until a cashier is identified. */
export default function PosDevice() {
  const [staffId, setStaffId] = React.useState(() => {
    try { return sessionStorage.getItem('tasa-pos-staff'); } catch (e) { return null; }
  });
  const setSession = (id) => {
    setStaffId(id);
    try { if (id) sessionStorage.setItem('tasa-pos-staff', id); else sessionStorage.removeItem('tasa-pos-staff'); } catch (e) { /* ignore */ }
  };
  const staff = useStore((s) => s.staff.find((x) => x.id === staffId));
  const openShift = useStore((s) => s.shifts.find((x) => x.status === 'open'));
  const [closedSummary, setClosedSummary] = React.useState(null);
  const lock = () => { setClosedSummary(null); setSession(null); };

  if (closedSummary && staff) {
    return (
      <>
        <PosTopBar staff={staff} onLock={lock} />
        <ShiftClosed staff={staff} summary={closedSummary} onDone={lock} />
      </>
    );
  }
  if (!staff) return <TimeIn onCashierIn={setSession} />;
  if (!openShift) return <OpenShift staff={staff} onLock={lock} />;
  return <Pos staff={staff} shift={openShift} onLock={lock} onShiftClosed={setClosedSummary} />;
}

function OpenShift({ staff, onLock }) {
  const slot = currentShiftSlot(new Date());
  const [cash, setCash] = React.useState('2000');
  const toast = useToast();
  const open = () => {
    const now = new Date();
    store.update((d) => {
      const shift = {
        id: uid('sh'), template: slot.template.id, label: slot.template.name, openedAt: now.toISOString(),
        openedBy: staff.id, startingCash: toCentavos(cash), status: 'open', deviceCode: d.company.deviceCode, seq: 0,
      };
      d.shifts.push(shift);
      d.attendance.forEach((a) => { if (!a.timeOut && !a.shiftId) a.shiftId = shift.id; });
    });
    toast(`${slot.template.name} shift opened. Sales start at ₱0.00.`);
  };
  return (
    <main className="timein">
      <div className="timein-card">
        <div className="who"><Avatar staff={staff} />{staff.name}</div>
        <h2>Start the {slot.template.name.toLowerCase()} shift</h2>
        <p className="muted">
          {slot.template.name} shift runs {slot.template.start === 7 ? '7:00 AM to 4:00 PM' : '4:00 PM to 12:00 AM'}.
          Count the cash in the drawer before your first sale.
        </p>
        <label className="field" style={{ width: '100%', textAlign: 'left' }}>
          <span>Starting cash in drawer (₱)</span>
          <input id="start-cash" className="input mono" inputMode="decimal" value={cash} onChange={(e) => setCash(e.target.value)} />
        </label>
        <p className="small muted">Shift sales reset to {peso(0)}. Past shifts stay in the reports.</p>
        <div className="row" style={{ width: '100%' }}>
          <button className="btn" style={{ flex: 1 }} onClick={onLock}>Lock</button>
          <button className="btn primary" style={{ flex: 2 }} onClick={open}>Open shift</button>
        </div>
      </div>
    </main>
  );
}
