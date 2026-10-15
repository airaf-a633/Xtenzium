# Hyperframes Composition Brief: Xtenzium

## Objective
Create a short launch-style brag video for Xtenzium — a Karachi studio that
builds web products and the custom hardware underneath them.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape — 1920x1080
- Duration: 21s (must stay 15–25s; scene lengths flex to the generated voiceover)

## Source Material
- Project root: `D:\WORKK\Xtenzium\Xtenzium\web`
- Primary files read: `src/pages/index.astro`, `src/styles/global.css`,
  `src/data/services.ts`, `src/components/StatementPanel.astro`
- Product name: Xtenzium
- Tagline: "We architect long-term success."
- Strongest claim: "We build the software and the board it runs on."
- Key visual moment to recreate: the statement-panel **duality split** — the
  site's two-column `The board` / `The software` proof block — plus the stat row
  from the homepage.
- Copy that must appear verbatim (all of it is live on the site):
  - `Karachi, Pakistan — Software & Hardware`
  - `We build the software and the board it runs on.`
  - `The board` / `The software`
  - `65+` · `Projects delivered across web, hardware and automation`
  - `4` · `Continents we ship to`
  - `01 Scope` · `02 Design` · `03 Build` · `04 Handover`
  - `It works after we leave.`
  - `We architect long-term success.`
  - `xtenzium.com`

### Accuracy constraint (important)
The site's 36% ROI figure is explicitly labelled in source as *estimated by us
from delivered project outcomes*, not client-reported. **It must not appear in
the video**, in any form, labelled or otherwise. `65+`, `4 continents` and the
capability lists are the only numeric claims permitted. Do not invent client
names, logos, testimonials or outcome percentages — the site itself had invented
client names removed for exactly this reason.

## Creative Direction
- Tone preset: `polished`, with `deadpan` restraint on holds and empty space
- Creative direction: *Confident and precise, zero hype. Short declarative
  sentences. Lead with proof and numbers, not adjectives. Engineering credibility
  over sales energy — the calm of a team that ships to four continents and
  doesn't need to oversell it.*
- Interpretation: every line is a statement of fact, not a benefit. Motion is
  fast-in, long-hold. Copper is the only saturated colour on screen and appears
  at most once per scene. Five scenes, one idea each.
- Angle: most agencies claim full-stack; Xtenzium means it literally — the React
  app and the PCB it talks to come from the same four people. The whole video is
  assembled from the site's own verified copy. Nothing is added.
- Hook: "We build the software and the board it runs on.", `board` in copper,
  three masked lines on carbon.
- Outro: wordmark, tagline, domain, near-silence.
- Avoid:
  - Generic SaaS language — no "streamline", "empower", "unlock", "seamless"
  - Abstract filler visuals, particle fields, gradient washes
  - Zooms, flashes, strobes, exclamation, or any motion that reads as excitement
  - Unrelated visual redesign — the site's token system is the spec
  - Fake screenshots of client work or invented UI

## Visual Identity
All values are lifted from `src/styles/global.css` `@theme`.
- Background: `#0A0908` (carbon) — the site's statement-panel ground
- Secondary ground: `#FAFAF8` (bone) — used once, for the numbers scene
- Accent: `#F2895C` (copper-hi, on carbon) / `#B8430F` (copper, on light)
- Text: `#FFFFFF` at 100% / 55% / 45% on carbon; `#2B2622` (ink) and `#6E665E`
  (ink-2) on bone
- Line: `#E3E0DC` on light, white at ~12% on carbon — hairlines only
- Display font: Bricolage Grotesque (fallback: any grotesque with tight apertures)
- Body font: DM Sans · Mono: DM Mono
- Brand easing: `cubic-bezier(0.16, 1, 0.3, 1)` — the site's `--ease-brand`.
  Use it for every entrance.
- Palette rule from the source, worth honouring: no neutral is a pure grey;
  every one is biased warm.

## Storyboard
`brag-output/brag-plan.md` is the creative contract. Scene summary:

1. **The claim** — 4.0s — three masked headline lines on carbon, `board` in
   copper, mono eyebrow above. Staggered rise, then a 2.4s hold.
2. **The split** — 5.0s — centre hairline; `THE BOARD` / `THE SOFTWARE` headers;
   eight items alternating left-right (KiCad · React · Altium · Astro · ESP32 ·
   Node.js · LoRaWAN · PostgreSQL), then all eight held together 1.4s.
3. **The numbers** — 5.0s — ground flips to bone. `65+` / `4` / `1` count up from
   zero, copper digits, DM Sans labels. Staggered 0.4s, row holds 2.2s.
4. **The process** — 4.0s — hairline draws left to right over 0.8s, gating four
   nodes (01–04); closing line "It works after we leave." underneath.
