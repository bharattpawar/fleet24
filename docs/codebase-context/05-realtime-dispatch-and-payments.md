# Realtime, dispatch and payments

## Event contract

`backend/src/tracking/tracking.gateway.ts` serves /tracking and validates socket authentication. Connections can join rider and outlet rooms. `handleSubscribe` and `handleSubscribeOutlet` check order/outlet scope before joining. Client subscription messages are subscribe:delivery and unsubscribe:delivery with orderId, and subscribe:outlet and unsubscribe:outlet with outletId. Acknowledgments are delivery.subscribed, delivery.unsubscribed, outlet.subscribed and outlet.unsubscribed. See `tracking.constants.ts` for the payload fields and `TrackingPublisherService` for broadcast calls.

| Server event | Producer and payload | Consumer |
| --- | --- | --- |
| order.created | Payments finalization. Order/outlet IDs, number, placement time, amount, item count and optional lines | RestaurantOrdersScreen |
| delivery.offer.created | RiderAssignmentService. Order, delivery and rider IDs, distance and offer expiration | Rider client private room |
| delivery.rider.assigned | Assignment service. Order/delivery IDs, rider summary and assignment timestamp | DeliveryTrackingScreen |
| delivery.location.updated | RidersService. Order/delivery IDs, coordinates, timing and optional telemetry | DeliveryTrackingScreen |
| delivery.status.updated | RiderOffersService. Order/delivery IDs, delivery and order statuses, timestamp and optional message | Customer tracking and restaurant refresh listener |
| delivery.completed | RiderOffersService. Order/delivery IDs, completion time and message | DeliveryTrackingScreen |
| delivery.cancelled | Customer/admin cancellation paths. Order ID, optional delivery ID/reason and timestamp | DeliveryTrackingScreen |
| delivery.error | TrackingGateway. Code, message and optional order ID | DeliveryTrackingScreen |

## Dispatch and location

`RiderAssignmentService.findBestCandidateRider` checks rider verification, availability, existing load and location freshness, then ranks by distance. Production location age limit is 300 seconds. Offer expiry is 60 seconds in production and 300 outside production. `assignOrder` uses transaction row locks on order/delivery and the one-delivery-per-order unique index. Assignment attempts record the offer history. `RiderOffersService.claimDelivery` and `acceptOffer` use transaction locks and recheck eligibility/state under contention. Distinguish the private offer path from the available pool when investigating duplicate claims.

`OfferExpirationWorker.handleCron` runs every ten seconds. `processExpiredOffers` uses FOR UPDATE SKIP LOCKED on up to 20 expired assigned rows and resets assignment before retrying outside the transaction. `processUnassignedDeliveries` reads up to ten cooled-down unassigned rows for confirmed, preparing or ready orders and delegates to `assignOrder`. The worker's local running flag covers overlapping ticks inside one process.

`rider-app/src/services/locationService.ts` configures native foreground updates at 5 seconds/5 meters during delivery and 10 seconds/15 meters otherwise. It configures native background updates at 5 seconds/5 meters during delivery and 12 seconds/15 meters otherwise. `backgroundLocationTask.ts` handles background callbacks. OS permission and scheduling determine actual cadence. Browser geolocation is a separate path. `RidersService.updateLocation` rejects samples older than ten minutes or over one minute in the future when capture time is provided. Source inspection confirms a native task path, with physical-device operation unverified.

## Money and retry boundaries

- `PaymentsService.createPaymentSession` prepares Razorpay checkout. `verifyPayment` and `handleWebhook` validate signatures and use transactional state changes before publishing placement. Raw webhook bodies come from `main.ts`. Payment and fulfillment have separate states.
- `PaymentsService.initiateOrderRefund` locks the payment row to reserve the refund before calling the provider. `RefundReconciliationService.claimEligibleRefunds` claims with SKIP LOCKED and a lease. The default batch is 20 with a 90-second lease. Reconciliation caps automatic attempts at five and can escalate to manual review. `RefundReconciliationWorker` runs every two minutes.
- `RiderOffersService.completeDelivery` locks delivery/order rows, checks the OTP attempt budget and applies completion. Earnings/ledger writes use per-delivery/idempotency protections in the finance schema and services. `AdminFinanceService` owns payout and restaurant settlement generation, approval and processing.
- `FinancialSettingsService` owns versioned fee and payout calculations and monthly restaurant credit blocks. `consumeRestaurantDeliveryCredit` locks the credit block during consumption. `FinancialSettingsScheduledWorker` promotes due settings every minute. Read the active settings and stored order/earning amounts when reconciling historical values.

