'use strict';
  // ============================================================================================
  // BUCKET, JARS, GRAPH
  // ============================================================================================
  function drawBucket(v) {
    const svg = $('bucket');
    if (!svg.firstChild) svg.innerHTML = bucketFrame();
    // Zone stripe on the side (the window of tolerance widens as the jars fill).
    const yG = yOf(v.greenBand), yY = yOf(v.yellowBand), yT = yOf(v.threshold);
    $('bZones').innerHTML = `<rect x="12" y="${yG}" width="12" height="${BK.bottom - yG}" rx="4" fill="#5FB86A"/><rect x="12" y="${yY}" width="12" height="${yG - yY}" fill="#F2C641"/><rect x="12" y="${yT}" width="12" height="${yY - yT}" rx="4" fill="#E0493E"/>
      <text x="6" y="${(yG + BK.bottom) / 2 + 4}" font-size="10">😊</text><text x="6" y="${(yY + yG) / 2 + 4}" font-size="10">😐</text><text x="6" y="${(yT + yY) / 2 + 4}" font-size="10">😠</text>`;
    let s = '', base = 0;
    for (const k of CT.LOAD_ORDER) {
      const h = v.load[k];
      if (h <= 0.05) continue;
      const y1 = yOf(base + h), y0 = yOf(base);
      s += `<rect x="0" y="${y1}" width="170" height="${Math.max(0, y0 - y1)}" fill="${CT.LOADS[k].color}"/>`;
      if (y0 - y1 >= 13) s += `<text x="${118}" y="${(y0 + y1) / 2 + 5}" font-size="12" text-anchor="middle">${CT.LOADS[k].glyph}</text><text x="${70}" y="${(y0 + y1) / 2 + 5}" font-size="10" text-anchor="middle" opacity=".8">${CT.LOADS[k].glyph}</text>`;
      base += h;
    }
    const top = yOf(base);
    if (base > 0.5) s += `<path class="slosh${v.ratio > 0.75 ? ' fast' : ''}" d="M0 ${top} q10 -5 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0" fill="none" stroke="#FFFFFF" stroke-width="3" opacity=".7"/>`;
    $('bLayers').innerHTML = s;
    // Cortisol: slow purple sludge = the floor recovery can't go below yet.
    const sl = v.phase !== 'day' ? v.floor : S.cortisol * 0.3;
    $('bSludge').innerHTML = sl > 1 ? `<path d="M0 ${BK.bottom + 4} V${yOf(sl)} q20 6 42 0 t42 0 t42 0 t44 0 V${BK.bottom + 4}Z" fill="#5B3F7A" opacity=".55"/><text x="92" y="${Math.min(BK.bottom - 4, yOf(sl) + 14)}" text-anchor="middle" font-size="10" fill="#FFFFFF" font-weight="700">slow sludge</text>` : '';
    // Threshold line (overflow), and adrenaline sparks above the surface.
    $('bLines').innerHTML = `<line x1="${BK.left}" y1="${yT}" x2="${BK.right}" y2="${yT}" stroke="#E0493E" stroke-width="2.5" stroke-dasharray="6 4"/><text x="${BK.right + 2}" y="${yT + 4}" font-size="11">💥</text>`;
    let sp = '';
    const nSp = Math.round(v.adrenaline / 18);
    for (let i = 0; i < nSp; i++) { const x = 50 + (i * 37) % 90, y = top - 6 - (i % 3) * 7; sp += `<path class="spark" d="M${x} ${y} l4 -6 l-2 6 l5 -2" stroke="#F2A93B" stroke-width="2.5" fill="none" stroke-linecap="round"/>`; }
    $('bSparks').innerHTML = sp;
    $('bOver').innerHTML = v.ratio >= 1 ? `<g fill="${CT.LOADS[S.blowups.length ? S.blowups[S.blowups.length - 1].dominant : 'thinking'].color}"><circle cx="30" cy="30" r="6"/><circle cx="150" cy="40" r="7"/><circle cx="22" cy="54" r="4"/><circle cx="156" cy="64" r="4"/></g>` : '';
    $('bMask').setAttribute('opacity', v.masking ? 1 : 0);
    $('bucket').classList.toggle('wobble', v.phase === 'day' && v.ratio > 0.85 && !reducedMotion());
    $('bucketNum').textContent = Math.round(v.pressure) + ' / ' + Math.round(v.threshold);
    const zn = v.phase !== 'day' ? null : v.zone === 'blowup' ? 'red' : v.zone;
    const pill = $('zonePill');
    if (zn) { const Z = CT.ZONES[zn]; pill.style.background = { green: '#BFE6C4', yellow: '#FBE7A1', red: '#F6B9B3' }[zn]; pill.innerHTML = `${{ green: '😊', yellow: '😐', red: '😠' }[zn]} ${Z.kid} <span lang="zh-TW" class="zh">${rubyZh(Z.zh, Z.py)}</span>`; }
    else { pill.style.background = '#E3D6F2'; pill.innerHTML = '🌧️ ' + CT.PHASES[v.phase].kid; }
  }
  function dropInto(type) {
    const g = $('bDrops'); if (!g) return;
    const c = document.createElementNS(NS, 'g');
    c.innerHTML = `<path d="M0 -10 Q8 2 0 8 Q-8 2 0 -10Z" fill="${CT.LOADS[type].color}" stroke="#fff" stroke-width="1.5"/>`;
    c.setAttribute('transform', 'translate(92 0)');
    g.appendChild(c);
    const target = yOf(SIM.pressure(S));
    try { c.animate([{ transform: 'translate(92px, 0px)' }, { transform: `translate(92px, ${target}px)` }], { duration: 550, easing: 'ease-in' }).onfinish = () => c.remove(); }
    catch (e) { c.remove(); }
  }

  let jarKey = '', jarPrev = null;
  function drawJars(v) {
    const key = v.jars.choice + '|' + v.jars.can + '|' + v.jars.together;
    if (key === jarKey) return;
    jarKey = key;
    const prev = jarPrev; jarPrev = Object.assign({}, v.jars);
    const j = CT.JARS;
    const one = k => `<button class="jar" type="button" data-jar="${k}" aria-label="${j[k].name}: ${v.jars[k]} marbles">${jarSVG(k, v.jars[k], k === 'choice')}<span class="jl">${j[k].name}<span class="zh" lang="zh-TW">${rubyZh(j[k].zh, j[k].py)}</span></span></button>`;
    $('jars').innerHTML = `<h2>Jars <small class="note">tap a marble</small></h2>${one('choice')}${one('can')}${one('together')}`;
    if (prev && !reducedMotion()) for (const k of ['choice', 'can', 'together']) for (let i = prev[k]; i < v.jars[k]; i++) {
      const m = $('jars').querySelector(`.marble[data-jar="${k}"][data-i="${i}"]`); if (m) m.classList.add('drop-in');
    }
  }
  $('jars').addEventListener('click', e => {
    const m = e.target.closest('.marble');
    if (m && S) { const jarArr = S.jars[m.dataset.jar]; const mk = jarArr[+m.dataset.i]; if (mk) { kidBubble(mk.label, 'self', -1); say(mk.label, 'pip', { interrupt: true }); SND.clink(); } return; }
    const j = e.target.closest('.jar');
    if (j) { const k = j.dataset.jar; say(fill(CT.NARR.jar[k], { n: SIM.jar(S, k) }), 'narr', { interrupt: true }); say(CT.JARS[k].zh, 'zh', { prio: 2 }); }
  });

  // The pressure graph, sized to the real pixels so text stays crisp.
  function graphSVG(series, w, h, markers) {
    const x = t => 30 + t / 780 * (w - 40), y = r => h - 14 - Math.min(r, 1.3) / 1.3 * (h - 22);
    let s = `<rect x="30" y="${y(0.4)}" width="${w - 40}" height="${y(0) - y(0.4)}" fill="#5FB86A" opacity=".16"/><rect x="30" y="${y(0.75)}" width="${w - 40}" height="${y(0.4) - y(0.75)}" fill="#F2C641" opacity=".18"/><rect x="30" y="${y(1)}" width="${w - 40}" height="${y(0.75) - y(1)}" fill="#E0493E" opacity=".14"/>
      <line x1="30" x2="${w - 10}" y1="${y(1)}" y2="${y(1)}" stroke="#E0493E" stroke-dasharray="4 3"/>`;
    for (let hr = 7; hr <= 20; hr += 2) { const t = (hr - 7) * 60; s += `<text x="${x(t)}" y="${h - 2}" font-size="10" fill="currentColor" opacity=".6" text-anchor="middle">${hr > 12 ? hr - 12 : hr}${hr >= 12 ? 'p' : 'a'}</text>`; }
    s += `<text x="2" y="${y(1) + 4}" font-size="10" fill="currentColor" opacity=".6">💥</text><text x="2" y="${y(0.2) + 4}" font-size="10" fill="currentColor" opacity=".6">😊</text>`;
    for (const se of series) {
      if (!se.pts.length) continue;
      let d = '';
      se.pts.forEach((p, i) => { d += (i ? 'L' : 'M') + x(p[0]).toFixed(1) + ' ' + y(p[1]).toFixed(1); });
      s += `<path d="${d}" fill="none" stroke="${se.color}" stroke-width="2.5" stroke-linejoin="round"/>`;
    }
    for (const m of markers || []) s += `<text x="${x(m.t)}" y="${Math.max(12, y(m.r) - 4)}" font-size="${m.size || 12}" text-anchor="middle">${m.g}</text>`;
    return s;
  }
  function drawGraph() {
    if (!S) return;
    const svg = $('graph'), w = Math.max(300, svg.clientWidth || 800), h = 76;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    const pts = S.graph.filter((g, i) => i % 2 === 0).map(g => [g[0], g[1] / g[2]]);
    const markers = [];
    for (const e of S.log) {
      const gp = S.graph[Math.min(S.graph.length - 1, e.t)]; const r = gp ? gp[1] / gp[2] : 0.5;
      if (e.kind === 'blowup') markers.push({ t: e.t, r: 1.25, g: '💥', size: 14 });
      else if (e.kind === 'say' && e.how !== 'skip') markers.push({ t: e.t, r: r + 0.12, g: e.how === 'support' ? '💚' : '💜', size: 10 });
      else if (e.kind === 'self') markers.push({ t: e.t, r: r + 0.12, g: '✨', size: 11 });
    }
    let s = graphSVG([{ pts, color: '#D2693F' }], w, h, markers);
    const x = 30 + S.t / 780 * (w - 40);
    s += `<line x1="${x}" x2="${x}" y1="4" y2="${h - 14}" stroke="currentColor" opacity=".35"/>`;
    svg.innerHTML = s;
  }

