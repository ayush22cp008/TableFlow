-- Node 9, Step 3: Database Triggers + Realtime Wiring
-- Depends on: 20260814000001_node9_schema.sql (tables + RLS already in place)

-- ============================================================
-- PART A1: notify_order_placed (AFTER INSERT on orders)
-- ============================================================

CREATE OR REPLACE FUNCTION notify_order_placed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_table_num text;
BEGIN
  SELECT table_number::text INTO v_table_num
  FROM restaurant_tables WHERE id = NEW.table_id;

  INSERT INTO notifications (recipient_role, order_id, type, message)
  VALUES ('manager', NEW.id, 'order_placed',
    'New order placed for Table ' || COALESCE(v_table_num, '?'));

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_order_placed
AFTER INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION notify_order_placed();

-- ============================================================
-- PART A2: notify_order_status_change (AFTER UPDATE on orders)
-- ============================================================

CREATE OR REPLACE FUNCTION notify_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_table_num text;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT table_number::text INTO v_table_num
  FROM restaurant_tables WHERE id = NEW.table_id;

  IF NEW.status = 'preparing' THEN
    INSERT INTO notifications (recipient_role, order_id, type, message)
    VALUES ('cook', NEW.id, 'order_preparing',
      'Order for Table ' || COALESCE(v_table_num, '?') || ' sent to kitchen');

  ELSIF NEW.status = 'ready' THEN
    INSERT INTO notifications (recipient_role, order_id, type, message)
    VALUES ('waiter', NEW.id, 'order_ready',
      'Order for Table ' || COALESCE(v_table_num, '?') || ' is ready to serve');

  ELSIF NEW.status = 'served' THEN
    INSERT INTO notifications (recipient_role, order_id, type, message)
    VALUES ('manager', NEW.id, 'order_served',
      'Order for Table ' || COALESCE(v_table_num, '?') || ' served, pending billing');

  ELSIF NEW.status = 'cancelled' THEN
    -- Manager always notified on cancel
    INSERT INTO notifications (recipient_role, order_id, type, message)
    VALUES ('manager', NEW.id, 'order_cancelled',
      'Order for Table ' || COALESCE(v_table_num, '?') || ' cancelled');

    -- Fan-out based on status at time of cancellation
    IF OLD.status = 'preparing' THEN
      INSERT INTO notifications (recipient_role, order_id, type, message)
      VALUES ('cook', NEW.id, 'order_cancelled',
        'Order for Table ' || COALESCE(v_table_num, '?') || ' cancelled');
    ELSIF OLD.status = 'ready' THEN
      INSERT INTO notifications (recipient_role, order_id, type, message)
      VALUES ('waiter', NEW.id, 'order_cancelled',
        'Order for Table ' || COALESCE(v_table_num, '?') || ' cancelled');
    END IF;
    -- OLD.status = 'placed': manager only, per locked mapping -- no extra insert.
    -- Customer notification: skipped -- no customer-auth notification channel in schema.
    -- Deferred indefinitely per Chat 17 decision.
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_order_status_change
AFTER UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION notify_order_status_change();

-- ============================================================
-- PART A3: notify_reservation_requested (AFTER INSERT on reservation_requests)
-- ============================================================

CREATE OR REPLACE FUNCTION notify_reservation_requested()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO notifications (recipient_role, reservation_id, type, message)
  VALUES ('manager', NEW.id, 'reservation_requested',
    'New reservation request from ' || NEW.customer_name);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_reservation_requested
AFTER INSERT ON reservation_requests
FOR EACH ROW
EXECUTE FUNCTION notify_reservation_requested();

-- ============================================================
-- PART A4: notify_reservation_status_change (AFTER UPDATE on reservation_requests)
-- ============================================================

CREATE OR REPLACE FUNCTION notify_reservation_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'approved' THEN
    INSERT INTO notifications (recipient_role, reservation_id, type, message)
    VALUES ('manager', NEW.id, 'reservation_approved',
      'Reservation approved for ' || NEW.customer_name);
  ELSIF NEW.status = 'rejected' THEN
    INSERT INTO notifications (recipient_role, reservation_id, type, message)
    VALUES ('manager', NEW.id, 'reservation_rejected',
      'Reservation rejected for ' || NEW.customer_name);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_reservation_status_change
AFTER UPDATE ON reservation_requests
FOR EACH ROW
EXECUTE FUNCTION notify_reservation_status_change();

-- ============================================================
-- PART B: Enable Realtime Replication on notifications
-- ============================================================
-- NOTE: Run this separately in Supabase SQL Editor if migration runner
-- does not have publication access. Verify in Dashboard -> Database -> Replication.

ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
