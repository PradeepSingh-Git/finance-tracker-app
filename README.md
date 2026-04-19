# Finance Tracker

A personal finance dashboard to track investments, savings, debts, and loans across all institutions — with AI-powered document scanning via the Claude API.

## Features

- Manual entry of investments, savings accounts, credit cards, and loans
- Supabase-backed auth with per-user data isolation
- AI document scanning (upload a photo of a bank statement or brokerage report)
- Dashboard with net worth, asset allocation donut chart, trend line, and institution bar chart
- Filter & search all holdings
- Holdings persist in Supabase; Supabase project URL and anon key are stored locally for reconnect

## Project structure

```
finance-tracker/
├── index.html          # App shell & markup
├── vercel.json         # Vercel deployment config
├── .gitignore
├── README.md
└── src/
    ├── auth.js         # Supabase setup, auth UI, sign-in / sign-out flow
    ├── styles.css      # All CSS (variables, layout, components)
    ├── data.js         # Holdings state, CRUD, aggregates, formatting
    ├── charts.js       # Chart.js renderers (pie, line, bar)
    ├── upload.js       # File upload + Anthropic API call
    └── app.js          # Tab routing, dashboard, forms, holdings table
```

## Local development

No build step required. Just open `index.html` in a browser:

```bash
# macOS / Linux
open index.html

# Or use a simple dev server (recommended to avoid CORS issues with the API)
npx serve .
# then visit http://localhost:3000
```

## Supabase setup

On first launch, the app asks for:

- Supabase project URL
- Supabase anon/public key

Those values are stored in `localStorage` as `sb_url` and `sb_key`. User holdings are stored in the Supabase `holdings` table, not in browser storage.

Run this SQL in Supabase:

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

## Deploy to Vercel

### Option A — Vercel CLI

```bash
npm i -g vercel
cd finance-tracker
vercel
```

### Option B — GitHub integration (recommended)

1. Push this folder to a GitHub repository
2. Go to [vercel.com](https://vercel.com) → New Project → Import your repo
3. Framework preset: **Other** (static site)
4. Root directory: leave as-is (or point to `finance-tracker/` if nested)
5. Click **Deploy**

## API key for AI scanning

The AI document scanning feature calls the Anthropic Messages API from `src/upload.js`.

When self-hosting you have two options:

**Option 1 — Client-side (quick, not recommended for production)**  
Edit `src/upload.js` and add your key to the fetch headers:
```js
headers: {
  'Content-Type': 'application/json',
  'x-api-key': 'sk-ant-YOUR_KEY_HERE',         // add this line
  'anthropic-version': '2023-06-01',
  'anthropic-dangerous-direct-browser-access': 'true',
},
```

**Option 2 — Server-side proxy (recommended)**  
Create a small backend endpoint (e.g. a Vercel serverless function in `/api/analyze.js`) that forwards requests to the Anthropic API with your key stored in a Vercel environment variable. Update the `ANTHROPIC_API_URL` constant in `upload.js` to point to `/api/analyze`.

## Customisation tips (Claude Code)

| What to change | Where |
|---|---|
| Currency symbol / locale | `data.js` → `fmt()` function |
| Chart colours | `charts.js` → `CHART_COLORS` array |
| Add new entry types | `data.js`, `index.html` selects, `styles.css` badges |
| Historical trend data | `charts.js` → `renderLineChart()` |
| AI extraction prompt | `upload.js` → `EXTRACTION_PROMPT` |
| Auth / startup flow | `auth.js` |

## Tech stack

- Vanilla HTML / CSS / JavaScript (zero build tooling)
- [Supabase JS v2](https://supabase.com/docs/reference/javascript/installing) via CDN
- [Chart.js 4.4](https://www.chartjs.org/) via CDN
- [Anthropic Claude API](https://docs.anthropic.com) for document scanning
