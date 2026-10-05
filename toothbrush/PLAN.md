# Brush Buddy — plan and handoff

Called Toothbrush Timer up to 2.0 and Toothbrush Coach in 2.1–2.3 (renamed Brush Buddy in 2.4); the folder stays `toothbrush/` so links keep working. In beta
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

## Status (2.3 beta, October 3, 2026)

Done in 2.3 (from the 2.2 retest at the end of the notes):
- Rigid toothbrush: handle, neck, head and bristles are drawn in one local frame with one
  translate + rotate (`rigPose`, `drawRigidBrush` in index.html; sizes in `RIG`, never change).
  Poses are solved from the bristle contact: outside = angled 35° out toward the gumline (handle kept
  below the eyes on the top teeth); chewing = head on the molar, handle out the corner of the mouth;
  inside = bristles on the inner surface, handle out the corner; front = upright behind the front
  teeth with the handle straight out of the mouth. Same pose type: the brush slides; different pose
  type: lift and place (fade out, fade in), never a bend. A browser check runs every 50 ms of the
  lesson and confirms the handle end is outside the lips whenever the brush is visible.
- Identity-neutral ending: no skin-coloured oval, blush or nose. The progress ring moves up to frame
  the eyes and smile with a see-through glow; eyelids are a soft neutral colour, not a skin tone.
  The coach has no name, gender or pronouns.
- Grown-ups → Character → Eye color (radio group): Brown (default), Dark brown, Hazel, Green, Blue,
  Gray, each with an iris preview and a label; irises have a lighter centre and a dark rim so the
  pupil stands out in normal and calm mode; saved with the other settings; cosmetic only.
- Screen readers: the coaching line is one set of words (dot and arrow drawn by CSS with empty alt
  text, the real side as hidden text), so running, paused and smile states are announced once.
  "Why these brushing steps?" is a real button with aria-expanded/aria-controls.
- Timer: "1 minute — quick practice", "2 minutes — recommended", "3 minutes — extra time", with a
  note that two minutes is the recommended time. Quick practice uses short lines (q-* in
  lines.json, 1.2–2.6 s instead of 3.3–4.1 s) and a single short chime.

Still open: name and personality for the coach (no gender), one tiny local-only reward per finished
session, a forgiving morning/evening calendar; family testing of the character across backgrounds.

Done in 2.2 (from the 2.1 retest at the end of the notes):
- "1 sugar bug left" (singular). The coaching line is one screen-reader sentence (hidden `.sr` span
  with the real side, e.g. "Top teeth, right side: Outside"); the visible words and arrow are
  `aria-hidden`.
- "Chewing surfaces" on screen; spoken "Now brush the chewing surfaces…" (re-recorded chew-a/b).
- Calm mode text: "Stationary sugar bugs, muted colors, and quieter chimes."
- Grown-ups dialog scrolls inside itself with Close (sticky header) and Done (sticky footer, fade)
  always visible at 320 px.
- Ending is one face: the progress ring morphs into a face outline, the eyes move down to join a
  small nose, cheeks and the smile, they blink once as the sparkles appear, then stay still. Card:
  "You brushed every tooth!" with the surface summary as small grown-up text (hidden on short screens).
- Final spoken line: "Great brushing! Brush your tongue. Spit, don't rinse. Now show your smile!"
- Grown-ups → "Why these brushing steps?" panel (closed by default, only reachable when not brushing):
  claims checked against the sources on October 3, 2026 — ADA brushing guide (surfaces, short
  tooth-wide strokes, vertical behind front teeth), ADA Home Oral Care (twice a day, two minutes,
  fluoride toothpaste), ADA fluoride page (rice-grain under 3, pea-sized 3–6, supervision), AAPD
  Fluoride Therapy best practice (revised 2023; supervised twice-daily brushing, smear/pea amounts,
  rinsing kept to a minimum or avoided, spit). Tongue brushing is not in these sources and the panel
  says it is our own extra step. "Guidance reviewed October 2026" — update when rechecked.
- The message-channel console error from the retest did not reproduce in clean Chrome profiles
  (no console errors in any automated run), so it is most likely a browser extension.

Not done yet (next product step from the 2.1 notes): a name and a bit of personality for the face,
one tiny local-only reward per completed session, a forgiving morning/evening calendar.

Done in 2.1 (from the 2.0 retest at the end of the notes):
- Renamed to Toothbrush Coach (2.1); renamed Brush Buddy in 2.4.
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

## Product notes (from the family, October 3, 2026, updated after the 2.0, 2.1 and 2.2 retests)

Latest tested version: 2.2 (beta), October 3, 2026.

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

### Version 2.1 beta retest — October 3, 2026

#### Major improvements confirmed

