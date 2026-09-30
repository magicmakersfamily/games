# Spellicious — Handoff Note

## Update — Version 3.1

- **Live:** Spellicious 3.1 is the current game at /spellicious/.
- **Wordmark:** “Spell” is bold in the standard orange; “icious” is thinner and lighter for a distinct visual pun.
- **Brand:** Official name is Spellicious; the logo hints at the pun with “Spell” + “icious”.
- **Title:** Spellicious: Say & Spell
- **Subtitle:** Free voice spelling, no ads
- **Design source:** This release replaces the previous Say It, Spell It! page with the reviewed Gemini design supplied by the user.
- **Interaction:** The page shows a large spoken word, clickable letter tiles, capitalization control, spell mode, language selection, sample words, and speech playback.
- **Display:** The main word is intentionally oversized for easy reading on phones and tablets.
- **Languages:** The selector includes Cantonese (`zh-HK`) with Cantonese sample words, and the
  initial case state is explicitly labeled lower.
- **Cantonese voice fix:** Cantonese now matches only `zh-HK`, `yue`, or explicitly Cantonese
  voices; it no longer silently picks a Mandarin voice.
- **English start:** English is the default, the first word is “hello,” and the page attempts to
  speak it after loading.
- **Dependencies:** The page uses Tailwind and Lucide from their CDN plus Google Fonts, as supplied by the design source.
- **Historical releases:** Earlier versions remain frozen under versions/speller/ and versions/word-deconstructor/.
- **Future work:** Add sentence mode, improve privacy copy around browser speech services, and consider bringing back a curated phonics bank if this design needs instructional breakdowns again.

## Release

- Current page: spellicious/index.html
- Current URL: https://magicmakersfamily.github.io/games/spellicious/
- Compatibility redirect: speller/index.html → ../spellicious/
- Current version: 3.1
- Launch date: 2026-09-30
- Release tag: spellicious-v3.1
- Frozen archive: versions/spellicious/3.1/

Before future releases, update the shelf card, README table, feedback game map, versions/index.html, and the frozen release archive. Render spellicious/cover.png, run a browser smoke check, commit, tag, push, and verify the public URL.
