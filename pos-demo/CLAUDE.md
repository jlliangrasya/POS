# Café POS — Build Brief

Multi-company, offline-first POS and back-office system for Philippine cafés and restaurants, sold as a subscription. One codebase and one Supabase project serve every client company. Every row belongs to a `company_id`, and row-level security keeps companies fully separated.

## Stack

- React (JavaScript, no TypeScript) with Vite
- Supabase: Postgres, Auth, Realtime, RLS
- Dexie (IndexedDB) + `dexie-react-hooks` for the local database
- vite-plugin-pwa for install and offline app shell
- TanStack Query only for online-only admin data (reports); POS screens read from Dexie
- Tailwind CSS
- `@vladmandic/human` for in-browser face recognition and blink check
- Use JSDoc on shared data shapes and pure functions in place of types

## Core principles

1. **Offline-first.** POS, kitchen, shift, and attendance screens read and write Dexie only. They never wait on the network.
2. **Sync is separate from the UI.** A sync worker pushes the local outbox to Supabase and pulls server changes into Dexie. Realtime only speeds up pulls.
3. **Tenant isolation.** Every table carries `company_id`. Branch-level tables also carry `branch_id`. Never query without them.
4. **Money in centavos.** Store all amounts as integers (₱125.50 = 12550). Format only at display.
5. **Pricing logic is pure.** Totals, VAT, discounts, and promos live in `src/lib/pricing/` as pure functions with tests. No React or Supabase imports there.

## Tenancy model

```
company (client business, subscription)
 └─ branch (one café location)
     ├─ devices (POS tablet, kitchen tablet)
     ├─ staff (cashiers, kitchen, servers; face code + PIN)
     └─ shifts, orders, attendance, expenses
```

Roles:

| Role | Who | How they sign in | Access |
| --- | --- | --- | --- |
| `super_admin` | Platform owner (Jill) | Email + password | Create companies, manage plans and status |
| `owner` / `admin` | Café owner or manager | Email + password | Everything in their company |
| `device` | A registered tablet | Signed in once by an admin, session stays | Its own branch only, POS/kitchen tables only |
| Staff (`cashier`, `kitchen`, `server`) | Employees | Face scan on a device identifies them (PIN fallback) | Acts through the device session; actions are tagged with `staff_id` |

Staff are not Supabase Auth users. The tablet holds one `device` session; staff login switches the active `staff_id` locally and is recorded on every row they create.

## Database schema (Supabase)

Every table has: `id uuid primary key` (generated on the client with `crypto.randomUUID()` for anything created offline), `company_id uuid not null`, `created_at`, `updated_at` (client time), `server_updated_at` (set by trigger, used as the pull cursor), `deleted_at` (soft delete; never hard-delete synced rows).

**Tenancy and access**

- `companies`: name, plan (`essential` | `business`), status (`active` | `suspended`), vat_registered bool
- `branches`: company_id, name, address, order_prefix
- `profiles`: id = auth.users.id, company_id, branch_id (null for owners), role
- `devices`: company_id, branch_id, auth_user_id, name, type (`pos` | `kitchen`), code (e.g., `A`, used in order numbers)

**People and time**

- `staff`: branch_id, name, position, role, pin_hash, face_descriptor `float4[]`, face_model_version, pay_type (`hourly` | `daily` | `monthly`), rate, active
- `shift_templates`: branch_id, name, start_time, end_time (defaults: 07:00–16:00, 16:00–00:00)
- `shifts`: branch_id, template_id, device_id, opened_by, opened_at, closed_at, closed_by, starting_cash, counted_cash, expected_cash (starting cash + cash received − drawer expenses), over_short, expenses_total, status (`open` | `closed`)
- `attendance`: branch_id, staff_id, shift_id, time_in, time_out, method (`face` | `pin`), flagged bool, late_minutes

**Catalog**

- `categories`: name, sort_order
- `products`: category_id, name, price, unit_cost, vat_type (`vatable` | `exempt` | `zero_rated`), available, sort_order
- `addons`: product_id (nullable = global), name, price, unit_cost

**Orders**

