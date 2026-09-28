# Blow Up — notes for Claude (read before any work in this folder)

Blow Up is a self-regulation game for ages 4–7 on the Game Shelf. The repo-level `../CLAUDE.md`
rules (public repo, static files, git identity, release steps) apply here too.

## Start of every session

1. Read `PLAN.md` (what to do next, one task per session), `DECISIONS.md` (don't re-open these), and
   `KNOWN-BUGS.md`. `ENGINE.md` explains the model in `sim.js`, and `PLAYTEST.md` has how to run,
   tune and record voices, plus notes from real play.
2. Take the next ☐ task in PLAN.md. If it needs a decision that isn't in DECISIONS.md, ask first.
3. Finish by ticking the task in PLAN.md and committing. Durable decisions go in DECISIONS.md, not
   just in chat.

## Checks

- `node --test` in this folder: engine tests, plus golden snapshot and voice audit once PLAN A1/A3
  exist.
- `node balance.js`: headless day styles × strategies.
- `node tests/smoke.mjs` once A2 exists: the real page in headless Chrome.
- The user plays on a MacBook in Chrome. Real speech and buttons need real clicks: throwaway Chrome
  with `--user-data-dir` + `--remote-debugging-port`, driven over CDP. Chrome drops
  `speechSynthesis.speak()` right after `cancel()`; wait about 180 ms.
- `--dump-dom` with `--virtual-time-budget` hangs on this page (endless animation loop). Use
  `--screenshot` or CDP instead.

## Never

- Edit anything under `../versions/`. Frozen releases are read-only. A new release gets frozen with
  `../tools/freeze-version.sh`.
- Add a framework, bundler, npm dependency, analytics or network calls (only Google Fonts and the
  feedback page's Web3Forms post are allowed on the shelf).
- Turn pressure into a score, punish blow-ups, or reward quiet or obedience (DECISIONS D6).

## Who plays it, and what that means for the code

- **James is 5 and can't read.** Every step has to work by listening: a spoken storyteller, the
  clock waiting while it talks, big picture buttons, a "hear it again" button on everything.
- **Lines are heard, not read.** Check new narration aloud for double meanings (1.3 had to reword
  "the red cards make Pip's day harder"). Prefer "bring trouble", "help Pip feel better", "spills
  out".
- **He taps fast and repeatedly.** One action at a time, repeat taps combine, effects diminish,
  and the same spoken line never plays twice in a row.
- **Chinese is Traditional, Mandarin, zh-TW** (never zh-HK), with pinyin.
- **Tone:** warm and a bit silly. Blow-ups are funny-dramatic, not scary.

## Recorded voices

Every spoken line is pre-recorded (Kokoro-82M via kokoro-onnx, Apache-2.0, run locally; Mandarin
words with the macOS "Meijia" voice). Voices: narrator `af_heart`, Pip `af_bella` ×1.12, grown-up
`bf_emma`, Professor Pickle `bm_fable` ×1.1. Lines missing a clip fall back to browser speech.

- Add or change lines in `content.js`, then run `node tools/voice-lines.js` and
  `python tools/render-voice.py <model-dir>`. Setup and model location: see PLAN A3. Once it's done,
  record the exact commands here.
- Quality rules the user approved: 64 kbps MP3 via a WAV intermediate; plain gain levelling (not
  one-pass loudnorm, which pumps on short clips); raise pitch by resampling only (asetrate+atempo
  warbles).
- Claude can't listen, so send the user 2–3 sample clips before replacing a voice or re-rendering
  everything.
- Clips are packed into one MP3 bank per speaker plus `voice/manifest.json` (claude.ai artifacts
  allow at most 255 files).
