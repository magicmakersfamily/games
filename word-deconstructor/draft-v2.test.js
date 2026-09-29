const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const file = path.join(__dirname, 'index-draft-v2.html');
const html = fs.readFileSync(file, 'utf8');
const liveHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

function wordBank() {
  const match = html.match(/var W = (\{[\s\S]*?\n  \});\n  delete W\.jump2/);
  assert.ok(match, 'curated word bank should be present');
  const words = Function(`"use strict"; return (${match[1]});`)();
  delete words.jump2;
  return words;
}

test('draft is a standalone page with the required public-page metadata', () => {
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /<html lang="en">/);
  assert.match(html, /name="viewport"[^>]*viewport-fit=cover/);
  assert.match(html, /property="og:title"/);
  assert.match(html, /property="og:description"/);
  assert.match(html, /property="og:image"/);
  assert.match(html, /href="\.\.\/">← All games<\/a>/);
});

test('embedded JavaScript parses', () => {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 1);
  assert.doesNotThrow(() => Function(scripts[0][1]));
});

test('curated entries preserve the spelling in syllable and sound tiles', () => {
  const words = wordBank();
  assert.ok(Object.keys(words).length >= 150, 'expected the existing substantial curated bank');
  assert.ok(!words.read, 'ambiguous read/read pronunciation must not get one asserted breakdown');

  for (const [word, data] of Object.entries(words)) {
    assert.equal(data.syl.join(''), word, `${word}: syllables should reproduce the spelling`);
    assert.equal(data.snd.map(([letters]) => letters).join(''), word, `${word}: sound tiles should reproduce the spelling`);
    for (const pair of data.snd) {
      assert.equal(pair.length, 2, `${word}: each sound needs display and speech text`);
      assert.ok(pair[0] && pair[1], `${word}: sound fields must not be empty`);
    }
  }
});

test('live v2 matches the reviewed draft except for its draft label', () => {
  assert.equal(html.replace('Version 2.0 draft', 'Version 2.0'), liveHtml);
  assert.match(liveHtml, /Version 2\.0 · Launched/);
  assert.doesNotMatch(liveHtml, /Version 2\.0 draft/);
});

test('unknown endings are not taught using incomplete base-word sounds', () => {
  assert.doesNotMatch(html, /derivedFrom|var stems = \["ing"/);
  assert.match(html, /Correctness beats coverage/);
});

test('the child flow and privacy language match the handoff', () => {
  for (const id of ['startScreen', 'resultScreen', 'micBig', 'micSmall', 'wordBtn', 'pictureBtn', 'syllables', 'sounds', 'playAll']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /I didn't hear a word\. Let's try again\./);
  assert.match(html, /may use its own speech service/);
  assert.doesNotMatch(html, /audio never leaves|never sent anywhere/i);
});
