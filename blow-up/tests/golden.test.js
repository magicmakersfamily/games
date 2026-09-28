/* Golden-run snapshot of the engine (PLAN.md A1). Runs both playable day styles × every strategy
   in balance.js × seeds 1-5, reduces each run to a compact summary, and compares it against
   tests/golden.json. This is a safety net for later refactors (splitting index.html, the phase
   machine, skill-tracking changes): if a run's summary changes, this test fails and says which
   field moved, so a change in behaviour is never silent.

   To accept a deliberate engine change, regenerate the file and say why in the commit:
     UPDATE_GOLDEN=1 node --test tests/golden.test.js
   Run with `node --test` (no flags) to just check. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const S = require('../sim.js');
const C = require('../content.js');
const { strategies, sayWith } = require('../balance.js');

const GOLDEN_PATH = path.join(__dirname, 'golden.json');
const SEEDS = [1, 2, 3, 4, 5];
const STYLES = Object.keys(C.DAY_STYLES).filter(k => C.DAY_STYLES[k].scenes);
const r1 = n => Math.round(n * 10) / 10;

// Re-runs the day ourselves (rather than calling S.runDay) so we can record the phase sequence,
// which the engine doesn't log permanently. Otherwise this mirrors S.runDay exactly.
function runAndSummarize(styleId, strategyName, seed) {
  const strategy = strategies[strategyName];
  const sw = sayWith[strategyName];
  const s = S.create({ style: styleId, seed, autoSay: !sw });
  const phases = [{ t: 0, phase: s.phase }];
  let guard = 0;
  while (!s.done && guard++ < 5000) {
    if (s.pending) {
      if (s.pending.kind === 'say') S.choose(s, sw ? sw(s, s.pending) : s.pending.def);
      else if (s.pending.kind === 'pick') S.choosePlace(s, s.pending.options[0]);
      else if (s.pending.kind === 'validate') S.ack(s);
      continue;
    }
    if (strategy) strategy(s, S.view(s));
    S.step(s);
    if (s.phase !== phases[phases.length - 1].phase) phases.push({ t: s.t, phase: s.phase });
    s.events.length = 0;
  }
  const r = S.receipt(s, 10);
  return {
    end: r1(S.pressure(s)),
    peak: r1(r.peak),
    blowups: s.blowups.map(b => ({ t: b.t, type: b.type, second: !!b.second, collapse: !!b.collapse })),
    phases,
    jars: { choice: S.jar(s, 'choice'), can: S.jar(s, 'can'), together: S.jar(s, 'together') },
    skills: { breathe: s.skills.breathe.xp, stomp: s.skills.stomp.xp },
    receipt: {
      total: r1(r.total), end: r1(r.end), blowups: r.blowups, marbles: r.marbles,
      skills: r.skills, practice: r.practice, cookie: r.cookie, sock: r.sock,
      lines: r.lines.map(l => [l.label, r1(l.delta)]),
    },
  };
}

function buildAll() {
  const all = {};
  for (const styleId of STYLES) for (const strategyName of Object.keys(strategies)) for (const seed of SEEDS) {
    all[`${styleId}/${strategyName}/${seed}`] = runAndSummarize(styleId, strategyName, seed);
  }
  return all;
}

if (process.env.UPDATE_GOLDEN) {
  fs.writeFileSync(GOLDEN_PATH, JSON.stringify(buildAll(), null, 2) + '\n');
  console.log('Wrote', GOLDEN_PATH);
} else {
  test('engine golden runs match tests/golden.json', () => {
    assert.ok(fs.existsSync(GOLDEN_PATH), 'tests/golden.json is missing — run: UPDATE_GOLDEN=1 node --test tests/golden.test.js');
    const golden = JSON.parse(fs.readFileSync(GOLDEN_PATH, 'utf8'));
    const current = buildAll();
    assert.deepEqual(Object.keys(current).sort(), Object.keys(golden).sort(),
      'day styles or strategies changed — regenerate with UPDATE_GOLDEN=1 and say why');
    for (const key of Object.keys(golden)) {
      assert.deepEqual(current[key], golden[key], `run "${key}" changed — regenerate with UPDATE_GOLDEN=1 if intended`);
    }
  });
}
