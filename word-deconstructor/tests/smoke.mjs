#!/usr/bin/env node
/* Browser smoke test for Say It, Spell It! Runs the real page in headless Chrome with no npm
   dependencies. It checks the two-screen flow, a curated word, unknown-word safety, a
   picture-only word, responsive layout, and browser console errors. */
'use strict';

import { spawn } from 'node:child_process';
import { createServer as createHttpServer } from 'node:http';
import { createServer } from 'node:net';
import { extname, normalize, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const GAME_DIR = join(HERE, '..');
const OUT_DIR = join(HERE, 'out');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const errors = [];
const pending = new Map();
let messageId = 0;
let httpServer, chrome, profile, ws, httpPort;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++messageId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (response.exceptionDetails) throw new Error('page evaluation failed: ' + response.exceptionDetails.text);
  return response.result && response.result.value;
}

async function click(selector) {
  const point = await evaluate(`(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element) return null;
    element.scrollIntoView({ block: 'center' });
    const rect = element.getBoundingClientRect();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  })()`);
  assert(point, 'element not found: ' + selector);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 });
}

async function waitFor(expression, description, timeout = 8000) {
  const start = Date.now();
  while (!(await evaluate(expression))) {
    if (Date.now() - start > timeout) throw new Error('timed out waiting for ' + description);
    await sleep(100);
  }
}

async function screenshot(name) {
  const result = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(OUT_DIR, name + '.png'), Buffer.from(result.data, 'base64'));
}

async function navigate(path = '/index.html') {
  const loaded = new Promise(resolve => {
    const listener = event => {
      const message = JSON.parse(event.data);
      if (message.method === 'Page.loadEventFired') {
        ws.removeEventListener('message', listener);
        resolve();
      }
    };
    ws.addEventListener('message', listener);
  });
  await send('Page.navigate', { url: `http://127.0.0.1:${httpPort}${path}` });
  await loaded;
  await waitFor('document.readyState === "complete"', 'page load');
}

