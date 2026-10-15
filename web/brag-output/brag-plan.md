# Brag Plan: Xtenzium

## What is this app?
The public site for Xtenzium — a Karachi studio that builds web products and the
custom hardware underneath them. Astro, a warm-neutral token system, a copper
accent, and copy that refuses to oversell.

## The angle
Most agencies claim full-stack. Xtenzium means it literally: the React app and
the PCB it talks to come from the same four people. The video is built entirely
out of the site's own verified claims — no adjectives added, no numbers invented.
Proof, held long enough to read, said once.

## Hook (first 2-3 seconds)
The site's strongest line, at full scale on carbon:
**"We build the software and the board it runs on."** — `board` in copper.
It is the one sentence a competitor cannot copy.

## Key moments (the middle)
- **The duality split.** Two columns from the site's statement panel: *The board*
  (KiCad, Altium, ESP32, STM32, LoRaWAN, MQTT) and *The software* (React, Astro,
  Node, PostgreSQL). Items arrive alternating, left-right, then hold as a set.
- **The numbers.** `65+` projects delivered. `4` continents. One Karachi studio.
  Counters tick up. No percentage claims — the site labels its ROI figure as
  internally estimated, so it stays out of the video.
- **The process spine.** 01 Scope · 02 Design · 03 Build · 04 Handover, drawn as
  a rule, ending on the differentiator: *"It works after we leave."*

## Outro / punchline
Wordmark. Tagline. Domain. Silence under it.

## User flow worth showing
None — the target is a marketing site with no in-product flow. The strongest
material is the capability split and the stat row, both recreated from the real
components (`StatementPanel.astro`, the stats block in `index.astro`).

## Tone
- Preset: `polished` (with `deadpan` restraint on holds and empty space)
- Creative direction: *Confident and precise, zero hype. Short declarative
  sentences. Proof and numbers before adjectives. Engineering credibility over
  sales energy — the calm of a team that ships to four continents and doesn't
  need to oversell it.*
- Interpretation: Every line is a statement of fact, not a benefit. Motion is
  fast-in and long-hold. No zooms, no flashes, no exclamation. Copper is the only
  saturated colour on screen, used once per scene at most. Five scenes instead of
  the usual four, because each carries one idea and nothing else.

## Format: landscape — 1920x1080
## Duration: 21s

## Visual identity (from the project)
- Background: `#0A0908` (carbon) — the site's statement-panel ground
- Secondary ground: `#FAFAF8` (bone) for the numbers scene
- Accent: `#F2895C` (copper-hi, on carbon) / `#B8430F` (copper, on light)
- Text: `#FFFFFF` at 55–100% on carbon; `#2B2622` (ink) on light
- Display font: Bricolage Grotesque
- Body font: DM Sans · Mono: DM Mono (capability labels, stat suffixes)
- Strongest visual element: the statement-panel duality split, and the
  monospace capability marquee

## Voiceover script (--voice, Kokoro)
Voice `am_michael` at 0.95 speed — calm, unhurried, mid-low register. Each line
lands inside its own scene and stops before the cut. ~30 words across 21.4s:
about 13s of speech and 8s of deliberate silence.

**The narration never reads the screen.** Every line does work the visuals do
not, which is why none of them repeats the copy underneath it.

1. "Most agencies stop at the screen." — sets up the hook before the hook lands
2. "Same four people on both sides of the connector." — names what the split means
3. "Delivered from one studio, in Karachi." — the numbers are already on screen
4. "You own the repo, the credentials, and every decision." — from the site's
   own handover copy; complements "It works after we leave."
5. "Xtenzium."

## Share copy (draft)
Most agencies say full-stack. We mean the stack includes the board — 65 projects,
4 continents, one studio in Karachi.

## Audio direction
- Role: sparse professional accents over a low, warm bed. The narration leads;
  music sits under it.
- Music: `happy-beats-business-moves-vol-12-by-ende-dot-app.mp3` — the calmest of
  the bundled set at 110 BPM, and the only one whose strong cues fall where this
  edit needs them. Held low throughout; it is room tone with intent, never the lead.
- Music treatment: fade in over the first 0.8s, duck to 0.12–0.15 under every
  narration line, hold flat through the middle, fade out across the final 1.5s.
  No drop, no build-and-release.
- Music cue guidance: bundled preset at
  `assets/music/cues/happy-beats-business-moves-vol-12-...music-cues.json`,
  110 BPM, beat grid ~0.54s. Two strong-cue locks only:
  **8.74s** (strength 0.99) for the bone-ground flip into the numbers scene, and
  **13.11s** (0.98) for the process rule completing. The hook takes natural timing
  — nothing in the first 4 seconds should feel snapped to anything.
  Beat-grid window for the eight alternating board/software items: consecutive
  beats from ~4.9s. They are one- and two-word labels revealed fast and then held
  as a full set for 1.4s, which is how they clear the read floor.
- Audio-reactive treatment: none. Any waveform-driven motion would contradict the
  tone.
- SFX posture: sparse. At most one dry accent per scene — a soft tick per stat
  counter settle, a low click on the process-rule draw, nothing on the outro.
- Audio-coupled moments: the counter ticks on `65+` and `4`; the alternating
  column items; the process rule drawing left to right.
- Restraint rule: no whooshes, no risers, no impacts, no stingers. If a sound
  draws attention to itself, cut it.

## Storyboard

