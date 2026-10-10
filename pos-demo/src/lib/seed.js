// Example data for the demo: one café, two weeks of history, and a shift in progress.
import { computeOrderTotals } from './pricing.js';

const P = (pesos) => Math.round(pesos * 100);

export const SHIFT_TEMPLATES = [
  { id: 'morning', name: 'Morning', start: 7, end: 16 },
  { id: 'evening', name: 'Evening', start: 16, end: 24 },
];

export const CATEGORIES = [
  { id: 'coffee', name: 'Coffee' },
  { id: 'noncoffee', name: 'Non-coffee' },
  { id: 'frappe', name: 'Frappes' },
  { id: 'pastry', name: 'Pastries' },
  { id: 'meals', name: 'Rice meals' },
];

const PRODUCTS = [
  ['brewed', 'coffee', 'Brewed Coffee', 90, 22],
  ['americano', 'coffee', 'Americano', 120, 30],
  ['latte', 'coffee', 'Café Latte', 150, 42],
  ['spanish', 'coffee', 'Spanish Latte', 165, 48],
  ['caramel', 'coffee', 'Caramel Macchiato', 170, 50],
  ['mocha', 'coffee', 'Iced Mocha', 165, 48],
  ['matcha', 'noncoffee', 'Matcha Latte', 160, 50],
  ['choco', 'noncoffee', 'Iced Chocolate', 140, 38],
  ['calamansi', 'noncoffee', 'Calamansi Juice', 95, 20],
  ['javachip', 'frappe', 'Java Chip Frappe', 185, 55],
  ['ube', 'frappe', 'Ube Frappe', 180, 52],
  ['mango', 'frappe', 'Mango Graham Frappe', 180, 50],
  ['ensaymada', 'pastry', 'Ensaymada', 65, 22],
  ['bananabread', 'pastry', 'Banana Bread', 85, 25],
  ['cheesecake', 'pastry', 'Blueberry Cheesecake', 150, 55],
  ['croissant', 'pastry', 'Chocolate Croissant', 110, 40],
  ['tapsilog', 'meals', 'Tapsilog', 210, 90],
  ['adobo', 'meals', 'Chicken Adobo Rice Bowl', 195, 80],
  ['longsilog', 'meals', 'Longsilog', 185, 75],
  ['clubhouse', 'meals', 'Clubhouse Sandwich', 175, 70],
].map(([id, categoryId, name, price, cost], i) => ({
  id, categoryId, name, price: P(price), unitCost: P(cost), vatType: 'vatable', available: true, sort: i,
}));

export const ADDONS = [
  { id: 'shot', name: 'Extra shot', price: P(30), unitCost: P(10), categories: ['coffee', 'noncoffee', 'frappe'] },
  { id: 'oat', name: 'Oat milk', price: P(35), unitCost: P(15), categories: ['coffee', 'noncoffee', 'frappe'] },
  { id: 'rice', name: 'Extra rice', price: P(25), unitCost: P(8), categories: ['meals'] },
  { id: 'egg', name: 'Fried egg', price: P(20), unitCost: P(8), categories: ['meals'] },
];

const PROMOS = [
  { id: 'p-happy', name: 'Happy Hour Frappes', type: 'percent_off', rules: { categoryId: 'frappe', percent: 10 },
    schedule: 'Mon–Fri, 2:00–5:00 PM', active: true },
  { id: 'p-combo', name: 'Latte + Banana Bread Combo', type: 'bundle_price', rules: { productIds: ['latte', 'bananabread'], price: P(199) },
    schedule: 'Every day', active: true },
  { id: 'p-b1t1', name: 'Brewed Coffee Buy 1 Take 1', type: 'buy_x_get_y', rules: { productId: 'brewed', buy: 1, get: 1 },
    schedule: 'Sat–Sun, 7:00–10:00 AM', active: false },
  { id: 'p-500', name: '₱50 off orders ₱500 and up', type: 'min_spend', rules: { min: P(500), amount: P(50) },
    schedule: 'Every day', active: false },
];

const DISCOUNT_TYPES = [
  { id: 'd-emp', name: 'Employee', valueType: 'percent', value: 10, maxPerOrder: P(100) },
  { id: 'd-loyal', name: 'Loyal customer', valueType: 'percent', value: 5, maxPerOrder: P(100) },
  { id: 'd-bday', name: 'Birthday', valueType: 'fixed', value: P(100), maxPerOrder: P(100) },
];

