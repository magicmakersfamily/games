# Handoff Note

## Update — Version 2.3

The original handoff below is preserved as project history, but its status section is superseded:

- **Live:** Say It, Spell It! 2.3. The v2 two-screen redesign is published, and the live page uses
  the curated accuracy-first word bank. Unknown words keep their spelling but receive no guessed
  phonics breakdown.
- **Voice reliability:** Speech is warmed up from a user tap, resumed before every utterance, and
  retried after an earlier utterance is stopped. The start screen has a **Test voice** control; if
  a browser still cannot start speech, the game says so clearly instead of leaving taps silent.
- **Echo and tiles:** Once browser recognition releases the microphone, the game repeats the word
  the child said. A tapped phonics tile says its letter name(s) followed by its sound, so `cat`
  gives “C, /k/”, “A, /a/”, and “T, /t/”. The play-all control still speaks only the sounds, then
  the whole word.
- **Homophones:** 30 reviewed groups (65 spellings) show a “Which spelling did you mean?” chooser
  with a picture and short meaning clue. For example, saying any of `two`, `to`, or `too` shows all
  three; the recognized spelling stays selected until the child chooses another.
- **Preserved releases:** v1.0, v2.0, v2.1, v2.2, and v2.3 are tagged and playable under
  `versions/word-deconstructor/`. Saved state is isolated per archived version.
- **Tests:** `node --test word-deconstructor/draft-v2.test.js` validates the curated bank,
  homophone groups, metadata, privacy copy, and live/draft parity. `node
  word-deconstructor/tests/smoke.mjs` drives the real page in Chrome through curated, cat-letter,
  homophone, unknown-word, picture-only, and 400 px mobile flows.
- **Still future work:** grow the hand-checked bank toward 300–500 words, replace TTS phoneme
  approximations with recorded human phonemes, and replace emoji-only pictures with reviewed
  illustrations.

## Project
The Game Shelf — family site of learning games at https://magicmakersfamily.github.io/games/
(GitHub Pages, repo github.com/magicmakersfamily/games, local clone `/Users/egon/family-games`).
This note is about one game: **Word Deconstructor** (live at
`/word-deconstructor/`, folder `word-deconstructor/` in the repo), a speech-to-reading
tool for James: tap a mic, say a word, see it broken into syllables/sounds with a picture.

Read `/Users/egon/family-games/CLAUDE.md` and `/Users/egon/family-games/README.md` first —
they hold the repo-wide conventions (account, folder layout, versioning, standalone-page
requirements, how to publish). This game currently skips the shelf's usual Chinese/pinyin
convention on purpose (it teaches English reading).

