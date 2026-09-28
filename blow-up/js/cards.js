'use strict';
  // ============================================================================================
  // TRAYS, DRAG AND DROP
  // ============================================================================================
  function cardBtn(c) {
    const lv = c.skill && S ? '★'.repeat(S.skills[c.skill].level) : '';
    return `<button class="cardbtn${stickers.has(c.id) ? '' : ' new'}" type="button" data-id="${c.id}" aria-label="${esc(c.name)}"><span class="ic" aria-hidden="true">${c.icon}</span><span class="nm">${esc(c.name)}</span>${lv ? `<span class="lv" title="Skill level">${lv}</span>` : ''}</button>`;
  }
  function buildTrays() {
    $('cardsUhoh').innerHTML = CT.UHOH.map(cardBtn).join('');
    $('cardsHelp').innerHTML = CT.HELPERS.map(cardBtn).join('');
    $('cardsTools').innerHTML = [...CT.TOOLS, cardById.lecture].map(cardBtn).join('');
  }
  let trayPhase = '';
  function updateTrays(v) {
    const storm = v.phase !== 'day';
    if (trayPhase !== v.phase) {
      trayPhase = v.phase;
      $('trayUhoh').hidden = storm; $('trayTools').hidden = !storm;
      document.querySelector('.trays').classList.toggle('storm', storm);
      $('toolsTip').textContent = storm ? CT.PHASES[v.phase].tip : '';
      const rib = $('phaseRibbon'); rib.hidden = !storm;
      if (storm) {
        const order = ['eruption', 'cooling', 'reconnect', 'repair', 'learn'], at = order.indexOf(v.phase);
        rib.innerHTML = order.map((p, i) => `<span class="${i === at ? 'on' : i < at ? 'done' : ''}">${i < at ? '✓ ' : ''}${CT.PHASES[p].kid}</span>`).join('');
      }
    }
    // Grey out tools that can't work right now (only after a blow-up: the lesson is matching tool to phase).
    document.querySelectorAll('#cardsHelp .cardbtn, #cardsTools .cardbtn').forEach(b => {
      const st = storm ? SIM.toolStatus(S, b.dataset.id) : 'good';
      b.classList.toggle('weak', st !== 'good');
    });
  }

  let drag = null;
  function onDown(e) {
    const b = e.target.closest('.cardbtn'); if (!b || !S || !running) return;
    e.preventDefault();
    drag = { id: b.dataset.id, x: e.clientX, y: e.clientY, moved: false, btn: b };
    try { b.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  }
  function onMove(e) {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) > 8) {
      drag.moved = true;
      const g = $('ghost'); g.textContent = cardById[drag.id].icon; g.hidden = false;
      audioInit(); say(plain(cardById[drag.id].name), 'narr', { prio: 0 });
    }
    if (drag.moved) {
      const g = $('ghost'); g.style.left = e.clientX + 'px'; g.style.top = e.clientY + 'px';
      const r = $('sceneWrap').getBoundingClientRect();
      $('sceneWrap').classList.toggle('drop-hot', e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom);
    }
  }
  function onUp(e) {
    if (!drag) return;
    const d = drag; drag = null;
    $('ghost').hidden = true; $('sceneWrap').classList.remove('drop-hot');
    const r = $('sceneWrap').getBoundingClientRect();
    const inScene = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (!d.moved || inScene) tryUse(d.id);             // a tap works too, for small hands
  }
  document.addEventListener('pointerdown', e => { if (e.target.closest('.trays')) onDown(e); });
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
  document.addEventListener('pointercancel', () => { drag = null; $('ghost').hidden = true; $('sceneWrap').classList.remove('drop-hot'); });
  document.querySelector('.trays').addEventListener('keydown', e => { const b = e.target.closest('.cardbtn'); if (b && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); tryUse(b.dataset.id); } });

  // --- One card at a time -------------------------------------------------------------------------
  // A tapped card flies to Pip. More taps on the same card while it flies add up to one bigger
  // (but diminishing) go: "×3". A different card waits its turn; beyond that, taps just wiggle.
  const ACT = { cur: null, next: null };
  const cardEl = id => document.querySelector(`.cardbtn[data-id="${id}"]`);
  function tryUse(id) {
    if (!S || S.done || S.pending || isModal()) return;
    audioInit(); voiceInit(); N.unlocked = true;
    if (ACT.cur && ACT.cur.id === id && !ACT.cur.landed) return bump(ACT.cur);
    if (ACT.next && ACT.next.id === id) return bump(ACT.next);
    if (ACT.cur) {
      if (!ACT.next) { ACT.next = { id, count: 1 }; const b = cardEl(id); if (b) b.classList.add('queued'); }
      else nope(id);
      return;
    }
    start(id, 1);
  }
  function bump(a) {
    if (a.count >= 5) return nope(a.id);
    a.count++; showCombo(a.id, a.count); SND.clink();
  }
  function nope(id) { const b = cardEl(id); if (b) replay(b, 'nope', 400); tone(180, 0.12, 'triangle', 0.08); }
  function showCombo(id, n) {
    const b = cardEl(id); if (!b) return;
    let c = b.querySelector('.combo');
    if (n < 2) { if (c) c.remove(); return; }
    if (!c) { c = document.createElement('span'); c.className = 'combo'; b.appendChild(c); }
    c.textContent = '×' + n; c.style.animation = 'none'; void c.offsetWidth; c.style.animation = '';
  }
  function start(id, count, guess) {
    if (prefs.predict && !guess) return askPredict(id, count);
    if (id === 'breathe' && !guess) return breathingGuide(() => launch(id, count));
    launch(id, count, guess);
  }
  function launch(id, count, guess) {
    const a = ACT.cur = { id, count, guess, landed: false };
    const b = cardEl(id); if (b) b.classList.add('flying');
    showCombo(id, count);
    say(plain(cardById[id].name), 'narr', { prio: 0 });
    flyCard(id, () => {
      a.landed = true;
      if (b) { b.classList.remove('flying'); showCombo(id, 1); }
      if (S && !S.done) doUse(a.id, a.guess, a.count);
      setTimeout(() => {                                   // a short breath before the next card
        ACT.cur = null;
        const n = ACT.next; ACT.next = null;
        if (n) { const nb = cardEl(n.id); if (nb) nb.classList.remove('queued'); if (S && !S.done && !S.pending && !isModal()) start(n.id, n.count); }
      }, 700);
    });
  }
  // Where things are on screen, for flying effects.
  function scenePoint(x, y) { const r = $('scene').getBoundingClientRect(); return { x: r.left + x / 800 * r.width, y: r.top + y / 450 * r.height }; }
  function bucketPoint(frac) { const r = $('bucket').getBoundingClientRect(); return { x: r.left + r.width * 0.54, y: r.top + r.height * (frac == null ? 0.12 : frac) }; }
  function flyCard(id, done) {
    const b = cardEl(id), c = cardById[id];
    if (!b || reducedMotion()) return setTimeout(done, 60);
    const r = b.getBoundingClientRect(), t = scenePoint(KID_X, FLOOR - 150);
    const x0 = r.left + r.width / 2, y0 = r.top + r.height / 2, mx = (x0 + t.x) / 2, my = Math.min(y0, t.y) - 110;
    const el = document.createElement('div'); el.className = 'flyer'; el.textContent = c.icon; document.body.appendChild(el);
    SND.whoosh();
    const anim = el.animate([
      { transform: `translate(${x0}px, ${y0}px) scale(1)` },
      { transform: `translate(${mx}px, ${my}px) scale(1.6) rotate(-18deg)`, offset: 0.5 },
      { transform: `translate(${t.x}px, ${t.y}px) scale(.7) rotate(12deg)`, opacity: 0.3 },
    ], { duration: 560, easing: 'cubic-bezier(.4, 0, .7, 1)' });
    anim.onfinish = () => { el.remove(); done(); };
  }
  // Drops fly out of Pip into the bucket, or bubbles float up out of the bucket.
  function dropsToBucket(type, n) {
    if (reducedMotion()) { dropInto(type); return; }
    const from = scenePoint(KID_X, FLOOR - 170), to = bucketPoint(0.1);
    for (let i = 0; i < n; i++) setTimeout(() => {
      const el = document.createElement('div'); el.className = 'fdrop'; el.style.background = CT.LOADS[type].color; document.body.appendChild(el);
      const mx = (from.x + to.x) / 2 + (Math.random() - 0.5) * 60, my = Math.min(from.y, to.y) - 80 - Math.random() * 40;
      el.animate([
        { transform: `translate(${from.x}px, ${from.y}px) rotate(-45deg) scale(.6)` },
        { transform: `translate(${mx}px, ${my}px) rotate(-45deg) scale(1.2)`, offset: 0.45 },
        { transform: `translate(${to.x + (Math.random() - 0.5) * 30}px, ${to.y}px) rotate(-45deg) scale(1)` },
      ], { duration: 650, easing: 'ease-in' }).onfinish = () => { el.remove(); if (i === n - 1) { dropInto(type); replay($('bucket'), 'splash', 400); } };
    }, i * 70);
  }
  function bubblesOut(n) {
    if (reducedMotion()) return;
    const r = $('bucket').getBoundingClientRect();
    const surf = r.top + r.height * (yOf(SIM.pressure(S)) / 250);
    for (let i = 0; i < n; i++) setTimeout(() => {
      const el = document.createElement('div'); el.className = 'fbubble'; document.body.appendChild(el);
      const x = r.left + r.width * (0.35 + Math.random() * 0.4);
      el.animate([{ transform: `translate(${x}px, ${surf}px) scale(.5)`, opacity: 1 }, { transform: `translate(${x + (Math.random() - 0.5) * 40}px, ${surf - 90 - Math.random() * 40}px) scale(1.3)`, opacity: 0 }],
        { duration: 900, easing: 'ease-out' }).onfinish = () => el.remove();
    }, i * 90);
  }
  // Connection helpers: the grown-up walks over to Pip, then back.
  const CLOSE_CARDS = new Set(['hug', 'close', 'here', 'name', 'wish', 'squeeze', 'sorry', 'fix', 'plan', 'praise', 'tickle', 'choice', 'warn']);
  let adultBack = 0;
  function adultApproach(id) {
    const m = $('adultMove'); if (!m || reducedMotion()) return;
    const dist = id === 'hug' || id === 'squeeze' || id === 'tickle' ? KID_X - ADULT_X - 80 : KID_X - ADULT_X - 140;
    m.style.transform = `translateX(${dist}px)`; m.classList.add('walking');
    setTimeout(() => m.classList.remove('walking'), 600);
    if (id === 'hug') setTimeout(() => burst(KID_X - 40, FLOOR - 200, ['💗', '💞'], 8, 0.8, { size: 22, grav: -0.03 }), 600);
    clearTimeout(adultBack);
    adultBack = setTimeout(() => { m.style.transform = ''; m.classList.add('walking'); setTimeout(() => m.classList.remove('walking'), 600); }, 2400);
  }

  function doUse(id, guess, count) {
    count = count || 1;
    const c = cardById[id];
    const storm = S.phase !== 'day';
    const status = SIM.toolStatus(S, id);
    const first = !dayUsed.has(id);
    let res = null, total = 0;
    for (let i = 0; i < count; i++) { const r = SIM.use(S, id); if (!r) break; total += r.delta; res = res ? Object.assign(r, { bounced: res.bounced || r.bounced, backfire: res.backfire || r.backfire }) : r; }
    if (!res) return;
    res.delta = total; res.mood = total > 0.05 ? 'madder' : total < -0.05 ? 'calmer' : 'same';
    if (!stickers.has(id)) { stickers.add(id); store.set('stickers', [...stickers]); const b = cardEl(id); if (b) b.classList.remove('new'); burst(KID_X + 120, 80, ['⭐'], 1, 0.4, { size: 28, grav: 0.05 }); }
    dayUsed.add(id);
    if (id === 'hug' || id === 'stomp' || id === 'loud') discovered.add(id);
    const cn = CT.CARD_NARR[id] || {};
    const tired = res.habit < 0.55;                         // Pip is getting used to this card
    const name = count > 1 ? [plain(c.name), CT.NARR.times[count]] : null;
    dropGroup('card');                                      // this card's reaction replaces the last card's
    const react = cls => replay($('kidReact'), cls, 900);
    if (c.tray === 'uhoh') {
      SND.bonk(); react('flinch');
      dropsToBucket(c.type, Math.max(1, Math.min(8, Math.round(total / 2))));
      if (first && cn.first) say(cn.first, 'narr', { prio: 1, group: 'card' });
      else if (tired) say(CT.NARR.again.uhoh, 'narr', { prio: 1, group: 'card', dedupe: 20000 });
      else say(name || [CT.NARR.uhohWord, plain(c.name)], 'narr', { prio: 1, group: 'card' });
      if (res.bounced) { SND.pingpong(); burst(KID_X, FLOOR - 200, ['🏓'], 5, 1.2, { size: 20 }); }
      kidBubble(res.thought, null, 1);
      if (res.bounced) say(CT.NARR.bounce, 'narr', { prio: 2, group: 'card', dedupe: 20000 });
      if (res.anim === 'balloon' && $('kid')) { $('kid').setAttribute('class', 'balloon'); setTimeout(() => applyKidClasses(SIM.view(S), true), 1500); }
    } else {
      adultBubble(c.say);
      if (CLOSE_CARDS.has(id) && !res.backfire) adultApproach(id);
      if (res.bounced) {
        SND.pingpong(); burst(KID_X, FLOOR - 200, ['🏓'], 5, 1.2, { size: 20 }); react('flinch');
        setTimeout(() => kidBubble(res.thought, null, -1), 500); kidSay(res.thought, 2); say(CT.NARR.bounce, 'narr', { prio: 2, group: 'card', dedupe: 20000 });
      } else if (res.backfire) {
        SND.bonk(); react('flinch'); dropsToBucket(Object.keys(c.backfire || { social: 1 })[0], 3);
        setTimeout(() => kidBubble(res.thought, null, -1), 500); kidSay(res.thought, 2);
        say(cn.back || CT.NARR.misc.worse, 'narr', { prio: 2, group: 'card', dedupe: 20000 });
        if (res.anim === 'porcupine') burst(KID_X, FLOOR - 160, ['🦔'], 1, 0.3, { size: 44, grav: 0 });
      } else if (res.mood === 'calmer') {
        SND.chime(); react('relax'); bubblesOut(Math.max(2, Math.min(9, Math.round(-total / 1.5))));
        burst(KID_X, FLOOR - 160, ['💙', '✨'], 6, 0.7, { size: 18, grav: -0.02 });
        if (first && cn.first) say(cn.first, 'narr', { prio: 2, group: 'card' });
        else if (tired) say(CT.NARR.again.helper, 'narr', { prio: 1, group: 'card', dedupe: 20000 });
        else if (storm && status === 'weak') say(CT.NARR.weak, 'narr', { prio: 2, group: 'card', dedupe: 20000 });
        else if (name) say(name, 'narr', { prio: 1, group: 'card' });
      } else {
        burst(KID_X, FLOOR - 230, ['🤷'], 1, 0.2, { size: 28, grav: 0 });
        say(storm || c.tray === 'tool' ? CT.NARR.weak : (cn.first || CT.NARR.weak), 'narr', { prio: 2, group: 'card', dedupe: 20000 });
      }
    }
    if (guess) {
      const right = (guess === 'calmer' && res.mood === 'calmer') || (guess === 'madder' && res.mood === 'madder');
      predictScore.total++; if (right) predictScore.right++; store.set('predict', predictScore);
      setTimeout(() => burst(KID_X + 150, 120, [right ? '✅' : '❓'], 1, 0.2, { size: 36, grav: 0 }), 300);
      say(right ? CT.NARR.misc.guessRight : CT.NARR.misc.guessWrong, 'narr', { prio: 1 });
    }
    handleEvents();
    tick(true);
  }

