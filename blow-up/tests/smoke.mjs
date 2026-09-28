#!/usr/bin/env node
/* Scripted browser playthrough (PLAN.md A2): drives the real page in headless Chrome over CDP with
   real mouse clicks (trusted events, so audio/speech unlock the same way they do for a real player).
   No test framework, no npm dependency — just Node's built-in fetch and WebSocket (Node 22+).

   Steps: start screen -> Start -> pick "Rushed school day" -> first Say It Differently choice ->
   tap Uh-oh cards until a blow-up -> through all five recovery stages with helper/tool cards ->
   bedtime -> receipt visible -> a day saved in localStorage. Screenshots land in tests/out/
   (gitignored). Fails on any JS console error/exception, a timeout, or a missing expected screen.

   Run: node tests/smoke.mjs   (needs a local Chrome; ~1 minute)
   Debug a failure: screenshots are left in tests/out/ even on failure; add DEBUG=1 for verbose logs. */
'use strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { createServer as createHttpServer } from 'node:http';
import { extname, normalize } from 'node:path';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const GAME_DIR = join(HERE, '..');
const OUT_DIR = join(HERE, 'out');
// Ports are picked fresh each run. With fixed ports, a Chrome or server left over from an earlier
// run could answer instead of the one we just started, serving that run's cached files.
let HTTP_PORT, CDP_PORT;
const DEBUG = !!process.env.DEBUG;
const log = (...a) => console.log('[smoke]', ...a);
const dbg = (...a) => DEBUG && console.log('[smoke:debug]', ...a);
const sleep = ms => new Promise(r => setTimeout(r, ms));

let shot = 0;
const consoleErrors = [];
const requestUrls = new Map();
let httpServer, chromeProc, ws, chromeUserDataDir;
const pending = new Map();
let msgId = 0;

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evalJS(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('page eval threw: ' + JSON.stringify(r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails));
  return r.result && r.result.value;
}

async function exists(selector) {
  return !!(await evalJS(`!!document.querySelector(${JSON.stringify(selector)})`));
}

