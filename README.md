# One Thing Journal

A free, mobile-first time-tracking journal. Name the one thing that matters most,
plan your day, track estimated versus actual time, and watch your estimation
accuracy grow. A complimentary tool from ListWithRalph.com.

Stack: React + Vite, Supabase (Postgres, Auth, Row Level Security), deployed on
Vercel with GitHub auto-deploy.

## What is in this repo

- `index.html`, `vite.config.js`, `package.json`: Vite project shell.
- `src/main.jsx`: entry point.
- `src/App.jsx`: React shell. Handles the landing page, auth (email/password,
  Google, and forgot-password reset), the password-recovery screen, session, and
  loading your data from Supabase. When you are signed in it mounts the app engine.
- `src/engine.js`: the approved One Thing Journal experience (Today, Journal,
  Guide, Profile, bottom nav, the move-to-another-day sheet, and the
  install-to-home-screen card). It runs on your live Supabase data and saves
  changes back, debounced.
- `src/supabase.js`: Supabase client plus auth and data helpers.
- `src/assets.js`: signature image and the default daily quotes.
- `src/index.css`: the full design system and component styles.
- `public/`: app icons, web manifest, and self-hosted fonts.
- `schema.sql`: database tables, Row Level Security policies, and the signup
  trigger that seeds each new user's defaults. Run this once in Supabase.

A note on architecture: the React shell owns auth and data, and it mounts the
proven app logic as a self-contained engine, so the screens stay pixel-identical
to the approved mockup. If you ever want it refactored into component-level JSX,
that is a clean follow-up.

## Deploy order

### 1. Domain
Plan to serve the app at `onething.listwithralph.com` (a subdomain you will point
at Vercel in step 5). Nothing to do yet beyond having access to your DNS.

### 2. GitHub
Create a new repo and add every file from this project (paste each file in the
GitHub web UI). Do not commit `.env`; it is already in `.gitignore`.

### 3. Supabase
1. Create a new Supabase project.
2. Open Database, then SQL editor, then New query. Paste all of `schema.sql` and
   run it. This creates the `profiles` and `entries` tables, turns on Row Level
   Security, and installs the signup trigger.
3. Enable Google sign-in: Authentication, then Providers, then Google. Turn it on
   and add your Google OAuth client ID and secret (created in the Google Cloud
   console, with the Supabase callback URL as an authorized redirect URI).
4. Set your URLs: Authentication, then URL configuration.
   - Site URL: `https://onething.listwithralph.com`
   - Redirect URLs: add both your Vercel preview URL and
     `https://onething.listwithralph.com`. These are needed for Google sign-in and
     for the forgot-password reset link to return to the app.
5. Copy two values from Project settings, then API:
   - Project URL
   - The legacy anon public key (the long token that starts with `eyJ`). Use this
     one, not the newer `sb_publishable_...` key.

### 4. Vercel
1. Import the GitHub repo. Vercel detects Vite automatically.
2. Add two environment variables (Project settings, then Environment variables):
   - `VITE_SUPABASE_URL` = your Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY` = the legacy anon key from step 3.5
3. Deploy.

### 5. Test, then custom domain
1. Open the Vercel preview URL. Create an account, confirm email if confirmation
   is on, then sign in. Add a task, switch tabs, refresh: your data should persist.
2. Verify the deployed build tag:
   `curl -s https://YOUR-VERCEL-URL/assets/index-*.js | grep app-phase1-v1`
   You can also open the browser console and read `window.__OTJ_BUILD`.
3. Add the custom domain in Vercel (`onething.listwithralph.com`) and create the
   matching CNAME in your DNS. Once it resolves, confirm the Supabase Site URL and
   Redirect URLs from step 3.4 include the custom domain.

## Good to know

- Data sync: edits save to Supabase automatically, debounced about 0.6s after you
  stop typing or tapping.
- Passwords: changed only through the secure Forgot-password reset flow, so the
  Profile screen does not store or show a password.
- Email: shown read-only on the Profile screen, since it is your sign-in identity.
- The signup trigger seeds Saturday as the rest day and your default quotes. You
  can change both on the Profile screen.

## Local development (optional)

```
npm install
# create a .env with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev
```
