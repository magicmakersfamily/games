'use strict';
  // ============================================================================================
  // SOUND — synthesised with Web Audio, started only from a button press.
  // ============================================================================================
  const AU = { ctx: null, master: null, kettleOsc: null, kettleGain: null, lfo: null };
  function audioInit() {
    if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume(); if (typeof voiceInit === 'function') voiceInit(); return; }
    try {
      const ctx = AU.ctx = new (window.AudioContext || window.webkitAudioContext)();
      AU.master = ctx.createGain(); AU.master.gain.value = prefs.sound ? 0.5 : 0; AU.master.connect(ctx.destination);
      AU.kettleOsc = ctx.createOscillator(); AU.kettleOsc.type = 'sine'; AU.kettleOsc.frequency.value = 1400;
      AU.lfo = ctx.createOscillator(); AU.lfo.frequency.value = 7; const lg = ctx.createGain(); lg.gain.value = 40; AU.lfo.connect(lg); lg.connect(AU.kettleOsc.frequency);
      AU.kettleGain = ctx.createGain(); AU.kettleGain.gain.value = 0;
      AU.kettleOsc.connect(AU.kettleGain); AU.kettleGain.connect(AU.master);
      AU.kettleOsc.start(); AU.lfo.start();
    } catch (e) { AU.ctx = null; }
  }
  function setSound(on) { prefs.sound = on; savePrefs(); if (AU.master) AU.master.gain.value = on ? 0.5 : 0; $('soundBtn').setAttribute('aria-pressed', on); $('soundBtn').textContent = on ? '🔊' : '🔇'; }
  function tone(freq, dur, type, vol, when, slideTo) {
    if (!AU.ctx || !prefs.sound) return;
    const ctx = AU.ctx, t0 = ctx.currentTime + (when || 0);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol || 0.2, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(AU.master); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function noise(dur, vol, freq, type, when) {
    if (!AU.ctx || !prefs.sound) return;
    const ctx = AU.ctx, t0 = ctx.currentTime + (when || 0);
    const buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * dur)), ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.value = freq || 1000;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol || 0.2, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(AU.master); src.start(t0);
  }
  const SND = {
    boing() { tone(220, 0.35, 'sine', 0.25, 0, 660); tone(660, 0.25, 'sine', 0.12, 0.18, 330); cap('boing!'); },
    bonk() { tone(140, 0.25, 'triangle', 0.3, 0, 90); noise(0.08, 0.15, 800); cap('bonk'); },
    chime() { [880, 1320, 1760].forEach((f, i) => tone(f, 1.2, 'sine', 0.08, i * 0.09)); cap('soft chime'); },
    tuba(up) { tone(up ? 98 : 73, 0.5, 'sawtooth', 0.12, 0, up ? 110 : 65); tone(up ? 196 : 147, 0.45, 'square', 0.03); cap(up ? 'tuba: bwaaamp ↑' : 'tuba: bwomp'); },
    snip() { noise(0.05, 0.3, 4000, 'highpass'); noise(0.05, 0.25, 5000, 'highpass', 0.08); cap('snip!'); },
    clink() { tone(2200, 0.15, 'sine', 0.08); tone(3300, 0.12, 'sine', 0.05, 0.03); },
    boom() { noise(1.2, 0.5, 400); tone(80, 1.2, 'sawtooth', 0.2, 0, 30); for (let i = 0; i < 8; i++) tone(1500 + Math.random() * 2500, 0.2, 'sine', 0.04, 0.3 + i * 0.12); cap('KABOOM (glitter everywhere)'); },
    whoosh() { noise(0.8, 0.12, 900, 'bandpass'); },
    pingpong() { for (let i = 0; i < 4; i++) tone(1200 - i * 100, 0.06, 'square', 0.06, i * 0.18); cap('ping… pong… (words bounce off)'); },
    marbleLost() { tone(500, 0.3, 'triangle', 0.1, 0, 250); },
    lullaby() { const notes = [523, 659, 784, 659, 587, 523, 494, 523, 392, 440, 523]; notes.forEach((f, i) => tone(f, 0.9, 'sine', 0.07, i * 0.55)); cap('soft lullaby'); },
    sparkle() { [1568, 2093, 2637].forEach((f, i) => tone(f, 0.4, 'sine', 0.06, i * 0.07)); cap('sparkle!'); },
  };
  function updateKettle(v) {
    if (!AU.kettleGain) return;
    const on = prefs.sound && running && !paused && !isModal() && v.phase === 'day' && v.ratio > 0.6;
    const vol = on ? Math.min(0.09, (v.ratio - 0.6) * 0.22) : 0;
    AU.kettleGain.gain.setTargetAtTime(vol, AU.ctx.currentTime, 0.2);
    AU.kettleOsc.frequency.setTargetAtTime(1100 + v.ratio * 1500, AU.ctx.currentTime, 0.3);
    if (on && vol > 0.03) cap('kettle whistling');
  }
  let capTimer = 0;
  function cap(text) { if (!prefs.captions) return; $('caption').textContent = '[' + text + ']'; clearTimeout(capTimer); capTimer = setTimeout(() => { $('caption').textContent = ''; }, 1600); }

  // --- Storyteller voice ------------------------------------------------------------------------
  // One queue for every voice, so lines never talk over each other. Pip, the grown-up and Professor
  // Pickle use the same voice at different pitches, so a child who can't read can tell who's talking.
  // A line with hold: true keeps the clock still until it has been said.
  let voices = [];
  function loadVoices() { try { voices = speechSynthesis.getVoices(); } catch (e) { voices = []; } }
  try { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; } catch (e) { /* no speech */ }
  const PREFERRED = ['Samantha', 'Karen', 'Moira', 'Google US English', 'Microsoft Jenny', 'Microsoft Aria', 'Daniel'];
  function enVoice() {
    for (const n of PREFERRED) { const v = voices.find(v => v.name.startsWith(n) && /^en/i.test(v.lang)); if (v) return v; }
    return voices.find(v => /^en[-_]US/i.test(v.lang)) || voices.find(v => /^en/i.test(v.lang)) || null;
  }
  const WHO = { narr: { pitch: 1, rate: 0.92 }, pip: { pitch: 1.45, rate: 1.02 }, adult: { pitch: 0.82, rate: 0.95 }, pickle: { pitch: 1.75, rate: 1.05 }, zh: { pitch: 1, rate: 0.75 } };
  const N = { q: [], cur: null, timer: 0, last: '', unlocked: false, cancelledAt: 0, recent: new Map(), src: null, level: 0 };

  // Recorded voices: one MP3 bank per speaker, sliced by the manifest. Clips that aren't recorded
  // (or haven't loaded yet) fall back to the browser's own speech.
  const VB = { manifest: null, banks: {}, loading: {}, buffers: new Map(), gain: null, analyser: null, data: null, stats: { clip: 0, fallback: 0, missing: [] } };
  function voiceInit() {
    if (VB.manifest || VB.loading.manifest || !AU.ctx) return;
    VB.loading.manifest = true;
    VB.status = 'loading';
    fetch('voice/manifest.json').then(r => { if (!r.ok) throw new Error('manifest ' + r.status); return r.json(); }).then(m => {
      VB.manifest = m;
      // The storyteller's first file first (it has the welcome and the tour), then everything else.
      loadChunk('narr', 0).then(() => { for (const who of Object.keys(m.files)) for (let n = 0; n < m.files[who]; n++) loadChunk(who, n); });
    }).catch(e => { VB.status = 'failed: ' + e.message; VB.failed = true; });
    VB.gain = AU.ctx.createGain(); VB.gain.gain.value = 1;
    VB.analyser = AU.ctx.createAnalyser(); VB.analyser.fftSize = 512; VB.data = new Uint8Array(VB.analyser.fftSize);
    VB.gain.connect(VB.analyser); VB.analyser.connect(AU.ctx.destination);
  }
  // Voice files come in ~1.5 MB pieces (voice/<who>-<n>.mp3); each clip lives in one piece.
  function loadChunk(who, n) {
    const f = who + '-' + n;
    if (VB.loading[f]) return VB.loading[f];
    return VB.loading[f] = fetch('voice/' + f + '.mp3').then(r => { if (!r.ok) throw new Error(f + ' ' + r.status); return r.arrayBuffer(); })
      .then(buf => {
        VB.banks[f] = buf;
        const m = VB.manifest, total = Object.values(m.files).reduce((a, b) => a + b, 0);
        if (Object.keys(VB.banks).length === total) VB.status = 'ready';
      })
      .catch(e => { VB.bad = VB.bad || {}; VB.bad[f] = true; VB.status = 'failed: ' + e.message; });
  }
  function clipFor(who, text) {
    if (!VB.manifest) return null;
    const bank = VB.manifest.banks[who]; if (!bank) return null;
    const key = CT.voiceKey(who, text), at = bank[key];
    if (!at) return null;
    const f = who + '-' + at[0];
    return { key: who + key, at, file: f, ready: !!VB.banks[f], bad: !!(VB.bad && VB.bad[f]) };
  }
  async function bufferFor(who, clip) {
    if (VB.buffers.has(clip.key)) return VB.buffers.get(clip.key);
    const slice = VB.banks[clip.file].slice(clip.at[1], clip.at[1] + clip.at[2]);
    const buf = await new Promise((res, rej) => AU.ctx.decodeAudioData(slice, res, rej));
    VB.buffers.set(clip.key, buf);
    return buf;
  }
  // Loudness of the voice right now (0..1), for moving mouths.
  function voiceLevel() {
    if (!VB.analyser || !N.src) return N.cur && N.cur.fallback ? 0.35 + 0.3 * Math.sin(performance.now() / 70) : 0;
    VB.analyser.getByteTimeDomainData(VB.data);
    let sum = 0; for (let i = 0; i < VB.data.length; i++) { const d = (VB.data[i] - 128) / 128; sum += d * d; }
    return Math.min(1, Math.sqrt(sum / VB.data.length) * 5);
  }

  function say(text, who, opts) {
    if (!text || (Array.isArray(text) && !text.length)) return;
    who = who || 'narr'; opts = opts || {};
    const segs = (Array.isArray(text) ? text : [text]).filter(Boolean).map(String);
    const full = segs.join(' ');
    const item = { segs, text: full, who, hold: !!opts.hold, prio: opts.prio == null ? 1 : opts.prio, onstart: opts.onstart, onend: opts.onend, group: opts.group || null };
    if (!prefs.narrator || !N.unlocked || COVER) {
      if (who === 'narr') { showLine(full); N.last = segs; }
      if (item.onstart) item.onstart(); if (item.onend) item.onend();
      return;
    }
    // The same line again within a few seconds? Skip it (a child tapping ten times hears it once).
    const k = who + '|' + full, seen = N.recent.get(k);
    if (!opts.interrupt && !item.hold && seen && performance.now() - seen < (opts.dedupe || 9000)) return;
    N.recent.set(k, performance.now());
    if (opts.interrupt) stopSpeech();
    else if (item.prio === 0 && (N.cur || N.q.length)) return;          // chatter: only when it's quiet
    else if (item.prio === 1 && N.q.length >= 3) return;                // don't let lines pile up
    else if (N.q.length >= 6) {                                         // lots going on: drop the oldest line that isn't holding the clock
      const i = N.q.findIndex(x => !x.hold); if (i < 0) return;
      const [gone] = N.q.splice(i, 1); if (gone.onend) gone.onend();
    }
    N.q.push(item); pump();
  }
  // A new card reaction replaces the queued reaction to the previous card.
  function dropGroup(g) { N.q = N.q.filter(it => { if (it.group !== g) return true; if (it.onend) it.onend(); return false; }); }
  function stopSpeech() {
    const q = N.q; N.q = [];
    for (const it of q) if (it.onend) it.onend();
    if (N.cur) { const c = N.cur; N.cur = null; clearTimeout(N.timer); if (c.onend) c.onend(); }
    if (N.src) { try { N.src.onended = null; N.src.stop(); } catch (e) { /* already stopped */ } N.src = null; }
    try { speechSynthesis.cancel(); } catch (e) { /* no speech */ }
    N.cancelledAt = performance.now(); talking(false);
  }
  function pump() {
    if (N.cur || !N.q.length) return;
    const it = N.cur = N.q.shift();
    if (it.who === 'narr') { showLine(it.text); N.last = it.segs; }
    if (it.onstart) it.onstart();
    talking(true, it.who);
    if (AU.master) AU.master.gain.setTargetAtTime(prefs.sound ? 0.22 : 0, AU.ctx.currentTime, 0.1);   // duck the sound effects
    let i = 0;
    const finish = () => {
      if (N.cur !== it) return;
      clearTimeout(N.timer); N.cur = null; N.src = null; talking(false);
      if (AU.master) AU.master.gain.setTargetAtTime(prefs.sound ? 0.5 : 0, AU.ctx.currentTime, 0.2);
      if (it.onend) it.onend();
      setTimeout(pump, 180);
    };
    const next = () => {
      if (N.cur !== it) return;
      if (i >= it.segs.length) return finish();
      const seg = it.segs[i];
      // Recordings still loading? Wait a moment for them rather than using the robot voice.
      const waited = performance.now() - (it.waitFrom || (it.waitFrom = performance.now()));
      const c0 = clipFor(it.who, seg);
      const stillLoading = (!VB.manifest && !VB.failed) || (c0 && !c0.ready && !c0.bad);
      if (waited < 12000 && stillLoading) { clearTimeout(N.timer); N.timer = setTimeout(next, 120); return; }
      it.waitFrom = 0; i++;
      clearTimeout(N.timer);
      N.timer = setTimeout(next, 2500 + seg.length * 95);               // safety net if a clip never reports its end
      const clip = clipFor(it.who, seg);
      if (clip && clip.ready && AU.ctx) VB.stats.clip++; else { VB.stats.fallback++; if (!clip && VB.stats.missing.length < 50) VB.stats.missing.push(it.who + ': ' + seg); }
      robotTag(!(clip && clip.ready && AU.ctx));
      if (clip && clip.ready && AU.ctx) {
        bufferFor(it.who, clip).then(buf => {
          if (N.cur !== it) return;
          const src = AU.ctx.createBufferSource(); src.buffer = buf; src.connect(VB.gain);
          N.src = src; it.fallback = false;
          src.onended = () => { if (N.src === src) N.src = null; setTimeout(next, 140); };
          clearTimeout(N.timer); N.timer = setTimeout(next, buf.duration * 1000 + 1500);
          src.start();
        }).catch(() => speakFallback(it, seg, next));
      } else speakFallback(it, seg, next);
    };
    next();
  }
  // The browser's own voice, only when no recording exists for this line.
  function speakFallback(it, seg, next) {
    it.fallback = true;
    try {
      const u = new SpeechSynthesisUtterance(seg.replace(/[‘’]/g, "'").replace(/[“”]/g, ''));
      const w = WHO[it.who] || WHO.narr;
      if (it.who === 'zh') {
        const v = voices.find(v => /zh[-_]TW/i.test(v.lang)) || voices.find(v => /zh[-_]CN/i.test(v.lang));   // Mandarin, never Cantonese
        u.lang = v ? v.lang : 'zh-TW'; if (v) u.voice = v;
      } else { const v = enVoice(); if (v) u.voice = v; u.lang = v ? v.lang : 'en-US'; u.pitch = w.pitch; }
      u.rate = w.rate;
      u.onend = () => setTimeout(next, 120); u.onerror = u.onend;
      const wait = Math.max(0, 200 - (performance.now() - N.cancelledAt));   // Chrome drops speak() right after cancel()
      if (wait) setTimeout(() => { if (N.cur === it) speechSynthesis.speak(u); }, wait); else speechSynthesis.speak(u);
    } catch (e) { next(); }
  }
  // A small tag for grown-ups whenever the backup (browser) voice is used instead of a recording.
  function robotTag(on) { const t = $('robotTag'); if (t) t.hidden = !on; }
  function voiceStatusText() {
    const st = VB.stats;
    if (!AU.ctx) return 'Voices start after the first tap.';
    if (VB.failed || /failed/.test(VB.status || '')) return 'Recorded voices didn’t load (' + VB.status.replace('failed: ', '') + '). Using the browser’s backup voice.';
    if (VB.status === 'ready') return 'Recorded voices: ready ✓ (' + st.clip + ' lines played from recordings, ' + st.fallback + ' from the backup voice).';
    return 'Recorded voices: loading… (' + Object.keys(VB.banks).length + ' of ' + (VB.manifest ? Object.values(VB.manifest.files).reduce((a, b) => a + b, 0) : '?') + ' files).';
  }
  function testVoices() {
    stopSpeech(); N.unlocked = true;
    say(CT.NARR.misc.tapStart, 'narr', { prio: 2 }); say(CT.NARR_PIP.better, 'pip', { prio: 2 });
    say(CT.SAYS.shoes.support.text, 'adult', { prio: 2 }); say(CT.SCIENCE.bucket.kid, 'pickle', { prio: 2 }); say(CT.FEELINGS.calm.zh, 'zh', { prio: 2 });
  }
  const narrHolding = () => !!(N.cur && N.cur.hold) || N.q.some(i => i.hold);
  function showLine(t) { $('narrText').textContent = t; }
  function talking(on, who) { const n = document.querySelector('.narrator'); n.classList.toggle('talking', !!on && who === 'narr'); }
  const fill = CT.fill;
  const plain = CT.plain;
  const listWords = arr => arr.length <= 1 ? (arr[0] || '') : arr.slice(0, -1).join(', ') + ', and ' + arr[arr.length - 1];
  function setNarrator(on, quiet) {
    prefs.narrator = on; savePrefs();
    const b = $('narrBtn'); b.setAttribute('aria-pressed', on); b.textContent = on ? '📣 Voice' : '🔇 Voice';
    if (!on) stopSpeech(); else if (!quiet) { N.unlocked = true; say(CT.NARR.misc.back, 'narr', { interrupt: true }); }
  }
  $('narrBtn').addEventListener('click', () => setNarrator(!prefs.narrator));
  $('narrReplay').addEventListener('click', () => { N.unlocked = true; if (N.last && N.last.length) say(N.last, 'narr', { interrupt: true }); });