### Scene 1 — The claim — 4.0s
Carbon ground. Eyebrow in mono: `KARACHI, PAKISTAN — SOFTWARE & HARDWARE`.
Headline in three masked lines, Bricolage Grotesque, mixed case, tight leading:
"We build the / software and the / board it runs on." — `board` in `#F2895C`.
Lines rise out of their masks 0.12s apart, 0.5s each, then hold ~2.4s.
Sequential/interaction: yes — three masked line reveals, staggered, then a full hold.
Audio intent: settle the room. Establish calm authority before anything moves.
Audio-coupled idea: one strong cue at the third line's settle. Narration line 1.
Music: low warm bed, fading in.
Transition mood: soft crossfade (0.7s) → Scene 2

### Scene 2 — The split — 5.0s
Carbon. A hairline vertical rule down the centre. Two column headers in mono:
`THE BOARD` (left) · `THE SOFTWARE` (right), copper-hi.
Items fade-and-rise in alternating order, left then right, ~0.55s apart:
KiCad · React · Altium · Astro · ESP32 · Node.js · LoRaWAN · PostgreSQL.
All eight hold together on screen for the final ~1.4s.
Sequential/interaction: yes — eight alternating item reveals, then a full-set hold.
Audio intent: rhythm without urgency. The alternation is the point.
Audio-coupled idea: reveals on every other beat; no per-item SFX (too busy).
Narration line 2.
Music: bed continues, ducked under narration.
Transition mood: clean cut → Scene 3

### Scene 3 — The numbers — 5.0s
Ground flips to bone `#FAFAF8` — the only palette inversion in the video, and it
carries the weight of the scene. Three stat blocks in a row, ink on bone:
`65+` / Projects delivered across web, hardware and automation
`4` / Continents we ship to
`1` / Studio, in Karachi
Numbers count up from zero over 1.0s, copper `#B8430F` on the digits, labels in
DM Sans below. Blocks arrive 0.4s apart; full row holds ~2.2s.
Sequential/interaction: yes — three count-up counters, staggered.
Audio intent: quiet confidence. The proof beat.
Audio-coupled idea: a soft dry tick as each counter settles. Narration line 3.
Music: strong cue on the ground flip.
Transition mood: soft crossfade (0.7s) → Scene 4

### Scene 4 — The process — 4.0s
Back to carbon. A single hairline rule draws left to right across the frame over
0.8s. Four nodes sit on it, revealed as the rule passes each:
`01 Scope` · `02 Design` · `03 Build` · `04 Handover` (mono numerals, DM Sans labels).
As the rule completes, one line appears beneath it in Bricolage Grotesque:
"It works after we leave."
Sequential/interaction: yes — rule-draw gated node reveals, then the closing line.
Audio intent: forward motion, then a full stop.
Audio-coupled idea: a low click as the rule completes. Narration line 4.
Music: bed thins out.
Transition mood: slow crossfade (0.9s) → Scene 5

### Scene 5 — Sign-off — 3.0s
Carbon, empty. `XTENZIUM` wordmark centred, generous letter-spacing, white.
Beneath it, small and in copper-hi: "We architect long-term success."
Below that, mono, `#FFFFFF` at 45%: `xtenzium.com`.
Fade up over 0.6s. Hold. Nothing else moves.
Sequential/interaction: none — deliberate stillness.
Audio intent: release. Let the last two seconds sit almost bare.
Audio-coupled idea: none. No stinger. Narration line 5 ("Xtenzium.") lands on the
wordmark, then silence.
Music: fade out across the final 1.5s.

**Total: 21.0s**

**Music mood for this video:** restrained / low warm ambient bed — never the lead.
**Audio summary:** A calm narrated spine over a low bed that ducks for every line,
punctuated by three dry accents and nothing more; the last 1.5 seconds fade to
near-silence under the wordmark.

---

## Build deltas (what changed between plan and composition)

Recorded honestly rather than back-edited into the storyboard above.

| Planned | Built | Why |
|---|---|---|
| 21.0s total | **21.4s** | Scene holds flexed to the generated narration, per the voiceover rule. |
| Scene 2: eight alternating items | **Six** (KiCad·React / ESP32·Astro / LoRaWAN·PostgreSQL) | Eight consecutive beats at 110 BPM ran to 8.19s and left only 0.4s of full-set hold. Six clears the read floor and holds ~1.1s. Altium, STM32, MQTT and Node.js dropped from screen; all six shown are on the site's real capability marquee. |
| Scene 3 stat 3: `1 / Studio, in Karachi` | unchanged | The site's third stat is the 36% ROI figure, which is internally estimated and deliberately excluded. `1 studio` is derived from the site's own "one Karachi studio" label. |
| Narration restates the hook | **Rewritten to complement** | The first pass read the on-screen copy back (12.8s → 21s of speech in a 21.4s video). Every line now does work the visuals don't. |
| Beat locks at ~0.6s and ~9s | **8.74s and 13.11s** | The two strongest cues in the preset that fall on real scene boundaries. The hook takes natural timing, as planned. |
| Music: generic "restrained bed" | `happy-beats-business-moves-vol-12` at `data-volume="0.34"` | Calmest bundled track (110 BPM); held low and carved. |
| Music treatment: "duck ~6dB" | **Spectral voiceover carve, strength 0.8** | A flat duck leaves the bed and voice fighting in 1–3 kHz. The carve dips six bands (160Hz–2.5kHz) on an envelope of the speech itself, so the bed returns between lines instead of staying flat. |

**Gate:** `npx hyperframes check` — 0 errors across lint, runtime, layout, motion and
contrast (24/24 contrast checks passed). The 5 remaining warnings are
`nested_structure_needs_subcomposition`, a Studio timeline-row display note that
does not affect the render.
