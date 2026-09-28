# Blow Up — known bugs

Reproducible problems in the current release (1.3). A fix must come with a test, or a step in the
browser smoke run, that fails before the fix and passes after. "Status" says how sure we are.
Unconfirmed bugs must be reproduced before they are fixed.

## B1. The day keeps running when nobody is watching
- **Seen:** ChatGPT's playthrough jumped from about 10:20 to 17:05 while it was away.
- **Status:** FIXED in PLAN C2 (2026-09-28, for 1.4). `js/main.js` now pauses on `visibilitychange`
  (hidden) and on window `blur` for more than 2 s, and shows a narrated "▶ Tap to continue Pip's
  day" button on return — it never resumes by itself, since a `document.hidden` flip isn't always
  "the child left" (a quick tab switch, a notification). Never catches up missed time. Guarded by
  `tests/smoke.mjs` step 5c, which fails on the pre-fix code. The original cause was as suspected:
  a tab that's visible but unattended (another window on top, or an automated browser, which is
  likely what ChatGPT's setup was) played on at full speed, since nothing was watching for that.

## B2. A tapped card can be silently dropped when a pop-up opens
- **Status:** FIXED in PLAN C1 (2026-09-28, for 1.4). A waiting card now stays waiting (dashed
  outline) through any pop-up and plays when it closes; taps while a choice is about to pop up wait
  too. Guarded by step 5b of `tests/smoke.mjs`, which fails on the 1.3 code. Original report:
- **Was:** confirmed in code. When a card finishes, the one waiting card (`ACT.next`) starts only
  `if (S && !S.done && !S.pending && !isModal())`. Otherwise it's discarded and its dashed "queued"
  outline removed (`index.html` ~line 1517, inside `launch()`). A scheduled Say It Differently moment
  (`S.pending`) or any modal opening during a card's flight eats the waiting tap.
- **Fix (P0-C1):** keep the waiting card until the pop-up closes, then play it. Part of the phase
  machine and event queue.

## B3. Some lines fall back to the browser voice ("Hug", "Calm corner")
- **Status:** the "missing recording" hypothesis is ruled out, thoroughly, as of PLAN C5
  (2026-09-28). Beyond `tests/voice.test.js` passing clean, a scripted sweep drove every UHOH,
  HELPER and TOOL card (including Hug and Calm corner) through every phase (day, eruption, cooling,
  reconnect, repair, learn) at tap counts 1–3, with the narrator unlocked and the voice queue
  drained after each batch: 164 clips played, `fallback: 0`, `missing: []`. `tests/smoke.mjs` now
  also fails the run if a real playthrough's `BUDebug.voice().missing` is non-empty, so this is
  checked on every future change too, not just today's sweep.
- **What's left, if it's ever seen again:** not a missing recording. Two explanations remain: the
  12-second "still loading" fallback (a slow connection, or many banks loading at once — transient,
  resolves once the fetch finishes), or a bad clip that `clipFor` finds but that fails to decode or
  play. Reproduce with `#debug` in the URL and read `BUDebug.voice()`: `missing` lists lines with no
  clip at all; `fallback` counts every backup-voice use, including a decode failure, so
  `fallback > 0` with `missing` empty points at the network or a corrupt clip, not the recordings.
- **Fixed regardless:** the "🤖 backup voice" tag was visible to the child on every fallback,
  whatever the cause. It now only shows when a grown-up has turned on Settings → "Show voice
  details" (`prefs.voiceDetails`, off by default) — a child hearing a slightly different voice
  doesn't need that explained on screen mid-story.
- **Fix (P0-C5):** add the missing lines to `tools/voice-lines.js`, add the voice audit, and hide the
  "🤖 backup voice" tag from the child view (grown-up settings only).

## B4. Flower and candle during recovery shows "Skills practised: 0"
- **Status:** FIXED in PLAN C3 (2026-09-28, for 1.4). It was a design gap, not a crash: `sim.js` only
  ever gave skill XP during the normal day in green/yellow, and the receipt's single "Skills
  practised" number showed only that, so a completed Flower and candle during recovery counted for
  nothing and nothing explained why. Now `sim.js` tracks *used* (any completed skill-tool use, any
  phase) alongside *practice* (calm-only, unchanged), and the receipt shows both: "Tools that
  helped" and "Practised while calm". Guarded by two `sim.test.js` tests and `tests/smoke.mjs` step
  5d (skipping the breathing guide counts as neither, which fails on the pre-fix code).

## B5. Pip falls asleep while still "Almost boiling"
- **Status:** FIXED in PLAN C4 (2026-09-28, for 1.4). The pill now always shows "💤 Sleeping" once
  bedtime starts, whatever zone the day ended in, and the meter visibly drains toward (never below
  ~15% of threshold, never above the real end-of-day level) over the lullaby — Option A from
  DECISIONS D8 ("sleep begins recovery"). A day that ended yellow or red also gets one gentle
  narration line explaining that big feelings might still be there tomorrow. Guarded by
  `tests/smoke.mjs` step 6b, which fails on the pre-C4 code.

## B6. The ending is a text receipt called "Cost of the Day"
- **Status:** confirmed. It's unreadable for pre-readers, and the framing is accounting ("what it
  cost"), not growth.
- **Fix (P1, 2.0):** see DECISIONS D9. In 1.4 the receipt only gets renamed to "Day log" and loses the
  word "cost".

## B7. Predict mode is hidden in Settings
- **Status:** confirmed (`prefs.predict`, off by default, toggle in ⚙︎). It's one of the strongest
  learning moments.
- **Fix:** 1.4 turns it on by default and swaps the 😌/😠 faces for fuller/emptier bucket pictures;
  2.0 makes it part of the guided loop. A wrong guess is never a failure ("Let's see what Pip's body
  does"). The "Predictions right x / y" score in the Grown-Up View becomes a count of discoveries.
