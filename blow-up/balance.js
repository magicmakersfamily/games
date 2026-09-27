/* Headless balance run: every playable day style × a few play strategies × several seeds.
   Run with `node balance.js`. It prints numbers; it never decides which style should "win". */
'use strict';
const S = require('./sim.js');
const C = require('./content.js');

// Strategies get the state and a view each minute and may use cards.
const strategies = {
  none: null,
  goodSupport(s, v) {
    const next = s._next || (s._next = {});
    const ready = k => (next[k] || 0) <= s.t;
    const act = (id, gap) => { if (ready(id) && S.toolStatus(s, id) === 'good') { S.use(s, id); next[id] = s.t + gap; return true; } return false; };
    if (v.phase === 'eruption') { act('close', 3) || act('quiet', 4); return; }
    if (v.phase === 'cooling') { act('breathe', 5) || act('water', 8) || act('stomp', 6); return; }
    if (v.phase === 'reconnect') { act('name', 6) || act('here', 6) || act('hug', 8); return; }
    if (v.phase === 'repair') { act('sorry', 5) || act('fix', 5); return; }
    if (v.phase === 'learn') { act('praise', 5); return; }
    if (v.hungry) act('snack', 60);
    // A heads-up before planned transitions.
    const sc = v.scene, end = sc.at + sc.dur;
    if (end - s.t === 8) act('warn', 1);
    if (v.zone === 'yellow') act(s.t % 2 ? 'breathe' : 'stomp', 15);
    if (v.zone === 'red') act('name', 10) || act('hug', 10) || act('corner', 10);
    if (v.zone === 'green' && s.t % 90 === 0) act('breathe', 30); // practise while calm
  },
  unhelpful(s, v) {
    const next = s._next || (s._next = {});
    const act = (id, gap) => { if ((next[id] || 0) <= s.t) { S.use(s, id); next[id] = s.t + gap; } };
    if (v.phase === 'eruption' || v.phase === 'cooling') { act('lecture', 6); return; }
    if (v.phase === 'reconnect') { act('consequence', 10); return; }
    if (v.zone === 'yellow') act('calmdown', 30);
    if (v.zone === 'red') act('silly', 20);
  },
};
const sayWith = {
  none: null,
  goodSupport: () => 'support',
  unhelpful: () => 'control',
};

function summarize(s) {
  const r = S.receipt(s);
  return {
    blowups: s.blowups.length, types: s.blowups.map(b => b.type + (b.second ? '*' : '') + (b.collapse ? '^' : '')).join(','),
    peak: r.peak, end: S.pressure(s), thr: S.threshold(s), jars: [S.jar(s, 'choice'), S.jar(s, 'can'), S.jar(s, 'together')].join('/'),
    flat: s.flat || s.log.some(e => e.kind === 'flat'), total: r.total, eq: r.equation,
  };
}

if (require.main === module) {
  const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
  const styles = Object.keys(C.DAY_STYLES).filter(k => C.DAY_STYLES[k].scenes);
  for (const st of styles) for (const name of Object.keys(strategies)) {
    const rows = seeds.map(seed => summarize(S.runDay(st, { seed, strategy: strategies[name], sayWith: sayWith[name] })));
    const avg = k => (rows.reduce((a, r) => a + r[k], 0) / rows.length).toFixed(2);
    console.log(`${st.padEnd(10)} ${name.padEnd(12)} blowups ${avg('blowups')}  peak ${avg('peak')}  end ${avg('end')}  flat ${rows.filter(r => r.flat).length}/${rows.length}  jars ${rows[0].jars}  types ${rows.map(r => r.types || '-').join(' | ')}`);
  }
}
module.exports = { strategies, sayWith, summarize };
