CREATE SEQUENCE IF NOT EXISTS support_ticket_number_seq;

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT NOT NULL UNIQUE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  requester_email TEXT NOT NULL,
  type TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'NEW',
  priority TEXT NOT NULL DEFAULT 'NORMAL',
  assigned_admin_user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'dashboard',
  user_unread_count INTEGER NOT NULL DEFAULT 0,
  admin_unread_count INTEGER NOT NULL DEFAULT 1,
  first_response_at TIMESTAMPTZ,
  last_user_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_admin_message_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  reopened_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT support_ticket_type_check CHECK (type IN ('INQUIRY','TECHNICAL_ISSUE','SUGGESTION','COMPLAINT','BILLING','INTEGRATION','ACCOUNT','OTHER')),
  CONSTRAINT support_ticket_status_check CHECK (status IN ('NEW','OPEN','IN_PROGRESS','WAITING_FOR_USER','WAITING_FOR_SUPPORT','RESOLVED','CLOSED','REOPENED')),
  CONSTRAINT support_ticket_priority_check CHECK (priority IN ('LOW','NORMAL','HIGH','URGENT'))
);

CREATE TABLE IF NOT EXISTS support_ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL,
  sender_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  sender_admin_user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  is_internal_note BOOLEAN NOT NULL DEFAULT FALSE,
  read_by_user_at TIMESTAMPTZ,
  read_by_admin_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT support_message_sender_check CHECK (sender_type IN ('USER','ADMIN','SYSTEM'))
);

CREATE TABLE IF NOT EXISTS support_ticket_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  message_id UUID REFERENCES support_ticket_messages(id) ON DELETE CASCADE,
  storage_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  original_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  sha256 TEXT NOT NULL,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by_admin_user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS support_ticket_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by_type TEXT NOT NULL,
  changed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  changed_by_admin_user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS support_reply_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_admin_user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS support_tickets_tenant_updated_idx ON support_tickets(tenant_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS support_tickets_admin_queue_idx ON support_tickets(status, priority, updated_at DESC);
CREATE INDEX IF NOT EXISTS support_messages_ticket_created_idx ON support_ticket_messages(ticket_id, created_at);
CREATE INDEX IF NOT EXISTS support_attachments_ticket_idx ON support_ticket_attachments(ticket_id);
