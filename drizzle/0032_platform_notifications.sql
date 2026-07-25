CREATE TABLE IF NOT EXISTS platform_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  notification_type text NOT NULL CHECK (notification_type IN (
    'general','update','maintenance','warning','security','billing','promotion','action_required'
  )),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','critical')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft','validating','scheduled','preparing','publishing','published',
    'partially_published','cancelled','failed','archived'
  )),
  audience_type text NOT NULL CHECK (audience_type IN (
    'all_users','active_users','selected_plans','selected_stores','selected_users',
    'subscription_status','integration_status','custom_filter'
  )),
  audience_filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  delivery_surfaces jsonb NOT NULL DEFAULT '["notification_center"]'::jsonb,
  delivery_strategy text NOT NULL DEFAULT 'materialized_recipients'
    CHECK (delivery_strategy IN ('materialized_recipients','broadcast_on_read')),
  action_label text,
  action_url text,
  image_url text,
  require_acknowledgement boolean NOT NULL DEFAULT false,
  dismissible boolean NOT NULL DEFAULT true,
  pinned boolean NOT NULL DEFAULT false,
  scheduled_at timestamptz,
  published_at timestamptz,
  cancelled_at timestamptz,
  archived_at timestamptz,
  expires_at timestamptz,
  estimated_recipients integer NOT NULL DEFAULT 0,
  eligible_recipients integer NOT NULL DEFAULT 0,
  created_recipients integer NOT NULL DEFAULT 0,
  failed_recipients integer NOT NULL DEFAULT 0,
  delivered_count integer NOT NULL DEFAULT 0,
  seen_count integer NOT NULL DEFAULT 0,
  read_count integer NOT NULL DEFAULT 0,
  clicked_count integer NOT NULL DEFAULT 0,
  acknowledged_count integer NOT NULL DEFAULT 0,
  created_by_admin_user_id uuid NOT NULL REFERENCES admin_users(id),
  updated_by_admin_user_id uuid REFERENCES admin_users(id),
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_notifications_surfaces_array CHECK (jsonb_typeof(delivery_surfaces) = 'array'),
  CONSTRAINT platform_notifications_filters_object CHECK (jsonb_typeof(audience_filters) = 'object')
);

CREATE TABLE IF NOT EXISTS platform_notification_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES platform_notifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL,
  delivery_status text NOT NULL DEFAULT 'available'
    CHECK (delivery_status IN ('available','withdrawn','expired')),
  delivered_at timestamptz,
  first_seen_at timestamptz,
  read_at timestamptz,
  clicked_at timestamptz,
  acknowledged_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (notification_id, user_id)
);

CREATE TABLE IF NOT EXISTS platform_notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES platform_notifications(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed','cancelled')),
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  failure_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_notification_publish_progress (
  notification_id uuid PRIMARY KEY REFERENCES platform_notifications(id) ON DELETE CASCADE,
  last_cursor uuid,
  processed_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS platform_notifications_status_idx
  ON platform_notifications (status, scheduled_at);
CREATE INDEX IF NOT EXISTS platform_notifications_created_at_idx
  ON platform_notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS platform_notification_schedule_worker_idx
  ON platform_notifications (scheduled_at) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS platform_notification_expiry_idx
  ON platform_notifications (expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS notification_recipients_user_idx
  ON platform_notification_recipients (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notification_user_unread_fast_idx
  ON platform_notification_recipients (user_id, read_at, created_at DESC);
CREATE INDEX IF NOT EXISTS notification_recipients_notification_idx
  ON platform_notification_recipients (notification_id, delivery_status);
CREATE INDEX IF NOT EXISTS platform_notification_outbox_pending_idx
  ON platform_notification_outbox (status, available_at)
  WHERE status IN ('pending','failed');