async function typeWord(word) {
  await click('#typeInstead');
  await click('#fallbackInput');
  await send('Input.insertText', { text: word });
  await click('#fallbackForm button[type="submit"]');
  await waitFor('!document.getElementById("resultScreen").hidden', 'result screen');
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  profile = mkdtempSync(join(tmpdir(), 'say-it-spell-it-smoke-'));
  httpPort = await freePort();
  httpServer = await serveStatic(GAME_DIR, httpPort);

  chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio',
    '--window-size=1200,744', '--force-device-scale-factor=1',
    '--user-data-dir=' + profile, '--remote-debugging-port=0', 'about:blank',
  ], { stdio: 'ignore' });

  const cdpPort = await readDevToolsPort(profile);
  await waitForHttp(`http://127.0.0.1:${cdpPort}/json/version`);
  const tab = await (await fetch(`http://127.0.0.1:${cdpPort}/json/new?about:blank`, { method: 'PUT' })).json();
  ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id != null) {
      const waiting = pending.get(message.id);
      if (waiting) {
        pending.delete(message.id);
        message.error ? waiting.reject(new Error(message.error.message)) : waiting.resolve(message.result);
      }
      return;
    }
    if (message.method === 'Runtime.exceptionThrown') {
      const detail = message.params.exceptionDetails;
      errors.push(detail.exception?.description || detail.text);
    }
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      errors.push(message.params.args.map(arg => arg.value ?? arg.description ?? '').join(' '));
    }
  });
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.bringToFront');

  console.log('[smoke] start screen');
  await navigate();
  const start = await evaluate(`({
    startHidden: document.getElementById('startScreen').hidden,
    resultHidden: document.getElementById('resultScreen').hidden,
    heading: document.querySelector('h1').textContent
  })`);
  assert(!start.startHidden && start.resultHidden, 'start and result screens are not mutually exclusive');
  assert(start.heading === 'Say It, Spell It!', 'wrong title');
  await screenshot('01-start');

  console.log('[smoke] curated word: boat');
  await typeWord('boat');
  const boat = await evaluate(`({
    startHidden: document.getElementById('startScreen').hidden,
    resultHidden: document.getElementById('resultScreen').hidden,
    word: document.getElementById('wordBtn').textContent,
    syllables: [...document.querySelectorAll('.syl-btn')].map(x => x.textContent),
    sounds: [...document.querySelectorAll('.snd-btn')].map(x => x.textContent),
    knownHidden: document.getElementById('knownBlock').hidden,
    noteHidden: document.getElementById('newWordNote').hidden,
    labelsPresent: [...document.querySelectorAll('.syl-btn,.snd-btn')].every(x => !!x.getAttribute('aria-label'))
  })`);
  assert(boat.startHidden && !boat.resultHidden, 'result did not replace the start screen');
  assert(boat.word === 'boat', 'wrong result word');
  assert(JSON.stringify(boat.syllables) === '["boat"]', 'wrong boat syllables');
  assert(JSON.stringify(boat.sounds) === '["b","oa","t"]', 'wrong boat sounds');
  assert(!boat.knownHidden && boat.noteHidden && boat.labelsPresent, 'known-word learning controls are incomplete');
  await click('#wordBtn');
  await click('#pictureBtn');
  await screenshot('02-boat');

  console.log('[smoke] unknown ending: cats');
  await navigate();
  await typeWord('cats');
  const cats = await evaluate(`({
    word: document.getElementById('wordBtn').textContent,
    knownHidden: document.getElementById('knownBlock').hidden,
    noteHidden: document.getElementById('newWordNote').hidden,
    note: document.getElementById('newWordNote').textContent
  })`);
  assert(cats.word === 'cats' && cats.knownHidden && !cats.noteHidden, 'unknown ending received an unsafe breakdown');
  assert(cats.note.includes("don't have its picture or sounds"), 'unknown word explanation is inaccurate');
  await screenshot('03-unknown-cats');

  console.log('[smoke] picture-only word: queen');
  await navigate();
  await typeWord('queen');
  const queen = await evaluate(`({
    picture: document.getElementById('pictureBtn').textContent,
    knownHidden: document.getElementById('knownBlock').hidden,
    note: document.getElementById('newWordNote').textContent
  })`);
  assert(queen.picture === '👸' && queen.knownHidden, 'picture-only fallback failed');
  assert(queen.note.includes("here's the picture"), 'picture-only explanation is inaccurate');

  console.log('[smoke] mobile layout');
  await send('Emulation.setDeviceMetricsOverride', { width: 400, height: 800, deviceScaleFactor: 1, mobile: true });
  await navigate();
  await typeWord('teacher');
  const mobile = await evaluate('({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth })');
  assert(mobile.scrollWidth <= mobile.width + 1, `horizontal overflow at 400px (${mobile.scrollWidth} > ${mobile.width})`);
  await screenshot('04-mobile-teacher');

  assert(errors.length === 0, 'browser errors: ' + errors.join(' | '));
  console.log('[smoke] PASS — start, curated, unknown, picture-only, and mobile flows');
}

function serveStatic(root, port) {
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png' };
  const server = createHttpServer((request, response) => {
    const relative = normalize(decodeURIComponent(new URL(request.url, 'http://x').pathname)).replace(/^([/\\.])+/, '');
    const file = join(root, relative || 'index.html');
    if (!file.startsWith(root)) { response.writeHead(403); return response.end(); }
    try {
      response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      response.end(readFileSync(file));
    } catch { response.writeHead(404); response.end(); }
  });
  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function waitForHttp(url, timeout = 15000) {
  const start = Date.now();
  for (;;) {
    try { const response = await fetch(url); if (response.ok || response.status === 404) return; } catch { /* retry */ }
    if (Date.now() - start > timeout) throw new Error('timed out waiting for ' + url);
    await sleep(150);
  }
}

async function readDevToolsPort(directory, timeout = 15000) {
  const start = Date.now();
  for (;;) {
    try {
      const port = Number(readFileSync(join(directory, 'DevToolsActivePort'), 'utf8').split('\n')[0]);
      if (port) return port;
    } catch { /* retry */ }
    if (Date.now() - start > timeout) throw new Error('Chrome did not report its debugging port');
    await sleep(100);
  }
}

function cleanup() {
  try { ws?.close(); } catch { /* ignore */ }
  try { chrome?.kill('SIGKILL'); } catch { /* ignore */ }
  try { httpServer?.close(); } catch { /* ignore */ }
  try { if (profile) rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
}

try {
  await main();
  cleanup();
} catch (error) {
  console.error('[smoke] FAIL:', error.message);
  cleanup();
  process.exitCode = 1;
}
