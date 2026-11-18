# Backend and database

`backend/src/main.ts#bootstrap` enables raw HTTP bodies, the /api/v1 prefix, global validation with unknown-property rejection, CORS, response transformation and exception filtering. `AppModule` registers configuration, scheduling and the following modules.

| Area under backend/src | Code and responsibility |
| --- | --- |
| auth | `AuthController` exposes OTP, Google, refresh, logout and me. `AuthService` manages hashed OTPs and session lifecycle. `JwtAuthGuard` and `RolesGuard` handle identity and role metadata. |
| users | `UsersController` and `UsersService` handle customer address listing/creation and profile updates. |
| restaurants | `RestaurantsController`, `RestaurantProfileController`, `RestaurantsService`, `MenusService` and `OutletAuthService` cover discovery, menus, outlet operations, staff profile and restaurant finance. |
| orders | `CartController` and `CartService` manage the cart. `OrdersController` and `OrdersService` handle checkout and customer history/cancellation. `RestaurantOrdersController` and `RestaurantOrdersService` serve kitchen operations. |
| payments | `PaymentsController`, `PaymentsService` and `RefundReconciliationService` handle checkout, provider verification, webhooks, refunds and recovery. |
| riders | `RidersController`, `AdminRidersController`, `RidersService`, `RiderAssignmentService`, `RiderOffersService` and `NotificationService` cover rider profile, approval, availability, GPS, dispatch, delivery and push. |
| tracking | `TrackingGateway` authenticates socket connections and checks room subscriptions. `TrackingPublisherService` is the application-facing emitter. |
| admin | Dashboard analytics, management, operations, finance and versioned financial settings each have controllers/services in this directory. |
| database, health | `DatabaseService` handles connection probes and pool shutdown. `HealthController` exposes health, liveness and readiness. |

## Logical storage model

All schema names below refer to files under `backend/src/database/schema/`. PostgreSQL persists app state through Drizzle. The schema and migration journal are distinct inputs to deployment.

| Schema | Relationships and ownership |
| --- | --- |
| users.ts, auth.ts | Users have role rows, customer addresses, sessions and outlet staff assignments. OTP challenges track verification separately. Users are identified by unique phone/email/Google ID where populated. Staff membership has a user/outlet uniqueness constraint. |
| restaurants.ts, menus.ts | Restaurants own outlets. Outlets carry location and operating settings. Categories and items belong to the restaurant menu, with outlet overrides providing outlet-specific pricing/availability. |
| cart.ts, orders.ts | Cart items refer to menu items. Orders belong to a customer and outlet, with item snapshots and status history. Checkout persists amounts and item snapshots for future reads. |
| payments.ts | Payment and refund rows link to orders and track provider references, status and idempotency/reconciliation metadata. |
| deliveries.ts | Rider profile is unique per user. Latest location is unique per rider. Delivery is unique per order. Assignment attempts track offers and responses. Coordinate precision is numeric(10,7). |
| finance.ts, financial-settings.ts | Financial ledger has a unique idempotency key and indexes by entity and order. Ledger amounts are numeric(12,2). Earnings, payouts, settlements and financial settings track separate lifecycles. Credit blocks are unique per restaurant and month. |
| promotions.ts, audit.ts | Promotion schema and operational audit storage. Audit indexes cover entity and creation time. A schema declaration alone does not establish a connected workflow. |

## Business rules

- **Confirmed** — `RestaurantsService.updateOrderAcceptance` controls order intake separately from outlet activation. `OrdersService.checkout` checks outlet and address conditions and `RestaurantOrdersService.updateOrderStatus` applies kitchen transition rules. `OutletAuthService` and `RestaurantOrdersService.getAuthorizedOutletIds` resolve scope independently of the app's selected outlet.
- **Confirmed** — `CartService.addItem` enforces one outlet. Checkout revalidates, calculates item total, delivery fee, tax and discount, locks the cart row in its transaction and writes order, item snapshots and pending payment. The checkout key supports replay lookup.
- **Confirmed** — `MenusService.setOutletMenuItemOverride` handles outlet-specific overrides. `getPublicActiveOutlets` serves discovery with coordinate-aware filtering. Image URL fields and URL controls are present.
- **Partially implemented** — settlement and payout state, provider references and reconciliation exist in `AdminFinanceService`. Its provider generates sandbox transfer IDs.
- **Not found in inspected paths** — an image upload endpoint or an operational customer modifier picker wired through cart and checkout. See `MenusService`, `MenuManagementTab`, `RestaurantMenuScreen`, `RestaurantDetailScreen` and order DTOs.

## Constraints and transaction boundaries
| Table | Source and constraints |
|---|---|
| orders, order_items, order_status_history | `backend/src/database/schema/orders.ts:19–96`. Order references customer/user and outlet with RESTRICT, unique order number and idempotency key. Items and history cascade with order; item menu reference and history actor are SET NULL. |
| riders, rider_locations | `backend/src/database/schema/deliveries.ts:24–74`. Unique user per rider and unique latest location per rider, both parent links cascade. Approver is SET NULL. |
| deliveries, delivery_assignment_attempts | `backend/src/database/schema/deliveries.ts:82–146`. Unique order per delivery, order RESTRICT, rider SET NULL. Attempts cascade with order/delivery/rider and have composite order/rider/offered-time uniqueness. Delivery uniqueness permits many orders for one rider and cannot enforce aggregate capacity. |
| payments, payment_webhook_events, refunds | `backend/src/database/schema/payments.ts:18–92`. Payment references order with RESTRICT and unique idempotency key; order ID is not unique. Webhook event ID is unique. Refund references payment with RESTRICT; refund idempotency and operation keys are unique, actor SET NULL. |
| financial_ledger, rider_payouts, restaurant_settlements | `backend/src/database/schema/finance.ts:29–119`. Each has unique idempotency key. Ledger order is nullable/SET NULL. Payout and settlement reference rider and restaurant respectively with RESTRICT. Actor links use SET NULL. |

Checkout creates order, line snapshots and history inside the transaction in `backend/src/orders/orders.service.ts:174`. Restaurant transition locks and writes history inside `backend/src/orders/restaurant-orders.service.ts:239–339`; provider refund and dispatch run separately. Capture, refund reservation and completion boundaries are detailed in [dispatch and payments](05-realtime-dispatch-and-payments.md).

## Migration 0015 discrepancy
`backend/drizzle/0015_safe_delivery_otp_encryption.sql:1` adds nullable encrypted_delivery_otp to deliveries with IF NOT EXISTS and depends on deliveries already existing. `backend/drizzle/meta/_journal.json` jumps from tag 0014 to 0016 (journal idx 15 is 0016). A journal-driven replay skips the loose 0015 SQL file. The schema still has the column at `backend/src/database/schema/deliveries.ts:98`, but the delivery OTP has been removed: nothing writes or reads the OTP columns any more (`delivery_otp_hash`, `encrypted_delivery_otp`, `otp_expires_at`, `otp_attempts_count`, `otp_verified_at`). A fresh journal-only database can therefore diverge from source. A manually patched database may already have it. Verify physical column and migration metadata read-only before designing a forward repair. Do not infer applied state from the filename or backfill the journal blindly.

Git history attributes the standalone 0015 SQL addition to commit 2366884. That commit did not update the journal, so the omission predates the current 0016 entry.
