// Run with: node --test toothbrush/lesson.test.js
const test = require('node:test');
const assert = require('node:assert');
const L = require('./lesson.js');

const DURATIONS = [60, 120, 180];
const EPS = 1e-6;

test('12 equal cues: four quadrants × outside, chewing, inside', () => {
  assert.strictEqual(L.N, 12);
  assert.deepStrictEqual(L.SEGMENTS.map(s => s.quad + ':' + s.surface).slice(0, 3), ['UR:outer', 'UR:chewing', 'UR:inner']);
  assert.deepStrictEqual([...new Set(L.SEGMENTS.map(s => s.quad))], ['UR', 'UL', 'LL', 'LR']);
  for (const d of DURATIONS) {
    assert.strictEqual(L.locate(d / 4 - EPS, d).index, 2);
    assert.strictEqual(L.locate(d / 4, d).index, 3);       // quadrant change at 30 / 60 / 90 s for 2 min
  }
});

test('every cue has bugs, and its last bug goes exactly at the end of the cue', () => {
  for (const seg of L.SEGMENTS) {
    const bugs = L.BUGS.filter(b => b.seg === seg.index);
    assert.ok(bugs.length >= 3, 'cue ' + seg.index);
    assert.strictEqual(Math.max(...bugs.map(b => b.removeFrac)), 1);
    for (const b of bugs) assert.ok(b.removeFrac > 0 && b.removeFrac <= 1);
    for (const b of bugs) assert.ok(seg.stops.includes(b.tooth), 'bug sits on a tooth the brush visits');
  }
});

test('visible bugs always match the timer: past cues clean, future cues untouched', () => {
  for (const d of DURATIONS) {
    for (let t = 0; t < d; t += d / 997) {
      const loc = L.locate(t, d);
      for (const b of L.BUGS) {
        const st = L.bugState(b, t, d);
        if (b.seg < loc.index) assert.strictEqual(st.alive, false, `past bug ${b.id} at ${t}`);
        if (b.seg > loc.index) {
          assert.strictEqual(st.alive, true, `future bug ${b.id} at ${t}`);
          assert.strictEqual(st.scale, 1); assert.strictEqual(st.active, false);
        }
        if (b.seg === loc.index) assert.strictEqual(st.alive, t < L.bugRemoveAt(b, d));
      }
    }
  }
});

test('the last bug of a cue is still there just before the cue ends', () => {
  for (const d of DURATIONS) for (const seg of L.SEGMENTS) {
    const end = (seg.index + 1) * d / L.N;
    const last = L.BUGS.filter(b => b.seg === seg.index && b.removeFrac === 1);
    for (const b of last) {
      assert.strictEqual(L.bugState(b, end - 0.01, d).alive, true);
      assert.strictEqual(L.bugState(b, end, d).alive, false);
    }
  }
});

test('a bug only shrinks while the brush is at its tooth in its own cue', () => {
  for (const d of DURATIONS) for (let t = 0; t < d; t += 0.05) {
    const pose = L.brushPose(t, d);
    for (const b of L.BUGS) {
      const st = L.bugState(b, t, d);
      if (st.alive && st.scale < 1) {
        assert.strictEqual(b.seg, pose.seg);
        assert.strictEqual(b.tooth, pose.stop, `bug ${b.id} shrinking while brush is at tooth ${pose.stop} (t=${t}, d=${d})`);
      }
    }
  }
});

test('the brush never leaves the coached quadrant and surface', () => {
  for (const d of DURATIONS) for (let t = 0; t < d; t += 0.01) {
    const pose = L.brushPose(t, d), seg = L.SEGMENTS[L.locate(t, d).index];
    assert.strictEqual(pose.quad, seg.quad);
    assert.strictEqual(pose.surface, seg.surface);
    assert.ok(pose.tooth >= 0 && pose.tooth <= 4);
    if (pose.settled) assert.strictEqual(pose.tooth, pose.stop);
    if (pose.stroke === 'vertical') assert.ok(pose.surface === 'inner' && pose.stop <= L.VERTICAL_TEETH);
  }
  assert.strictEqual(L.brushPose(120, 120), null);
});

test('the brush appears in a new quadrant rather than travelling across the mouth', () => {
  for (const d of DURATIONS) for (const qStart of [3, 6, 9]) {
    const t = qStart * d / L.N + 0.001;
    const pose = L.brushPose(t, d);
    assert.ok(pose.alpha < 0.1);
    assert.strictEqual(pose.tooth, pose.stop);
  }
});

