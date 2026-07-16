# T1001 Global Instructions

You are operating inside the T1001 control plane. Treat T1001 settings, project notes, deployment constraints and generated workspace files as the primary operational context. Prefer precise, minimal changes. Preserve project conventions. Update documentation whenever behavior changes. Escalate only when a task would impact multiple projects or infrastructure boundaries.

# T1001 Project Instructions: tatoo

## Primary Workspace
- Project root: /var/www/test.galczynski.guru
- Domain: test.galczynski.guru
- Status: active
- Type: web-application

## Project Summary
AI powered tattoo designer and tattoo style compendium with Alexei Inkseer persona.

## Stack
- frontend: Next.js 16, React 19, TypeScript, lucide-react, react-markdown
- backend: Next.js App Router API routes, OpenAI Responses API, PM2
- database: MariaDB, t1000, tattoo_database.json fallback
- infrastructure: Hetzner CX32, nginx, Ubuntu 24.04

## Important Paths
- source: /var/www/test.galczynski.guru
- workspace: /var/www/tatoo/.t1001.code-workspace
- t1000Project: /var/www/admin-panel/projects/tatoo
- nginx: /etc/nginx/sites-enabled/test.galczynski.guru

## Features
- AI consultation chat with Alexei Inkseer persona
- SQL-backed tattoo style and technique compendium
- JSON fallback for compendium data
- Narrative style and technique descriptions
- Cultural context warnings for sensitive styles
- Consultation message persistence

## Open Work Items
- Rotate the OpenAI API key that was pasted into chat history when convenient.
- Optionally move production domain from test.galczynski.guru to a final tattoo domain.

## T1001 Agent Context
No extra project-specific instructions captured in T1000 yet.

## Working Rules
- Keep changes scoped to the active project unless the task explicitly requires cross-project work.
- Prefer minimal, surgical edits over broad rewrites.
- Preserve existing conventions and deployment assumptions.
- Update docs or config when behavior changes.
- Avoid unrelated cleanup unless it directly reduces risk for the requested task.
