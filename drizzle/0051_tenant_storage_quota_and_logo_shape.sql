ALTER TABLE order_link_profiles
  ADD COLUMN IF NOT EXISTS logo_border_radius smallint NOT NULL DEFAULT 16;

ALTER TABLE order_link_profiles
  DROP CONSTRAINT IF EXISTS order_link_profiles_logo_border_radius_check;

ALTER TABLE order_link_profiles
  ADD CONSTRAINT order_link_profiles_logo_border_radius_check
  CHECK (logo_border_radius BETWEEN 0 AND 50);

CREATE TABLE IF NOT EXISTS tenant_storage_usage (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  used_bytes bigint NOT NULL DEFAULT 0 CHECK (used_bytes >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION renvix_track_tenant_storage_usage()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  old_tenant uuid;
  new_tenant uuid;
  old_size bigint := 0;
  new_size bigint := 0;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    old_tenant := OLD.tenant_id;
    old_size := pg_column_size(OLD);
  END IF;
  IF TG_OP <> 'DELETE' THEN
    new_tenant := NEW.tenant_id;
    new_size := pg_column_size(NEW);
  END IF;

  IF old_tenant IS NOT NULL AND (new_tenant IS NULL OR old_tenant <> new_tenant) THEN
    INSERT INTO tenant_storage_usage (tenant_id, used_bytes)
    VALUES (old_tenant, 0)
    ON CONFLICT (tenant_id) DO UPDATE
      SET used_bytes = GREATEST(0, tenant_storage_usage.used_bytes - old_size),
          updated_at = now();
  END IF;

  IF new_tenant IS NOT NULL AND (old_tenant IS NULL OR old_tenant <> new_tenant) THEN
    INSERT INTO tenant_storage_usage (tenant_id, used_bytes)
    VALUES (new_tenant, new_size)
    ON CONFLICT (tenant_id) DO UPDATE
      SET used_bytes = tenant_storage_usage.used_bytes + new_size,
          updated_at = now();
  ELSIF new_tenant IS NOT NULL THEN
    INSERT INTO tenant_storage_usage (tenant_id, used_bytes)
    VALUES (new_tenant, GREATEST(0, new_size - old_size))
    ON CONFLICT (tenant_id) DO UPDATE
      SET used_bytes = GREATEST(0, tenant_storage_usage.used_bytes + new_size - old_size),
          updated_at = now();
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  table_row record;
BEGIN
  CREATE TEMP TABLE tenant_storage_recalculation (
    tenant_id uuid PRIMARY KEY,
    used_bytes bigint NOT NULL DEFAULT 0
  ) ON COMMIT DROP;

  FOR table_row IN
    SELECT DISTINCT c.table_name
      FROM information_schema.columns c
      JOIN information_schema.tables t
        ON t.table_schema = c.table_schema
       AND t.table_name = c.table_name
     WHERE c.table_schema = 'public'
       AND c.column_name = 'tenant_id'
       AND c.table_name <> 'tenant_storage_usage'
       AND t.table_type = 'BASE TABLE'
  LOOP
    EXECUTE format(
      'INSERT INTO tenant_storage_recalculation (tenant_id, used_bytes)
       SELECT tenant_id, COALESCE(sum(pg_column_size(row_value)), 0)::bigint
         FROM %I row_value
        WHERE tenant_id IS NOT NULL
        GROUP BY tenant_id
       ON CONFLICT (tenant_id) DO UPDATE
         SET used_bytes = tenant_storage_recalculation.used_bytes + EXCLUDED.used_bytes',
      table_row.table_name
    );

    IF NOT EXISTS (
      SELECT 1
        FROM pg_trigger
       WHERE tgname = 'renvix_tenant_storage_usage_trigger'
         AND tgrelid = format('public.%I', table_row.table_name)::regclass
         AND NOT tgisinternal
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER renvix_tenant_storage_usage_trigger
           AFTER INSERT OR UPDATE OR DELETE ON %I
           FOR EACH ROW EXECUTE FUNCTION renvix_track_tenant_storage_usage()',
        table_row.table_name
      );
    END IF;
  END LOOP;

  INSERT INTO tenant_storage_usage (tenant_id, used_bytes)
  SELECT t.id, COALESCE(r.used_bytes, 0)
    FROM tenants t
    LEFT JOIN tenant_storage_recalculation r ON r.tenant_id = t.id
  ON CONFLICT (tenant_id) DO UPDATE
    SET used_bytes = EXCLUDED.used_bytes,
        updated_at = now();
END;
$$;

COMMENT ON COLUMN order_link_profiles.logo_border_radius IS
  'Tenant-selected corner radius in pixels for the store logo, constrained to 0-50.';

COMMENT ON TABLE tenant_storage_usage IS
  'Transactionally maintained tenant storage counter used to enforce plan storage limits.';
