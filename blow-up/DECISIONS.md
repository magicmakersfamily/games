# Blow Up — design decisions

Decisions that a fresh session must not re-open without asking the family. Newest first. Each entry
says what was decided and why. If a task seems to need a different answer, stop and ask; don't
quietly change course.

## 2026-09-28: the 2.0 direction (after ChatGPT's full playthrough of 1.3)

**D1. Every release stays playable.** Each release is tagged `blow-up-vX.Y` and frozen at
`versions/blow-up/X.Y/` with `tools/freeze-version.sh` (repo root). Frozen copies are never edited.
They have their own saved games (localStorage keys prefixed `blow-up@X.Y:`), a noindex tag and a thin
"old version" strip. Index: `versions/index.html`. Why: the family wants to compare versions, bring
back ideas that got lost, and fork an older version in a new direction. No "classic" naming, just
version numbers.

**D2. Ship P0 as 1.4 before the redesign.** The bug fixes (pausing, lost taps, skill counting,
bedtime, narration) ship as 1.4, still the whole-day simulator, and 1.4 gets frozen. The guided
redesign is 2.0. Why: 1.4 is the best fork point for the simulator direction, and it keeps bug fixes
separate from design changes.

**D3. 2.0 is guided by default; the card wall stays as Free play.** The default child experience is a
guided loop, Notice → Predict → Choose → Watch → Understand, with at most three big choices at a
time. The full card trays stay available as a mode called **Free play**, one tap from the start
screen. They aren't buried in Settings. Why: poking at the system is what makes Blow Up special for
older kids and grown-ups, but a 5-year-old needs one clear thing to do at a time.

**D4. The engine stays; guided mode sits on top of it.** `sim.js` remains the single model of Pip.
Guided mode is driven by the scene data that already exists in `content.js`: `fx` events become
Notice/Predict/Watch moments, and `say` events (Say It Differently) become the Choose step. Scenes are
already declarative, so there's no new scene engine. New fields go on the existing scene objects.

**D5. Chapters are stop points in one continuous day.** A day has 4–5 chapters of about 3–5 minutes.
At a chapter boundary the game shows a short spoken chapter ending, saves, and stops. "Continue" goes
on with the same day. Saving works by serialising the sim state. If that turns out not to be plain
data, it stores seed + input log and replays (the engine is deterministic). In guided mode, quiet
stretches between events run fast, with a spinning clock. The first run plays chapter 1 of the
Rushed school day with no day picker. The picker appears after chapter 1.

**D6. Pressure is never the score.** No "keep it low" goal, no penalty for blow-ups, no rewards for
quiet or obedience. The success words are noticing, predicting, helping, reconnecting and fixing
things. "Blowing up isn't losing. Learning why is winning." stays.

**D7. "Used" and "practised" are different, and both are shown.** Completing a calming activity
always counts as *used* (it appears in "What helped"). Skill XP, the thing that makes Pip start using
a skill alone, still comes only from practice while Pip is calm (green/yellow). That part is the
science and stays. The ending shows both: "Tools that helped: 3 · Practised while calm: 1". A skipped
activity counts as neither.

**D8. Bedtime: sleep begins recovery.** During the bedtime scene the bucket visibly drains toward an
overnight level, and the zone label changes to "Sleeping 💤" (never "Almost boiling" next to a
sleeping Pip). If the day ended high, the storyteller says so gently: sleep helps, some big feelings
may still be there tomorrow, and that's OK. This is presentation plus one narration line. Engine
numbers and the day log stay honest.

**D9. The child ending is three spoken picture panels.** What made today hard? (the top three fillers,
shown as scenes) → What helped Pip? → What did Pip learn? Then: add a sticker to Pip's toolbox, hear
it again, play another chapter. The receipt becomes the **Day log** in the grown-up area, and the
word "cost" is dropped everywhere.

**D10. The grown-up area is plain first, numbers second.** The default grown-up summary has four
lists: what filled the bucket, what Pip's body showed, what helped, and one phrase to try next time.
Pressure numbers, cortisol, the equation and the graph move under "How the game's model works",
labelled: *"These numbers are part of the game's model. They are not measurements of a child's body
or a diagnostic assessment."* The gate is press-and-hold, never a reading or maths question.

**D11. The child header is small.** Pause, Hear again, a time-of-day picture, and one grown-up
button (press-and-hold). Speed, voice, captions, less motion, sticker book and settings live behind
the grown-up button.

**D12. No framework, no bundler.** The game stays plain HTML/CSS/JS served as static files, per the
shelf rules. `index.html` gets split into a few plain `<script>` files that share top-level
declarations (the current code is one IIFE). There are about 10 files, not 25.

**D13. Keep the voice and humour.** Warm, a bit silly, never preachy. Specific praise is preferred,
but lines don't turn into therapy scripts. Every new line is checked for how it *sounds* (lines are
heard, not read; see 1.3). Touch is Pip's preference, not a rule: the Hug card already backfires for
kids who need space, and the connection choice (hug / hand / nearby / space) is a P2 item.

## What we're deliberately not doing (from the ChatGPT brief)

- The React/TypeScript component tree and type definitions. The ideas behind them (one game phase at
  a time, an event queue, data-driven scenes) are adopted in plain JS.
- A 20-test UI suite. We use engine tests, a golden-run snapshot, one scripted browser playthrough,
  and a voice audit instead.
- P3 items for now: switch-access testing, visual narration for Deaf pre-readers, more language packs,
  more family structures. They're good goals, parked in PLAN.md's backlog.
- An idle auto-pause during open play in Free play mode. The day running by itself is the point
  there. Leaving the tab or window does pause it (see KNOWN-BUGS B1).
