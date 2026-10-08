# Cafe Adullam x Amoa POS — Demo

A clickable front-end demo of the café POS. There is no backend: example data is generated in the browser and saved in `localStorage`, so it's safe to click anything.

## Run it

```bash
npm install
npm run dev
```

Open the link Vite prints. Open the cashier tablet and the kitchen screen in two tabs to see orders move between them live.

## What's in the demo

- **Cashier tablet** (`#pos`): light and dark themes, face-scan time-in (simulated), live shift sales in the top bar, three tabs (Menu, Orders, My shift), menu search with Drinks/Meals/Snacks filters, order entry, add-ons and notes, Senior/PWD 20% with VAT exemption, custom discounts, auto-applied promos, one-use vouchers, cash/GCash/Maya/card and split payments, order slip, open shift, and close shift on the My shift screen with a cash count by total or by bills.
- **Kitchen screen** (`#kitchen`): New / Preparing / Ready columns, item-by-item served ticks, orders over 15 minutes turn red.
- **Owner dashboard** (`#admin`): sales and profit reports, shifts with cash count history, products with unit cost and margin, promos and vouchers, staff and attendance, expenses, payroll per cut-off.
- **Demo bar**: "Simulate no internet" shows offline-first behavior; "Reset demo" regenerates the example data.

## Build

- `npm run build` — normal static build in `dist/`.
- `npm run build:artifact` — one HTML page in `dist-artifact/` that loads React from a CDN (used for the hosted demo link).

## Notes for the real build

The demo keeps these parts close to the real design in `CLAUDE.md`:

- `src/lib/pricing.js` — pure pricing rules (VAT, Senior/PWD, promos, discounts, vouchers). Reuse as-is.
- `src/lib/money.js` — amounts in centavos.
- `src/lib/store.js` — **demo only**. Replace with Dexie + Supabase sync.
- Face recognition is simulated. The real build uses `@vladmandic/human`.
