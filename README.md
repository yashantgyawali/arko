# arko

Everyone votes. The room decides what plays next.

A room-based group music voting app: one host plays music from their laptop,
everyone else joins on their phone with a 4-character code, searches/queues
songs, and votes **Nein** (skip) or **Ahoy** (keep) on whatever's currently
playing. Built with Next.js + Supabase (Postgres, Realtime, anonymous auth) —
free to run and fully multiplayer.

## Setup

1. **Install deps**

   ```bash
   npm install
   ```

2. **Enable anonymous sign-in** (required — the app has no signup/login screen,
   everyone gets an anonymous Supabase session when they open the app):

   Supabase dashboard → this project → **Authentication → Sign In / Providers
   → Anonymous Sign-Ins** → toggle **on**. There's no API for this, it has to
   be flipped in the dashboard once.

3. **(Optional) YouTube Data API v3 key**, for real search — without it, the
   "Add a song" screen falls back to a small built-in demo catalog so the app
   is still fully runnable.

   - Create a key at [console.cloud.google.com](https://console.cloud.google.com),
     enable "YouTube Data API v3".
   - Put it in `.env.local` as `YOUTUBE_API_KEY`.
   - Also set `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API) so search
     results get cached server-side — the free quota is 10k units/day and
     each search costs 100, so caching matters.

4. **Run it**

   ```bash
   npm run dev
   ```

   `.env.local` is already pointed at the `arko` Supabase project (schema,
   RLS, and realtime are already applied).

## How it works

- **Host**: `/host/new` → create a room (name + skip rule) → `/host/[code]`,
  a console with the YouTube player, queue, stats, and a "Skip now" override.
- **Guest**: `/join` → room code + name → `/room/[code]`, tabs for Now
  playing / Add a song / Room (leaderboard).
- Voting, the queue, and points are all resolved **server-side** (Postgres
  functions + a trigger on `votes`), so concurrent votes from multiple phones
  don't race each other into skipping a song twice.
- Playback is host-only via the YouTube IFrame API; guests only ever see a
  read-only progress bar.

See [`src/lib/room-context.tsx`](src/lib/room-context.tsx) for the realtime
subscriptions and the Supabase migrations applied to the `arko` project for
the full schema and game logic (`create_room`, `join_room`, `cast_vote`,
`add_to_queue`, `host_skip`, `mark_now_playing_finished`, …).

## Deploying

Any Next.js host works (Vercel's free tier is a good fit). Set the same env
vars there (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
optionally `YOUTUBE_API_KEY` / `SUPABASE_SERVICE_ROLE_KEY`).
