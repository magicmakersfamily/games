/* Engine tests. Run with `node --test` in this folder (Node 18+, no install). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('./sim.js');
const C = require('./content.js');
const { strategies, sayWith } = require('./balance.js');

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);
function fresh(opts) {
  const s = S.create(Object.assign({ style: 'rushed', seed: 7 }, opts));
  for (const k of C.LOAD_ORDER) s.load[k] = 0;
  s.tiredUntil = -1; s.sinceMeal = 0; s.t = 60; // 8:00, not tired, just ate
  s.scene = { id: 'test', label: 'Test', at: 0 }; s.loc = 'home';
  s.events.length = 0;
  return s;
}
function setJar(s, k, n) { s.jars[k] = Array.from({ length: n }, () => ({ label: 'x', t: 0 })); }
function setPressure(s, ratio, type) {
  for (const k of C.LOAD_ORDER) s.load[k] = 0;
  s.load[type || 'thinking'] = ratio * S.threshold(s);
}

test('hungry multiplies irritant spikes by the configured factor', () => {
  const a = fresh(), b = fresh();
  b.sinceMeal = S.CONFIG.HUNGRY_AT;
  const da = S.use(a, 'toy').delta, db = S.use(b, 'toy').delta;
  near(db / da, S.CONFIG.HUNGRY_SPIKE, 0.02);
});

test('tired halves helper effectiveness', () => {
  const a = fresh(), b = fresh();
  setPressure(a, 0.5); setPressure(b, 0.5);
  b.tiredUntil = 999;
  const da = S.use(a, 'water').delta, db = S.use(b, 'water').delta;
  near(db / da, S.CONFIG.TIRED_HELP, 0.02);
});

test('filling My Choice raises the threshold and reduces spikes', () => {
  const a = fresh(), b = fresh();
  setJar(a, 'choice', 0); setJar(b, 'choice', 10);
  assert.equal(S.threshold(b) - S.threshold(a), 10 * S.CONFIG.THRESH_CHOICE);
  const da = S.use(a, 'loud').delta, db = S.use(b, 'loud').delta;
  near(db / da, 1 - S.CONFIG.CHOICE_SPIKE_CUT, 0.02);
  const s = fresh(); setJar(s, 'choice', 0); setJar(s, 'can', 0); setJar(s, 'together', 0);
  assert.equal(S.threshold(s), 60);
  setJar(s, 'choice', 10); setJar(s, 'can', 10); setJar(s, 'together', 10);
  assert.equal(S.threshold(s), 100);
});

test('zones compute correctly from pressure and threshold', () => {
  assert.equal(S.zoneOf(0), 'green');
  assert.equal(S.zoneOf(0.39), 'green');
  assert.equal(S.zoneOf(0.40), 'yellow');
  assert.equal(S.zoneOf(0.74), 'yellow');
  assert.equal(S.zoneOf(0.75), 'red');
  assert.equal(S.zoneOf(0.99), 'red');
  assert.equal(S.zoneOf(1), 'blowup');
  const s = fresh(); setPressure(s, 0.5);
  assert.equal(S.zone(s), 'yellow');
});

test('blow-up triggers at threshold, and its type matches the dominant load', () => {
  const s = fresh();
  setPressure(s, 0.97, 'thinking');
  S.use(s, 'tower');
  assert.equal(s.blowups.length, 1);
  assert.equal(s.phase, 'eruption');
  assert.equal(s.blowups[0].type, 'volcano');

  const h = fresh(); h.sinceMeal = S.CONFIG.HUNGRY_AT;
  setPressure(h, 0.97, 'body'); S.use(h, 'sock');
  assert.equal(h.blowups[0].type, 'hangry');

  const t = fresh(); setPressure(t, 0.97, 'body'); S.use(t, 'sock');
  assert.equal(t.blowups[0].type, 'noodle');

  const map = { control: 'whistle', sensory: 'tornado', emotional: 'gavel' };
  for (const k in map) { const x = fresh(); setPressure(x, 1.01, k); S.checkBlowup(x, {}); assert.equal(x.blowups[0].type, map[k]); }

  const below = fresh(); setPressure(below, 0.5); S.step(below);
  assert.equal(below.blowups.length, 0);
});

test('the broken cookie is the last straw and is flagged for the validation screen', () => {
  const s = fresh(); setPressure(s, 0.99, 'emotional');
  S.use(s, 'cookie');
  assert.equal(s.blowups.length, 1);
  assert.equal(S.validation(s).cookie, true);
});

test('a lecture during eruption or high cortisol adds pressure and can cause a second eruption', () => {
  const s = fresh(); setPressure(s, 0.99); S.checkBlowup(s, {}); setPressure(s, 1.01); S.checkBlowup(s, {});
  assert.equal(s.phase, 'eruption');
  const p0 = S.pressure(s);
  const r = S.use(s, 'lecture');
  assert.ok(r.bounced);
  assert.ok(S.pressure(s) > p0);

  const c = fresh(); setPressure(c, 1.01); S.checkBlowup(c, {});
  S.setPhase(c, 'cooling'); setPressure(c, 0.95);
  assert.ok(c.cortisol > S.CONFIG.CORT_TALK);
  S.use(c, 'lecture');
  assert.equal(c.blowups.length, 2);
  assert.equal(c.blowups[1].second, true);
});

test('silly voice lowers pressure in yellow and raises it in red', () => {
  const y = fresh(); setPressure(y, 0.5);
  assert.ok(S.use(y, 'silly').delta < 0);
  const r = fresh(); setPressure(r, 0.85);
  const res = S.use(r, 'silly');
  assert.ok(res.delta > 0); assert.ok(res.backfire);
});

test('“Calm down!” always backfires', () => {
  for (const ratio of [0.1, 0.5, 0.85]) { const s = fresh(); setPressure(s, ratio); assert.ok(S.use(s, 'calmdown').delta > 0); }
});

test('hug flips sign with the kid’s preference', () => {
  const lover = fresh({ kid: 'pip' }); setPressure(lover, 0.6);
  const spacer = fresh({ kid: 'rio' }); setPressure(spacer, 0.6);
  assert.ok(S.use(lover, 'hug').delta < 0);
  assert.ok(S.use(spacer, 'hug').delta > 0);
});

test('specific praise only works in the Learn phase; generic praise barely works', () => {
  for (const ph of ['day', 'eruption', 'cooling', 'reconnect', 'repair']) {
    const s = fresh(); setPressure(s, 0.3); S.setPhase(s, ph); s.cortisol = 0;
    const can = S.jar(s, 'can');
    const r = S.use(s, 'praise');
    assert.equal(r.delta, 0, ph); assert.equal(S.jar(s, 'can'), can, ph);
  }
  const s = fresh(); setPressure(s, 0.3); S.setPhase(s, 'learn');
  const can = S.jar(s, 'can');
  const r = S.use(s, 'praise');
  assert.ok(r.delta < 0); assert.equal(S.jar(s, 'can'), can + 2); assert.ok(s.praised);
  const g = fresh(); setPressure(g, 0.3); S.setPhase(g, 'learn');
  assert.ok(Math.abs(S.use(g, 'goodjob').delta) < Math.abs(r.delta) / 2);
});

test('a skill reaches level 3 after calm practice, then kicks in by itself on entering yellow', () => {
  const s = fresh();
  for (let i = 0; i < 6; i++) { setPressure(s, 0.3); S.use(s, 'breathe'); }
  assert.equal(s.skills.breathe.level, 3);
  // Practice in red does not count.
  const r = fresh(); setPressure(r, 0.85); S.use(r, 'breathe'); assert.equal(r.skills.breathe.xp, 0);
  // Auto-use on the way from green into yellow.
  s.zone = 'green'; s.selfCooldown = 0; setPressure(s, 0.405);
  S.step(s);
  assert.ok(s.log.some(e => e.kind === 'self' && e.id === 'breathe'));
  assert.ok(s.events.some(e => e.kind === 'selfUse'));
  // Skills persist through create().
  const next = S.create({ style: 'rushed', skills: { breathe: { xp: 6 } } });
  assert.equal(next.skills.breathe.level, 3);
});

test('a skill tool used during recovery counts as used but not as practice (KNOWN-BUGS B4)', () => {
  const s = fresh();
  s.phase = 'cooling';
  S.use(s, 'breathe');
  assert.equal(s.usedTool.breathe, 1);
  assert.equal(Object.keys(s.xpToday).length, 0);
  assert.equal(s.skills.breathe.xp, 0);
  const r = S.receipt(s);
  assert.equal(r.used.breathe, 1);
  assert.equal(r.practice, 0);
});

test('a skill tool used while calm counts as both used and practice', () => {
  const s = fresh();
  setPressure(s, 0.3);
  S.use(s, 'breathe');
  assert.equal(s.usedTool.breathe, 1);
  assert.equal(s.skills.breathe.xp, 1);
  const r = S.receipt(s);
  assert.equal(r.used.breathe, 1);
  assert.equal(r.practice, 1);
});

test('Say It Differently: same outcome, different jars and load', () => {
  const mk = () => { const s = fresh(); s.pending = { kind: 'say', id: 'shoes', def: 'control' }; return s; };
  const a = mk(), b = mk();
  const ca = S.jar(a, 'choice'), cb = S.jar(b, 'choice');
  const ra = S.choose(a, 'control'), rb = S.choose(b, 'support');
  assert.equal(ra.outcome, rb.outcome);
  assert.equal(a.t, b.t);
  assert.equal(S.jar(a, 'choice'), ca - 1);
  assert.equal(S.jar(b, 'choice'), cb + 1);
  assert.ok(S.pressure(a) > S.pressure(b));
  assert.equal(a.pending, null); assert.equal(b.pending, null);
});

test('marionette strings appear at My Choice 3 or below; Flat Mode needs an empty jar and a long quiet', () => {
  const s = fresh();
  setJar(s, 'choice', 4); assert.equal(S.strings(s), 0);
  setJar(s, 'choice', 3); assert.ok(S.strings(s) > 0);
  setJar(s, 'choice', 0); assert.equal(S.strings(s), 4);

  const f = fresh(); setJar(f, 'choice', 1);
  for (let i = 0; i < S.CONFIG.FLAT_MINUTES + 2; i++) { setPressure(f, 0.1); S.step(f); }
  assert.ok(f.flat);
  const g = fresh(); setJar(g, 'choice', 5);
  for (let i = 0; i < 60; i++) { setPressure(g, 0.1); S.step(g); }
  assert.ok(!g.flat);
  // Filling the jar again brings the spark back.
  setJar(f, 'choice', 4); setPressure(f, 0.1); S.step(f);
  assert.ok(!f.flat);
});

test('the same seed and inputs produce the same day', () => {
  const run = seed => S.runDay('rushed', { seed, strategy: strategies.goodSupport, sayWith: sayWith.goodSupport });
  const a = run(42), b = run(42);
  assert.deepEqual(a.graph, b.graph);
  assert.deepEqual(a.log, b.log);
  assert.deepEqual(S.receipt(a), S.receipt(b));
});

test('receipt totals match the event log', () => {
  for (const st of ['rushed', 'adventure']) for (const strat of ['none', 'goodSupport', 'unhelpful']) {
    const s = S.runDay(st, { seed: 3, strategy: strategies[strat], sayWith: sayWith[strat] });
    const r = S.receipt(s);
    near(r.total, S.pressure(s) - r.start, 1e-6);
    near(r.lines.reduce((a, l) => a + l.delta, 0), r.total, 1e-6);
    const e = r.equation;
    near(e.load - e.recovery - e.skills - e.support, e.total, 1e-6);
    assert.equal(r.blowups, s.blowups.length);
  }
});

test('masking: at school the kid holds it together, then it comes out after school', () => {
  const s = fresh(); s.loc = 'classroom';
  setPressure(s, 1.05); S.checkBlowup(s, {});
  assert.equal(s.blowups.length, 0);
  // Leaving school with a full bucket = restraint collapse.
  const i = s.style.scenes.findIndex(x => x.id === 'activity');
  s.t = s.style.scenes[i].at; s.sceneIdx = i - 1; s.scene = s.style.scenes[i - 1]; s.loc = 'classroom';
  S.step(s);
  assert.equal(s.blowups.length, 1);
  assert.ok(s.blowups[0].collapse);
});

test('phases move forward with no input and never get stuck', () => {
  const s = fresh(); setPressure(s, 1.01); S.checkBlowup(s, {});
  const seen = new Set();
  for (let i = 0; i < 400 && s.phase !== 'day'; i++) {
    if (s.pending && s.pending.kind === 'validate') { assert.ok(s.pending.data.causes); S.ack(s); }
    if (s.pending && s.pending.kind === 'say') S.choose(s, 'support');
    seen.add(s.phase); S.step(s);
  }
  assert.equal(s.phase, 'day');
  for (const ph of ['eruption', 'cooling', 'reconnect', 'repair', 'learn']) assert.ok(seen.has(ph), ph);
});

test('naming the feeling reveals the itchy sock and quiets the Guard Dog', () => {
  const s = fresh(); S.use(s, 'sock'); assert.ok(s.sock);
  setPressure(s, 0.6); S.use(s, 'name');
  assert.ok(!s.sock); assert.ok(s.dogQuiet > 0);
  assert.ok(s.log.some(e => e.kind === 'reveal'));
});

test('balance smoke test: plausible ranges only, never a fixed winner', () => {
  const out = [];
  for (const st of ['rushed', 'adventure']) for (const strat of ['none', 'goodSupport']) {
    for (const seed of [1, 2, 3]) {
      const s = S.runDay(st, { seed, strategy: strategies[strat], sayWith: sayWith[strat] });
      const r = S.receipt(s);
      assert.ok(s.done, 'day finishes');
      assert.ok(s.blowups.length >= 0 && s.blowups.length <= 6, `${st}/${strat}: ${s.blowups.length} blow-ups`);
      assert.ok(Number.isFinite(r.total));
      assert.ok(S.threshold(s) >= 60 && S.threshold(s) <= 100);
      assert.ok(s.graph.length >= 780);
      out.push(`${st}/${strat}/seed${seed}: blow-ups ${s.blowups.length}, peak ${r.peak.toFixed(2)}, bedtime bucket ${S.pressure(s).toFixed(1)}`);
    }
  }
  console.log(out.join('\n'));
});

test('the same card used again and again quickly works less each time, then recovers', () => {
  const s = fresh(); setPressure(s, 0.6);
  const d1 = -S.use(s, 'water').delta; setPressure(s, 0.6);
  const d2 = -S.use(s, 'water').delta; setPressure(s, 0.6);
  const d3 = -S.use(s, 'water').delta;
  assert.ok(d2 < d1 && d3 < d2, `${d1} > ${d2} > ${d3}`);
  const u = fresh(); const a = S.use(u, 'loud').delta, b = S.use(u, 'loud').delta;
  assert.ok(b < a);
  // Ten taps in a row add far less than ten times one tap.
  const t = fresh(); let sum = 0; for (let i = 0; i < 10; i++) sum += S.use(t, 'toy').delta;
  assert.ok(sum < 5 * a, `${sum} vs ${a}`);
  // After an hour it works fully again.
  s.t += 60; setPressure(s, 0.6);
  near(-S.use(s, 'water').delta, d1, d1 * 0.08);
});
