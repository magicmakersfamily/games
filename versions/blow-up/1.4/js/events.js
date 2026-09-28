'use strict';
  // ============================================================================================
  // EVENTS FROM THE ENGINE
  // ============================================================================================
  let zoneSaid = {}, bodySaid = { hungry: -999, tired: -999 }, prevBody = { hungry: false, tired: false }, saidOnce = new Set();
  const once = (key, fn) => { if (saidOnce.has(key)) return; saidOnce.add(key); fn(); };
  function handleEvents() {
    for (const e of S.events) {
      switch (e.kind) {
        case 'scene': lastSceneKey = ''; clearBlowupFX(); onScene(e); break;
        case 'blowup':
          freezeUntil = performance.now() + (COVER ? 0 : 2200);
          blowupFX(e); kidBubble(CT.BLOWUPS[e.type].kid, null, -1); kidSay(CT.BLOWUPS[e.type].kid, 2, true);
          say([CT.NARR.blowup, CT.NARR.blowType[e.type]], 'narr', { prio: 2, hold: true });
          if (e.lastStraw && e.lastStraw.id === 'cookie') say(CT.NARR.cookie, 'narr', { prio: 2, hold: true });
          if (e.collapse) say(CT.NARR.collapse, 'narr', { prio: 2, hold: true });
          if (e.second) say(CT.NARR.second, 'narr', { prio: 2, hold: true });
          say(CT.NARR.phase.eruption, 'narr', { prio: 2, hold: true });
          pickle(e.collapse ? 'collapse' : e.second ? 'secondEruption' : 'blowup', true);
          owlState = 'chair';
          break;
        case 'phase':
          if (e.phase === 'cooling') { clearBlowupFX(); lastBlowType = null; }
          if (e.phase === 'cooling' || e.phase === 'reconnect' || e.phase === 'repair' || e.phase === 'learn') say(CT.NARR.phase[e.phase], 'narr', { prio: 2, hold: true });
          if (e.phase === 'repair') pickle('repair');
          if (e.phase === 'learn') pickle('coaching');
          if (e.phase === 'day' && e.prev === 'learn') { SND.sparkle(); kidBubble('I feel better now.', 'self', -1); kidSay('I feel better now.', 2); say(CT.NARR.phase.day, 'narr', { prio: 2, hold: true }); }
          break;
        case 'zone':
          if (S.phase === 'day') {
            const order = ['green', 'yellow', 'red', 'blowup'];
            const up = order.indexOf(e.zone) > order.indexOf(e.prev);
            SND.tuba(up);
            const line = up ? CT.NARR.zone[e.zone] : (e.zone === 'green' ? CT.NARR.zone.green : null);
            if (line && !SIM.masking(S) && S.t - (zoneSaid[e.zone] || -999) >= 30) { zoneSaid[e.zone] = S.t; say(line, 'narr', { prio: e.zone === 'red' ? 2 : 1 }); }
          }
          break;
        case 'firstRed': pickle('firstRed'); break;
        case 'marble':
          if (e.n > 0) { SND.clink(); if (!pickleSeen.sdt) pickle('sdt'); if (SIM.jar(S, 'choice') >= 8) pickle('window'); }
          else SND.marbleLost();
          break;
        case 'selfUse':
          SND.sparkle(); kidBubble(e.skill === 'breathe' ? 'I can smell the flower all by myself!' : 'STOMP! I did it myself!', 'self', 1);
          say(CT.NARR.selfUse[e.skill], 'narr', { prio: 2 });
          burst(KID_X, FLOOR - 200, ['✨', '⭐'], 14, 1, { size: 20, grav: 0.02 }); pickle('skill');
          break;
        case 'levelup':
          burst(KID_X + 150, 100, ['⭐'], 3, 0.6, { size: 26, grav: 0.02 }); skillsSaved = snapshotSkills(); store.set('skills', skillsSaved); buildTrays(); trayPhase = '';
          say(CT.NARR.levelUp[e.skill], 'narr', { prio: 1 });
          break;
        case 'chaos':
          say(e.name, 'narr', { prio: 2 }); kidBubble(e.thought, null, 2);
          burst(KID_X + 140, 120, [e.icon], 1, 0.3, { size: 50, grav: 0.03 }); SND.bonk(); if (e.id === 'icecream') pickle('sugar');
          break;
        case 'scheduled': {
          if (e.id) { const cn = CT.CARD_NARR[e.id]; say(cn && cn.first && !dayUsed.has(e.id) ? cn.first : [CT.NARR.uhohWord, plain(cardById[e.id].name)], 'narr', { prio: 2 }); dayUsed.add(e.id); }
          else if (e.label) say([e.delta < 0 ? CT.NARR.yayWord : CT.NARR.uhohWord, plain(e.label)], 'narr', { prio: 2 });
          if (e.thought) kidBubble(e.thought, null, 2);
          if (e.type && e.delta > 0) dropInto(e.type);
          break;
        }
        case 'sock': kidBubble(e.how === 'named' ? 'My SOCK is itchy! That’s what it was!' : 'Bye-bye itchy sock!', 'self', 2); burst(KID_X - 20, FLOOR - 20, ['🧦'], 1, 1.2, { size: 30, up: true }); break;
        case 'flat': if (e.on) { say(CT.NARR.flat, 'narr', { prio: 2 }); pickle('flat'); } break;
        case 'said': break;
        case 'bedtime': break;
      }
      if (e.kind === 'used' && e.id === 'breathe') pickle('breath');
      if (e.kind === 'used' && e.id === 'name') pickle('name');
      if (e.kind === 'used' && e.id === 'wish') pickle('wish');
      if (e.kind === 'used' && e.id === 'choice') pickle('choice');
    }
    S.events.length = 0;
  }
  function onScene(e) {
    const L = CT.LOCATIONS[e.loc];
    const scenes = CT.NARR_SCENES[S.styleId] || {};
    if (scenes[S.scene.id]) say(scenes[S.scene.id], 'narr', { prio: 2, hold: true });
    if (L && L.masking) { once('masking', () => say(CT.NARR.masking, 'narr', { prio: 2, hold: true })); pickle('masking'); }
    if (L && L.nature) pickle('nature');
    if (S.scene.id === 'project') pickle('struggle');
    if (S.scene.id === 'play') pickle('freeplay');
  }
  // Body states the narrator should mention when they switch on.
  function watchBody(v) {
    for (const k of ['hungry', 'tired']) {
      if (v[k] && !prevBody[k] && v.phase === 'day' && S.t > 5 && S.t - bodySaid[k] > 90) { bodySaid[k] = S.t; say(CT.NARR[k], 'narr', { prio: 1 }); }
      prevBody[k] = v[k];
    }
  }

  // ============================================================================================
  // PROFESSOR PICKLE
  // ============================================================================================
  let pickleTimer = 0;
  function pickle(trigger, force) {
    const key = CT.PICKLE[trigger]; if (!key || COVER || !running) return;
    if (pickleSeen[key]) return;
    if (!force && S && S.t - pickleLastT < 40 && pickleLastT >= 0) return;
    pickleSeen[key] = true; if (trigger === 'waves') pickleSeen.coreg = true;
    pickleLastT = S ? S.t : 0;
    const sc = CT.SCIENCE[key];
    const el = $('pickle');
    el.innerHTML = `<button class="pk" type="button" aria-label="Professor Pickle: tap to close">${pickleSVG()}</button><div class="pk-bubble"><b>Professor Pickle:</b> ${esc(sc.kid)}<br><button class="pk-more" type="button" data-sci="${key}">Grown-ups: the science</button></div>`;
    el.hidden = false;
    say(sc.kid, 'pickle', { prio: 0 });
    clearTimeout(pickleTimer); pickleTimer = setTimeout(() => { el.hidden = true; }, 11000);
  }
  $('pickle').addEventListener('click', e => {
    const m = e.target.closest('[data-sci]');
    if (m) { scienceCard(m.dataset.sci); return; }
    if (e.target.closest('.pk')) { $('pickle').hidden = true; SND.boing(); }
  });

