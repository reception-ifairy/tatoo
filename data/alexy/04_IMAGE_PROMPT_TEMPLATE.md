# IMAGE PROMPT TEMPLATE — from consultation to a renderable tattoo image

This is the layer that was missing from the original project. It turns the `design_spec`
(Phase 5) into a ready-to-run prompt for a modern image generator. It covers the three
targets you chose — **Midjourney v7**, **Flux / SDXL**, and **Google "Nano Banana"
(Gemini 2.5 Flash Image)** — plus one universal, model-agnostic schema.

> **Golden rule for tattoo renders:** always tell the model *what surface* the design lives on.
> A "flat design on white paper / flash sheet" prompt gives a clean, tattooable stencil.
> A "tattoo on <body part>, professional photo" prompt gives a realistic preview of how it
> will sit on skin. Decide which you want and say so explicitly — this is the #1 mistake.

---

## 1. Universal attribute schema (fill this first)

Every generator prompt is assembled from the same building blocks. Fill these from the `design_spec`:

| Slot | What goes here | Example |
|---|---|---|
| **SUBJECT** | The core motif, concrete and specific | "a koi carp swimming upward through wind bars" |
| **STYLE** | Primary style (+ optional fusion) | "Japanese Irezumi, fine-line accents" |
| **TECHNIQUE** | Line + shading + color method | "bold outlines, whip shading, grey wash" |
| **PALETTE** | Named colors or "black and grey" | "indigo, muted red, negative-space skin" |
| **COMPOSITION** | Shape, flow, focal point, negative space | "vertical composition flowing along the forearm, focal eye at top" |
| **SURFACE** | Flash sheet OR on-skin preview | "clean tattoo flash on white background" / "tattoo on a forearm, studio photo" |
| **DETAIL/QUALITY** | Rendering cues | "high detail, crisp linework, symmetrical" |
| **LIGHTING** (on-skin only) | How skin is lit | "soft studio light, subtle skin texture" |
| **ASPECT** | Framing to match placement | forearm → tall 2:3; back → 4:5; sleeve → 9:16 |
| **NEGATIVES** | What to exclude | "no color bleed, no blurry lines, no extra limbs" |

---

## 2. Midjourney v7

**Structure:** `<subject>, <style>, <technique>, <palette>, <composition>, <surface>, <detail> --parameters`

Key v7 parameters:
- `--ar` aspect ratio (forearm `--ar 2:3`, back `--ar 4:5`, full sleeve `--ar 9:16`, flash sheet `--ar 1:1`)
- `--style raw` — less "MJ opinion," more literal to your prompt (best for clean tattoo linework)
- `--stylize 0–1000` (a.k.a. `--s`) — lower (100–250) for faithful linework, higher for artistic flourish
- `--sref <image-url>` — style reference (feed a reference of the desired tattoo style)
- `--cref <image-url>` `--cw 0–100` — character reference (keep a specific creature/figure consistent across variations)
- `--no <things>` — negative prompt (e.g. `--no photorealistic skin, background clutter`)
- `--profile` / personalization — apply your saved aesthetic profile for a consistent house style

**Flash-sheet template (clean, tattooable stencil):**
```
<SUBJECT>, <STYLE> tattoo design, <TECHNIQUE>, <PALETTE>, <COMPOSITION>, isolated on clean white background, tattoo flash sheet, crisp linework, high detail, centered --ar 1:1 --style raw --stylize 200 --no photo, skin, background clutter
```

**On-skin preview template (realistic mockup):**
```
professional photograph of a <STYLE> tattoo on a <BODY PART>, <SUBJECT>, <TECHNIQUE>, <PALETTE>, <COMPOSITION> following the muscle, healed ink, soft studio lighting, realistic skin texture, shallow depth of field --ar 2:3 --style raw --stylize 250
```

---

## 3. Flux (natural-language prompting)

Flux (e.g. Flux.1) rewards **descriptive, well-punctuated prose** over keyword salad, and
handles fine linework and text/lettering better than older SD models. Write it like a
sentence a photographer or illustrator would give.

**Flash-sheet template:**
```
A clean tattoo flash design of <SUBJECT>, drawn in <STYLE> style with <TECHNIQUE>. <COMPOSITION>. Colors: <PALETTE>. Crisp, confident linework with no background, centered on pure white, high resolution, illustration only — not a photo.
```

**On-skin preview template:**
```
A professional studio photograph of a finished <STYLE> tattoo on a person's <BODY PART>. The design is <SUBJECT>, rendered with <TECHNIQUE> in <PALETTE>. The composition <COMPOSITION> and follows the natural curve of the muscle. Realistic healed ink on natural skin with fine pores, soft directional studio lighting, shallow depth of field.
```

## 3b. SDXL (tag-based + explicit negative prompt)

SDXL responds to **weighted tags** and needs a real negative prompt. Recommended baseline:
`steps 30–40`, `CFG 5–7`, sampler `DPM++ 2M Karras`.

**Positive:**
```
(<STYLE> tattoo design:1.2), <SUBJECT>, <TECHNIQUE>, <PALETTE>, <COMPOSITION>, (clean linework:1.2), high detail, white background, flash sheet, vector-like, sharp focus
```
**Negative (always include for tattoos):**
```
blurry, low contrast, muddy lines, color bleed, asymmetrical (when symmetry intended), extra limbs, watermark, signature, jpeg artifacts, photo background, deformed anatomy, washed out
```
For an on-skin preview, swap `white background, flash sheet, vector-like` for
`(tattoo on skin:1.2), realistic skin texture, studio photo, (healed ink:1.1)` and remove
`photo background` from the negatives.