async function click(selector) {
  const rect = await evalJS(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return null;
    el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`);
  if (!rect) throw new Error('click: not found: ' + selector);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rect.x, y: rect.y });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
  dbg('clicked', selector);
}

async function waitFor(exprOrFn, { timeout = 10000, interval = 200, desc = '' } = {}) {
  const expr = typeof exprOrFn === 'function' ? `(${exprOrFn.toString()})()` : exprOrFn;
  const start = Date.now();
  for (;;) {
    if (await evalJS(expr)) return true;
    if (Date.now() - start > timeout) {
      const where = await evalJS(`JSON.stringify({ url: location.href, ready: document.readyState, modalOpen: !document.getElementById('modal')?.hidden, sheet: document.getElementById('sheet')?.innerHTML.slice(0, 120), loop: window.BUDebug && window.BUDebug.loop(), day: window.BUDebug && window.BUDebug.state() && window.BUDebug.state().t })`).catch(e => String(e));
      throw new Error('waitFor timed out: ' + (desc || expr) + ' — page: ' + where);
    }
    await sleep(interval);
  }
}

async function screenshot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  const file = join(OUT_DIR, String(++shot).padStart(2, '0') + '-' + name + '.png');
  writeFileSync(file, Buffer.from(r.data, 'base64'));
  dbg('screenshot', file);
}

// State from the game's own #debug hook (BUDebug.state() returns the raw sim state) plus whether
// a modal is currently open. Read-only; nothing added to the game for this.
async function readState() {
  return evalJS(`(() => {
    const s = window.BUDebug && window.BUDebug.state();
    const modal = document.getElementById('modal');
    if (!s) return null;
    return { t: s.t, phase: s.phase, pendingKind: s.pending ? s.pending.kind : null,
             blowups: s.blowups.length, done: !!s.done, modalOpen: modal ? !modal.hidden : false };
  })()`);
}

// Handles whatever pop-up is open right now (Say It Differently, Where should we go, the "No
// wonder" validation screen, the breathing guide, predict mode). Returns true if it handled
// something, false if no modal was open, or the string 'unrecognized' if one was open but none of
// the known shapes matched (the caller decides what to do then).
async function handleModalIfOpen() {
  const state = await readState();
  if (!state || !state.modalOpen) return false;
  if (await exists('#sheet [data-how="support"] .choose')) { await click('#sheet [data-how="support"] .choose'); return true; }
  if (await exists('#sheet [data-loc] .choose')) { await click('#sheet [data-loc] .choose'); return true; }
  if (await exists('#sheet [data-go]')) { await click('#sheet [data-go]'); return true; }
  if (await exists('#bStep')) { await click('#sheet [data-close]'); return true; }               // skip the breathing guide animation
  if (await exists('#sheet [data-g]')) { await click('#sheet [data-g]'); return true; }           // predict mode, if it's on
  return 'unrecognized';
}

const RECOVERY_CARDS = {
  eruption: ['close', 'quiet'],
  cooling: ['water', 'stomp', 'squeeze', 'corner', 'breathe'],
  reconnect: ['name', 'here', 'wish'],
  repair: ['sorry', 'fix'],
  learn: ['praise', 'practice'],
};

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  chromeUserDataDir = mkdtempSync(join(tmpdir(), 'blowup-smoke-'));

  HTTP_PORT = await freePort();
  log('starting local server on', HTTP_PORT);
  // Served by Node, not `python3 -m http.server`: Python's listen backlog is 5, and the page asks
  // for 13 scripts and 10 voice files at once, so it reset connections and scripts silently
  // failed to load (the game then never started, with no JS error to show for it).
  httpServer = await serveStatic(GAME_DIR, HTTP_PORT);
  await waitForHttp(`http://127.0.0.1:${HTTP_PORT}/index.html`);

  log('launching headless Chrome');
  const chromeBin = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  chromeProc = spawn(chromeBin, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio',
    '--window-size=1280,900', '--force-device-scale-factor=1',
    '--user-data-dir=' + chromeUserDataDir, '--remote-debugging-port=0', 'about:blank',
  ], { stdio: 'ignore' });
  // With port 0 Chrome picks a free port and writes it to DevToolsActivePort in its own profile
  // folder, so we know we're talking to the browser we just launched.
  CDP_PORT = await readDevToolsPort(chromeUserDataDir);
  await waitForHttp(`http://127.0.0.1:${CDP_PORT}/json/version`);

  const tab = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  const { WebSocket } = globalThis;
  ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  ws.addEventListener('message', ev => {
    const msg = JSON.parse(ev.data);
    if (msg.id != null) {
      const p = pending.get(msg.id);
      if (p) { pending.delete(msg.id); msg.error ? p.reject(new Error('CDP: ' + msg.error.message)) : p.resolve(msg.result); }
      return;
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      const text = (msg.params.args || []).map(a => a.value ?? a.description ?? '').join(' ');
      consoleErrors.push('console.error: ' + text);
    }
    if (msg.method === 'Network.requestWillBeSent') requestUrls.set(msg.params.requestId, msg.params.request.url);
    if (msg.method === 'Network.loadingFailed' && !msg.params.canceled) {
      consoleErrors.push('failed to load ' + (requestUrls.get(msg.params.requestId) || '?') + ': ' + msg.params.errorText);
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      consoleErrors.push('exception: ' + (d.exception && (d.exception.description || d.exception.value) || d.text));
    }
  });
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Network.enable');                     // a failed <script src> fails silently otherwise
  await send('Page.bringToFront');   // a background tab gets its requestAnimationFrame loop throttled, which the game's clock relies on

  log('navigating to the game (#debug)');
  const loaded = new Promise(resolve => {
    const onMsg = ev => { const m = JSON.parse(ev.data); if (m.method === 'Page.loadEventFired') { ws.removeEventListener('message', onMsg); resolve(); } };
    ws.addEventListener('message', onMsg);
  });
  await send('Page.navigate', { url: `http://127.0.0.1:${HTTP_PORT}/index.html#debug` });
  await loaded;

  // --- Step 1: start screen -------------------------------------------------------------------
  log('step 1: start screen');
  await waitFor(`!!document.getElementById('splashGo')`, { desc: 'splash screen' });
  await screenshot('splash');
  await click('#splashGo');

  // --- Step 2: pick a day, turn off narration (nothing to check by ear here) and speed up 2x ---
  log('step 2: pick Rushed school day');
  await waitFor(`!!document.getElementById('goBtn')`, { desc: 'day picker' });
  await click('[data-style="rushed"]');
  await click('#goBtn');
  await waitFor(`document.getElementById('modal').hidden`, { desc: 'day picker closed' });
  // The header (voice toggle, speed) sits behind the day-picker modal, so these only work now that
  // it's closed. The first day shows a guided tour (narrSkip button) before anything else; skip it,
  // then turn narration off so phase transitions don't wait on speech (narrHolding()), and speed up.
  if (await exists('#narrSkip:not([hidden])')) await click('#narrSkip');
  await click('#narrBtn');
  await click('[data-speed="2"]');
  await waitFor(`window.BUDebug.loop().narrator === false`, { desc: 'narration off' });
  await screenshot('day-start');

  // --- Step 3: the first Say It Differently choice, reached by natural progression -------------
  log('step 3: first Say It Differently choice');
  let handledSay = false;
  for (let i = 0; i < 60 && !handledSay; i++) {
    const state = await readState();
    dbg('step3 iter', i, JSON.stringify(state));
    if (state.modalOpen) {
      const wasSay = state.pendingKind === 'say';
      const handled = await handleModalIfOpen();
      if (handled === 'unrecognized') throw new Error('step 3: unrecognized modal open, pendingKind=' + state.pendingKind);
      if (wasSay) { handledSay = true; await sleep(400); await screenshot('first-say-choice'); }
    } else {
      await evalJS(`window.BUDebug.ff(3)`);
      await sleep(60);
    }
  }
  if (!handledSay) throw new Error('step 3: never saw a Say It Differently moment');

  // --- Step 4: tap Uh-oh cards until a blow-up ---------------------------------------------------
  log('step 4: causing a blow-up');
  let blewUp = false;
  for (let i = 0; i < 50 && !blewUp; i++) {
    const state = await readState();
    if (state.blowups >= 1) { blewUp = true; break; }
    if (state.modalOpen) { await handleModalIfOpen(); await sleep(300); continue; }
    const uhohIds = await evalJS(`[...document.querySelectorAll('#cardsUhoh .cardbtn')].map(b => b.dataset.id)`);
    if (!uhohIds || !uhohIds.length) throw new Error('step 4: no Uh-oh cards found in the tray');
    await click(`#cardsUhoh [data-id="${uhohIds[i % uhohIds.length]}"]`);
    await sleep(1100);
  }
  if (!blewUp) throw new Error('step 4: no blow-up after 50 taps');
  await sleep(600);
  await screenshot('blowup');

  // --- Step 5: through all five recovery stages -------------------------------------------------
  log('step 5: recovery stages');
  const seenPhases = new Set();
  let recovered = false;
  let lastPhase = null, phaseCardIdx = 0;
  for (let i = 0; i < 90 && !recovered; i++) {
    const state = await readState();
    seenPhases.add(state.phase);
    if (state.phase === 'day' && !state.modalOpen && !state.pendingKind) { recovered = true; break; }
    if (state.modalOpen) { await handleModalIfOpen(); await sleep(350); continue; }
    if (state.phase !== lastPhase) { lastPhase = state.phase; phaseCardIdx = 0; }
    const ids = RECOVERY_CARDS[state.phase];
    if (ids && ids.length) {
      const id = ids[phaseCardIdx % ids.length]; phaseCardIdx++;
      if (await exists(`.cardbtn[data-id="${id}"]`)) await click(`.cardbtn[data-id="${id}"]`);
      await sleep(1100);
    } else {
      await sleep(400);   // e.g. still in eruption's minimum hold; nothing useful to tap yet
    }
  }
  if (!recovered) throw new Error('step 5: never got back to a normal day; saw phases: ' + [...seenPhases].join(', '));
  log('  recovery stages seen:', [...seenPhases].join(', '));
  await screenshot('recovered');

  // --- Step 5b: a card that's waiting its turn survives a pop-up (PLAN C1, KNOWN-BUGS B2) ---------
  // Tap card A (it flies), then card B (it waits, dashed outline), then fast-forward the engine to
  // its next choice so the pop-up opens while A is still in the air. In 1.3 B was silently dropped
  // here; now it must play once the choice is made.
  log('step 5b: a waiting card survives a pop-up');
  await sleep(1500);                                           // let the last recovery card finish
  const [cardA, cardB] = ['water', 'snack'];
  const t0 = await evalJS(`window.BUDebug.state().t`);
  await click(`.cardbtn[data-id="${cardA}"]`);
  await click(`.cardbtn[data-id="${cardB}"]`);
  if (!await evalJS(`document.querySelector('.cardbtn[data-id="${cardB}"]').classList.contains('queued')`)) {
    throw new Error('step 5b: the second card did not show as waiting (queued outline)');
  }
  await evalJS(`window.BUDebug.ff(900)`);                      // stops at the engine's next choice
  if (!(await readState()).pendingKind) throw new Error('step 5b: no choice left in the day to test with');
  await waitFor(`!document.getElementById('modal').hidden`, { desc: 'the choice pop-up' });
  await screenshot('card-waiting-behind-choice');
  // Make the choice, then wait out the 2.2 s "done ✔" screen that follows it (not a choice itself).
  for (let i = 0; i < 25 && (await readState()).modalOpen; i++) { await handleModalIfOpen(); await sleep(400); }
  if ((await readState()).modalOpen) throw new Error('step 5b: the pop-up never closed');
  await waitFor(`window.BUDebug.state().log.some(e => e.id === '${cardB}' && e.t >= ${t0})`,
    { timeout: 8000, desc: `the waiting card (${cardB}) played after the choice` });
  log(`  ${cardB} waited through the pop-up and played`);

  // --- Step 5c: hiding the tab pauses the clock; returning needs an explicit tap (PLAN C2) --------
  log('step 5c: pause when away');
  const tAway = (await readState()).t;
  // Headless Chrome has no real CDP hook for "the tab is hidden" (Emulation.setEmulatedVisibilityState
  // isn't in this build), so this fakes it the way jsdom-style tests do: override the getters our
  // visibilitychange listener actually reads, then dispatch the real event.
  await evalJS(`(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange')); })()`);
  await sleep(3000);
  if ((await readState()).t !== tAway) throw new Error('step 5c: the clock moved while the tab was hidden');
  if ((await evalJS(`window.BUDebug.loop().phase`)) !== 'AWAY') throw new Error('step 5c: phase never became AWAY');
  await evalJS(`(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange')); })()`);
  await waitFor(`!!document.getElementById('awayGo')`, { desc: 'the "continue Pip\'s day" button' });
  await screenshot('away-continue');
  await click('#awayGo');
  await waitFor(`document.getElementById('modal').hidden && window.BUDebug.loop().phase === 'PLAY'`, { desc: 'back to PLAY' });
  log('  clock stayed put while hidden; resumed only after the tap');

  // --- Step 5d: skipping Flower and candle counts as neither used nor practised (PLAN C3) --------
  log('step 5d: skipped breathing counts as neither');
  const beforeUsed = await evalJS(`window.BUDebug.state().usedTool.breathe || 0`);
  const beforeXp = await evalJS(`window.BUDebug.state().skills.breathe.xp`);
  await click(`.cardbtn[data-id="breathe"]`);
  await waitFor(`!!document.getElementById('bStep')`, { desc: 'the breathing guide' });
  await click('.breath [data-close]');                        // the Skip button, not the auto X close
  await waitFor(`document.getElementById('modal').hidden`, { desc: 'breathing guide closed' });
  await sleep(300);
  const afterUsed = await evalJS(`window.BUDebug.state().usedTool.breathe || 0`);
  const afterXp = await evalJS(`window.BUDebug.state().skills.breathe.xp`);
  if (afterUsed !== beforeUsed) throw new Error(`step 5d: skipping still counted as used (${beforeUsed} -> ${afterUsed})`);
  if (afterXp !== beforeXp) throw new Error(`step 5d: skipping still counted as practice (${beforeXp} -> ${afterXp})`);
  log('  skipped breathing changed neither used nor practice counts');

  // --- Step 6: cruise to bedtime -----------------------------------------------------------------
  log('step 6: cruising to bedtime');
  let atBedtime = false;
  for (let i = 0; i < 300 && !atBedtime; i++) {
    const state = await readState();
    if (state.done) { atBedtime = true; break; }
    if (state.modalOpen) { await handleModalIfOpen(); await sleep(300); continue; }
    await evalJS(`window.BUDebug.ff(15)`);
    await sleep(40);
  }
  if (!atBedtime) throw new Error('step 6: day never finished (S.done stayed false)');

  // --- Step 6b: the meter says "Sleeping", never a red zone label, once bedtime starts (PLAN C4) -
  log('step 6b: the bucket at bedtime');
  await waitFor(`document.getElementById('zonePill').innerHTML.includes('Sleeping')`,
    { timeout: 3000, desc: 'the "Sleeping" bedtime label (KNOWN-BUGS B5)' });
  await screenshot('bedtime-sleeping');

  // --- Step 7: the receipt is visible, and the day was saved -------------------------------------
  log('step 7: the receipt');
  await waitFor(`!!document.querySelector('.receipt')`, { timeout: 15000, desc: 'receipt' });
  await screenshot('receipt');
  const savedDays = await evalJS(`(() => { try { return JSON.parse(localStorage.getItem('blowup.days') || '[]').length; } catch (e) { return -1; } })()`);
  if (savedDays < 1) throw new Error('step 7: no saved day in localStorage (blowup.days)');
  log('  saved days in localStorage:', savedDays);

  const voiceStats = await evalJS(`window.BUDebug.voice()`);
  log('  voice stats:', JSON.stringify(voiceStats));

  if (consoleErrors.length) {
    log('CONSOLE ERRORS SEEN DURING THE RUN:');
    for (const e of consoleErrors) log(' ', e);
    throw new Error(consoleErrors.length + ' console error(s)/exception(s) during the run');
  }

  log('PASS — all steps completed, no console errors. Screenshots in tests/out/');
}

