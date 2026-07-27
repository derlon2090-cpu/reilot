ALTER TABLE message_queue DROP CONSTRAINT IF EXISTS message_queue_message_type_check;
ALTER TABLE message_queue ADD CONSTRAINT message_queue_message_type_check CHECK (message_type IN (
  'renewal_reminder', 'order_info_link', 'manual_order_link', 'test_message',
  'system_notification', 'interactive_message', 'campaign', 'subscription_manual_reminder',
  'salla_template', 'salla_template_test', 'custom_api'
));
