'use strict';
  // ============================================================================================
  // START, LOOP, CONTROLS
  // ============================================================================================
  function startScreen() {
    running = false;
    const styles = Object.entries(CT.DAY_STYLES);
    openModal(`<div class="row">${hearBtn}<h2>Blow Up <span class="zh" lang="zh-TW">${rubyZh(CT.STR.titleZh, CT.STR.titlePy)}</span></h2></div>
      <p class="tagline">${CT.STR.tagline}</p>
      <p>This is Pip. Pip has a bucket inside. Little things fill it up. When it overflows… <b>KABOOM!</b> Drag 😬 Uh-oh cards to bring trouble to Pip’s day, and 💙 Helper cards to help Pip feel better. After a blow-up, help Pip calm down, make up and learn.</p>
      <h3>Pick a day</h3>
      <div class="start-grid">${styles.filter(([, s]) => s.scenes).map(([k, s]) => `<button class="daycard" type="button" data-style="${k}" aria-pressed="${prefs.style === k}"><span class="di">${s.icon}</span><b>${esc(s.name)}</b><small>${esc(s.blurb)}</small></button>`).join('')}</div>
      <div class="row"><button class="go" type="button" id="goBtn">Start the day ☀️</button></div>
      <p class="note">Coming later: ${styles.filter(([, s]) => !s.scenes).map(([, s]) => s.icon + ' ' + esc(s.name)).join(' · ')}</p>
      <p class="note">For grown-ups: a day takes 10 to 15 minutes and ends with a calm bedtime. Turn on Grown-Up View (top right) for the numbers and the science. ${CT.STR.disclaimer}</p>`, null, { noClose: true });
    $('sheet').querySelectorAll('[data-style]').forEach(b => b.addEventListener('click', () => {
      if (b.disabled) return;
      prefs.style = b.dataset.style; savePrefs();
      $('sheet').querySelectorAll('[data-style]').forEach(x => x.setAttribute('aria-pressed', x === b));
      const st = CT.DAY_STYLES[b.dataset.style];
      say(st.name + '. ' + st.blurb, 'narr', { interrupt: true });
      say(CT.NARR.misc.tapStart, 'narr', { prio: 2, onstart: () => spotOn($('goBtn')), onend: () => spotOff($('goBtn')) });
    }));
    modalHear = () => say(CT.NARR.welcome, 'narr', { prio: 2 });
    modalHear();
    $('goBtn').addEventListener('click', () => { audioInit(); stopSpeech(); closeModal(); newDay(prefs.style); });
  }

  function newDay(style, seed) {
    S = SIM.create({ style, seed: seed == null ? (Date.now() % 100000) : seed, kid: 'pip', skills: skillsSaved });
    running = true; paused = false; acc = 0; bedtimeShown = false; lastSceneKey = ''; jarKey = ''; jarPrev = null; trayPhase = ''; owlState = 'chair'; ACT.cur = null; ACT.next = null;
    pickleSeen = {}; pickleLastT = -999; lastBlowType = null; dayUsed = new Set(); parts.length = 0;
    zoneSaid = {}; bodySaid = { hungry: -999, tired: -999 }; prevBody = { hungry: false, tired: false }; saidOnce = new Set();
    $('pickle').hidden = true; $('bubble').hidden = true; $('bubbleAdult').hidden = true;
    buildTrays();
    if (running && N.unlocked && prefs.narrator && !store.get('tourDone', false)) tour();
    handleEvents(); tick(true); setPauseBtn();
    setTimeout(() => pickle('start'), 4000);
  }

  function tick(force) {
    if (!S) return;
    const v = SIM.view(S);
    buildScene(v);
    setKidFace(v); applyKidClasses(v); drawStrings(v); drawWaves(v); drawBrain(v);
    drawBucket(v); drawJars(v); updateTrays(v); updateKettle(v); if (running) watchBody(v);
    $('clock').textContent = v.clock;
    $('clockIcon').textContent = S.t >= 690 ? '🌙' : S.t >= 570 ? '🌅' : '☀️';
    if (force || S.t % 3 === 0) { drawGraph(); drawGrown(v); }
  }

  // --- Faces: mouths move with the voice that's speaking; everyone blinks now and then ---------------
  let mouthBase = {}, avatarNight = null;
  const blinkAt = { kid: 0, adult: 0, nav: 0 };
  function renderAvatar() {
    const night = !!(S && S.t >= 690);
    if (night === avatarNight && $('narrAvatar').firstChild) return;
    avatarNight = night; $('narrAvatar').innerHTML = avatarSVG(night);
  }
  function lipSync(now) {
    const who = N.cur && N.cur.who, lv = who ? voiceLevel() : 0;
    const drive = (id, on, open) => {
      const m = $(id); if (!m) return;
      if (on && lv > 0.05) {
        if (!mouthBase[id]) mouthBase[id] = { d: m.getAttribute('d'), fill: m.getAttribute('fill') || 'none' };
        m.setAttribute('d', open(Math.min(1, lv))); m.setAttribute('fill', '#7A2A2A');
      } else if (mouthBase[id]) { m.setAttribute('d', mouthBase[id].d); m.setAttribute('fill', mouthBase[id].fill); mouthBase[id] = null; }
    };
    drive('mouth', who === 'pip', o => `M-12 -134 Q0 ${-128 + o * 14} 12 -134 Q0 -137 -12 -134Z`);
    drive('adultMouth', who === 'adult', o => `M-10 -211 Q0 ${-206 + o * 11} 10 -211 Q0 -213 -10 -211Z`);
    drive('navMouth', who === 'narr' || who === 'zh', o => `M31 46 Q40 ${49 + o * 10} 49 46 Q40 44 31 46Z`);
    drive('pkMouth', who === 'pickle', o => `M24 37 Q31 ${40 + o * 8} 38 37 Q31 35 24 37Z`);
    // Blinks: every 2.5 to 6 seconds, 130 ms long.
    for (const [k, id] of [['kid', 'eyes'], ['adult', 'adultEyes'], ['nav', 'navEyes']]) {
      const el = $(id); if (!el) continue;
      if (now > blinkAt[k]) { el.classList.add('blink'); blinkAt[k] = now + 2500 + Math.random() * 3500; setTimeout(() => el.classList.remove('blink'), 130); }
    }
  }

  function frame(now) {
    const dt = Math.min(120, now - last); last = now;
    if (S && running && !paused && !isModal() && !S.done && !S.pending && now >= freezeUntil && !narrHolding()) {
      acc += dt * prefs.speed;
      let n = 0;
      while (acc >= MS_PER_MIN && n++ < 4) {
        acc -= MS_PER_MIN;
        SIM.step(S); handleEvents(); tick();
        if (S.pending || S.done || now < freezeUntil) { acc = 0; break; }
      }
    }
    if (S && running && S.pending && !isModal() && now >= freezeUntil && !narrHolding()) openPending();
    if (S && running && S.done && !bedtimeShown) startBedtime();
    stepParts();
    lipSync(now);
    requestAnimationFrame(frame);
  }

  function setPauseBtn() { const b = $('pauseBtn'); b.textContent = paused ? '▶' : '⏸'; b.setAttribute('aria-label', paused ? 'Play' : 'Pause'); }
  function togglePause() { if (!S) return; paused = !paused; setPauseBtn(); audioInit(); }
  $('pauseBtn').addEventListener('click', togglePause);
  document.querySelectorAll('[data-speed]').forEach(b => b.addEventListener('click', () => {
    prefs.speed = +b.dataset.speed; savePrefs();
    document.querySelectorAll('[data-speed]').forEach(x => x.setAttribute('aria-pressed', x === b));
  }));
  document.querySelectorAll('[data-speed]').forEach(x => x.setAttribute('aria-pressed', +x.dataset.speed === prefs.speed));
  $('soundBtn').addEventListener('click', () => { audioInit(); setSound(!prefs.sound); });
  $('grownBtn').addEventListener('click', () => {
    const on = $('grown').hidden; $('grown').hidden = !on; $('grownBtn').setAttribute('aria-pressed', on);
    if (on && S) { drawGrown(SIM.view(S)); $('grown').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
  });
  $('stickerBtn').addEventListener('click', () => { stickerWasPaused = paused; paused = true; stickerModal(); });
  $('menuBtn').addEventListener('click', menuModal);
  addEventListener('resize', () => drawGraph());
  document.body.classList.toggle('reduced', prefs.reduced);
  setSound(prefs.sound);
  setNarrator(prefs.narrator, true);

  // --- First tap: unlock sound and speech, then the start screen talks ---------------------------
  function splash() {
    openModal(`<div class="splash"><h2>Blow Up <span class="zh" lang="zh-TW">${rubyZh(CT.STR.titleZh, CT.STR.titlePy)}</span></h2>
      <button class="bigplay" type="button" id="splashGo" aria-label="Start">▶</button>
      <p class="tagline">${CT.STR.tagline}</p>
      <p class="note">Turn your sound on. A storyteller will explain everything out loud.</p>
      <p class="beta-note"><span class="beta">Beta</span> For grown-ups: this game is new and still being tested with kids, so things may change. <a href="../feedback/?game=blow-up&amp;v=${VERSION}">Tell us what you think</a>.</p></div>`, null, { noClose: true });
    $('splashGo').addEventListener('click', () => {
      N.unlocked = true; audioInit(); voiceInit();
      try { speechSynthesis.speak(new SpeechSynthesisUtterance(' ')); } catch (e) { /* no speech */ }   // wakes speech on iPad
      closeModal(); startScreen();
    });
  }

  // --- The tour: the storyteller points at each part of the screen ---------------------------------
  let touring = false;
  function tour() {
    if (!prefs.narrator) setNarrator(true, true);
    N.unlocked = true; stopSpeech();
    touring = true; $('narrSkip').hidden = false;
    const steps = CT.NARR.tour;
    steps.forEach(([sel, text], i) => {
      const el = document.querySelector(sel);
      say(text, 'narr', { prio: 2, hold: true, onstart: () => { scrollIntoViewIfNeeded(el); spotOn(el); }, onend: () => { spotOff(el); if (i === steps.length - 1) endTour(); } });
    });
  }
  function endTour() { touring = false; $('narrSkip').hidden = true; store.set('tourDone', true); document.querySelectorAll('.spot').forEach(spotOff); }
  function scrollIntoViewIfNeeded(el) {
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.top < 0 || r.bottom > innerHeight) try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { /* ignore */ }
  }
  $('narrSkip').addEventListener('click', () => {
    stopSpeech(); endTour();
    const line = S && (CT.NARR_SCENES[S.styleId] || {})[S.scene.id];
    if (line) say(line, 'narr', { prio: 2, hold: true });
  });
  $('tourBtn').addEventListener('click', () => { if (!isModal() && S) { audioInit(); tour(); } });

  // --- Tap anything to hear about it ----------------------------------------------------------------
  function explainPip() {
    const v = SIM.view(S);
    const bits = [];
    const M = CT.NARR.misc;
    if (S.done) bits.push(M.asleep);
    else if (v.phase !== 'day') bits.push(CT.NARR.feel.storm);
    else if (v.flat) bits.push(CT.NARR.feel.flat);
    else if (v.masking && v.zone !== 'green') bits.push(CT.NARR.feel.masked);
    else bits.push(CT.NARR.feel[v.zone === 'blowup' ? 'red' : v.zone]);
    if (!S.done && v.ratio > 0.2) bits.push(CT.NARR.because[SIM.dominant(S)]);
    if (!S.done && v.hungry) bits.push(M.hungry);
    if (!S.done && v.tired) bits.push(M.tired);
    if (!S.done && v.sock) bits.push(M.sock);
    say(bits, 'narr', { interrupt: true });
  }
  function explainBucket() {
    const v = SIM.view(S);
    const lv = CT.NARR.bucketLevel[v.ratio >= 1 ? 4 : v.ratio >= 0.75 ? 3 : v.ratio >= 0.4 ? 2 : v.ratio >= 0.12 ? 1 : 0];
    const top = SIM.dominant(S);
    say(v.ratio > 0.12 ? [lv, fill(CT.NARR.mostDrops, { x: CT.LOADS[top].name.toLowerCase() }), CT.NARR.because[top]] : [lv], 'narr', { interrupt: true });
  }
  function explainTime() {
    const h = 7 + Math.floor(S.t / 60), m = S.t % 60;
    const hh = h > 12 ? h - 12 : h, part = h < 12 ? 'in the morning' : h < 17 ? 'in the afternoon' : 'in the evening';
    const hr = Math.min(20, h + (m > 40 ? 1 : 0));
    say(fill(CT.NARR.clock, { h: CT.NARR.hours[hr - 7], part: hr < 12 ? 'in the morning' : hr < 17 ? 'in the afternoon' : 'in the evening' }), 'narr', { interrupt: true });
  }
  $('sceneWrap').addEventListener('click', e => {
    if (!S || isModal()) return;
    N.unlocked = true;
    if (e.target.closest('#kidWrap')) return explainPip();
    if (e.target.closest('#adult')) return say(CT.NARR.adult[S.adult < 35 ? 'calm' : S.adult > 60 ? 'stressed' : 'mid'], 'narr', { interrupt: true });
    if (e.target.closest('#controlRoom')) { const v = SIM.view(S); return say(CT.NARR.head[v.phase === 'eruption' || v.phase === 'cooling' ? 'storm' : v.ratio > 0.4 ? 'bark' : 'calm'], 'narr', { interrupt: true }); }
    if (e.target.closest('#pickle')) return;
    explainPip();
  });
  document.querySelector('.bucket-card').addEventListener('click', () => { if (S && !isModal()) { N.unlocked = true; explainBucket(); } });
  document.querySelector('.clock').addEventListener('click', () => { if (S && !isModal()) { N.unlocked = true; explainTime(); } });

  // --- Boot -----------------------------------------------------------------------------------------
  function coverState() {
    newDay('rushed', 11);
    $('grown').hidden = true;
    for (let i = 0; i < 180; i++) { SIM.step(S); if (S.pending) { if (S.pending.kind === 'say') SIM.choose(S, 'control'); } S.events.length = 0; }
    ['sock', 'loud', 'toy', 'hungry', 'bluecup', 'tower'].forEach(id => SIM.use(S, id));
    S.events.length = 0;
    tick(true);
    if (S.phase !== 'eruption') { SIM.add(S, 'thinking', Math.max(0, SIM.threshold(S) * 1.02 - SIM.pressure(S)), 'Tower falls', 'life'); SIM.blowUp(S, {}); }
    const b = S.blowups[S.blowups.length - 1]; b.type = 'volcano';
    S.events.length = 0; blowupFX(b); tick(true);
    running = false;
    kidBubble('KABOOM!');
    const el = $('pickle');
    el.innerHTML = `<button class="pk" type="button">${pickleSVG()}</button><div class="pk-bubble"><b>Professor Pickle:</b> Little things add up, like drops in a bucket.</div>`; el.hidden = false;
    setInterval(() => { burst(KID_X, FLOOR - 225, ['✦'], 6, 1.6, { up: true, colors: GLITTER, size: 18 }); }, 120);
  }

  $('brain').innerHTML = brainSVG();
  // Test hook (only with #debug): fast-forward whole minutes through the real UI path.
  if (location.hash === '#debug') window.BUDebug = {
    voice: () => VB.stats, state: () => S,
    ff(n) { for (let i = 0; i < n && S && !S.done && !S.pending; i++) { SIM.step(S); handleEvents(); } tick(true); return SIM.view(S).clock; },
    // Read-only, for tests/smoke.mjs to see why the frame loop isn't advancing.
    loop: () => ({ running, paused, freezeUntil, now: performance.now(), narrHolding: narrHolding(), isModal: isModal(), narrator: prefs.narrator, unlocked: N.unlocked, qLen: N.q.length, cur: N.cur && { hold: N.cur.hold, text: N.cur.text } }),
  };
  requestAnimationFrame(frame);
  if (COVER) coverState();
  else { newDay(prefs.style, 5); running = false; splash(); }
