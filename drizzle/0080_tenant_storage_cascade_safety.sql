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
    IF TG_TABLE_NAME = 'ai_messages' THEN
      old_size := old_size + COALESCE((
        SELECT sum(CASE WHEN (attachment->>'size') ~ '^[0-9]+$' THEN (attachment->>'size')::bigint ELSE 0 END)
          FROM jsonb_array_elements(COALESCE(OLD.attachments, '[]'::jsonb)) attachment
      ), 0);
    END IF;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    new_tenant := NEW.tenant_id;
    new_size := pg_column_size(NEW);
    IF TG_TABLE_NAME = 'ai_messages' THEN
      new_size := new_size + COALESCE((
        SELECT sum(CASE WHEN (attachment->>'size') ~ '^[0-9]+$' THEN (attachment->>'size')::bigint ELSE 0 END)
          FROM jsonb_array_elements(COALESCE(NEW.attachments, '[]'::jsonb)) attachment
      ), 0);
    END IF;
  END IF;

  -- During ON DELETE CASCADE the tenant row can already be gone. Never recreate
  -- usage for a deleted tenant, otherwise its foreign key correctly rejects it.
  IF old_tenant IS NOT NULL AND EXISTS (SELECT 1 FROM tenants WHERE id=old_tenant)
     AND (new_tenant IS NULL OR old_tenant <> new_tenant) THEN
    INSERT INTO tenant_storage_usage (tenant_id, used_bytes) VALUES (old_tenant, 0)
    ON CONFLICT (tenant_id) DO UPDATE
      SET used_bytes = GREATEST(0, tenant_storage_usage.used_bytes - old_size), updated_at = now();
  END IF;
  IF new_tenant IS NOT NULL AND EXISTS (SELECT 1 FROM tenants WHERE id=new_tenant)
     AND (old_tenant IS NULL OR old_tenant <> new_tenant) THEN
    INSERT INTO tenant_storage_usage (tenant_id, used_bytes) VALUES (new_tenant, new_size)
    ON CONFLICT (tenant_id) DO UPDATE
      SET used_bytes = tenant_storage_usage.used_bytes + new_size, updated_at = now();
  ELSIF new_tenant IS NOT NULL AND EXISTS (SELECT 1 FROM tenants WHERE id=new_tenant) THEN
    INSERT INTO tenant_storage_usage (tenant_id, used_bytes) VALUES (new_tenant, GREATEST(0, new_size - old_size))
    ON CONFLICT (tenant_id) DO UPDATE
      SET used_bytes = GREATEST(0, tenant_storage_usage.used_bytes + new_size - old_size), updated_at = now();
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION renvix_track_tenant_storage_usage() IS
  'Tracks tenant storage while remaining safe during cascading tenant deletion.';
