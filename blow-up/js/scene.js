'use strict';
  // ============================================================================================
  // SCENE
  // ============================================================================================
  function buildScene(v) {
    const sc = v.scene, loc = v.loc, room = sc.room || (loc === 'classroom' ? 'class' : '');
    const key = sc.id + '|' + loc + '|' + skyFor(S.t)[0];
    if (key === lastSceneKey) return;
    const newScene = lastSceneKey.split('|')[0] !== sc.id;
    lastSceneKey = key;
    const k = S.kid;
    const adultKind = loc === 'classroom' ? 'teacher' : 'parent';
    const fg = loc === 'classroom' && room !== 'lunch' ? `<g><rect x="${KID_X - 70}" y="352" width="140" height="14" rx="4" fill="#9A6B45"/><rect x="${KID_X - 62}" y="366" width="124" height="40" fill="#B98457"/><rect x="${KID_X - 30}" y="332" width="60" height="22" rx="3" fill="#FFFFFF"/><path d="M${KID_X - 22} 340 h36 M${KID_X - 22} 346 h28" stroke="#9A8791" stroke-width="2"/></g>` : '';
    $('scene').innerHTML = `<g id="bg" class="${loc === 'bus' || loc === 'car' ? 'bumpy' : ''}">${background(loc, room, sc.id, S.t)}</g>
      <g id="props">${loc === 'home' && room !== 'bath' ? petSVG() : ''}</g>
      <g id="waves"></g>
      <g transform="translate(${ADULT_X} ${FLOOR})"><g id="adultMove"><g class="adult-bob">${adultSVG(adultKind)}</g></g></g>
      <g id="strings"></g>
      <g id="kidWrap" transform="translate(${KID_X} ${FLOOR})"><g id="kidWalk"><g id="kidReact">${kidSVG(k)}</g></g></g>
      <g id="fg">${fg}</g>
      <g id="fx"></g><g id="parts"></g>
      <rect id="night" width="800" height="450" fill="#0B1230" opacity="0" pointer-events="none"/>`;
    const L = CT.LOCATIONS[loc];
    $('sceneLabel').innerHTML = esc(sc.label) + (L && L.masking ? ' <span class="mask">🎭 calm outside, filling inside</span>' : '');
    $('sceneWrap').style.background = skyFor(S.t)[0];
    lastStrings = -1;
    if (S.phase === 'eruption' && lastBlow) blowupFX(lastBlow, true);   // keep the eruption on screen after a scene change
    applyKidClasses(v, true);
    mouthBase = {}; renderAvatar();
    // A new place: the picture opens like an iris, and Pip walks in when going somewhere.
    if (newScene && !COVER && !reducedMotion()) {
      replay($('scene'), 'iris');
      if (['walk', 'field', 'playground', 'bus', 'car', 'classroom'].includes(loc) || sc.id === 'bath' || sc.id === 'bed') replay($('kidWalk'), 'walkin');
    }
  }
  const reducedMotion = () => prefs.reduced || matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Restart a CSS animation class (works for SVG and HTML).
  function replay(el, cls, ms) {
    if (!el) return;
    el.classList.remove(cls); void el.getBoundingClientRect(); el.classList.add(cls);
    clearTimeout(el['_t' + cls]); el['_t' + cls] = setTimeout(() => el.classList.remove(cls), ms || 1300);
  }

  function applyKidClasses(v, force) {
    const kid = $('kid'); if (!kid) return;
    const cls = [];
    if (v.phase === 'eruption' && lastBlowType) cls.push('bu-' + lastBlowType);
    else if (v.zone === 'red' && !v.masking) cls.push('shake');
    else if (v.strings > 0) cls.push('puppet');
    else if (v.zone === 'green' || v.masking) cls.push('bob');
    const c = cls.join(' ');
    if (force || kid.getAttribute('class') !== c) kid.setAttribute('class', c);
  }

  function setKidFace(v) {
    const kid = $('kid'); if (!kid) return;
    const sleeping = S.done;
    let face = v.zone === 'blowup' ? 'red' : v.zone;
    if (v.masking && face !== 'green') face = 'green';                    // calm outside
    if (v.phase === 'eruption') face = 'erupt';
    else if (v.phase === 'cooling') face = 'sad';
    else if (v.phase !== 'day') face = 'soft';
    if (v.flat && v.phase === 'day') face = 'flat';
    if (sleeping) face = 'sleep';
    const M = {
      green: 'M-14 -136 Q0 -124 14 -136', yellow: 'M-14 -132 q7 -4 14 0 q7 4 14 0', red: 'M-15 -126 Q0 -140 15 -126',
      erupt: 'M-17 -134 Q0 -150 17 -134 Q0 -106 -17 -134Z', sad: 'M-12 -128 Q0 -136 12 -128', soft: 'M-10 -134 Q0 -128 10 -134', flat: 'M-10 -132 H10', sleep: 'M-8 -134 Q0 -130 8 -134',
    };
    const BL = { red: 'M-26 -182 l18 8', erupt: 'M-26 -186 l18 10', yellow: 'M-24 -178 q8 -2 16 2', sad: 'M-24 -172 q8 -6 16 -6' };
    const BR = { red: 'M26 -182 l-18 8', erupt: 'M26 -186 l-18 10', yellow: 'M8 -176 q8 -4 16 -2', sad: 'M8 -178 q8 0 16 6' };
    const mouthD = (face === 'yellow' || face === 'green' && v.masking && v.zone !== 'green') ? M.yellow : M[face], mouthFill = face === 'erupt' ? '#3A2A33' : 'none';
    if (mouthBase.mouth) mouthBase.mouth = { d: mouthD, fill: mouthFill };
    else { $('mouth').setAttribute('d', mouthD); $('mouth').setAttribute('fill', mouthFill); }
    if (!$('brows').classList.contains('brows-launch')) {
      $('browL').setAttribute('d', BL[face] || 'M-24 -176 q8 -5 16 0');
      $('browR').setAttribute('d', BR[face] || 'M8 -176 q8 -5 16 0');
    }
    const hot = face === 'erupt' ? 0.5 : face === 'red' ? 0.3 : face === 'yellow' ? 0.08 : 0;
    $('faceHeat').setAttribute('opacity', hot);
    $('frizz').setAttribute('opacity', face === 'erupt' || face === 'red' ? 1 : 0);
    $('steam').setAttribute('opacity', face === 'erupt' || (face === 'red' && v.ratio > 0.88) ? 1 : 0);
    const angryBlow = v.phase === 'eruption' && lastBlowType === 'hangry';
    $('teeth').setAttribute('opacity', angryBlow ? 1 : 0);
    $('tummy').setAttribute('opacity', v.hungry && v.phase === 'day' && !sleeping ? 1 : 0);
    $('sockFlag').setAttribute('opacity', v.sock ? 0.9 : 0);
    const shut = sleeping || (v.tired && Math.floor(S.t / 3) % 5 === 0);
    $('eyes').setAttribute('opacity', shut ? 0 : 1); $('eyesShut').setAttribute('opacity', shut ? 1 : 0);
    const fists = face === 'red' || face === 'erupt';
    $('handL').setAttribute('r', fists ? 8 : 11); $('handR').setAttribute('r', fists ? 8 : 11);
    kid.style.filter = face === 'flat' ? 'saturate(.15) brightness(1.05)' : (face === 'erupt' && lastBlowType === 'hangry' ? 'hue-rotate(60deg) saturate(1.4)' : '');
    // The grown-up's face follows their own bucket.
    const am = $('adultMouth'); if (am) {
      const st = S.adult;
      const ad = st < 35 ? 'M-11 -212 Q0 -202 11 -212' : st > 60 ? 'M-11 -206 Q0 -214 11 -206' : 'M-10 -209 H10';
      if (mouthBase.adultMouth) mouthBase.adultMouth = { d: ad, fill: 'none' }; else am.setAttribute('d', ad);
      $('adultBrows').setAttribute('d', st > 60 ? 'M-22 -250 l16 5 M22 -250 l-16 5' : 'M-22 -246 q9 -4 18 0 M4 -246 q9 -4 18 0');
      $('adultSweat').setAttribute('opacity', st > 60 ? 1 : 0);
    }
  }

  function drawStrings(v) {
    const g = $('strings'); if (!g) return;
    const n = v.phase === 'day' ? v.strings : 0;
    if (n === lastStrings) return;
    if (lastStrings > 0 && n < lastStrings) { SND.snip(); burst(KID_X, 150, ['✂️'], 1, 1.4); say(CT.NARR.snip, 'narr', { prio: 0 }); }
    if (n > 0 && lastStrings === 0 && running) once('strings', () => say(CT.NARR.strings, 'narr', { prio: 2, hold: true }));
    lastStrings = n;
    if (!n) { g.innerHTML = ''; return; }
    const targets = [[KID_X, FLOOR - 206], [KID_X - 52, FLOOR - 58], [KID_X + 52, FLOOR - 58], [KID_X - 16, FLOOR - 10]];
    let s = `<g class="puppet"><rect x="${KID_X - 70}" y="18" width="140" height="10" rx="5" fill="#8A5A3B"/><rect x="${KID_X - 5}" y="4" width="10" height="40" rx="5" fill="#8A5A3B"/></g>`;
    for (let i = 0; i < n; i++) { const [x, y] = targets[i]; s += `<line x1="${KID_X - 60 + i * 40}" y1="26" x2="${x}" y2="${y}" stroke="#F6F0DC" stroke-width="2.5"/><line x1="${KID_X - 60 + i * 40}" y1="26" x2="${x}" y2="${y}" stroke="#6B5560" stroke-width="1" stroke-dasharray="4 4"/>`; }
    g.innerHTML = s;
  }

  function drawWaves(v) {
    const g = $('waves'); if (!g) return;
    const w = v.phase === 'day' || v.phase === 'learn' ? v.wave : (S.adult < 45 ? 'blue' : S.adult > 60 ? 'red' : null);
    const key = w || 'none';
    if (g.dataset.w === key) return;
    g.dataset.w = key;
    if (!w) { g.innerHTML = ''; return; }
    const col = w === 'blue' ? '#3F93E0' : '#E0493E';
    let s = '';
    for (let i = 0; i < 3; i++) s += `<path class="wave-arc" style="--wx:${KID_X - ADULT_X - 110}px;animation-delay:${i * 0.5}s" d="M${ADULT_X + 50} 250 q18 30 0 60" stroke="${col}"/>`;
    g.innerHTML = s;
    if (running && S.phase === 'day') once('waves-' + w, () => say(w === 'blue' ? CT.NARR.wavesBlue : CT.NARR.wavesRed, 'narr', { prio: 1 }));
    if (!pickleSeen.coreg) pickle('waves');
  }

  // --- Control room -------------------------------------------------------------------------------
  let owlState = 'chair', barkText = 0;
  function drawBrain(v) {
    const dog = $('dogBody'), bark = $('dogBark');
    const barking = !v.dogQuiet && (v.ratio > 0.4 || v.phase === 'eruption') && !S.done;
    bark.setAttribute('opacity', barking ? 1 : 0);
    dog.setAttribute('class', barking ? 'dog-bark' : '');
    $('dogZ').setAttribute('opacity', v.dogQuiet || S.done ? 1 : 0);
    if (barking && barkText <= 0) {
      const silly = v.zone === 'yellow' && Math.random() < 0.08;
      $('dogText').textContent = silly ? ['WOOF! (a sock!)', 'WOOF! (broccoli!)', 'WOOF! (a leaf!)'][Math.floor(Math.random() * 3)] : v.ratio > 0.75 || v.phase === 'eruption' ? 'WOOF WOOF!!' : 'woof!';
      $('dogText').setAttribute('font-size', v.ratio > 0.75 ? 14 : 11);
      barkText = silly ? 6 : 2;
    }
    barkText--;
    const owl = $('owl');
    if (v.phase === 'eruption' || v.phase === 'cooling') {
      if (owlState === 'chair') { owlState = 'fallen'; owl.setAttribute('class', 'owl-fall-' + Math.min(3, S.blowups.length)); }
    } else if (owlState === 'fallen') { owlState = 'chair'; owl.setAttribute('class', 'owl-climb'); }
    if (owlState === 'chair') {
      const lean = v.phase === 'day' ? Math.min(1, v.ratio) : 0.1;
      $('owlWrap').setAttribute('transform', `translate(${128 + lean * 8} ${44 + lean * 6}) rotate(${lean * 28})`);
    }
    $('owlYawn').setAttribute('opacity', v.tired && Math.floor(S.t / 4) % 3 === 0 ? 1 : 0);
    const bd = (id, on, fast) => { const el = $(id); el.classList.toggle('on', on); el.classList.toggle('fast', !!fast); };
    const r = v.phase === 'day' ? v.ratio : Math.max(v.ratio, v.adrenaline / 100);
    bd('bdHeart', r > 0.4, r > 0.75 || v.adrenaline > 40); bd('bdBreath', r > 0.55); bd('bdFace', r > 0.7); bd('bdFist', r > 0.8);
  }

  // --- Particles (glitter, sparks, hearts, ping-pong balls) ----------------------------------------
  const parts = [];
  function burst(x, y, glyphs, n, speed, opts) {
    opts = opts || {};
    const reduced = prefs.reduced || matchMedia('(prefers-reduced-motion: reduce)').matches;
    n = reduced ? Math.min(n, 3) : n;
    for (let i = 0; i < n; i++) {
      const a = opts.up ? -Math.PI / 2 + (Math.random() - 0.5) * 1.6 : Math.random() * Math.PI * 2, sp = (0.6 + Math.random()) * (speed || 1) * 4;
      parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (opts.up ? 3 : 0), g: glyphs[i % glyphs.length], life: 60 + Math.random() * 40, size: opts.size || 20, grav: opts.grav == null ? 0.15 : opts.grav, color: opts.colors ? opts.colors[i % opts.colors.length] : null });
    }
  }
  function stepParts() {
    const g = $('parts'); if (!g) return;
    let s = '';
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.x += p.vx; p.y += p.vy; p.vy += p.grav; p.life--;
      if (p.life <= 0 || p.y > 470) { parts.splice(i, 1); continue; }
      const o = Math.min(1, p.life / 20);
      s += p.color ? `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${(p.size / 5).toFixed(1)}" fill="${p.color}" opacity="${o}"/>`
        : `<text x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}" font-size="${p.size}" text-anchor="middle" opacity="${o}">${p.g}</text>`;
    }
    g.innerHTML = s;
  }
  const GLITTER = ['#F2C641', '#EC6FA8', '#3F93E0', '#5FB86A', '#E0493E', '#8F6BD9', '#FFFFFF'];

  // --- Blow-up effects -----------------------------------------------------------------------------
  let lastBlow = null;
  function blowupFX(b, quiet) {
    const fx = $('fx'); if (!fx) return;
    lastBlowType = b.type; lastBlow = b;
    const hx = KID_X, hy = FLOOR - 200;
    let s = '';
    if (b.type === 'volcano') s = `<path d="M${KID_X - 110} ${FLOOR} L${KID_X - 40} ${FLOOR - 118} L${KID_X + 40} ${FLOOR - 118} L${KID_X + 110} ${FLOOR}Z" fill="#8A5A3B"/><path d="M${KID_X - 40} ${FLOOR - 118} q20 18 40 0 q20 18 40 0" fill="#E0493E"/><path d="M${KID_X - 70} ${FLOOR - 50} q20 -10 40 4 M${KID_X + 30} ${FLOOR - 80} q20 -6 30 10" stroke="#6E4630" stroke-width="5" fill="none"/>`;
    if (b.type === 'tornado') s = `<g opacity=".7" stroke="#9A8791" stroke-width="6" fill="none" stroke-linecap="round"><ellipse cx="${KID_X}" cy="${FLOOR - 200}" rx="90" ry="16"/><ellipse cx="${KID_X}" cy="${FLOOR - 140}" rx="70" ry="13"/><ellipse cx="${KID_X}" cy="${FLOOR - 80}" rx="50" ry="10"/><ellipse cx="${KID_X}" cy="${FLOOR - 30}" rx="30" ry="8"/></g>`;
    if (b.type === 'gavel') s = `<g transform="translate(${KID_X} ${FLOOR - 212})"><circle cx="-34" cy="0" r="12" fill="#fff"/><circle cx="-18" cy="-8" r="12" fill="#fff"/><circle cx="0" cy="-10" r="12" fill="#fff"/><circle cx="18" cy="-8" r="12" fill="#fff"/><circle cx="34" cy="0" r="12" fill="#fff"/><circle cx="-40" cy="18" r="11" fill="#fff"/><circle cx="40" cy="18" r="11" fill="#fff"/></g>
      <g transform="translate(${KID_X + 60} ${FLOOR - 70})" class="shake"><rect x="-4" y="-40" width="8" height="44" rx="3" fill="#8A5A3B"/><rect x="-18" y="-54" width="36" height="18" rx="6" fill="#6E4630"/></g>
      <text x="${KID_X + 110}" y="${FLOOR - 130}" font-family="Baloo 2, sans-serif" font-weight="800" font-size="26" fill="#6C4B8C">ORDER!</text>`;
    if (b.type === 'whistle') s = `<g opacity=".9" fill="#FFFFFF"><circle cx="${KID_X - 80}" cy="${FLOOR - 170}" r="22"/><circle cx="${KID_X - 110}" cy="${FLOOR - 190}" r="16"/><circle cx="${KID_X + 80}" cy="${FLOOR - 170}" r="22"/><circle cx="${KID_X + 110}" cy="${FLOOR - 190}" r="16"/></g>
      <text x="${KID_X}" y="${FLOOR - 250}" text-anchor="middle" font-family="Baloo 2, sans-serif" font-weight="800" font-size="24" fill="#8F6BD9">TOOOOOT!</text>`;
    if (b.type === 'noodle') s = `<text x="${KID_X}" y="${FLOOR - 130}" text-anchor="middle" font-size="34">🍜</text>`;
    if (b.type === 'hangry') s = `<text x="${KID_X}" y="${FLOOR - 250}" text-anchor="middle" font-family="Baloo 2, sans-serif" font-weight="800" font-size="28" fill="#4E8A3F">GRRR… FOOD!</text>`;
    s += b.lastStraw ? `<text x="${KID_X + 100}" y="${FLOOR - 60}" font-size="30">🍪</text>` : '';
    fx.innerHTML = s;
    if (quiet) return;
    if (!reducedMotion()) { replay($('sceneWrap'), 'quake', 700); replay($('flash'), 'go', 600); replay($('bucket'), 'splash', 400); }
    $('brows').classList.add('brows-launch');
    if (b.type === 'volcano') burst(hx, FLOOR - 120, ['✦'], 70, 1.6, { up: true, colors: GLITTER, size: 18 });
    else burst(hx, hy + 30, ['💢', '✨', '💥'], 16, 1.4, { size: 26 });
    if ($('pet')) $('pet').classList.add('hide-couch');
    if (S.loc === 'home') setTimeout(() => burst(KID_X + 40, FLOOR - 120, ['🛋️'], 1, 1.2, { size: 30, grav: 0.2 }), 500);
    if (lastStrings > 0) { burst(KID_X, 40, ['〰️'], 6, 1.5, { size: 22 }); }
    SND.boom();
  }
  function clearBlowupFX() {
    if ($('fx')) $('fx').innerHTML = '';
    if ($('brows')) $('brows').classList.remove('brows-launch');
    if ($('pet')) $('pet').classList.remove('hide-couch');
  }

  // --- Thought bubbles --------------------------------------------------------------------------------
  let bubbleTimer = 0, adultBubbleTimer = 0;
  function kidSay(text, prio, interrupt) { say(text, 'pip', { prio: prio == null ? 1 : prio, interrupt: !!interrupt }); }
  function kidBubble(text, kind, prio) {
    if (!text) return;
    const b = $('bubble');
    b.textContent = text; b.className = 'bubble' + (kind ? ' ' + kind : '');
    b.style.left = (KID_X / 800 * 100) + '%'; b.style.top = ((FLOOR - 222) / 450 * 100) + '%';
    b.hidden = false; b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
    clearTimeout(bubbleTimer); bubbleTimer = setTimeout(() => { b.hidden = true; }, 3200);
    if (prio !== -1) kidSay(text, prio == null ? 0 : prio);
  }
  function adultBubble(text) {
    if (!text) return;
    const b = $('bubbleAdult');
    b.textContent = text;
    b.style.left = (ADULT_X / 800 * 100) + '%'; b.style.top = ((FLOOR - 282) / 450 * 100) + '%';
    b.hidden = false; b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
    clearTimeout(adultBubbleTimer); adultBubbleTimer = setTimeout(() => { b.hidden = true; }, 3000);
    say(text, 'adult', { prio: 1 });
  }