- Eyes have been added and now form a useful orientation system.
- Younger-child mode removes visible left/right language, uses a directional arrow, and preserves the exact anatomical side in the accessible image description.
- The pupils look toward the active quadrant; the eyes visibly relax during Pause.
- Parent settings clearly explain that the face is a mirror and offer younger-child and big-kid coaching modes.
- Parent settings, Pause, protected reset, and the complete active lesson now fit at 320 pixels wide.
- The previously clipped Grown-ups control is visible at 320 and 390 pixels.
- Settings checkboxes and radio buttons now respond through their semantic controls.
- Calm mode creates a genuinely quieter visual treatment with muted colors and stationary bugs.
- Opening the parent panel from Pause keeps the lesson paused.
- Bug timing is now correctly synchronized through the final second: nine bugs at 0:30, one visible bug at 0:01, then zero at the tongue transition.
- The two-minute lesson, tongue prompt, Show my smile interaction, and replay flow all completed successfully.

#### Small defects and copy fixes

- The accessible description says `1 sugar bugs left`; singular should be `1 sugar bug left`.
- The decorative direction arrow appears as a separate accessible generic element and may be announced by some screen readers. Mark it `aria-hidden="true"`; preserve the direction in the image alt text.
- `Chewing tops` is understandable but unnatural and less consistent with dental guidance. Prefer `Chewing surfaces` visually and `Brush the chewing surfaces` in speech.
- Calm mode's parent description, `still bugs`, can be misread as “bugs remain.” Prefer `Stationary sugar bugs, muted colors, and quieter chimes.`
- At 320 pixels, the parent dialog requires scrolling and the Done button is initially below the viewport. Keep Close visible and consider a sticky Done footer or subtle bottom fade to signal additional content.
- One browser message-channel console error appeared after completion, with no visible app failure. Reproduce in a clean browser profile before treating it as an application defect; it may originate from an extension.

#### Next visual refinement: make the ending one face

The eyes and smile are individually appealing, but the completion composition still feels slightly separated: the eyes sit outside the large green circle while the mouth sits low inside a mostly empty circle.

Recommended completion treatment:

- At `Show my smile`, morph the progress ring into a soft face or cheek outline.
- Bring the eyes and mouth into one compact facial composition.
- Move the smile upward slightly and reduce the empty vertical space.
- Optionally add a tiny nose or two subtle cheek marks; avoid adding more text or decorative clutter.
- Replace `Outsides, chewing tops and insides: every tooth got a turn` with the more child-centered `You brushed every tooth!` Put the detailed surface summary in smaller grown-up copy if it is still needed.
- Let the eyes brighten or blink once as the sparkles appear, then settle into a still expression.

#### Next product-level opportunity

The core coaching loop is now strong enough that the next major gain will come from attachment and return motivation rather than more brushing-screen complexity.

- Give the face a name and a small amount of personality.
- Award one tiny local-only object or sticker after a fully completed session.
- Show a forgiving morning/evening calendar for parents and children.
- Keep rewards secondary to the clean two-minute coaching flow.
- Measure whether children voluntarily ask to use the coach again, not merely whether they can finish one session.

#### Parent trust: ADA and AAPD guidance panel

Add a parent-initiated information panel inside **Grown-ups**. Do not display it automatically or interrupt an active brushing session.

Suggested entry point:

> **Why these brushing steps?**  
> Based on current guidance from the American Dental Association and the American Academy of Pediatric Dentistry.

Suggested short summary:

- Brush twice daily for two minutes with fluoride toothpaste.
- Clean the outside, inside, and chewing surfaces.
- Use short, gentle strokes and vertical strokes behind the front teeth.
- After brushing, spit out excess toothpaste and minimize or avoid rinsing so fluoride remains on the teeth.
- Young children need an age-appropriate amount of toothpaste and adult help or supervision.

Official links:

- ADA brushing guide: https://www.mouthhealthy.org/all-topics-a-z/brushing-your-teeth/
- ADA child fluoride guidance: https://www.mouthhealthy.org/all-topics-a-z/fluoride/
- AAPD fluoride guidance: https://www.aapd.org/research/oral-health-policies--recommendations/fluoride-therapy/

Required trust and claims language:

- Say `Based on guidance published by the ADA and AAPD`.
- Do not say `ADA approved`, `ADA certified`, or otherwise imply that either organization reviewed or endorsed the app.
- Do not use an ADA or AAPD logo without permission.
- Display `Guidance reviewed October 2026` and update this date whenever the cited guidance is rechecked.
- Include: `This app provides general education and does not replace advice from your child’s dentist.`
- Keep the existing footer source link, but make the Grown-ups panel the primary explanation for parents.
- Open official external links only from the parent panel, outside an active session, so a child cannot accidentally leave the coach.

Recommended final spoken instruction:

> Brush your tongue. Spit—don't rinse. Now show your smile!

