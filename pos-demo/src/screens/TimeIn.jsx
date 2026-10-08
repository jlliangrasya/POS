import React from 'react';
import { store, useStore, useNow, uid } from '../lib/store.js';
import { currentShiftSlot, dayKey } from '../lib/seed.js';
import { Avatar, ROLE_LABEL, fmtTime, useToast } from '../components/ui.jsx';

function FaceGlyph() {
  return (
    <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <path d="M14 30V18a4 4 0 0 1 4-4h12M70 14h12a4 4 0 0 1 4 4v12M86 70v12a4 4 0 0 1-4 4H70M30 86H18a4 4 0 0 1-4-4V70" />
      <ellipse cx="50" cy="50" rx="20" ry="25" />
      <path d="M42 45h.01M58 45h.01M44 60c3.5 3 8.5 3 12 0" />
    </svg>
  );
}

const lateMinutesNow = (now) => {
  const slot = currentShiftSlot(now);
  return Math.max(0, Math.floor((now - slot.start) / 60000) - 5);
};

/** Records time-in (or returns the open record). */
function recordTimeIn(staff, method) {
  const now = new Date();
  const s = store.get();
  const open = s.attendance.find((a) => a.staffId === staff.id && !a.timeOut);
  if (open) return { record: open, isNew: false };
  const shift = s.shifts.find((x) => x.status === 'open');
  const record = {
    id: uid('a'), staffId: staff.id, shiftId: shift ? shift.id : null, date: dayKey(now),
    timeIn: now.toISOString(), timeOut: null, method, flagged: method === 'pin', lateMinutes: lateMinutesNow(now),
  };
  store.update((d) => { d.attendance.push(record); });
  return { record, isNew: true };
}

