# Toothbrush Coach — plan and handoff

Called Toothbrush Timer up to 2.0; the folder stays `toothbrush/` so links keep working. In beta
(purple badge) while the family tests it with kids.

Read this before working on the game. The product notes the family wrote after testing 1.0 with James
are kept word for word under "Product notes" below; this top part says where development stands.

## Files

- `lesson.js` — the model: 12 cues (4 quadrants × outside, chewing tops, inside), sugar bugs tied to a
  quadrant, surface and tooth, brush pose, and the timeline (start, pause, tick, reset, setDuration).
  Everything visible is a pure function of (elapsed, duration).
- `lesson.test.js` — `node --test toothbrush/lesson.test.js` (bugs never ahead of or behind the timer,
  brush never leaves the coached quadrant/surface, pause freezes, reset restores, duration change keeps
  the place).
- `index.html` — drawing, audio queue, session screens, settings.
- `lines.json` — every spoken line (the screen text is separate and never spoken).
- `voice/` — the lines recorded with Kokoro-82M `af_heart` (same narrator as Blow Up). Re-record after
  editing `lines.json`: `~/.local/share/blowup-voice/venv/bin/python toothbrush/tools/render-voice.py ~/.local/share/blowup-voice/model`
  (needs ffmpeg and `brew install espeak-ng`). Each line must stay under about 4.5 s so it fits a
  5-second cue in 1-minute mode. Browser speech is only a backup and shows a "backup voice" tag.

## Status (2.1 beta, October 3, 2026)

Done in 2.1 (from the 2.0 retest at the end of the notes):
- Renamed to Toothbrush Coach.
- Sync: bugs are drawn on top of the brush and never squeeze below 70 %, so every bug the model
  counts is visible; the screen-reader description updates whenever the count changes; the last
  bug goes at the completion boundary. Checkpoint tests at 120…0 s remaining in `lesson.test.js`,
  and a browser check compares the bugs actually painted (`__toothbrush.drawn`) with the model and
  the description at the same checkpoints.
- A face: two eyes above the mouth. Always a mirror view (stated once in Grown-ups). The eyes look at
  the next quadrant 0.8 s before the brush moves (`Lesson.gaze`), blink and lift their eyebrows at
  each quadrant change, look at Start on the ready screen, rest half-closed when paused, look at the
  tongue at the end and come back happy with the smile. Calm mode: no idle blinking.
- A soft glow on the quadrant being brushed; an arrow (↗ ↖ ↙ ↘) on the coaching line.
- "Younger child, or a grown-up helps" (default) says "this side / the other side / the same side"
  instead of left and right; "Big kid" keeps left and right. The old flipped helper view is gone.
- Header: one Grown-ups button (sound and voice switches are in Grown-ups); fits at 320 px.

Done in 2.0 — P0 and P1 from the notes:
- One timeline drives timer, voice, brush, active target, progress, bug removal, pause, reset, completion.
- Four quadrants × outside / chewing tops / inside, 10 s each at 2 minutes; chime at 30/60/90 s, softer
  cue at each surface change; untimed "brush your tongue, spit, and show your smile" at the end.
- Bugs belong to one quadrant + surface + tooth; only the coached ones move; they leave one by one as
  the brush reaches their tooth, the last exactly at the end of its cue.
- Brush stays in the coached quadrant: small circles outside, back-and-forth on the molar tops, short
  strokes inside, upright with up-and-down strokes behind the front teeth; it appears in a new quadrant
  instead of travelling across the mouth.
- New ending: the open mouth fades into a natural smile at the same size, three sparkles twinkle once
  and stay. Confetti removed.
- One coaching line instead of the five-box strip; thin progress ring with four quarter dots.
- Recorded voice, separate from screen text; chimes and voice queued so they never overlap.
- "I brush by myself" (mirror view) and "A grown-up helps" (view facing the child, "their right").
- Settings pause the session; leaving the page pauses; start over needs a press-and-hold; Brush again
  resets and scrolls to the top; header, footer and settings hidden while brushing; whole session fits
  100dvh down to 320 px; real buttons, labelled toggles with pressed state, native switches, `<dialog>`
  with focus return, Space to pause/resume; calm mode (muted colors, still bugs, quieter chimes).
  "Time" became "Timer settings".

