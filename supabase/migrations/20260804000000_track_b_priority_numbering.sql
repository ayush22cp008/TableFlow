-- Migration: Track B - Priority and Numbering

-- 1. Add columns to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_priority BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS daily_number INTEGER;

-- 2. Create sequence counter table
CREATE TABLE IF NOT EXISTS daily_order_counters (
    counter_date DATE PRIMARY KEY,
    priority_count INTEGER NOT NULL DEFAULT 0,
    walkin_count INTEGER NOT NULL DEFAULT 0
);

-- 3. Replace RPC place_order_and_occupy_table with atomic sequence generation
CREATE OR REPLACE FUNCTION public.place_order_and_occupy_table(
    p_customer_id uuid,
    p_table_id uuid,
    p_subtotal numeric,
    p_total numeric,
    p_party_size integer,
    p_is_priority boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
    v_order_id uuid;
    v_daily_number integer;
begin
    -- Atomically get the next number for today
    insert into daily_order_counters (counter_date, priority_count, walkin_count)
    values (current_date, 
            case when p_is_priority then 1 else 0 end, 
            case when p_is_priority then 0 else 1 end)
    on conflict (counter_date) do update
    set priority_count = daily_order_counters.priority_count + (case when p_is_priority then 1 else 0 end),
        walkin_count = daily_order_counters.walkin_count + (case when p_is_priority then 0 else 1 end)
    returning 
        case when p_is_priority then priority_count else walkin_count end 
    into v_daily_number;

    -- Insert order with the assigned number
    insert into orders (customer_id, table_id, subtotal, total, status, party_size, is_priority, daily_number)
    values (p_customer_id, p_table_id, p_subtotal, p_total, 'placed', p_party_size, p_is_priority, v_daily_number)
    returning id into v_order_id;
    
    -- Update table status
    update restaurant_tables
    set occupied_seats = occupied_seats + p_party_size, status = 'occupied'
    where id = p_table_id;
    
    return v_order_id;
end;
$function$;
