'use strict';
  // ============================================================================================
  // BEDTIME, RECEIPT, SAVED DAYS, COMPARE
  // ============================================================================================
  function startBedtime() {
    bedtimeShown = true;
    SND.lullaby();
    const night = $('night'); if (night) { night.style.transition = 'opacity 3s'; night.setAttribute('opacity', 0.55); }
    const z = document.createElementNS(NS, 'g'); z.innerHTML = `<text class="zzz" x="${KID_X + 40}" y="${FLOOR - 220}" font-size="30" fill="#FFFFFF" font-family="Baloo 2">Z</text><text class="zzz" style="animation-delay:.8s" x="${KID_X + 50}" y="${FLOOR - 240}" font-size="22" fill="#FFFFFF" font-family="Baloo 2">z</text>`;
    $('fx').appendChild(z);
    kidBubble('Goodnight…', 'self', -1);
    say(CT.NARR.bedtime, 'narr', { prio: 2, interrupt: true }); kidSay('Goodnight…', 2);
    const day = saveDay();
    skillsSaved = snapshotSkills(); store.set('skills', skillsSaved);
    setPhase('BEDTIME');
    setTimeout(() => whenModalFree(() => showReceipt(day)), COVER ? 0 : 3200);
  }
  function snapshotSkills() { return { breathe: { xp: S.skills.breathe.xp }, stomp: { xp: S.skills.stomp.xp } }; }
  function saveDay() {
    const r = SIM.receipt(S, 10);
    const day = {
      id: Date.now(), when: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
      style: S.styleId, styleName: S.style.name, icon: S.style.icon,
      graph: S.graph.filter(g => g[0] % 5 === 0).map(g => [g[0], Math.round(g[1] / g[2] * 100) / 100]),
      lines: r.lines.map(l => [l.label, Math.round(l.delta)]), total: Math.round(r.total), end: Math.round(r.end),
      blowups: r.blowups, marbles: r.marbles, skills: r.practice, usedCount: r.usedCount, cookie: r.cookie, sock: r.sock,
    };
    const days = store.get('days', []); days.unshift(day); store.set('days', days.slice(0, 12));
    return day;
  }
  const sign = n => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n);
  function receiptHTML(day) {
    const lines = day.lines.filter(l => l[1] !== 0).map(([label, d]) => `<div class="rl"><span>${esc(label)}</span><b>${sign(d)}</b></div>` + (label === 'Broken cookie' ? '<div class="rn">(the cookie was not the problem)</div>' : '')).join('');
    return `<div class="receipt"><div class="rh">~~~~~~ COST OF THE DAY ~~~~~~</div><div class="rh">${esc(day.icon + ' ' + day.styleName)}</div><div class="rh" style="font-weight:400">${esc(day.when)}</div><hr>
      ${lines}<hr>
      <div class="rl"><span>TOTAL PRESSURE</span><b>${sign(day.total)}</b></div>
      <div class="rl"><span>LEFT IN THE BUCKET</span><b>${day.end}</b></div>
      <div class="rl"><span>BLOW-UPS</span><b>${day.blowups}</b></div>
      <div class="rl"><span>MARBLES EARNED</span><b>${day.marbles}</b></div>
      <div class="rl"><span>TOOLS THAT HELPED</span><b>${day.usedCount}</b></div>
      <div class="rl"><span>PRACTISED WHILE CALM</span><b>${day.skills}</b></div>
      ${day.cookie ? '<div class="rn">It wasn’t really about the cookie.</div>' : ''}${day.sock ? '<div class="rn">The itchy sock was found!</div>' : ''}
      <hr><div class="rh" style="font-weight:400">Blowing up isn’t losing.<br>Learning why is winning.</div></div>`;
  }
  function showReceipt(day) {
    openModal(`<div class="row">${hearBtn}<h2>🌙 Goodnight, Pip</h2></div><p>The day is done. Here’s what it cost.</p>${receiptHTML(day)}
      <div class="row"><button class="go quiet" type="button" id="rPng">Save picture</button><button class="go quiet" type="button" id="rCompare">Compare days</button><button class="go quiet" type="button" id="rTell">Tell a friend</button><span id="rStatus" class="note"></span></div>
      <div class="row"><button class="go quiet" type="button" id="rAgain">Play another day</button></div>
      <div class="more"><h3>More from the Game Shelf</h3><p><a href="../aquarium/">James’s Nature Aquarium</a> · <a href="../mid-autumn/">Mid-Autumn Mayhem</a> · <a href="../">All games</a></p>
      <p>Tell us what you think: <a href="../feedback/?game=blow-up&amp;v=${VERSION}">Share your thoughts</a> · <a href="../feedback/?game=blow-up&amp;v=${VERSION}&amp;kind=bug">Report a bug</a></p>
      <p><b>For grown-ups:</b> we’re a family making little games about the things we’re curious about, and the next one is already brewing. <a href="https://ko-fi.com/magicmakers" target="_blank" rel="noopener">Follow us on Ko-fi</a> to hear when it’s out, or <a href="https://ko-fi.com/magicmakers" target="_blank" rel="noopener">♥ support the next game</a>.</p>
      <p class="note">${CT.STR.disclaimer}</p></div>`, null);
    modalHear = () => {
      const RC = CT.NARR.receipt;
      const clean = l => !/little things|^x$/i.test(l[0]);
      const fillers = day.lines.filter(l => l[1] > 0 && clean(l)).sort((a, b) => b[1] - a[1]).slice(0, 3).map(l => plain(l[0]));
      const helpers = day.lines.filter(l => l[1] < 0 && clean(l)).sort((a, b) => a[1] - b[1]).slice(0, 2).map(l => plain(l[0]));
      say([RC.start, RC.blowups[Math.min(day.blowups, RC.blowups.length - 1)]], 'narr', { prio: 2 });
      if (fillers.length) say([RC.fillers].concat(fillers), 'narr', { prio: 2 });
      if (helpers.length) say([RC.helpers].concat(helpers), 'narr', { prio: 2 });
      say(day.marbles === 1 ? RC.marble1 : fill(RC.marbles, { m: day.marbles }), 'narr', { prio: 2 });
      if (day.cookie) say(CT.STR.cookieNote, 'narr', { prio: 2 });
      say(RC.end, 'narr', { prio: 2 });
    };
    modalHear();
    $('rPng').addEventListener('click', () => sharePng(day, $('rStatus')));
    $('rCompare').addEventListener('click', compareModal);
    $('rTell').addEventListener('click', () => tellFriend($('rStatus')));
    $('rAgain').addEventListener('click', () => { stopSpeech(); closeModal(); startScreen(); });
  }
  function receiptCanvas(day) {
    const lines = day.lines.filter(l => l[1] !== 0);
    const W = 640, H = 300 + lines.length * 30 + (day.cookie ? 30 : 0);
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.fillStyle = '#FFF6EA'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#FFFDF6'; x.fillRect(40, 20, W - 80, H - 40);
    x.fillStyle = '#2A2226'; x.textBaseline = 'top';
    const mono = s => `${s}px "Courier Prime", "Courier New", monospace`;
    const center = (t, y, size, bold) => { x.font = (bold ? 'bold ' : '') + mono(size); x.textAlign = 'center'; x.fillText(t, W / 2, y); };
    center('~~~~~~ COST OF THE DAY ~~~~~~', 40, 22, true);
    center(day.styleName, 72, 18); center(day.when, 96, 15);
    let y = 130;
    const row = (l, r, bold) => { x.font = (bold ? 'bold ' : '') + mono(18); x.textAlign = 'left'; const dots = ' ' + '.'.repeat(60); x.fillText((l + dots).slice(0, 40), 64, y); x.textAlign = 'right'; x.fillText(r, W - 64, y); y += 30; };
    for (const [l, d] of lines) row(l, sign(d));
    y += 6; x.fillText('', 0, 0);
    row('TOTAL PRESSURE', sign(day.total), true); row('BLOW-UPS', String(day.blowups), true); row('MARBLES EARNED', String(day.marbles), true); row('TOOLS THAT HELPED', String(day.usedCount), true); row('PRACTISED WHILE CALM', String(day.skills), true);
    if (day.cookie) { center('It wasn’t really about the cookie.', y, 15); y += 30; }
    center('Blow Up · The Game Shelf', H - 50, 14);
    return c;
  }
  async function sharePng(day, status) {
    try {
      const c = receiptCanvas(day);
      const blob = await new Promise(r => c.toBlob(r, 'image/png'));
      const file = new File([blob], 'blow-up-receipt.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Blow Up', text: 'Our Cost of the Day in Blow Up ' + GAME_URL }); status.textContent = 'Shared!'; return; }
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'blow-up-receipt.png'; document.body.appendChild(a); a.click(); a.remove();
      status.textContent = 'Saved as blow-up-receipt.png';
    } catch (e) { if (!(e && e.name === 'AbortError')) status.textContent = 'Couldn’t save the picture here.'; }
  }
  async function tellFriend(status) {
    const text = 'A silly, science-true game about big feelings for kids 4 to 7: Blow Up';
    try { if (navigator.share) { await navigator.share({ title: 'Blow Up', text, url: GAME_URL }); return; } await navigator.clipboard.writeText(text + ' ' + GAME_URL); status.textContent = 'Link copied! Paste it in a message.'; }
    catch (e) { if (!(e && e.name === 'AbortError')) status.textContent = GAME_URL; }
  }
  $('tellBtn').addEventListener('click', () => tellFriend($('tellStatus')));

  function compareModal() {
    const days = store.get('days', []);
    if (days.length < 2) { openModal(`<h2>Compare days</h2><p>Play two days (try one of each kind) and they’ll show up here side by side.</p>${days.length ? receiptHTML(days[0]) : ''}`); return; }
    const pick = [days[0].id, (days.find(d => d.style !== days[0].style) || days[1]).id];
    const draw = () => {
      const a = days.find(d => d.id === pick[0]), b = days.find(d => d.id === pick[1]);
      const w = 700, h = 120;
      const g = graphSVG([{ pts: a.graph, color: '#D2693F' }, { pts: b.graph, color: '#3F93E0' }], w, h, []);
      $('cmpOut').innerHTML = `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:auto;color:var(--ink)">${g}</svg>
        <p class="note"><span style="color:#D2693F">■</span> ${esc(a.styleName)} (${esc(a.when)}) · <span style="color:#3F93E0">■</span> ${esc(b.styleName)} (${esc(b.when)})</p>
        <div class="cmp">${receiptHTML(a)}${receiptHTML(b)}</div>`;
    };
    openModal(`<h2>One Day, Many Ways</h2><p class="note">Pick two saved days. Same kid, different day.</p>
      <div class="saved-list">${days.map(d => `<label><input type="checkbox" value="${d.id}" ${pick.includes(d.id) ? 'checked' : ''}> ${d.icon} ${esc(d.styleName)} · ${esc(d.when)} · 💥 ${d.blowups}</label>`).join('')}</div><div id="cmpOut"></div>`);
    $('sheet').querySelectorAll('input[type=checkbox]').forEach(cb => cb.addEventListener('change', () => {
      const id = +cb.value;
      if (cb.checked) { pick.push(id); if (pick.length > 2) { const old = pick.shift(); const o = $('sheet').querySelector(`input[value="${old}"]`); if (o) o.checked = false; } }
      else { const i = pick.indexOf(id); if (i >= 0) pick.splice(i, 1); }
      if (pick.length === 2) draw();
    }));
    draw();
  }

  function stickerModal() {
    const items = [...CT.UHOH, ...CT.HELPERS, ...CT.TOOLS];
    openModal(`<h2>📒 Sticker book</h2><p class="note">Every card you try earns a sticker. ${stickers.size} of ${items.length} found.</p>
      <div class="stickers">${items.map(c => `<div class="sticker${stickers.has(c.id) ? '' : ' off'}"><span>${c.icon}</span>${stickers.has(c.id) ? esc(c.name) : '?'}</div>`).join('')}</div>`);
  }

  function menuModal() {
    const tg = (id, label, on) => `<button class="ctl" type="button" data-pref="${id}" aria-pressed="${on}">${on ? '✓ ' : ''}${label}</button>`;
    openModal(`<h2>⚙︎ Settings</h2>
      <div class="row">${tg('captions', 'CC Sound captions', prefs.captions)}${tg('reduced', '🐢 Less motion', prefs.reduced)}${tg('predict', '🔮 Predict mode', prefs.predict)}</div>
      <p class="note">Predict mode: before each card, guess “calmer” or “madder”.</p>
      <div class="row"><button class="go quiet" type="button" id="mVoices">🔊 Test the voices</button><span class="note" id="mVoiceStatus">${esc(voiceStatusText())}</span></div>
      <div class="row"><button class="go quiet" type="button" id="mCompare">Compare saved days</button><button class="go quiet" type="button" id="mNew">Start a new day</button><button class="go quiet" type="button" id="mSkills">Reset skills</button></div>
      <p class="note">${CT.STR.disclaimer}</p>`);
    $('sheet').querySelectorAll('[data-pref]').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.pref; prefs[k] = !prefs[k]; savePrefs();
      b.setAttribute('aria-pressed', prefs[k]); b.textContent = (prefs[k] ? '✓ ' : '') + b.textContent.replace(/^✓ /, '');
      document.body.classList.toggle('reduced', prefs.reduced);
    }));
    $('mCompare').addEventListener('click', compareModal);
    $('mVoices').addEventListener('click', () => { audioInit(); testVoices(); setTimeout(() => { const el = $('mVoiceStatus'); if (el) el.textContent = voiceStatusText(); }, 1500); });
    $('mNew').addEventListener('click', () => { closeModal(); startScreen(); });
    $('mSkills').addEventListener('click', () => { skillsSaved = {}; store.set('skills', {}); if (S) { S.skills.breathe = { xp: 0, level: 0 }; S.skills.stomp = { xp: 0, level: 0 }; buildTrays(); trayPhase = ''; } $('mSkills').textContent = 'Skills reset'; });
  }

