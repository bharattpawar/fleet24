# Frontend apps

## Customer

`customer-app/App.tsx` composes customer auth/cart state and screen navigation. `src/context/AuthContext.tsx` and `src/api/storage.ts` manage auth state. `AuthModalScreen` requests/verifies phone OTP and includes a Google identity path. `src/api/client.ts` provides customer REST calls. No automatic refresh retry was found there. 

| Screen or component in customer-app/src | Data path |
| --- | --- |
| HomeScreen, AddressSelectionModal | Public outlet discovery and saved addresses via the client. Home also has static merchandising content. |
| RestaurantDetailScreen, MenuItemCard | Public menu, category and item rendering, quantity changes through cart context. |
| CartScreen, CartContext | Cart and address requests, checkout, payment session, browser return and verification. |
| OrdersScreen, DeliveryTrackingScreen | Customer order history/details and delivery snapshot, with Socket.IO updates on the tracking screen. |
| ProfileScreen | Customer profile/account state. |
| RiderDashboardScreen | Older rider operations retained alongside the standalone rider app. |

The shared UI vocabulary is in `src/theme/tokens.ts` and `src/components/`. Mock fixtures live in `src/api/mockData.ts` with `USE_MOCK_DATA = false` in this checkout.

## Restaurant

`restaurant-app/App.tsx` is the screen shell. `RestaurantAuthContext` resolves the logged-in profile and selected outlet using app storage. `restaurantApi.ts` wraps restaurant profile, outlets, menu and kitchen order calls. `src/utils/permissions.ts` drives owner/manager/kitchen UI affordances. Server enforcement comes from role decorators and outlet checks in restaurant and order services. Review each action at both layers when changing permissions.

`RestaurantOrdersScreen` and `KitchenOrderCard` show the queue and submit status changes. `RestaurantMenuScreen` manages categories, items and overrides. `RestaurantOutletsScreen` manages outlet configuration and `RestaurantProfileScreen` presents account information. `KitchenHeader` and theme tokens provide reusable layout/styling. `src/api/client.ts` coalesces concurrent refresh calls, retries after a successful refresh and routes terminal auth failures to logout. Orders resubscribe/refetch on socket reconnect and use a 15-second polling fallback.

## Rider

`rider-app/App.tsx` switches between login, home, earnings and account using `RiderAuthContext`. `riderApi.ts` wraps profile/availability, pending offers, the available pool, active jobs, progression and earnings. `RiderHomeScreen` composes availability, map, incoming offer, active delivery and OTP components. `RiderEarningsScreen` and `RiderAccountScreen` handle earnings and rider account state. The API client retries after a refresh on 401. Demo login is gated by `__DEV__` and a nonproduction environment in `src/api/mockData.ts`. Inspect location and notification services for device-side behavior.

## Admin

`admin-dashboard/src/app/router/index.tsx` wires login, access denied and protected dashboard routes. `AdminAuthContext` and `AdminProtectedRoute` resolve access, while the Axios client stores and rotates admin tokens via browser local storage. The backend has its own guards.

| Route | Screen / client integration |
| --- | --- |
| overview | `OverviewScreen`, `lib/api/dashboard.ts`, admin dashboard analytics |
| orders | `OrdersManagementScreen`, `lib/api/orders.ts`, admin order operations |
| dispatch | `LiveDispatchScreen`, `lib/api/dispatch.ts`, admin dispatch operations |
| restaurants, outlets | `RestaurantManagementScreen`, `lib/api/restaurants.ts`, restaurant/outlet management, menu and KYC components |
| riders | `RiderManagementScreen`, `lib/api/riders.ts`, admin rider verification and management |

`DashboardLayout`, `Sidebar`, `Header`, CSS and feature-local badges, drawers and modals define the UI structure. The registered routes do not include dedicated customer, payment, settlement, ledger or settings screens. Backend admin controllers expose a broader finance surface.

