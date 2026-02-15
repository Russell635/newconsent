-- Notifications: insert policy, sender tracking, delete support

DROP POLICY IF EXISTS "notifications_insert_surgeon" ON notifications;
DROP POLICY IF EXISTS "notifications_insert_manager" ON notifications;
DROP POLICY IF EXISTS "notifications_insert_authenticated" ON notifications;

CREATE POLICY "notifications_insert_authenticated"
  ON notifications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS sender_id UUID REFERENCES auth.users(id);

DROP POLICY IF EXISTS "notifications_delete_own" ON notifications;

CREATE POLICY "notifications_delete_own"
  ON notifications FOR DELETE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_select_sent" ON notifications;

CREATE POLICY "notifications_select_sent"
  ON notifications FOR SELECT
  USING (sender_id = auth.uid());
