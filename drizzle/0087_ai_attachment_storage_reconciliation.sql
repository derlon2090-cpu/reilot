-- Count private object bytes exactly once from ai_attachments. Message JSON is
-- presentation metadata and must not duplicate the same R2 object size.
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
    IF TG_TABLE_NAME = 'ai_attachments' THEN
      old_size := old_size + COALESCE(OLD.size_bytes,0);
    END IF;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    new_tenant := NEW.tenant_id;
    new_size := pg_column_size(NEW);
    IF TG_TABLE_NAME = 'ai_attachments' THEN
      new_size := new_size + COALESCE(NEW.size_bytes,0);
    END IF;
  END IF;

  IF old_tenant IS NOT NULL AND EXISTS (SELECT 1 FROM tenants WHERE id=old_tenant)
     AND (new_tenant IS NULL OR old_tenant <> new_tenant) THEN
    INSERT INTO tenant_storage_usage(tenant_id,used_bytes) VALUES(old_tenant,0)
    ON CONFLICT(tenant_id) DO UPDATE
      SET used_bytes=GREATEST(0,tenant_storage_usage.used_bytes-old_size),updated_at=now();
  END IF;
  IF new_tenant IS NOT NULL AND EXISTS (SELECT 1 FROM tenants WHERE id=new_tenant)
     AND (old_tenant IS NULL OR old_tenant <> new_tenant) THEN
    INSERT INTO tenant_storage_usage(tenant_id,used_bytes) VALUES(new_tenant,new_size)
    ON CONFLICT(tenant_id) DO UPDATE
      SET used_bytes=tenant_storage_usage.used_bytes+new_size,updated_at=now();
  ELSIF new_tenant IS NOT NULL AND EXISTS (SELECT 1 FROM tenants WHERE id=new_tenant) THEN
    INSERT INTO tenant_storage_usage(tenant_id,used_bytes) VALUES(new_tenant,GREATEST(0,new_size-old_size))
    ON CONFLICT(tenant_id) DO UPDATE
      SET used_bytes=GREATEST(0,tenant_storage_usage.used_bytes+new_size-old_size),updated_at=now();
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS renvix_tenant_storage_usage_trigger ON ai_attachments;
CREATE TRIGGER renvix_tenant_storage_usage_trigger
AFTER INSERT OR UPDATE OR DELETE ON ai_attachments
FOR EACH ROW EXECUTE FUNCTION renvix_track_tenant_storage_usage();

-- Repair any historical drift using the same single-source calculation.
DO $$
DECLARE table_row record;
BEGIN
  CREATE TEMP TABLE tenant_storage_recalculation(
    tenant_id uuid PRIMARY KEY,
    used_bytes bigint NOT NULL DEFAULT 0
  ) ON COMMIT DROP;

  FOR table_row IN
    SELECT DISTINCT c.table_name
      FROM information_schema.columns c
      JOIN information_schema.tables t ON t.table_schema=c.table_schema AND t.table_name=c.table_name
     WHERE c.table_schema='public' AND c.column_name='tenant_id'
       AND c.table_name<>'tenant_storage_usage' AND t.table_type='BASE TABLE'
  LOOP
    IF table_row.table_name='ai_attachments' THEN
      EXECUTE format(
        'INSERT INTO tenant_storage_recalculation(tenant_id,used_bytes)
         SELECT tenant_id,COALESCE(sum(pg_column_size(row_value)+size_bytes),0)::bigint
           FROM %I row_value WHERE tenant_id IS NOT NULL GROUP BY tenant_id
         ON CONFLICT(tenant_id) DO UPDATE SET used_bytes=tenant_storage_recalculation.used_bytes+EXCLUDED.used_bytes',
        table_row.table_name
      );
    ELSE
      EXECUTE format(
        'INSERT INTO tenant_storage_recalculation(tenant_id,used_bytes)
         SELECT tenant_id,COALESCE(sum(pg_column_size(row_value)),0)::bigint
           FROM %I row_value WHERE tenant_id IS NOT NULL GROUP BY tenant_id
         ON CONFLICT(tenant_id) DO UPDATE SET used_bytes=tenant_storage_recalculation.used_bytes+EXCLUDED.used_bytes',
        table_row.table_name
      );
    END IF;
  END LOOP;

  INSERT INTO tenant_storage_usage(tenant_id,used_bytes)
  SELECT tenant.id,COALESCE(recalculated.used_bytes,0)
    FROM tenants tenant LEFT JOIN tenant_storage_recalculation recalculated ON recalculated.tenant_id=tenant.id
  ON CONFLICT(tenant_id) DO UPDATE SET used_bytes=EXCLUDED.used_bytes,updated_at=now();
END;
$$;

COMMENT ON FUNCTION renvix_track_tenant_storage_usage() IS
  'Tracks PostgreSQL row bytes and each private R2 object size exactly once through ai_attachments.';
