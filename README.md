# TableFlow — Smart Restaurant Management System

Built for VibeAthon 6.0 (NxtGenSec) — Professional Category, Solo — Team Code: Ayush008

## Problem Statement

Most restaurant tech in the market solves food-delivery (customer-to-restaurant),
not the actual operational chaos inside a restaurant — walk-in queues, table
allocation, order-to-kitchen flow, and billing transparency. TableFlow is a
full-stack SaaS built for a single restaurant's internal operations: from a
customer walking in or reserving ahead, to live menu browsing, ordering,
kitchen queue, seat-level table management, and a fully itemized bill.

## Features

1. **Real-Time Menu & Live Availability** — customers see live dish availability;
   owner toggles items in/out of stock in real time via Supabase Realtime.
2. **Digital Order Placement + Queue/Table Management** — customers order
   digitally; orders flow into a live owner dashboard queue with automatic
   table allocation.
3. **Menu Intelligence AI (flagship)** — Gemini-powered demand forecasting,
   dish classification (star/deadweight analysis), and customer feedback
   summarization.
4. **Sales & Analytics Dashboard** — revenue trends, top dishes, and
   operational insights for the owner.
5. **Transparent Itemized Billing** — customer-facing itemized bill generation
   tied directly to the order, with automatic seat/table release on billing.
6. **Table Reservations (bonus)** — customer-facing reservation request portal,
   owner approval workflow with a unique 6-digit verification code, and
   arrival confirmation that links the reservation directly to the customer's
   table on order placement (no re-allocation, no identity mismatch).

## Tech Stack

- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend/DB:** Supabase (Postgres, Auth, Realtime, Row-Level Security)
- **Auth:** Supabase Auth with Google OAuth
- **AI:** Google Gemini (`gemini-2.5-flash` via `@google/genai`)
- **Email:** Resend (custom SMTP)
- **Deployment:** Vercel

## Architecture Summary

- **Single-restaurant model** (no multi-tenancy) — simplifies schema, matches
  the hackathon scope.
- **Seat-level table capacity**: `restaurant_tables.occupied_seats` tracks
  real-time occupancy per table; orders carry a `party_size`. A single RPC,
  `place_order_and_occupy_table`, atomically inserts the order and updates
  table occupancy — avoiding race conditions between concurrent orders.
- **Reservation flow**: `reservation_requests` table tracks the full
  lifecycle (pending → approved → arrived → completed). A `reserved_from`
  timestamp on `restaurant_tables` blocks that table from normal allocation
  during its reservation window, reusing the same display/allocation logic
  already built for live tables — no parallel system.
- **Status derivation, not duplication**: table status is always derived from
  a single source of truth (`occupied_seats`, `reserved_from`) rather than a
  separately-maintained flag, avoiding state drift between fields that
  represent the same real-world condition.

## Setup Instructions

1. Clone the repo and install dependencies:

npm install

2. Create a Supabase project and run the migration:

supabase/migrations/20260727152250_seat_and_reservation_tracking.sql

   (This creates `orders.party_size`, `restaurant_tables.occupied_seats`,
   `restaurant_tables.reserved_from`, the `place_order_and_occupy_table` RPC,
   and the `reservation_requests` table with its RLS policies.)
3. Configure `.env.local`:

NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
GEMINI_API_KEY=your_gemini_api_key
RESEND_API_KEY=your_resend_api_key

4. Enable Google OAuth in Supabase Auth → Providers, with your own OAuth
   client credentials.
5. Run locally:

npm run dev


## Test Account

Sign up via the app directly, or use Google OAuth on the login page. No
pre-seeded demo account — signup is open and instant.

## Known Limitations

- **Reservation label cosmetic delay**: after a reservation code is used to
  place an order, the table may still visually show "Reserved for {time}"
  (purple) even though it's fully occupied, until the bill is generated. This
  does not affect table allocation correctness — it's a cosmetic label
  priority issue only.
- **Email delivery**: Resend is on the free/sandbox tier and currently only
  delivers to the developer's verified email. A custom domain
  (`tableflow.systems`) has been purchased but DNS/SMTP wiring was
  deliberately deferred post-submission to avoid unpredictable propagation
  delays this close to deadline.
- **No in-app notification** after reservation arrival confirmation —
  customer navigates to the order page manually, same as any walk-in.
- **No direct link from the main menu to the reservation portal yet** —
  reservation URL must be shared directly (`/reserve`).

## Live Demo

[LIVE URL — added after Vercel deployment]

## Repository

Team Code: Ayush008 · VibeAthon 6.0 · Professional Category