export default function TimeIn({ onCashierIn }) {
  const staff = useStore((s) => s.staff.filter((x) => x.active));
  const openShift = useStore((s) => s.shifts.find((x) => x.status === 'open'));
  const company = useStore((s) => s.company);
  const now = useNow(1000);
  const toast = useToast();
  const defaultFace = openShift ? openShift.openedBy : staff[0].id;
  const [face, setFace] = React.useState(defaultFace);
  const [phase, setPhase] = React.useState('idle'); // idle | scanning | result | nomatch | pin
  const [action, setAction] = React.useState('in');
  const [result, setResult] = React.useState(null);
  const [pinStaff, setPinStaff] = React.useState(null);
  const [pin, setPin] = React.useState('');
  const timer = React.useRef(null);
  React.useEffect(() => () => clearTimeout(timer.current), []);

  const finish = (person, method) => {
    if (action === 'out') {
      const open = store.get().attendance.find((a) => a.staffId === person.id && !a.timeOut);
      if (!open) { setResult({ person, text: `${person.name.split(' ')[0]}, you haven't timed in today.`, kind: 'warn' }); setPhase('result'); return; }
      if (person.role === 'cashier' && openShift && openShift.openedBy === person.id) {
        setResult({ person, text: 'Close your shift from the POS first. Your time-out is recorded when you count the cash.', kind: 'warn' });
        setPhase('result'); return;
      }
      store.update((d) => { const a = d.attendance.find((x) => x.id === open.id); a.timeOut = new Date().toISOString(); });
      setResult({ person, text: `Timed out at ${fmtTime(new Date().toISOString())}. Ingat!`, kind: 'good' });
      setPhase('result');
      timer.current = setTimeout(() => reset(), 3500);
      return;
    }
    const { record, isNew } = recordTimeIn(person, method);
    const late = isNew && record.lateMinutes > 0 ? ` (${record.lateMinutes} min late)` : '';
    setResult({
      person, recordId: isNew ? record.id : null, kind: method === 'pin' ? 'warn' : 'good',
      canEnter: person.role === 'cashier', viaFace: method === 'face',
      text: isNew ? `Timed in at ${fmtTime(record.timeIn)}${late}.` : `You timed in at ${fmtTime(record.timeIn)}. Welcome back.`,
    });
    setPhase('result');
    if (person.role === 'cashier') {
      timer.current = setTimeout(() => onCashierIn(person.id), 1800);
    } else {
      timer.current = setTimeout(() => reset(), 3500);
    }
  };

  const reset = () => { clearTimeout(timer.current); setPhase('idle'); setResult(null); setPin(''); setPinStaff(null); };

  const scan = (act) => {
    setAction(act);
    setPhase('scanning');
    timer.current = setTimeout(() => {
      const person = staff.find((x) => x.id === face);
      if (!person) { setPhase('nomatch'); return; }
      finish(person, 'face');
    }, 1700);
  };

  const notMe = () => {
    clearTimeout(timer.current);
    if (result && result.recordId) store.update((d) => { d.attendance = d.attendance.filter((a) => a.id !== result.recordId); });
    setResult(null);
    setPhase('pin');
  };

  const pressPin = (k) => {
    if (k === 'del') { setPin((p) => p.slice(0, -1)); return; }
    const next = (pin + k).slice(0, 4);
    setPin(next);
    if (next.length === 4) {
      if (pinStaff && pinStaff.pin === next) { finish(pinStaff, 'pin'); setPin(''); }
      else { toast('Wrong PIN. Try again.'); setTimeout(() => setPin(''), 300); }
    }
  };

  const time = new Date(now).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
  const date = new Date(now).toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <main className="timein">
      <div className="timein-card">
        <span className="brand"><span className="brand-mark">T</span>{company.name}</span>
        <div className="stack" style={{ gap: 4 }}>
          <div className="clock num">{time}</div>
          <div className="muted">{date}</div>
        </div>

        {(phase === 'idle' || phase === 'scanning') && (
          <>
            <div className={`scanner${phase === 'scanning' ? ' scanning' : ''}`}><FaceGlyph /></div>
            <p className="muted">{phase === 'scanning' ? 'Look at the camera and blink…' : 'Tap a button, then look at the camera.'}</p>
            <div className="row" style={{ width: '100%' }}>
              <button className="btn primary lg" style={{ flex: 2 }} disabled={phase === 'scanning'} onClick={() => scan('in')}>Time in / Log in</button>
              <button className="btn lg" style={{ flex: 1 }} disabled={phase === 'scanning'} onClick={() => scan('out')}>Time out</button>
            </div>
            <div className="demo-pick">
              <span className="label">Demo only: who is in front of the camera?</span>
              <div className="chips">
                {staff.map((s) => (
                  <button key={s.id} className="chip" aria-pressed={face === s.id} onClick={() => setFace(s.id)}>
                    <Avatar staff={s} size={20} />{s.name.split(' ')[0]}
                  </button>
                ))}
                <button className="chip" aria-pressed={face === 'unknown'} onClick={() => setFace('unknown')}>Not registered</button>
              </div>
            </div>
          </>
        )}

        {phase === 'result' && result && (
          <>
            <div className={`scanner ${result.kind === 'good' ? 'ok' : ''}`}><Avatar staff={result.person} size={120} /></div>
            <div className="stack" style={{ gap: 4 }}>
              <h2>Hi {result.person.name.split(' ')[0]}!</h2>
              <p className="muted">{ROLE_LABEL[result.person.role]}</p>
            </div>
            <div className={`callout ${result.kind}`} style={{ width: '100%' }}>{result.text}</div>
            <div className="row" style={{ width: '100%' }}>
              {result.viaFace && (
                <button className="btn" style={{ flex: 1 }} onClick={notMe}>Not me</button>
              )}
              <button
                className="btn primary"
                style={{ flex: 2 }}
                onClick={() => {
                  clearTimeout(timer.current);
                  if (result.canEnter) onCashierIn(result.person.id);
                  else reset();
                }}
              >
                {result.canEnter ? 'Open the POS' : 'Done'}
              </button>
            </div>
          </>
        )}

        {phase === 'nomatch' && (
          <>
            <div className="callout bad" style={{ width: '100%' }}>No registered face matched. Try again in better light, or use your PIN.</div>
            <div className="row" style={{ width: '100%' }}>
              <button className="btn" style={{ flex: 1 }} onClick={reset}>Try again</button>
              <button className="btn primary" style={{ flex: 1 }} onClick={() => setPhase('pin')}>Use PIN</button>
            </div>
          </>
        )}

        {phase === 'pin' && (
          <>
            {!pinStaff ? (
              <>
                <p className="muted">Pick your name. PIN logins are flagged on the owner's attendance report.</p>
                <div className="chips">
                  {staff.map((s) => (
                    <button key={s.id} className="chip" onClick={() => setPinStaff(s)}><Avatar staff={s} size={20} />{s.name}</button>
                  ))}
                </div>
                <button className="btn ghost" onClick={reset}>Cancel</button>
              </>
            ) : (
              <>
                <div className="who"><Avatar staff={pinStaff} />{pinStaff.name}</div>
                <div className="pin-dots">{[0, 1, 2, 3].map((i) => <span key={i} className={pin.length > i ? 'on' : ''} />)}</div>
                <div className="pinpad">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((k, i) => (
                    k === '' ? <span key={i} /> : <button key={i} onClick={() => pressPin(k)} aria-label={k === 'del' ? 'Delete' : k}>{k === 'del' ? '⌫' : k}</button>
                  ))}
                </div>
                <p className="small muted">Demo PIN for {pinStaff.name.split(' ')[0]}: {pinStaff.pin}</p>
                <button className="btn ghost" onClick={() => { setPinStaff(null); setPin(''); }}>Back</button>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
