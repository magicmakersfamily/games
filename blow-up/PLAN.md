# Blow Up — plan for 1.4 and 2.0

This file is the handoff between sessions. Read it together with `CLAUDE.md` (in this folder),
`DECISIONS.md` and `KNOWN-BUGS.md`. **Do one task per session**, in order, and tick it off here in the
same commit that finishes it. If a task turns out bigger than described, or needs a decision that
isn't in DECISIONS.md, stop and ask.

Status: ☐ to do · ◐ in progress · ☑ done

## Where we are (2026-09-28)

- 1.3 is live at `blow-up/`. It's tagged `blow-up-v1.3` and frozen at `versions/blow-up/1.3/`
  (1.2 is there too).
- The engine (`sim.js`, `content.js`) has 21 tests (`node --test`) and a headless balance run
  (`node balance.js`).
- `index.html` is about 2,300 lines: CSS, SVG art and all the game UI in one IIFE. It has a
  `#debug` hook (`window.BUDebug`: `state()`, `ff(n)`, `voice()`).
- Voice re-recording needs Kokoro set up again: the model and venv from the 1.2 session are gone
  (task A3).

## Phase A: safety net (no behaviour changes)

**☑ A1. Golden-run snapshot of the engine.**
Add `tests/golden.test.js`. It runs `SIM.runDay` for both playable day styles × every strategy in
`balance.js` × seeds 1–5, reduces each run to a compact summary (end pressure, blow-up times and
types, phase sequence, jar totals, receipt lines, skills xp), and compares it with a committed
`tests/golden.json`. `UPDATE_GOLDEN=1 node --test` rewrites the file.
- Files: `tests/golden.test.js`, `tests/golden.json`. Nothing else changes.
- Done when: `node --test` passes, and changing any number in `sim.js` `CONFIG` makes it fail.

**☑ A2. Scripted browser playthrough (smoke test).**
Add `tests/smoke.mjs`: a Node script with no dependencies (Node 26 has a built-in `WebSocket`). It
starts `python3 -m http.server` and headless Chrome with a throwaway `--user-data-dir` and
`--remote-debugging-port`, then drives the real page over CDP with real clicks
(`Input.dispatchMouseEvent`). It uses `#debug` + `BUDebug.ff()` to skip quiet time. Steps: start
screen → ▶ → first Say It Differently choice → play Uh-oh cards until a blow-up → through all
recovery stages with helper cards → bedtime → receipt visible → a saved day in localStorage. At each
step it takes a screenshot into `tests/out/` (gitignored). At the end it prints `BUDebug.voice()`
stats and fails on any JS error in the console.
- It may add read-only fields to the `#debug` hook (phase, which modal is open). No other changes.
- Done when: `node tests/smoke.mjs` passes on 1.3 twice in a row and the screenshots look right.
  Note in PLAYTEST.md how to run it.

**☐ A3. Restore the voice pipeline.**
Set up kokoro-onnx in a venv at `~/.local/share/blowup-voice/venv`. Download the Kokoro-82M ONNX
model and voices file into `~/.local/share/blowup-voice/model` (check `tools/render-voice.py` for the
file names it expects), plus `brew install espeak-ng` and ffmpeg if they're missing. Render all
lines. Because `tools/.cache` is gone, every line re-renders: compare 3–4 old and new clips, and send
the user a couple of samples before replacing `voice/`. Keep the settings in PLAYTEST.md (64 kbps,
plain gain, resample-only pitch).
- Add `tests/voice.test.js`: every entry in `tools/lines.json` has a clip in `voice/manifest.json`.
- Done when: the render reproduces the current bank (or the user approves the new one), the voice
  test passes, and the setup steps are written in `CLAUDE.md` (this folder).

## Phase B: split index.html (zero behaviour change)

