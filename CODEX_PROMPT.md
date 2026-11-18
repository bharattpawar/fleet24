# Codex prompt: finish Fleet24 hardcoded-values cleanup

Copy everything below the line into Codex.

---

You are working in the Fleet24 monorepo: `backend` (NestJS 10 + Drizzle + PostgreSQL), `customer-app`, `rider-app`, `restaurant-app` (Expo SDK 58 / React Native 0.88), `admin-dashboard` (Vite + React + react-query + vitest).

## Step 0: bring in the finished work

1. Run `git fetch origin claude/relaxed-davinci-2kwe4b`. Then merge it into `main` with `git checkout main && git merge --ff-only origin/claude/relaxed-davinci-2kwe4b`. It contains two finished commits:
   - `feat: let admin set GST on food and on the delivery fee`
   - `feat: admin coupon codes and restaurant dish discounts`
2. Run the database migrations: `cd backend && npm run db:migrate`. This applies `drizzle/0020_discounts.sql`, which adds `menu_items.discount_type`, `menu_items.discount_value` and `customer_carts.promotion_id`.
3. Run every test suite and confirm it is green before you change anything:
   - `cd backend && npx tsc --noEmit -p . && npx jest`
   - `cd admin-dashboard && npx tsc -b --noEmit && npx vitest run`
   - `cd customer-app && npx tsc --noEmit && npx jest`
   - `cd restaurant-app && npx tsc --noEmit && node --experimental-strip-types --test test/*.test.js test/*.test.mjs`
   - `cd rider-app && npx tsc --noEmit && node --experimental-strip-types --test test/*.test.js test/*.test.mjs`

   These backend suites already fail before your change. Do not try to fix them:
   - `src/admin/test/financial-concurrency.integration.spec.ts` (needs a live DB)
   - `src/riders/test/rider-delivery-reliability.integration.spec.ts` (needs a live DB)
   - 4 time-based cases in `src/riders/rider-assignment.service.spec.ts`

   Only report that they still fail.

## Rules for every task

- Do one task at a time, and make one commit per task with a clear message.
- Never hard-code coordinates, places, phone numbers, emails or prices in app code. They come from the API, admin settings or env/config.
- Keep existing behaviour for anything not listed.
- For every behaviour change, add or update tests: backend jest, admin vitest, customer jest (react-test-renderer), rider and restaurant `node:test` `.mjs`.
- Run that app's typecheck and tests after each task.
- Don't add secrets to the repo.

## Tasks

### 1. Remove the ₹30 fallback delivery fee
- **Where:** `backend/src/orders/cart.service.ts`. When reading financial settings fails, the catch sets `deliveryFee = 30.0`.
- **Fix:** use `FinancialSettingsService`'s built-in default settings (`DEFAULT_SETTINGS` / its fallback) and compute the fee from them with `calculateCustomerDeliveryFee`. Log a warning; don't keep a magic number.
- **Also fix:** `customer-app/src/context/CartContext.tsx` `recalculateCart` (guest cart) hard-codes `deliveryFee = 30`. Use the last `deliveryFee` the server sent for this cart if there was one. Otherwise show the fee as "calculated at checkout": set it to 0 and add a flag `deliveryFeePending: true` so CartScreen shows "Delivery fee: at checkout" instead of ₹0.

### 2. "Greater Noida" texts → service-area names from the API
The backend already has `GET /public/service-zones`, which returns active zones `{id, name, centerLatitude, centerLongitude, radiusMeters}`.
- **customer-app:** add a small hook `useServiceAreas()` that fetches the zones once and caches them. Build the area text from the zone names, e.g. "Knowledge Park II and Knowledge Park III". If none load, use the generic "our delivery area". Replace the hard-coded text in:
  - `HomeScreen.tsx` (out-of-area banner)
  - `CartScreen.tsx` (empty cart text and the not-serviceable alert)
  - `OrdersScreen.tsx` (empty state)
  - `OrderConfirmationModal.tsx` (line ~90 text; line ~117 `city || 'Greater Noida'`, where you should show the city only if present)
  - `AuthModalScreen.tsx` (region chip and phone note)
  - `ProfileScreen.tsx` (`Greater Noida, UP`: show the city of the default saved address, or hide the row)
  - `DeliveryLocationContext.tsx` subtitle
- **rider-app:**
  - `RiderHeader.tsx` "Greater Noida Central" and `RiderEarningsScreen.tsx` "Greater Noida Delivery Partner": use the zone the rider is in, or "Fleet24 Delivery Partner".
  - `RiderHomeScreen.tsx` line ~218: the fallback phone `'1234567890'` must go. If there is no phone, disable that action and show why.
- **backend:**
  - `riders/rider-assignment.service.ts` line ~583: the fallback `'Knowledge Park III, Greater Noida'` for the outlet address must go. Use the outlet name, or an empty string the apps already handle.
  - `database/schema/users.ts`: `city` default `'Greater Noida'`. Remove the default in a new migration `0021_...sql` (`ALTER COLUMN city DROP DEFAULT`) and make the address DTO require `city` (Google place details already fill it).
  - Leave comments, seed data and the `DEFAULT_ZONE_SEEDS` geocoding queries as they are.

### 3. Admin forms prefilled with fixed coordinates
- **Where:**
  - `admin-dashboard/src/features/restaurants/components/AddOutletModal.tsx` (lat 28.4744 / lng 77.5040)
  - `AddRestaurantModal.tsx` (lng 77.5946, plus the lat next to it)
  - `ServiceZonesMap.tsx` default centre `{28.47, 77.49}`
