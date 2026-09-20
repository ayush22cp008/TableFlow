-- 1. Add staff_name to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS staff_name text;

-- 2. Add claim columns to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS claimed_by_cook_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS claimed_by_waiter_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 3. One-active-order indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_one_active_cook_claim
ON public.orders (claimed_by_cook_id)
WHERE claimed_by_cook_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_one_active_waiter_claim
ON public.orders (claimed_by_waiter_id)
WHERE claimed_by_waiter_id IS NOT NULL;

-- 4. Claim Cleanup Trigger
CREATE OR REPLACE FUNCTION public.trg_order_claim_cleanup()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Cook claim releases when order leaves preparing
  IF NEW.status IN ('ready', 'served', 'billed', 'cancelled') THEN
    NEW.claimed_by_cook_id = NULL;
  END IF;

  -- Waiter claim releases when order leaves ready or hasn't reached it
  IF NEW.status IN ('placed', 'preparing', 'served', 'billed', 'cancelled') THEN
    NEW.claimed_by_waiter_id = NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS order_claim_cleanup_trigger ON public.orders;
CREATE TRIGGER order_claim_cleanup_trigger
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.trg_order_claim_cleanup();

-- 5. Extend notifications type constraint
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS valid_type;
ALTER TABLE public.notifications ADD CONSTRAINT valid_type CHECK (type IN (
  'order_placed',
  'order_preparing',
  'order_ready',
  'order_served',
  'order_cancelled',
  'reservation_requested',
  'reservation_approved',
  'reservation_rejected',
  'order_claimed'
));

-- 6. Manager select policy for profiles
CREATE POLICY "profiles_manager_select" ON public.profiles
FOR SELECT USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'manager'
);

-- 7. Drop existing policies to close bypass loophole
DROP POLICY IF EXISTS "cook_prep_to_ready" ON public.orders;
DROP POLICY IF EXISTS "waiter_ready_to_served" ON public.orders;

