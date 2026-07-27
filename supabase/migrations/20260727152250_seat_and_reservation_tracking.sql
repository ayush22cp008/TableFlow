-- Seat-level table capacity (Feature #4)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS party_size integer;
ALTER TABLE restaurant_tables ADD COLUMN IF NOT EXISTS occupied_seats integer DEFAULT 0;

-- place_order_and_occupy_table RPC (Feature #4)
CREATE OR REPLACE FUNCTION public.place_order_and_occupy_table(p_customer_id uuid, p_table_id uuid, p_subtotal numeric, p_total numeric, p_party_size integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
    v_order_id uuid;
begin
    insert into orders (customer_id, table_id, subtotal, total, status, party_size)
    values (p_customer_id, p_table_id, p_subtotal, p_total, 'placed', p_party_size)
    returning id into v_order_id;
    update restaurant_tables
    set occupied_seats = occupied_seats + p_party_size, status = 'occupied'
    where id = p_table_id;
    return v_order_id;
end;
$function$;

-- Table Reservations (Feature #5)
ALTER TABLE restaurant_tables ADD COLUMN IF NOT EXISTS reserved_from timestamptz;

CREATE TABLE IF NOT EXISTS reservation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,
  party_size integer NOT NULL,
  requested_time timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  unique_code text,
  table_id uuid REFERENCES restaurant_tables(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE reservation_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public insert" ON reservation_requests FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public select" ON reservation_requests FOR SELECT TO public USING (true);
CREATE POLICY "Allow public update" ON reservation_requests FOR UPDATE TO public USING (true);
