// Pure pricing rules. No React here, so it can be unit tested and reused by the real build.
// Prices are VAT-inclusive (VAT-registered café). Amounts are centavos.

export const VAT_RATE = 0.12;
const SENIOR_RATE = 0.2;

/**
 * @typedef {{ key:string, productId:string, categoryId:string, name:string, qty:number,
 *   unitPrice:number, unitCost:number, senior?:boolean }} CartLine
 * @typedef {{ id:string, name:string, type:string, rules:object, active:boolean }} Promo
 */

/** Discount if the line is for a Senior/PWD: remove VAT, then 20% off. */
export function seniorDiscount(gross) {
  return Math.round(gross - (gross / (1 + VAT_RATE)) * (1 - SENIOR_RATE));
}

function linePromo(line, promos) {
  let best = { amount: 0, label: '' };
  for (const p of promos) {
    if (!p.active) continue;
    const r = p.rules || {};
    let amount = 0;
    const gross = line.unitPrice * line.qty;
    if (p.type === 'percent_off') {
      const hit = (r.categoryId && r.categoryId === line.categoryId) || (r.productIds || []).includes(line.productId);
      if (hit) amount = Math.round((gross * r.percent) / 100);
    } else if (p.type === 'fixed_off') {
      if ((r.productIds || []).includes(line.productId)) amount = Math.min(gross, r.amount * line.qty);
    } else if (p.type === 'buy_x_get_y') {
      if (r.productId === line.productId) {
        const group = r.buy + r.get;
        const free = Math.floor(line.qty / group) * r.get;
        amount = free * line.unitPrice;
      }
    }
    if (amount > best.amount) best = { amount, label: p.name };
  }
  return best;
}

/** Bundle promos: each complete set of products gets the bundle price. */
function bundleDiscounts(lines, promos) {
  const out = {}; // line key -> {amount,label}
  for (const p of promos) {
    if (!p.active || p.type !== 'bundle_price') continue;
    const ids = p.rules.productIds || [];
    const qtyOf = (id) => lines.filter((l) => l.productId === id && !l.senior).reduce((s, l) => s + l.qty, 0);
    const sets = Math.min(...ids.map(qtyOf));
    if (!sets || !Number.isFinite(sets)) continue;
    const priceOf = (id) => lines.find((l) => l.productId === id).unitPrice;
    const perSet = ids.reduce((s, id) => s + priceOf(id), 0) - p.rules.price;
    if (perSet <= 0) continue;
    const first = lines.find((l) => l.productId === ids[0] && !l.senior);
    const prev = out[first.key];
    const amount = perSet * sets;
    if (!prev || amount > prev.amount) out[first.key] = { amount, label: p.name };
  }
  return out;
}

/**
 * @param {CartLine[]} cart
 * @param {{ promos?:Promo[], custom?:{name:string,valueType:string,value:number,maxPerOrder?:number}|null,
 *   voucher?:{code:string,valueType:string,value:number}|null }} ctx
 */
export function computeOrderTotals(cart, ctx = {}) {
  const promos = ctx.promos || [];
  const bundles = bundleDiscounts(cart, promos);
  const discountMap = new Map();
  const addDisc = (source, label, amount) => {
    if (amount <= 0) return;
    const k = `${source}:${label}`;
    const d = discountMap.get(k) || { source, label, amount: 0 };
    d.amount += amount;
    discountMap.set(k, d);
  };

  let vatable = 0;
  let exempt = 0;
  const lines = cart.map((line) => {
    const gross = line.unitPrice * line.qty;
    let promo = linePromo(line, promos);
    const b = bundles[line.key];
    if (b && b.amount > promo.amount) promo = b;
    let discount = 0;
    let label = '';
    let isExempt = false;
    if (line.senior) {
      const sd = seniorDiscount(gross);
      // Only one of Senior/PWD or a promo applies; the customer gets the bigger one.
      if (sd >= promo.amount) {
        discount = sd;
        label = 'Senior/PWD 20%';
        isExempt = true;
        addDisc('senior', 'Senior/PWD 20% (VAT-exempt)', sd);
      } else {
        discount = promo.amount;
        label = promo.label;
        addDisc('promo', promo.label, promo.amount);
      }
    } else if (promo.amount > 0) {
      discount = promo.amount;
      label = promo.label;
      addDisc('promo', promo.label, promo.amount);
    }
    const net = gross - discount;
    if (isExempt) exempt += net;
    else vatable += net;
    return { ...line, gross, discount, discountLabel: label, net, exempt: isExempt };
  });

  const subtotal = lines.reduce((s, l) => s + l.gross, 0);

  // Order-level discounts reduce the vatable and exempt portions in proportion.
  const applyOrderDiscount = (amount) => {
    const base = vatable + exempt;
    if (base <= 0 || amount <= 0) return 0;
    const a = Math.min(amount, base);
    const fromVatable = Math.round((a * vatable) / base);
    vatable -= fromVatable;
    exempt -= a - fromVatable;
    return a;
  };

  for (const p of promos) {
    if (!p.active || p.type !== 'min_spend') continue;
    if (vatable + exempt >= p.rules.min) addDisc('promo', p.name, applyOrderDiscount(p.rules.amount));
  }

  if (ctx.custom) {
    const c = ctx.custom;
    let amt = c.valueType === 'percent' ? Math.round(((vatable + exempt) * c.value) / 100) : c.value;
    if (c.maxPerOrder) amt = Math.min(amt, c.maxPerOrder);
    addDisc('custom', c.name, applyOrderDiscount(amt));
  }

  if (ctx.voucher) {
    const v = ctx.voucher;
    const amt = v.valueType === 'percent' ? Math.round(((vatable + exempt) * v.value) / 100) : v.value;
    addDisc('voucher', `Voucher ${v.code}`, applyOrderDiscount(amt));
  }

  const vatAmount = Math.round((vatable * VAT_RATE) / (1 + VAT_RATE));
  const total = vatable + exempt;
  const discounts = [...discountMap.values()];
  return {
    lines,
    subtotal,
    discounts,
    discountTotal: subtotal - total,
    vatableSales: vatable - vatAmount,
    vatAmount,
    vatExemptSales: exempt,
    total,
  };
}