const STAFF = [
  { id: 's-ana', name: 'Ana Reyes', role: 'cashier', shift: 'morning', payType: 'daily', rate: P(550), pin: '1111', hue: 18 },
  { id: 's-mark', name: 'Mark Dela Cruz', role: 'cashier', shift: 'evening', payType: 'daily', rate: P(550), pin: '2222', hue: 205 },
  { id: 's-joy', name: 'Joy Santos', role: 'kitchen', shift: 'morning', payType: 'daily', rate: P(520), pin: '3333', hue: 330 },
  { id: 's-rico', name: 'Rico Lim', role: 'server', shift: 'morning', payType: 'daily', rate: P(500), pin: '4444', hue: 140 },
  { id: 's-bea', name: 'Bea Cruz', role: 'kitchen', shift: 'evening', payType: 'daily', rate: P(520), pin: '5555', hue: 265 },
].map((s) => ({ ...s, active: true, faceEnrolled: true, consentAt: '2026-09-01T09:00:00' }));

const NAMES = ['Carlo', 'Mika', 'Jerome', 'Trish', 'Paolo', 'Kim', 'Ella', 'Jun', 'Rhea', 'Nico', 'Sam', 'Gab',
  'Lea', 'Vince', 'Patty', 'Migs', 'Andrea', 'Bryan', 'Cel', 'Dindo', 'Faith', 'Gelo', 'Hazel', 'Ivan'];

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const dayKey = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

/** Which shift the clock is in right now, and when it started. */
export function currentShiftSlot(now = new Date()) {
  const h = now.getHours();
  const start = new Date(now);
  start.setMinutes(0, 0, 0);
  if (h >= 16) { start.setHours(16); return { template: SHIFT_TEMPLATES[1], start }; }
  if (h >= 7) { start.setHours(7); return { template: SHIFT_TEMPLATES[0], start }; }
  start.setDate(start.getDate() - 1); start.setHours(16);
  return { template: SHIFT_TEMPLATES[1], start };
}

const WEIGHTS = {
  brewed: 8, americano: 6, latte: 9, spanish: 10, caramel: 7, mocha: 6, matcha: 6, choco: 4, calamansi: 3,
  javachip: 5, ube: 5, mango: 6, ensaymada: 7, bananabread: 5, cheesecake: 3, croissant: 4,
  tapsilog: 6, adobo: 5, longsilog: 4, clubhouse: 3,
};

function pickProduct(r) {
  const total = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
  let x = r() * total;
  for (const p of PRODUCTS) { x -= WEIGHTS[p.id]; if (x <= 0) return p; }
  return PRODUCTS[0];
}

function makeOrder(r, { shift, at, seq, cashier, promos, status = 'served' }) {
  const n = 1 + Math.floor(r() * 3.2);
  const cart = [];
  for (let i = 0; i < n; i++) {
    const p = pickProduct(r);
    const ex = cart.find((l) => l.productId === p.id);
    if (ex) { ex.qty += 1; continue; }
    const addon = r() < 0.12 ? ADDONS.find((a) => a.categories.includes(p.categoryId)) : null;
    cart.push({
      key: `${p.id}-${i}`, productId: p.id, categoryId: p.categoryId, name: p.name, qty: r() < 0.15 ? 2 : 1,
      unitPrice: p.price + (addon ? addon.price : 0), unitCost: p.unitCost + (addon ? addon.unitCost : 0),
      addons: addon ? [addon.name] : [], notes: '', senior: r() < 0.05,
    });
  }
  const t = computeOrderTotals(cart, { promos });
  const roll = r();
  const method = roll < 0.58 ? 'cash' : roll < 0.88 ? 'gcash' : roll < 0.96 ? 'maya' : 'card';
  const tendered = method === 'cash' ? Math.ceil(t.total / 10000) * 10000 + (r() < 0.3 ? 10000 : 0) : t.total;
  const dine = r() < 0.6;
  return {
    id: `o-${shift.id}-${seq}`,
    no: `A-${String(seq).padStart(3, '0')}`,
    shiftId: shift.id,
    customer: NAMES[Math.floor(r() * NAMES.length)],
    type: dine ? 'dine_in' : 'take_out',
    table: dine ? String(1 + Math.floor(r() * 10)) : '',
    items: t.lines.map((l) => ({ ...l, served: status === 'served' })),
    discounts: t.discounts,
    subtotal: t.subtotal, discountTotal: t.discountTotal, vatAmount: t.vatAmount,
    vatableSales: t.vatableSales, vatExemptSales: t.vatExemptSales, total: t.total,
    payments: [{ method, amount: t.total, ref: method === 'cash' ? '' : String(Math.floor(1e12 + r() * 9e12)) }],
    tendered, change: tendered - t.total,
    status,
    createdAt: at.toISOString(),
    servedAt: status === 'served' ? new Date(at.getTime() + (5 + r() * 12) * 60000).toISOString() : null,
    createdBy: cashier,
    synced: true,
  };
}