**☐ B1. Mechanical split.**
Move code out of `index.html` without changing it:
```
blow-up/
  index.html        markup only + <script> tags in order
  css/game.css      the two <style> blocks
  js/art.js         the ART script (SVG strings)
  js/core.js        $, esc, constants, store, prefs, game state vars (top of the GAME IIFE)
  js/audio.js       SOUND + storyteller voice
  js/scene.js       SCENE, control room, particles, blow-up effects, thought bubbles
  js/meters.js      BUCKET, JARS, GRAPH
  js/cards.js       TRAYS, DRAG AND DROP, one card at a time, doUse
  js/events.js      EVENTS FROM THE ENGINE + PROFESSOR PICKLE
  js/modals.js      MODALS (say, pick, validate, breathing, predict, science)
  js/grownup.js     GROWN-UP VIEW
  js/ending.js      BEDTIME, RECEIPT, SAVED DAYS, COMPARE, stickers, menu
  js/main.js        START, LOOP, CONTROLS, tour, tap-to-explain, boot (last)
  content.js sim.js (unchanged)
```
Remove the IIFE. Top-level `const`/`let` in classic scripts share one global scope, so cross-file
references keep working. Keep `'use strict'` in each file. Move the code in small commits (CSS first,
then art, then one section at a time) and run A1 + A2 after each one.
- Watch for: code that runs at load time and uses something defined later (it has to stay in
  `main.js`); `COVER` / `#cover` rendering; `tools/voice-lines.js` (it reads `content.js`, which
  doesn't change).
- Done when: golden + smoke pass. Screenshots of `index.html#cover` and the smoke steps are
  pixel-identical to 1.3 at 1280×800 and 390×844. `grep -c "" index.html` is under 150.

## Phase C: P0 fixes, shipped as 1.4 (still the simulator)

**☐ C1. One game phase at a time + event queue** (KNOWN-BUGS B2). *Hardest task: use Opus, or Sonnet
at high effort.*
Add a single `phase` variable in `main.js`: `PLAY`, `MODAL`, `STORY` (the storyteller holding the
clock), `BLOWUP`, `BEDTIME`, `AWAY`, `PAUSED`. Transitions go through one function. The clock
advances only in `PLAY`. Every modal opens through one function that enters `MODAL` and returns to
the previous phase on close. Automatic moments (`S.pending`, predict, Pickle) wait in a queue while
another is open. A waiting card tap (`ACT.next`) survives a modal and plays after it. Every accepted
tap gets instant feedback (the existing pop/queued outline).
- Tests: extend the smoke run with a tap during a card's flight right before a Say It Differently
  moment, and check that the card still plays after the choice.
- Done when: the smoke run passes, including the new step. The existing flags (`paused`,
  `isModal()`, `freezeUntil`, `narrHolding()`) are expressed through `phase` or documented as feeding
  into it.

**☐ C2. Pause when away** (B1).
On `visibilitychange` → hidden, or window `blur` for more than 2 s: enter `AWAY` and stop speech. On
return, show one big ▶ with the spoken line "Tap to continue Pip's day". No catch-up.
- Test: smoke step that dispatches a hidden `visibilitychange`, waits 3 s, and checks the clock
  didn't move and the continue button is shown.

**☐ C3. Tools used vs practised** (B4, DECISIONS D7).
In `sim.js`, record each completed calming tool with its phase and zone. `SIM.receipt` returns
`used: {toolId: n}` next to `practice`. The receipt shows "Tools that helped" and "Practised while
calm". Flower and candle counts only after the breathing guide finishes. If it's closed early, it
counts as neither.
- Tests in `sim.test.js`: a completed breathe while cooling → `used.breathe === 1`, `practice`
  unchanged; breathe in green → both go up. Update `tests/golden.json` deliberately in the same
  commit and say why.

**☐ C4. Bedtime settles the bucket** (B5, D8).
During bedtime, animate the meter down toward an overnight level over the lullaby and show
"Sleeping 💤" instead of the zone label. Add one narration line for a day that ended high, e.g.
"Sleep helps Pip's body rest. Some big feelings might still be there tomorrow, and that's okay. Pip
will have help." Read it aloud for double meanings.
- Done when: the smoke run's bedtime screenshot shows Sleeping 💤, and the line is recorded (A3).

**☐ C5. Narration audit** (B3).
Reproduce B3 with `BUDebug.voice().missing` and add the missing lines to `tools/voice-lines.js`. The
smoke run fails if `missing` is not empty. The "🤖 backup voice" tag shows only when grown-up
settings have "Show voice details" on. Re-render voices.

**☐ C6. Small 1.4 polish.**
Predict mode on by default, with the 😌/😠 faces replaced by two big bucket pictures (fuller /
emptier). A wrong guess says "Let's see what Pip's body does." with no score. The receipt is renamed
"Day log", "COST OF THE DAY" becomes "PIP'S DAY", and the narration lines are updated to match.

**☐ C7. Release 1.4.**
Run everything, follow the shelf's release steps (version line, README table, feedback links,
`VERSION`), tag `blow-up-v1.4`, run `tools/freeze-version.sh blow-up 1.4 blow-up-v1.4`, add the row
to `versions/index.html`, push, and verify the live site.

