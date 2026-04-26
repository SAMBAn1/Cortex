# Cortex — Build Handoff

Last updated: 2026-04-26

## Where things stand

- ✅ Full app built locally (dashboard, notes, calendar, graph, settings)
- ✅ Smart multi-format date parser
- ✅ Per-line edit history
- ✅ Storage abstraction with **IdbAdapter** (local) + **SupabaseAdapter** (cloud)
- ✅ Magic-link auth via Supabase (AuthGate)
- ✅ SQL migration ready at `supabase/schema.sql`
- ✅ `vercel.json` ready for SPA deploy
- ✅ Pushed to https://github.com/SAMBAn1/Cortex through commit `c60f255` (Track A)
- ⏳ One local commit (Supabase work) **not yet pushed**
- ⏳ Supabase project not yet created
- ⏳ Vercel project not yet created

## Resume checklist

### 1) Push the pending local commit

The PAT-in-command-line method is flagged in this session. Use one of:

**Option A — store the PAT once with git credential helper:**
```bash
cd /c/Users/galac/Desktop/Cortex
git config --global credential.helper store
echo "https://x-access-token:<PASTE_PAT_HERE>@github.com" > ~/.git-credentials
git push origin main
```

**Option B — set the remote URL with the PAT embedded (less secure but quick):**
```bash
cd /c/Users/galac/Desktop/Cortex
git remote set-url origin https://x-access-token:<PASTE_PAT_HERE>@github.com/SAMBAn1/Cortex.git
git push origin main
```

### 2) Create Supabase project

1. Go to https://supabase.com → sign in → **New project**
2. Name `cortex`, pick region, save DB password
3. Wait for provisioning (~2 min)
4. **Project Settings → API** → copy:
   - Project URL (e.g. `https://xxxxx.supabase.co`)
   - `anon` `public` key (long JWT)

### 3) Run the SQL migration

1. In Supabase, open **SQL Editor** → **New query**
2. Paste contents of `supabase/schema.sql`
3. Click **Run**
4. Verify tables exist under **Table Editor**: `notes`, `edits`, `versions`, `settings`

### 4) Deploy on Vercel

1. https://vercel.com → sign in with GitHub
2. **Add New → Project** → import `SAMBAn1/Cortex` (authorize Vercel for the repo)
3. Framework auto-detects as Vite. Don't change build settings.
4. **Environment Variables** add:
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = anon key
5. Click **Deploy**
6. Once green, copy the production URL (e.g. `cortex-xxx.vercel.app`)

### 5) Tell Supabase to allow the Vercel URL

1. In Supabase → **Authentication → URL Configuration**
2. **Site URL**: set to your Vercel URL
3. **Redirect URLs**: add the Vercel URL too (and `http://localhost:5173` for local dev)

### 6) Test

- Visit Vercel URL → see magic-link login screen
- Sign in → seed notes appear → edit one → confirm it persists across browsers/devices
- Open Settings → paste Anthropic API key → AI panel works

## Reference info

- **Repo**: https://github.com/SAMBAn1/Cortex (private)
- **Project path**: `C:\Users\galac\Desktop\Cortex`
- **Commit identity**: `ccc <70046077+SAMBAn1@users.noreply.github.com>`
- **Local dev**: `npm run dev` → http://localhost:5173/

## Architecture notes

### Storage layer (`src/lib/storage/`)
- `index.ts` — factory: returns `SupabaseAdapter` when env vars set, else `IdbAdapter`
- `types.ts` — `StorageAdapter` interface, `Note`, `NoteEdit`, `NoteVersion`, `AppSettings`
- `idb-adapter.ts` — IndexedDB implementation
- `supabase-adapter.ts` — Postgres-backed via @supabase/supabase-js, scoped to `auth.uid()` via RLS

### Auth (`src/components/AuthGate.tsx`)
- In cloud mode (env vars present), wraps app and shows email magic-link screen until signed in
- In local mode (no env vars), passes through immediately

### Adapters can swap freely
The IDB adapter still works locally with no Supabase. Same code, different backend. Useful for dev without internet.

## Known follow-ups (post-deploy)

- [ ] Bundle is ~1.7MB ungzipped — code-split CodeMirror, Cytoscape (removed), force-graph for faster first paint
- [ ] Add a "Migrate IDB → Supabase" button in Settings so existing local users can upload their notes
- [ ] Tauri shell for desktop install
- [ ] Recurring tasks
- [ ] Note templates
