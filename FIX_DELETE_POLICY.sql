-- ============================================
-- FIX: Add DELETE policy for sessions table
-- ============================================
-- This allows hosts to delete their own sessions
-- 
-- INSTRUCTIONS:
-- 1. Go to your Supabase dashboard
-- 2. Click "SQL Editor" in the left sidebar
-- 3. Click "New query"
-- 4. Copy and paste the SQL below
-- 5. Click "Run" (or press Ctrl+Enter / Cmd+Enter)
-- 6. You should see: "Success. No rows returned"
-- ============================================

CREATE POLICY "Hosts can delete their sessions"
ON sessions FOR DELETE
USING (auth.uid() = host_id);
