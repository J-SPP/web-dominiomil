-- Row Level Security (RLS) Configuration for SPP Labs Database
-- This migration enables RLS, forces it on all connection roles, and defines access policies.

-- Disable RLS first to reset cleanly (making the script idempotent)
ALTER TABLE IF EXISTS websites DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS website_api_keys DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS contact_forms DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS bookings DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS support_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ai_usage_monthly DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS chatbot_knowledge DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS google_calendar_connections DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS website_dashboard_state DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS signup_tokens DISABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS websites_rls_policy ON websites;
DROP POLICY IF EXISTS website_api_keys_rls_policy ON website_api_keys;
DROP POLICY IF EXISTS contact_forms_rls_policy ON contact_forms;
DROP POLICY IF EXISTS bookings_rls_policy ON bookings;
DROP POLICY IF EXISTS notifications_rls_policy ON notifications;
DROP POLICY IF EXISTS support_requests_rls_policy ON support_requests;
DROP POLICY IF EXISTS ai_usage_monthly_rls_policy ON ai_usage_monthly;
DROP POLICY IF EXISTS chatbot_knowledge_rls_policy ON chatbot_knowledge;
DROP POLICY IF EXISTS google_calendar_connections_rls_policy ON google_calendar_connections;
DROP POLICY IF EXISTS website_dashboard_state_rls_policy ON website_dashboard_state;
DROP POLICY IF EXISTS signup_tokens_rls_policy ON signup_tokens;

-- Enable Row Level Security (RLS)
ALTER TABLE websites ENABLE ROW LEVEL SECURITY;
ALTER TABLE website_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_monthly ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_calendar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE website_dashboard_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE signup_tokens ENABLE ROW LEVEL SECURITY;

-- Force RLS on all users (including database owner/superuser)
ALTER TABLE websites FORCE ROW LEVEL SECURITY;
ALTER TABLE website_api_keys FORCE ROW LEVEL SECURITY;
ALTER TABLE contact_forms FORCE ROW LEVEL SECURITY;
ALTER TABLE bookings FORCE ROW LEVEL SECURITY;
ALTER TABLE notifications FORCE ROW LEVEL SECURITY;
ALTER TABLE support_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_monthly FORCE ROW LEVEL SECURITY;
ALTER TABLE chatbot_knowledge FORCE ROW LEVEL SECURITY;
ALTER TABLE google_calendar_connections FORCE ROW LEVEL SECURITY;
ALTER TABLE website_dashboard_state FORCE ROW LEVEL SECURITY;
ALTER TABLE signup_tokens FORCE ROW LEVEL SECURITY;

-- Create Policies

-- 1. websites table policy
-- Allows access if admin bypass is ON, or if the row ID matches app.current_website_id
CREATE POLICY websites_rls_policy ON websites
FOR ALL
USING (
  current_setting('app.bypass_rls', true) = 'on'
  OR id = NULLIF(current_setting('app.current_website_id', true), '')::uuid
);

-- 2. website_api_keys table policy
CREATE POLICY website_api_keys_rls_policy ON website_api_keys
FOR ALL
USING (
  current_setting('app.bypass_rls', true) = 'on'
  OR website_id = NULLIF(current_setting('app.current_website_id', true), '')::uuid
);

-- 3. contact_forms table policy
CREATE POLICY contact_forms_rls_policy ON contact_forms
FOR ALL
USING (
  current_setting('app.bypass_rls', true) = 'on'
  OR website_id = NULLIF(current_setting('app.current_website_id', true), '')::uuid
);

-- 4. bookings table policy
CREATE POLICY bookings_rls_policy ON bookings
FOR ALL
USING (
  current_setting('app.bypass_rls', true) = 'on'
  OR website_id = NULLIF(current_setting('app.current_website_id', true), '')::uuid
);

-- 5. notifications table policy
CREATE POLICY notifications_rls_policy ON notifications
FOR ALL
USING (
  current_setting('app.bypass_rls', true) = 'on'
  OR website_id IS NULL
  OR website_id = NULLIF(current_setting('app.current_website_id', true), '')::uuid
);

-- 6. support_requests table policy
CREATE POLICY support_requests_rls_policy ON support_requests
FOR ALL
USING (
  current_setting('app.bypass_rls', true) = 'on'
  OR website_id = NULLIF(current_setting('app.current_website_id', true), '')::uuid
);

-- 7. ai_usage_monthly table policy
CREATE POLICY ai_usage_monthly_rls_policy ON ai_usage_monthly
FOR ALL
USING (
  current_setting('app.bypass_rls', true) = 'on'
  OR website_id = NULLIF(current_setting('app.current_website_id', true), '')::uuid
);

-- 8. chatbot_knowledge table policy
CREATE POLICY chatbot_knowledge_rls_policy ON chatbot_knowledge
FOR ALL
USING (
  current_setting('app.bypass_rls', true) = 'on'
  OR website_id = NULLIF(current_setting('app.current_website_id', true), '')::uuid
);

-- 9. google_calendar_connections table policy
CREATE POLICY google_calendar_connections_rls_policy ON google_calendar_connections
FOR ALL
USING (
  current_setting('app.bypass_rls', true) = 'on'
  OR website_id = NULLIF(current_setting('app.current_website_id', true), '')::uuid
);

-- 10. website_dashboard_state table policy
CREATE POLICY website_dashboard_state_rls_policy ON website_dashboard_state
FOR ALL
USING (
  current_setting('app.bypass_rls', true) = 'on'
  OR viewer_website_id = NULLIF(current_setting('app.current_website_id', true), '')::uuid
  OR target_website_id = NULLIF(current_setting('app.current_website_id', true), '')::uuid
);

-- 11. signup_tokens table policy
-- Since it's a global table, restrict access exclusively to admins (using admin bypass)
CREATE POLICY signup_tokens_rls_policy ON signup_tokens
FOR ALL
USING (
  current_setting('app.bypass_rls', true) = 'on'
);