## Assignment and concurrency
`RiderAssignmentService.findBestCandidateRider` (`backend/src/riders/rider-assignment.service.ts:104–268`) joins the latest GPS fix, requires approved/available/non-suspended riders, prefilters with latitude/longitude bounds, excludes riders with rejected/expired attempts in production, then checks GPS freshness (300 seconds in production), committed load (active counter plus unexpired assigned offers), and 3 km Haversine pickup radius. It ranks by distance then active load with deterministic tie-breaking. Nonproduction widens the box to 50 degrees, accepts GPS up to 24 hours old and skips the strict 3 km and prior-attempt exclusion.

`assignOrder` (277–550) locks order then existing delivery FOR UPDATE, checks assignment eligibility/current delivery state, and creates or updates one delivery as an expiring offer. A no-candidate result can leave an unassigned delivery for retry. It records pickup distance in the attempt and outlet-to-customer trip distance on delivery. Push/live notification starts from the assignment path. The order lock prevents competing assignments for one order. Candidate capacity comes from reads, so two different order locks can both see the last slot; a pending offer count is not an atomic reservation.

`RiderOffersService.claimDelivery`, `acceptOffer`, and `rejectOffer` (`backend/src/riders/rider-offers.service.ts:320,567,698`) have separate transactions. Claim uses the available pool; accept consumes the selected rider's offer and updates active load; reject writes attempt state and triggers assignment outside its transaction (762–764). `OfferExpirationWorker` (`backend/src/riders/offer-expiration.worker.ts:27–169`) runs every ten seconds, expires offers and retries eligible unassigned work. Admin retry and assign also call the same selector (`backend/src/admin/admin-operations.service.ts:910`, `backend/src/riders/admin-riders.controller.ts:96–100`). Completion transaction updates delivery/order and credits earnings (offers service:1141–1306). See [proposed reservation design](07-new-business-requirements-gap-analysis.md).

## Geographic decision points
| Path | Measurement |
|---|---|
| Coordinate parsing and radius | `backend/src/common/utils/geo.ts:39–164`: numeric and range validation, great-circle Haversine, configured outlet radius and fixed pickup threshold. |
| Public discovery | `backend/src/restaurants/menus.service.ts:348–369`: outlet radius eligibility and distance display when coordinates are supplied. Customer Home composes this outlet set. |
| Checkout | `backend/src/orders/orders.service.ts:136–144`: authoritative outlet/address radius check. |
| Assignment | `backend/src/riders/rider-assignment.service.ts:114–231,424–450`: rectangular degree prefilter, exact Haversine rider-to-outlet eligibility, separate Haversine delivery leg. |
| Available pool / claim | `backend/src/riders/rider-offers.service.ts:248–267,375–417,513–534`: delivery-leg Haversine or persisted meters and presentation/fallback logic; the pool and claim paths substitute 1,800 m for very short results. Do not reuse fallback values as serviceability proof. |
| Device movement | `rider-app/src/services/locationService.ts:694+`: local Haversine movement calculation, separate from backend service area enforcement. |

None of these checks measures a route along roads. Map directions and GPS display are distinct from an authoritative server eligibility calculation.

## Payment and finance boundaries
- `PaymentsService.createPaymentSession` (`backend/src/payments/payments.service.ts:177–290`) validates ownership, reuses provider checkout where applicable, and persists payment attempt metadata. `verifyPayment` (291–503) checks callback and provider state; authorization/signature alone does not prove capture. Capture transaction at 385 writes payment and places the order, with post-commit notification at 486.
- `handleWebhook` (504–731) authenticates the raw payload, uses event identity for deduplication and reconciles provider payment/refund events. Compare both capture entry paths when changing replay handling; event-ID dedupe and order placement guards solve different races.
- `initiateOrderRefund` (804–1030+) reserves an idempotent refund operation inside the short transaction at 812, calls Razorpay outside it with X-Refund-Idempotency at 1003, and records outcome afterward. `RefundReconciliationService.claimEligibleRefunds` (`backend/src/payments/refund-reconciliation.service.ts:52–55,166,245`) leases eligible records and reconciles provider outcomes; the cron runs every two minutes. Inspect manual review flags and provider references on the refund row, not merely order status.
- Delivery OTP completion calls the earnings engine with persisted delivery distance (`backend/src/riders/rider-offers.service.ts:1141–1306`). Settlement/payout and ledger schemas are covered in [database](02-backend-and-database.md); a workflow status or reference alone does not establish bank confirmation.
