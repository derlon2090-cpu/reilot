-- Renvix Storage Center: tenant-scoped folders, flexible documents, private
-- object metadata, encrypted vault fields, activity, and upload reservations.

CREATE TABLE IF NOT EXISTS storage_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES storage_folders(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  description text,
  system_type text CHECK (system_type IS NULL OR system_type IN ('images')),
  is_system boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CHECK ((is_system AND system_type IS NOT NULL AND parent_id IS NULL) OR (NOT is_system AND system_type IS NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS storage_folders_system_type_unique
  ON storage_folders(tenant_id, system_type)
  WHERE is_system AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS storage_folders_root_name_unique
  ON storage_folders(tenant_id, lower(name))
  WHERE parent_id IS NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS storage_folders_child_name_unique
  ON storage_folders(tenant_id, parent_id, lower(name))
  WHERE parent_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS storage_folders_parent_idx
  ON storage_folders(tenant_id, parent_id, updated_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS storage_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  folder_id uuid REFERENCES storage_folders(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 180),
  type text NOT NULL CHECK (type IN ('note','account','code','custom')),
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  size_bytes bigint NOT NULL DEFAULT 0 CHECK (size_bytes >= 0),
  is_favorite boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS storage_documents_folder_idx
  ON storage_documents(tenant_id, folder_id, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS storage_documents_search_idx
  ON storage_documents(tenant_id, lower(title)) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS storage_account_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL UNIQUE REFERENCES storage_documents(id) ON DELETE CASCADE,
  account_name text NOT NULL,
  email_encrypted jsonb,
  password_encrypted jsonb,
  code_encrypted jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS storage_document_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES storage_documents(id) ON DELETE CASCADE,
  label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 100),
  value_encrypted jsonb NOT NULL,
  position integer NOT NULL DEFAULT 0 CHECK (position >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS storage_document_fields_document_idx
  ON storage_document_fields(document_id, position);

CREATE TABLE IF NOT EXISTS storage_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  folder_id uuid NOT NULL REFERENCES storage_folders(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 180),
  original_name text NOT NULL,
  mime_type text NOT NULL CHECK (mime_type IN ('image/jpeg','image/png','image/webp')),
  extension text NOT NULL CHECK (extension IN ('jpg','jpeg','png','webp')),
  size_bytes bigint NOT NULL CHECK (size_bytes > 0),
  storage_key text NOT NULL UNIQUE,
  width integer CHECK (width IS NULL OR width > 0),
  height integer CHECK (height IS NULL OR height > 0),
  status text NOT NULL DEFAULT 'uploading' CHECK (status IN ('uploading','ready','failed')),
  upload_expires_at timestamptz,
  object_etag text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS storage_assets_expired_upload_idx
  ON storage_assets(upload_expires_at) WHERE status='uploading';
CREATE INDEX IF NOT EXISTS storage_assets_folder_idx
  ON storage_assets(tenant_id, folder_id, updated_at DESC) WHERE deleted_at IS NULL;

ALTER TABLE tenant_salla_template_images
  ADD COLUMN IF NOT EXISTS storage_asset_id uuid REFERENCES storage_assets(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS tenant_salla_template_images_storage_asset_idx
  ON tenant_salla_template_images(tenant_id,storage_asset_id) WHERE storage_asset_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS storage_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('UPLOAD_IMAGE','CREATE_FOLDER','CREATE_DOCUMENT','UPDATE_DOCUMENT','MOVE_ITEM','DELETE_ITEM','RESTORE_ITEM','RENAME_ITEM')),
  resource_type text NOT NULL CHECK (resource_type IN ('folder','document','asset')),
  resource_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS storage_activity_recent_idx
  ON storage_activity(tenant_id, created_at DESC);

CREATE OR REPLACE FUNCTION renvix_create_images_folder()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO storage_folders(tenant_id,name,system_type,is_system)
  VALUES(NEW.id,'الصور','images',true)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS renvix_tenant_images_folder_trigger ON tenants;
CREATE TRIGGER renvix_tenant_images_folder_trigger
AFTER INSERT ON tenants FOR EACH ROW EXECUTE FUNCTION renvix_create_images_folder();

-- Preserve existing content when an older tenant already created a root
-- folder with the reserved Arabic name before this module was introduced.
UPDATE storage_folders candidate
   SET is_system=true,system_type='images',updated_at=now()
 WHERE candidate.parent_id IS NULL
   AND candidate.deleted_at IS NULL
   AND lower(candidate.name)=lower('الصور')
   AND NOT EXISTS (
     SELECT 1 FROM storage_folders system_folder
      WHERE system_folder.tenant_id=candidate.tenant_id
        AND system_folder.system_type='images'
        AND system_folder.is_system=true
        AND system_folder.deleted_at IS NULL
   );

INSERT INTO storage_folders(tenant_id,name,system_type,is_system)
SELECT id,'الصور','images',true FROM tenants
ON CONFLICT DO NOTHING;

-- Object bytes are counted in addition to their PostgreSQL metadata. Uploading
-- rows therefore act as an atomic quota reservation and ready rows as usage.
CREATE OR REPLACE FUNCTION renvix_track_tenant_storage_usage()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE old_tenant uuid; new_tenant uuid; old_size bigint := 0; new_size bigint := 0;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    old_tenant := OLD.tenant_id;
    old_size := pg_column_size(OLD);
    IF TG_TABLE_NAME IN ('ai_attachments','storage_assets','storage_documents') THEN old_size := old_size + COALESCE(OLD.size_bytes,0); END IF;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    new_tenant := NEW.tenant_id;
    new_size := pg_column_size(NEW);
    IF TG_TABLE_NAME IN ('ai_attachments','storage_assets','storage_documents') THEN new_size := new_size + COALESCE(NEW.size_bytes,0); END IF;
  END IF;
  IF old_tenant IS NOT NULL AND EXISTS(SELECT 1 FROM tenants WHERE id=old_tenant)
     AND (new_tenant IS NULL OR old_tenant <> new_tenant) THEN
    INSERT INTO tenant_storage_usage(tenant_id,used_bytes) VALUES(old_tenant,0)
    ON CONFLICT(tenant_id) DO UPDATE SET used_bytes=GREATEST(0,tenant_storage_usage.used_bytes-old_size),updated_at=now();
  END IF;
  IF new_tenant IS NOT NULL AND EXISTS(SELECT 1 FROM tenants WHERE id=new_tenant)
     AND (old_tenant IS NULL OR old_tenant <> new_tenant) THEN
    INSERT INTO tenant_storage_usage(tenant_id,used_bytes) VALUES(new_tenant,new_size)
    ON CONFLICT(tenant_id) DO UPDATE SET used_bytes=tenant_storage_usage.used_bytes+new_size,updated_at=now();
  ELSIF new_tenant IS NOT NULL AND EXISTS(SELECT 1 FROM tenants WHERE id=new_tenant) THEN
    INSERT INTO tenant_storage_usage(tenant_id,used_bytes) VALUES(new_tenant,GREATEST(0,new_size-old_size))
    ON CONFLICT(tenant_id) DO UPDATE SET used_bytes=GREATEST(0,tenant_storage_usage.used_bytes+new_size-old_size),updated_at=now();
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE table_name_value text;
BEGIN
  FOREACH table_name_value IN ARRAY ARRAY['storage_folders','storage_documents','storage_assets','storage_activity'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS renvix_tenant_storage_usage_trigger ON %I', table_name_value);
    EXECUTE format('CREATE TRIGGER renvix_tenant_storage_usage_trigger AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION renvix_track_tenant_storage_usage()', table_name_value);
  END LOOP;
END;
$$;

-- Reconcile after the system-folder backfill so every tenant starts from an
-- exact counter. Private object bytes and document payload bytes are added once.
DO $$
DECLARE table_row record; size_expression text;
BEGIN
  CREATE TEMP TABLE storage_center_recalculation(tenant_id uuid PRIMARY KEY,used_bytes bigint NOT NULL DEFAULT 0) ON COMMIT DROP;
  FOR table_row IN
    SELECT DISTINCT c.table_name FROM information_schema.columns c
    JOIN information_schema.tables t ON t.table_schema=c.table_schema AND t.table_name=c.table_name
    WHERE c.table_schema='public' AND c.column_name='tenant_id' AND c.table_name<>'tenant_storage_usage' AND t.table_type='BASE TABLE'
  LOOP
    size_expression := CASE WHEN table_row.table_name IN ('ai_attachments','storage_assets','storage_documents')
      THEN 'pg_column_size(row_value)+COALESCE(size_bytes,0)' ELSE 'pg_column_size(row_value)' END;
    EXECUTE format(
      'INSERT INTO storage_center_recalculation(tenant_id,used_bytes)
       SELECT tenant_id,COALESCE(sum(%s),0)::bigint FROM %I row_value WHERE tenant_id IS NOT NULL GROUP BY tenant_id
       ON CONFLICT(tenant_id) DO UPDATE SET used_bytes=storage_center_recalculation.used_bytes+EXCLUDED.used_bytes',
      size_expression,table_row.table_name
    );
  END LOOP;
  INSERT INTO tenant_storage_usage(tenant_id,used_bytes)
  SELECT t.id,COALESCE(r.used_bytes,0) FROM tenants t LEFT JOIN storage_center_recalculation r ON r.tenant_id=t.id
  ON CONFLICT(tenant_id) DO UPDATE SET used_bytes=EXCLUDED.used_bytes,updated_at=now();
END;
$$;

COMMENT ON TABLE storage_folders IS 'Nested tenant folders; every tenant owns one immutable system images folder.';
COMMENT ON COLUMN storage_assets.storage_key IS 'Private R2/S3-compatible object key; never a public URL.';