## Current Goal
Rework the game per family playtest feedback (pasted below in full — keep it, it's the spec):

- Rename to **"Say It, Spell It!"** (keep the URL/folder as `word-deconstructor/` unless you
  deliberately want to break the one link already shared).
- Two-state UI: a start screen (one big mic) that's fully replaced by a result screen
  (big word at top, mic shrinks to a small "New word" button) — not two stacked cards.
- Make everything tappable: word, picture, each syllable chip, each sound tile, plus a
  "Play all" button (sounds, then the whole word).
- Replace the algorithmic (wrong) syllable/phoneme splitter with a curated, hand-checked word
  bank (target 300–500 words); unknown words show word + picture but skip the syllable/sound
  breakdown rather than guessing wrong.
- Fix silent failure ("I didn't hear a word. Let's try again." instead of silently resetting).
- Move footer/version/links behind a small "For grown-ups" disclosure.
- Prefer a better browser TTS voice; correct the privacy line (recognition may use the
  browser's own server-side speech service — don't claim audio never leaves the device).
- Longer term (not started): recorded human phoneme audio instead of TTS approximations,
  and a curated illustration set instead of emoji-only pictures.

## What Changed
- `word-deconstructor/index.html` and `word-deconstructor/cover.png` — the **published, live**
  v1.0 game (original design: two stacked cards, algorithmic syllable/phoneme splitter,
  non-tappable result, full footer visible). This is what's currently on GitHub Pages.
- A private Claude artifact draft of v1.0 (not the repo): https://claude.ai/artifact/Smt3ivprnNg1wQSdYczZQE
- **`word-deconstructor/index-draft-v2.html`** (in this repo, committed, but not linked from
  anywhere and not live) — an in-progress v2.0 rewrite addressing the feedback above. It has
  the two-screen flow, tappable elements, ~150 curated words (not yet the full 300–500),
  better failure message, and the grown-ups disclosure. It still uses browser TTS for sounds
  (phonetic respellings like "buh" instead of raw letters to avoid the TTS saying letter
  names) — real recorded phonemes were flagged as a future improvement, not done.
  It has not been played in a real browser yet, only written and copied in from a Claude
  scratchpad. To preview: open the file directly in a browser, or serve the folder locally
  (see Run Commands) and visit `/index-draft-v2.html`.

## Current State
- **Live and working**: v1.0 at the published URL, verified 200 + correct version string.
- **Broken/wrong (the reason for this rework)**: v1.0's syllable/phoneme splitter mis-divides
  common words (`boat`→`bo/at`, `make`→`ma/ke`, `teacher`→`te/ac/her`) and its "sound it out"
  sends raw letter groups to TTS, which often says letter names instead of sounds.
- **Untested**: the v2.0 draft (`say-it-spell-it.html`) has not been played in a real browser
  yet — only written. It has not been shown to the user as an artifact link, and has not been
  approved for publishing. Do not push it to `main` until the user has seen and approved it —
  this repo's process is: draft privately (Claude artifact or equivalent), get explicit
  approval, then publish.
- The curated word bank in the draft covers common CVC/digraph/blend/silent-e/vowel-team/
  r-controlled patterns plus ~15 two-syllable words and a few sight words — nowhere near the
  300–500 target from feedback.

## Run Commands
No build step, no server, no dependencies — it's static HTML/CSS/JS.
- **Preview locally**: open the HTML file directly in a browser, or `cd` into its folder and
  run `python3 -m http.server 8000`, then visit `http://localhost:8000/`.
- **Render the cover image** (from inside the game's folder, with the game's `index.html` in a
  good-looking state):
  `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars --window-size=1200,744 --virtual-time-budget=4000 --screenshot=cover.png index.html`
- **Publish** (only after the user approves the draft):
  1. Update `word-deconstructor/index.html` (and `cover.png` if the visual changed).
  2. Bump the version line in the page footer and in the shelf card (`index.html` at repo
     root) and the README games table — this is a major rework, so bump to **2.0**, keep the
     launch date (`2026-09-29`) unchanged (launch dates never change; only version numbers do).
  3. `git add` only the files you actually changed (there may be unrelated uncommitted work
     from other games in this repo — leave it alone, don't `git add -A`).
  4. Check `git config user.email` shows
     `333827680+magicmakersfamily@users.noreply.github.com` before committing.
  5. Commit with a real message, push to `main`.
  6. Poll `https://magicmakersfamily.github.io/games/word-deconstructor/` until it 200s and
     shows "Version 2.0" (usually 30–60 seconds after push).

## Next Best Task
Open `word-deconstructor/index-draft-v2.html`, actually play-test it in a real browser
(Chrome, mic permission granted) to check the two-screen flow, tappable elements, and TTS
phoneme approximations sound reasonable — then show the user before touching the live game.
Once approved, replace `word-deconstructor/index.html` with the reviewed draft's contents
(bumping the version per the Publish steps above) rather than editing the live file blind.
Do not push to `main` without the user's explicit go-ahead.

## Watch Out For
- **This repo is not a git checkout you're working from by default** — the working directory a
  coding assistant starts in may default elsewhere (it did for Claude, per this repo's own
  `CLAUDE.md`-style redirect notes in other projects). Confirm you're operating on
  `/Users/egon/family-games` before editing.
- **Don't overwrite other in-progress work.** At last check this repo had unrelated uncommitted
  changes (`blow-up/PLAN.md` modified, `aquarium/PLAN.md` untracked) from other games — those
  are someone else's in-progress work, not yours to touch or discard.
- **Git identity matters**: commits must be authored as `magicmakersfamily
  <333827680+magicmakersfamily@users.noreply.github.com>`, never a personal email — this repo
  is public.
- **Never claim recognition is fully local/private** — Chrome's Web Speech API typically uses a
  server-side recognition service by default; state that accurately (see the corrected privacy
  line already drafted in `say-it-spell-it.html`'s "For grown-ups" section).
- **Microphone access does not work inside a Claude/ChatGPT artifact or canvas sandbox** — any
  private draft needs a typed-word fallback so it can be demoed without a live mic; the real
  mic only works once published as a normal webpage (GitHub Pages).
- **The picture dictionary is emoji-only right now** — feedback suggested curated illustrations
  for abstract words ("love", "fast", "friend") instead of literal or missing emoji; not
  started.
- **Full original feedback (verbatim), for reference:**

> Best name: Say It, Spell It! It immediately explains the action and learning goal to both
> audiences. Suggested subtitle: "Say a word. See how it's spelled. Tap to hear its sounds."
> For younger children, Say It, See It! is an even simpler alternative, but it communicates the
> spelling purpose less clearly.
>
> Biggest findings from the live game
> - The interface should have two distinct states: Start (one enormous microphone) and Result
>   (word becomes the hero at top, mic shrinks to a "new word" button).
> - Currently the microphone card remains above the result, pushing the word down the page.
> - The word is not tappable — only the separate "Say the word" button speaks it.
> - The syllables and sound tiles are not tappable either.
> - When nothing was said, it listened briefly and silently returned to start — a child won't
>   know whether they did something wrong.
> - The footer, explanation, version info, and sharing links create substantial grown-up visual
>   noise.
>
> Recommended streamlined experience — Start: small title, huge mic, "Tap. Say a word.",
> everything else under a small "For grown-ups" link. Listening: pulsing mic/animated ear,
> "Say one word!", and "I didn't hear a word. Let's try again." on silence. Result: huge
> tappable word, picture, tappable syllable chunks, tappable sound tiles, small mic labeled
> "New word". Consistent behaviors: tap word/picture → hear whole word; tap syllable → hear
> that syllable; tap sound tile → hear the actual sound; "play all" → sounds then whole word
> (removes the need for a separate "Say the word" button).
>
> The most important learning issue: the algorithmic syllable/sound breakdown is wrong for
> common words (boat→bo/at, make→ma/ke, teacher→te/ac/her), and sending letter groups straight
> to TTS can't reliably produce isolated phonemes (may say letter names instead). For a
> learning tool, prioritize correctness over unlimited vocabulary: start with 300–500 common,
> hand-checked words with correct syllables, letter-to-sound groupings, and (ideally) recorded
> phonemes; show an unknown word's spelling but omit the instructional breakdown unless it has
> validated data; use warm human recordings for individual sounds, with browser speech as
> fallback for whole words only.
>
> Image recommendation: no live image generation in the core loop (latency, cost,
> moderation, stylistic inconsistency). Better: generate/curate an illustration library during
> development, review every image, cache it with validated word data, and use a friendly letter
> card for unknown words. Curated illustrations + emoji fallback; abstract words ("love",
> "fast", "friend") may need illustration rather than literal auto-generated pictures.
>
> Voice and privacy: the current voice is just the device default (quality/personality varies)
> — choose a preferred friendly voice when available, slow whole-word playback slightly, and
> use recorded audio for phonemes. Also: the privacy statement claims speech is never sent
> anywhere, but the code doesn't request local-only recognition — Chrome's Web Speech API can
> use a server-based service by default. Either implement/verify on-device recognition, or say
> something accurate like: "Magic Makers does not store your audio or words. Speech
> recognition is handled by your browser and may use its speech service."
> (MDN: Web Speech API usage notes.)
>
> Priority order: fix instructional accuracy → replace the two-card flow → make every learning
> element speak when tapped → improve failure feedback → simplify grown-up text → expand
> images.
