-- ============================================
-- FIX 1: Add missing winner_id column to sessions
-- ============================================
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS winner_id UUID REFERENCES auth.users(id);

-- ============================================
-- FIX 2: Update profiles SELECT policy to allow viewing all profiles
-- (This allows the app to show player names in the game)
-- ============================================
-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;

-- Create new policy that allows viewing all profiles
CREATE POLICY "Users can view all profiles"
ON profiles FOR SELECT
USING (true);


