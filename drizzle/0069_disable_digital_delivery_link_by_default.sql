-- Existing tenants may still carry the legacy enabled value. Reset it once so
-- the digital-delivery link is opt-in for every tenant after this deployment.
UPDATE tenant_salla_templates
   SET settings = jsonb_set(
         jsonb_set(COALESCE(settings, '{}'::jsonb), '{secureLinkEnabled}', 'false'::jsonb, true),
         '{secureLinkOptIn}',
         'false'::jsonb,
         true
       ),
       version = version + 1,
       updated_at = now()
 WHERE template_key = 'digital_product_delivery'
   AND (
     (settings->>'secureLinkEnabled') IS DISTINCT FROM 'false'
     OR (settings->>'secureLinkOptIn') IS DISTINCT FROM 'false'
   );