function shiftBounds(day, template) {
  const s = new Date(day); s.setHours(template.start, 0, 0, 0);
  const e = new Date(day); e.setHours(template.end, 0, 0, 0);
  return [s, e];
}

export function buildSeed(now = new Date()) {
  const r = rng(20261008);
  const slot = currentShiftSlot(now);
  const shifts = [];
  const orders = [];
  const attendance = [];
  const expenses = [];
  const staffFor = (tpl) => STAFF.filter((s) => s.shift === tpl.id);

  const histPromos = PROMOS.filter((p) => p.id === 'p-combo');

  for (let d = 13; d >= 0; d--) {
    const day = new Date(now); day.setDate(day.getDate() - d); day.setHours(0, 0, 0, 0);
    for (const tpl of SHIFT_TEMPLATES) {
      const [s, e] = shiftBounds(day, tpl);
      if (s >= slot.start) continue; // the current shift is seeded separately below
      const cashier = staffFor(tpl).find((x) => x.role === 'cashier');
      const shift = {
        id: `sh-${dayKey(day)}-${tpl.id}`, template: tpl.id, label: tpl.name,
        openedAt: new Date(s.getTime() + 2 * 60000).toISOString(), openedBy: cashier.id, startingCash: P(2000),
        status: 'closed', deviceCode: 'A', seq: 0,
      };
      const weekend = [0, 6].includes(day.getDay());
      const count = Math.floor((tpl.id === 'morning' ? 26 : 20) * (weekend ? 1.35 : 1) * (0.8 + r() * 0.4));
      let cashSales = 0;
      for (let i = 1; i <= count; i++) {
        const at = new Date(s.getTime() + ((i - 0.5 + r() * 0.5) / count) * (e - s));
        const isHappy = !weekend && at.getHours() >= 14 && at.getHours() < 17;
        const promos = isHappy ? [...histPromos, PROMOS[0]] : histPromos;
        const o = makeOrder(r, { shift, at, seq: i, cashier: cashier.id, promos });
        orders.push(o);
        if (o.payments[0].method === 'cash') cashSales += o.total;
      }
      shift.seq = count;
      const drift = r() < 0.75 ? 0 : [-5000, -2000, -1000, 1000, 2000][Math.floor(r() * 5)];
      shift.expectedCash = shift.startingCash + cashSales;
      shift.countedCash = shift.expectedCash + drift;
      shift.overShort = drift;
      shift.closedAt = new Date(e.getTime() + (5 + r() * 15) * 60000).toISOString();
      shift.closedBy = cashier.id;
      shifts.push(shift);

      for (const st of staffFor(tpl)) {
        const late = r() < 0.18 ? Math.floor(6 + r() * 20) : 0;
        const tin = new Date(s.getTime() + (late ? late : -Math.floor(r() * 12)) * 60000);
        const tout = new Date(e.getTime() + Math.floor(r() * 25) * 60000);
        attendance.push({
          id: `a-${shift.id}-${st.id}`, staffId: st.id, shiftId: shift.id, date: dayKey(s),
          timeIn: tin.toISOString(), timeOut: tout.toISOString(), method: r() < 0.06 ? 'pin' : 'face',
          flagged: false, lateMinutes: late,
        });
      }
    }
  }
  attendance.forEach((a) => { if (a.method === 'pin') a.flagged = true; });

  // The shift in progress right now, opened by its cashier, with a few orders still in the kitchen.
  const tpl = slot.template;
  const cashier = staffFor(tpl).find((x) => x.role === 'cashier');
  const current = {
    id: `sh-${dayKey(slot.start)}-${tpl.id}`, template: tpl.id, label: tpl.name,
    openedAt: new Date(slot.start.getTime() + 3 * 60000).toISOString(), openedBy: cashier.id,
    startingCash: P(2000), status: 'open', deviceCode: 'A', seq: 0,
  };
  const elapsed = Math.max(now - slot.start, 40 * 60000);
  const done = Math.max(4, Math.min(14, Math.floor(elapsed / (22 * 60000))));
  const activePromos = PROMOS.filter((p) => p.active);
  let seq = 0;
  for (let i = 0; i < done; i++) {
    const at = new Date(now.getTime() - elapsed + ((i + 0.3) / (done + 3)) * (elapsed - 25 * 60000));
    orders.push(makeOrder(r, { shift: current, at, seq: ++seq, cashier: cashier.id, promos: activePromos }));
  }
  [[18, 'preparing'], [9, 'preparing'], [3, 'pending']].forEach(([mins, status]) => {
    const o = makeOrder(r, { shift: current, at: new Date(now.getTime() - mins * 60000), seq: ++seq, cashier: cashier.id, promos: activePromos, status });
    if (mins === 9) o.items[0].served = true;
    orders.push(o);
  });
  // Two dine-in customers paying after they eat: one already served and due for a reminder.
  [[38, 'served'], [12, 'preparing']].forEach(([mins, status]) => {
    const o = makeOrder(r, { shift: current, at: new Date(now.getTime() - mins * 60000), seq: ++seq, cashier: cashier.id, promos: activePromos, status });
    Object.assign(o, { type: 'dine_in', table: mins === 38 ? '4' : '7', payments: [], tendered: 0, change: 0, payLater: true });
    if (status === 'served') o.servedAt = new Date(now.getTime() - 24 * 60000).toISOString();
    orders.push(o);
  });
  current.seq = seq;
  shifts.push(current);
  for (const st of staffFor(tpl)) {
    attendance.push({
      id: `a-${current.id}-${st.id}`, staffId: st.id, shiftId: current.id, date: dayKey(slot.start),
      timeIn: new Date(slot.start.getTime() - (2 + Math.floor(r() * 8)) * 60000).toISOString(), timeOut: null,
      method: 'face', flagged: false, lateMinutes: 0,
    });
  }

  // Expenses across the last two weeks.
  const EXP = [
    [13, 'Supplies', 6850, 'Fresh milk, 24 L'], [12, 'Supplies', 4200, 'Coffee beans, 3 kg'], [11, 'Utilities', 6820, 'Electricity, September'],
    [10, 'Supplies', 1850, 'Cups and lids'], [9, 'Repairs', 1200, 'Blender blade replacement'], [8, 'Supplies', 3900, 'Rice and meat for meals'],
    [7, 'Supplies', 6600, 'Fresh milk, 24 L'], [6, 'Utilities', 940, 'Water'], [5, 'Others', 750, 'LPG refill'],
    [4, 'Supplies', 4100, 'Rice and meat for meals'], [3, 'Supplies', 2350, 'Matcha powder and syrups'],
    [2, 'Rent', 25000, 'Space rental, October'], [1, 'Supplies', 6700, 'Fresh milk, 24 L'], [0, 'Supplies', 980, 'Pastry delivery'],
  ];
  EXP.forEach(([d, category, amt, notes], i) => {
    const day = new Date(now); day.setDate(day.getDate() - d); day.setHours(10, 0, 0, 0);
    expenses.push({ id: `e-${i}`, date: dayKey(day), category, amount: P(amt), notes, createdBy: 'owner' });
  });
  // Paid out of the cash drawer during the current shift.
  [[95, 'Supplies', 240, 'Ice, 3 bags'], [50, 'Others', 60, 'Tricycle fare, supply run']].forEach(([mins, category, amt, notes], i) => {
    const at = new Date(Math.max(now.getTime() - mins * 60000, slot.start.getTime() + 20 * 60000));
    expenses.push({ id: `e-shift-${i}`, date: dayKey(at), at: at.toISOString(), category, amount: P(amt), notes, createdBy: cashier.id, shiftId: current.id });
  });

  const vouchers = [
    { id: 'v-1', code: 'TASA-7KQ2', valueType: 'fixed', value: P(50), expiresAt: dayKey(new Date(now.getTime() + 20 * 864e5)), createdBy: cashier.id, redeemedAt: null },
    { id: 'v-2', code: 'TASA-B9XM', valueType: 'percent', value: 10, expiresAt: dayKey(new Date(now.getTime() + 10 * 864e5)), createdBy: 's-mark', redeemedAt: new Date(now.getTime() - 2 * 864e5).toISOString() },
  ];

  return {
    version: 4,
    seededAt: now.toISOString(),
    company: { name: 'Cafe Adullam x Amoa', branch: 'Main branch', plan: 'business', vatRegistered: true, deviceCode: 'A' },
    categories: CATEGORIES,
    products: PRODUCTS,
    addons: ADDONS,
    promos: PROMOS,
    discountTypes: DISCOUNT_TYPES,
    vouchers,
    staff: STAFF,
    shifts,
    orders,
    attendance,
    expenses,
    deductions: {}, // payroll deductions typed by the admin, keyed by staffId
    session: { staffId: null },
    offline: false,
  };
}