Not done yet:
- P2: a companion whose mouth gets cleaned with the child's, small local-only rewards, gentle
  morning/evening habit tracking, per-child profiles, a parent view of completion history.
- Pronunciation/timing QA for other languages (English only for now).
- Child testing against the success measures at the end of the notes.

## Product notes (from the family, October 3, 2026, updated after the 2.0 retest)

### Toothbrush Coach — Integrated Product Notes

Updated October 3, 2026 after live testing and James's hands-on feedback.

#### Product north star

Build the most trustworthy, delightful app for teaching children to brush: clinically sound, extremely simple, synchronized to the child's real task, audio-first, privacy-first, and rewarding without being distracting.

The app should be **glanceable, not watchable**. A child should mostly watch their own brushing in the mirror and rely on clear voice, sound, and occasional visual cues.

#### James's observations — now core requirements

##### 1. Sugar bugs disappear too early and in the wrong places

This breaks the teaching model: the screen claims that teeth are clean before the guided brushing has reached them.

Required behavior:

- Divide every sugar bug into a specific quadrant and tooth-surface target.
- Only bugs in the currently instructed target may react or disappear.
- Bugs disappear progressively during that target's allocated time, with the last bug disappearing at the end of the segment—not before it.
- Bugs in future quadrants remain completely unchanged.
- Pausing freezes all brush movement, timers, progress, and bug state.
- Reset restores every bug and all visual progress.
- Changing duration recalculates disappearance timing without skipping or clearing targets.
- At every frame, the visible state must truthfully match the timer and current coaching cue.

Without a camera or connected toothbrush, the app cannot know the physical toothbrush's real location. The honest model is: the animated brush and bugs represent the **currently instructed quadrant and surface**, not verified real-world cleaning.

##### 2. The sweep animation is inaccurate

The current sweep travels around roughly three-quarters of the mouth. That teaches the wrong location and movement.

Replace it with surface-specific motion:

- The brush head stays entirely inside the active quadrant.
- Outer surface: short, gentle tooth-width strokes or small circles along that quadrant's gumline.
- Chewing surface: short back-and-forth strokes over that quadrant's molars.
- Inner surface: short strokes inside the same quadrant.
- Behind the front teeth: show the brush tilted vertically with up-and-down strokes.
- The handle angle and bristle contact should remain believable; the brush must not float through the mouth or cross inactive teeth.
- Transitions between targets should be quick and explicit, never a broad decorative sweep.

Animation acceptance test: pause at any moment and ask, “Which exact teeth and surface should the child be brushing?” The answer must be obvious from the frame alone.

##### 3. The ending smile looks inflated

The completion state should feel beautiful, calm, and aspirational—not like the mouth or face is expanding.

Required ending:

- Reassemble the teeth into a natural, evenly aligned smile.
- Use a believable curved lip shape and natural mouth proportions.
- Keep the final mouth the same approximate scale as the brushing mouth.
- Add restrained sparkle highlights on several teeth rather than scaling or exploding the whole face.
- Use one short, polished celebration animation, then settle into a still “sparkly smile.”
- Keep the primary reward and “Brush Again” action inside the viewport.

##### 4. The five-step strip creates too much text

Remove the row of five labeled boxes (“Top Fronts,” “Top Backs,” etc.). It competes with the mouth and is difficult to scan while brushing.

Use one minimal coaching line only, for example:

> Upper right · Outer surfaces

Optionally pair it with a thin progress ring around the mouth or four tiny quadrant dots. Do not show the whole lesson plan during the session.

##### 5. The voice reads symbols and sounds artificial

Never send visible UI copy directly to speech synthesis.

Required voice architecture:

