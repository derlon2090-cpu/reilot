CREATE TABLE IF NOT EXISTS in_app_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  type text NOT NULL,
  title text NOT NULL,
  message text,
  entity_type text,
  entity_id uuid,
  priority text NOT NULL DEFAULT 'normal',
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  action_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS in_app_notifications_tenant_created_idx
  ON in_app_notifications(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS in_app_notifications_tenant_unread_idx
  ON in_app_notifications(tenant_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS in_app_notifications_entity_idx
  ON in_app_notifications(tenant_id, entity_type, entity_id);

CREATE UNIQUE INDEX IF NOT EXISTS in_app_notifications_dedupe_unique
  ON in_app_notifications(tenant_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;
