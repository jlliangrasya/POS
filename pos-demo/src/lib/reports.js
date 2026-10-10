// Report helpers shared by the POS and the owner dashboard.

export const validOrders = (orders) => orders.filter((o) => o.status !== 'void');

export const amountPaid = (o) => o.payments.reduce((s, p) => s + p.amount, 0);

/** What the customer still owes. Pay-later orders owe their total until collected. */
export const balanceDue = (o) => (o.status === 'void' ? 0 : Math.max(0, o.total - amountPaid(o)));

export const unpaidOrders = (orders) => orders.filter((o) => balanceDue(o) > 0);

// A pay-later order can be collected in a later shift; the money lands in that shift's drawer.
const payShiftId = (o, p) => p.shiftId || o.shiftId;

/**
 * Sales of a shift and where the money is. Holds by construction:
 * net = cashOnHand + expenses + gcash + maya + card − collectedEarlier + uncollected
 */
export function shiftSummary(shift, allOrders, allExpenses = []) {
  const valid = validOrders(allOrders);
  const orders = valid.filter((o) => o.shiftId === shift.id);
  const byMethod = { cash: 0, gcash: 0, maya: 0, card: 0 };
  let collectedOwn = 0; // paid in this shift for this shift's orders
  let collectedEarlier = 0; // paid in this shift for orders from earlier shifts
  valid.forEach((o) => o.payments.forEach((p) => {
    if (payShiftId(o, p) !== shift.id) return;
    byMethod[p.method] = (byMethod[p.method] || 0) + p.amount;
    if (o.shiftId === shift.id) collectedOwn += p.amount; else collectedEarlier += p.amount;
  }));
  const gross = orders.reduce((s, o) => s + o.subtotal, 0);
  const net = orders.reduce((s, o) => s + o.total, 0);
  const cost = orders.reduce((s, o) => s + o.items.reduce((a, i) => a + i.unitCost * i.qty, 0), 0);
  const shiftExpenses = allExpenses.filter((e) => e.shiftId === shift.id);
  const expenses = shiftExpenses.reduce((s, e) => s + e.amount, 0);
  const unpaid = orders.filter((o) => balanceDue(o) > 0);
  return {
    count: orders.length,
    gross,
    discounts: gross - net,
    net,
    vat: orders.reduce((s, o) => s + o.vatAmount, 0),
    cost,
    byMethod,
    expenses,
    expenseCount: shiftExpenses.length,
    cashOnHand: byMethod.cash - expenses, // sales cash left in the drawer, not counting starting cash
    collectedEarlier,
    uncollected: net - collectedOwn, // still unpaid, or collected in a later shift
    unpaidCount: unpaid.length,
    unpaidTotal: unpaid.reduce((s, o) => s + balanceDue(o), 0),
    expectedCash: shift.startingCash + byMethod.cash - expenses,
  };
}

export function orderCost(o) { return o.items.reduce((a, i) => a + i.unitCost * i.qty, 0); }
