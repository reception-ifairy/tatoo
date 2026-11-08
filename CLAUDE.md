# CLAUDE.md — Ötzi Signal

AI tattoo design studio. Built on `reception-ifairy/template` (Express + Vite + React 19 + Tailwind 4 + TypeScript) with the knowledge of the Ink Master archive (this repo's history before November 2026: persona, compendium, research library, prompt engine). Read `HANDOFF.md` first (project state), then this file.

- **Assistant:** Ötzi — the full Alexei "Inkseer" persona under a new name. His biography is private memory: it shapes him, he never tells it (`content/persona/otzi.json`, `server/persona.ts`).
- **Accounts:** one super admin (credentials in `.env`) + client accounts the admin creates. Clients get a **package** (limits per output kind); no payments in the app.
- **Language:** everything is English. Only the super admin can switch the UI and Ötzi's replies to Polish. Compendium and library content stay English for everyone.

## Commands

```bash
npm install
npm run dev        # Express + Vite middleware (HMR) on http://localhost:3000
npm run build      # Vite build to dist/
npm start          # serves dist/ (tsx server.ts --production)
npm run lint       # tsc --noEmit — must pass before committing
npm run i18n       # lists UI strings without a Polish translation (must be 0)
```

## Architecture

```
src/config.ts            APP identity (name, assistantName, id = storage prefix 'otzi', locale, timezone)
src/account.ts           Roles, PackageDef, Usage, OUTPUT_KINDS (stencil | colour | mannequin | scar), DEFAULT_PACKAGES, remaining()
src/i18n/                I18nProvider, useT()/useI18n() (t, tp, locale); pl.ts = Polish dictionary keyed by the English text
src/compendium.ts        Compendium types, CLOSED_STYLES / SENSITIVE_STYLES (cultural guardrail), EVIDENCE_LABEL
src/tattooOptions.ts     Generator groups: PLACEMENTS (no intimate areas; mannequin view + aspect + diagram zone), size, line, palette, composition, mood; TATTOO_HOUSE_RULES
src/options.ts           Option-set schema (from the template's option window), withImageRules()
src/design.ts            DesignBrief, Project, DesignImage, GenerationEstimate, DesignWarning
content/compendium.json  66 styles, 44 techniques, fusions, history, 30 article index (from the archive)
content/library/*.md     30 research articles (English)
content/persona/otzi.json Ötzi's full persona (+ private_memory_rule)

server.ts                Routes: /api/auth, requireUser, /api/me(/lang), /api/compendium, /api/library/:slug, settings (admin), voice (admin), chat, options, projects, admin
server/auth.ts           HMAC cookie {sub: user id, v: password version}; requireUser / requireAdmin / currentUser(res)
server/users.ts          UserService: admin from env, clients + packages + admin_profile as store documents; scrypt passwords; consume() takes one picture from the package and returns a give-back
server/persona.ts        otziSystem(): six-phase method, private memory, compendium index + relevant entries, package note, language
server/specParse.ts      design_spec / studio_brief blocks -> DesignBrief matched to option codes
server/chat.ts           /api/chat: per-user conversations, no web tools, photos admin-only, saves brief/studioBrief with the reply
server/compendium.ts     Loads content/, styleIndex(), relevantEntries(), matchStyle(), articleBySlug()
server/tattooSet.ts      The option set: style + technique from the compendium, then STATIC_GROUPS
server/designPrompt.ts   composeDesignPrompt(kind, brief) — stencil / colour / mannequin (with or without reference) — and composeScarPrompt()
server/projects.ts       ProjectService + /api/projects: CRUD, estimate, generate (SSE), images, scar photo (PUT/DELETE/GET), toTransparentStencil()
server/options.ts        /api/options: the tattoo set with thumbnails from disk; admin-only paid thumbnail run
server/adminRoutes.ts    /api/admin/clients, /api/admin/packages
server/images/generate.ts Image adapters (OpenAI, Gemini, Replicate, Stability); OpenAI/Gemini take `references` (edits)
server/claudeLoop.ts     Claude loop; maxSearches/maxFetches 0 = no web tools
server/research.ts, engines/  Template's provider-neutral research + structuredCall (not used by a route now; kept for structured calls)

src/App.tsx              Login -> Shell: NavRail + views (#studio #consult #generator #projects #atlas #library #scar #clients); AppContext
src/lib/appContext.tsx   user, refreshUser, compendium, optionSet, navigate, openGenerator, openScar, startChat, projectsVersion
src/lib/appApi.ts        Client for the app's JSON/SSE endpoints
src/lib/sections.ts      The menu: id, label, subtitle, icon, tone, visible(user)
src/components/          Dashboard, ChatView (design + studio brief cards), GeneratorView, ProjectsView, AtlasView, LibraryView, ScarView, ClientsView, SettingsModal (admin), LoginScreen
src/components/design/   BriefChips, PackageCard (+ KIND_INFO), ImageSheet/DesignThumb (checkerboard for stencils), PhotoCropper
src/components/options/  OptionWindow, OptionVisual (+ tattoo diagrams), BodyDiagram (placement), SamplesSheet
```

Runtime data (gitignored `data/`): `otzi-settings.json` (file store), `projects/<projectId>/<imageId>.png` and `photo.jpg`, `options/tattoo/<group>/<code>.webp`, `uploads/` (admin chat pictures).

## Rules that matter

- **No invented data.** Craft and history facts come from the compendium/library only; Ötzi has no web tools. His backstory is never a source and never told to a client.
- **Nothing sexual, no nudity, no real bodies.** Previews are on a sexless, featureless grey mannequin; placements exclude intimate areas; every image prompt ends with `TATTOO_HOUSE_RULES`. The only real body photo is the client's own cropped scar in the scar service.
- **Scar photos:** consent required (`?consent=1`), cropped in the browser, re-encoded by sharp (no EXIF/GPS), stored with the project only, deleted together with every picture made from it (`fromPhoto`) when the project is completed or on request. Admin lists show an alias for scar projects.
- **Cultural guardrail:** closed traditions (Māori, Samoan, Marquesan, Polynesian, Haida) are only ever "inspired, not copied"; a brief with `culturalCheck: 'flagged'` cannot generate.
- **Paid image calls:** the admin sees the cost and must send it back (`confirmedUsd`); a client spends one picture from the package (the package is the admin's standing consent). A failed picture is given back. Never generate in the background, on load or in tests against real keys.
- **401 = session expired** (client logs out). Use 400/403 otherwise. Every `/api/*` route except `/api/auth/*` is behind `requireUser`; settings, voice, admin routes and thumbnail runs also behind `requireAdmin`. Clients only ever see their own projects and conversations.
- **i18n:** write UI text in English inside `t('…')`; constants rendered via `t(variable)` must be listed in `scripts/i18n-check.ts`. After adding text, add Polish to `src/i18n/pl.ts` until `npm run i18n` reports 0. Server messages are English; the client passes blockers through `t()`.
- **Keys never reach the browser**; **links from model output** only through `safeUrl()`; server binds to `127.0.0.1` by default (`HOST` overrides).
- **`start.ps1` must stay UTF-8 with BOM + CRLF** and PowerShell 5.1-compatible (installer text is Polish — it is the admin who installs).

## AI providers

- Text engine (Claude / GPT / Gemini) chosen by the admin in Settings; it runs the consultation. Default Claude model `claude-opus-5-5`. Keep the template's Claude rules (adaptive thinking, no `temperature`/`budget_tokens`, server-side fallback beta, `pause_turn`).
- Images: `image.defaultModel` (stencil, colour, mannequin without reference), `image.editModel` (OpenAI or Gemini: mannequin preview of an existing design + scar cover-ups), `image.sampleModel` (option thumbnails). Catalogue and prices: `src/imageModels.ts`.
- Mock base URLs for tests: `ANTHROPIC_BASE_URL`, `OPENAI_BASE_URL`, `GEMINI_BASE_URL`, `REPLICATE_BASE_URL`, `STABILITY_BASE_URL`.

## Testing without spending API credit

1. `npm run lint`, `npm run i18n`, `npm run build`.
2. A local mock: Claude `GET /v1/models` + streamed `POST /v1/messages` (reply containing a ```` ```design_spec ```` block), Gemini `GET /v1beta/models` + `POST /v1beta/models/<m>:generateContent` returning a small PNG. Run with `DB_HOST=` empty, env keys `ANTHROPIC_API_KEY`/`GEMINI_API_KEY` set to dummies, `OWNER_LOGIN/OWNER_PASSWORD/SESSION_SECRET` set.
3. API: admin login -> create client (package) -> client consultation (brief parsed) -> project -> estimate -> generate stencil (PNG with alpha) -> limit reached = 403 message -> admin generate needs `confirmedUsd` -> scar: consent, upload (no EXIF stored), generate, complete (files gone).
4. Playwright at 1480×800 (no page scroll, no horizontal overflow) and 390×844, as admin and as a client.
