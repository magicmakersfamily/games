# The Game Shelf

Learning games for curious kids, published with GitHub Pages:
**https://magicmakersfamily.github.io/games/**

Every game is a self-contained static web page (HTML, CSS and JavaScript). There is no
server, no build step and no tracking. Progress is saved in each player's own browser
(`localStorage`).

## Layout

```
index.html          the shelf: one card per game
aquarium/           James's Nature Aquarium
  index.html        page, graphics, sound and interface
  sim.js            the ecosystem model (hour-by-hour simulation)
  cover.png         1200×744 card image, also used for link previews
mid-autumn/         Mid-Autumn Mayhem
  index.html        page, city scene, sound, Moon Tales and interface
  sim.js            the festival model (celebration score and trouble meters)
  cover.png         card image (render with index.html#cover)
blow-up/            Blow Up (beta)
  index.html        page, scenes, characters, storyteller, sound and interface
  sim.js            the feelings model (pressure bucket, jars, phases after a blow-up)
  content.js        all cards, days, science cards and spoken lines
  voice/            recorded storyteller voices (see PLAYTEST.md to re-record)
  sim.test.js       engine tests (node --test)
  PLAN.md           the 1.4 / 2.0 plan (with DECISIONS.md, KNOWN-BUGS.md, CLAUDE.md)
  cover.png         card image (render with index.html#cover)
spellicious/ Spellicious
  index.html        page, mic input, syllable/sound breakdown and interface
  cover.png         1200×744 card image
versions/           past releases, still playable (versions/<game>/<X.Y>/), see versions/index.html
tools/              freeze-version.sh: freeze a tagged release into versions/
.nojekyll           serve files as-is
```

## Games

| Game | Folder | Version | Launched |
|---|---|---|---|
| James’s Nature Aquarium | `aquarium/` | 3.4 | 2026-09-24 |
| Mid-Autumn Mayhem | `mid-autumn/` | 1.7 | 2026-09-25 |
| Blow Up (beta) | `blow-up/` | 1.4 | 2026-09-27 |
| Spellicious | `spellicious/` | 4.16 | 2026-09-30 |

Past versions stay playable at https://magicmakersfamily.github.io/games/versions/ (for
grown-ups; each keeps its own saved games). Every release is also a git tag (`blow-up-v1.3`, …).

## Adding a game

1. Put it in its own folder, with an `index.html` and a `cover.png` (1200×744).
2. Add a link back to the shelf (`<a href="../">← All games</a>`).
3. Add an `<article class="game">` card to the root `index.html`, with a version line:
   `<p class="version"><b>Version 1.0</b> · Launched <time datetime="YYYY-MM-DD">Month D, YYYY</time></p>`.
   The launch date never changes; bump the version on each release (on the card and at the
   bottom of the game page).
4. Commit and push to `main`. GitHub Pages redeploys in about a minute.
