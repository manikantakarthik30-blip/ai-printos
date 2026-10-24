import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { buildPdf } from '../public/js/services/pdf.js';

test('buildPdf output is a valid one-page PDF (checked with qpdf/pdfinfo when available)', () => {
  const jpeg = readFileSync(new URL('./fixture.jpg', import.meta.url));
  const pdf = buildPdf(new Uint8Array(jpeg), 64, 48, 595.28, 841.89);
  assert.equal(Buffer.from(pdf.slice(0, 5)).toString(), '%PDF-');
  assert.match(Buffer.from(pdf.slice(-6)).toString(), /%%EOF/);
  const f = '/tmp/aiprintos-test.pdf'; writeFileSync(f, pdf);
  try {
    execFileSync('qpdf', ['--check', f], { stdio: 'pipe' });
    const info = execFileSync('pdfinfo', [f]).toString();
    assert.match(info, /Pages:\s+1/); assert.match(info, /Page size:\s+595\.28 x 841\.89/);
  } catch (e) { if (e.code !== 'ENOENT') throw e; }
});
