CREATE TABLE IF NOT EXISTS ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'محادثة جديدة',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived','deleted')),
  summary text,
  is_pinned boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','tool','system')),
  content text NOT NULL DEFAULT '',
  segments jsonb NOT NULL DEFAULT '[]'::jsonb,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('pending','streaming','completed','interrupted','failed')),
  model text,
  provider text,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_tool_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  message_id uuid REFERENCES ai_messages(id) ON DELETE SET NULL,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_name text NOT NULL,
  sanitized_input jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL CHECK (status IN ('started','completed','failed','denied')),
  duration_ms integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_usage_daily (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  usage_date date NOT NULL DEFAULT current_date,
  model text NOT NULL DEFAULT 'unknown',
  input_tokens bigint NOT NULL DEFAULT 0,
  output_tokens bigint NOT NULL DEFAULT 0,
  request_count integer NOT NULL DEFAULT 0,
  tool_calls integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  total_latency_ms bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id,user_id,usage_date,model)
);

CREATE TABLE IF NOT EXISTS account_intelligence_profiles (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  health_score smallint NOT NULL DEFAULT 0 CHECK (health_score BETWEEN 0 AND 100),
  growth_score smallint NOT NULL DEFAULT 0 CHECK (growth_score BETWEEN 0 AND 100),
  renewal_health smallint NOT NULL DEFAULT 0 CHECK (renewal_health BETWEEN 0 AND 100),
  communication_health smallint NOT NULL DEFAULT 0 CHECK (communication_health BETWEEN 0 AND 100),
  integration_health smallint NOT NULL DEFAULT 0 CHECK (integration_health BETWEEN 0 AND 100),
  campaign_health smallint NOT NULL DEFAULT 0 CHECK (campaign_health BETWEEN 0 AND 100),
  customer_retention_score smallint NOT NULL DEFAULT 0 CHECK (customer_retention_score BETWEEN 0 AND 100),
  current_risks jsonb NOT NULL DEFAULT '[]'::jsonb,
  current_opportunities jsonb NOT NULL DEFAULT '[]'::jsonb,
  unresolved_issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommended_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  profile_version integer NOT NULL DEFAULT 1,
  last_analyzed_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS account_anomalies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  title text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE TABLE IF NOT EXISTS ai_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  type text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  reason text,
  impact text,
  confidence text NOT NULL DEFAULT 'medium' CHECK (confidence IN ('low','medium','high')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  source_metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  action jsonb NOT NULL DEFAULT '{}'::jsonb,
  dismissed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_conversations_tenant_user_last_idx
  ON ai_conversations (tenant_id,user_id,last_message_at DESC)
  WHERE status <> 'deleted';
CREATE INDEX IF NOT EXISTS ai_messages_conversation_created_idx
  ON ai_messages (conversation_id,created_at);
CREATE INDEX IF NOT EXISTS ai_messages_tenant_user_created_idx
  ON ai_messages (tenant_id,user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS ai_tool_executions_tenant_created_idx
  ON ai_tool_executions (tenant_id,created_at DESC);
CREATE INDEX IF NOT EXISTS account_anomalies_tenant_active_idx
  ON account_anomalies (tenant_id,severity,detected_at DESC)
  WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS ai_recommendations_tenant_active_idx
  ON ai_recommendations (tenant_id,priority,created_at DESC)
  WHERE dismissed_at IS NULL AND completed_at IS NULL;
