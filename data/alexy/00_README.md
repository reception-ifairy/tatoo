# AI Tattoo Master — Alexei "Inkseer" Novak

A complete, ready-to-deploy AI tattoo-artist agent, built from your source files and
organized into a clean, modern package. The agent guides a person from a raw feeling to
a fully specified design, a ready-to-run **image-generation prompt**, and a **studio brief**
for a real human artist.

**Language:** English · **Target:** portable between OpenAI and Anthropic APIs
**Image generators supported:** Midjourney v7 · Flux / SDXL · Google Nano Banana (Gemini 2.5 Flash Image)

---

## Files in this package (read/use in this order)

| # | File | What it is | How you use it |
|---|---|---|---|
| 00 | **00_README.md** | This overview | Start here. |
| 01 | **01_PERSONA.json** | The character, v3 (schema `2026.07-FUSION`) — identity, ISFP psychology, voice, expertise, `craft_upgrade`, tone matrix, consultation flow, guardrails, client types, scenarios. A fusion of the earlier lean runtime persona and the expanded narrative master, plus the upgrade layer that binds Alexei to the T1000 compendium and the 30-paper research library. Valid, de-duplicated JSON. | Load as knowledge/context behind the system prompt (or inline a condensed version). |
| 02 | **02_KNOWLEDGE_BASE.json** | The craft reference — ~40 styles + techniques + placement guide, each style tagged with `render_tags` for prompts. Merged from style.txt + klasyfikacja.txt + technics.txt. | Load as knowledge/retrieval so the agent can talk styles and build prompts. |
| 03 | **03_SYSTEM_PROMPT.md** | The production system prompt (model-agnostic). Contains the copy-paste block, API settings, and a short "starter" variant. | Paste the `BEGIN/END` block into your API's system/developer field. |
| 04 | **04_IMAGE_PROMPT_TEMPLATE.md** | The prompting layer (the piece the original project was missing). Universal schema + Midjourney v7 / Flux / SDXL / Nano Banana syntax + worked examples. | The agent follows this to turn a design into a renderable prompt. |
| 05 | **05_EXAMPLE_end_to_end.md** | A full worked consultation → spec → image prompt → studio brief. | Sanity-check, demo, or paste as a few-shot example. |

---

## The flow, in one picture

```
 Client feeling / vague idea
        │
        ▼
 ┌─────────────────────────────────────────────────────────┐
 │ ALEXEI — 6-phase consultation (03_SYSTEM_PROMPT.md)      │
 │ 1 story → 2 symbol → 3 style+culture → 4 body/placement  │
 │ 5 design_spec ───────────────────────┐                  │
 └───────────────────────────────────────┼──────────────────┘
                                          ▼
                        6 image_prompt (04_IMAGE_PROMPT_TEMPLATE.md)
                          → Midjourney v7 / Flux / SDXL / Nano Banana
                                          │
                          flash sheet ──► on-skin preview ──► refine
                                          │
                                          ▼
                                    studio_brief  → real human tattoo artist
```

Knowledge drawn from **01_PERSONA.json** (who he is, how he talks, his guardrails) and
**02_KNOWLEDGE_BASE.json** (styles, techniques, placement) at every step.

---

## Quick start (OpenAI or Anthropic API)

1. Open **03_SYSTEM_PROMPT.md**, copy the block between `=== BEGIN SYSTEM PROMPT ===` and `=== END SYSTEM PROMPT ===`.
2. Put it in your API's system field (Anthropic `system` parameter / OpenAI `developer` or `system` message).
3. Attach **01_PERSONA.json** and **02_KNOWLEDGE_BASE.json** as retrieval/knowledge, or paste condensed versions into the system prompt.
4. Set `temperature` ≈ 0.8 for conversation. Your app can parse the ```design_spec```, ```image_prompt```, and ```studio_brief``` fenced blocks the agent emits.
5. Take the emitted `image_prompt` to the matching generator (templates in **04**).

---

## What changed vs. the original files (and why)

**Consolidated & fixed.** The strongest source, `tato 40.json`, was **not valid JSON** (missing
commas/brackets, three objects fused at the root). Its content is preserved and corrected inside
`01_PERSONA.json` as one valid object. The style/technique files (`style.txt`, `klasyfikacja.txt`,
`technics.txt`) were merged and de-duplicated into `02_KNOWLEDGE_BASE.json`.

**Modernized the tech.** The old `plan.txt` proposed *fine-tuning a GPT model on a tattoo dataset*
(a 2023-era approach). That's replaced with the current best practice: **strong system prompt +
structured persona/knowledge files as context/retrieval + a defined output contract.** No fine-tuning
needed — better results, cheaper, instantly editable.

**Added the missing layer.** The whole project pointed at generating images but had **no image-prompt
template.** `04_IMAGE_PROMPT_TEMPLATE.md` fills that with current syntax for Midjourney v7, Flux/SDXL,
and Google Nano Banana, plus the critical flash-sheet-vs-on-skin rule.

**Made guardrails first-class.** Cultural integrity (e.g. Maori ta moko is treated as closed/sacred —
inspired-not-copied only), ethics, safety/hygiene, and a "see a licensed professional" disclaimer are
baked into the system prompt and persona, not left as loose notes.

---

## Source files this was built from (left untouched in the parent folder)

`tato 40.json` (primary persona) · `TATOO PERSONA.docx` · `tattoo_ai_personality.md` ·
`Tattoo AI – Rozszerzona Analiza.md` · `style.txt` · `klasyfikacja.txt` · `technics.txt` · `plan.txt`

**Redundant / off-topic originals** (safe to archive): `TATOO.txt`, `cv.txt`,
`New Text Document.txt` (duplicates), `CharacterCreatorProfile.json` (empty template),
`InteractiveModule.json` (off-topic — a guide to MCQ quizzes for teenagers), and the near-empty
`W świecie akademickim i profesjonalnym nie istnieje jedna.docx`. See `_ANALIZA_PROJEKTU.md` for
the full file-by-file audit.
