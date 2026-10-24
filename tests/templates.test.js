import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
globalThis.document = { querySelector: () => null };
const { validate } = await import('../public/js/model.js');
const pub = new URL('../public/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('templates/manifest.json', pub), 'utf8')), T = manifest.templates;
const EXPECT = { 'visiting-cards': 75, 'wedding-invitations': 75, brochures: 50, flyers: 75, posters: 75, banners: 50, 'stickers-labels': 50, 'product-catalogs': 50 };

function wellFormed(xml) { // minimal XML checker: balanced tags, one root, no stray '<' or '&'
  const body = xml.replace(/^<\?xml[^>]*\?>\s*/, ''); const stack = []; let root = 0;
  for (const m of body.matchAll(/<(\/?)([A-Za-z][\w:-]*)([^<>]*?)(\/?)>/g)) {
    if (m[1]) { if (stack.pop() !== m[2]) return false; } else if (!m[4]) { if (!stack.length) root++; stack.push(m[2]); } else if (!stack.length) root++;
  }
  const text = body.replace(/<[^<>]*>/g, ''); return stack.length === 0 && root === 1 && !/[<>]/.test(text) && !/&(?!amp;|lt;|gt;|quot;|#\d+;)/.test(text);
}

test('manifest has exactly 500 templates in the requested distribution', () => {
  assert.equal(T.length, 500); assert.equal(manifest.total, 500); assert.deepEqual(manifest.counts, EXPECT);
  for (const [cat, n] of Object.entries(EXPECT)) assert.equal(T.filter((t) => t.category === cat).length, n, cat);
});
test('ids and names are unique; every referenced file exists and is non-empty', () => {
  assert.equal(new Set(T.map((t) => t.id)).size, 500); assert.equal(new Set(T.map((t) => t.name)).size, 500);
  for (const t of T) for (const k of ['file', 'svg', 'preview']) { const u = new URL(t[k], pub); assert.ok(existsSync(u) && statSync(u).size > 100, `${t.id} ${k}`); }
});
test('every template validates against the editor model and matches its manifest entry', () => {
  for (const t of T) {
    const d = JSON.parse(readFileSync(new URL(t.file, pub), 'utf8')), v = validate(d); assert.ok(v.ok, `${t.id}: ${v.error}`);
    assert.equal(d.w, t.size.w); assert.equal(d.h, t.size.h); assert.equal(d.meta.templateId, t.id); assert.equal(d.meta.category, t.category);
    assert.equal(d.els.filter((e) => e.type === 'text').length, t.editable.textFields); assert.equal(d.els.filter((e) => e.placeholder).length, t.editable.imagePlaceholders);
  }
});
test('every SVG is well-formed vector markup with no external references', () => {
  for (const t of T) { const x = readFileSync(new URL(t.svg, pub), 'utf8'); assert.ok(wellFormed(x), t.id); assert.match(x, /<svg [^>]*viewBox=/); assert.ok(!/(href|src)="https?:/.test(x), t.id + ' external ref'); assert.ok(/<text /.test(x) && /<rect /.test(x), t.id); }
});
test('no duplicate designs (structural fingerprint) and good category/style spread', () => {
  const sig = new Set(T.map((t) => { const d = JSON.parse(readFileSync(new URL(t.file, pub), 'utf8')); return createHash('sha1').update(JSON.stringify({ w: d.w, h: d.h, bg: d.bg, els: d.els.map(({ id, ...r }) => r) })).digest('hex'); }));
  assert.equal(sig.size, 500);
  for (const cat of Object.keys(EXPECT)) { const ts = T.filter((t) => t.category === cat); assert.ok(new Set(ts.map((t) => t.style)).size >= 18, cat + ' styles'); assert.ok(new Set(ts.map((t) => t.palette)).size >= 8, cat + ' palettes'); assert.equal(new Set(ts.flatMap((t) => t.languages)).size, 3, cat + ' languages'); }
});
test('provenance, licence, print metadata and honest validation status on every entry', () => {
  for (const t of T) {
    assert.equal(t.provenance.origin, 'original'); assert.equal(t.provenance.thirdParty, null); assert.ok(t.licence && t.tags.length >= 6 && t.name);
    assert.ok(t.size.wMm > 0 && t.bleedMm > 0 && t.safeMm > 0 && ['portrait', 'landscape', 'square'].includes(t.size.orientation));
    const v = t.printValidation; assert.equal(v.pressReady, false); assert.equal(v.status, 'layout-checked'); assert.equal(v.textContrastAA, true); assert.equal(v.textInsideSafeArea, true); assert.equal(v.textFits, true); assert.ok(v.minTextPx >= 8);
  }
});
test('telugu and hindi sample copy is NFC-normalized', () => { for (const t of T) { const d = JSON.parse(readFileSync(new URL(t.file, pub), 'utf8')); for (const e of d.els) if (e.type === 'text') assert.equal(e.text, e.text.normalize('NFC')); } });
