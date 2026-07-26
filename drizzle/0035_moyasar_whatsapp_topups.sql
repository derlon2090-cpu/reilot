CREATE TABLE IF NOT EXISTS whatsapp_topup_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  wallet_id uuid NOT NULL REFERENCES whatsapp_wallets(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'moyasar',
  provider_invoice_id text UNIQUE,
  provider_payment_id text,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'SAR',
  status text NOT NULL DEFAULT 'creating' CHECK (
    status IN ('creating','initiated','paid','failed','expired','canceled','refunded')
  ),
  checkout_url text,
  idempotency_key text NOT NULL UNIQUE,
  provider_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  paid_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS whatsapp_topup_payments_tenant_created_idx
  ON whatsapp_topup_payments(tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS billing_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_number text NOT NULL UNIQUE,
  invoice_type text NOT NULL CHECK (invoice_type IN ('whatsapp_topup','plan_subscription')),
  provider text NOT NULL,
  provider_invoice_id text NOT NULL UNIQUE,
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'SAR',
  status text NOT NULL CHECK (status IN ('issued','paid','failed','canceled','refunded')),
  description text,
  issued_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS billing_invoices_tenant_issued_idx
  ON billing_invoices(tenant_id, issued_at DESC);
