-- ============================================================
-- Node 3: Fix orders.status CHECK constraint to include 'billed'
-- ============================================================

DO $$ 
DECLARE 
  v_constraint_name text;
BEGIN 
  -- Find the check constraint on the status column of the orders table
  SELECT c.conname INTO v_constraint_name
  FROM pg_constraint c
  JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
  WHERE c.conrelid = 'orders'::regclass 
    AND c.contype = 'c' 
    AND a.attname = 'status';

  -- If found, drop it dynamically
  IF v_constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE orders DROP CONSTRAINT ' || quote_ident(v_constraint_name);
  END IF;
END $$;

-- Add the updated constraint including 'billed'
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('placed', 'preparing', 'ready', 'served', 'billed', 'cancelled'));
