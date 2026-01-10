-- Add the missing winner_id column to your existing sessions table
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS winner_id UUID REFERENCES auth.users(id);

-- Optional: If you want to update your update policy to allow updating winner_id
-- (Your existing policy should already work, but here's an explicit one if needed)
-- Note: You might want to replace your existing update policy with this:
DROP POLICY IF EXISTS "Host can update session" ON sessions;

CREATE POLICY "Host can update session"
ON sessions FOR UPDATE
TO authenticated
USING (auth.uid() = host_id)
WITH CHECK (auth.uid() = host_id);


