# Fleet24 Phase 2: Database Schema Architecture Document

## 1. Overview & Architectural Principles

Fleet24 is a hyper-local food delivery platform initially launching in selected areas of Greater Noida, India (with an initial road-route radius restriction of approximately 3 km per outlet). 

The initial database model is designed as a **normalized modular monolith** in PostgreSQL 16 using **Drizzle ORM** with TypeScript.

### Key Architectural Decisions:
1. **Identifier Strategy:** 
   - Primary keys use UUIDv4 (`gen_random_uuid()` via `uuid("id").defaultRandom().primaryKey()`).
   - Prevents enumeration attacks across multiple mobile clients and multi-tenant restaurant dashboards.
2. **Monetary Representation:**
   - All financial amounts (menu prices, order totals, item discounts, delivery fees, taxes, refunds) are stored using `numeric(10, 2)`.
   - Floating-point arithmetic is strictly avoided. Default currency is Indian Rupee (`INR`).
3. **Timestamps:**
   - All created/updated/event timestamps use PostgreSQL `timestamp with time zone` (`timestamptz`), defaulted to `now()`.
4. **Coordinates & Distance:**
   - Coordinates (`latitude` and `longitude`) are stored as `numeric(10, 7)`.
   - Provides ~11mm precision, ideal for calculating road routing, outlet geofencing, and delivery dropoffs.
5. **Historical Immutability:**
   - Order items, order totals, and delivery addresses are frozen as immutable snapshots when an order is placed so subsequent restaurant menu changes or customer address updates never corrupt historical orders.
6. **Status Enums:**
   - Core domain states use explicit PostgreSQL enum types (`user_role`, `order_status`, `payment_status`, `refund_status`, `delivery_status`, `promo_type`), keeping statuses strictly typed in TypeScript and Postgres.

---

## 2. Domain Entities & Table Definitions

### Domain A: Users & Authentication Foundations
- **`users`**: Core user entity. Phone number is unique and required (standard in Indian food delivery apps).
- **`user_roles`**: Many-to-many role table (`customer`, `restaurant_staff`, `rider`, `admin`), allowing multiple active roles per user.
- **`restaurant_staff`**: Links a user to a specific outlet with a designation (`manager`, `kitchen_staff`, `billing`).
- **`customer_addresses`**: Saved delivery addresses with geocoded coordinates (`numeric(10, 7)`) and default flag.

### Domain B: Restaurants & Outlets
- **`restaurants`**: Brand/chain parent entity (e.g. "Haldiram's", "Bikanervala").
- **`restaurant_outlets`**: Specific physical outlet branch (e.g. "Alpha 1 Branch", "Pari Chowk Branch") with exact coordinates, operational flags, and delivery radius.
- **`outlet_operating_hours`**: Day of week (0-6), opening time, closing time, and closed flag.

### Domain C: Menus & Catalog
- **`menu_categories`**: Belongs to restaurant brand (e.g. "North Indian", "Beverages").
- **`menu_items`**: Global item definition under a category with base price and veg/non-veg flag.
- **`outlet_menu_item_overrides`**: Allows an individual physical outlet to pause an item or specify custom local pricing without duplicating entire catalog records.

### Domain D: Orders & Order Items
- **`orders`**: Contains customer reference, physical outlet reference, order status, financial breakdown (`item_total`, `delivery_fee`, `tax_amount`, `discount_amount`, `total_payable`), and frozen delivery address snapshot.
- **`order_items`**: Frozen item details (`item_name`, `unit_price`, `quantity`, `total_price`) preserving exact order-time pricing.
- **`order_status_history`**: Audit trail of order transitions (`pending_payment` -> `placed` -> `confirmed` -> `preparing` -> `ready_for_pickup` -> `out_for_delivery` -> `delivered` / `cancelled`).

### Domain E: Payments & Refunds
- **`payments`**: Idempotent payment records tracking payment provider (e.g., Razorpay, COD), transaction IDs, currency, and status.
- **`refunds`**: Tracks full or partial refunds linked to a payment, with reason and approver reference.

### Domain F: Riders & Deliveries
- **`riders`**: Rider operational profile linked to `users`, tracking vehicle type, online status, and active order concurrency.
- **`rider_latest_locations`**: Current GPS ping (`latitude`, `longitude`, `heading`) for low-overhead rider dispatch.
- **`deliveries`**: Delivery lifecycle record linked 1-to-1 with `orders`, containing delivery status, timestamps, and delivery OTP hash (SHA-256).

### Domain G: Promotions & Referrals
- **`promotions`**: Promo codes with percentage or flat discount, validity period, and per-user usage limits.
- **`promotion_redemptions`**: Immutable log of applied promotions preventing abuse.

### Domain H: Administrative & Operational Records
- **`audit_logs`**: Lightweight audit log for sensitive actions (e.g. refund approval, manual rider dispatch, status override).
