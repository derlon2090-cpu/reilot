-- The first administrator must be created only through /admin/setup.
-- Remove the exact legacy handoff fixture without touching real administrators.
DELETE FROM users
 WHERE lower(email) = 'temporary.admin@renvix.app'
   AND name = 'مدير مؤقت'
   AND role = 'admin';
