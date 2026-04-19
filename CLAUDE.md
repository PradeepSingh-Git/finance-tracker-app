# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development

No build step required. Open `index.html` directly in a browser, or use a local server to avoid CORS issues with the Anthropic API:

```bash
npx serve .
```

Deployed to Vercel as a static site (`vercel.json` configures `@vercel/static`).

## Architecture

Vanilla HTML/CSS/JS SPA with no bundler or npm dependencies. Chart.js 4.4 and Supabase JS v2 are loaded via CDN. Data persists to Supabase (Postgres).

**Script load order** (defined in `index.html`): Supabase CDN → Chart.js → `auth.js` → `data.js` → `charts.js` → `upload.js` → `app.js`

**Module responsibilities:**

- `auth.js` — Supabase client init, setup/login/register/logout UI, auth state management. On authenticated startup it switches to the dashboard immediately, then loads holdings and rerenders. Supabase URL + anon key are stored in `localStorage` under `sb_url` / `sb_key`. Sign-out is optimistic: local session state is cleared immediately, then Supabase sign-out is attempted in the background.
- `data.js` — Single source of truth: `holdings[]` array, async CRUD functions (`addHolding`, `deleteHolding`, `loadHoldings`) backed by Supabase, and aggregate computations (`netWorth()`, `totalAssets()`, `totalLiabilities()`). Currency formatting via `fmt()` (currently `de-DE`/€).
- `app.js` — Tab routing (`switchTab()`), dashboard rendering (`renderDashboard()`), and holdings table with search/filter. `addEntry()` and `removeHolding()` are async.
- `charts.js` — Chart.js wrappers: pie (asset allocation), line (6-month trend), bar (by institution).
- `upload.js` — Anthropic Messages API integration for document scanning. Sends the uploaded image plus `EXTRACTION_PROMPT`, then populates an editable form before saving. `saveExtracted()` is async.

**Data flow:** user configures Supabase URL/key → authenticates via Supabase Auth → dashboard shell renders immediately → holdings fetched from Supabase DB (RLS ensures per-user isolation) → user adds via form or AI scan → saved to Supabase → in-memory `holdings[]` updated → dashboard aggregates recomputed and charts re-rendered.

## Supabase Setup

Run this SQL in your Supabase project (SQL Editor):

```sql
create table holdings (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  type text not null,
  institution text not null,
  value numeric not null,
  notes text default '',
  created_at timestamptz default now()
);

alter table holdings enable row level security;

create policy "Users manage own holdings"
  on holdings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

## Key Details

- The Anthropic API key is not currently collected in-app. For self-hosting, either add the required Anthropic headers in `upload.js` or proxy the request through a backend endpoint.
- The AI extraction prompt is in `upload.js` — edit it to change what fields are extracted from documents.
- Chart colors cycle through a fixed 6-color array in `charts.js`.
- The 6-month trend line chart uses placeholder/simulated historical data.
