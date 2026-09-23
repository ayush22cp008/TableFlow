CREATE TABLE public.push_subscriptions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    endpoint text not null unique,
    p256dh text not null,
    auth text not null,
    user_agent text null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    last_success_at timestamptz null,
    last_failure_at timestamptz null,
    failure_reason text null,
    is_active boolean not null default true
);

CREATE INDEX idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own push subscriptions" ON public.push_subscriptions
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own push subscriptions" ON public.push_subscriptions
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own push subscriptions" ON public.push_subscriptions
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own push subscriptions" ON public.push_subscriptions
FOR DELETE USING (auth.uid() = user_id);
CREATE TABLE public.push_delivery_dedup (
    notification_id uuid not null,
    subscription_id uuid not null,
    created_at timestamptz not null default now(),
    primary key (notification_id, subscription_id)
);

ALTER TABLE public.push_delivery_dedup ENABLE ROW LEVEL SECURITY;
