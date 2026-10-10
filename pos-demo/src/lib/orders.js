import { store } from './store.js';

const ORDER = ['pending', 'preparing', 'ready', 'served'];

/** Status only moves forward (pending → preparing → ready → served). */
export function setStatus(orderId, status) {
  store.update((d) => {
    const o = d.orders.find((x) => x.id === orderId);
    if (!o || o.status === 'void') return;
    if (ORDER.indexOf(status) <= ORDER.indexOf(o.status)) return;
    o.status = status;
    if (status === 'served') {
      o.servedAt = new Date().toISOString();
      o.items.forEach((i) => { i.served = true; });
    }
  });
}

export function toggleItemServed(orderId, key) {
  store.update((d) => {
    const o = d.orders.find((x) => x.id === orderId);
    if (!o) return;
    const it = o.items.find((i) => i.key === key);
    it.served = !it.served;
    if (o.items.every((i) => i.served) && o.status !== 'served') {
      o.status = 'served';
      o.servedAt = new Date().toISOString();
    } else if (o.status === 'pending' && it.served) {
      o.status = 'preparing';
    }
  });
}

export const nextStatus = (s) => ORDER[ORDER.indexOf(s) + 1];
export const NEXT_LABEL = { pending: 'Start preparing', preparing: 'Mark ready', ready: 'Mark served' };
export const LATE_MINUTES = 15;
/** Remind the cashier to collect once a pay-later order has been served this long. */
export const PAY_REMINDER_MINUTES = 10;
