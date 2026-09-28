/* Blow Up — the engine. One tick is one sim-minute, 7:00 → 20:00. The engine knows only numbers
   and content data: pressure per load type, the three jars, body states, stress chemistry, phases
   after a blow-up, skills and the event log. Drawing and sound live in index.html. Deterministic:
   the same seed and the same inputs give the same day. */
(function (root) {
  'use strict';
  const C = (typeof module !== 'undefined' && module.exports) ? require('./content.js') : root.BUContent;
  const { hm, LOAD_ORDER } = C;

  // Every tuning knob in one place.
  const CONFIG = {
    DAY_END: 780,                    // 20:00
    THRESH_BASE: 60, THRESH_CHOICE: 2, THRESH_CAN: 1, THRESH_TOGETHER: 1,
    ZONE_YELLOW: 0.40, ZONE_RED: 0.75,
    JAR_MAX: 10, JAR_START: 5,
    HUNGRY_AT: 180,                  // minutes after a full meal
    HUNGRY_SPIKE: 1.5, HUNGRY_DRIFT: 0.08,
    TIRED_HELP: 0.5, TIRED_CARD_MIN: 90, TIRED_DRIFT: 0.03,
    RUSHED_CONTROL: 1.3,
    SICK_SPIKE: 1.5, SICK_HELP: 0.5,
    CHOICE_SPIKE_CUT: 0.3,           // a full My Choice jar cuts spikes by 30%
    TOGETHER_HELP_BOOST: 0.3,        // a full Together jar makes helpers 30% stronger
    REACTANCE: 1.25, REACTANCE_RATIO: 0.6,
    DECAY: 0.003,                    // share of the bucket that settles on its own each minute
    PHASE_DECAY: { eruption: 0.03, cooling: 0.02, reconnect: 0.012, repair: 0.008, learn: 0.006 },
    ADRENALINE_PER_DROP: 1.2, ADRENALINE_DECAY: 0.12,
    CORTISOL_RED: 0.35, CORTISOL_BLOWUP: 35, CORTISOL_DECAY: 0.012, CORTISOL_SOOTHE: 0.3,
    CORTISOL_FLOOR: 0.6,             // during recovery, pressure can't drop below cortisol × this
    CORT_TALK: 30, TALK_SPIKE: 14,   // talking while cortisol is above CORT_TALK bounces back
    MASK_HOLD: 1.15, MASK_EFFORT: 0.04,
    ERUPTION_MIN: 4, ERUPTION_ADRENALINE: 45,
    COOL_RATIO: 0.6, COOL_CORTISOL: 40,
    RECONNECT_RATIO: 0.45, NAMED_RATIO: 0.6,
    PHASE_TIMEOUT: { eruption: 15, cooling: 40, reconnect: 30, repair: 20, learn: 15 },
    STRINGS_AT: 3, FLAT_JAR: 1, FLAT_MINUTES: 30, FLAT_RATIO: 0.4,
    XP_PER_LEVEL: 2, SKILL_MAX: 3, SKILL_BOOST: 0.1, SELF_USE: 0.8, SELF_COOLDOWN: 30,
    ADULT_SETTLE: 0.02, ADULT_CALM: 30, ADULT_STRESSED: 60, ADULT_HELPED: 2,
    WAVE_BLUE: 0.06, WAVE_RED: 0.08, SECOND_CORTISOL: 12, ADULT_FROM_KID_RED: 0.15, ADULT_FROM_BLOWUP: 15,
    WITCHING: [hm(16), hm(18, 30)], WITCHING_DRIFT: 0.03,
    SOCK_DRIFT: 0.06,
    CHAOS_P: 0.004, CHAOS_GAP: 60,
    WARN_CUT: 0.5,
    DOG_QUIET: 20,
    // Using the same card again and again quickly works less each time (getting used to it).
    HABIT_HELP: 0.6, HABIT_UHOH: 0.35, HABIT_HALF: 10,   // strength per repeat; half-life in sim-minutes
  };

  // --- Small helpers -------------------------------------------------------------------------
  const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
  const r1 = x => Math.round(x * 10) / 10;
  function rng(s) {                                  // mulberry32, state kept in s.rng
    s.rng = (s.rng + 0x6D2B79F5) | 0;
    let t = s.rng;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const byId = {};
  for (const c of C.UHOH) byId[c.id] = Object.assign({ tray: 'uhoh' }, c);
  for (const c of C.HELPERS) byId[c.id] = Object.assign({ tray: 'helper' }, c);
  for (const c of C.TOOLS) byId[c.id] = Object.assign({ tray: 'tool' }, c);
  const card = id => byId[id];

  function emit(s, kind, data) { s.events.push(Object.assign({ kind, t: s.t }, data || {})); }

  // --- State -----------------------------------------------------------------------------------
  function create(opts) {
    opts = opts || {};
    const styleId = opts.style || 'rushed';
    const style = C.DAY_STYLES[styleId];
    if (!style || !style.scenes) throw new Error('No playable day style: ' + styleId);
    const kidId = opts.kid || 'pip';
    const seed = (opts.seed == null ? 1 : opts.seed) >>> 0;
    const jar = () => Array.from({ length: CONFIG.JAR_START }, () => ({ label: 'From other days', t: -1 }));
    const skills = {};
    for (const k of ['breathe', 'stomp']) {
      const saved = opts.skills && opts.skills[k];
      skills[k] = { xp: saved ? saved.xp | 0 : 0, level: 0 };
      skills[k].level = levelFor(skills[k].xp);
    }
    const s = {
      styleId, style, kidId, kid: C.KIDS[kidId], seed, rng: seed,
      t: 0, done: false, pending: null, sceneIdx: -1, scene: null, loc: null, placeOverride: {},
      load: Object.fromEntries(LOAD_ORDER.map(k => [k, 0])),
      jars: { choice: jar(), can: jar(), together: jar() },
      sinceMeal: 60, tiredUntil: -1, sick: !!opts.sick, sock: false, warnedUntil: -1,
      adrenaline: 0, cortisol: 0,
      adult: style.adultStart || 35, wave: null,
      phase: 'day', phaseClock: 0, named: false, repaired: false, praised: false,
      blowups: [], bounced: 0, dogQuiet: 0,
      skills, selfCooldown: 0, xpToday: {}, usedTool: {},
      flatClock: 0, flat: false, zone: 'green', seenRed: false,
      chaosLast: -999, lastStraw: null, recent: {},
      tally: {},                     // label → { delta, src, type, n }
      log: [],                       // discrete events, for the graph markers and the receipt
      graph: [],                     // [t, pressure, threshold] each minute
      marblesEarned: 0, used: {},
      events: [],
      autoSay: !!opts.autoSay,
      start: 0, peak: 0,
    };
    if (style.sleepDebt) s.tiredUntil = hm(9);
    enterScene(s, 0);
    s.start = pressure(s);
    return s;
  }

  function levelFor(xp) { return Math.min(CONFIG.SKILL_MAX, Math.floor(xp / CONFIG.XP_PER_LEVEL)); }

  // --- Derived values -----------------------------------------------------------------------
  const pressure = s => LOAD_ORDER.reduce((a, k) => a + s.load[k], 0);
  const jar = (s, k) => s.jars[k].length;
  const threshold = s => CONFIG.THRESH_BASE + CONFIG.THRESH_CHOICE * jar(s, 'choice') + CONFIG.THRESH_CAN * jar(s, 'can') + CONFIG.THRESH_TOGETHER * jar(s, 'together');
  const ratio = s => pressure(s) / threshold(s);
  function zoneOf(r) { return r >= 1 ? 'blowup' : r >= CONFIG.ZONE_RED ? 'red' : r >= CONFIG.ZONE_YELLOW ? 'yellow' : 'green'; }
  const zone = s => zoneOf(ratio(s));
  const hungry = s => s.sinceMeal >= CONFIG.HUNGRY_AT;
  function tired(s) {
    if (s.t < s.tiredUntil) return true;
    return s.t >= (s.style.sleepDebt ? hm(17) : hm(18, 30));
  }
  const rushed = s => !!(s.scene && s.scene.rushed);
  const masking = s => !!(C.LOCATIONS[s.loc] && C.LOCATIONS[s.loc].masking) && s.phase === 'day';
  const dominant = s => LOAD_ORDER.reduce((a, k) => s.load[k] > s.load[a] ? k : a, LOAD_ORDER[0]);
  const strings = s => jar(s, 'choice') <= CONFIG.STRINGS_AT ? CONFIG.STRINGS_AT + 1 - jar(s, 'choice') : 0;
  const floor = s => s.phase === 'day' ? 0 : s.cortisol * CONFIG.CORTISOL_FLOOR;

  function spikeMult(s, type, c) {
    let m = 1;
    if (hungry(s)) m *= CONFIG.HUNGRY_SPIKE;
    if (s.sick) m *= CONFIG.SICK_SPIKE;
    if (type === 'control' && rushed(s)) m *= CONFIG.RUSHED_CONTROL;
    if (type === 'sensory') m *= s.kid.noise || 1;
    m *= 1 - CONFIG.CHOICE_SPIKE_CUT * jar(s, 'choice') / CONFIG.JAR_MAX;
    if (jar(s, 'choice') === 0 && ratio(s) > CONFIG.REACTANCE_RATIO) m *= CONFIG.REACTANCE;
    if (c && c.transition && s.t < s.warnedUntil) m *= CONFIG.WARN_CUT;
    return m;
  }
  function helpMult(s, c) {
    let m = 1;
    if (tired(s)) m *= CONFIG.TIRED_HELP;
    if (s.sick) m *= CONFIG.SICK_HELP;
    m *= 1 + CONFIG.TOGETHER_HELP_BOOST * jar(s, 'together') / CONFIG.JAR_MAX;
    if (c && c.move) m *= s.kid.movement || 1;
    if (c && c.skill) m *= 1 + CONFIG.SKILL_BOOST * s.skills[c.skill].level;
    return m;
  }

  // --- Every pressure change goes through here, so the receipt always adds up ---------------------
  function note(s, label, delta, src, type) {
    if (!delta) return;
    const e = s.tally[label] || (s.tally[label] = { delta: 0, src, type, n: 0 });
    e.delta += delta; e.n++;
  }
  function add(s, type, amount, label, src) {
    const before = s.load[type];
    s.load[type] = Math.max(0, before + amount);
    const d = s.load[type] - before;
    note(s, label, d, src || 'life', type);
    return d;
  }
  // Remove drops: the target type first, then evenly by share. Recovery can't go below the floor.
  function drain(s, amount, label, src, target) {
    const p0 = pressure(s);
    amount = Math.min(amount, Math.max(0, p0 - floor(s)));
    if (amount <= 0) return 0;
    let left = amount;
    if (target && s.load[target] > 0) { const d = Math.min(left, s.load[target]); s.load[target] -= d; left -= d; }
    const rest = pressure(s);
    if (left > 0 && rest > 0) { const f = Math.min(1, left / rest); for (const k of LOAD_ORDER) s.load[k] -= s.load[k] * f; }
    for (const k of LOAD_ORDER) if (s.load[k] < 1e-9) s.load[k] = 0;
    const d = pressure(s) - p0;
    note(s, label, d, src || 'rest', target || null);
    return d;
  }

  function marble(s, k, n, label) {
    const j = s.jars[k];
    const before = j.length;
    if (n > 0) for (let i = 0; i < n && j.length < CONFIG.JAR_MAX; i++) { j.push({ label: label || 'A good moment', t: s.t }); s.marblesEarned++; }
    if (n < 0) for (let i = 0; i < -n && j.length; i++) j.pop();
    if (j.length !== before) emit(s, 'marble', { jar: k, n: j.length - before, label });
    return j.length - before;
  }
  function jars(s, fx, label) { if (fx) for (const k in fx) marble(s, k, fx[k], label); }

  function logEvent(s, entry) { s.log.push(Object.assign({ t: s.t }, entry)); }

  // --- Scenes -----------------------------------------------------------------------------------
  function sceneAt(s, t) {
    const sc = s.style.scenes;
    for (let i = sc.length - 1; i >= 0; i--) if (t >= sc[i].at) return i;
    return 0;
  }
  function enterScene(s, i) {
    const prevMasking = masking(s);
    s.sceneIdx = i; s.scene = s.style.scenes[i];
    s.loc = s.placeOverride[s.scene.id] || s.scene.loc;
    emit(s, 'scene', { id: s.scene.id, loc: s.loc });
    if (s.scene.pick && !s.placeOverride[s.scene.id]) {
      if (s.autoSay) s.placeOverride[s.scene.id] = s.scene.pick[0];
      else s.pending = { kind: 'pick', scene: s.scene.id, options: s.scene.pick.slice() };
    }
    if (s.scene.bath && s.sock) { s.sock = false; emit(s, 'sock', { how: 'bath' }); }
    // Restraint collapse: the kid held it together at school; now it comes out.
    if (prevMasking && !masking(s) && s.phase === 'day' && ratio(s) >= 1) blowUp(s, { collapse: true });
  }
  function choosePlace(s, loc) {
    if (!s.pending || s.pending.kind !== 'pick' || !s.pending.options.includes(loc)) return false;
    s.placeOverride[s.pending.scene] = loc; s.loc = loc; s.pending = null;
    emit(s, 'scene', { id: s.scene.id, loc });
    return true;
  }

  // --- Using a card -----------------------------------------------------------------------------
  // Returns { delta, mood: 'calmer' | 'madder' | 'same', thought, anim, bounced, backfire }.
  // How many recent uses of this card still count (fades with a half-life).
  function repeats(s, id) {
    const r = s.recent[id];
    return r ? r.n * Math.pow(0.5, (s.t - r.t) / CONFIG.HABIT_HALF) : 0;
  }
  function habit(s, c) {
    const k = c.tray === 'uhoh' ? CONFIG.HABIT_UHOH : CONFIG.HABIT_HELP;
    return 1 / (1 + k * repeats(s, c.id));
  }
  function use(s, id, opts) {
    const c = card(id);
    if (!c || s.done) return null;
    s.used[id] = (s.used[id] || 0) + 1;
    const p0 = pressure(s);
    const res = { id, delta: 0, thought: null, anim: c.anim || null, bounced: false, backfire: false, habit: habit(s, c), repeat: repeats(s, id) };
    if (!(opts && opts.scheduled)) s.recent[id] = { n: repeats(s, id) + 1, t: s.t };

    // Talking while the body is still flooded bounces straight back.
    if (c.talking && s.cortisol > CONFIG.CORT_TALK) {
      s.bounced++;
      add(s, 'emotional', CONFIG.TALK_SPIKE, 'Talking too soon (words bounced off)', 'life');
      s.adrenaline = clamp(s.adrenaline + 20, 0, 100);
      res.bounced = true; res.anim = 'pingpong'; res.thought = c.backThought || C.NARR_PIP.lala;
      logEvent(s, { kind: 'bounce', id, label: c.name });
      if (s.phase === 'day') checkBlowup(s, { by: id });
      else if (s.phase !== 'eruption' && !s.secondThisStorm && ratio(s) >= 1) { s.secondThisStorm = true; blowUp(s, { second: true }); }
      else if (s.phase === 'eruption') s.phaseClock = 0;       // the storm just goes on longer
      else if (s.phase !== 'cooling') setPhase(s, 'cooling'); else s.phaseClock = 0;
      return finish(s, res, p0);
    }
    if (c.tray === 'uhoh') applyUhoh(s, c, res);
    else applyHelper(s, c, res);
    checkBlowup(s, { second: s.phase !== 'day', by: id });
    return finish(s, res, p0);
  }
  function finish(s, res, p0) {
    res.delta = r1(pressure(s) - p0);
    res.mood = res.delta > 0.05 ? 'madder' : res.delta < -0.05 ? 'calmer' : 'same';
    emit(s, 'used', res);
    return res;
  }

  function applyUhoh(s, c, res, labelOverride) {
    const z = zone(s);
    let amt = c.amount;
    if (c.zone) amt *= c.zone[z === 'blowup' ? 'red' : z] || 1;
    if (c.phaseAmt && s.phase !== 'day') amt = c.phaseAmt;
    const label = labelOverride || c.name;
    const h = res.habit == null ? 1 : res.habit;
    const d = add(s, c.type, amt * spikeMult(s, c.type, c) * h, label, 'life');
    if (c.extra) for (const k in c.extra) add(s, k, c.extra[k] * spikeMult(s, k, c) * h, label, 'life');
    s.adrenaline = clamp(s.adrenaline + d * CONFIG.ADRENALINE_PER_DROP, 0, 100);
    if (c.set === 'hungry') s.sinceMeal = Math.max(s.sinceMeal, CONFIG.HUNGRY_AT);
    if (c.set === 'tired') s.tiredUntil = Math.max(s.tiredUntil, s.t + CONFIG.TIRED_CARD_MIN);
    if (c.sock) s.sock = true;
    jars(s, c.jar, c.name);
    if (c.lastStraw) s.lastStraw = { id: c.id, t: s.t };
    res.thought = c.thought;
    logEvent(s, { kind: 'uhoh', id: c.id, label, feel: c.feel, type: c.type, d: r1(pressure(s)) });
  }

  // How well a helper works right now: > 0 helps, 0 does nothing, < 0 backfires.
  function helperFactor(s, c) {
    let f;
    if (s.phase === 'day') {
      const z = zone(s);
      f = c.zone ? c.zone[z === 'blowup' ? 'red' : z] : 1;
      if (c.tray === 'tool') f = c.phase.learn;   // after-the-storm tools are for after the storm
      if (c.praise === 'specific' || c.practice) f = c.praise ? 0 : 0.5;
    } else f = (c.phase || C.ALL_PHASES)[s.phase];
    if (f == null) f = 1;
    if (c.pref === 'hugs' && s.kid.hugs === 'space') f = -Math.abs(f) * 0.8;
    return f;
  }
  // For the trays: 'good', 'weak' (greyed out) or 'backfire'.
  function toolStatus(s, id) {
    const c = card(id);
    if (!c) return 'good';
    if (c.tray === 'uhoh') return c.talking && s.phase !== 'day' ? 'backfire' : 'good';
    if (c.talking && s.cortisol > CONFIG.CORT_TALK) return 'backfire';
    const f = helperFactor(s, c);
    return f < 0 ? 'backfire' : f < 0.35 ? 'weak' : 'good';
  }

  function applyHelper(s, c, res) {
    const f = helperFactor(s, c), z0 = zone(s);
    if (f < 0) {
      res.backfire = true;
      res.thought = c.backThought || (c.pref === 'hugs' ? C.NARR_PIP.space : C.NARR_PIP.nope);
      const bf = c.backfire || { social: 8 };
      for (const k in bf) add(s, k, bf[k] * -f * spikeMult(s, k), c.name + ' (backfired)', 'support');
      s.adrenaline = clamp(s.adrenaline + 10, 0, 100);
      if (c.anim === 'porcupine') res.anim = 'porcupine';
      logEvent(s, { kind: 'backfire', id: c.id, label: c.name });
      return;
    }
    s.adult = clamp(s.adult - CONFIG.ADULT_HELPED + (c.adult || 0), 0, 100);
    if (f === 0) { res.thought = null; res.anim = res.anim || 'shrug'; logEvent(s, { kind: 'weak', id: c.id, label: c.name }); return; }
    const src = c.skill ? 'skill' : 'support';
    const eff = c.amount * f * helpMult(s, c) * res.habit;
    const d = drain(s, eff, c.name, src, c.target);
    if (s.phase !== 'day') s.cortisol = Math.max(0, s.cortisol + d * CONFIG.CORTISOL_SOOTHE);
    if (c.meal) s.sinceMeal = Math.min(s.sinceMeal, 0);
    if (c.clears === 'hungry') s.sinceMeal = 0;
    if (c.warn) s.warnedUntil = s.t + c.warn;
    if (c.names) {
      s.named = true; s.dogQuiet = CONFIG.DOG_QUIET;
      if (s.sock) { s.sock = false; emit(s, 'sock', { how: 'named' }); logEvent(s, { kind: 'reveal', id: 'sock', label: C.STR.sockReveal }); }
    }
    if (c.repair) s.repaired = true;
    if (c.praise === 'specific' && s.phase === 'learn') s.praised = true;
    if (c.praise === 'generic' && s.phase === 'learn') s.praisedGeneric = true;
    if (c.practice && (s.phase === 'learn' || s.phase === 'repair')) { s.praised = true; const k = s.skills.breathe.xp <= s.skills.stomp.xp ? 'breathe' : 'stomp'; gainXp(s, k); }
    // Jar marbles only when the helper really helped.
    if (c.jar && (c.praise !== 'specific' || s.phase === 'learn')) jars(s, c.jar, c.marble);
    // Practising a skill while calm builds it. Any completed use counts as "used", in any phase
    // or zone -- a skill tool used to help during recovery still counts as helping (DECISIONS D7),
    // it just doesn't build the skill the way using it while calm does.
    if (c.skill) {
      s.usedTool[c.skill] = (s.usedTool[c.skill] || 0) + 1;
      if (s.phase === 'day' && (z0 === 'green' || z0 === 'yellow')) gainXp(s, c.skill);
    }
    res.thought = c.say;
    logEvent(s, { kind: 'helper', id: c.id, label: c.name, d: r1(d) });
  }

  function gainXp(s, k) {
    const sk = s.skills[k];
    const before = sk.level;
    sk.xp++; sk.level = levelFor(sk.xp);
    s.xpToday[k] = (s.xpToday[k] || 0) + 1;
    emit(s, 'xp', { skill: k, xp: sk.xp, level: sk.level });
    if (sk.level > before) emit(s, 'levelup', { skill: k, level: sk.level });
  }

  // --- Say It Differently ---------------------------------------------------------------------
  function choose(s, how) {
    const p = s.pending;
    if (!p || p.kind !== 'say' || (how !== 'control' && how !== 'support')) return null;
    const say = C.SAYS[p.id];
    const opt = say[how];
    const p0 = pressure(s);
    if (how === 'control') {
      const d = add(s, 'control', opt.load * spikeMult(s, 'control'), opt.text, 'life');
      s.adrenaline = clamp(s.adrenaline + d * CONFIG.ADRENALINE_PER_DROP, 0, 100);
    } else if (opt.load) add(s, 'control', opt.load, opt.text, 'life');
    jars(s, opt.jar, opt.marble || opt.text);
    s.pending = null;
    logEvent(s, { kind: 'say', id: p.id, how, label: opt.text, outcome: say.done });
    const out = { id: p.id, how, outcome: say.done, delta: r1(pressure(s) - p0) };
    emit(s, 'said', out);
    checkBlowup(s, {});
    return out;
  }

  // After the storm: the grown-up validates before repair.
  function validation(s) {
    const recent = {};
    for (const e of s.log) if ((e.kind === 'uhoh' || e.kind === 'chaos' || (e.kind === 'event' && e.d > 0) || e.kind === 'bounce') && e.t >= s.t - 240) {
      recent[e.label] = recent[e.label] || { label: e.label, id: e.id, feel: e.feel, type: e.type, n: 0 };
      recent[e.label].n++;
    }
    const b = s.blowups[s.blowups.length - 1] || {};
    const causes = Object.values(recent).sort((a, c) => (c.type === b.dominant) - (a.type === b.dominant) || c.n - a.n).slice(0, 4);
    const feels = new Set(['angry']);
    if (b.hungry) feels.add('hungry');
    if (b.tired) feels.add('tired');
    if (b.sock) feels.add('itchy');
    for (const k of b.top || []) feels.add(C.LOAD_FEELING[k]);
    for (const x of causes) if (x.feel) feels.add(x.feel);
    return {
      causes, feelings: [...feels].slice(0, 6), blowup: b,
      cookie: !!(b.lastStraw && b.lastStraw.id === 'cookie'),
      sock: !!b.sock,
    };
  }
  function ack(s) {
    if (!s.pending || s.pending.kind !== 'validate') return false;
    s.pending = null; setPhase(s, 'repair');
    return true;
  }

  // --- Blow-ups and phases ----------------------------------------------------------------------
  function blowType(s, dom) {
    if (dom === 'body') return hungry(s) ? 'hangry' : 'noodle';
    return { control: 'whistle', social: 'volcano', sensory: 'tornado', thinking: 'volcano', emotional: 'gavel' }[dom];
  }
  function checkBlowup(s, info) {
    if (s.done || s.phase === 'eruption') return false;
    if (s.phase !== 'day' && s.secondThisStorm) return false;
    const hold = masking(s) ? CONFIG.MASK_HOLD : 1;
    if (ratio(s) >= hold) { blowUp(s, info || {}); return true; }
    return false;
  }
  function blowUp(s, info) {
    const dom = dominant(s);
    const top = LOAD_ORDER.slice().sort((a, b) => s.load[b] - s.load[a]).slice(0, 3).filter(k => s.load[k] > 0);
    const b = {
      t: s.t, n: s.blowups.length + 1, dominant: dom, type: blowType(s, dom), top,
      loads: Object.fromEntries(LOAD_ORDER.map(k => [k, r1(s.load[k])])),
      second: !!(info && info.second) || s.phase !== 'day', collapse: !!(info && info.collapse),
      hungry: hungry(s), tired: tired(s), sock: s.sock,
      lastStraw: s.lastStraw && s.lastStraw.t === s.t ? s.lastStraw : null,
      scene: s.scene.id, loc: s.loc,
    };
    s.blowups.push(b);
    s.cortisol = clamp(s.cortisol + (b.second ? CONFIG.SECOND_CORTISOL : CONFIG.CORTISOL_BLOWUP), 0, 100);
    if (!b.second) s.secondThisStorm = false;
    s.adrenaline = 100;
    s.adult = clamp(s.adult + CONFIG.ADULT_FROM_BLOWUP, 0, 100);
    s.named = false; s.repaired = false; s.praised = false; s.praisedGeneric = false;
    setPhase(s, 'eruption');
    logEvent(s, { kind: 'blowup', label: C.BLOWUPS[b.type].name, type: dom });
    emit(s, 'blowup', b);
  }
  function setPhase(s, ph) {
    const prev = s.phase;
    s.phase = ph; s.phaseClock = 0;
    emit(s, 'phase', { phase: ph, prev });
  }
  function phaseStep(s) {
    if (s.phase === 'day') return;
    s.phaseClock++;
    const r = ratio(s), T = CONFIG.PHASE_TIMEOUT[s.phase], clock = s.phaseClock;
    switch (s.phase) {
      case 'eruption':
        if ((clock >= CONFIG.ERUPTION_MIN && s.adrenaline < CONFIG.ERUPTION_ADRENALINE) || clock >= T) setPhase(s, 'cooling');
        break;
      case 'cooling':
        if ((r < CONFIG.COOL_RATIO && s.cortisol < CONFIG.COOL_CORTISOL) || clock >= T) setPhase(s, 'reconnect');
        break;
      case 'reconnect':
        // Talking it over waits for real calm (cortisol), however long that takes.
        if (s.cortisol < CONFIG.CORT_TALK && (r < CONFIG.RECONNECT_RATIO || (s.named && r < CONFIG.NAMED_RATIO) || clock >= T)) {
          if (s.autoSay) setPhase(s, 'repair');
          else s.pending = { kind: 'validate', data: validation(s) };
        }
        break;
      case 'repair':
        if (s.repaired) setPhase(s, 'learn');
        else if (clock >= T) { logEvent(s, { kind: 'auto', label: 'The grown-up said sorry and hugged it out' }); s.repaired = true; setPhase(s, 'learn'); }
        break;
      case 'learn':
        if (s.praised || clock >= T) { setPhase(s, 'day'); emit(s, 'recovered', {}); }
        break;
    }
  }

  // --- One minute -------------------------------------------------------------------------------
  function step(s) {
    if (s.done || s.pending) return false;
    const i = sceneAt(s, s.t);
    if (i !== s.sceneIdx) { enterScene(s, i); if (s.pending) return false; }
    const sc = s.scene, off = s.t - sc.at, loc = C.LOCATIONS[s.loc];
    const inStorm = s.phase === 'eruption' || s.phase === 'cooling' || s.phase === 'reconnect';

    // Scheduled moments. Say It Differently pauses until someone chooses.
    if (sc.say) for (const m of sc.say) if (m.at === off && !s.saidAt?.[sc.id + m.at]) {
      (s.saidAt = s.saidAt || {})[sc.id + m.at] = true;
      if (inStorm) { logEvent(s, { kind: 'say', id: m.id, how: 'skip', label: C.SAYS[m.id].done, outcome: C.SAYS[m.id].done }); continue; }
      s.pending = { kind: 'say', id: m.id, def: m.def };
      emit(s, 'say', { id: m.id, def: m.def });
      if (s.autoSay) choose(s, m.def); else return false;
    }
    if (sc.events && !inStorm) for (const ev of sc.events) if (ev.at === off) runEvent(s, ev);
    if (sc.meal && off === 0) { s.sinceMeal = Math.round(CONFIG.HUNGRY_AT * (1 - sc.meal)); logEvent(s, { kind: 'meal', label: sc.label }); }
    if (s.t === 0 && s.style.wake === 'natural') logEvent(s, { kind: 'event', label: 'Woke up naturally', type: 'body' });

    // Body states and slow drifts.
    s.sinceMeal++;
    const drift = Object.assign({}, loc.drift);
    if (sc.drift) for (const k in sc.drift) drift[k] = (drift[k] || 0) + sc.drift[k];
    for (const k in drift) add(s, k, drift[k] * (k === 'sensory' ? (s.kid.noise || 1) : 1), sc.label, 'life');
    if (hungry(s)) add(s, 'body', CONFIG.HUNGRY_DRIFT, 'Getting hungry', 'life');
    if (tired(s)) add(s, 'body', CONFIG.TIRED_DRIFT, 'Sleepy and grumpy', 'life');
    if (s.sock) add(s, 'body', CONFIG.SOCK_DRIFT, 'Itchy sock', 'life');
    if (s.t >= CONFIG.WITCHING[0] && s.t < CONFIG.WITCHING[1]) add(s, 'emotional', CONFIG.WITCHING_DRIFT, 'Late-afternoon grumpies', 'life');
    if (masking(s)) add(s, 'thinking', CONFIG.MASK_EFFORT, 'Holding it together at school', 'life');

    // Natural recovery: bodies settle, and moving outdoors settles them faster.
    const p = pressure(s);
    drain(s, p * CONFIG.DECAY * (tired(s) ? 0.75 : 1), 'Settling down on its own', 'rest');
    if (loc.rest) drain(s, loc.rest * (loc.move ? (s.kid.movement || 1) : 1), loc.nature ? 'Fresh air, trees and sky' : 'Running around', 'rest');
    if (s.phase !== 'day') drain(s, Math.max(0, pressure(s) - floor(s)) * CONFIG.PHASE_DECAY[s.phase], 'The storm passing', 'rest');

    // Co-regulation: the grown-up has a bucket too.
    const z0 = zone(s);
    // The grown-up drifts back toward their usual level for this day (a teacher at school).
    const base = loc.adultBase != null ? loc.adultBase : s.style.adultStart;
    s.adult = clamp(s.adult + (sc.adult || 0) + (z0 === 'red' || z0 === 'blowup' ? CONFIG.ADULT_FROM_KID_RED : 0) + (base - s.adult) * CONFIG.ADULT_SETTLE, 0, 100);
    s.wave = s.adult < CONFIG.ADULT_CALM ? 'blue' : s.adult > CONFIG.ADULT_STRESSED ? 'red' : null;
    if (s.wave === 'blue') drain(s, CONFIG.WAVE_BLUE, 'Calm grown-up nearby', 'support');
    if (s.wave === 'red') { add(s, 'control', CONFIG.WAVE_RED / 2, 'Stressed grown-up nearby', 'life'); add(s, 'emotional', CONFIG.WAVE_RED / 2, 'Stressed grown-up nearby', 'life'); }

    // Stress chemistry.
    s.adrenaline *= 1 - CONFIG.ADRENALINE_DECAY;
    if (z0 === 'red' || z0 === 'blowup') s.cortisol = Math.min(100, s.cortisol + CONFIG.CORTISOL_RED);
    s.cortisol *= 1 - CONFIG.CORTISOL_DECAY;
    if (s.dogQuiet > 0) s.dogQuiet--;
    if (s.selfCooldown > 0) s.selfCooldown--;

    if (!inStorm) chaos(s);
    phaseStep(s);

    // Zone changes: skills kick in by themselves on the way into yellow.
    const z = zone(s);
    if (z !== s.zone) {
      emit(s, 'zone', { zone: z, prev: s.zone });
      if (s.zone === 'green' && z === 'yellow' && s.phase === 'day') selfUse(s);
      if (z === 'red' && !s.seenRed) { s.seenRed = true; emit(s, 'firstRed', {}); }
      s.zone = zone(s);
    }
    if (s.phase === 'day') checkBlowup(s, {});

    // Flat Mode: a nearly empty My Choice jar and a quiet bucket for a long time.
    if (jar(s, 'choice') <= CONFIG.FLAT_JAR && ratio(s) < CONFIG.FLAT_RATIO && s.phase === 'day') s.flatClock++;
    else s.flatClock = 0;
    if (!s.flat && s.flatClock >= CONFIG.FLAT_MINUTES) { s.flat = true; emit(s, 'flat', { on: true }); logEvent(s, { kind: 'flat', label: 'Went quiet and flat' }); }
    if (s.flat && jar(s, 'choice') > CONFIG.FLAT_JAR + 1) { s.flat = false; emit(s, 'flat', { on: false }); }

    const pr = pressure(s);
    s.peak = Math.max(s.peak, pr / threshold(s));
    s.graph.push([s.t, r1(pr), threshold(s)]);
    s.t++;
    if (s.t >= CONFIG.DAY_END) { s.done = true; emit(s, 'bedtime', {}); }
    return true;
  }

  function runEvent(s, ev) {
    if (ev.card) { const res = use(s, ev.card, { scheduled: true }); if (res) { s.used[ev.card]--; emit(s, 'scheduled', { id: ev.card, thought: res.thought }); } return; }
    const fx = ev.fx;
    const p0 = pressure(s);
    if (fx.amount >= 0) {
      const d = add(s, fx.type, fx.amount * spikeMult(s, fx.type), fx.label, 'life');
      s.adrenaline = clamp(s.adrenaline + d * CONFIG.ADRENALINE_PER_DROP, 0, 100);
    } else drain(s, -fx.amount, fx.label, fx.src || 'rest', fx.type);
    jars(s, fx.jar, fx.marble || fx.label);
    logEvent(s, { kind: 'event', label: fx.label, type: fx.type, feel: fx.feel || (fx.amount >= 0 ? C.LOAD_FEELING[fx.type] : null), d: r1(pressure(s) - p0) });
    emit(s, 'scheduled', { label: fx.label, thought: fx.thought, delta: r1(pressure(s) - p0), type: fx.type });
    checkBlowup(s, {});
  }

  function chaos(s) {
    if (s.t - s.chaosLast < CONFIG.CHAOS_GAP) return;
    const roll = rng(s);
    if (roll >= CONFIG.CHAOS_P) return;
    const options = C.CHAOS.filter(c => (!c.where || c.where.includes(s.loc)) && (!c.after || s.t >= c.after));
    if (!options.length) return;
    const c = options[Math.floor(rng(s) * options.length)];
    s.chaosLast = s.t;
    const d = add(s, c.type, c.amount * spikeMult(s, c.type), c.name, 'life');
    s.adrenaline = clamp(s.adrenaline + d * CONFIG.ADRENALINE_PER_DROP, 0, 100);
    if (c.set === 'hungry') s.sinceMeal = Math.max(s.sinceMeal, CONFIG.HUNGRY_AT);
    logEvent(s, { kind: 'chaos', id: c.id, label: c.name, type: c.type, feel: C.LOAD_FEELING[c.type] });
    emit(s, 'chaos', { id: c.id, icon: c.icon, name: c.name, thought: c.thought });
  }

  function selfUse(s) {
    if (s.selfCooldown > 0) return;
    for (const k of ['breathe', 'stomp']) {
      if (s.skills[k].level < CONFIG.SKILL_MAX) continue;
      const c = card(k);
      const d = drain(s, c.amount * CONFIG.SELF_USE * helpMult(s, c), c.name + ' (on their own!)', 'skill', c.target);
      s.selfCooldown = CONFIG.SELF_COOLDOWN;
      logEvent(s, { kind: 'self', id: k, label: c.name + ' (on their own!)', d: r1(d) });
      emit(s, 'selfUse', { skill: k, delta: r1(d) });
      return;
    }
  }

  // --- Receipt ------------------------------------------------------------------------------------
  function receipt(s, maxLines) {
    maxLines = maxLines || 12;
    const all = Object.entries(s.tally).map(([label, e]) => ({ label, delta: e.delta, src: e.src, type: e.type, ambient: e.n > 4 }));
    // Things that happened come first; slow all-day drifts get a few lines of their own.
    const big = l => Math.abs(l.delta) >= 0.5;
    const byMag = (a, b) => Math.abs(b.delta) - Math.abs(a.delta);
    const events = all.filter(l => !l.ambient && big(l)).sort(byMag).slice(0, maxLines - 3);
    const ambient = all.filter(l => l.ambient && big(l)).sort(byMag).slice(0, 3);
    const lines = events.concat(ambient);
    const rest = all.filter(l => !lines.includes(l));
    const restSum = rest.reduce((a, l) => a + l.delta, 0);
    if (rest.length && Math.abs(restSum) > 1e-9) lines.push({ label: 'Lots of little things all day', delta: restSum, src: 'mixed' });
    const sum = src => all.filter(l => l.src === src).reduce((a, l) => a + l.delta, 0);
    const loadSum = all.filter(l => l.delta > 0).reduce((a, l) => a + l.delta, 0);
    const neg = src => -all.filter(l => l.src === src && l.delta < 0).reduce((a, l) => a + l.delta, 0);
    const total = all.reduce((a, l) => a + l.delta, 0);
    return {
      lines, total,
      start: s.start, end: pressure(s),
      equation: { load: loadSum, recovery: neg('rest'), skills: neg('skill'), support: neg('support'), total },
      blowups: s.blowups.length, marbles: s.marblesEarned,
      skills: Object.keys(s.xpToday).length, practice: Object.values(s.xpToday).reduce((a, b) => a + b, 0),
      used: Object.assign({}, s.usedTool), usedCount: Object.values(s.usedTool).reduce((a, b) => a + b, 0),
      peak: s.peak, cookie: s.blowups.some(b => b.lastStraw && b.lastStraw.id === 'cookie'),
      sock: s.log.some(e => e.kind === 'reveal' && e.id === 'sock'),
      style: s.styleId, seed: s.seed,
    };
  }

  // A snapshot of everything the picture needs.
  function view(s) {
    const thr = threshold(s), p = pressure(s);
    return {
      t: s.t, clock: clock(s.t), scene: s.scene, loc: s.loc, pressure: p, threshold: thr, ratio: p / thr,
      zone: zoneOf(p / thr), phase: s.phase, load: Object.assign({}, s.load),
      jars: { choice: jar(s, 'choice'), can: jar(s, 'can'), together: jar(s, 'together') },
      hungry: hungry(s), tired: tired(s), rushed: rushed(s), sick: s.sick, sock: s.sock,
      adrenaline: s.adrenaline, cortisol: s.cortisol, floor: floor(s), adult: s.adult, wave: s.wave,
      strings: strings(s), flat: s.flat, masking: masking(s), dogQuiet: s.dogQuiet > 0,
      greenBand: CONFIG.ZONE_YELLOW * thr, yellowBand: CONFIG.ZONE_RED * thr,
      skills: s.skills, blowups: s.blowups.length, pending: s.pending, done: s.done,
    };
  }
  function clock(t) {
    const h = 7 + Math.floor(t / 60), m = t % 60;
    return (h > 12 ? h - 12 : h) + ':' + String(m).padStart(2, '0') + (h >= 12 ? ' pm' : ' am');
  }

  // --- Headless runs (tests and balance) --------------------------------------------------------
  function runDay(styleId, opts) {
    opts = opts || {};
    const s = create({ style: styleId, seed: opts.seed, kid: opts.kid, skills: opts.skills, autoSay: !opts.sayWith, sick: opts.sick });
    let guard = 0;
    while (!s.done && guard++ < 5000) {
      if (s.pending) {
        if (s.pending.kind === 'say') choose(s, opts.sayWith ? opts.sayWith(s, s.pending) : s.pending.def);
        else if (s.pending.kind === 'pick') choosePlace(s, s.pending.options[0]);
        else if (s.pending.kind === 'validate') ack(s);
        continue;
      }
      if (opts.strategy) opts.strategy(s, view(s));
      step(s);
      s.events.length = 0;
    }
    return s;
  }

  const api = {
    CONFIG, create, step, use, choose, choosePlace, ack, validation, receipt, view, clock, runDay,
    pressure, threshold, ratio, zone, zoneOf, jar, hungry, tired, rushed, masking, dominant, strings,
    spikeMult, helpMult, helperFactor, toolStatus, marble, add, drain, blowUp, checkBlowup, setPhase,
    card, gainXp, levelFor, repeats, habit,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BUSim = api;
})(this);
