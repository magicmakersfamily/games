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

function homophoneGroups() {
  const match = html.match(/var HOMOPHONE_GROUPS = (\[[\s\S]*?\n  \]);\n  var HOMOPHONE_INDEX/);
  assert.ok(match, 'homophone groups should be present');
  return Function(`"use strict"; return (${match[1]});`)();
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

test('homophone groups are complete, unique, and include two/to/too', () => {
  const groups = homophoneGroups();
  assert.ok(groups.length >= 25, 'expected a useful reviewed set of common homophones');
  const seen = new Set();
  for (const group of groups) {
    assert.ok(group.length >= 2, 'each homophone group needs at least two spellings');
    for (const choice of group) {
      assert.match(choice.word, /^[a-z]+(?:'[a-z]+)?$/, `invalid spelling: ${choice.word}`);
      assert.ok(choice.pic && choice.clue, `${choice.word}: needs a picture and meaning clue`);
      assert.ok(!seen.has(choice.word), `${choice.word}: appears in more than one group`);
      seen.add(choice.word);
    }
  }
  const twoGroup = groups.find(group => group.some(choice => choice.word === 'two'));
  assert.deepEqual(twoGroup.map(choice => choice.word), ['two', 'to', 'too']);
});

test('live v2.4 matches the reviewed draft except for its draft label', () => {
  assert.equal(html.replace('Version 2.4 draft', 'Version 2.4'), liveHtml);
  assert.match(liveHtml, /Version 2\.4 · Launched/);
  assert.doesNotMatch(liveHtml, /Version 2\.4 draft/);
});

test('unknown endings are not taught using incomplete base-word sounds', () => {
  assert.doesNotMatch(html, /derivedFrom|var stems = \["ing"/);
  assert.match(html, /Correctness beats coverage/);
});

test('recognition echoes only after the microphone ends, and tiles say their letters and sounds', () => {
  assert.match(html, /function speakLetterAndSound\(display, spoken\)/);
  assert.match(html, /display\.toUpperCase\(\)\.split\(""\)\.join\(" "\)/);
  assert.match(html, /speak\(letterNames \+ "\. " \+ spoken, 0\.75\)/);
  assert.match(html, /showResult\(firstWord, \{ echo:false \}\)/);
  assert.match(html, /if \(pendingEcho\)[\s\S]*?speak\(wordToRepeat, 0\.85\)/);
});

test('voice playback is unlocked from a tap and explains a failed start', () => {
  assert.match(html, /function unlockSpeech\(\)/);
  assert.match(html, /Some browsers need one utterance directly from a tap/);
  assert.match(html, /window\.speechSynthesis\.resume\(\)/);
  assert.match(html, /Voice did not start\. Tap Test voice/);
  assert.match(html, /soundTest\.addEventListener\("click"/);
});

test('the child flow and privacy language match the handoff', () => {
  for (const id of ['startScreen', 'resultScreen', 'micBig', 'micSmall', 'soundTest', 'voiceStatus', 'wordBtn', 'pictureBtn', 'syllables', 'sounds', 'playAll']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /I didn't hear a word\. Let's try again\./);
  assert.match(html, /Letters &amp; sounds — tap one/);
  assert.match(html, /may use its own speech service/);
  assert.doesNotMatch(html, /audio never leaves|never sent anywhere/i);
});