function waitForHttp(url, timeout = 15000) {
  const start = Date.now();
  return (async function poll() {
    try { const r = await fetch(url); if (r.ok || r.status === 404) return; } catch (e) { /* not up yet */ }
    if (Date.now() - start > timeout) throw new Error('timed out waiting for ' + url);
    await sleep(200);
    return poll();
  })();
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.mp3': 'audio/mpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };
function serveStatic(root, port) {
  const server = createHttpServer((req, res) => {
    const rel = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\.])+/, '');
    const file = join(root, rel || 'index.html');
    if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
    try {
      const body = readFileSync(file);
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(body);
    } catch (e) { res.writeHead(404); res.end(); }
  });
  return new Promise((resolve, reject) => { server.on('error', reject); server.listen(port, '127.0.0.1', () => resolve(server)); });
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer(); srv.unref(); srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => { const { port } = srv.address(); srv.close(() => resolve(port)); });
  });
}

async function readDevToolsPort(dir, timeout = 15000) {
  const start = Date.now();
  for (;;) {
    try { const port = parseInt(readFileSync(join(dir, 'DevToolsActivePort'), 'utf8').split('\n')[0], 10); if (port) return port; } catch (e) { /* not written yet */ }
    if (Date.now() - start > timeout) throw new Error('Chrome never reported its debugging port');
    await sleep(100);
  }
}

function cleanup() {
  try { ws && ws.close(); } catch (e) { /* ignore */ }
  try { chromeProc && chromeProc.kill('SIGKILL'); } catch (e) { /* ignore */ }
  try { httpServer && httpServer.close(); } catch (e) { /* ignore */ }
  try { chromeUserDataDir && rmSync(chromeUserDataDir, { recursive: true, force: true }); } catch (e) { /* ignore */ }
}

const watchdog = setTimeout(() => { console.error('[smoke] watchdog: timed out after 5 minutes'); cleanup(); process.exit(1); }, 300000);
try {
  await main();
  clearTimeout(watchdog);
  cleanup();
  process.exit(0);
} catch (err) {
  clearTimeout(watchdog);
  console.error('[smoke] FAIL:', err.message);
  for (const e of consoleErrors) console.error('[smoke]   page:', e);
  cleanup();
  process.exit(1);
}
