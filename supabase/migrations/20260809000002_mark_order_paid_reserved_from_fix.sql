-- Migration: Fix Mark Order Paid RPC for Reservation Table Release
-- Description: Conditionally clears reserved_from when table is fully released to fix the purple reserved UI bug.

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
  END IF;
END;
$$;
