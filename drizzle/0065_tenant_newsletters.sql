CREATE TABLE IF NOT EXISTS newsletter_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  public_id text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES newsletter_profiles(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  email_normalized text NOT NULL,
  subscribed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, email_normalized)
);

CREATE INDEX IF NOT EXISTS newsletter_profiles_public_id_idx
  ON newsletter_profiles(public_id) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS newsletter_subscribers_customer_idx
  ON newsletter_subscribers(customer_id);