## Phase D: P1, the guided redesign, shipped as 2.0

Build D1–D7 behind `?v2` (or a grown-up setting) so 1.4 stays playable on `main` until 2.0 ships.
Each task: new lines recorded, smoke run extended, screenshots checked at 390×844 and 1280×800.

**☐ D1. Body signals layer.** Animated clues on Pip, driven by the sim state: heart pulse speed,
faster breathing, fists, warm face, raised shoulders, and a "gone quiet" look (Pip can go quiet, not
only loud). Also background clutter/noise that grows with sensory load. Visual only, respects less
motion. Tapping a clue plays a short line, with a varied voice ("Pip's hands are getting tight",
"The grown-up notices it", "It's a very small clue").

**☐ D2. Guided loop.** For each scene `fx` event with `amount ≥ 5`: **Notice** (tap a body clue, or
"nobody notices yet") → **Predict** (fuller/emptier bucket) → **Watch** (the existing drop
animation, dog/owl reaction) → **Understand** (one short line; add `why` text to the scene events in
`content.js`). Say It Differently moments are the **Choose** step (two big picture buttons). At most
3 child choices on screen. Familiar events skip Notice/Predict after the second time. In guided
mode, quiet stretches run at 4× with a spinning clock. Free play (the 1.4 card wall) stays as a
start-screen choice.

**☐ D3. Chapters and saving.** Add `chapters` to the rushed and adventure day styles in `content.js`
(e.g. Morning rush 7:00–8:00 · School 8:00–15:00 · After school 15:00–16:45 · Dinner and bedtime
16:45–20:00). Show a chapter-end card (spoken, 2 pictures of what happened), save, and continue or
stop. Resuming restores the exact state (D5 in DECISIONS). The day picker appears after chapter 1 of
the first day.

**☐ D4. First-run onboarding.** Big ▶ → Pip says hello → "Tap Pip's heart" (pulses, responds) → one
drop falls into the bucket → "Fuller or emptier?" → chapter 1 starts. Target: a non-reader makes the
first real choice within 30 s. The old tour stays on ❓.

**☐ D5. Recovery by stage.** In guided mode each stage shows only its 2–3 tools (Storm: stay close,
few words, "I'm here". Cool: water, stomp, flower and candle, calm corner. Reconnect: name it, wish
it, space-or-company. Repair: grown-up says sorry, fix it together, check on others. Grow: specific
praise, practise a tool, plan for next time). Put the lists in `content.js`. After a Cool tool: "Did
that help?" [Yes, a little] [Not this time]. "Not this time" offers a different kind of tool.

**☐ D6. Child ending + grown-up summary.** Three spoken picture panels and the end actions (D9), and
the plain four-list grown-up summary with the numbers behind "How the game's model works" (D10). The
Day log stays in the grown-up area.

**☐ D7. Child header + grown-up area.** Header per D11. Press-and-hold grown-up button. Check
320×568, 390×844, 768×1024, 1024×768 and 200% zoom: no clipped dialogs, and targets at least 48 px.

**☐ D8. Playtest with James, then release 2.0.** Watch one chapter in guided mode, write notes in
PLAYTEST.md, fix what matters, then release as in C7 (tag, freeze, versions row, beta badge stays).

## Backlog (P2/P3, not scheduled)

Interactive calming activities (trace the flower breath, tap the dinosaur stomp to a slowing beat,
squeeze-and-release, drag the water cup) · connection choice (hug / hand / nearby / space) · Pip's
toolbox and stickers · customise Pip · more chapters (playground transition, child-led adventure) ·
preferred-tool discovery · visual narration for Deaf pre-readers · switch/keyboard pass · more
languages · other family structures and caregivers.

## Risks

- **The split breaks something subtle** (load order, `#cover`, globals clashing with `content.js` /
  `sim.js` names). Mitigation: A1 + A2 first, small commits, pixel-compare screenshots.
- **Voice drift.** Re-rendering everything after the cache loss may change how familiar lines
  sound. Mitigation: A3 compares clips and asks the user before replacing.
- **Guided mode fights the simulator's clock.** Mitigation: C1's single `phase` lands before any
  guided work, and guided mode only adds phases.
- **Chapter saving.** Sim state might not be JSON-safe. Mitigation: fall back to seed + input log
  replay (D5).
- **Scope creep from the brief.** Anything not in this file goes to the backlog, not into a task.
