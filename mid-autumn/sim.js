/* Mid-Autumn Mayhem — the festival model.
   One night runs from 6 pm to midnight (NIGHT seconds of play). Every second the model works out
   how many people are really celebrating, fills four trouble meters, and fires an incident when a
   meter reaches 100. Drawing and sound live in index.html; this file only knows numbers. */
(function (root) {
  'use strict';

  const NIGHT = 240;               // seconds of play for 6 pm → midnight
  const LIMITS = {
    buildings: 8, adults: 40, kids: 40, lanterns: 30, mooncakes: 20, tea: 10, mahjong: 10, fireworks: 10, secret: 10,
  };
  const PARK = 10;                 // people who fit in the park with no buildings
  const PER_BUILDING = 8;          // people each building holds (balconies and rooftops)
  const SEATS = 4;                 // players at a mahjong table
  const WEDGES = 4;                // a mooncake is rich: families cut it into 4 wedges and share
  const TEA_SERVES = 6;            // one teapot serves 6 people
  const KIDS_PER_ADULT = 3;        // one grown-up can keep an eye on 3 kids

  const INCIDENTS = {
    fire:   { dur: 14, keep: 0.15, cause: 'fire' },
    tummy:  { dur: 12, keep: 0.35, cause: 'tummy' },
    police: { dur: 12, keep: 0.30, cause: 'noise' },
    rowdy:  { dur: 10, keep: 0.40, cause: 'rowdy' },
  };

  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }

  function create(rand) {
    return {
      t: 0, over: false,
      n: { buildings: 0, adults: 0, kids: 0, lanterns: 0, mooncakes: 0, tea: 0, mahjong: 0, fireworks: 0, secret: 0 },
      m: { fire: 0, tummy: 0, noise: 0, rowdy: 0 },
      score: 0, bonus: 0, celebrating: 0, joy: 0, peak: 0,
      incident: null, calm: 0,                       // calm: seconds of grace after an incident
      secretUnlocked: false, informed: 0, plotClock: 0, riskClock: 0, uprising: false,
      glow: 0,                                       // seconds of Chang'e reunion glow left
      special: null,                                 // the special visitor on screen now
      next: { rabbit: 25, change: 95, dragon: 70, wugang: 0 },
      seen: { change: false, dragon: false },
      tally: { fire: 0, tummy: 0, police: 0, rowdy: 0, rabbit: 0, change: 0, dragon: 0, wugang: 0, burned: 0, sent: 0, arrested: 0 },
      events: [],
      rand: rand || Math.random,
    };
  }

  function set(s, key, v) {
    if (!(key in LIMITS)) return;
    if (key === 'secret' && !s.secretUnlocked) return;
    s.n[key] = clamp(Math.round(v), 0, LIMITS[key]);
  }

  // Everything the picture, sound and meters need, worked out from the counts.
  function derive(s) {
    const n = s.n;
    const P = n.adults + n.kids;
    const cap = PARK + PER_BUILDING * n.buildings;
    const inside = Math.min(P, cap);
    const crowd = P > cap ? (P - cap) / Math.max(cap, 1) : 0;
    const cakes = n.mooncakes + n.secret;
    const wedgesEach = P ? (cakes * WEDGES) / P : 0;
    const lanternCov = P ? Math.min(1, n.lanterns / (P * 0.4)) : 0;
    const cakeCov = Math.min(1.3, wedgesEach);
    const teaCov = P ? Math.min(1, (n.tea * TEA_SERVES) / P) : 0;
    const seatCov = n.adults ? Math.min(1, (n.mahjong * SEATS) / n.adults) : 0;
    const fwJoy = Math.min(1, n.fireworks / 3);
    const unsupervised = Math.max(0, n.kids - KIDS_PER_ADULT * n.adults);
    const adultShare = P ? n.adults / P : 0;
    // Mid-Autumn is a reunion festival: it is best when families (kids AND grown-ups) are together.
    const family = P ? 1 - 0.5 * Math.min(1, Math.abs(adultShare - 0.5) / 0.5) : 0;

    let joy = 0.2 + 0.25 * lanternCov + 0.18 * cakeCov + 0.08 * teaCov + 0.12 * adultShare * seatCov + 0.12 * fwJoy;
    joy *= 1 - Math.min(0.6, crowd * 0.8);
    joy *= family;
    if (s.glow > 0) joy *= 1.25;
    if (s.uprising) joy *= 1.15;
    joy = clamp(joy, 0, 1.2);

    // Pressure on each trouble meter; a meter rises while pressure is above zero, and falls while below.
    const fireP = n.fireworks * 1.0 + n.lanterns * 0.06 + unsupervised * 0.15 - (2 + n.adults * 0.1);
    const tummyP = Math.max(0, wedgesEach - 1) * 2.2 - 0.9 * teaCov - 0.35;
    const noiseP = s.uprising ? -1 : n.mahjong * 1.3 + n.fireworks * 0.9 + P * 0.08 + Math.max(0, P - cap) * 0.2 - 14;
    const rowdyP = unsupervised * 0.6 + Math.max(0, wedgesEach - 1.3) * (P ? n.kids / P : 0) * 4 + crowd * 8 - 1.5;

    return { P, cap, inside, crowd, cakes, wedgesEach, lanternCov, cakeCov, teaCov, seatCov, fwJoy, unsupervised, family, joy, fireP, tummyP, noiseP, rowdyP };
  }

  function emit(s, type, data) { s.events.push(Object.assign({ type, t: s.t }, data || {})); }

  function startIncident(s, kind) {
    s.incident = { kind, left: INCIDENTS[kind].dur, dur: INCIDENTS[kind].dur, applied: false };
    s.tally[kind === 'police' ? 'police' : kind]++;
    emit(s, 'incident', { kind });
  }

  // What each incident costs, applied at the moment help arrives.
  function applyIncident(s, kind) {
    const n = s.n;
    if (kind === 'fire') {
      if (n.buildings > 0) { n.buildings--; s.tally.burned++; emit(s, 'burned'); }
      n.fireworks = Math.max(0, n.fireworks - 3);
      n.lanterns = Math.max(0, Math.floor(n.lanterns * 0.7));
    } else if (kind === 'tummy') {
      const P = n.adults + n.kids, take = Math.ceil(P * 0.15);
      const kidsTaken = Math.min(n.kids, Math.round(take * (P ? n.kids / P : 0)));
      n.kids -= kidsTaken; n.adults = Math.max(0, n.adults - (take - kidsTaken));
      n.mooncakes = Math.floor(n.mooncakes / 2); n.secret = Math.floor(n.secret / 2);
      s.tally.sent += take; emit(s, 'sent', { count: take });
    } else if (kind === 'police') {
      const take = Math.min(6, Math.ceil(n.adults * 0.2));
      n.adults -= take; n.mahjong = Math.floor(n.mahjong / 2); n.fireworks = Math.floor(n.fireworks / 2);
      s.tally.arrested += take; emit(s, 'arrested', { count: take });
      if (!s.secretUnlocked) { s.secretUnlocked = true; emit(s, 'unlock'); }
    } else if (kind === 'rowdy') {
      n.lanterns = Math.floor(n.lanterns * 0.7); n.mooncakes = Math.floor(n.mooncakes * 0.75);
      s.m.fire = Math.min(95, s.m.fire + 35);
    }
  }

  function step(s, dt) {
    if (s.over) return derive(s);
    s.t += dt;
    const d = derive(s);
    const m = s.m;

    // Trouble meters.
    if (!s.incident) {
      const up = s.calm > 0 ? 0 : 1;
      m.fire  = clamp(m.fire  + (d.fireP  > 0 ? d.fireP * 5 * up  : d.fireP * 3 - 2) * dt, 0, 100);
      m.tummy = clamp(m.tummy + (d.tummyP > 0 ? d.tummyP * 9 * up : d.tummyP * 6 - 1.5) * dt, 0, 100);
      m.noise = clamp(m.noise + (d.noiseP > 0 ? d.noiseP * 4 * up : d.noiseP * 2 - 2) * dt, 0, 100);
      m.rowdy = clamp(m.rowdy + (d.rowdyP > 0 ? d.rowdyP * 6 * up : d.rowdyP * 4 - 2) * dt, 0, 100);
      s.calm = Math.max(0, s.calm - dt);
      if (m.fire >= 100) startIncident(s, 'fire');
      else if (m.tummy >= 100) startIncident(s, 'tummy');
      else if (m.noise >= 100) startIncident(s, 'police');
      else if (m.rowdy >= 100) startIncident(s, 'rowdy');
    } else {
      const inc = s.incident;
      inc.left -= dt;
      if (!inc.applied && inc.left <= inc.dur * 0.55) { inc.applied = true; applyIncident(s, inc.kind); }
      if (inc.left <= 0) {
        const key = INCIDENTS[inc.kind].cause;
        m[key] = 20; s.calm = 6; s.incident = null;
        emit(s, 'resolved', { kind: inc.kind });
      }
    }

    // Who is celebrating right now, and the Reunion score.
    const keep = s.incident ? INCIDENTS[s.incident.kind].keep : 1;
    s.joy = d.joy;
    s.celebrating = d.inside * Math.min(1, d.joy) * keep;
    s.peak = Math.max(s.peak, s.celebrating);
    s.score += s.celebrating * dt * 0.5;
    if (s.glow > 0) s.glow = Math.max(0, s.glow - dt);

    // The secret mooncakes (unlocked by the first police visit, or at 9 pm).
    if (!s.secretUnlocked && s.t >= NIGHT / 2) { s.secretUnlocked = true; emit(s, 'unlock'); }
    if (s.secretUnlocked && !s.uprising) {
      s.informed = Math.min(s.n.adults, s.n.secret * WEDGES);
      const enough = s.n.adults >= 12 && s.informed >= 12 && s.informed >= 0.6 * s.n.adults;
      if (s.n.secret > 0 && enough && !s.incident) {
        s.plotClock += dt; s.riskClock = 0;
        if (s.plotClock >= 5) {
          s.uprising = true; s.bonus += 1500; s.score += 1500;
          s.n.secret = 0; m.noise = 0;
          emit(s, 'uprising');
        }
      } else if (s.n.secret > 0 && !s.incident) {
        // Too few people know: the note gets passed to the wrong person.
        s.plotClock = 0; s.riskClock += dt;
        if (s.riskClock >= 12) { s.riskClock = 0; s.n.secret = 0; emit(s, 'discovered'); m.noise = 100; startIncident(s, 'police'); }
      } else { s.plotClock = 0; s.riskClock = 0; }
    }

    // Special visitors.
    if (s.special) {
      s.special.left -= dt;
      if (s.special.left <= 0) { emit(s, 'missed', { kind: s.special.kind }); s.special = null; }
    } else {
      const R = s.rand;
      if (s.t >= s.next.rabbit) {
        s.special = { kind: 'rabbit', left: 5, dur: 5 }; s.next.rabbit = s.t + 40 + R() * 30; emit(s, 'special', { kind: 'rabbit' });
      } else if (!s.seen.change && s.t >= s.next.change && s.celebrating >= 8) {
        s.special = { kind: 'change', left: 9, dur: 9 }; s.seen.change = true; emit(s, 'special', { kind: 'change' });
      } else if (!s.seen.dragon && s.t >= s.next.dragon && s.n.lanterns >= 10 && s.n.adults >= 10 && m.fire < 50) {
        s.special = { kind: 'dragon', left: 8, dur: 8 }; s.seen.dragon = true; emit(s, 'special', { kind: 'dragon' });
      }
    }

    if (s.t >= NIGHT) { s.t = NIGHT; s.over = true; emit(s, 'end'); }
    return d;
  }

  // The player taps something on screen.
  function tap(s, kind) {
    if (kind === 'wugang') {
      if (s.t < s.next.wugang) return false;
      s.next.wugang = s.t + 45; s.m.noise = Math.max(0, s.m.noise - 50); s.m.rowdy = Math.max(0, s.m.rowdy - 25);
      s.bonus += 100; s.score += 100; s.tally.wugang++; emit(s, 'caught', { kind, points: 100 }); return true;
    }
    if (!s.special || s.special.kind !== kind) return false;
    let pts = 0;
    if (kind === 'rabbit') { pts = 300; s.m.tummy = 0; }
    if (kind === 'change') { pts = 1000; s.glow = 40; }
    if (kind === 'dragon') { pts = 500; s.m.tummy = 0; s.m.rowdy = 0; }
    s.bonus += pts; s.score += pts; s.tally[kind]++; s.special = null;
    emit(s, 'caught', { kind, points: pts });
    return true;
  }

  // The best possible celebrating crowd, for the grade.
  const GRADES = [
    [9500, 'legend'], [6000, 'great'], [3500, 'happy'], [1200, 'quiet'], [0, 'empty'],
  ];
  function grade(score) { return GRADES.find(g => score >= g[0])[1]; }

  const api = { NIGHT, LIMITS, PARK, PER_BUILDING, SEATS, WEDGES, TEA_SERVES, KIDS_PER_ADULT, INCIDENTS, GRADES, create, set, derive, step, tap, grade };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.MMSim = api;
})(this);
