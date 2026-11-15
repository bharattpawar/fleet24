# Testing, deployment and known gaps

## Test and runtime inventory

- Backend Jest specs live next to controllers and services. Auth and guard specs cover sessions/authorization, order specs cover checkout and kitchen actions, and the focused acceptance/radius spec lives under `backend/src/orders/test/`. Payment suites cover callbacks, refunds and reconciliation. Rider assignment, offers, expiry, GPS and gateway have dedicated specs.
- `backend/src/riders/test/rider-delivery-reliability.integration.spec.ts` and `backend/src/admin/test/financial-concurrency.integration.spec.ts` cover cross-service reliability and concurrency scenarios. Read fixture and dependency setup before interpreting these as deployment evidence.
- Customer uses Jest and a React Native mock, with tracking and rider operation specs. Restaurant and Rider each have a reliability test under `test/`. Admin uses Vitest with route protection and feature/component tests, including dispatch, order management and outlet management.
- `backend/scripts/verify-full-order-lifecycle.js`, `verify-concurrency-and-integration.js` and `verify-native-background-and-push.js` are separate from routine unit tests. The scripts directory also contains operational data utilities. Inspect target configuration and side effects before executing any script.
- Nest schedules dispatch, refunds and financial setting jobs inside the API process through `ScheduleModule.forRoot()` and module providers. No independently deployed worker was established. The root Compose file and per-package manifests are local runtime evidence. Customer and Rider have EAS configuration. Native permission, push delivery, provider webhooks and deployment topology require runtime verification.

## Known gaps

- The checked-in SQL file `backend/drizzle/0015_safe_delivery_otp_encryption.sql` adds the encrypted delivery OTP column. No 0015 entry was found in `backend/drizzle/meta/_journal.json`. Verify target schema and journal before relying on a standard migration run.
- The admin finance backend has settlement, payout, ledger and settings routes beyond the dashboard router. The payout provider in `AdminFinanceService` generates sandbox transfer references.
- Authentication uses a mock SMS provider in the inspected auth package. Production SMS delivery was not established.
- Client refresh implementations differ. Restaurant coalesces refresh, while Rider and Admin have their own retry paths. Customer's client has no automatic refresh path found in the inspected code. Refresh rotation and simultaneous requests deserve regression coverage where clients change.
- Deployment, database migration state, native background GPS, push delivery and Razorpay settlement are unverified. Tests and operational scripts were not executed during this static audit.
- The audit covers the architecture and cited execution paths. It does not enumerate every DTO field, migration delta, test assertion, UI control or endpoint parameter.

## How to work on this repository going forward

Start with the owning screen and its app-local API wrapper. Follow the backend controller through DTO, guard, service and schema. For role changes, check server outlet ownership and the matching UI affordance. For order or money changes, trace state transitions, transaction boundaries, replay keys and scheduled recovery. For event changes, update the backend constants/payloads and each app consumer together. Use the package-local scripts and read `customer-app/AGENTS.md` for customer mobile work.

## Background GPS verification boundary
`rider-app/index.ts:2` imports the registration module during startup. `rider-app/src/services/backgroundLocationTask.ts:8–40` registers at module scope on non-web, guards duplicate definition, uses the latest fix in a batch and sends timestamp, accuracy, heading and speed to the singleton. `rider-app/src/services/locationService.ts:531–569` uses the same task name for start/stop. `rider-app/app.json:14,32,50` declares iOS location background mode, Android background permission and the Expo location plugin setting. This establishes a source registration path and declared configuration. Physical devices still need verification of permission prompts, built manifest/plist, headless delivery, token/session recovery, foreground service notification, offline replay and shutdown on going offline or signing out. Customer also has a legacy rider location task (`customer-app/src/services/riderLocationService.ts:11,125,160`); that is separate from the Rider app registration.

Audit method: static inspection and documentation-only diff checks. No provider, live device, database migration or operational action was executed.
