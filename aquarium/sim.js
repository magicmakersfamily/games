/* Nature Aquarium — ecosystem model.
   Hourly steps, weekly turns. Units are real where it helps teaching
   (mg/L, ppm, hours) and scaled so a 60-litre tank behaves plausibly. */
(function (root) {
  'use strict';

  const LIGHT_HOURS = [0, 4, 6, 8, 10, 12, 14, 16];
  const SLOTS = [
    { sp: 'carpet', x: 500 }, { sp: 'stem', x: 872 }, { sp: 'grass', x: 372 },
    { sp: 'stem', x: 118 }, { sp: 'carpet', x: 235 }, { sp: 'moss', x: 610 },
    { sp: 'stem', x: 715, red: true }, { sp: 'grass', x: 790 }, { sp: 'carpet', x: 805 },
  ];
  const PLANT_NAMES = { carpet: 'Monte Carlo carpet', stem: 'Rotala stems', grass: 'dwarf hairgrass', moss: 'Christmas moss' };
  const LIFE = { fish: 190, shrimp: 130 };
  const LIMITS = { plants: 9, rocks: 7, wood: 3, shrimp: 80, fish: 36, light: LIGHT_HOURS.length - 1, turtle: 2 };

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  let rand = () => Math.random();
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const fmt = (v, d = 1) => Number(v).toFixed(d);

  function newState() {
    return {
      v: 2, week: 0,
      o2: 8.2, co2: 3, nh3: 0, no2: 0, no3: 0, B1: 0.02, B2: 0.02,
      algae: 0.01, det: 0.02, tannin: 0, soil: 1, soilNut: 1, foodRatio: 2,
      plants: [], rocks: 0, wood: 0, light: 2,
      fish: [], shrimp: [], turtles: [],
      fishH: 1, shrimpH: 1, turtleH: 0.7,
      flags: {}, history: [], journal: [], achievements: {}, frames: null, streak90: 0, nextId: 1,
    };
  }

  function counts(S) {
    let fishA = 0, fishJ = 0, shrA = 0, shrJ = 0;
    for (const f of S.fish) f.age >= 28 ? fishA++ : fishJ++;
    for (const s of S.shrimp) s.age >= 14 ? shrA++ : shrJ++;
    return { fishA, fishJ, shrA, shrJ, turt: S.turtles.length };
  }
  const bioload = c => c.fishA + 0.3 * c.fishJ + 0.1 * c.shrA + 0.03 * c.shrJ + 20 * c.turt;
  const space = S => 30 - S.rocks * 0.8 - S.wood * 1.5;
  const wasteRate = c => 0.0015 * c.fishA + 0.0005 * c.fishJ + 0.0002 * c.shrA + 0.00005 * c.shrJ + 0.03 * c.turt;
  const sumBio = S => S.plants.reduce((a, p) => a + p.bio, 0);
  const vigor = S => S.plants.reduce((a, p) => a + p.bio * p.health, 0);
  const surfaceK = S => 0.45 + 0.12 * S.rocks + 0.25 * S.wood + 0.04 * S.plants.length + 0.05 * sumBio(S);
  const cloudiness = S => clamp(S.det * 0.22 + Math.max(0, S.algae - 0.25) * 0.7, 0, 1);
  const pH = S => clamp(7.15 + 0.07 * S.rocks - 0.75 * Math.log10(Math.max(S.co2, 0.5) / 3) - 1.3 * S.tannin, 5.4, 8.6);
  function cover(S) {
    let low = 0, tall = 0;
    for (const p of S.plants) (p.sp === 'carpet' || p.sp === 'moss') ? low += p.bio : tall += p.bio;
    return clamp(low * 0.22 + tall * 0.07 + S.wood * 0.08 + S.rocks * 0.03, 0, 0.9);
  }
  function tallExcess(S) {
    let t = 0;
    for (const p of S.plants) if (p.sp === 'stem') t += Math.max(0, p.bio - 1.3);
    return t;
  }

  /* ---------- one hour ---------- */
  function stepHour(S, hod, T, day) {
    const H = LIGHT_HOURS[S.light];
    const on = H > 0 && hod >= 8 && hod < 8 + H;
    S._on = on;
    const c = counts(S);
    const shade = clamp(1 - 0.9 * S.tannin - 0.6 * Math.max(0, S.algae - 0.3) - 0.35 * cloudiness(S), 0.15, 1);
    const Leff = on ? shade : 0;

    // nitrogen inputs: waste, new soil, rotting matter
    const waste = wasteRate(c);
    const leach = 0.012 * S.soil;
    const rf = 0.0015 * c.fishA + 0.0005 * c.fishJ, rs = 0.0002 * c.shrA + 0.00005 * c.shrJ, rt = 0.03 * c.turt;
    const wF = rf * 0.825, wS = rs * 0.825, wT = rt * 0.825 + 0.025 * c.turt;
    const FN = T.flux.n;
    FN.fish += wF; FN.shrimp += wS; FN.turtle += wT; FN.soil += leach;
    S.soil *= 0.9975;
    S.soilNut *= 0.9997;
    S.nh3 += waste * 0.7 + leach;
    S.det += waste * 0.25 + 0.05 * c.turt;
    const dec = 0.03 * S.det;
    S.det -= dec;
    S.nh3 += 0.5 * dec;
    const scav = Math.min(S.det * 0.5, 0.0012 * (c.shrA + 0.4 * c.shrJ) * S.det / (S.det + 0.3));
    S.det -= scav;
    T.leach += leach; T.waste += waste * 0.7 + 0.5 * dec;

    // nitrifying bacteria (two teams)
    const K = surfaceK(S);
    const o2f = S.o2 / (S.o2 + 1.5);
    const conv1 = Math.min(S.nh3, S.B1 * 0.2 * S.nh3 / (S.nh3 + 0.25) * o2f);
    S.nh3 -= conv1; S.no2 += conv1;
    const conv2 = Math.min(S.no2, S.B2 * 0.2 * S.no2 / (S.no2 + 0.25) * o2f);
    S.no2 -= conv2; S.no3 += conv2;
    FN.c1 += conv1; FN.c2 += conv2;
    S.B1 = Math.max(0.01, S.B1 + 0.03 * S.B1 * (S.nh3 / (S.nh3 + 0.15)) * (1 - S.B1 / K) - 0.0015 * S.B1);
    S.B2 = Math.max(0.01, S.B2 + 0.022 * S.B2 * (S.no2 / (S.no2 + 0.15)) * (1 - S.B2 / K) - 0.0015 * S.B2);

    // where the light goes
    let lp = 0, la = 0, lb = 0;
    if (on) {
      lb = 1 - shade;
      lp = Math.min(0.85, vigor(S) / 8) * shade;
      la = Math.max(0, Math.min(shade - lp, S.algae * 0.9 * shade));
      const L = T.flux.light;
      L.in += 1; L.blocked += lb; L.plants += lp; L.algae += la; L.heat += shade - lp - la;
    }

    // plants: photosynthesis & growth
    const fC = S.co2 / (S.co2 + 3);
    const N = S.no3 + S.nh3;
    const fN = 0.3 * S.soilNut + 0.7 * N / (N + 1.5);
    const tall = tallExcess(S);
    let P = 0, sB = 0;
    for (const p of S.plants) {
      const low = p.sp === 'carpet' || p.sp === 'grass';
      const sh = low ? Math.max(0.35, 1 - 0.4 * tall) : 1;
      const q = Leff * sh * fC * fN;
      const rate = p.health * q;
      P += p.bio * rate;
      p.bio = Math.max(0.03, p.bio + 0.03 * rate * p.bio * (1 - p.bio / 2.2) - 0.0004 * p.bio);
      p.acc += q;
      sB += p.bio;
    }
    if (on && S.plants.length) { T.onHours++; T.fcSum += fC; T.fnSum += fN; T.shadeSum += shade; }
    const upt = 0.015 * P;
    const uA = Math.min(S.nh3 * 0.5, upt * 0.6);
    S.nh3 -= uA;
    const uN = Math.min(S.no3, upt - uA);
    S.no3 -= uN;
    FN.plantsA += uA; FN.plants += uN;
    S.det += 0.0003 * sB;
    FN.rot += 0.00015 * sB;

    // algae: fast-growing competitors
    const vig = vigor(S);
    const nutA = (S.no3 + 3 * S.nh3 + 1) / (S.no3 + 3 * S.nh3 + 4);
    const comp = Math.min(0.85, vig / 5);
    let aUp = 0;
    if (on) {
      const excess = Math.max(0, H - 8) / 8;
      const g = 0.03 * Leff * (0.3 + 1.5 * excess) * nutA * (1 - comp) + 0.01 * Math.min(1, S.nh3) * Leff;
      S.algae += S.algae * g * (1 - S.algae) + 0.0002;
      aUp = Math.min(S.no3, 0.02 * S.algae * Leff);
      S.no3 -= aUp;
    } else S.algae -= 0.002 * S.algae;
    FN.algae += aUp;
    const graze = Math.min(S.algae * 0.3, 0.00015 * (c.shrA + 0.3 * c.shrJ) * S.algae / (S.algae + 0.05));
    S.algae = clamp(S.algae - graze, 0.005, 1);
    T.grazed += graze;

    // gases
    const resp = c.fishA + 0.3 * c.fishJ + 0.12 * c.shrA + 0.04 * c.shrJ;
    const oMade = 0.2 * P, oPl = 0.008 * sB, oAn = 0.02 * resp * (S.o2 / (S.o2 + 1)), oBa = 1.2 * (conv1 + conv2), oDe = 0.8 * dec;
    const oAir = (0.15 + 0.02 * c.turt) * (8.2 - S.o2);
    const cPh = Math.min(0.3 * P, S.co2 + 0.012 * sB + 0.05 * resp), cPl = 0.012 * sB, cAn = 0.05 * resp, cTu = 0.08 * c.turt, cDe = 1.0 * dec;
    const cAir = 0.08 * (3 - S.co2);
    S.o2 += oMade - oPl - oAn - oBa - oDe + oAir;
    S.co2 += -0.3 * P + cPl + cAn + cTu + cDe + cAir;
    const FO = T.flux.o2, FC = T.flux.co2;
    FO.made += oMade; FO.plants += oPl; FO.animals += oAn; FO.bact += oBa; FO.decay += oDe;
    if (oAir > 0) FO.airIn += oAir; else FO.airOut -= oAir;
    FC.photo += cPh; FC.plants += cPl; FC.animals += cAn; FC.turtle += cTu; FC.decay += cDe;
    if (cAir > 0) FC.airIn += cAir; else FC.airOut -= cAir;
    S._f = { p: P, om: oMade, oa: oAn, ca: cAn, cd: cDe, cp: cPl, wf: wF, ws: wS, wt: wT, lc: leach, c1: conv1, c2: conv2,
      up: uA + uN, au: aUp, lp, la, lb, b1: S.B1, b2: S.B2 };
    S.o2 = clamp(S.o2, 0.2, 20);
    S.co2 = clamp(S.co2, 0.3, 80);

    // wood tannins
    if (S.wood > 0) S.tannin += 0.0007 * S.wood * Math.max(0, 1 - S.tannin / (0.12 * S.wood));
    else S.tannin *= 0.9995;

    // animal stress
    const tox = S.nh3 + 0.8 * S.no2;
    const ph = pH(S);
    const crowd = bioload(c) / space(S);
    const F = {
      tox: 0.35 * Math.max(0, tox - 0.4), o2: 0.35 * Math.max(0, 4.5 - S.o2), co2: 0.04 * Math.max(0, S.co2 - 30),
      o2hi: 0.15 * Math.max(0, S.o2 - 13), no3: 0.004 * Math.max(0, S.no3 - 50), crowd: 0.3 * Math.max(0, crowd - 1),
      ph: 0.3 * Math.max(0, Math.abs(ph - 7) - 1),
    };
    const Sh = {
      tox: 0.55 * Math.max(0, tox - 0.3), o2: 0.35 * Math.max(0, 4 - S.o2), co2: 0.05 * Math.max(0, S.co2 - 32),
      no3: 0.006 * Math.max(0, S.no3 - 40), ph: 0.6 * Math.max(0, Math.abs(ph - 7) - 0.9),
      food: 0.25 * Math.max(0, 1 - S.foodRatio), crowd: 0.2 * Math.max(0, crowd - 1),
    };
    let fs = 0, ss = 0;
    for (const k in F) { fs += F[k]; if (S.fish.length) T.stressF[k] = (T.stressF[k] || 0) + F[k]; }
    for (const k in Sh) { ss += Sh[k]; if (S.shrimp.length) T.stressS[k] = (T.stressS[k] || 0) + Sh[k]; }
    S.fishH = clamp(S.fishH + 0.01 * (1 - S.fishH) - 0.012 * fs, 0, 1);
    S.shrimpH = clamp(S.shrimpH + 0.01 * (1 - S.shrimpH) - 0.012 * ss, 0, 1);
    S.turtleH = clamp(S.turtleH + 0.01 * (0.55 - S.turtleH) - 0.02 * 0.3 * Math.max(0, tox - 1), 0, 1);

    // trackers
    if (S.nh3 > T.maxNH3) { T.maxNH3 = S.nh3; T.maxNH3Day = day; }
    if (S.no2 > T.maxNO2) { T.maxNO2 = S.no2; T.maxNO2Day = day; }
    if (S.o2 < T.minO2) { T.minO2 = S.o2; T.minO2Day = day; T.minO2Hod = hod; T.minO2Night = !on; }
    if (S.o2 > T.maxO2) T.maxO2 = S.o2;
    if (S.co2 > T.maxCO2) T.maxCO2 = S.co2;
    if (on && S.o2 > 10.5 && S.plants.length) T.pearlHours++;
    if (on) T.co2Day.push(S.co2);
  }

  function topCause(obj, fallback) {
    let best = fallback, v = 0.05;
    for (const k in obj) if (obj[k] > v) { v = obj[k]; best = k; }
    return best;
  }

  /* ---------- once a day ---------- */
  function stepDay(S, T, day) {
    const H = LIGHT_HOURS[S.light];
    const c = counts(S);

    // plant health follows the day's growing conditions
    for (const p of S.plants) {
      let target = clamp(p.acc / 2.0, 0, 1);
      if (H > 12) target -= 0.03 * (H - 12);
      target -= Math.max(0, S.algae - 0.3) * 0.5;
      p.health = clamp(p.health + (target > p.health ? 0.3 : 0.2) * (target - p.health), 0, 1);
      p.acc = 0; p.age++;
    }

    // turtles graze plants and hunt
    const cov = cover(S);
    for (let t = 0; t < c.turt; t++) {
      const edible = S.plants.filter(p => p.sp !== 'moss');
      if (edible.length) {
        const p = edible[Math.floor(rand() * edible.length)];
        p.bio = Math.max(0.03, p.bio - 0.2); p.health = Math.max(0, p.health - 0.05);
        S.det += 0.08; T.flux.n.rot += 0.04; T.turtlePlants++;
      }
      for (let a = 0; a < 2; a++) {
        const adults = S.shrimp.filter(s => s.age >= 14);
        if (adults.length && rand() < 0.55 * (1 - 0.6 * cov)) {
          S.shrimp.splice(S.shrimp.indexOf(adults[Math.floor(rand() * adults.length)]), 1);
          T.turtleShrimp++;
        }
      }
      if (S.fish.length && rand() < 0.15 * (1 - 0.5 * cov)) {
        S.fish.splice(Math.floor(rand() * S.fish.length), 1);
        T.turtleFish++;
      }
    }

    // fish hunt babies; cover protects them
    const fishA = S.fish.filter(f => f.age >= 28).length;
    S.shrimp = S.shrimp.filter(s => {
      if (s.age < 14 && rand() < Math.min(0.5, 0.01 * fishA * (1 - cov))) { T.babiesEaten++; return false; }
      return true;
    });
    S.fish = S.fish.filter(f => {
      if (f.age < 28 && rand() < Math.min(0.4, 0.004 * fishA * (1 - cov))) { T.fryEaten++; return false; }
      return true;
    });

    // plants that ran out of energy melt away
    S.plants = S.plants.filter(p => {
      if (p.health < 0.12) { S.det += p.bio * 0.8; T.flux.n.rot += p.bio * 0.4; T.melted.push({ sp: p.sp, day }); return false; }
      return true;
    });

    // shrimp food web
    const food = 0.4 + 0.5 * S.wood + 0.15 * S.rocks + 6 * S.algae + 0.15 * vigor(S) + 1.5 * S.det + (fishA > 0 ? 0.3 : 0);
    const cc = counts(S);
    const demand = 0.06 * (cc.shrA + 0.4 * cc.shrJ);
    S.foodRatio = demand > 0 ? food / demand : 2;
    if (S.foodRatio < 0.8 && S.shrimp.length) T.starve = true;

    // deaths: illness and old age
    const baseF = 0.5 * Math.pow(1 - S.fishH, 3);
    S.fish = S.fish.filter(f => {
      f.age++;
      const old = f.age > LIFE.fish + f.v ? 0.04 : 0;
      const p = baseF * (f.age < 28 ? 1.6 : 1) + old;
      if (rand() < p) {
        const cause = old > 0 && rand() < old / p ? 'age' : topCause(T.stressF, 'weak');
        T.deaths.fish[cause] = (T.deaths.fish[cause] || 0) + 1;
        if (T.firstDeath == null) T.firstDeath = day;
        S.det += f.age < 28 ? 0.06 : 0.25; T.flux.n.rot += f.age < 28 ? 0.03 : 0.125;
        return false;
      }
      return true;
    });
    const baseS = 0.5 * Math.pow(1 - S.shrimpH, 3);
    S.shrimp = S.shrimp.filter(s => {
      s.age++;
      const old = s.age > LIFE.shrimp + s.v ? 0.05 : 0;
      const p = baseS * (s.age < 14 ? 1.6 : 1) + old;
      if (rand() < p) {
        const cause = old > 0 && rand() < old / p ? 'age' : topCause(T.stressS, 'weak');
        T.deaths.shrimp[cause] = (T.deaths.shrimp[cause] || 0) + 1;
        if (T.firstDeath == null) T.firstDeath = day;
        S.det += 0.05; T.flux.n.rot += 0.025;
        return false;
      }
      return true;
    });
    S.turtles = S.turtles.filter(t => {
      t.age++;
      if (S.turtleH < 0.3 && rand() < 0.3 * Math.pow(1 - S.turtleH, 4)) { T.deaths.turtle.tox = (T.deaths.turtle.tox || 0) + 1; S.det += 6; return false; }
      return true;
    });

    // reproduction
    if (S.shrimpH > 0.65 && S.foodRatio > 0.8 && S.shrimp.length < 160) {
      const pB = 0.018 * (S.shrimpH - 0.6) / 0.4;
      const moms = S.shrimp.filter(s => s.age >= 21).length;
      for (let i = 0; i < moms; i++) {
        if (rand() < 0.5 * pB) {
          const n = 6 + Math.floor(rand() * 12);
          for (let k = 0; k < n && S.shrimp.length < 160; k++) S.shrimp.push({ id: S.nextId++, age: 0, v: Math.round(rand() * 40 - 20) });
          T.births += n; T.broods++;
          if (T.birthDay == null) T.birthDay = day;
        }
      }
    }
    const adultsNow = S.fish.filter(f => f.age >= 28).length;
    if (S.fishH > 0.8 && adultsNow >= 6 && cov > 0.3 && S.fish.length < 60 && rand() < 0.015) {
      const n = 1 + Math.floor(rand() * 4 * cov);
      for (let k = 0; k < n; k++) S.fish.push({ id: S.nextId++, age: 0, v: Math.round(rand() * 40 - 20) });
      T.fry += n; T.spawns++;
      if (T.fryDay == null) T.fryDay = day;
    }
  }

  function snap(S, h, hod) {
    const c = counts(S);
    return {
      h, hod, on: S._on, o2: S.o2, co2: S.co2, nh3: S.nh3, no2: S.no2, no3: S.no3,
      algae: S.algae, clar: 1 - cloudiness(S), tan: S.tannin, ph: pH(S),
      fishA: c.fishA, fishJ: c.fishJ, shrA: c.shrA, shrJ: c.shrJ, turt: c.turt,
      fishH: S.fishH, shrimpH: S.shrimpH,
      plants: S.plants.map(p => [p.id, p.slot, +p.bio.toFixed(3), +p.health.toFixed(3)]),
      f: S._f ? Object.fromEntries(Object.entries(S._f).map(([k, v]) => [k, +v.toFixed(5)])) : null,
    };
  }

  /* ---------- player changes ---------- */
  function applyChanges(S, d) {
    const ev = [];
    const add = (topic, title, text, pri = 2) => ev.push({ day: 0, topic, title, text, pri });
    const hadHard = S.rocks + S.wood > 0;
    const oldRocks = S.rocks;
    S.rocks = clamp(S.rocks + (d.rocks || 0), 0, LIMITS.rocks);
    S.wood = clamp(S.wood + (d.wood || 0), 0, LIMITS.wood);
    S.light = clamp(S.light + (d.light || 0), 0, LIMITS.light);
    for (let i = 0; i < (d.plants || 0); i++) {
      const used = new Set(S.plants.map(p => p.slot));
      const slot = SLOTS.findIndex((_, k) => !used.has(k));
      if (slot < 0) break;
      S.plants.push({ id: S.nextId++, slot, sp: SLOTS[slot].sp, bio: 0.3, health: 0.8, acc: 0, age: 0 });
    }
    for (let i = 0; i < -(d.plants || 0) && S.plants.length; i++) {
      let k = 0;
      S.plants.forEach((p, j) => { if (p.id > S.plants[k].id) k = j; });
      S.det += S.plants[k].bio * 0.1;
      S.plants.splice(k, 1);
    }
    const addAnimals = (arr, n, age) => { for (let i = 0; i < n; i++) arr.push({ id: S.nextId++, age, v: Math.round(rand() * 40 - 20) }); };
    const removeAnimals = (arr, n) => {
      for (let i = 0; i < n && arr.length; i++) {
        const adults = arr.filter(a => a.age >= 14);
        const pool = adults.length ? adults : arr;
        arr.splice(arr.indexOf(pool[Math.floor(rand() * pool.length)]), 1);
      }
    };
    if (d.fish > 0) addAnimals(S.fish, d.fish, 60); else removeAnimals(S.fish, -(d.fish || 0));
    if (d.shrimp > 0) addAnimals(S.shrimp, d.shrimp, 40); else removeAnimals(S.shrimp, -(d.shrimp || 0));
    if (d.turtle > 0) addAnimals(S.turtles, d.turtle, 200); else removeAnimals(S.turtles, -(d.turtle || 0));
    if (d.fish > 0 && S.fish.length === d.fish) S.fishH = 0.9;
    if (d.shrimp > 0 && S.shrimp.length === d.shrimp) S.shrimpH = 0.9;

    if (!hadHard && S.rocks + S.wood > 0) add('Design', 'The bones of the aquarium',
      'Stones and wood are the skeleton of a nature aquarium. They also give helpful bacteria lots of surface to live on, and give animals places to hide.');
    if (S.rocks !== oldRocks && [3, 5, 7].includes(S.rocks) && !S.flags['iwagumi' + S.rocks]) {
      S.flags['iwagumi' + S.rocks] = true;
      add('Design', 'Iwagumi: a rock arrangement', `Iwagumi is Amano’s Japanese word for "rock arrangement" (in Chinese you could say 岩石組合, yánshí zǔhé). Nature aquarists like odd numbers of stones — one big main stone (the Oyaishi) with smaller helpers — so it looks like a real mountainside. You have ${S.rocks}.`, 3);
    }
    return ev;
  }

  /* ---------- a whole week ---------- */
  function simulateWeek(S, opts = {}) {
    const ev = [];
    const add = (day, topic, title, text, pri = 2) => ev.push({ day, topic, title, text, pri });
    const c0 = counts(S);
    const T = {
      stressF: {}, stressS: {}, births: 0, broods: 0, fry: 0, spawns: 0, babiesEaten: 0, fryEaten: 0,
      turtleShrimp: 0, turtleFish: 0, turtlePlants: 0, deaths: { fish: {}, shrimp: {}, turtle: {} },
      maxNH3: S.nh3, maxNH3Day: 1, maxNO2: S.no2, maxNO2Day: 1, minO2: 99, maxO2: 0, maxCO2: 0, pearlHours: 0,
      algaeStart: S.algae, bioStart: sumBio(S), plantsStart: S.plants.length, melted: [], grazed: 0, starve: false,
      onHours: 0, fcSum: 0, fnSum: 0, shadeSum: 0, co2Day: [], leach: 0, waste: 0,
      shrimpStart: c0.shrA + c0.shrJ, fishStart: c0.fishA + c0.fishJ,
      flux: {
        light: { in: 0, blocked: 0, plants: 0, algae: 0, heat: 0 },
        o2: { made: 0, plants: 0, animals: 0, bact: 0, decay: 0, airIn: 0, airOut: 0 },
        co2: { photo: 0, plants: 0, animals: 0, turtle: 0, decay: 0, airIn: 0, airOut: 0 },
        n: { fish: 0, shrimp: 0, turtle: 0, soil: 0, rot: 0, c1: 0, c2: 0, plants: 0, plantsA: 0, algae: 0, wc: 0 },
      },
    };
    if (opts.waterChange) {
      T.flux.n.wc = (S.nh3 + S.no2 + S.no3) * 0.5;
      S.nh3 *= 0.5; S.no2 *= 0.5; S.no3 *= 0.5; S.det *= 0.6; S.tannin *= 0.5;
      S.co2 += (3 - S.co2) * 0.5; S.o2 += (8.2 - S.o2) * 0.5; S.algae *= 0.85;
      add(1, 'Systems', 'Fresh water', 'You swapped half the water. Ammonia, nitrite and nitrate all dropped by half — like opening a window in a stuffy room. You also wiped some algae off the glass.', 2);
    }
    if (opts.trim && S.plants.length) {
      let cut = 0;
      for (const p of S.plants) {
        const cap = p.sp === 'stem' ? 0.8 : 1.1;
        if (p.bio > cap) { cut += p.bio - cap; p.bio = cap; }
      }
      add(1, 'Plant growth', cut > 0.2 ? 'Trimmed the garden' : 'A light trim',
        cut > 0.2 ? 'You cut back overgrown plants so light reaches the whole tank again. Trimmed plants grow back bushier — that’s how nature aquarists shape their layouts.'
                  : 'There wasn’t much to trim yet. Plants need a few weeks of growth first.', 2);
    }
    const frames = [];
    for (let h = 0; h < 168; h++) {
      const hod = h % 24, day = Math.floor(h / 24) + 1;
      stepHour(S, hod, T, day);
      if (hod === 23) stepDay(S, T, day);
      frames.push(snap(S, h, hod));
    }
    S.week++;
    S.frames = frames;
    const sum = o => Object.values(o).reduce((a, b) => a + b, 0);
    S.flux = Object.assign({}, T.flux, { web: {
      grazed: T.grazed, turtleShrimp: T.turtleShrimp, turtleFish: T.turtleFish, turtlePlants: T.turtlePlants,
      babiesEaten: T.babiesEaten, fryEaten: T.fryEaten, births: T.births, fry: T.fry,
      deathsShrimp: sum(T.deaths.shrimp), deathsFish: sum(T.deaths.fish), oldShrimp: T.deaths.shrimp.age || 0,
    } });
    narrate(S, T, add);
    ev.sort((a, b) => b.pri - a.pri);
    const kept = ev.slice(0, 7).sort((a, b) => a.day - b.day);
    return { frames, events: kept, T };
  }

  /* ---------- turning numbers into a story ---------- */
  function narrate(S, T, add) {
    const c = counts(S);
    const H = LIGHT_HOURS[S.light];
    const hh = h => String(h).padStart(2, '0') + ':00';
    const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;

    if (T.maxNH3 > 0.5) {
      S.flags.sawAmmonia = true;
      const soilMostly = T.leach > T.waste;
      add(T.maxNH3Day, 'Microbiology', 'Ammonia is building up', soilMostly
        ? `New aquarium soil releases ammonia for its first few weeks. It peaked at ${fmt(T.maxNH3, 2)} ppm on day ${T.maxNH3Day}. Ammonia is poison for animals — but it is also food for helpful bacteria that are starting to grow.`
        : `Animal waste and rotting leftovers turn into ammonia. It peaked at ${fmt(T.maxNH3, 2)} ppm on day ${T.maxNH3Day} — the bacteria colony isn't big enough yet to eat it all.`, T.maxNH3 > 1 ? 3 : 2);
    } else if (T.maxNH3 > 0.3) S.flags.sawAmmonia = true;
    if (T.maxNO2 > 0.5) add(T.maxNO2Day, 'Microbiology', 'Second wave: nitrite',
      `The first team of bacteria turned ammonia into nitrite (peak ${fmt(T.maxNO2, 2)} ppm). Nitrite is poisonous too, so a second team of bacteria has to grow and turn it into nitrate.`, 2);
    if (!S.flags.cycle && S.flags.sawAmmonia && S.nh3 < 0.12 && S.no2 < 0.12 && S.B1 > 0.12 && S.B2 > 0.12) {
      S.flags.cycle = true; T.cycleNow = true;
      add(7, 'Microbiology', 'The nitrogen cycle is running!',
        'Two teams of invisible bacteria now live on the soil, stones, wood and leaves. They turn toxic ammonia → nitrite → nitrate, which plants use as food. It is now much safer to add animals.', 4);
    }

    if (H === 0) add(1, 'Photosynthesis', 'Lights out',
      'Without light there is no photosynthesis. Plants can’t make food or oxygen, and they slowly use up what they stored.', 3);
    if (T.pearlHours > 3) {
      if (!S.flags.pearl) {
        S.flags.pearl = true; T.pearlFirst = true;
        add(3, 'Photosynthesis', 'Pearling!', 'Your plants are making oxygen so fast that tiny silver bubbles form on their leaves. That is photosynthesis you can see: light + CO₂ + water → sugar + oxygen.', 3);
      } else add(4, 'Photosynthesis', 'Pearling again', `Plants were fizzing with oxygen bubbles for about ${T.pearlHours} hours this week.`, 1);
    }
    const breathers = c.fishA + c.fishJ + c.shrA + c.shrJ;
    if (T.minO2 < 4.5 && (breathers || T.fishStart || T.shrimpStart)) {
      add(T.minO2Day, T.minO2Night && S.plants.length ? 'Photosynthesis' : 'Biology', T.minO2Night ? 'Gasping at dawn' : 'Running out of oxygen',
        T.minO2Night && S.plants.length
          ? `At night there’s no light, so plants stop making oxygen and breathe it in, just like the animals. By ${hh(T.minO2Hod)} on day ${T.minO2Day} oxygen fell to ${fmt(T.minO2)} mg/L and fish crowded at the surface.`
          : `Every animal and every bit of rotting waste uses oxygen. They used it faster than it could soak in from the surface — it fell to ${fmt(T.minO2)} mg/L.`, 3);
    }
    if (T.maxO2 > 13) add(4, 'Photosynthesis', 'Too much oxygen',
      `Lots of plants under lots of light pushed oxygen up to ${fmt(T.maxO2)} mg/L. Water that’s over-full of gas can give fish tiny bubbles under their skin (gas bubble disease). Animals would use some of it up.`, 2);
    if (T.maxCO2 > 30) add(4, 'Biology', 'Too much CO₂',
      `Every fish, shrimp and rotting leaf breathes out carbon dioxide. At ${fmt(T.maxCO2, 0)} mg/L, fish struggle to breathe even when there is oxygen around.`, 3);
    const co2Avg = T.co2Day.length ? T.co2Day.reduce((a, b) => a + b, 0) / T.co2Day.length : 3;
    if (S.plants.length >= 3 && co2Avg < 1.8 && H > 0) add(4, 'Photosynthesis', 'Plants ran low on CO₂',
      'During the day your plants used up almost all the carbon dioxide. Animals breathe it out — so fish and shrimp are the plants’ partners.', 1);

    // plant growth summary
    const bioEnd = sumBio(S);
    if (T.plantsStart && S.plants.length) {
      const g = Math.round((bioEnd - T.bioStart) / T.bioStart * 100);
      const fc = T.onHours ? T.fcSum / T.onHours : 0, fn = T.onHours ? T.fnSum / T.onHours : 0;
      const lightQ = Math.min(1, H / 7);
      const limits = [[lightQ, 'light'], [fc * 1.4, 'CO₂'], [fn * 1.3, 'nutrients (nitrate)']].sort((a, b) => a[0] - b[0]);
      if (g >= 5) add(6, 'Plant growth', `Plants grew ${g}%`,
        `Using light for energy, CO₂ as building blocks and nitrate from waste for protein, your plants built new leaves. The thing holding them back most was ${limits[0][1]}.`, g > 30 ? 2 : 1);
      else if (g <= -5) add(6, 'Plant growth', `Plants shrank ${-g}%`,
        `When plants can’t get enough ${limits[0][1]}, they burn their stored sugar and drop leaves.`, 2);
    }
    for (const m of T.melted) add(m.day, 'Lifecycle', 'A plant melted away',
      `Your ${PLANT_NAMES[m.sp]} ran out of energy and died. Its rotting leaves release ammonia into the water.`, 3);
    if (tallExcess(S) > 0.5 && S.plants.some(p => p.sp === 'carpet' || p.sp === 'grass')) add(6, 'Plant growth', 'Tall stems are shading the carpet',
      'Stem plants grew up to the surface and block light from the small plants below. Nature aquarists trim stems so every plant gets its share of light.', 2);

    // algae
    if (T.algaeStart < 0.3 && S.algae >= 0.3) add(5, 'Biology', 'Algae bloom',
      `Algae are tiny, fast plants. They explode when there’s extra light and extra nutrients, and not enough big plants to compete. They now cover ${Math.round(S.algae * 100)}% of the tank. ${H > 10 ? 'Too much light is the main cause.' : 'Extra waste is feeding them.'}`, 3);
    else if (T.algaeStart > 0.2 && S.algae < 0.12) add(6, 'Biology', 'Algae is retreating',
      'Healthy plants and hungry shrimp are winning the competition for light and food.', 2);
    if (T.grazed > 0.15 && c.shrA + c.shrJ > 0) add(5, 'Biology', 'Shrimp on cleaning duty',
      'Shrimp are grazers: all week they picked algae and gunk off every surface. That is their job in the food web.', 1);

    // reproduction & predation
    if (T.births) {
      const first = !S.flags.shrimpBorn; S.flags.shrimpBorn = true;
      add(T.birthDay, 'Reproduction', `${T.births} baby shrimp hatched!`,
        (first ? 'Cherry shrimp mothers carry their eggs under their tails for about a month, fanning them with fresh water. ' : '') +
        'The babies are tiny copies of their parents — no larva stage.' + (T.broods > 1 ? ` ${T.broods} mothers released babies this week.` : ''), 3);
    }
    if (T.fry) {
      S.flags.fry = true;
      add(T.fryDay, 'Reproduction', 'Tetra fry appeared!',
        `The tetras scattered eggs among the plants. Most eggs get eaten — even by their own parents — but ${plural(T.fry, 'tiny fry', 'tiny fry')} survived, hidden in the leaves.`, 3);
    }
    if (T.babiesEaten + T.fryEaten > 0) add(5, 'Predation', `Fish ate ${plural(T.babiesEaten + T.fryEaten, 'baby', 'babies')}`,
      `Tetras are small predators — a baby shrimp${T.fryEaten ? ' or a fry' : ''} is a snack. Carpet and moss give babies places to hide (hiding cover this week: ${Math.round(cover(S) * 100)}%).`, 2);
    if (T.turtleShrimp + T.turtleFish > 0 || (T.turtlePlants && c.turt)) {
      S.flags.hunt = true;
      const bits = [];
      if (T.turtleShrimp) bits.push(plural(T.turtleShrimp, 'shrimp', 'shrimp'));
      if (T.turtleFish) bits.push(plural(T.turtleFish, 'fish', 'fish'));
      add(4, 'Predation', 'The turtle went hunting',
        `${bits.length ? 'It ate ' + bits.join(' and ') + ' and ' : 'It '}chewed on your plants. Turtles are omnivores — in the wild they eat both plants and small animals.`, 3);
    }
    if (c.turt && !S.flags.turtleIntro) {
      S.flags.turtleIntro = true;
      add(1, 'Biology', 'Turtles breathe air',
        'The turtle swims up to breathe at the surface, so it doesn’t use the water’s oxygen. But it makes as much waste as about 15 small fish, and it needs a dry rock under a warm lamp to bask. This tank has no land.', 3);
    }

    // deaths
    const causes = {
      tox: 'Ammonia and nitrite burn their gills — the bacteria couldn’t clean the water fast enough.',
      o2: 'There wasn’t enough oxygen in the water to breathe.',
      co2: 'Too much carbon dioxide made breathing hard.',
      o2hi: 'Too much dissolved oxygen gas harmed them.',
      no3: 'Nitrate built up too high after weeks of waste.',
      crowd: 'The tank was too crowded — stress makes animals sick.',
      ph: 'The water was too acidic or too alkaline for them.',
      food: 'There wasn’t enough algae and biofilm to eat — more shrimp than this tank can feed.',
      weak: 'They were weakened by the changing water.',
    };
    let illDeaths = 0;
    for (const [sp, name1, nameN] of [['fish', 'fish', 'fish'], ['shrimp', 'shrimp', 'shrimp'], ['turtle', 'turtle', 'turtles']]) {
      const d = T.deaths[sp];
      for (const k in d) {
        if (k === 'age') {
          add(6, 'Lifecycle', `${plural(d[k], 'old ' + name1, 'old ' + nameN)} died`,
            `${d[k] === 1 ? 'It' : 'They'} lived a full life and died of old age. Every animal has a lifespan — and ${d[k] === 1 ? 'its body returns' : 'their bodies return'} nutrients to the soil for plants.`, 2);
        } else {
          illDeaths += d[k];
          add(T.firstDeath || 3, 'Lifecycle', `${plural(d[k], name1, nameN)} died`, causes[k] || causes.weak, 4);
        }
      }
    }
    if (illDeaths >= 2) add((T.firstDeath || 3) + 1, 'Systems', 'A chain reaction',
      'Dead bodies rot and release even more ammonia, which can harm the survivors. In a system, one problem can feed the next — engineers call this a feedback loop.', 3);
    if (T.starve) add(5, 'Biology', 'Not enough food for the shrimp',
      `Shrimp eat algae, biofilm and leftovers. This tank can’t grow enough for ${c.shrA + c.shrJ} shrimp — nature sets a limit called carrying capacity.`, 2);

    if (S.tannin > 0.06 && !S.flags.tannin) {
      S.flags.tannin = true;
      add(5, 'Biology', 'Tea-colored water', 'Driftwood slowly leaks tannins, the same stuff that makes tea brown. They lower the pH a little. Many wild fish live in rivers stained just like this.', 2);
    }
    const crowd = bioload(c) / space(S);
    if (crowd > 1) add(6, 'Systems', 'Too crowded',
      `This tank comfortably holds about ${Math.round(space(S))} small-fish-sized animals. You have the load of ${Math.round(bioload(c))} (a turtle counts as 20 — they grow as big as a dinner plate).`, 2);
    if (!S.plants.length && !c.fishA && !c.fishJ && !c.shrA && !c.shrJ && !c.turt) add(3, 'Microbiology', 'A quiet week',
      'Even an empty tank is alive: bacteria are settling into the soil. Most nature aquarists place stones and wood first, then plants, and add animals weeks later.', 1);
  }

  /* ---------- scoring ---------- */
  function band(v, lo, hi, loZero, hiZero) {
    if (v < lo) return loZero >= lo ? 100 : clamp((v - loZero) / (lo - loZero), 0, 1) * 100;
    if (v > hi) return clamp((hiZero - v) / (hiZero - hi), 0, 1) * 100;
    return 100;
  }
  function status(v, lo, hi, score) {
    if (score >= 85) return { word: 'Just right', tone: 'good' };
    const low = v < lo;
    if (score >= 45) return { word: low ? 'A bit low' : 'A bit high', tone: 'warn' };
    return { word: low ? 'Too low' : 'Too high', tone: 'bad' };
  }

  function readings(S, frames) {
    if (frames && frames.length) {
      const d = frames.slice(-24);
      const avg = k => d.reduce((a, f) => a + f[k], 0) / d.length;
      return {
        o2: avg('o2'), o2min: Math.min(...d.map(f => f.o2)), o2max: Math.max(...d.map(f => f.o2)),
        co2: avg('co2'), tox: avg('nh3') + avg('no2'), no3: frames[frames.length - 1].no3,
        algae: frames[frames.length - 1].algae, clar: frames[frames.length - 1].clar, ph: avg('ph'),
      };
    }
    return { o2: S.o2, o2min: S.o2, o2max: S.o2, co2: S.co2, tox: S.nh3 + S.no2, no3: S.no3, algae: S.algae, clar: 1 - cloudiness(S), ph: pH(S) };
  }

  const EXPLAIN = {
    o2: 'Fish and shrimp breathe oxygen dissolved in the water. Plants make it in the light (photosynthesis) and use it up in the dark. It also soaks in from the surface. Ideal: 6–10 mg/L.',
    co2: 'Carbon dioxide is what animals breathe out and what plants breathe in to build leaves. Plants want some; too much makes fish gasp. Ideal: 3–25 mg/L.',
    ph: 'How acidic or alkaline the water is. CO₂ and wood tannins push it down; stones push it up. Ideal: 6.4–7.6.',
    tox: 'Ammonia (from waste) and nitrite are poisons. Helpful bacteria turn them into nitrate. Ideal: under 0.25 ppm.',
    no3: 'The end of the nitrogen cycle. Plants eat it as fertilizer, but a lot of it stresses animals. Water changes remove it. Ideal: 1–30 ppm.',
    light: 'Light is the energy source for the whole tank. Plants need it; light they can’t use feeds algae instead. Ideal: 6–10 hours a day.',
    algae: 'Tiny plants that coat glass, stones and leaves. A little is normal shrimp food; too much smothers plants. Ideal: under 15%.',
    clar: 'How clear the water is. Waste, rotting leaves and green algae make it cloudy. Ideal: over 85%.',
    plants: 'How healthy your plants are. They need light, CO₂ and nutrients — and not too much shade from each other.',
    animals: 'How your fish, shrimp and turtles feel. Bad water, crowding and hunger make them sick.',
    bact: 'Invisible bacteria on every surface eat ammonia and nitrite. More surface (stones, wood, plants) means more bacteria. This shows how much of the daily waste they can clean.',
    crowd: 'How full the tank is. A turtle needs as much room as about 20 small fish. Ideal: under 80%.',
  };

  function evaluate(S, frames, Rin) {
    const R = Rin || readings(S, frames);
    const c = counts(S);
    const H = LIGHT_HOURS[S.light];
    const nP = S.plants.length;
    const animals = c.fishA + c.fishJ + c.shrA + c.shrJ + c.turt;
    const breathers = animals - c.turt;
    const list = [];
    const M = (o) => { o.st = o.override || status(o.v, o.lo, o.hi, o.score); list.push(o); };

    let s = band(R.o2, 6, 10, 2.5, 16);
    let ov = null;
    if (R.o2min < 4.5 && breathers) { s = Math.min(s, clamp(40 + (R.o2min - 2) * 12, 0, 70)); ov = { word: 'Low at night', tone: s < 45 ? 'bad' : 'warn' }; }
    M({ key: 'o2', group: 'Water', label: 'Oxygen', unit: 'mg/L', v: R.o2, text: fmt(R.o2), lo: 6, hi: 10, min: 0, max: 16, score: s, override: ov, w: 2 });
    const needC = nP > 0;
    s = band(R.co2, needC ? 3 : 0, 25, needC ? 0.5 : -1, 45);
    M({ key: 'co2', group: 'Water', label: 'CO₂', unit: 'mg/L', v: R.co2, text: fmt(R.co2), lo: needC ? 3 : 0, hi: 25, min: 0, max: 45, score: s, w: 1 });
    s = band(R.ph, 6.4, 7.6, 5.6, 8.4);
    M({ key: 'ph', group: 'Water', label: 'pH', unit: '', v: R.ph, text: fmt(R.ph), lo: 6.4, hi: 7.6, min: 5.5, max: 8.5, score: s, w: 1 });
    s = band(R.tox, 0, 0.25, -1, 2);
    M({ key: 'tox', group: 'Water', label: 'Ammonia + nitrite', unit: 'ppm', v: R.tox, text: fmt(R.tox, 2), lo: 0, hi: 0.25, min: 0, max: 3, score: s, w: 2 });
    s = band(R.no3, nP ? 1 : 0, 30, nP ? -1 : -2, 80);
    M({ key: 'no3', group: 'Water', label: 'Nitrate', unit: 'ppm', v: R.no3, text: fmt(R.no3, 1), lo: nP ? 1 : 0, hi: 30, min: 0, max: 80, score: s, w: 1 });

    s = nP ? band(H, 6, 10, 0, 16) : band(H, 0, 10, -1, 16);
    M({ key: 'light', group: 'Light', label: 'Light', unit: 'h/day', v: H, text: String(H), lo: nP ? 6 : 0, hi: 10, min: 0, max: 16, score: s, w: 1 });
    const alg = R.algae * 100;
    s = band(alg, 0, 15, -1, 60);
    M({ key: 'algae', group: 'Light', label: 'Algae', unit: '%', v: alg, text: fmt(alg, 0), lo: 0, hi: 15, min: 0, max: 100, score: s, w: 1 });
    const clar = R.clar * 100;
    s = band(clar, 85, 100, 40, 101);
    M({ key: 'clar', group: 'Light', label: 'Clarity', unit: '%', v: clar, text: fmt(clar, 0), lo: 85, hi: 100, min: 0, max: 100, score: s, w: 1 });

    if (nP) {
      const ph = S.plants.reduce((a, p) => a + p.health, 0) / nP * 100;
      s = band(ph, 70, 100, 20, 101);
      M({ key: 'plants', group: 'Life', label: 'Plant health', unit: '%', v: ph, text: fmt(ph, 0), lo: 70, hi: 100, min: 0, max: 100, score: s, w: 1.5 });
    } else list.push({ key: 'plants', group: 'Life', label: 'Plant health', text: '—', unit: '', score: null, st: { word: 'No plants yet', tone: 'idle' } });
    if (animals) {
      const wF = c.fishA + c.fishJ, wS = c.shrA + c.shrJ, wT = c.turt * 8;
      const ah = (wF * S.fishH + wS * 0.4 * S.shrimpH + wT * S.turtleH) / (wF + wS * 0.4 + wT) * 100;
      s = band(ah, 75, 100, 20, 101);
      M({ key: 'animals', group: 'Life', label: 'Animal health', unit: '%', v: ah, text: fmt(ah, 0), lo: 75, hi: 100, min: 0, max: 100, score: s, w: 1.5 });
    } else list.push({ key: 'animals', group: 'Life', label: 'Animal health', text: '—', unit: '', score: null, st: { word: 'No animals yet', tone: 'idle' } });
    const load = wasteRate(c) + 0.012 * S.soil + 0.015 * S.det;
    const cap = Math.min(S.B1, S.B2) * 0.2 * 0.5;
    const ready = clamp(cap / load * 100, 0, 300);
    if (load > 0.004 || animals) {
      s = band(ready, 110, 300, 15, 301);
      M({ key: 'bact', group: 'Life', label: 'Bacteria power', unit: '%', v: ready, text: fmt(ready, 0), lo: 110, hi: 300, min: 0, max: 300, score: s, w: animals ? 1.5 : 0.5 });
    } else list.push({ key: 'bact', group: 'Life', label: 'Bacteria power', text: '—', unit: '', score: null, st: { word: 'Resting', tone: 'idle' } });
    const crowd = bioload(c) / space(S) * 100;
    s = band(crowd, 0, 80, -1, 140);
    M({ key: 'crowd', group: 'Life', label: 'Crowding', unit: '%', v: crowd, text: fmt(crowd, 0), lo: 0, hi: 80, min: 0, max: 150, score: s, w: 1 });

    for (const m of list) m.explain = EXPLAIN[m.key];
    let sw = 0, ws = 0;
    for (const m of list) if (m.score != null) { sw += m.score * m.w; ws += m.w; }
    const minScore = Math.min(...list.filter(m => m.score != null).map(m => m.score));
    const balance = ws ? 0.65 * sw / ws + 0.35 * minScore : 0;
    const plantLife = Math.min(1, vigor(S) / 6);
    const animalLife = 0.6 * Math.min(1, (c.fishA + 0.4 * c.fishJ) * S.fishH / 10) + 0.4 * Math.min(1, (c.shrA + 0.3 * c.shrJ) * S.shrimpH / 15);
    const hard = (S.rocks > 0 ? 0.5 : 0) + (S.wood > 0 ? 0.5 : 0);
    const life = 0.5 * plantLife + 0.35 * animalLife + 0.15 * hard;
    const harmony = Math.round(balance * (0.25 + 0.75 * Math.sqrt(life)));
    return { list, balance, life, harmony, R, c };
  }

  function grade(h) {
    if (h >= 90) return { name: 'Nature Aquarium', line: 'Every part feeds another. This is balance.' };
    if (h >= 75) return { name: 'Thriving', line: 'Life is flourishing.' };
    if (h >= 60) return { name: 'Settling in', line: 'Getting there — a few things to tune.' };
    if (h >= 40) return { name: 'Out of balance', line: 'Something is tipping the scales.' };
    return { name: 'Struggling', line: 'The tank needs help.' };
  }

  /* ---------- advice ---------- */
  function sensei(S, E) {
    const c = E.c;
    const animals = c.fishA + c.fishJ + c.shrA + c.shrJ + c.turt;
    const worst = E.list.filter(m => m.score != null).sort((a, b) => a.score - b.score)[0];
    const by = k => E.list.find(m => m.key === k);
    if (S.week === 0) return 'Every nature aquarium starts with its bones: place stones and wood first, then plants. Animals come last, after the invisible bacteria have grown. Try some rocks, wood and plants, then let a week pass.';
    if (c.turt) {
      const t = by('clar');
      if (E.harmony < 75) return 'The turtle is the biggest force in this tank: it hunts shrimp, chews plants and makes a lot of waste. Real turtles are happiest in a turtle tank with land to bask on. Try taking it out and watch the tank recover.' + (t && t.score < 60 ? ' A water change will help clear things up.' : '');
    }
    if (worst && worst.score < 85) {
      const low = worst.v < worst.lo;
      switch (worst.key) {
        case 'tox': return animals
          ? 'The bacteria can’t keep up with the waste. Don’t add animals this week. Add plants (they drink ammonia), add stones or wood (more homes for bacteria), and do a water change.'
          : 'The new soil is releasing ammonia — that’s normal. Let a week or two pass so the bacteria can grow before you add animals. Plants help soak it up.';
        case 'o2': return by('o2').override
          ? 'Oxygen crashes at night when plants stop photosynthesizing and everything breathes. Fewer animals, less rotting waste, or a water change will help.'
          : low ? 'Too many breathers or too much rotting waste. Remove some animals, add plants, or do a water change.'
                : 'So many plants in so much light make more oxygen than the water can hold. Reduce the light a little, or add some animals to use it.';
        case 'co2': return low
          ? 'Your plants are hungry for CO₂. Animals breathe it out — a few shrimp or fish would feed the plants (in balance!).'
          : 'Too many animals are breathing out CO₂. Remove some, or add plants to soak it up.';
        case 'light': return low
          ? 'Plants need light to make food. Add light — around 7 or 8 hours is what nature aquarists usually use.'
          : 'Too much light feeds algae. Try turning it down to 6–8 hours.';
        case 'no3': return low
          ? 'Your plants are starving for nitrogen. Fish waste is plant food — the bacteria turn it into nitrate. A few animals would help.'
          : 'Waste has piled up as nitrate. Do a water change and add plants to eat it.';
        case 'algae': return 'Algae is winning. Turn the light down, add plants (they compete for the same food) and add shrimp (they eat algae).';
        case 'clar': return 'The water is cloudy from waste and decay. Do a water change, and don’t keep more animals than the tank can clean up after.';
        case 'ph': return low ? 'The water is getting acidic from CO₂ and wood tannins. A water change or a bit less wood will help.' : 'Lots of stones make the water harder and raise pH. Try fewer stones.';
        case 'crowd': return 'The tank is too crowded. Take out some animals — especially big ones.';
        case 'plants': return 'Your plants are struggling. Check their three needs: light (6–10 h), CO₂ (animals make it), and nitrate (from waste). Tall stems can also shade the carpet.';
        case 'animals': return 'Your animals are stressed. Look at the water meters above — ammonia, oxygen and crowding are the usual suspects. A water change is a good first aid.';
        case 'bact': return 'The bacteria colony is too small for this much waste. Add stones, wood or plants for more bacteria homes, and hold off on new animals.';
      }
    }
    if (!S.rocks && !S.wood) return 'The water is calm. Give the tank its bones: a few stones (try an odd number) and a piece of wood.';
    if (!S.plants.length) return 'Time to plant! Plants are the engine of the tank — they make oxygen, eat waste and keep algae away.';
    if (!animals && !S.flags.cycle) return 'Wait for the nitrogen cycle to finish before adding animals. Keep watching the ammonia + nitrite meter.';
    if (!c.shrA && !c.shrJ) return 'The tank is ready for its first animals. Shrimp are a great start — they clean algae and make a little CO₂ for the plants.';
    if (!c.fishA && !c.fishJ) return 'Try a small school of fish. Their waste feeds the plants — but they also hunt baby shrimp, so give babies plenty of moss and carpet to hide in.';
    if (E.harmony >= 90) return 'This is what nature aquarium means: every part feeds another. Try one small change and see if the balance holds.';
    return 'Things look good. Let time pass and watch the plants fill in. Small changes are easier to understand than big ones.';
  }

  /* ---------- goals ---------- */
  const GOALS = [
    { id: 'bones', name: 'Good bones', text: 'Place stones and wood.' },
    { id: 'iwagumi', name: 'Iwagumi', text: 'Arrange 3, 5 or 7 stones.' },
    { id: 'sprout', name: 'First growth', text: 'Plants grow during a week.' },
    { id: 'cycle', name: 'Invisible helpers', text: 'Complete the nitrogen cycle.' },
    { id: 'pearl', name: 'Pearling', text: 'See plants make oxygen bubbles.' },
    { id: 'babies', name: 'Next generation', text: 'Baby shrimp are born.' },
    { id: 'fry', name: 'Hidden fry', text: 'Fish babies survive in the plants.' },
    { id: 'hunt', name: 'Food web', text: 'Watch a predator hunt.' },
    { id: 'clear', name: 'Crystal clear', text: 'Clarity 95%+ with algae under 8%.' },
    { id: 'h75', name: 'In balance', text: 'Reach Harmony 75.' },
    { id: 'comeback', name: 'Comeback', text: 'Raise Harmony 20+ in one week.' },
    { id: 'h90', name: 'Nature Aquarium', text: 'Harmony 90+ three weeks in a row.' },
    { id: 'scientist', name: 'Young scientist', text: 'Make 5 correct predictions.' },
    { id: 'rescuer', name: 'Rescuer', text: 'Complete a rescue mission.' },
  ];
  function checkGoals(S, E, T, prevHarmony, meta = {}) {
    const got = [];
    const give = id => { if (!S.achievements[id]) { S.achievements[id] = S.week; got.push(id); } };
    if (S.rocks && S.wood) give('bones');
    if ([3, 5, 7].includes(S.rocks)) give('iwagumi');
    if (T && T.plantsStart && sumBio(S) > T.bioStart * 1.05) give('sprout');
    if (S.flags.cycle) give('cycle');
    if (S.flags.pearl) give('pearl');
    if (S.flags.shrimpBorn) give('babies');
    if (S.flags.fry && S.fish.some(f => f.age < 28)) give('fry');
    if (S.flags.hunt || (T && T.babiesEaten + T.fryEaten > 0)) give('hunt');
    if (E.R.clar >= 0.95 && E.R.algae < 0.08 && (S.plants.length || S.fish.length)) give('clear');
    if (E.harmony >= 75) give('h75');
    if (prevHarmony != null && E.harmony - prevHarmony >= 20 && S.week > 1) give('comeback');
    S.streak90 = E.harmony >= 90 ? S.streak90 + 1 : 0;
    if (S.streak90 >= 3) give('h90');
    if ((meta.right || 0) >= 5) give('scientist');
    if (meta.missionsWon && Object.keys(meta.missionsWon).length) give('rescuer');
    return got;
  }

  const api = {
    LIGHT_HOURS, SLOTS, PLANT_NAMES, LIMITS, newState, counts, applyChanges, simulateWeek, evaluate,
    grade, sensei, GOALS, checkGoals, cover, cloudiness, bioload, space, pH, sumBio, vigor,
    seed: n => { rand = mulberry32(n); }, unseed: () => { rand = () => Math.random(); },
  };
  root.Sim = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