- `orders`: branch_id, shift_id, device_id, order_no (`{device.code}-{seq per shift}`, e.g., `A-012`), customer_name, order_type (`dine_in` | `take_out`), table_no, status (`pending` | `preparing` | `ready` | `served` | `void`), subtotal, discount_total, vat_amount, total, pay_later bool, paid_at, created_by (staff_id), served_at. Balance due = total − sum of payments; a pay-later order has no payments until collected
- `order_items`: order_id, product_id, name and unit_price and unit_cost (snapshots at time of sale), qty, addons jsonb, notes, served bool
- `payments`: order_id, shift_id (the shift that took the money; may differ from the order's shift for pay-later), taken_by (staff_id), method (`cash` | `gcash` | `maya` | `card`), amount, reference_no, change_given
- `order_discounts`: order_id, source (`senior` | `pwd` | `custom` | `promo` | `voucher`), source_id, amount, id_number, holder_name

**Promos and vouchers**

- `discount_types`: name (e.g., Employee), value_type (`percent` | `fixed`), value, max_per_order
- `promos`: name, type (`percent_off` | `fixed_off` | `buy_x_get_y` | `bundle_price` | `min_spend`), rules jsonb, starts_at, ends_at, days_of_week int[], start_time, end_time, active
- `vouchers`: code (unique per company), value_type, value, expires_at, created_by, redeemed_at, redeemed_order_id

**Back office (Business plan)**

- `expenses`: branch_id, shift_id (set when a cashier pays it from the cash drawer during a shift; null for owner-paid), category, amount, expense_date, notes, created_by
- `payroll_runs`: branch_id, period_start, period_end, status (`draft` | `final`)
- `payroll_items`: run_id, staff_id, hours, days, late_minutes, overtime_hours, gross, deductions jsonb, net

## Row-level security

Helper functions (`security definer`, `stable`, `set search_path = public`):

- `auth_company_id()`: company of the current user from `profiles`
- `auth_role()`: role of the current user
- `auth_branch_id()`: branch of the current user (devices and branch-bound admins)

Policy pattern for every tenant table:

```sql
using (company_id = auth_company_id())
with check (company_id = auth_company_id())
```

Extra rules:

- `device` role: only rows where `branch_id = auth_branch_id()`; insert/update only on `orders`, `order_items`, `payments`, `order_discounts`, `shifts`, `attendance`, `vouchers`; read-only on catalog, promos, staff. May insert, read, and delete `expenses` only where `shift_id` is an open shift of its branch.
- `device` role cannot read `unit_cost`, profit, payroll, or expenses outside its open shift. Expose catalog to devices through a view without cost columns.
- Only `owner`/`admin` can write catalog, promos, discount types, staff, expenses, payroll.
- `super_admin` bypasses company filter for `companies` only.
- Suspended companies: policies also check `companies.status = 'active'`.
- Realtime respects RLS, so subscriptions are tenant-safe by default; still filter by `branch_id`.

Triggers:

- `set_server_updated_at` on every table.
- `orders_status_forward_only`: reject a status that moves backward (pending → preparing → ready → served). `void` allowed only from an admin.

## Local database (Dexie)

Mirror the tables a device needs, scoped to its branch: catalog, promos, discount types, staff (including face descriptors), shift templates, open and recent shifts, orders and children from the last 2 shifts, attendance for today, vouchers.

Extra local tables:

- `outbox`: id, table, op (`upsert`), row, created_at, attempts, last_error
- `sync_state`: table, last_pulled_at (server_updated_at cursor)
- `session`: device info, active staff_id, active shift_id

## Sync rules

- **Write path:** UI writes to Dexie and adds an `outbox` entry in the same Dexie transaction.
- **Push:** a worker sends the outbox in order as upserts, on an interval and on `online` events. Retry with backoff. Remove an entry only after Supabase confirms.
- **Pull:** per table, fetch rows with `server_updated_at > last_pulled_at` for this branch, `put` into Dexie, advance the cursor.
- **Realtime:** subscribe to `postgres_changes` on `orders` and `order_items` filtered by `branch_id`; write payloads into Dexie. The kitchen screen depends on this.
- **Conflicts:** last write wins by `updated_at`, except order status, which keeps the most advanced value.
- **Offline UI:** show a clear banner on POS and kitchen when offline: "Offline — kitchen is not receiving new orders."
- **Vouchers:** redeeming a voucher requires a connection (check and mark redeemed server-side). Offline, the button is disabled with a message. This prevents double use across devices.

## Shift cash and pay-later

- **Pay later:** at payment the cashier can pick "Pay after eating". The order goes to the kitchen with no payments and needs a customer name or table. It stays on the POS Unpaid tab (across shifts) until collected; once served for `PAY_REMINDER_MINUTES` it moves to "collect now" and the cashier gets a reminder.
- **Shift expenses:** cash a cashier takes from the drawer during a shift (ice, LPG) is an `expenses` row with `shift_id`. It lowers expected cash and counts in the owner's expenses.
- **Shift reconciliation:** total sales = cash on hand (drawer less starting cash) + GCash + Maya + card + drawer expenses + not yet paid − collected for earlier shifts. `shiftSummary` in `src/lib/reports.js` computes each part.

## Face time-in

- Library: `@vladmandic/human`. Record `face_model_version` with every descriptor; a model change requires re-enrollment.
- **Enroll** (admin, online): capture 3 to 5 frames, compute descriptors, store their average in `staff.face_descriptor`. Never store images.
- **Identify, don't select** (device, works offline): the login screen has one "Time in / Log in" button. No name tapping. The camera runs the blink check, then compares the live descriptor against every active staff descriptor cached for the branch (1:N match).
- **Match rule:** accept the best match only if (a) its similarity is above the threshold and (b) it beats the second-best match by a clear margin. Both values are configurable per company; tune on-site.
- **Confirmation screen:** show "Hi {name}! Timed in at {time}" with a "Not me" button. "Not me" cancels the record and opens the PIN fallback.
- **After identification:** the first login of the day creates `attendance.time_in`. Cashiers then stay logged in to the POS. Kitchen staff and servers see the confirmation and the screen returns to the login screen.
- **Time-out:** cashiers time out when they close the shift with a cash count. Other staff use a "Time out" button with the same face scan.
- **PIN fallback:** used when no confident match is found or after "Not me". Staff picks their name and enters a PIN. Sets `attendance.method = 'pin'` and `flagged = true`, shown on the admin attendance report.
- Face descriptors are cached on registered devices only, for offline login. Clear the Dexie cache if a device is unregistered.
- Ask staff consent at enrollment (checkbox + timestamp stored on `staff`).

## Pricing rules (`src/lib/pricing/`)

- VAT 12%. Prices are VAT-inclusive when `companies.vat_registered`.
- **Senior/PWD (20%):** for vatable items on a VAT-registered company, remove VAT first (`price / 1.12`), then apply 20% off; the line becomes VAT-exempt. For non-VAT companies, apply 20% off the price. Apply only to items marked for the senior/PWD, and record ID number and name.
- Order of application: item promos → order promos → custom discount / senior-PWD → voucher.
- Only one of senior/PWD or promo applies to the same item; pick the bigger discount for the customer.
- `computeOrderTotals(order, catalog, context)` returns subtotal, discount lines, vat_amount, total. Write unit tests for every rule above.

## Folder structure

```
src/
  lib/
    supabase.js
    db.js                # Dexie schema
    sync/                # outbox.js, push.js, pull.js, realtime.js
    pricing/             # pure functions + tests
    face/                # human config, enroll.js, verify.js
    money.js             # centavo helpers, peso formatting
  features/
    auth/                # admin login, device registration
    staff-login/         # face scan identifies staff, time in/out
    pos/                 # order entry, checkout, payments
    kitchen/             # order queue, status updates
    shifts/              # open, close, cash count
    attendance/
    catalog/             # products, categories, addons
    promos/              # promos, discount types, vouchers
    expenses/
    payroll/
    reports/
    platform/            # super_admin: companies
  components/            # shared UI
  routes.jsx
supabase/
  migrations/
```

## Build order

1. Schema, RLS, triggers; super_admin creates a company, branch, and owner
2. Admin login, device registration, Dexie schema, sync worker
3. Catalog management, then POS order entry and checkout
4. Shifts (open, close, cash count, over/short) and order numbering
5. Staff enrollment, face login, attendance
6. Kitchen screen with realtime and order status
7. Discounts, senior/PWD, promos, vouchers
8. Reports (shift, daily, payment mode, best sellers)
9. Expenses, payroll, profit view, Excel/PDF export (Business plan; gate by `companies.plan`)

## Not in scope for now

- Storing photos (products, receipts, faces)
- BIR-registered official receipts; the system prints order slips only
- Inventory by ingredient, online ordering, loyalty points
- Local network hub for kitchen sync during internet outages
