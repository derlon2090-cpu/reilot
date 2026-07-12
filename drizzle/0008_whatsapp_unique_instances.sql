ALTER TABLE whatsapp_channels ADD COLUMN IF NOT EXISTS instance_name text;

UPDATE whatsapp_channels
SET instance_name = channel_id
WHERE instance_name IS NULL OR instance_name = '';

ALTER TABLE whatsapp_channels ALTER COLUMN instance_name SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_channels_instance_name_unique
ON whatsapp_channels(instance_name);

CREATE INDEX IF NOT EXISTS whatsapp_channels_tenant_status_idx
ON whatsapp_channels(tenant_id, status);
