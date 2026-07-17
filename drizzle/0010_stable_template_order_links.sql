CREATE TABLE IF NOT EXISTS order_template_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES order_info_templates(id) ON DELETE CASCADE UNIQUE,
  public_token text NOT NULL UNIQUE,
  public_url text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  opened_count integer NOT NULL DEFAULT 0,
  last_opened_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_template_links_status_check CHECK (status IN ('active', 'expired', 'disabled', 'archived'))
);

ALTER TABLE order_info_links
  ADD COLUMN IF NOT EXISTS template_link_id uuid REFERENCES order_template_links(id) ON DELETE CASCADE;

INSERT INTO order_template_links (
  tenant_id, template_id, public_token, public_url, status,
  opened_count, last_opened_at, expires_at, created_at, updated_at
)
SELECT DISTINCT ON (l.template_id)
  l.tenant_id,
  l.template_id,
  l.public_token,
  l.public_url,
  CASE WHEN l.status IN ('active', 'expired', 'disabled', 'archived') THEN l.status ELSE 'active' END,
  l.opened_count,
  l.last_opened_at,
  NULL,
  l.created_at,
  l.updated_at
FROM order_info_links l
WHERE l.template_id IS NOT NULL
ORDER BY l.template_id, l.updated_at DESC, l.created_at DESC
ON CONFLICT (template_id) DO NOTHING;

UPDATE order_info_links l
SET template_link_id = tl.id,
    public_url = tl.public_url,
    updated_at = now()
FROM order_template_links tl
WHERE l.template_id = tl.template_id
  AND l.tenant_id = tl.tenant_id
  AND l.template_link_id IS NULL;

CREATE TEMP TABLE order_info_link_dedup ON COMMIT DROP AS
SELECT duplicate_id, keeper_id
FROM (
  SELECT
    id AS duplicate_id,
    first_value(id) OVER (
      PARTITION BY template_link_id, subscription_id
      ORDER BY updated_at DESC, created_at DESC, id DESC
    ) AS keeper_id,
    row_number() OVER (
      PARTITION BY template_link_id, subscription_id
      ORDER BY updated_at DESC, created_at DESC, id DESC
    ) AS duplicate_rank
  FROM order_info_links
  WHERE template_link_id IS NOT NULL
) ranked
WHERE duplicate_rank > 1;

UPDATE order_link_events event
SET order_info_link_id = dedup.keeper_id
FROM order_info_link_dedup dedup
WHERE event.order_info_link_id = dedup.duplicate_id;

DELETE FROM order_info_links link
USING order_info_link_dedup dedup
WHERE link.id = dedup.duplicate_id;

CREATE INDEX IF NOT EXISTS idx_order_template_links_tenant_status
  ON order_template_links(tenant_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_template_links_public_lookup
  ON order_template_links(public_token, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_order_info_links_template_subscription
  ON order_info_links(template_link_id, subscription_id)
  WHERE template_link_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_info_links_template_order
  ON order_info_links(template_link_id, order_number, status);