- **Fix:** start the outlet and restaurant forms with empty coordinates. Add the same place search used in `features/service-zones/ServiceZonesScreen.tsx` (`serviceZonesApi.searchPlaces` / `placeDetails`, i.e. `/geo/autocomplete` and `/geo/places/:id`) so the admin searches the address and lat/lng fill in automatically. Show a validation error if the coordinates are empty.
- **For the map:** when there are no zones, centre on the browser's geolocation if allowed; otherwise show an empty-state message instead of a fixed city.

### 4. Home screen cuisine filter and Biryani banner
- **Where:** `customer-app/src/screens/HomeScreen.tsx`. The cuisine chips (line ~53) are a fixed list with `filterKey` substring matching. The banner (line ~357) is a fixed `biryani-campaign.png`.
- **Chips:** build them from the categories that actually exist in the loaded outlet menus. Use the backend's category names, de-duplicated, case-insensitive, with the most common first. Filtering must match category names exactly, not substrings of dish names.
- **Banner:** use the admin-managed Customer Home sections (`backend/src/restaurants/customer-home.controller.ts`, admin page `features/customer-home`). Show a banner only if admin configured one. If that needs an image field the schema doesn't have, add `imageUrl` to the home section (migration + admin form field). Delete the hard-coded banner and its asset if it is unused afterwards.

### 5. Dev LAN IP and Google client ID in code
- **Where:**
  - `customer-app/src/api/client.ts`, `restaurant-app/src/api/client.ts`, `rider-app/src/api/client.ts`: `DEV_LAN_IP = '172.20.10.2'`
  - `customer-app/src/api/trackingSocket.ts` comment
  - `backend/src/main.ts` line ~66: CORS allows `http://172.20.10.2:`
  - `customer-app/src/screens/AuthModalScreen.tsx` line ~26: Google OAuth client ID constant
- **Apps:** read the API URL from `process.env.EXPO_PUBLIC_API_URL`. In development with no env var, derive the host from Expo's `Constants.expoConfig?.hostUri` (the machine running Metro). Fall back to `http://localhost:4000` on web or simulator. No fixed IP.
- **Backend CORS:** read the allowed origins from an env var `CORS_ORIGINS` (comma separated). In development also allow any private-network origin: 10.x, 172.16-31.x, 192.168.x and localhost, on any port. Validate the env var in `config/env.validation.ts`.
- **Google:** move the client IDs to `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` / `..._IOS_...` / `..._ANDROID_...` (read in `app.config.js` → `extra`). Hide the Google button when they are not set.
- Add every new variable to each app's `.env.example`.

### 6. Personal data and demo shortcuts in auth code
- **`admin-dashboard/src/features/auth/AdminAuthContext.tsx`** (lines ~26-28): a hard-coded super-admin user with a real-looking phone and personal email. Remove it. The admin profile must come only from `GET /auth/me` after login. If any mock/dev mode needs a user, use obviously fake data such as `admin@example.com` / `+910000000000`, and only behind an explicit `VITE_USE_MOCK_DATA=true`.
- **Placeholders:** `AdminLoginScreen.tsx` and `AddOutletModal.tsx` use `+919876543210`. Change them to a neutral placeholder like `+91 98xxxxxxxx`.
- **`customer-app/src/screens/AuthModalScreen.tsx`:** the "demo login" auto-verifies with `123456` (line ~174) and there is an autofill button (line ~426). Show both only when `__DEV__ && process.env.EXPO_PUBLIC_DEV_AUTH_BYPASS === 'true'`. Never show them in a production build.
- **`backend/src/auth/dto/auth.dto.ts`:** the phone regex accepts `1234567890` and any 10 digits. Accept only valid Indian mobiles (`^(\+91)?[6-9]\d{9}$`). Keep test numbers working only when `ALLOW_DEV_AUTH_BYPASS=true`, via a check in the service, not the DTO.
- Update the tests that use those numbers.

### 7. Restaurant app login has no OTP screen
- **Where:** `restaurant-app/src/context/RestaurantAuthContext.tsx` (lines ~198-199) and the login screen. Login sends the OTP request and then immediately verifies with `'123456'`.
- **Fix:** add a real OTP step to the existing login screen: request OTP → show a 6-digit input with a resend timer (use `cooldownSeconds` / `expiresInSeconds` from the request response) → verify. Show the server's error text.
- Keep the instant dev login only when `__DEV__ && EXPO_PUBLIC_DEV_AUTH_BYPASS === 'true'`.
- Add `node:test` tests for the OTP state logic: put it in a small pure module under `src/utils`.

### 8. Rider mock GPS
- **Where:** `rider-app/src/services/locationService.ts` (lines ~227-228). Mock mode returns a fixed lat/lng 28.4744 / 77.504.
- **Fix:** in mock mode use the centre of the first active service zone from `/public/service-zones`. If none, return `null` like the real path does. Only allow mock mode when `__DEV__`.

### 9. SMS and payouts are still mock/sandbox (report only, no code)
Find where OTP SMS is "sent" (mock) and where rider/restaurant payouts call a sandbox. Write a short note in `docs/PROVIDERS_TODO.md` listing:
- each place in the code,
- which env vars a real provider would need (e.g. MSG91 or Twilio for SMS, RazorpayX for payouts),
- what is missing.

Don't integrate a provider.

## When done

Report for each task:
- **Done or blocked**, with the reason if blocked.
- **Files changed.**
- **Tests added and the results** (pass/fail counts per app).
- **New env vars**, and where they are documented.
- **New migrations** that must be run.
