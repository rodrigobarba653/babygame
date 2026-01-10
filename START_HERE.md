# 🎮 How to Start the Gender Reveal Game (Super Simple Guide)

## ✅ STEP 1: Open Terminal

- On Mac: Press `Cmd + Space`, type "Terminal", press Enter
- On Windows: Press `Win + R`, type "cmd", press Enter

## ✅ STEP 2: Go to Your Project Folder

Copy and paste this into Terminal:

```bash
cd /Users/rodrigo/Documents/bbgame
```

Press Enter.

## ✅ STEP 3: Install Packages (Do This Once)

Copy and paste this:

```bash
npm install
```

Press Enter. Wait 1-2 minutes. You'll see "added 394 packages" when done.

## ✅ STEP 4: Start the App

Copy and paste this:

```bash
npm run dev
```

Press Enter.
✅ **You should see:** `✓ Ready` and `Local: http://localhost:3000`

**Keep this window open!** Don't close it.

## ✅ STEP 5: Open Your Browser

1. Open Chrome, Firefox, or Safari
2. Go to: **http://localhost:3000**
3. You should see a pink login page! 🎉

---

## ⚠️ STEP 6: Set Up Database (Required Before Testing)

**You MUST do this step or the app won't work!**

### 6A. Go to Supabase Dashboard

1. Go to https://supabase.com/dashboard
2. Sign in and find your project (the one with keys you gave me)
3. Click on your project to open it

### 6B. Open SQL Editor

1. Look at the left sidebar
2. Click **"SQL Editor"** (it has a database icon)

### 6C. Create New Query

1. Click the **"New query"** button (top right, or green button)

### 6D. Copy and Paste This SQL Code

Copy ALL of this code (scroll to see it all):

```sql
-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  relationship TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
  code TEXT PRIMARY KEY,
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  status TEXT DEFAULT 'lobby',
  winner_id UUID REFERENCES auth.users(id)
);

-- Enable RLS on sessions
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sessions
CREATE POLICY "Authenticated users can view sessions"
  ON sessions FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Hosts can insert sessions"
  ON sessions FOR INSERT
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Hosts can update their sessions"
  ON sessions FOR UPDATE
  USING (auth.uid() = host_id);

-- Add winner_id column if it doesn't exist (migration)
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS winner_id UUID REFERENCES auth.users(id);
```

### 6E. Run the SQL

1. Click the **"Run"** button (or press `Ctrl+Enter` / `Cmd+Enter`)
2. ✅ You should see: "Success. No rows returned" - that's good!

### 6F. Set Up Auth Redirect URL

1. In Supabase, click **"Authentication"** in the left sidebar
2. Click **"URL Configuration"**
3. Under "Redirect URLs", click **"+ Add URL"**
4. Type: `http://localhost:3000/auth/callback`
5. Click **"Save"**

---

## ✅ STEP 7: Test the App!

1. Go back to your browser: **http://localhost:3000**
2. You should see the login page
3. Enter your email address
4. Click "Send Magic Link"
5. Check your email inbox
6. Click the magic link in the email
7. You'll be redirected back and can create your profile!

---

## 🎯 Quick Test Checklist

- [ ] Terminal shows "Ready" and "localhost:3000"
- [ ] Browser opens http://localhost:3000
- [ ] You see a pink login page
- [ ] Database tables created in Supabase (check SQL Editor)
- [ ] Auth redirect URL added in Supabase
- [ ] You can log in with magic link
- [ ] You can create a profile

---

## 🆘 Troubleshooting

**"Cannot find module" error?**
→ Run `npm install` again

**"Port 3000 already in use"?**
→ Something else is using port 3000. Close it or change the port in `package.json`

**Login page shows error?**
→ Check that database tables are created (Step 6)

**Magic link doesn't work?**
→ Make sure you added `http://localhost:3000/auth/callback` to Supabase Auth settings (Step 6F)

---

**That's it! You're ready to play! 🎉**
