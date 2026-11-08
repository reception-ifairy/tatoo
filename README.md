# Ötzi Signal

An AI tattoo design studio. Clients talk their idea through with **Ötzi**, an AI design guide, and turn it into a design: a black-line **stencil** (transparent PNG), a finished **colour design** and a **preview on a neutral grey mannequin**. A private, anonymous **scar cover-up** service draws a cover-up over a cropped photo of a healed scar. Everything comes with a studio brief for a real, licensed tattoo artist.

- **Consultation** — six phases from feeling to design, with cultural and safety guardrails; facts come only from the built-in compendium.
- **Generator** — style and technique from the compendium (66 styles, 44 techniques), placement, size, line weight, palette, composition and mood, chosen in a thumbnail window.
- **Style atlas** and **History & library** — the compendium and 30 research articles.
- **Accounts** — one studio admin and client accounts with packages (how many stencils, colour designs, mannequin previews and scar cover-ups each client gets).
- The interface is English; the studio admin can switch it to Polish.

## Run it locally

Windows: double-click `start.cmd` (installs Node.js dependencies, asks for the admin login and password, builds and starts the app).

Any system:

```bash
npm install
cp .env.example .env    # set OWNER_LOGIN, OWNER_PASSWORD, SESSION_SECRET
npm run build
npm start               # http://localhost:3000
```

Sign in as the admin, open **Settings** to add API keys (Claude, GPT or Gemini for the consultation; Gemini/OpenAI/FLUX/Stability for pictures), then create client accounts in **Clients & packages**.

## For developers

See `CLAUDE.md` (architecture and rules) and `HANDOFF.md` (state of the project). This repository was the Ink Master archive (Next.js) until November 2026; its history keeps the old app, SQL schema and source files.
