# Speller — Handoff Note

## Update — Version 2.7

- **Live:** Speller 2.7 is the current game at /speller/.
- **Design source:** This release replaces the previous Say It, Spell It! page with the reviewed Gemini design supplied by the user.
- **Interaction:** The page shows a large spoken word, clickable letter tiles, capitalization control, spell mode, language selection, sample words, and speech playback.
- **Display:** The main word is intentionally oversized for easy reading on phones and tablets.
- **Languages:** The selector includes Cantonese (`zh-HK`) with Cantonese sample words, and the
  initial case state is explicitly labeled lower.
- **Cantonese voice fix:** Cantonese now matches only `zh-HK`, `yue`, or explicitly Cantonese
  voices; it no longer silently picks a Mandarin voice.
- **Dependencies:** The page uses Tailwind and Lucide from their CDN plus Google Fonts, as supplied by the design source.
- **Historical releases:** Earlier Say It, Spell It! versions remain frozen under versions/word-deconstructor/.
- **Future work:** Add sentence mode, improve privacy copy around browser speech services, and consider bringing back a curated phonics bank if this design needs instructional breakdowns again.

## Release

- Current page: speller/index.html
- Current URL: https://magicmakersfamily.github.io/games/speller/
- Current version: 2.7
- Launch date: 2026-09-30
- Release tag: speller-v2.7

Before future releases, update the shelf card, README table, feedback game map, versions/index.html, and the frozen release archive. Render speller/cover.png, run a browser smoke check, commit, tag, push, and verify the public URL.
