// Report helpers shared by the POS and the owner dashboard.

export const validOrders = (orders) => orders.filter((o) => o.status !== 'void');

export function shiftSummary(shift, allOrders) {
  const orders = validOrders(allOrders.filter((o) => o.shiftId === shift.id));
  const byMethod = { cash: 0, gcash: 0, maya: 0, card: 0 };
  orders.forEach((o) => o.payments.forEach((p) => { byMethod[p.method] = (byMethod[p.method] || 0) + p.amount; }));
  const gross = orders.reduce((s, o) => s + o.subtotal, 0);
  const net = orders.reduce((s, o) => s + o.total, 0);
  const cost = orders.reduce((s, o) => s + o.items.reduce((a, i) => a + i.unitCost * i.qty, 0), 0);
  return {
    count: orders.length,
    gross,
    discounts: gross - net,
    net,
    vat: orders.reduce((s, o) => s + o.vatAmount, 0),
    cost,
    byMethod,
    expectedCash: shift.startingCash + byMethod.cash,
  };
}

export function orderCost(o) { return o.items.reduce((a, i) => a + i.unitCost * i.qty, 0); }
