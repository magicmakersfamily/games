# Blow Up — known bugs

Reproducible problems in the current release (1.3). A fix must come with a test, or a step in the
browser smoke run, that fails before the fix and passes after. "Status" says how sure we are.
Unconfirmed bugs must be reproduced before they are fixed.

## B1. The day keeps running when nobody is watching
- **Seen:** ChatGPT's playthrough jumped from about 10:20 to 17:05 while it was away.
- **Status:** cause understood; the exact trigger is unconfirmed. `frame()` (`index.html`, the START,
  LOOP, CONTROLS section) caps each frame at 120 ms, and Chrome stops `requestAnimationFrame` in a
  truly hidden tab, so a hidden tab shouldn't jump. What does happen is that a tab that's visible but
  unattended (another window on top, or an automated browser) plays on at full speed.
- **Fix (P0-C2):** pause on `visibilitychange` (hidden) and on window `blur`. On return show one big
  narrated "▶ Continue Pip's day" button. Never catch up missed time.

## B2. A tapped card can be silently dropped when a pop-up opens
- **Status:** confirmed in code. When a card finishes, the one waiting card (`ACT.next`) starts only
  `if (S && !S.done && !S.pending && !isModal())`. Otherwise it's discarded and its dashed "queued"
  outline removed (`index.html` ~line 1517, inside `launch()`). A scheduled Say It Differently moment
  (`S.pending`) or any modal opening during a card's flight eats the waiting tap.
- **Fix (P0-C1):** keep the waiting card until the pop-up closes, then play it. Part of the phase
  machine and event queue.

## B3. Some lines fall back to the browser voice ("Hug", "Calm corner")
- **Status:** unconfirmed. The Hug and Calm corner card names, their first-use explanations and their
  `say` lines ("Squeeeze", "Cosy and quiet", spoken by the grown-up) are all in `tools/lines.json`,
  so the missing clip is some other line spoken around those cards. The fallback also triggers when a
  voice bank is still loading after 12 s.
- **Reproduce:** play with `#debug` in the URL, use Hug and Calm corner in different zones and
  phases, then read `BUDebug.voice().missing` (a list of `speaker: text` for every line with no
  recording).
- **Fix (P0-C5):** add the missing lines to `tools/voice-lines.js`, add the voice audit, and hide the
  "🤖 backup voice" tag from the child view (grown-up settings only).

## B4. Flower and candle during recovery shows "Skills practised: 0"
- **Status:** confirmed; it's a design gap, not a crash. `sim.js` gives skill XP only during the normal
  day in green/yellow (`if (c.skill && s.phase === 'day' && …)`). The receipt's "Skills practised"
  counts only that XP (`practice` in `SIM.receipt`), so a completed Flower and candle while cooling
  down counts for nothing, and nothing explains why.
- **Fix (P0-C3):** see DECISIONS D7: track *used* and *practised* separately, and show both.

## B5. Pip falls asleep while still "Almost boiling"
- **Status:** confirmed. Bedtime (`startBedtime()`) doesn't touch the meter, so it keeps its zone
  label (e.g. 69/88, red) next to a sleeping Pip.
- **Fix (P0-C4):** see DECISIONS D8.

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
