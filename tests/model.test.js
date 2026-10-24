import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.document = { querySelector: () => null };
const { validate, newDoc, T, S } = await import('../public/js/model.js');
const { TPL, buildTpl } = await import('../public/js/data/templates.js');
const { CATALOG } = await import('../public/js/data/catalog.js');

test('every template and a new doc validate', () => { for (const t of TPL) assert.ok(validate(buildTpl(t)).ok, t.id); assert.ok(validate(newDoc('x', 100, 100, '#FFFFFF', [T({ text: 'హాయ్ 😀' }), S({})])).ok); });
test('validate rejects bad data', () => {
  const d = newDoc('x', 100, 100); const bad = (m) => { const r = validate(m(JSON.parse(JSON.stringify(d)))); assert.equal(r.ok, false); };
  bad((x) => { x.bg = 'red'; return x; }); bad((x) => { x.v = 2; return x; }); bad((x) => { x.id = '../x'; return x; });
  bad((x) => { x.els = [{ id: 'a', type: 'image', name: 'i', x: 0, y: 0, w: 1, h: 1, opacity: 1, src: 'https://evil.test/x.png', alt: '', fit: 'cover' }]; return x; });
  bad((x) => { x.els = [{ id: 'a', type: 'image', name: 'i', x: 0, y: 0, w: 1, h: 1, opacity: 1, src: 'data:image/svg+xml;base64,AAAA', alt: '', fit: 'cover' }]; return x; });
  assert.equal(validate(null).ok, false);
});
test('catalog sizes are within editor limits', () => { for (const p of CATALOG) assert.ok(p.w >= 50 && p.w <= 10000 && p.h >= 50 && p.h <= 10000, p.id); });
