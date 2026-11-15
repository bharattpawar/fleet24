# Architecture overview

| Directory | Role | Entry and dependencies |
| --- | --- | --- |
| customer-app | Consumer discovery, checkout and tracking. Also contains an older rider workflow | `index.ts`, `App.tsx`. Expo/React Native, app-local REST client, Socket.IO tracking and Expo browser checkout |
| restaurant-app | Standalone kitchen and outlet operations | `index.ts`, `App.tsx`. Expo/React Native, REST and Socket.IO outlet subscriptions |
| rider-app | Standalone dispatch and delivery operations | `index.ts`, `App.tsx`. Expo/React Native, REST, Socket.IO, Expo Location, TaskManager and notifications |
| admin-dashboard | Admin operations web UI | `src/main.tsx`, `src/app/router/index.tsx`. Vite, React, React Router and Axios |
| backend | Common HTTP API, realtime gateway and scheduled jobs | `src/main.ts`, `src/app.module.ts`. NestJS 10, Drizzle, node-postgres, Socket.IO and Razorpay |

The manifests declare Expo 58 and React 19 across mobile apps. Each package has its own pnpm lockfile. Rider also has an npm lockfile. Backend pins pnpm 10.12.4 in its manifest. The root has Compose and environment examples, with no root application manifest or shared client package found. Each app owns its request wrappers, UI tokens and response types. Contract changes cross package boundaries through HTTP and Socket.IO.

Mobile REST hosts come from app-local `src/api/client.ts` configuration and platform-specific development defaults. Admin reads `VITE_API_BASE_URL`. Backend validates configuration in `backend/src/config/env.validation.ts` and registers its database pool via `backend/src/database/database.module.ts`. Google identity and Razorpay are provider boundaries. Rider push passes through `backend/src/riders/notification.service.ts`. Public images are fetched by URL.

No `restaurant-dashboard/` was found in the working tree or by a path-scoped Git history search. The standalone restaurant client is `restaurant-app/`. Deployment status of every client is unverified.

The pre-existing FLEET24_CURRENT_STATE_AUDIT.md describes a legacy restaurant web dashboard. Its implementation is unavailable in this checkout, so its behavior and overlap could not be verified.

## Source entry points
Trace order ownership from `backend/src/database/schema/orders.ts:19–58`, fulfillment from `backend/src/database/schema/deliveries.ts:82–109`, and money from `backend/src/database/schema/payments.ts:18–92` and `finance.ts:29–119` in the same directory. The admin router at `admin-dashboard/src/app/router/index.tsx:28–73` is the dashboard route inventory. See [data and migrations](02-backend-and-database.md), [workflow traces](04-end-to-end-flows.md), and [proposed changes](07-new-business-requirements-gap-analysis.md).
