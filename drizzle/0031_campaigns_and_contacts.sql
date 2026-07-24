CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  first_name text,
  last_name text,
  company_name text,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','salla','csv','order','api','campaign_import')),
  salla_customer_id text,
  external_reference text,
  notes text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived','blocked','merge_review')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_contacts_salla_customer
  ON contacts (tenant_id, salla_customer_id) WHERE salla_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_tenant_status_created
  ON contacts (tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_tenant_name
  ON contacts (tenant_id, lower(display_name));

CREATE TABLE IF NOT EXISTS contact_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('email','phone','whatsapp')),
  normalized_value text NOT NULL,
  display_value text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','invalid','unsubscribed','blocked','bounced','complained','suppressed')),
  consent_status text NOT NULL DEFAULT 'unknown' CHECK (consent_status IN ('granted','unknown','revoked')),
  is_primary boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, channel, normalized_value)
);

CREATE INDEX IF NOT EXISTS idx_contact_points_contact ON contact_points (tenant_id, contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_points_eligible ON contact_points (tenant_id, channel, status, consent_status);

CREATE TABLE IF NOT EXISTS contact_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  source text NOT NULL CHECK (source IN ('csv','salla','api','campaign_import')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','completed_with_errors','failed')),
  total_rows integer NOT NULL DEFAULT 0,
  imported_rows integer NOT NULL DEFAULT 0,
  duplicate_rows integer NOT NULL DEFAULT 0,
  invalid_rows integer NOT NULL DEFAULT 0,
  error_summary jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS contact_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#2563EB',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS contact_tag_assignments (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES contact_tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (contact_id, tag_id)
);

CREATE TABLE IF NOT EXISTS campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  channel text NOT NULL CHECK (channel IN ('whatsapp','email')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','validating','ready','scheduled','queueing','sending','paused','completed','cancelled','failed')),
  template_id uuid REFERENCES notification_templates(id) ON DELETE SET NULL,
  subject text,
  body text NOT NULL DEFAULT '',
  audience_filter jsonb NOT NULL DEFAULT '{}'::jsonb,
  schedule_mode text NOT NULL DEFAULT 'manual' CHECK (schedule_mode IN ('manual','now','scheduled')),
  scheduled_for timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  total_recipients integer NOT NULL DEFAULT 0,
  eligible_recipients integer NOT NULL DEFAULT 0,
  queued_count integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  delivered_count integer NOT NULL DEFAULT 0,
  read_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  reserved_credits integer NOT NULL DEFAULT 0,
  charged_credits integer NOT NULL DEFAULT 0,
  quota_period_id uuid REFERENCES message_usage_periods(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_tenant_status_created
  ON campaigns (tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaigns_schedule
  ON campaigns (status, scheduled_for) WHERE status = 'scheduled';

CREATE TABLE IF NOT EXISTS campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  contact_point_id uuid REFERENCES contact_points(id) ON DELETE SET NULL,
  contact_name_snapshot text NOT NULL,
  destination_masked text,
  destination_hash text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('whatsapp','email')),
  status text NOT NULL DEFAULT 'prepared' CHECK (status IN ('prepared','queued','processing','sent','delivered','read','failed','skipped','cancelled')),
  idempotency_key text NOT NULL,
  provider_message_id text,
  failure_code text,
  failure_message text,
  queued_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key),
  UNIQUE (campaign_id, contact_point_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_recipients_work
  ON campaign_recipients (tenant_id, campaign_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_provider
  ON campaign_recipients (provider_message_id) WHERE provider_message_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS campaign_credit_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  recipient_id uuid REFERENCES campaign_recipients(id) ON DELETE SET NULL,
  entry_type text NOT NULL CHECK (entry_type IN ('reserve','charge','release')),
  amount integer NOT NULL CHECK (amount > 0),
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS campaign_provider_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  provider text NOT NULL,
  external_event_id text NOT NULL,
  provider_message_id text,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE (provider, external_event_id)
);

INSERT INTO contacts (tenant_id, display_name, source, external_reference, status, created_at, updated_at)
SELECT c.tenant_id, c.name, 'order', 'legacy-customer:' || c.id::text,
       CASE WHEN c.status = 'inactive' THEN 'archived' ELSE 'active' END,
       c.created_at, c.updated_at
  FROM customers c
 WHERE NOT EXISTS (
   SELECT 1 FROM contacts x
    WHERE x.tenant_id = c.tenant_id AND x.external_reference = 'legacy-customer:' || c.id::text
 );

INSERT INTO contact_points (tenant_id, contact_id, channel, normalized_value, display_value, status, consent_status, is_primary, source)
SELECT c.tenant_id, x.id, 'email', lower(trim(c.email)), lower(trim(c.email)), 'active', 'unknown', true, 'order'
  FROM customers c
  JOIN contacts x ON x.tenant_id = c.tenant_id AND x.external_reference = 'legacy-customer:' || c.id::text
 WHERE nullif(trim(c.email), '') IS NOT NULL
ON CONFLICT (tenant_id, channel, normalized_value) DO NOTHING;

INSERT INTO contact_points (tenant_id, contact_id, channel, normalized_value, display_value, status, consent_status, is_primary, source)
SELECT c.tenant_id, x.id, 'whatsapp', regexp_replace(COALESCE(nullif(c.whatsapp_number,''), c.phone), '[^0-9+]', '', 'g'),
       regexp_replace(COALESCE(nullif(c.whatsapp_number,''), c.phone), '[^0-9+]', '', 'g'), 'active', 'unknown', true, 'order'
  FROM customers c
  JOIN contacts x ON x.tenant_id = c.tenant_id AND x.external_reference = 'legacy-customer:' || c.id::text
 WHERE nullif(trim(COALESCE(nullif(c.whatsapp_number,''), c.phone)), '') IS NOT NULL
ON CONFLICT (tenant_id, channel, normalized_value) DO NOTHING;
