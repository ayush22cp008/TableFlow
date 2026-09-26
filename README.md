# TableFlow — Smart Restaurant Management System

**Status: Feature-complete for its intended scope.**

This project began as a solo hackathon build and has since been substantially extended into a complete staff-operations system. TableFlow now fully addresses the problem it set out to solve — in-restaurant operational coordination, from customer order through kitchen, floor staff, and billing. Further additions (e.g. multi-tenancy, payment gateway integration) would extend it into a different product category rather than deepen this one, so active feature development has been intentionally stopped here to keep the scope honest and the codebase reviewable.

This README is split into two parts:

- **Section 1** documents the project exactly as it was submitted for VibeAthon 6.0.
- **Section 2** documents everything added, fixed, or redesigned afterward, based on the project's own development records.

---

# Section 1 — VibeAthon 6.0 Submission

Built for VibeAthon 6.0 (NxtGenSec) — Professional Category, Solo — Team Code: Ayush008

Research Foundation
Before building, I used Google's Gemini Deep Research tool to run qualitative research across dozens of digital sources — primarily Reddit threads (r/mumbai, r/bangalore, r/delhi, r/india, r/Kerala) plus supporting industry data (NRAI, Petpooja, an Emerald Mumbai food-waste study, and the UNEP Food Waste Index) — to ground the feature set in real operator and customer pain points rather than assumptions. Key findings that directly shaped TableFlow's feature set:
- Post-order dish unavailability (kitchen-menu desync) → Real-Time Menu & Live Availability
- Opaque queues and artificial long waits → Digital Order Placement + Queue/Table Management
- ~75% of restaurants over-prep food nightly with no demand forecasting → Menu Intelligence AI
- Billing delays and hidden service charges → Transparent Itemized Billing

The dish popularity classification and lightweight customer feedback loop (👍👎 + free-text suggestions) inside Menu Intelligence AI was my own addition beyond what the research surfaced — extending the forecasting data into an actionable menu-optimization signal.

## Problem Statement
Most restaurant tech in the market solves food-delivery (customer-to-restaurant), not the actual operational chaos inside a restaurant — walk-in queues, table allocation, order-to-kitchen flow, and billing transparency. TableFlow is a full-stack SaaS built for a single restaurant's internal operations: from a customer walking in or reserving ahead, to live menu browsing, ordering, kitchen queue, seat-level table management, and a fully itemized bill.

## Features (as submitted)
- **Real-Time Menu & Live Availability** — customers see live dish availability; owner toggles items in/out of stock in real time via Supabase Realtime.
- **Digital Order Placement + Queue/Table Management** — customers order digitally; orders flow into a live owner dashboard queue with automatic table allocation.
- **Menu Intelligence AI (flagship)** — Gemini-powered demand forecasting with per-dish reasoning, dish classification (star/deadweight analysis), customer feedback summarization, and trend indicators (rising/falling/steady) computed from real order-history comparison.
- **Sales & Analytics Dashboard** — revenue trends, top dishes, and operational insights for the owner.
- **Transparent Itemized Billing** — customer-facing itemized bill generation tied directly to the order, with automatic seat/table release on billing.
- **Live Orders Kanban** — board shows itemized order contents (dish name + quantity) directly on each card, not just totals.
- **Table Reservations (bonus)** — customer-facing reservation request portal, owner approval workflow with a unique 6-digit verification code, and arrival confirmation that links the reservation directly to the customer's table on order placement (no re-allocation, no identity mismatch).
- **Secure Email-Verified Signup** — signup uses a one-time verification code (OTP) sent to the user's email, entered on the same device/session that started signup — avoiding cross-device magic-link handoff issues.
- **Modern UI** — refreshed, consistent visual design (dual-accent color system, polished cards) across the app.

## Tech Stack (as submitted)
- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend/DB:** Supabase (Postgres, Auth, Realtime, Row-Level Security)
- **Auth:** Supabase Auth (email OTP + Google OAuth)
- **AI:** Google Gemini (gemini-2.5-flash via @google/genai)
- **Email:** Resend (custom domain — tableflow.systems, verified via DKIM/SPF/DMARC)
- **Deployment:** Vercel

## Architecture Summary (as submitted)
- **Single-restaurant model** (no multi-tenancy) — simplifies schema, matches the hackathon scope.
- **Seat-level table capacity:** `restaurant_tables.occupied_seats` tracks real-time occupancy per table; orders carry a `party_size`. A single RPC, `place_order_and_occupy_table`, atomically inserts the order and updates table occupancy — avoiding race conditions between concurrent orders.
- **Reservation flow:** `reservation_requests` table tracks the full lifecycle (pending → approved → arrived → completed). A `reserved_from` timestamp on `restaurant_tables` blocks that table from normal allocation during its reservation window, reusing the same display/allocation logic already built for live tables — no parallel system.
- **Status derivation, not duplication:** table status is always derived from a single source of truth (`occupied_seats`, `reserved_from`) rather than a separately-maintained flag, avoiding state drift between fields that represent the same real-world condition.
- **Email-verified auth:** signup sends a numeric OTP (not a clickable link) via a verified custom domain, so verification always completes in the same browser session that initiated it, regardless of which device the email is opened on.

## Round 2 Judge Feedback — Resolved
- **"README + UI flow enhancements" — resolved.** README updated with current feature set; UI refreshed with a consistent dual-accent design system (indigo + warm amber) applied across all customer and owner pages, including cards, buttons, and modals.
- **"Not all expected features present after login" — resolved.** Root cause was Google OAuth signups defaulting to customer role; a role-selection step now runs for all OAuth signups, and owner-side features (Dashboard, Menu Management, Tables/Waitlist, Live Orders, Analytics, AI Insights) are fully accessible after correct role selection.

