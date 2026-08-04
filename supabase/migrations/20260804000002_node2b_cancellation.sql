-- ============================================================
-- Node 2b: Order Cancellation System & RLS Fix
-- ============================================================

-- 1. Extend orders table with cancellation fields
ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS cancellation_category text 
    CHECK (cancellation_category IN ('fire', 'food_safety', 'natural_disaster', 'other', 'manual'));

-- 2. Drop the old orders_update_* policies from the previous migration
DROP POLICY IF EXISTS "orders_update_cook" ON orders;
DROP POLICY IF EXISTS "orders_update_waiter" ON orders;
DROP POLICY IF EXISTS "orders_update_manager" ON orders;
DROP POLICY IF EXISTS "orders_update_owner" ON orders;

-- 3. Create strictly paired RLS transition policies

-- COOK
CREATE POLICY "cook_prep_to_ready" ON orders FOR UPDATE
USING ( has_role(ARRAY['cook']) AND status = 'preparing' )
WITH CHECK ( has_role(ARRAY['cook']) AND status = 'ready' );

CREATE POLICY "cook_cancel" ON orders FOR UPDATE
USING ( has_role(ARRAY['cook']) AND status IN ('placed','preparing','ready') )
WITH CHECK ( has_role(ARRAY['cook']) AND status = 'cancelled' AND cancellation_reason IS NOT NULL );

-- WAITER
CREATE POLICY "waiter_ready_to_served" ON orders FOR UPDATE
USING ( has_role(ARRAY['waiter']) AND status = 'ready' )
WITH CHECK ( has_role(ARRAY['waiter']) AND status = 'served' );

CREATE POLICY "waiter_cancel" ON orders FOR UPDATE
USING ( has_role(ARRAY['waiter']) AND status IN ('placed','preparing','ready') )
WITH CHECK ( has_role(ARRAY['waiter']) AND status = 'cancelled' AND cancellation_reason IS NOT NULL );

-- MANAGER
CREATE POLICY "manager_placed_to_prep" ON orders FOR UPDATE
USING ( has_role(ARRAY['manager']) AND status = 'placed' )
WITH CHECK ( has_role(ARRAY['manager']) AND status = 'preparing' );

CREATE POLICY "manager_served_to_billed" ON orders FOR UPDATE
USING ( has_role(ARRAY['manager']) AND status = 'served' )
WITH CHECK ( has_role(ARRAY['manager']) AND status = 'billed' );

CREATE POLICY "manager_cancel" ON orders FOR UPDATE
USING ( has_role(ARRAY['manager']) AND status IN ('placed','preparing','ready') )
WITH CHECK ( has_role(ARRAY['manager']) AND status = 'cancelled' AND cancellation_reason IS NOT NULL );

-- OWNER
CREATE POLICY "owner_all_updates" ON orders FOR UPDATE
USING ( has_role(ARRAY['owner']) )
WITH CHECK ( has_role(ARRAY['owner']) );


-- 4. Bulk Emergency Stop RPC
CREATE OR REPLACE FUNCTION public.cancel_active_orders(p_reason text, p_category text, p_order_ids uuid[] DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_table_id uuid;
  v_party_size integer;
  v_order_record record;
BEGIN
  -- 1. Validate owner role
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner') THEN
    RAISE EXCEPTION 'Only owners can perform bulk cancellation';
  END IF;

  -- 2. Process cancellations and table capacity freeing
  FOR v_order_record IN 
    SELECT id, table_id, party_size 
    FROM orders 
    WHERE status IN ('placed', 'preparing', 'ready')
      AND (p_order_ids IS NULL OR id = ANY(p_order_ids))
  LOOP
    -- Update order
    UPDATE orders 
    SET status = 'cancelled', 
        cancellation_reason = p_reason, 
        cancellation_category = p_category
    WHERE id = v_order_record.id;

    -- Free up table capacity if applicable
    IF v_order_record.table_id IS NOT NULL AND v_order_record.party_size IS NOT NULL THEN
      UPDATE restaurant_tables
      SET occupied_seats = GREATEST(0, occupied_seats - v_order_record.party_size),
          status = CASE WHEN (occupied_seats - v_order_record.party_size) <= 0 THEN 'available' ELSE 'occupied' END,
          reserved_from = NULL
      WHERE id = v_order_record.table_id;
    END IF;
  END LOOP;
END;
$$;
