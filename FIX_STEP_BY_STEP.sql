-- STEP 1: Add missing winner_id column to sessions (SAFE - no warnings)
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS winner_id UUID REFERENCES auth.users(id);

-- STEP 2: First, create the new policy with a different name (SAFE)
CREATE POLICY "Users can view all profiles"
ON profiles FOR SELECT
USING (true);

-- STEP 3: Now drop the old one (this will show a warning, but it's safe)
-- Only run this AFTER step 2 works
-- DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;


