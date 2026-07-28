# TableFlow — Smart Restaurant Management System
Built for VibeAthon 6.0 (NxtGenSec) — Professional Category, Solo — Team Code: Ayush008

**Status: Beta.** Core features are fully functional; a few known limitations are documented below.

## Problem Statement
Most restaurant tech in the market solves food-delivery (customer-to-restaurant), not the actual operational chaos inside a restaurant — walk-in queues, table allocation, order-to-kitchen flow, and billing transparency. TableFlow is a full-stack SaaS built for a single restaurant's internal operations: from a customer walking in or reserving ahead, to live menu browsing, ordering, kitchen queue, seat-level table management, and a fully itemized bill.

## Features
- **Real-Time Menu & Live Availability** — customers see live dish availability; owner toggles items in/out of stock in real time via Supabase Realtime.
- **Digital Order Placement + Queue/Table Management** — customers order digitally; orders flow into a live owner dashboard queue with automatic table allocation.
- **Menu Intelligence AI (flagship)** — Gemini-powered demand forecasting, dish classification (star/deadweight analysis), and customer feedback summarization.
- **Sales & Analytics Dashboard** — revenue trends, top dishes, and operational insights for the owner.
- **Transparent Itemized Billing** — customer-facing itemized bill generation tied directly to the order, with automatic seat/table release on billing.
- **Table Reservations (bonus)** — customer-facing reservation request portal, owner approval workflow with a unique 6-digit verification code, and arrival confirmation that links the reservation directly to the customer's table on order placement (no re-allocation, no identity mismatch).
- **Secure Email-Verified Signup** — signup uses a one-time verification code (OTP) sent to the user's email, entered on the same device/session that started signup — avoiding cross-device magic-link handoff issues.

## Tech Stack
- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend/DB:** Supabase (Postgres, Auth, Realtime, Row-Level Security)
- **Auth:** Supabase Auth (email OTP + Google OAuth)
- **AI:** Google Gemini (gemini-2.5-flash via @google/genai)
- **Email:** Resend (custom domain — tableflow.systems, verified via DKIM/SPF/DMARC)
- **Deployment:** Vercel

## Architecture Summary
- **Single-restaurant model** (no multi-tenancy) — simplifies schema, matches the hackathon scope.
- **Seat-level table capacity:** `restaurant_tables.occupied_seats` tracks real-time occupancy per table; orders carry a `party_size`. A single RPC, `place_order_and_occupy_table`, atomically inserts the order and updates table occupancy — avoiding race conditions between concurrent orders.
- **Reservation flow:** `reservation_requests` table tracks the full lifecycle (pending → approved → arrived → completed). A `reserved_from` timestamp on `restaurant_tables` blocks that table from normal allocation during its reservation window, reusing the same display/allocation logic already built for live tables — no parallel system.
- **Status derivation, not duplication:** table status is always derived from a single source of truth (`occupied_seats`, `reserved_from`) rather than a separately-maintained flag, avoiding state drift between fields that represent the same real-world condition.
- **Email-verified auth:** signup sends a numeric OTP (not a clickable link) via a verified custom domain, so verification always completes in the same browser session that initiated it, regardless of which device the email is opened on.

## Setup Instructions
Clone the repo and install dependencies:
```bash
npm install
```

Create a Supabase project and run the migration:
```bash
supabase/migrations/20260727152250_seat_and_reservation_tracking.sql
```
*(This creates `orders.party_size`, `restaurant_tables.occupied_seats`, `restaurant_tables.reserved_from`, the `place_order_and_occupy_table` RPC, and the `reservation_requests` table with its RLS policies.)*

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

## Getting Started as a Judge/Reviewer
Sign up with any real email as a customer, or as an owner using invite code `TableFlow12` — email delivery is fully live on the verified custom domain, so the OTP verification code will arrive at any email address. Google OAuth is also available (creates customer-role accounts only).

## Known Limitations (Beta)
- **Reservation label cosmetic delay:** after a reservation code is used to place an order, the table may still visually show "Reserved for {time}" (purple) even though it's fully occupied, until the bill is generated. This does not affect table allocation correctness — it's a cosmetic label priority issue only.
- **No order cancellation from the owner dashboard yet:** cancelling an in-progress order does not currently release the table's occupied seats correctly, so this control has been intentionally removed for this release rather than ship a partially-working flow. Orders currently resolve via the normal billing flow, which does correctly release seats.
- **No in-app notification after reservation arrival confirmation** — customer navigates to the order page manually, same as any walk-in.


## Live Demo
https://table-flow-nu.vercel.app

## Repository
Team Code: Ayush008 · VibeAthon 6.0 · Professional Category