5. **Sign-off** — 3.0s — `XTENZIUM` wordmark, tagline in copper-hi, `xtenzium.com`
   in mono. Fade up, hold, nothing moves.

## Audio
- Audio role: sparse professional accents over a low warm bed, under a calm
  narration spine. The voice leads; music is room tone.
- Audio arc: bed fades in → ducks for every narration line → thins through the
  process scene → fades to near-silence under the wordmark.
- Music: `assets/music/happy-beats-business-moves-vol-12-by-ende-dot-app.mp3`
- Music treatment: fade in 0.8s; duck to 0.12–0.15 for the full duration of each
  voiceover line; fade out across the final 1.5s. No drop, no riser.
- Music cue guidance: bundled preset
  `<skill-dir>/assets/music/cues/happy-beats-business-moves-vol-12-by-ende-dot-app.music-cues.json`
  — 110 BPM, beat grid ~0.54s. **Two strong-cue locks only:** `8.74s` (0.99) on
  the bone-ground flip into scene 3, and `13.11s` (0.98) on the process rule
  completing in scene 4. Mark both `// beat-locked`. The hook takes natural
  timing — nothing in the first 4s should feel snapped.
  **Beat grid:** the eight alternating items in scene 2 run on consecutive beats
  from ~4.91s; mark `// beat-grid`. They are one- and two-word labels revealed
  fast and held as a full set for 1.4s, which is how they clear the read floor.
  If a cue lock hurts legibility or pacing, use natural timing and say so.
- Audio-reactive treatment: **none.** This is a deliberate tonal decision, not an
  omission — the tone asks for stillness, and any RMS-driven breathing or glow
  would contradict "zero hype". Document it rather than adding a subtle effect.
- Voiceover: **enabled** (`--voice`). Kokoro via `npx hyperframes tts`. Calm,
  unhurried, mid-low register. Five lines, one per scene — see the
  `## Voiceover script` section of `brag-plan.md`. Generate to
  `assets/voiceover.wav`, wire on its own track at `data-volume="1"`, and **flex
  the scene durations to the generated audio** rather than hardcoding the
  planned lengths. Each line must land inside its own scene and stop before the
  cut. Total must stay within 15–25s.
- Audio-coupled moments:
  - Scene 2, eight alternating items — beat-grid reveal, no per-item SFX (too busy)
  - Scene 3, three counters — one soft dry tick as each counter settles
  - Scene 4, rule completing — one low click, on the beat lock
  - Scene 5 — nothing. No stinger. Silence is the outro.
- SFX selection guidance: sparse, at most one dry accent per scene, four in total.
  Prefer the soft/low families — `interface/drop_*` or `impact/impactWood_light_*`
  for counter settles, a `interface/click_*` or `interface/select_008` for the rule
  completion. **No** whooshes, risers, bells, punches, plate slams or announcement
  cues anywhere. If a sound draws attention to itself, cut it.
- SFX analysis guidance: read `<skill-dir>/assets/sfx/sfx-analysis.md` and pick
  **low high-frequency-risk** files only — every cue here is a polished, repeated
  moment.
- Exact SFX choice: Hyperframes picks filenames, timestamps and volumes after the
  visual animation exists.
- Audio files: copy the chosen music, SFX and the generated `voiceover.wav` into
  `brag-output/composition/assets/`. Relative paths only — never absolute.

## Hyperframes Instructions
Load the composition-building Hyperframes domain skills — `hyperframes-core`
(composition contract + `data-*` timing), `hyperframes-animation` (motion),
`hyperframes-creative` (design spec, beats), `hyperframes-keyframes` (seek-safe
keyframes) and `hyperframes-cli` (lint/check/render). `/brag` is its own
workflow: do not enter the `hyperframes` entry-point intent interview and do not
route into its generic promo / launch-video workflow. Prefer native Hyperframes
conventions over anything in `/brag`.

Requirements:
- Show at least one real UI, copy or visual element from the source project —
  the duality split and the stat row both qualify, and both are required here.
- Keep all text readable: short label ~0.8s settled, sentence ~0.3s per word.
  The hook gets the longest hold in the video.
- Total duration 15–25 seconds.
- Include the music and voiceover layers; keep SFX to four cues.
- Treat `/brag` audio notes as guidance — choose SFX after the animation exists.
- Treat cue metadata as optional hints; readability and pacing win.
- Two strong-cue locks max (8.74s, 13.11s), each within ±0.15s and marked.
- Sequential reveals snap to consecutive beats within ±0.10s, marked.
- Audio-reactive is intentionally off — document, do not implement.
- Use local assets only.
- Run `npx hyperframes check` before render. It is brag's single gate.
