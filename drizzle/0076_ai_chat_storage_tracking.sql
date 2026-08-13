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

COMMENT ON TABLE ai_conversations IS
  'Renvix Intelligence conversations included in tenant plan storage and eligible for user-controlled cleanup.';
