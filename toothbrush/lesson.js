/* Toothbrush Timer — the lesson model.
 *
 * One timeline drives everything you see and hear: which quadrant and surface is being coached,
 * where the brush is, and which sugar bugs are still there. Every visible state is a pure function
 * of (elapsed seconds, total duration), so pausing freezes it, reset restores it, and changing the
 * duration keeps the child at the same point of the lesson.
 *
 * The lesson: four quadrants, each split into outside, chewing tops and inside (12 equal cues; 10 s
 * each at 2 minutes). Teeth are numbered per quadrant from the front: 0 central incisor,
 * 1 lateral incisor, 2 canine, 3 first molar, 4 second molar (a child's 10 baby teeth per jaw).
 */
(function (root) {
  'use strict';

  const QUADS = [
    { id: 'UR', jaw: 'upper', side: 'right', label: 'Top right' },
    { id: 'UL', jaw: 'upper', side: 'left', label: 'Top left' },
    { id: 'LL', jaw: 'lower', side: 'left', label: 'Bottom left' },
    { id: 'LR', jaw: 'lower', side: 'right', label: 'Bottom right' },
  ];
  const SURFACES = ['outer', 'chewing', 'inner'];
  const SURFACE_LABEL = { outer: 'Outside', chewing: 'Chewing tops', inner: 'Inside' };

  // Where the brush stops (in order) and which teeth carry a sugar bug, per surface. The brush
  // snakes through the quadrant: outside back-to-front, chewing tops front-to-back over the molars,
  // inside back-to-front, ending upright behind the front teeth. The last stop always has a bug, so
  // the last bug of a cue goes exactly when the cue ends.
  const PLAN = {
    outer:   { stops: [4, 3, 2, 1, 0], bugs: [4, 2, 0] },
    chewing: { stops: [3, 4],          bugs: [3, 4, 4] },
    inner:   { stops: [4, 3, 2, 1, 0], bugs: [4, 2, 0] },
  };
  const VERTICAL_TEETH = 1;   // inside surfaces of teeth 0–1: brush held upright, up-and-down strokes

  const SEGMENTS = [];
  QUADS.forEach((q, qi) => SURFACES.forEach((surface, si) => SEGMENTS.push({
    index: SEGMENTS.length, quad: q.id, qi, surface, si, stops: PLAN[surface].stops,
  })));
  const N = SEGMENTS.length;

  const BUGS = [];
  SEGMENTS.forEach(seg => {
    const plan = PLAN[seg.surface], n = plan.stops.length;
    plan.stops.forEach((tooth, k) => {
      const here = plan.bugs.filter(t => t === tooth).length;
      for (let j = 0; j < here; j++) {
        BUGS.push({
          id: BUGS.length, seg: seg.index, quad: seg.quad, surface: seg.surface, tooth, slot: j, of: here,
          removeFrac: (k + (j + 1) / here) / n,     // fraction of its cue at which it is gone
        });
      }
    });
  });

  /** Where in the lesson `elapsed` falls. */
  function locate(elapsed, duration) {
    if (elapsed >= duration) return { index: N, frac: 1, inSeg: 0, done: true };
    const sd = duration / N;
    const index = Math.max(0, Math.min(N - 1, Math.floor(elapsed / sd)));
    const inSeg = elapsed - index * sd;
    return { index, frac: inSeg / sd, inSeg, done: false };
  }

  function bugRemoveAt(bug, duration) { return (bug.seg + bug.removeFrac) * duration / N; }

  /** A bug is fully there until shortly before its time, shrinks while the brush is on it, and is
   *  gone from its removal time on. Bugs outside the current cue never change. */
  function bugState(bug, elapsed, duration) {
    const at = bugRemoveAt(bug, duration);
    if (elapsed >= at) return { alive: false, scale: 0, active: false, since: elapsed - at };
    const loc = locate(elapsed, duration);
    const active = !loc.done && loc.index === bug.seg;
    const dwell = duration / N / PLAN[bug.surface].stops.length;
    const win = Math.min(0.6, dwell * 0.6) / bug.of;
    const scale = active && elapsed > at - win ? Math.max(0.05, (at - elapsed) / win) : 1;
    return { alive: true, scale, active, since: 0 };
  }

  function ease(m) { return m < 0.5 ? 2 * m * m : 1 - Math.pow(-2 * m + 2, 2) / 2; }

  /** Where the brush is: always on the current cue's quadrant and surface. `tooth` is fractional
   *  while it slides between neighbouring stops; `tilt` 0 = along the teeth, 1 = upright. */
  function brushPose(elapsed, duration) {
    const loc = locate(elapsed, duration);
    if (loc.done) return null;
    const seg = SEGMENTS[loc.index], n = seg.stops.length;
    const dwell = duration / N / n;
    const k = Math.min(n - 1, Math.floor(loc.frac * n));
    const inDwell = loc.inSeg - k * dwell;
    const moveTime = Math.min(0.35, dwell * 0.3);
    const m = Math.min(1, inDwell / moveTime), e = ease(m);
    const stop = seg.stops[k];
    let fromTooth = stop, fromSurface = seg.surface, alpha = 1;
    if (k > 0) fromTooth = seg.stops[k - 1];
    else {
      const prev = SEGMENTS[loc.index - 1];
      if (prev && prev.quad === seg.quad) { fromTooth = prev.stops[prev.stops.length - 1]; fromSurface = prev.surface; }
      else alpha = e;                         // new quadrant: the brush appears there, never travels across
    }
    const upright = (surface, tooth) => surface === 'inner' && tooth <= VERTICAL_TEETH ? 1 : 0;
    const tilt = upright(fromSurface, fromTooth) + (upright(seg.surface, stop) - upright(fromSurface, fromTooth)) * e;
    const stroke = seg.surface === 'outer' ? 'circles' : seg.surface === 'chewing' ? 'scrub' : (upright(seg.surface, stop) ? 'vertical' : 'scrub');
    return {
      seg: seg.index, quad: seg.quad, surface: seg.surface, fromSurface, blend: e,
      tooth: fromTooth + (stop - fromTooth) * e, stop, tilt, stroke, alpha, settled: m >= 1,
    };
  }

  // ---- Timeline (the one source of truth for the session) ----
  function create(duration) { return { duration, elapsed: 0, status: 'idle', seg: -1 }; }

  function start(s) {
    if (s.status === 'paused') { s.status = 'running'; return [{ type: 'resume', index: s.seg }]; }
    if (s.status !== 'idle') return [];
    s.status = 'running'; s.seg = 0;
    return [{ type: 'segment', index: 0, quadChange: true }];
  }
  function pause(s) { if (s.status === 'running') { s.status = 'paused'; return true; } return false; }
  function reset(s) { s.elapsed = 0; s.status = 'idle'; s.seg = -1; }

  /** Advance by dt seconds while running; returns the cue changes and completion it crossed. */
  function tick(s, dt) {
    if (s.status !== 'running') return [];
    s.elapsed = Math.min(s.duration, s.elapsed + Math.max(0, dt));
    const loc = locate(s.elapsed, s.duration);
    if (loc.done) { s.status = 'finale'; s.seg = N; return [{ type: 'complete' }]; }
    if (loc.index !== s.seg) {
      s.seg = loc.index;
      return [{ type: 'segment', index: loc.index, quadChange: loc.index % 3 === 0 }];
    }
    return [];
  }

  /** Change the length without skipping or clearing anything: same cue, same point within it. */
  function setDuration(s, duration) {
    const loc = locate(s.elapsed, s.duration);
    s.elapsed = loc.done ? duration : (loc.index + loc.frac) * duration / N;
    s.duration = duration;
  }

  const api = {
    QUADS, SURFACES, SURFACE_LABEL, PLAN, SEGMENTS, BUGS, N, VERTICAL_TEETH,
    locate, bugRemoveAt, bugState, brushPose, create, start, pause, reset, tick, setDuration,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Lesson = api;
})(this);
