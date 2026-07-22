-- Restore the template-scoped public entry point. Customers first enter their
-- order number on this stable page; no individual order identifier is exposed.
UPDATE order_template_links tl
   SET status = 'active', expires_at = NULL, updated_at = now()
  FROM order_info_templates t
 WHERE tl.template_id = t.id
   AND tl.tenant_id = t.tenant_id
   AND t.is_active = true
   AND tl.status <> 'active';

UPDATE order_info_links l
   SET template_link_id = tl.id,
       public_url = tl.public_url,
       updated_at = now()
  FROM order_template_links tl
 WHERE l.template_id = tl.template_id
   AND l.tenant_id = tl.tenant_id
   AND (l.template_link_id IS DISTINCT FROM tl.id OR l.public_url IS DISTINCT FROM tl.public_url);
