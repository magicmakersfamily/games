'use strict';
  // ============================================================================================
  // MODALS
  // ============================================================================================
  // One pop-up on screen at a time. The first one puts the game in MODAL and remembers what it
  // interrupted; closing the last one goes back to that. A pop-up opened from inside another (the
  // receipt's "Compare days", the menu's "Start a new day") replaces it on purpose. The bedtime
  // receipt opens on a timer, so it goes through whenModalFree() and waits its turn instead of
  // replacing whatever the child is looking at. Engine choices (Say It Differently) open only when
  // the phase is PLAY (main.js), so they never land on top of another pop-up.
  let modalOnClose = null, modalSeq = 0, phaseBeforeModal = 'PLAY';
  const modalWaiting = [];
  const isModal = () => !$('modal').hidden;
  function openModal(html, onClose, opts) {
    if (!isModal()) { phaseBeforeModal = phase; setPhase('MODAL'); }
    modalSeq++;
    $('sheet').innerHTML = (opts && opts.noClose ? '' : '<button class="x" type="button" data-close aria-label="Close">✕</button>') + html;
    $('modal').hidden = false; modalOnClose = onClose || null; modalHear = null;
    const f = $('sheet').querySelector('.go, button:not(.x)'); if (f) try { f.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  }
  function closeModal() {
    $('modal').hidden = true; $('sheet').innerHTML = ''; const f = modalOnClose; modalOnClose = null;
    setPhase(phaseBeforeModal);
    if (f) f();                                            // may open the next pop-up itself (predict → breathing)
    if (!isModal() && modalWaiting.length) modalWaiting.shift()();
  }
  function whenModalFree(open) { if (isModal()) modalWaiting.push(open); else open(); }
  $('modal').addEventListener('click', e => { if (e.target.closest('[data-close]')) closeModal(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && isModal() && $('sheet').querySelector('[data-close]')) closeModal();
    if (e.key === ' ' && !isModal() && e.target === document.body) { e.preventDefault(); togglePause(); }
  });

  function openPending() {
    const p = S.pending;
    if (p.kind === 'say') return sayModal(p);
    if (p.kind === 'pick') return pickModal(p);
    if (p.kind === 'validate') return validateModal(p.data);
  }

  function spotOn(el) { if (el) el.classList.add('spot'); }
  function spotOff(el) { if (el) el.classList.remove('spot'); }
  const hearBtn = '<button class="hear" type="button" data-hear aria-label="Hear it again">🔁</button>';
  let modalHear = null;
  $('modal').addEventListener('click', e => { if (e.target.closest('[data-hear]') && modalHear) { N.unlocked = true; stopSpeech(); modalHear(); } });

  function sayModal(p) {
    const sm = CT.SAYS[p.id];
    pickle('say');
    openModal(`<div class="row">${hearBtn}<h2>${sm.icon} How should the grown-up say it?</h2></div>
      <p class="note">Same result either way: <b>${esc(sm.done)}</b>. Watch the My Choice jar.</p>
      <div class="say-opts">
        <div class="say-opt control" data-how="control"><button class="choose" type="button"><span class="face">😤👉</span><span class="words">${esc(sm.control.text)}</span><span class="fx">Bossy</span></button><button class="hear" type="button" aria-label="Hear the bossy way">🔊</button></div>
        <div class="say-opt support" data-how="support"><button class="choose" type="button"><span class="face">🙂✌️</span><span class="words">${esc(sm.support.text)}</span><span class="fx">Gives a choice</span></button><button class="hear" type="button" aria-label="Hear the choosing way">🔊</button></div>
      </div>`, null, { noClose: true });
    const opts = { control: $('sheet').querySelector('[data-how="control"]'), support: $('sheet').querySelector('[data-how="support"]') };
    const read = how => say(sm[how].text, 'adult', { prio: 2, onstart: () => spotOn(opts[how]), onend: () => spotOff(opts[how]) });
    modalHear = () => {
      say(CT.NARR.sayIntro[p.id] || '', 'narr', { prio: 2 }); say(CT.NARR.sayAsk, 'narr', { prio: 2 });
      say(CT.NARR.misc.bossyWay, 'narr', { prio: 2 }); read('control'); say(CT.NARR.misc.choosingWay, 'narr', { prio: 2 }); read('support');
    };
    modalHear();
    for (const how of ['control', 'support']) {
      opts[how].querySelector('.hear').addEventListener('click', () => { stopSpeech(); read(how); });
      opts[how].querySelector('.choose').addEventListener('click', () => {
        stopSpeech();
        const out = SIM.choose(S, how);
        const good = how === 'support';
        adultBubble(sm[how].text);
        say(fill(good ? CT.NARR.saySupport : CT.NARR.sayControl, { done: out.outcome }), 'narr', { prio: 2, hold: true });
        const strings = SIM.strings(S);
        if (!good && strings) once('strings', () => say(CT.NARR.strings, 'narr', { prio: 2, hold: true }));
        $('sheet').innerHTML = `<div style="text-align:center;display:grid;gap:10px"><div style="font-size:64px">${sm.icon} ✔</div><h2>${esc(out.outcome)}!</h2>
          <p style="font-size:20px">${good ? '✋ My Choice jar: <b>+1 marble</b> 🟠' : '✋ My Choice jar: <b>−1 marble</b>' + (strings ? ' · a puppet string appears 🪢' : '')}</p></div>`;
        modalHear = null;
        good ? SND.chime() : SND.marbleLost();
        const mine = modalSeq;                             // close this pop-up only, never one that replaced it
        setTimeout(() => { if (modalSeq === mine && isModal()) closeModal(); handleEvents(); tick(true); }, COVER ? 0 : 2200);
      });
    }
  }

  function pickModal(p) {
    const opt = { playground: ['🛝', 'Playground', 'Slides, swings, other kids'], field: ['🌳', 'Field', 'Trees, mud, lots of room'] };
    openModal(`<div class="row">${hearBtn}<h2>Where should we go?</h2></div><div class="say-opts">${p.options.map(o => `<div class="say-opt support" data-loc="${o}"><button class="choose" type="button"><span class="face">${opt[o][0]}</span><span class="words">${opt[o][1]}</span><span class="fx">${opt[o][2]}</span></button></div>`).join('')}</div>`, null, { noClose: true });
    modalHear = () => {
      say(CT.NARR.pick, 'narr', { prio: 2 });
      p.options.forEach(o => { const el = $('sheet').querySelector(`[data-loc="${o}"]`); say(opt[o][1] + '. ' + opt[o][2] + '.', 'narr', { prio: 2, onstart: () => spotOn(el), onend: () => spotOff(el) }); });
    };
    modalHear();
    $('sheet').querySelectorAll('[data-loc]').forEach(b => b.querySelector('.choose').addEventListener('click', () => { stopSpeech(); SIM.choosePlace(S, b.dataset.loc); closeModal(); handleEvents(); tick(true); }));
  }

  function validateModal(d) {
    const iconFor = x => (cardById[x.id] && cardById[x.id].icon) || (CT.CHAOS.find(c => c.id === x.id) || {}).icon || (x.type ? CT.LOADS[x.type].glyph : '•');
    const causes = d.causes.map(x => `<button type="button" class="cause" data-word="${esc(plain(x.label))}"><span class="ci">${iconFor(x)}</span>${esc(x.label)}</button>`).join('') || '<span class="cause"><span class="ci">🪣</span>Lots of little things added up</span>';
    const body = d.blowup.hungry ? '<button type="button" class="cause" data-word="An empty tummy"><span class="ci">🍽️</span>An empty tummy</button>' : '';
    const tired = d.blowup.tired ? '<button type="button" class="cause" data-word="A tired body"><span class="ci">🥱</span>Tired body</button>' : '';
    openModal(`<div class="row">${hearBtn}<h2>${CT.STR.noWonder} 💡</h2></div>
      <h3>${CT.STR.makesSense}</h3>
      <div class="causes">${causes}${body}${tired}</div>
      ${d.cookie ? `<p style="font-size:18px">🍪 <b>${CT.STR.cookieNote}</b> The bucket was already full. The cookie was just the last drop.</p>` : ''}
      ${d.sock ? `<p style="font-size:18px">🧦 <b>${CT.STR.sockReveal}</b></p>` : ''}
      ${icebergSVG(d.feelings)}
      <p class="note">Under the MAD on top, there are other feelings. Tap a feeling to hear it in English and Chinese.</p>
      <h3>${CT.STR.notOk}</h3>
      <div class="instead"><div><span>🦖</span>Stomp like a dinosaur</div><div><span>🌸</span>Flower and candle breaths</div><div><span>🗣️</span>Say “I’m SO mad!”</div></div>
      <p class="note">For grown-ups: kids do well if they can (Ross Greene). Validate the feeling, hold the limit, then repair together.</p>
      <div class="row"><button class="go" type="button" data-go>Let’s fix it together 🔧</button></div>`, () => { stopSpeech(); SIM.ack(S); handleEvents(); tick(true); }, { noClose: true });
    const causeWords = d.causes.map(c => plain(c.label)).concat(d.blowup.hungry ? [CT.NARR.validate.hungry] : [], d.blowup.tired ? [CT.NARR.validate.tired] : []);
    const feelWords = d.feelings.filter(f => f !== 'angry').map(f => CT.FEELINGS[f].en);
    modalHear = () => {
      const V = CT.NARR.validate;
      say([V.start].concat(causeWords.length ? causeWords : [V.littleThings]), 'narr', { prio: 2 });
      if (feelWords.length) say([V.under].concat(feelWords), 'narr', { prio: 2 });
      say(V.end, 'narr', { prio: 2 });
      if (d.cookie) say(CT.STR.cookieNote, 'narr', { prio: 2 });
      if (d.sock) say(CT.STR.sockReveal, 'narr', { prio: 2 });
      say(V.ready, 'narr', { prio: 2 });
    };
    modalHear();
    $('sheet').querySelector('[data-go]').addEventListener('click', closeModal);
    $('sheet').querySelectorAll('.cause[data-word]').forEach(b => b.addEventListener('click', () => say(b.dataset.word, 'narr', { interrupt: true })));
    $('sheet').querySelector('.iceberg').addEventListener('click', e => {
      const g = e.target.closest('g[data-feel]'); if (!g) return;
      const F = CT.FEELINGS[g.dataset.feel]; say(F.en, 'narr', { interrupt: true }); say(F.zh, 'zh', { prio: 2 });
    });
  }

  function breathingGuide(done) {
    // "done" only means the pop-up closed. Closing early (Skip, the X, Escape) is not the same as
    // finishing the breathing animation -- only a finish should count as practice (KNOWN-BUGS B4,
    // DECISIONS D7). `completed` flips true in the one place that means "the animation finished".
    let completed = false;
    openModal(`<div class="breath"><h2>Flower and candle</h2>
      <svg viewBox="0 0 320 160" aria-hidden="true"><g id="bFlower" style="transform-origin:90px 90px;transition:transform 1s"><circle cx="90" cy="70" r="16" fill="#F2C641"/>${[0, 72, 144, 216, 288].map(a => `<ellipse cx="90" cy="46" rx="11" ry="20" fill="#EC6FA8" transform="rotate(${a} 90 70)"/>`).join('')}<circle cx="90" cy="70" r="12" fill="#F2C641"/><path d="M90 90 V150" stroke="#5E9E4F" stroke-width="6"/></g>
      <g><rect x="214" y="80" width="30" height="70" rx="6" fill="#FFFFFF" stroke="#D0C2C8" stroke-width="3"/><path d="M229 80 v-10" stroke="#3A2A33" stroke-width="3"/><path id="bFlame" d="M229 44 q12 16 0 26 q-12 -10 0 -26z" fill="#F2A93B" style="transform-origin:229px 70px;transition:transform 3.5s ease-out"/></g></svg>
      <div class="bstep" id="bStep">Get ready…</div><p class="note">Two sniffs in through your nose, then one long blow out. Breathe along!</p>
      <button class="go quiet" type="button" data-close>Skip</button></div>`, () => { clearTimeouts(); done(completed); });
    const B = CT.NARR.breath;
    const steps = [[400, B[0], 1.25, 1], [1500, B[1], 1.4, 1], [2600, B[2], 1, 0.15], [7000, B[0], 1.25, 1], [8100, B[1], 1.4, 1], [9200, B[2], 1, 0.15], [13600, B[3], 1, 1]];
    steps.forEach(([ms, text, fs, fl]) => timeouts.push(setTimeout(() => {
      const st = $('bStep'); if (!st) return;
      st.textContent = text; say(text, 'narr', { interrupt: true });
      $('bFlower').style.transform = `scale(${fs})`; $('bFlame').style.transform = `scale(${fl})`;
      if (fl < 1) SND.whoosh();
    }, ms)));
    timeouts.push(setTimeout(() => { completed = true; if (isModal() && $('bStep')) closeModal(); }, 15200));
  }
  let timeouts = [];
  function clearTimeouts() { timeouts.forEach(clearTimeout); timeouts = []; }

  function askPredict(id, count) {
    const c = cardById[id];
    openModal(`<div class="row">${hearBtn}<h2>${c.icon} ${esc(c.name)}: what will happen?</h2></div>
      <div class="say-opts"><div class="say-opt support"><button class="choose" type="button" data-g="calmer"><span class="face">😌</span><span class="words">Calmer</span></button></div><div class="say-opt control"><button class="choose" type="button" data-g="madder"><span class="face">😠</span><span class="words">Madder</span></button></div></div>`);
    modalHear = () => { say(plain(c.name) + '.', 'narr', { prio: 2 }); say(CT.NARR.predict, 'narr', { prio: 2 }); };
    modalHear();
    $('sheet').querySelectorAll('[data-g]').forEach(b => b.addEventListener('click', () => {
      const g = b.dataset.g; stopSpeech(); closeModal();
      if (id === 'breathe') breathingGuide(completed => { if (completed) launch(id, count || 1, g); }); else launch(id, count || 1, g);
    }));
  }

  function scienceCard(key) {
    const sc = CT.SCIENCE[key];
    openModal(`<h2>🥒 ${esc(sc.title)}</h2><p style="font-size:19px;font-family:var(--display);font-weight:700">${esc(sc.kid)}</p><p>${esc(sc.adult)}</p><p class="note">Source: ${esc(sc.source)}</p><p class="note">${CT.STR.disclaimer}</p>`);
  }