---

## 4. Google "Nano Banana" (Gemini 2.5 Flash Image)

Nano Banana is a **conversational, natural-language** image model. Its superpowers are
(a) **character/subject consistency** across edits and (b) **iterative editing by chat** —
perfect for the refinement phase. Don't write parameter flags; describe the image, then
refine in follow-up turns.

**Initial generation:**
```
Create a <STYLE> tattoo design of <SUBJECT>. Use <TECHNIQUE> and a palette of <PALETTE>. <COMPOSITION>. Present it as clean tattoo flash art on a plain white background, with crisp, confident linework and high detail. Illustration only, not a photograph.
```

**Then refine conversationally (its strength):**
- "Keep the same design but make the outer lines bolder so it still reads in ten years."
- "Now show this exact tattoo placed on a forearm, as a realistic studio photo, following the muscle."
- "Remove the color and render it in black and grey with dotwork shading."
- "Make the composition taller to fit along the forearm, aspect ratio 2:3."

Because it preserves the subject between turns, you can carry one design from flash → on-skin
preview → color variant → placement mock without re-describing it each time.

---

## 5. Prompt-assembly rules the agent follows

1. **Never leave SURFACE ambiguous.** State flash-sheet *or* on-skin, every time.
2. **Aspect ratio mirrors placement** (tall for limbs, wide/square for back/chest, square for flash).
3. **Line weight for longevity:** if the spec flags fine lines on a high-movement or small area, add "bold enough to age well / thickened key outlines" so the render matches the tattooable reality.
4. **Cultural check travels with the prompt:** if `cultural_check` = inspired-not-copied, phrase the prompt as "*inspired by* … motif, original abstraction — not a traditional/sacred replica."
5. **One design, many renders:** generate the flash sheet first (approval), then the on-skin preview from the same description; on Nano Banana, do this by conversational edit.
6. **Negatives are mandatory on SDXL, optional-but-useful on MJ (`--no`), and unnecessary on Flux/Nano Banana** (describe positively instead).

---

## 6. Two fully worked examples

### Example A — Fine-line rebirth piece, forearm

From this `design_spec`:
```
subject: a single blooming poppy with one petal dissolving into three small birds
narrative_intent: release — letting go of a long grief
style: fine-line, minimal
technique: single-needle linework, light stippled shading
palette: black and grey, negative-space skin
composition: vertical, flowing up the inner forearm, birds rising toward the elbow
placement: inner left forearm, along the limb
size: ~14 cm tall
line_weight: fine, with slightly thickened stem for aging
mood: tender, quiet, hopeful
cultural_check: clear
```

**Midjourney v7 (flash):**
```
a single blooming poppy with one petal dissolving into three small rising birds, fine-line minimal tattoo design, single-needle linework with light stippled shading, black and grey with negative-space skin, vertical composition flowing upward, isolated on clean white background, tattoo flash sheet, crisp delicate linework, thickened stem for longevity --ar 2:3 --style raw --stylize 200 --no photo, skin, color, background clutter
```
**Flux (on-skin):**
```
A professional studio photograph of a finished fine-line tattoo on a person's inner left forearm. The design is a single blooming poppy with one petal dissolving into three small birds rising toward the elbow, drawn with delicate single-needle linework and light stippled shading in black and grey, using the bare skin as negative space. Roughly 14 cm tall, flowing along the muscle. Realistic healed ink on natural skin with fine pores, soft directional studio light, shallow depth of field.
```
**Nano Banana (refine):** "Keep this exact poppy-and-birds design, but thicken only the main stem line so it still reads clearly after ten years, and show it as a realistic photo on an inner forearm, 2:3 vertical."

### Example B — Irezumi-inspired protection dragon, upper arm (cultural check applied)

From this `design_spec`:
```
subject: a coiling dragon among wind bars and a single peony
narrative_intent: protect — a guardian over the shoulder
style: Japanese Irezumi (inspired), bold traditional
technique: bold outlines, whip shading, color packing
palette: indigo, muted red, black, negative-space wind
composition: dragon wrapping the deltoid, head at the shoulder cap, flowing down the upper arm
placement: right upper arm / shoulder
size: ~25 cm, half-sleeve start
line_weight: bold
mood: powerful, dignified, calm
cultural_check: inspired-not-copied (Irezumi is widely practiced; keep symbolism respectful, no clan-specific/sacred marks)
```
**SDXL (flash) positive:**
```
(Japanese Irezumi tattoo design:1.2), a coiling dragon among wind bars and a single peony, bold outlines, whip shading, color packing, indigo and muted red and black with negative-space wind, composition wrapping a deltoid with the head at the shoulder cap, (clean bold linework:1.2), high detail, white background, flash sheet, sharp focus
```
**SDXL negative:**
```
blurry, muddy lines, color bleed, extra limbs, deformed dragon, watermark, signature, jpeg artifacts, photo background, washed out, sacred clan crest, text
```
**Midjourney v7 (on-skin):**
```
professional photograph of a Japanese Irezumi-inspired tattoo on a right upper arm and shoulder, a coiling dragon among wind bars and a single peony, bold outlines with whip shading and color packing in indigo, muted red and black, wind rendered as negative space, wrapping the deltoid and flowing down the arm, healed ink, soft studio lighting, realistic skin texture --ar 2:3 --style raw --stylize 250 --no flat sticker, clan crest, text
```
Agent's spoken note to client: "I'm shaping this *in the spirit* of Irezumi — its rhythm and respect — but as your own dragon, not a copied sacred crest. The ink must be honest."
