/* Voice audit (PLAN.md A3, and B3 in KNOWN-BUGS.md): every line the game can say must have a
   recorded clip, or the browser's backup voice speaks it instead (silently, unless a grown-up
   turns on "Show voice details"). This regenerates tools/lines.json the same way
   `node tools/voice-lines.js` does (it's cheap and deterministic) and checks every line against
   the committed voice/manifest.json, so a line added to content.js without re-recording is
   caught here instead of being found by a kid mid-story.

   A failure here means: run `node tools/voice-lines.js` then re-render (see CLAUDE.md's "Recorded
   voices" section for the exact command), or, for a genuinely optional line, list it below. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const HERE = __dirname;
const ROOT = path.join(HERE, '..');

// Lines that are allowed to fall back to the browser's voice on purpose (none today; keep this
// empty unless a specific line is deliberately left unrecorded, and say why next to it).
const ALLOWED_FALLBACK = new Set([]);

test('every narration line has a recorded clip in voice/manifest.json', () => {
  // tools/voice-lines.js writes tools/lines.json from content.js + sim.js + balance.js; run it
  // fresh so this test catches a line added since the last render, not just since the last commit.
  execFileSync(process.execPath, [path.join(ROOT, 'tools', 'voice-lines.js')], { cwd: ROOT });
  const lines = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'lines.json'), 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'voice', 'manifest.json'), 'utf8'));

  const missing = lines.filter(l => {
    const bank = manifest.banks[l.who];
    return !(bank && bank[l.key]) && !ALLOWED_FALLBACK.has(l.who + '|' + l.text);
  });

  if (missing.length) {
    const sample = missing.slice(0, 15).map(l => `  ${l.who}: ${l.text.slice(0, 70)}`).join('\n');
    assert.fail(`${missing.length} line(s) have no recorded clip (of ${lines.length} total):\n${sample}` +
      (missing.length > 15 ? `\n  … and ${missing.length - 15} more` : '') +
      `\nRun: node tools/voice-lines.js && python tools/render-voice.py <kokoro-model-dir>`);
  }
});
