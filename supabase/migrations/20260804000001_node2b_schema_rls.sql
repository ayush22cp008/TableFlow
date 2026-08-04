-- ============================================================
-- Node 2b: Staff Roles, Invite Codes, and RLS Overhaul
-- ============================================================

-- 1. Profiles Table Extension
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('customer', 'owner', 'waiter', 'cook', 'manager'));

-- 2. Invite Codes Table
CREATE TABLE IF NOT EXISTS invite_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(7) UNIQUE NOT NULL,
  role text NOT NULL CHECK (role IN ('waiter', 'cook', 'manager')),
  staff_name text NOT NULL,
  staff_email text NOT NULL,
  status text NOT NULL DEFAULT 'unused' CHECK (status IN ('unused', 'used', 'expired')),
  created_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;

-- Helper function to check multiple roles
CREATE OR REPLACE FUNCTION has_role(allowed_roles text[])
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = ANY(allowed_roles)
  );
$$;

-- RLS for invite_codes
CREATE POLICY "invite_codes_owner_all" ON invite_codes FOR ALL
USING (has_role(ARRAY['owner'])) WITH CHECK (has_role(ARRAY['owner']));

CREATE POLICY "invite_codes_public_read" ON invite_codes FOR SELECT
USING (true); -- needed for signup validation

-- 3. pg_cron Expiry Mechanism
-- Enable cron extension (must be run by superuser)
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION mark_expired_invite_codes()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE invite_codes 
  SET status = 'expired'
  WHERE status = 'unused' AND created_at < (now() - interval '30 minutes');
END;
$$;

CREATE OR REPLACE FUNCTION delete_expired_invite_codes()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM invite_codes WHERE status = 'expired';
END;
$$;

-- Schedule the cron jobs (runs every 5 minutes)
SELECT cron.schedule('mark_expired_invite_codes_cron', '*/5 * * * *', 'SELECT mark_expired_invite_codes();');
SELECT cron.schedule('delete_expired_invite_codes_cron', '*/5 * * * *', 'SELECT delete_expired_invite_codes();');


-- ============================================================
-- 4. RLS Policy Overhaul
-- ============================================================

-- RESTAURANT TABLES
DROP POLICY IF EXISTS "tables_public_read" ON restaurant_tables;
DROP POLICY IF EXISTS "tables_owner_write" ON restaurant_tables;

CREATE POLICY "tables_read" ON restaurant_tables FOR SELECT 
USING (true); -- Public read for status board

CREATE POLICY "tables_write" ON restaurant_tables FOR ALL
USING (has_role(ARRAY['waiter', 'manager', 'owner'])) 
WITH CHECK (has_role(ARRAY['waiter', 'manager', 'owner']));

-- MENU ITEMS
DROP POLICY IF EXISTS "menu_public_read" ON menu_items;
DROP POLICY IF EXISTS "menu_owner_write" ON menu_items;

CREATE POLICY "menu_read" ON menu_items FOR SELECT 
USING (is_available = true AND is_active = true OR has_role(ARRAY['waiter', 'cook', 'manager', 'owner']));

CREATE POLICY "menu_write" ON menu_items FOR ALL
USING (has_role(ARRAY['manager', 'owner'])) 
WITH CHECK (has_role(ARRAY['manager', 'owner']));

-- WAITLIST (Reservations)
DROP POLICY IF EXISTS "waitlist_own_read" ON waitlist;
DROP POLICY IF EXISTS "waitlist_own_insert" ON waitlist;
DROP POLICY IF EXISTS "waitlist_owner_update" ON waitlist;

CREATE POLICY "waitlist_read" ON waitlist FOR SELECT 
USING (customer_id = auth.uid() OR has_role(ARRAY['waiter', 'manager', 'owner']));

CREATE POLICY "waitlist_insert" ON waitlist FOR INSERT 
WITH CHECK (customer_id = auth.uid() OR has_role(ARRAY['waiter', 'manager', 'owner']));

CREATE POLICY "waitlist_update" ON waitlist FOR UPDATE 
USING (has_role(ARRAY['waiter', 'manager', 'owner']));

CREATE POLICY "waitlist_delete" ON waitlist FOR DELETE 
USING (has_role(ARRAY['waiter', 'manager', 'owner']));


-- ORDERS
DROP POLICY IF EXISTS "orders_own_read" ON orders;
DROP POLICY IF EXISTS "orders_own_insert" ON orders;
DROP POLICY IF EXISTS "orders_owner_update" ON orders;

-- Select: Customers (own), Waiters, Cooks, Managers, Owners
CREATE POLICY "orders_select" ON orders FOR SELECT 
USING (customer_id = auth.uid() OR has_role(ARRAY['waiter', 'cook', 'manager', 'owner']));

-- Insert: Customers only (own orders)
CREATE POLICY "orders_insert" ON orders FOR INSERT 
WITH CHECK (customer_id = auth.uid());

-- Update: Cook (Preparing -> Ready)
CREATE POLICY "orders_update_cook" ON orders FOR UPDATE
USING ( has_role(ARRAY['cook']) AND status = 'preparing' )
WITH CHECK ( has_role(ARRAY['cook']) AND status = 'ready' );

-- Update: Waiter (Ready -> Served)
CREATE POLICY "orders_update_waiter" ON orders FOR UPDATE
USING ( has_role(ARRAY['waiter']) AND status = 'ready' )
WITH CHECK ( has_role(ARRAY['waiter']) AND status = 'served' );

-- Update: Manager (Placed -> Preparing, Served -> Billed, Cancelled)
CREATE POLICY "orders_update_manager" ON orders FOR UPDATE
USING ( has_role(ARRAY['manager']) AND status IN ('placed', 'served') )
WITH CHECK ( has_role(ARRAY['manager']) AND status IN ('preparing', 'billed', 'cancelled') );

-- Update: Owner (Full update)
CREATE POLICY "orders_update_owner" ON orders FOR UPDATE
USING ( has_role(ARRAY['owner']) )
WITH CHECK ( has_role(ARRAY['owner']) );

-- Note: Customer has NO update policy, ensuring view-only access to status


-- ORDER ITEMS
DROP POLICY IF EXISTS "order_items_read" ON order_items;
DROP POLICY IF EXISTS "order_items_insert" ON order_items;

CREATE POLICY "order_items_select" ON order_items FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM orders o 
    WHERE o.id = order_id AND (o.customer_id = auth.uid() OR has_role(ARRAY['waiter', 'cook', 'manager', 'owner']))
  )
);

CREATE POLICY "order_items_insert_new" ON order_items FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM orders o 
    WHERE o.id = order_id AND (o.customer_id = auth.uid() OR has_role(ARRAY['waiter', 'manager', 'owner']))
  )
);

-- FEEDBACK
DROP POLICY IF EXISTS "feedback_read" ON feedback;

CREATE POLICY "feedback_read_new" ON feedback FOR SELECT 
USING (customer_id = auth.uid() OR has_role(ARRAY['manager', 'owner']));
