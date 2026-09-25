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
.nojekyll           serve files as-is
```

## Games

| Game | Folder | Version | Launched |
|---|---|---|---|
| James’s Nature Aquarium | `aquarium/` | 3.1 | 2026-09-24 |
| Mid-Autumn Mayhem | `mid-autumn/` | 1.1 | 2026-09-25 |

## Adding a game

1. Put it in its own folder, with an `index.html` and a `cover.png` (1200×744).
2. Add a link back to the shelf (`<a href="../">← All games</a>`).
3. Add an `<article class="game">` card to the root `index.html`, with a version line:
   `<p class="version"><b>Version 1.0</b> · Launched <time datetime="YYYY-MM-DD">Month D, YYYY</time></p>`.
   The launch date never changes; bump the version on each release (on the card and at the
   bottom of the game page).
4. Commit and push to `main`. GitHub Pages redeploys in about a minute.
