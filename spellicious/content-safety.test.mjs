import test from 'node:test';
import assert from 'node:assert/strict';
import safety from './content-safety.js';

test('safe words remain safe', () => {
    assert.equal(safety.check('apple').blocked, false);
    assert.equal(safety.check('classroom').blocked, false);
});

test('uppercase and punctuation variants are blocked', () => {
    assert.equal(safety.check('ASSHOLE').blocked, true);
    assert.equal(safety.check('ass-hole').blocked, true);
    assert.equal(safety.check('a.s.s.h.o.l.e').blocked, true);
});

test('blocked content in a phrase is blocked', () => {
    assert.equal(safety.check('you asshole').blocked, true);
});

test('partial innocent matches are not blocked', () => {
    assert.equal(safety.check('class').blocked, false);
    assert.equal(safety.check('assignment').blocked, false);
    assert.equal(safety.check('assassin').blocked, false);
});

test('check returns normalized text without exposing raw input', () => {
    assert.deepEqual(safety.check('  Hello!!!  '), { normalized: 'hello', blocked: false });
});
