# Ink Master — archive

Ink Master (InkTelligence) is an AI tattoo design consultant built around the Alexei "Inkseer" Novak persona. It includes a SQL-backed tattoo style and technique compendium, a research library published at `/blog`, a studio, and a model-independent prompt builder.

**Status: archived on 2026-10-26 for future work.** It is not deployed. `test.galczynski.guru` now serves an empty placeholder page.

## Removed from the server on archiving

- The app files, `node_modules`, the `.next` build and `.env.local` (OpenAI key, owner password, session secret). No backup was kept.
- The project's 31 tables and 5 views in the shared `t1000` database. The `gr_*`, `office_vertex_*`, `panel_*` and `tc_*` tables belong to other tools and were left untouched. Consultation sessions and prompt builds stored there were not kept.
- The T1000 project card (`/var/www/admin-panel/projects/tatoo`) and the T1001 workspace bridge (`/var/www/tatoo`).

## Resuming work

1. Clone this repository and run `npm install`.
2. Copy `.env.example` to `.env.local` and set a new OpenAI key, owner password and `AUTH_SECRET`.
3. Run `npm run db:apply` to recreate the schema and seed data in `t1000` from `scripts/database/t1000.sql`, then `npm run db:validate`.
4. Run `npm run build` and `npm start`. `ecosystem.config.cjs` holds the earlier PM2 setup (port 3019).

`AGENTS.md` describes the data rules the project was built under.
