// Minimal single-page PDF writer (no dependencies). Embeds one JPEG image as the full page.
// The page is a raster image, so text in the PDF is not selectable (documented limitation).
export function buildPdf(jpeg, imgW, imgH, pageW, pageH) {
  const enc = new TextEncoder(), parts = [], off = []; let len = 0;
  const push = (u8) => { parts.push(u8); len += u8.length; };
  const str = (s) => push(enc.encode(s));
  const obj = (n, body) => { off[n] = len; str(`${n} 0 obj\n${body}\nendobj\n`); };
  const f = (n) => (Math.round(n * 100) / 100).toString();
  str('%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${f(pageW)} ${f(pageH)}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  off[4] = len;
  str(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
  push(jpeg); str('\nendstream\nendobj\n');
  const content = `q ${f(pageW)} 0 0 ${f(pageH)} 0 0 cm /Im0 Do Q`;
  obj(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  const xref = len;
  str('xref\n0 6\n0000000000 65535 f \n' + [1, 2, 3, 4, 5].map((n) => String(off[n]).padStart(10, '0') + ' 00000 n \n').join(''));
  str(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(len); let p = 0; for (const u of parts) { out.set(u, p); p += u.length; }
  return out;
}
