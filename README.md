# my-metrics

An invite-only web app for logging personal measurements over time (height, weight, waist and so on) and sharing the tracking with family and friends.

- [spec.md](spec.md): what the product does
- [features.md](features.md): feature overview
- [tech.md](tech.md): how it's built
- [plan.md](plan.md): build order, one step at a time

## Requirements

- Node.js 26 LTS (see `.nvmrc`; 22.22 is the minimum)
- pnpm 10 (`npm i -g pnpm@10`, or `corepack enable pnpm`)
- Docker Desktop, for the local Supabase stack. On Windows it needs WSL 2 (`wsl --install` in an admin terminal, then restart)

## Getting started

```sh
pnpm install
pnpm db:start                 # local Supabase in Docker; prints the URL and keys
cp .env.example .env.local    # fill in VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
pnpm db:reset                 # apply migrations and seed.sql
pnpm dev                      # app at http://localhost:5173
```

Log in with one of the demo accounts from `supabase/seed.sql`: `alex@example.com`, `sam@example.com` or `kim@example.com`, password `password` (local only).

Local Supabase also runs:

- **Studio**, a database UI: http://127.0.0.1:54323
- **Mailpit**, which catches every email the app sends (e.g. password resets) instead of delivering it: http://127.0.0.1:54324

After changing `supabase/config.toml` or an email template, restart with `pnpm db:stop && pnpm db:start`. After adding a migration, run `pnpm db:reset`.

## Scripts

| Script | What it does |
|---|---|
| `pnpm dev` | Start the dev server |
| `pnpm build` | Type-check and build to `dist/` |
| `pnpm preview` | Serve the production build locally |
| `pnpm lint` / `pnpm typecheck` | ESLint / TypeScript |
| `pnpm format` / `pnpm format:check` | Prettier |
| `pnpm test` / `pnpm test:watch` | Unit and component tests (Vitest) |
| `pnpm e2e` | End-to-end tests (Playwright; needs local Supabase running; run `pnpm exec playwright install chromium` once) |
| `pnpm db:start` / `pnpm db:stop` | Start / stop local Supabase |
| `pnpm db:reset` | Recreate the local database from migrations and seed |
| `pnpm db:test` | Database and RLS tests (pgTAP) |
| `pnpm db:types` | Regenerate `src/types/database.ts` from the local schema |

## Project layout

```
src/
  app/            routes, layout, providers, theme
  features/       one folder per feature (groups, profile, ...)
  components/ui/  shadcn/ui components
  lib/            Supabase client, query client, utils
  types/          generated database types
supabase/
  config.toml     local Supabase settings (sign-ups disabled, see spec FR-1)
  migrations/     SQL migrations, the source of truth for the schema
  functions/      Edge Functions
  tests/          pgTAP tests
  seed.sql        local demo data
e2e/              Playwright tests
```
