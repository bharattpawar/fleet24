# End-to-end flows

## A. Authentication

The mobile login screens call `AuthController.requestOtp` and `verifyOtp`. `AuthService.requestOtp` normalizes the phone and persists a hashed challenge through the auth schema and SMS abstraction. `verifyOtp` checks the challenge and creates or resolves the user and roles, then `createSession` persists a hashed refresh secret and issues an access JWT. The client stores the result and resolves profile/roles from /auth/me. The development bypass is a comparison branch in `verifyOtp`, gated by NODE_ENV differing from production and matching one of two hardcoded development inputs. Inspect the surrounding challenge checks there. `AuthService.refreshTokens` validates the compound session token and rotates the session. `logout` revokes the session. App-specific refresh behavior is in [frontend apps](03-frontend-apps.md).

## B. Discovery

`customer-app/src/screens/HomeScreen.tsx` and `AddressSelectionModal` supply the browsing location. `MenusService.getPublicActiveOutlets` reads outlets and applies geographic filtering when coordinates are supplied. `RestaurantDetailScreen` reads menu data and renders availability with `MenuItemCard`. Checkout performs its own address/outlet validation. Relevant server files are `backend/src/restaurants/restaurants.controller.ts`, `menus.service.ts` and `backend/src/orders/orders.service.ts`.

## C. Checkout and payment

`CartScreen` submits the address and checkout request, then requests a payment session. `OrdersService.checkout` snapshots priced lines and creates a pending-payment order. `PaymentsService.createPaymentSession` creates or reuses the provider session. The browser opens the hosted Razorpay checkout and returns to the app, which can submit verification. `PaymentsService.verifyPayment` and `handleWebhook` can finalize capture and placement. The kitchen notification follows payment finalization.

## D. Kitchen

`RestaurantOrdersScreen` loads the outlet queue over REST and uses `order.created` to refresh it. `RestaurantOrdersController.updateStatus` delegates to `RestaurantOrdersService.updateOrderStatus`, which checks outlet permission, validates the transition, writes status and records history. The happy path is placed → confirmed → preparing → ready for pickup. Rejection has cancellation/refund side effects. Both confirmation and ready-for-pickup can trigger assignment.

## E. Dispatch

`RiderAssignmentService.assignOrder` locks the order and delivery, calls candidate selection and persists the offer and attempt. After assignment, the private rider event and push can prompt `RiderHomeScreen` to refresh. The rider can accept an offer or claim a delivery from the available pool through `RidersController` and `RiderOffersService`. The API also runs `OfferExpirationWorker` for expiry and unassigned retries.

## F. Tracking

`rider-app/src/services/locationService.ts` and `backgroundLocationTask.ts` submit coordinates through the rider API. `RidersService.updateLocation` validates capture timing, persists latest coordinates and publishes for applicable deliveries. `TrackingGateway.handleSubscribe` authorizes access to the order room. `DeliveryTrackingScreen` starts from the REST snapshot and listens for location and lifecycle changes.

## G. Completion

`RiderOffersService.confirmArrival`, `confirmPickup`, `confirmArrivedCustomer` and `completeDelivery` enforce ownership and progression. Completion checks the delivery OTP, updates delivery/order state and records earnings/finance. Customer tracking receives the completion event. Follow `backend/src/riders/rider-offers.service.ts` and `backend/src/admin/admin-finance.service.ts#recordDeliveryEarning` together when changing completion.

## H. Recovery

Restaurant reconnect resubscribes and refreshes orders. Tracking reconnect rebuilds the order subscription and refreshes state. Offer availability can be read over REST independently of push/socket delivery. Checkout, payment callbacks, claim and completion each have distinct replay/concurrency behavior. Refund reconciliation and offer expiration are durable-state recovery paths driven by periodic jobs. See [realtime, dispatch and payments](05-realtime-dispatch-and-payments.md).

## Source checkpoints across workflows
1. **Discovery → checkout.** `customer-app/src/screens/HomeScreen.tsx` loads public customer-home/outlets; `RestaurantDetailScreen.tsx` loads outlet menu and writes through CartContext; `CartScreen.tsx` submits checkout. `OrdersService.checkout` in `backend/src/orders/orders.service.ts:49–174+` validates the outlet/address and snapshots the purchase transactionally. Order creation and payment capture are separate checkpoints.
2. **Payment → kitchen.** `PaymentsService.createPaymentSession` and `verifyPayment` in `backend/src/payments/payments.service.ts:177,291` precede capture/placement. The post-commit notification at line 486 is the kitchen `order.created` boundary. `restaurant-app/src/screens/RestaurantOrdersScreen.tsx` consumes the kitchen queue and live updates; `RestaurantOrdersService` updates order and history and invokes assignment after transition (`backend/src/orders/restaurant-orders.service.ts:239–364`).
3. **Kitchen → rider → customer.** Assignment creates/updates a delivery and writes the attempt (`backend/src/riders/rider-assignment.service.ts:277–550`). `backend/src/riders/riders.controller.ts:159–268` exposes offer and completion routes. `RiderOffersService` claims/accepts/rejects, advances pickup and completes with OTP; customer `DeliveryTrackingScreen.tsx` consumes current delivery and rider location. See [dispatch](05-realtime-dispatch-and-payments.md) for transaction and retry details.
4. **Cancellation → refund → reconciliation.** Customer cancellation (`backend/src/orders/orders.service.ts:437+`) and kitchen rejection (`backend/src/orders/restaurant-orders.service.ts:339+`) lead into `PaymentsService.initiateOrderRefund`. Admin transactions view uses payment and refund IDs; ledger links rely on recorded references. See [admin coverage](03-frontend-apps.md) and [payment trace](05-realtime-dispatch-and-payments.md).

Socket event names are defined in backend/src/tracking/tracking.constants.ts:23–30: delivery.status.updated, delivery.location.updated, delivery.offer.created and order.created. TrackingPublisherService routes publication (backend/src/tracking/tracking-publisher.service.ts:22–75); TrackingGateway.handleSubscribe and handleSubscribeOutlet authorize separate order/outlet subscriptions (backend/src/tracking/tracking.gateway.ts:194,307). RidersService.updateLocation upserts the latest fix on rider ID conflict (backend/src/riders/riders.service.ts:516–573+); DeliveryTrackingScreen hydrates status and location from REST before live updates (customer-app/src/screens/DeliveryTrackingScreen.tsx:102–112).