- Maintain separate `displayText` and `spokenText` for every cue.
- Spoken strings contain no emoji, decorative punctuation, ampersands, arrows, step numbers, or UI labels.
- Example display text: `Upper right · Outer ✨`
- Example spoken text: `Brush the outside of your upper-right teeth.`
- Do not announce “Step one,” symbols, timer labels, or decorative words unless pedagogically useful.
- Select the best available natural child-friendly voice and rate; fall back gracefully when it is unavailable.
- For App Store quality, evaluate professionally recorded prompts or consistent high-quality cached neural speech so the voice does not vary unpredictably across devices.
- Voice cues must finish before the next cue and must not overlap sound effects.
- Add pronunciation and timing QA for every supported language.

#### Recommended two-minute lesson

Replace the five equal stages with four 30-second quadrants. Within each quadrant, use three ten-second surface cues:

1. Upper right — outer, chewing, inner
2. Upper left — outer, chewing, inner
3. Lower left — outer, chewing, inner
4. Lower right — outer, chewing, inner

At 30, 60, and 90 seconds, use a gentle chime and a clear location change. At each ten-second surface change, use a softer cue.

After the full two minutes, add a short untimed prompt: “Brush your tongue, spit, and show your smile.” This keeps the recommended tooth-brushing time focused on all tooth surfaces.

The ADA recommends brushing outer, inner, and chewing surfaces, with vertical strokes behind the front teeth: https://www.mouthhealthy.org/all-topics-a-z/brushing-your-teeth/

#### Minimal in-session screen

During brushing, show only:

- One-line location and surface instruction
- The mouth and accurately positioned brush
- A large countdown/progress ring
- Pause/resume
- A protected reset action

Hide the footer, promotional copy, full step list, settings, and secondary links until the session is paused or complete. The entire active experience must fit within `100dvh` without scrolling.

#### Version 1.0 live-test defects

These were confirmed in the original build. The version 2.0 retest below records the substantial fixes and remaining regressions; do not treat resolved v1 items as open work.

- “Brush Again” resets the lesson but leaves the victory card visible and retains the old scroll position.
- The central Play triangle lacks an accessible button role and name.
- Settings switches work through the drawn switch but not through their semantic checkbox target.
- Opening Parent Settings during an active session does not pause the timer.
- Reset is immediate and too easy to trigger accidentally.
- The completion reward and key controls can fall below the fold.
- The Settings icon is clipped at a 320-pixel viewport width.
- “Time” opens settings and should be labeled “Duration” or “Timer settings.”
- Low-stimulation mode needs a substantially calmer visual treatment.
- Icon-only sound, voice, and settings controls are difficult to distinguish.

#### Priority plan

##### P0 — Correctness and trust

- Build one authoritative timeline/state machine for timer, voice, brush path, active target, progress, bug removal, pause, reset, and completion.
- Implement quadrant- and surface-bound brush paths and bug groups.
- Replace the ending animation and fix the replay flow.
- Pause automatically when settings or the browser background interrupts the session.
- Fix Play, switch, modal, focus, and keyboard accessibility.
- Fit the entire active experience into the viewport at widths down to 320 pixels.

##### P1 — Teaching quality

- Adopt the four-quadrant, three-surface lesson.
- Add vertical inner-front strokes and a final tongue/spit prompt.
- Replace the five-box strip with one coaching line.
- Separate display copy from polished spoken prompts.
- Add a younger-child “Grown-up helps” mode and an independent-brusher mode.

##### P2 — Delight and retention

- Introduce one lovable companion whose mouth is cleaned in sync with the child's lesson.
- Unlock one small, local-only reward per completed session: accessories, room objects, story fragments, or stickers.
- Use forgiving morning/evening habit tracking; never shame a missed session.
- Keep profiles, progress, and rewards on-device by default.
- Add a simple parent view for completion history and coaching preferences.

#### Definition of world-class