## Known Limitations (at submission time)
- **Reservation label cosmetic delay:** after a reservation code is used to place an order, the table may still visually show "Reserved for {time}" (purple) even though it's fully occupied, until the bill is generated. This does not affect table allocation correctness — it's a cosmetic label priority issue only.
- **No in-app notification after reservation arrival confirmation** — customer navigates to the order page manually, same as any walk-in.

---

# Section 2 — Post-Hackathon Enhancements

Everything below was built after the VibeAthon submission, as part of turning the hackathon MVP into a complete, staff-operations-ready system. This section is based on the project's own development/investigation records, not just memory — so it reflects what was actually built, tested, and verified.

## New Role: Manager
The original submission only had **Owner** and **Customer** roles. A full **Manager** role was added afterward, with its own dashboard, order visibility, and permissions distinct from both Owner and Cook/Waiter.

## Staff Role System & Onboarding
- **Cook** and **Waiter** roles added, each with a dedicated dashboard scoped to their job (Cook sees `preparing` orders, Waiter sees `ready` orders).
- **Invite-code-based staff onboarding** — the Owner/Manager generates a role-specific invite code, the invitee signs up with that code and sets their own password, rather than every account being created manually.
- Google OAuth signup was fixed so it correctly runs a role-selection step instead of defaulting every account to `customer`.

## Staff Management Dashboard
- Owner can view all active staff, their role, join date, last login, and status (active/inactive).
- **Deactivate staff** — revokes login without deleting historical data.
- **Force logout all staff** — ends all active staff sessions at once (e.g. end of day).
- **Invite code history & auto-cleanup** — used invite codes are automatically pruned once history grows past a threshold, keeping the table from growing unbounded.

## In-App Notification System
- A notification bell (per-role) added to the navbar for Waiter, Cook, and Manager.
- Notifications are tracked **per-user** (a `notification_reads` table, not a single shared "read" flag), so each staff member's read/unread state is independent.
- Covers 8 event types across the order and reservation lifecycle: `order_placed`, `order_preparing`, `order_ready`, `order_served`, `order_cancelled`, `reservation_requested`, `reservation_approved`, `reservation_rejected`.
- Targeting is either **role-broadcast** (e.g. "all waiters") or **specific-person**, enforced at the database level so a notification is never accidentally sent both ways at once.
- The Owner is intentionally excluded from this notification stream — the Owner dashboard is treated as a read-only oversight view, not an actioning inbox.

## Order Claiming System (Cook / Waiter)
A real coordination problem in the original design: multiple cooks or waiters could see the same order with no way to know who was actually handling it. This was solved with an exclusive claiming system:
- A Cook can claim an order once it's `preparing`; a Waiter can claim it once it's `ready`.
- **Exclusivity is enforced at the database level** — only one Cook and one Waiter can ever hold a given order, and a single staff member cannot hold more than one active claim at a time.
- Verified against real race conditions: when two staff members attempt to claim the same order simultaneously, only one succeeds and the other is correctly rejected.
- The Manager dashboard shows exactly who claimed each order (name + email).
- Claims are automatically released when an order is cancelled or completed, and direct database bypass of the claim (a Cook or Waiter trying to change order status without claiming it first) is blocked by Row-Level Security.

## Push Notifications
Real OS/browser-level push notifications — delivered even when the app isn't open — reusing the per-person targeting model from the Order Claiming system rather than the earlier role-broadcast model. Subscription storage and delivery-deduplication are handled server-side so the same notification is never pushed twice to the same device.

## Mobile Responsive UI
A fully mobile-responsive navbar (hamburger menu, mobile notification dropdown) and mobile-safe layouts across customer and staff dashboards.

## Fixed: Staff Deletion Failure (Foreign Key Constraints)
An earlier version of the Staff Management deletion flow failed with a generic "Failed to delete user profile" error whenever a staff member had any activity history (a claimed order, a notification, a push subscription, etc.) — Postgres was correctly blocking the delete to protect referential integrity, but the app surfaced no useful explanation. This has been resolved:
- Tables representing **pure activity/session data** (`notifications`, `notification_reads`, `push_subscriptions`, `invite_codes`) now cascade-delete when a staff profile is removed.
- Tables representing **business/analytics history** (`orders`, `waitlist`, `feedback`, `reservation_requests`) instead set the staff reference to `NULL` on deletion — so revenue and order history are preserved for analytics even after a staff member is removed, matching the intent already present in the original schema design.

---

## System Design Note

TableFlow is architected as a **single-restaurant system** (no multi-tenancy — see Architecture Summary above), matching the original hackathon scope. This means all visitors to a live/shared demo of this app see and act on the same restaurant's data.

**To explore the app:**
- Log in as Owner using the demo credentials below.
- Use **Staff → Generate Invite Code** to add Waiter, Cook, or Manager accounts and see the staff-onboarding flow.

Since this is a shared live instance, please avoid deleting other visitors' test data — changes made by others may be visible to you.

**Demo login:**
```
Email: owner.demo@tableflow.systems
Password: owner@123
```

---

## Setup Instructions
Clone the repo and install dependencies:
```bash
npm install
```

Create a Supabase project and run the migrations in `supabase/migrations/` in order — this creates the full schema described in both Section 1 and Section 2 above, including seat/reservation tracking, staff roles, notifications, order claiming, and push notification tables.

Configure `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
GEMINI_API_KEY=your_gemini_api_key
RESEND_API_KEY=your_resend_api_key
```
Enable Google OAuth in Supabase Auth → Providers, with your own OAuth client credentials.

Run locally:
```bash
npm run dev
```

## Live Demo
https://table-flow-nu.vercel.app

## Repository
Team Code: Ayush008 · VibeAthon 6.0 · Professional Category