For children who cannot reliably spit, the parent guidance should emphasize the correct small amount of toothpaste and supervision rather than instructing the child to rinse.

### Version 2.2 beta retest — October 3, 2026

**Tested version: 2.2 (beta)**  
**Test date: October 3, 2026**

#### Improvements confirmed

- Child-facing completion copy now says `You brushed every tooth!`
- `Chewing surfaces` replaces the less natural `Chewing tops` language.
- The Calm mode description now clearly says `Stationary sugar bugs, muted colors, and quieter chimes.`
- A detailed ADA/AAPD guidance disclosure has been added under Grown-ups with sources, review date, non-endorsement language, and an educational disclaimer.
- The final bug remains visible through the final seconds and still clears at the correct completion boundary.
- The completion screen now brings the features into one face, but child testing identified an important inclusivity regression described below.

#### High priority: rebuild the toothbrush as one rigid object

The brush currently bends unnaturally. During outside and chewing targets, the long handle remains almost horizontal while the head rotates sharply. During inside targets, the head becomes vertical while the handle collapses, disappears, or forms an implausible near-90-degree bend.

Required implementation:

- Treat the handle, neck, head, and bristles as one rigid brush rig.
- Keep all parts in fixed local positions; never rotate or translate the head independently from the handle.
- Move the entire brush with one transform: translation plus rotation around a chosen pivot.
- Anchor each pose using the bristle-contact point, then solve the full-brush position from that contact.
- Create explicit canonical poses for upper/lower outside, chewing, inside, and vertical front-tooth strokes.
- Animate small tooth-width strokes within each pose rather than swinging the brush through a large arc.
- For outer surfaces, angle the complete brush naturally toward the gumline.
- For chewing surfaces, place the bristles on the biting surface and let the full handle enter from the corner of the mouth.
- For inner front teeth, rotate the entire brush vertically and keep the handle visibly extending out of the mouth.
- Use a mouth/lip clipping mask for the entry point instead of shortening or hiding the handle.
- Lift, move, and place the rigid brush during target transitions; a clean reposition is better than a physically impossible morph.
- Keep brush-head dimensions constant throughout the lesson.

Canvas acceptance test: freeze any animation frame and draw a straight centerline from the handle through the neck into the head. The brush should look manufacturable and physically holdable, with no rubber-hose bend.

#### High priority: restore an identity-neutral character

The new completion face uses a peach skin-colored oval, blush, and a small nose. In family testing it read as a Caucasian person and the oval shape read as an egg. This reduces the earlier character's useful gender and ethnicity ambiguity.

Recommended direction:

- Return to disconnected expressive eyes and a smiling mouth on the neutral background.
- Remove the skin-colored filled oval, blush, and human-coded nose.
- Preserve the eyes because they provide orientation and emotional feedback.
- Preserve the improved smile, but let it float as a friendly abstract brushing coach rather than a specific human face.
- If a framing shape is needed, use the existing progress ring, a transparent glow, or a non-skin-coded abstract shape.
- Do not assign the coach a gender in copy, voice, name, or pronouns.
- Test the character with families across multiple ethnic and cultural backgrounds before adding human skin, hair, or facial features.

#### Character personalization: eye color

Add an **Eye color** setting under a compact `Character` section in Grown-ups.

Recommended options:

- Brown — default
- Dark brown
- Hazel
- Green
- Blue
- Gray

Requirements:

- Implement as an accessible radio group named `Eye color`.
- Show a small iris preview plus a written color label; do not rely on color alone.
- Maintain sufficient pupil/iris/sclera contrast in normal and Calm modes.
- Apply the chosen color consistently on Ready, active, Paused, tongue, and completion screens.
- Save the choice locally on the device with the other settings.
- Keep eye color cosmetic only; it must not change rewards, coaching, or difficulty.
- On narrow screens, allow swatches to wrap into two rows without widening the modal.
- Consider a later `Surprise me` option, but keep Brown as the stable default.

#### Additional Version 2.2 findings

- The completion accessibility tree contains `Sparkly smile!` twice, which may produce a duplicate screen-reader announcement. Keep only one accessible instance and hide the decorative duplicate.
- The paused state similarly exposes both a combined paused-status string and its individual visible parts. Ensure the live region announces the state once.
- The `Why these brushing steps?` disclosure appears as a generic element rather than an explicit button/disclosure control in the accessibility tree. Expose an accessible name, expanded/collapsed state, and keyboard activation.
- The one-minute option is useful for practice or accommodation, but it should not appear medically equivalent to the recommended routine. Label it `1-minute quick practice`; retain `2 minutes — recommended`; label three minutes `Extra time`.
- The one-minute lesson changes targets every five seconds and feels considerably more hurried. Use fewer spoken words and shorter transition sounds in quick-practice mode.
