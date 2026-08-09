-- Migration: Proper Reservation Lifecycle Status
-- Description: Adds cleanup for stale 'approved' reservation requests by transitioning them to 'cancelled' when a table is released.

-- 1. Data cleanup migration (Backfill)
UPDATE reservation_requests
SET status = 'cancelled'
FROM restaurant_tables
WHERE reservation_requests.table_id = restaurant_tables.id
  AND reservation_requests.status = 'approved'
  AND coalesce(restaurant_tables.occupied_seats, 0) = 0
  AND restaurant_tables.reserved_from IS NULL;

-- 2. Update mark_order_paid RPC
CREATE OR REPLACE FUNCTION public.mark_order_paid(p_order_id uuid, p_payment_method text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_record record;
BEGIN
  -- Fetch the order details
  SELECT id, table_id, party_size INTO v_order_record
  FROM orders 
  WHERE id = p_order_id AND status = 'served';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found or not in served status';
  END IF;

  -- Update order status and payment method
  UPDATE orders 
  SET status = 'billed', 
      payment_method = p_payment_method, 
      updated_at = now()
  WHERE id = p_order_id;

  -- Free up table capacity if applicable
  IF v_order_record.table_id IS NOT NULL AND v_order_record.party_size IS NOT NULL THEN
    UPDATE restaurant_tables
    SET occupied_seats = GREATEST(0, occupied_seats - v_order_record.party_size),
        status = CASE WHEN (occupied_seats - v_order_record.party_size) <= 0 THEN 'available' ELSE 'occupied' END,
        reserved_from = CASE WHEN (occupied_seats - v_order_record.party_size) <= 0 THEN NULL ELSE reserved_from END
    WHERE id = v_order_record.table_id;
    
    -- Cleanup approved reservation requests if table is fully released
    IF (SELECT coalesce(occupied_seats, 0) FROM restaurant_tables WHERE id = v_order_record.table_id) <= 0 THEN
       UPDATE reservation_requests 
       SET status = 'cancelled' 
       WHERE table_id = v_order_record.table_id AND status = 'approved';
    END IF;
  END IF;
END;
$$;


-- 3. Update cancel_active_orders RPC
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

      -- Cleanup approved reservation requests if table is fully released
      IF (SELECT coalesce(occupied_seats, 0) FROM restaurant_tables WHERE id = v_order_record.table_id) <= 0 THEN
        UPDATE reservation_requests
        SET status = 'cancelled'
        WHERE table_id = v_order_record.table_id AND status = 'approved';
      END IF;
    END IF;
  END LOOP;
END;
$$;