test('timeline: start, tick, pause freezes, completion, reset restores', () => {
  const s = L.create(120);
  assert.deepStrictEqual(L.tick(s, 1), []);                     // idle: nothing moves
  assert.strictEqual(s.elapsed, 0);
  assert.deepStrictEqual(L.start(s), [{ type: 'segment', index: 0, quadChange: true }]);
  let events = [];
  for (let i = 0; i < 400; i++) events.push(...L.tick(s, 0.1));   // 40 s
  assert.deepStrictEqual(events.map(e => e.index), [1, 2, 3, 4]);
  assert.strictEqual(events[2].quadChange, true);
  L.pause(s);
  const before = s.elapsed;
  for (let i = 0; i < 50; i++) L.tick(s, 0.2);
  assert.strictEqual(s.elapsed, before);
  assert.deepStrictEqual(L.start(s), [{ type: 'resume', index: 4 }]);
  events = [];
  for (let i = 0; i < 1000 && s.status === 'running'; i++) events.push(...L.tick(s, 0.1));
  assert.strictEqual(s.status, 'finale');
  assert.deepStrictEqual(events[events.length - 1], { type: 'complete' });
  L.reset(s);
  assert.deepStrictEqual(s, { duration: 120, elapsed: 0, status: 'idle', seg: -1 });
  for (const b of L.BUGS) assert.deepStrictEqual(L.bugState(b, s.elapsed, s.duration).alive, true);
});

test('changing the duration keeps the same cue, the same point, and the same bugs', () => {
  for (const from of DURATIONS) for (const to of DURATIONS) for (const t of [0, 7.3, from / 2 + 1, from - 0.5]) {
    const s = L.create(from); L.start(s); s.elapsed = t;
    const before = L.locate(s.elapsed, s.duration);
    const alive = L.BUGS.map(b => L.bugState(b, s.elapsed, s.duration).alive);
    L.setDuration(s, to);
    const after = L.locate(s.elapsed, s.duration);
    assert.strictEqual(after.index, before.index);
    assert.ok(Math.abs(after.frac - before.frac) < 1e-9);
    assert.deepStrictEqual(L.BUGS.map(b => L.bugState(b, s.elapsed, s.duration).alive), alive);
  }
});

test('fixed checkpoints (2 minutes): bugs left at 120, 110, 100, 90, 60, 30, 20, 10, 3, 2, 1, 0 s remaining', () => {
  const expected = { 120: 36, 110: 33, 100: 30, 90: 27, 60: 18, 30: 9, 20: 6, 10: 3, 3: 1, 2: 1, 1: 1, 0: 0 };
  for (const [left, count] of Object.entries(expected)) {
    const t = 120 - Number(left);
    assert.strictEqual(L.aliveCount(t, 120), count, `${left} s left`);
  }
  // the very last bug stays, clearly visible, until the completion boundary
  const last = L.BUGS[L.BUGS.length - 1];
  assert.strictEqual(L.bugRemoveAt(last, 120), 120);
  const st = L.bugState(last, 119.999, 120);
  assert.ok(st.alive && st.scale >= 0.7);
  assert.strictEqual(L.aliveCount(119.999, 120), 1);
});

test('a bug that is still there is never smaller than 70 %', () => {
  for (const d of DURATIONS) for (let t = 0; t < d; t += 0.03) for (const b of L.BUGS) {
    const st = L.bugState(b, t, d);
    if (st.alive) assert.ok(st.scale >= 0.7 - 1e-9);
  }
});

test('the eyes look where the brush is, and turn to the next quadrant a moment before it moves', () => {
  for (const d of DURATIONS) {
    for (let t = 0; t < d; t += 0.05) {
      const g = L.gaze(t, d), pose = L.brushPose(t, d);
      assert.strictEqual(g.from, pose.quad);
      if (g.to !== g.from) {
        const next = L.SEGMENTS[Math.min(L.N - 1, (Math.floor(t / (d / 4)) + 1) * 3)];
        assert.strictEqual(g.to, next.quad);
        assert.ok((Math.floor(t / (d / 4)) + 1) * d / 4 - t <= 0.8 + 1e-9, 'only just before the change');
      }
    }
    for (const b of [1, 2, 3]) assert.ok(L.gaze(b * d / 4, d).blink > 0.99);
    assert.strictEqual(L.gaze(d / 8, d).blink, 0);
  }
});

test('spoken lines are plain words: no symbols, numbers or emoji, and every line is recorded', () => {
  const fs = require('node:fs'), path = require('node:path');
  const lines = JSON.parse(fs.readFileSync(path.join(__dirname, 'lines.json'), 'utf8'));
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const used = JSON.parse(html.match(/const CLIP_KEYS = (\[[^\]]*\])/)[1].replace(/'/g, '"'));
  for (const l of lines) {
    assert.match(l.text, /^[A-Za-z ,.!?'’]+$/, l.key);
    assert.ok(fs.existsSync(path.join(__dirname, 'voice', l.key + '.mp3')), 'recorded: ' + l.key);
  }
  for (const k of used) assert.ok(lines.some(l => l.key === k), 'line exists: ' + k);
});
