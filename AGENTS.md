# InkTelligence workspace instructions

## Archive status

- This repository is the Ink Master archive, kept for future work. It was taken down on 2026-10-26 and is not deployed; see `README.md` for what was removed and how to resume.
- The project's tables are no longer in `t1000`. Rebuild them with `npm run db:apply` before relying on the database rules below.

## Language

- All product UI, API messages, metadata, database-facing copy, and AI responses must remain English-only.

## Database source and fallback rule

- The live `t1000` SQL database is the operational source of truth.
- SQL schema and seed data live in `scripts/database/t1000.sql`.
- `scripts/database/tattoo_database.backup.json` is the required application fallback and disaster-recovery mirror for compendium and history data.
- Every change to SQL taxonomy, style, technique, fusion, history period, history/style relation, anthropology, or library-article content must be mirrored in the JSON backup in the same change set. Never merge one without the other.
- Membership packages, roles, users, feature flags, and authentication records are SQL-only by design. Do not add them to the public JSON fallback.
- After synchronized changes, run `npm run db:generate`, `npm run db:apply`, and `npm run db:validate`.
- The generator is a deterministic rebuild tool. Review the generated SQL diff before applying it.

## Authentication

- Never reuse MySQL, operating-system, or deployment credentials for web login.
- The owner account is stored in SQL with the `super_admin` role. Its password and session signing secret live only in `.env.local`/deployment secrets.
- Public registration, billing, member accounts, and image generation remain disabled until their SQL feature flags are explicitly enabled.

## Research library rule

- The 30 corpus papers live in `data/library/` as markdown, one file per paper ID, and are the readable source of every library article.
- `articles[]` in the JSON backup is the article index (slug, editorial title, dek, curator note, tags, reading time, linked `catalogIds`). It is mirrored to the `library_articles` and `library_article_entries` SQL tables, with the paper body stored in `library_articles.body`.
- Every style and technique carries `sourcePaper`, `fieldNote`, and `keyFacts[]` (each fact labelled with an evidence label). These ride along in `source_payload`, which the compendium views expose; do not add parallel columns for them.
- `npm run db:generate` fails if any catalog entry is missing paper coverage, a field note, key facts, or a valid evidence label, and if any article file, slug, or display order is missing or duplicated.
- Article deks, titles, and catalog links are parity-checked against SQL by `npm run db:validate`.
- The public reading room is `/blog` (index) and `/blog/<slug>` (article); the same articles appear in the studio under Research Library.

## Prompt build system rule

- One design spec is resolved against the compendium once into a model-independent representation (`lib/prompt/compose.ts`), then rendered per target (`lib/prompt/render.ts`). A change of generator must never change what the design says.
- The generator registry (`image_models`) and the prompt vocabulary (`prompt_blocks`) are SQL-only operational config, seeded from `generate_t1000_sql.mjs` like membership packages and feature flags. Do not add them to the public JSON fallback.
- Adding or updating an image model is a registry row: `syntax_profile` carries the dialect (form, slot order, weighting, negatives, parameters, aspect handling, prose templates) and `capabilities` carries the limits. Adding a model must not require a change in `lib/prompt/render.ts` — if it does, the profile is missing a field.
- Retire a model with `status = 'deprecated'` rather than deleting the row; `prompt_build_renders` references it and old builds must stay readable.
- `prompt_builds` and `prompt_build_renders` are the audit trail. Every build is written back with its resolved representation and catalog references so a prompt can be reproduced instead of re-improvised.
- A `cultural_check` of `flagged` must keep refusing to build (HTTP 409). It is a guardrail, not a validation error to route around.
- The engine writes prompts only. Calling a generator stays behind the `image_generation` feature flag.

## Research corpus rule

- The planned source corpus is defined in `docs/research/research-corpus-manifest.json` and explained in `docs/research/RESEARCH_CORPUS_PLAN.md`.
- Alexei's persona may shape research questions and editorial voice, but it is never a factual citation.
- For the next compendium/history update, use only facts supported by the uploaded papers. Do not use model memory, unsupplied web sources, or the current catalog text to fill factual gaps.
- Every imported claim must retain paper ID, page/section locator, and evidence label (`direct`, `synthesized`, `community_attested`, `contested`, `hypothesis`, or `unknown`).
- Run `npm run research:validate` after changing paper-to-catalog assignments.
