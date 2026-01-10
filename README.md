# Gender Reveal Party Game

A real-time multiplayer party game built with Next.js 14, TypeScript, Tailwind CSS, and Supabase. Supports up to 10 players per session with trivia and Pictionary games, culminating in a winner-only gender reveal.

## Features

- 🔐 Magic Link Authentication via Supabase
- 👤 User Profiles (name + relationship)
- 🎮 Multiplayer Game Sessions (2-10 players)
- 📝 Trivia Game (8 hardcoded questions)
- 🎨 Pictionary Game (turn-based drawing & guessing)
- 📊 Live Scoreboard with real-time updates
- 🎉 Winner-Only Gender Reveal
- ⚡ Real-time synchronization using Supabase Realtime (Presence + Broadcast)

## Tech Stack

- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Backend:** Supabase (Auth + Postgres + Realtime)
- **Deployment:** Vercel (free tier compatible)

## Prerequisites

- Node.js 18+ installed
- A Supabase account (free tier works)
- npm or yarn package manager

## Supabase Setup

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the project to be provisioned (takes ~2 minutes)

### 2. Database Setup

Run the following SQL in the Supabase SQL Editor:

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

### 3. Enable Realtime

1. Go to **Database** → **Replication** in your Supabase dashboard
2. Enable replication for both `profiles` and `sessions` tables (or use Realtime Broadcast/Presence APIs which don't require replication)

**Note:** This app uses Supabase Realtime's Presence and Broadcast features, which work via channels and don't require table replication. The channels are created programmatically in the code.

### 4. Configure Auth Redirect URL

1. Go to **Authentication** → **URL Configuration**
2. Add your redirect URL:
   - **Development:** `http://localhost:3000/auth/callback`
   - **Production:** `https://your-domain.vercel.app/auth/callback`

## Local Development

### 1. Clone and Install

```bash
# Navigate to project directory
cd bbgame

# Install dependencies
npm install
```

### 2. Environment Variables

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

You can find these values in your Supabase project settings:
- Go to **Settings** → **API**
- Copy the **Project URL** (NEXT_PUBLIC_SUPABASE_URL)
- Copy the **anon/public** key (NEXT_PUBLIC_SUPABASE_ANON_KEY)

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment to Vercel

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin your-github-repo-url
git push -u origin main
```

### 2. Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **New Project**
3. Import your GitHub repository
4. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Click **Deploy**

### 3. Update Supabase Redirect URL

After deployment, add your Vercel URL to Supabase Auth redirect URLs:
- Go to **Authentication** → **URL Configuration**
- Add: `https://your-app.vercel.app/auth/callback`

## Game Flow

1. **Login:** Users authenticate via magic link email
2. **Profile:** First-time users create a profile (name + relationship)
3. **Dashboard:** Host creates a session or players join by code
4. **Lobby:** Players join and wait (minimum 2, maximum 10)
5. **Trivia:** 8 questions with 15-second timers each
6. **Pictionary:** 5 rounds of drawing and guessing (20s draw, 15s guess)
7. **Results:** Final leaderboard displayed
8. **Reveal:** Only the winner sees the gender reveal ("It's a Boy!!!!!!!!")

## Architecture

### Host-Authoritative Model

- The host client manages game state and broadcasts `ROOM_STATE` to all players
- Non-host clients submit actions (answers, guesses) via broadcast messages
- Host validates and updates scores, then broadcasts updated state
- All clients render UI based on the canonical `ROOM_STATE`

### Real-time Synchronization

- **Presence:** Tracks connected players in the lobby and during games
- **Broadcast:** Sends game events (answers, guesses, strokes) and state updates
- **Channel:** One channel per session: `room:<CODE>`

### State Management

- Room state is maintained in the host client (`hostStateRef`)
- Broadcast on every major transition and score update
- Non-host clients receive and render state updates
- Timer sync uses `startedAt` timestamp + duration (clients compute remaining time locally)

## File Structure

```
bbgame/
├── app/
│   ├── api/
│   │   └── reveal/
│   │       └── route.ts          # Winner reveal API endpoint
│   ├── auth/
│   │   └── callback/
│   │       └── route.ts          # Supabase auth callback
│   ├── dashboard/
│   │   └── page.tsx              # Create/join sessions
│   ├── login/
│   │   └── page.tsx              # Magic link login
│   ├── profile/
│   │   └── page.tsx              # User profile setup
│   ├── session/
│   │   └── [code]/
│   │       └── page.tsx          # Main game session page
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                  # Root redirect
├── components/
│   ├── Leaderboard.tsx           # Scoreboard display
│   ├── Lobby.tsx                 # Pre-game lobby
│   ├── Pictionary.tsx            # Drawing game component
│   ├── Reveal.tsx                # Winner reveal screen
│   ├── Results.tsx               # Final results
│   ├── Timer.tsx                 # Countdown timer
│   └── Trivia.tsx                # Trivia game component
├── data/
│   ├── prompts.ts                # Pictionary word prompts
│   └── trivia.ts                 # Trivia questions
├── lib/
│   ├── database.types.ts         # TypeScript DB types
│   ├── realtime/
│   │   └── types.ts              # Realtime message types
│   ├── supabaseClient.ts         # Browser Supabase client
│   ├── supabaseServer.ts         # Server Supabase client
│   └── utils.ts                  # Utility functions
├── middleware.ts                 # Auth middleware
├── next.config.js
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

## Game Rules

### Trivia
- 8 questions total
- 15 seconds per question
- +1 point for correct answer
- 3-second reveal phase after each question

### Pictionary
- 5 rounds (or 1 full cycle if <5 players)
- Turn order locked at game start
- Draw phase: 20 seconds
- Guess phase: 15 seconds
- +2 points for correct guess (awarded to guesser)
- Drawer selects winner from guess list

### Winner Determination
- Highest total points
- Tie-breaker: earliest `joinedAt` timestamp

## Security Notes

- Row Level Security (RLS) enabled on all tables
- Only authenticated users can join sessions
- Only hosts can create/update sessions
- Only the winner can access the reveal API endpoint
- Session expiration: 2 hours from creation
- Maximum 10 players per session enforced

## Troubleshooting

### "Session not found" error
- Check that the session code is correct (4 uppercase letters)
- Verify the session hasn't expired (2-hour limit)
- Ensure the session status is not 'ended'

### Realtime not syncing
- Check Supabase dashboard for active connections
- Verify environment variables are set correctly
- Check browser console for WebSocket errors
- Ensure you're using the correct channel name format: `room:<CODE>`

### Drawing not working
- Ensure you're the current drawer (check phase and turn)
- Try refreshing the page if canvas appears frozen
- Check browser console for JavaScript errors

### Auth redirect issues
- Verify redirect URL is added in Supabase dashboard
- Check that `NEXT_PUBLIC_SUPABASE_URL` matches your project URL
- Ensure magic link email isn't blocked by spam filters

## License

This project is provided as-is for demonstration purposes.

