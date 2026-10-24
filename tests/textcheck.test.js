import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reviewText, unicodeIssues, spellEnglish, protectedSpans, applyIssue } from '../public/js/services/textcheck.js';

const dict = new Set(readFileSync(new URL('../public/data/dict/en_US.words.txt', import.meta.url), 'utf8').split(/\r?\n/).map((w) => w.trim()).filter(Boolean));
const sp = (t) => spellEnglish(t, dict).map((i) => i.word);

test('english spelling flags typos and offers suggestions, never auto-edits', () => {
  assert.deepEqual(sp('Welcome to our printting studio'), ['printting']);
  const i = spellEnglish('We recieve orders', dict)[0]; assert.ok(i.suggestions.includes('receive')); assert.equal(applyIssue('We recieve orders', i, 'receive'), 'We receive orders');
  assert.deepEqual(sp('Fresh handmade quickly running'), []);
});
test('protected tokens are never flagged', () => {
  const t = 'Mail hello@kfcprint.in or call +91 98765 43210, visit www.exmpl.in, SKU AB-1234x, price ₹1,299.50, on 14/03/2026, Ravi, NASA, 10th';
  assert.deepEqual(sp(t), []); assert.ok(protectedSpans(t).length >= 6);
});
test('telugu and hindi unicode checks', () => {
  const kinds = (t) => unicodeIssues(t).map((i) => i.type);
  assert.deepEqual(kinds('నమస్కారం పెళ్లికి శుభాకాంక్షలు'), []);
  assert.deepEqual(kinds('नमस्ते विवाह आमंत्रण'), []);
  assert.ok(kinds('ా నమస్కారం').includes('orphan-sign'));
  assert.ok(kinds('కాా').includes('double-vowel-sign'));
  assert.ok(kinds('\u093E \u0928\u092E\u0938\u094D\u0924\u0947').includes('orphan-sign'));
  assert.ok(kinds('క్్ష').includes('double-virama'));
  assert.ok(kinds('hello  world , ok').filter((x) => x === 'spacing').length === 2);
  assert.ok(kinds('Welcomeనమస్కారం').includes('mixed-script'));
  assert.ok(kinds('e\u0301').includes('normalization'));
});
test('review combines checks in document order', () => {
  const r = reviewText('Helo  ప్రింట్', dict); assert.deepEqual(r.map((x) => x.type), ['spelling', 'spacing']);
});

test('suggestions keep the capitalization of the typed word', () => {
  const i = spellEnglish('Welcom to Printing', dict)[0]; assert.equal(i.suggestions[0], 'Welcome');
  assert.equal(spellEnglish('see you tomorow', dict)[0].suggestions[0], 'tomorrow');
});
test('protected tokens are not reported as issues even next to typos', () => {
  const t = 'Welcom! Call +91 98765 43210 or hello@kfcprint.in SKU AB-1234 on 14/03/2026 for ₹1,299';
  assert.deepEqual(spellEnglish(t, dict).map((i) => i.word), ['Welcom']);
});
