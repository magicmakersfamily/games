/* Collects every line the game can say, per speaker, into tools/lines.json for render-voice.py.
   Run: node tools/voice-lines.js. Templates with a small set of values are expanded; open-ended
   lines (lists of causes) are spoken as recorded pieces in a row. */
'use strict';
const path = require('path');
const C = require('../content.js');
const S = require('../sim.js');
const { plain, fill } = C;
const lines = new Map();                 // key -> { who, text }
const add = (who, text) => { if (!text || typeof text !== 'string' || /\{\w+\}/.test(text)) return; lines.set(C.voiceKey(who, text), { who, text }); };
const walk = (who, o) => { if (typeof o === 'string') add(who, o); else if (Array.isArray(o)) o.forEach(x => walk(who, x)); else if (o && typeof o === 'object') Object.values(o).forEach(x => walk(who, x)); };

// Storyteller
walk('narr', C.NARR);
walk('narr', C.NARR_SCENES);
walk('narr', C.CARD_NARR);
add('narr', C.STR.cookieNote); add('narr', C.STR.sockReveal);
for (const [k, st] of Object.entries(C.DAY_STYLES)) if (st.scenes) add('narr', st.name + '. ' + st.blurb);
for (const sm of Object.values(C.SAYS)) { add('narr', fill(C.NARR.saySupport, { done: sm.done })); add('narr', fill(C.NARR.sayControl, { done: sm.done })); }
for (const k of ['choice', 'can', 'together']) for (let n = 0; n <= 10; n++) add('narr', fill(C.NARR.jar[k], { n }));
C.NARR.hours.forEach((h, i) => { const hr = 7 + i; add('narr', fill(C.NARR.clock, { h, part: hr < 12 ? 'in the morning' : hr < 17 ? 'in the afternoon' : 'in the evening' })); });
for (const k of C.LOAD_ORDER) add('narr', fill(C.NARR.mostDrops, { x: C.LOADS[k].name.toLowerCase() }));
for (let m = 2; m <= 60; m++) add('narr', fill(C.NARR.receipt.marbles, { m }));
for (const c of [...C.UHOH, ...C.HELPERS, ...C.TOOLS]) add('narr', plain(c.name));
for (const c of C.CHAOS) add('narr', c.name);
for (const f of Object.values(C.FEELINGS)) add('narr', f.en);
add('narr', 'Playground. Slides, swings, other kids.'); add('narr', 'Field. Trees, mud, lots of room.');
// Every label the engine can put on the receipt or in the log (found by playing many days).
const strat = require('../balance.js');
for (const st of ['rushed', 'adventure']) for (const name of Object.keys(strat.strategies)) for (let seed = 1; seed <= 40; seed++) {
  const s = S.runDay(st, { seed, strategy: strat.strategies[name], sayWith: strat.sayWith[name] });
  for (const label of Object.keys(s.tally)) add('narr', plain(label));
  for (const e of s.log) if (e.label) add('narr', plain(e.label));
  for (const j of Object.values(s.jars)) for (const m of j) add('pip', m.label);
}
for (const st of Object.values(C.DAY_STYLES)) for (const sc of st.scenes || []) {
  add('narr', plain(sc.label));
  for (const ev of sc.events || []) if (ev.fx) { add('narr', plain(ev.fx.label)); add('pip', ev.fx.thought); if (ev.fx.marble) add('pip', ev.fx.marble); }
}
// Pip
walk('pip', C.NARR_PIP);
for (const c of [...C.UHOH, ...C.HELPERS, ...C.TOOLS]) { add('pip', c.thought); add('pip', c.backThought); if (c.marble) add('pip', c.marble); }
for (const c of C.CHAOS) add('pip', c.thought);
for (const b of Object.values(C.BLOWUPS)) add('pip', b.kid);
for (const sm of Object.values(C.SAYS)) if (sm.support.marble) add('pip', sm.support.marble);
add('pip', 'From other days'); add('pip', 'A good moment');
// The grown-up
for (const c of [...C.HELPERS, ...C.TOOLS]) add('adult', c.say);
for (const sm of Object.values(C.SAYS)) { add('adult', sm.control.text); add('adult', sm.support.text); }
// Professor Pickle
for (const sc of Object.values(C.SCIENCE)) add('pickle', sc.kid);
// Mandarin words (Traditional characters, Taiwan Mandarin voice)
for (const f of Object.values(C.FEELINGS)) add('zh', f.zh);
for (const j of Object.values(C.JARS)) add('zh', j.zh);
for (const z of Object.values(C.ZONES)) add('zh', z.zh);
add('zh', C.STR.titleZh);

const out = [...lines].map(([key, v]) => Object.assign({ key }, v));
require('fs').writeFileSync(path.join(__dirname, 'lines.json'), JSON.stringify(out, null, 1));
const by = {}; for (const l of out) by[l.who] = (by[l.who] || 0) + 1;
console.log(out.length, 'lines', by);
