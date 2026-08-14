-- Node 9 Notifications Schema (As specified in authoritative Claude Spec)

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_role text CHECK (recipient_role IN ('waiter', 'cook', 'manager')),
  recipient_id uuid REFERENCES profiles(id),
  order_id uuid REFERENCES orders(id),
  type text NOT NULL, 
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT one_target_only CHECK (
    (recipient_role IS NOT NULL AND recipient_id IS NULL) OR
    (recipient_role IS NULL AND recipient_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_role ON notifications(recipient_role) WHERE recipient_role IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_id ON notifications(recipient_id) WHERE recipient_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS notification_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id),
  read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (notification_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_reads_user ON notification_reads(user_id);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select" ON notifications FOR SELECT
USING (
  recipient_id = auth.uid()
  OR (recipient_role = 'waiter' AND has_role(ARRAY['waiter']))
  OR (recipient_role = 'cook' AND has_role(ARRAY['cook']))
  OR (recipient_role = 'manager' AND has_role(ARRAY['manager']))
);

CREATE POLICY "notification_reads_select" ON notification_reads FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "notification_reads_insert" ON notification_reads FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Gap Resolution v2 additions
ALTER TABLE notifications ADD CONSTRAINT valid_type CHECK (type IN (
  'order_placed',
  'order_preparing',
  'order_ready',
  'order_served',
  'order_cancelled',
  'reservation_requested',
  'reservation_approved',
  'reservation_rejected'
));

ALTER TABLE notifications ADD COLUMN reservation_id uuid REFERENCES reservation_requests(id);