- A child always knows exactly where to brush without reading a list.
- The animated brush never leaves the instructed target.
- Visual cleaning progress never gets ahead of time or coaching.
- Spoken prompts are natural, brief, and symbol-free.
- The screen supports mirror attention instead of stealing it.
- Completion produces a genuinely beautiful, believable smile.
- Parents trust the technique, privacy, and behavior of every control.
- Children voluntarily ask to use it again tomorrow.

#### Success measures for child testing

- Can the child point to the correct quadrant immediately after each cue?
- Does their real toothbrush move to the instructed location within three seconds?
- Do they cover outer, chewing, and inner surfaces in every quadrant?
- How often do they look at the screen versus the mirror?
- Do they complete the full two minutes without adult negotiation?
- Can they explain what the sugar bugs mean and why each one disappeared?
- Does the child recognize the final image as a clean, happy smile?
- Does the parent report less conflict after one and four weeks?

#### Version 2.0 beta retest — October 3, 2026

##### Major improvements confirmed

- The five-step text strip has been removed.
- The live screen now uses one concise cue such as `Top right · Outside`.
- Play, Pause, Keep going, and hold-to-reset have meaningful accessible names.
- The brush remains within a specific quadrant and changes its path for outside, chewing, and inside surfaces.
- Bug removal now follows the quadrant sequence much more closely.
- At the start of the final quadrant, nine bugs remained; during chewing, six remained; during inside brushing, three remained.
- Pause correctly froze the timer and the visible bug count.
- The tongue/spit/smile prompt is separate from the two-minute tooth-brushing lesson.
- The new settled smile is much cleaner and more believable than the original inflated ending.
- The replay flow now returns to a clean ready screen.

##### Remaining synchronization defect

At approximately one to two seconds remaining, the accessibility description still reported three sugar bugs, but no bugs were visibly distinguishable. They were either removed too early or fully hidden beneath the brush.

Acceptance criteria:

- The last target's bugs remain visibly identifiable until their scheduled removal events.
- Do not place all remaining bugs directly under an opaque brush head.
- Remove the final bug at the completion boundary—not before it.
- The visible bug count, accessible description, target progress, and timer must agree on every animation frame.
- Add deterministic timeline tests at 120, 110, 100, 90, 60, 30, 20, 10, 3, 2, 1, and 0 seconds.

##### Eyes and orientation concept

Add two simple, expressive eyes above the mouth so the child reads the diagram as a face rather than a floating dental chart.

Recommended behavior:

- Treat the face as a **mirror view**: the child's right remains on the screen's right.
- State this once in the grown-up setup and keep it consistent throughout the product.
- Place the eyes close to the mouth so they do not consume a separate large block of vertical space.
- Have the pupils look toward the active quadrant a moment before the toothbrush moves there.
- Use a blink or eyebrow lift as the gentle transition cue between quadrants.
- At the ready screen, have the eyes look toward the Start button.
- During Pause, let the eyes relax rather than continuing to animate.
- At completion, reunite the same eyes with the sparkly smile so the reward feels like one coherent happy face.
- In low-stimulation mode, keep the eyes still except for quadrant changes.

For younger children, do not rely on the spoken words `left` and `right`. Prefer language such as `Top teeth—this side` while the eyes, a soft highlight, and the brush all point to the same target. The visual face establishes orientation; the words reinforce it rather than requiring left/right mastery.

##### Mobile findings

- The active lesson fits well at 320 pixels wide, including the cue, mouth, countdown, Pause, and protected reset.
- On the ready/header screen, the Grown-ups control is clipped at 390 pixels and disappears at 320 pixels.
- The header should use a compact overflow/menu treatment or move grown-up controls below the child-facing primary action on narrow screens.
- Adding eyes will require shrinking the mouth slightly on phones; preserve the currently successful one-screen active layout.

##### Voice QA limitation

The browser test confirmed the visible cue and accessible structure, but did not provide reliable audio playback for judging voice realism. Naturalness, symbol handling, pronunciation, pacing, and cue overlap still require an audible device test with children and adults.