-- 8. Claim and Complete RPCs (4 functions)
CREATE OR REPLACE FUNCTION public.claim_order_as_cook(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role text;
  v_caller_active boolean;
  v_caller_name text;
  v_order_status text;
  v_current_claim uuid;
  v_manager_id uuid;
  v_manager_count int;
BEGIN
  -- Validate caller
  SELECT role, is_active, staff_name INTO v_caller_role, v_caller_active, v_caller_name
  FROM public.profiles
  WHERE id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND OR v_caller_role != 'cook' OR v_caller_active != true THEN
    RAISE EXCEPTION 'Unauthorized or inactive Cook';
  END IF;

  -- Ensure caller has no active claim
  IF EXISTS (SELECT 1 FROM public.orders WHERE claimed_by_cook_id = auth.uid() AND status IN ('placed', 'preparing')) THEN
    RAISE EXCEPTION 'Cook already has an active claim';
  END IF;

  -- Validate order
  SELECT status, claimed_by_cook_id INTO v_order_status, v_current_claim
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order_status != 'preparing' THEN
    RAISE EXCEPTION 'Order is not in preparing state';
  END IF;

  IF v_current_claim IS NOT NULL THEN
    RAISE EXCEPTION 'Order is already claimed';
  END IF;

  -- Resolve manager
  SELECT count(*) INTO v_manager_count FROM public.profiles WHERE role = 'manager' AND is_active = true;
  IF v_manager_count != 1 THEN
    RAISE EXCEPTION 'Invalid manager configuration: exactly one active manager is required';
  END IF;

  SELECT id INTO v_manager_id FROM public.profiles WHERE role = 'manager' AND is_active = true;

  -- Update order
  UPDATE public.orders
  SET claimed_by_cook_id = auth.uid(), updated_at = now()
  WHERE id = p_order_id;

  -- Send notification
  INSERT INTO public.notifications (recipient_id, recipient_role, order_id, type, message)
  VALUES (v_manager_id, NULL, p_order_id, 'order_claimed', 'Order accepted by ' || COALESCE(v_caller_name, 'Cook'));
END;
$$;

REVOKE ALL ON FUNCTION public.claim_order_as_cook(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_order_as_cook(uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.claim_order_as_waiter(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role text;
  v_caller_active boolean;
  v_caller_name text;
  v_order_status text;
  v_current_claim uuid;
  v_manager_id uuid;
  v_manager_count int;
BEGIN
  -- Validate caller
  SELECT role, is_active, staff_name INTO v_caller_role, v_caller_active, v_caller_name
  FROM public.profiles
  WHERE id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND OR v_caller_role != 'waiter' OR v_caller_active != true THEN
    RAISE EXCEPTION 'Unauthorized or inactive Waiter';
  END IF;

  -- Ensure caller has no active claim
  IF EXISTS (SELECT 1 FROM public.orders WHERE claimed_by_waiter_id = auth.uid() AND status IN ('placed', 'preparing', 'ready')) THEN
    RAISE EXCEPTION 'Waiter already has an active claim';
  END IF;

  -- Validate order
  SELECT status, claimed_by_waiter_id INTO v_order_status, v_current_claim
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order_status != 'ready' THEN
    RAISE EXCEPTION 'Order is not in ready state';
  END IF;

  IF v_current_claim IS NOT NULL THEN
    RAISE EXCEPTION 'Order is already claimed';
  END IF;

  -- Resolve manager
  SELECT count(*) INTO v_manager_count FROM public.profiles WHERE role = 'manager' AND is_active = true;
  IF v_manager_count != 1 THEN
    RAISE EXCEPTION 'Invalid manager configuration: exactly one active manager is required';
  END IF;

  SELECT id INTO v_manager_id FROM public.profiles WHERE role = 'manager' AND is_active = true;

  -- Update order
  UPDATE public.orders
  SET claimed_by_waiter_id = auth.uid(), updated_at = now()
  WHERE id = p_order_id;

  -- Send notification
  INSERT INTO public.notifications (recipient_id, recipient_role, order_id, type, message)
  VALUES (v_manager_id, NULL, p_order_id, 'order_claimed', 'Order accepted by ' || COALESCE(v_caller_name, 'Waiter'));
END;
$$;

REVOKE ALL ON FUNCTION public.claim_order_as_waiter(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_order_as_waiter(uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.complete_order_as_cook(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role text;
  v_caller_active boolean;
  v_order_status text;
  v_current_claim uuid;
BEGIN
  -- Validate caller
  SELECT role, is_active INTO v_caller_role, v_caller_active
  FROM public.profiles
  WHERE id = auth.uid();

  IF NOT FOUND OR v_caller_role != 'cook' OR v_caller_active != true THEN
    RAISE EXCEPTION 'Unauthorized or inactive Cook';
  END IF;

  -- Validate order
  SELECT status, claimed_by_cook_id INTO v_order_status, v_current_claim
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order_status != 'preparing' THEN
    RAISE EXCEPTION 'Order is not in preparing state';
  END IF;

  IF v_current_claim != auth.uid() THEN
    RAISE EXCEPTION 'Order is not claimed by caller';
  END IF;

  -- Update order
  UPDATE public.orders
  SET status = 'ready', claimed_by_cook_id = NULL, updated_at = now()
  WHERE id = p_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_order_as_cook(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_order_as_cook(uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.complete_order_as_waiter(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role text;
  v_caller_active boolean;
  v_order_status text;
  v_current_claim uuid;
BEGIN
  -- Validate caller
  SELECT role, is_active INTO v_caller_role, v_caller_active
  FROM public.profiles
  WHERE id = auth.uid();

  IF NOT FOUND OR v_caller_role != 'waiter' OR v_caller_active != true THEN
    RAISE EXCEPTION 'Unauthorized or inactive Waiter';
  END IF;

  -- Validate order
  SELECT status, claimed_by_waiter_id INTO v_order_status, v_current_claim
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order_status != 'ready' THEN
    RAISE EXCEPTION 'Order is not in ready state';
  END IF;

  IF v_current_claim != auth.uid() THEN
    RAISE EXCEPTION 'Order is not claimed by caller';
  END IF;

  -- Update order
  UPDATE public.orders
  SET status = 'served', claimed_by_waiter_id = NULL, updated_at = now()
  WHERE id = p_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_order_as_waiter(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_order_as_waiter(uuid) TO authenticated;