## Session behavior by client
- Customer: `customer-app/src/context/AuthContext.tsx:97–130` stores both login tokens. `customer-app/src/api/client.ts` has no 401 refresh path. Review restoration and API failure separately from login.
- Restaurant: `restaurant-app/src/api/client.ts:45–104,154+` shares a refresh promise and centralizes auth failure handling; `restaurant-app/src/context/RestaurantAuthContext.tsx:144–201` handles restoration/auth failures and persists login tokens.
- Rider: `rider-app/src/api/client.ts:79–100` attempts refresh per non-auth 401; concurrent failures can contend on rotation. `rider-app/src/context/RiderAuthContext.tsx:97,336,402` contains auth failure and token persistence paths.
- Admin: `admin-dashboard/src/lib/api/client.ts:44–64` retries once using a per-request marker and rotates localStorage tokens; the marker does not serialize concurrent refreshes.
- Backend: `backend/src/auth/auth.controller.ts:55–60` delegates refresh to `AuthService.refreshTokens` in `backend/src/auth/auth.service.ts:294+`, which validates session and hashed secret, detects reuse and rotates the session. Concurrent requests with an old credential are therefore a meaningful recovery case.

## Admin endpoint coverage
Paths below omit the API prefix. Router source is `admin-dashboard/src/app/router/index.tsx:40–73`; client files are under `admin-dashboard/src/lib/api/`.

| Dashboard route | Backend operations and client evidence |
|---|---|
| /overview | GET admin/dashboard/{overview,revenue,recent-activity} in dashboard.ts:13–27. Controller also exposes GET orders, riders and restaurants analytics, with no matching calls in that client (`backend/src/admin/admin-dashboard.controller.ts:26–71`). |
| /orders, /dispatch | GET admin/orders and /:orderId, POST cancel and retry-dispatch (orders.ts:12–67); GET admin/deliveries/active and /:deliveryId, POST admin/riders/orders/:orderId/assign (dispatch.ts:11–56). Controller assign runs automatic candidate selection, not a chosen-rider override (`backend/src/riders/admin-riders.controller.ts:96–100`). |
| /restaurants, /outlets | GET applications, application detail and restaurant outlets; PATCH verification, suspension, unsuspend, outlet operations and document verification (restaurants.ts:27–128). POST restaurant documents is declared in `backend/src/admin/admin-management.controller.ts:174`, with no matching restaurants.ts method. |
| /riders | GET rider list/detail, PATCH verification/suspension/unsuspend (riders.ts:13–60; `backend/src/riders/admin-riders.controller.ts:40–84`). |
| /customers | GET list and detail (directory.ts:45–47). Backend block/unblock PATCH has no directory UI action (`backend/src/admin/admin-management.controller.ts:59–72`). |
| /customer-home | GET/PUT admin/customer-home (`backend/src/restaurants/customer-home.controller.ts:31–39`; dashboard feature under `admin-dashboard/src/features/customer-home/`). |
| /finance/payments, /finance/refunds | GET payment/refund lists and ID details plus payment outlet filter (transactions.ts:56–60; `backend/src/admin/admin-transactions.controller.ts:14–34`). Manual refund reconciliation POST exists separately (`backend/src/payments/payments.controller.ts:34`), with no transaction screen action. |
| /finance/ledger | GET ledger (directory.ts:49). Finance overview/reconciliation GETs have no dedicated route (`backend/src/admin/admin-finance.controller.ts:37–55`). |
| /finance/payouts, /finance/settlements | Read endpoints and rider earnings/summary through disbursements.ts. Backend approve/reject/process payouts and generate/approve/process settlements have no matching action on these read-only screens (`backend/src/admin/admin-finance.controller.ts:86–187`). |
| /finance/settings | Read current/history, create/update draft, preview, publish (financialSettings.ts; `backend/src/admin/financial-settings.controller.ts:34–90`). Scheduled worker checks every minute (`backend/src/admin/financial-settings-scheduled.worker.ts:16`). |

Client presence is source evidence for wiring, not a permission or authenticated runtime test.

Customer startup specifically reads the stored access token, then calls /auth/me. The profile catch clears tokens even on a request failure unrelated to expiry (customer-app/src/context/AuthContext.tsx:40–65).
