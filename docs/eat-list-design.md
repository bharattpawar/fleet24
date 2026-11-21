# Customer Eat List — HLD and LLD

## Behavior

Eat List stores dishes a customer wants to eat later. It is separate from restaurant favourites and from the cart. Any dish in an active restaurant menu can be saved, including a temporarily sold-out dish. A save may include a private note (up to 1,000 characters), a calendar day, and an optional local clock time. There is no product limit on the number of saved dishes.

All saves shows newest saves grouped by the device's local saved day. Planned sorts by the chosen calendar day and clock time, with untimed meals last on that day. Someday shows dishes without a planned date. The seven-day strip narrows Planned; All days includes dates outside that strip, including past plans. Plans are not reminders or orders. There is no automatic checkout or notification scheduling.

## High-level design

Customer menu/search/curated dish → shared bookmark control → shared plan editor → authenticated REST controller → EatListService → EatListRepository → PostgreSQL.

The footer opens a dedicated, virtualized EatListScreen. Auth, cart, delivery location and the existing app navigation remain shared with the rest of the customer app. All UI uses existing Expo Go compatible React Native primitives, the bundled typefaces and Fleet24's green/lime palette; no new native dependency or environment variable is needed.

The controller validates transport inputs and uses the existing JWT and customer-role guards. The service owns plan validation, authoritative pricing, duplicate semantics and presentation. The repository owns parameterized SQL, ownership predicates, joins and keyset pagination. There is no per-card database query in the list.

## Data model and lifecycle

Migration `0025_customer_eat_list` adds `customer_eat_list_items`:

| Fields                                                                  | Purpose                                                            |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------ |
| id, user_id                                                             | UUID identity; authenticated owner, cascades on account deletion   |
| outlet_id, menu_item_id                                                 | Source references, become null if the source is deleted            |
| dish_name, restaurant_name, outlet_name, image_url, is_veg, saved_price | Server-derived snapshots so removed dishes remain recognizable     |
| note                                                                    | Optional personal note, 1,000 characters maximum                   |
| planned_date, planned_time, time_zone                                   | Optional local calendar date, optional 24-hour time, IANA zone     |
| created_at, updated_at                                                  | Server timestamps; edits never change the original saved timestamp |

A unique index on `(user_id, outlet_id, menu_item_id)` makes duplicate saves safe. POST uses INSERT ON CONFLICT DO NOTHING and returns the original save, preserving its note, plan and created_at. PATCH explicitly edits a save. Unavailable or removed dishes remain editable and removable. Current dish data/prices are joined when available; unavailable sources fall back to the saved snapshot and show that status. Saved prices are informational, not checkout quotes.

Active menu visibility follows the existing public menu contract (`restaurant.is_active`, `outlet.is_active`, active category and matching restaurant). Onboarding already keeps unapproved applications inactive. Eat List does not activate restaurants or change moderation status. Outlet-specific price overrides and dish discounts use the same pricing helper as menus.

## API contract

All routes live under `/api/v1/customer/eat-list` and use the backend's existing response envelope.

| Method and suffix | Input                                                          | Result                                   |
| ----------------- | -------------------------------------------------------------- | ---------------------------------------- |
| GET /             | mode=all/planned/someday; optional planned date, cursor, limit | items, owner-wide stats, nextCursor      |
| GET /membership   | outletId, comma-separated itemIds (1–100 UUIDs)                | Saved menuItemId/id pairs for that owner |
| GET /:id          | Save UUID                                                      | One owned save, or 404                   |
| POST /            | outletId, menuItemId, optional note/date/time/zone             | Existing or newly persisted save         |
| PATCH /:id        | Optional note/date/time/zone fields                            | Updated owned save                       |
| DELETE /:id       | Save UUID                                                      | Removed status, or 404                   |

Default page size is 20, maximum 50. All/Someday use `(created_at DESC, id DESC)` cursors. Planned uses `(planned_date ASC, coalesce(planned_time, '23:59:59'), id ASC)`. Cursors retain PostgreSQL microsecond timestamp precision and bind to mode/date, avoiding gaps for equal timestamps and rejecting reuse across filters. Indexed owner/date columns support pagination without unbounded offsets. Statistics are one owner-scoped aggregate; list reads use one join query plus the aggregate.

## Dates, privacy and consistency

Calendar dates stay YYYY-MM-DD strings and never round-trip through UTC midnight. Times stay HH:mm, and a planned date requires a validated IANA zone. Date-only plans have no fabricated midnight time. Removing a planned date clears its time and zone. Saved timestamps are UTC instants displayed in the device's local zone. Plans in another zone display their stored zone explicitly. Invalid dates, clocks, zones, oversized notes, arrays and cursors fail validation.

The user ID comes only from the verified JWT, never the request body. Every read, aggregate, membership query, update and delete includes that owner. Cross-user IDs return 404. SQL values are parameterized. PostgreSQL RLS is enabled with no public/anon policies, keeping private notes off direct Supabase browser access. The backend database role must own the table or have BYPASSRLS, as the current server connection does; a future restricted DB role needs an explicit server-only policy.

The save editor checks membership before editing, so opening an existing bookmark cannot accidentally replace its details with an empty form. Writes keep form contents on failure. Login resumes a pending guest save; cancelling login discards that intent. Screen requests use cancellation/version checks so old filters cannot replace newer results. Account-scoped screen keys and cache invalidation prevent one account's list from appearing for another. Concurrent edits use last successful write semantics; duplicate saves do not overwrite edits.

Visible bookmark controls batch membership queries by outlet (maximum 100 IDs/request) and retain a bounded in-memory cache rather than downloading an unlimited list of IDs. Writes invalidate list/membership revisions. List rendering virtualizes date headers and card rows, uses two columns on wide screens, and loads additional pages explicitly. No note or plan is stored as an unauthenticated browser preference.

## Validation

Backend tests cover real PostgreSQL persistence, authoritative override/discount prices, duplicate saves, account isolation for all CRUD operations, membership bounds, inactive/menu mismatch rejection, deleted dish snapshots, date/time validation, filtered keyset pagination with equal timestamps, and RLS configuration. Integration fixtures live in a rolled-back transaction.

Customer tests cover local-date/leap-calendar behavior, midnight versus untimed meals, new saves, loading an existing bookmark, editing notes/plans, clearing date/time together, invalid times and recoverable failures. Browser QA exercises the live authenticated API with temporary accounts: menu save, edit, date/time, filters, reload persistence, delete, cross-account rejection and responsive layouts at 360, 390 and 1280 pixels. Temporary QA accounts are deleted afterwards. Typecheck, customer lint, full backend/customer test suites and an iOS Metro bundle complete validation; physical iPhone interaction still requires a device check.
