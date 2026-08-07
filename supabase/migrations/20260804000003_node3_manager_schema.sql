-- ============================================================
-- Node 3: Manager Dashboard Schema Additions
-- ============================================================

-- 1. Add payment_method to orders table
ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS payment_method text 
    CHECK (payment_method IN ('cash', 'card', 'upi'));
