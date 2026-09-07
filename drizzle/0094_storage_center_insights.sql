-- Storage Center UX: pinned folders, duplicate detection, recent files and
-- generic private files (PDF/Office/text/archives) alongside images.

ALTER TABLE storage_folders
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;

ALTER TABLE storage_folders DROP CONSTRAINT IF EXISTS storage_folders_system_type_check;
ALTER TABLE storage_folders
  ADD CONSTRAINT storage_folders_system_type_check CHECK (system_type IS NULL OR system_type IN ('images','files'));

UPDATE storage_folders candidate
   SET is_system=true,system_type='files',updated_at=now()
 WHERE candidate.parent_id IS NULL AND candidate.deleted_at IS NULL
   AND lower(candidate.name)=lower('الملفات')
   AND NOT EXISTS (
     SELECT 1 FROM storage_folders system_folder
      WHERE system_folder.tenant_id=candidate.tenant_id AND system_folder.system_type='files'
        AND system_folder.is_system=true AND system_folder.deleted_at IS NULL
   );

INSERT INTO storage_folders(tenant_id,name,system_type,is_system)
SELECT id,'الملفات','files',true FROM tenants
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION renvix_create_images_folder()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO storage_folders(tenant_id,name,system_type,is_system)
  VALUES
    (NEW.id,'الصور','images',true),
    (NEW.id,'الملفات','files',true)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

ALTER TABLE storage_documents
  ADD COLUMN IF NOT EXISTS last_opened_at timestamptz;

ALTER TABLE storage_assets
  ADD COLUMN IF NOT EXISTS content_hash text,
  ADD COLUMN IF NOT EXISTS last_opened_at timestamptz;

ALTER TABLE storage_assets DROP CONSTRAINT IF EXISTS storage_assets_mime_type_check;
ALTER TABLE storage_assets DROP CONSTRAINT IF EXISTS storage_assets_extension_check;
ALTER TABLE storage_assets DROP CONSTRAINT IF EXISTS storage_assets_content_hash_check;
ALTER TABLE storage_assets
  ADD CONSTRAINT storage_assets_mime_type_check CHECK (mime_type IN (
    'image/jpeg','image/png','image/webp','application/pdf','text/plain','text/csv',
    'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip'
  )),
  ADD CONSTRAINT storage_assets_extension_check CHECK (extension IN (
    'jpg','jpeg','png','webp','pdf','txt','csv','doc','docx','xls','xlsx','zip'
  )),
  ADD CONSTRAINT storage_assets_content_hash_check CHECK (
    content_hash IS NULL OR content_hash ~ '^[0-9a-f]{64}$'
  );

CREATE INDEX IF NOT EXISTS storage_folders_pinned_idx
  ON storage_folders(tenant_id,is_pinned DESC,updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS storage_documents_recent_idx
  ON storage_documents(tenant_id,last_opened_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS storage_assets_recent_idx
  ON storage_assets(tenant_id,last_opened_at DESC) WHERE deleted_at IS NULL AND status='ready';
CREATE INDEX IF NOT EXISTS storage_assets_duplicate_idx
  ON storage_assets(tenant_id,content_hash,size_bytes,mime_type)
  WHERE deleted_at IS NULL AND status='ready' AND content_hash IS NOT NULL;
