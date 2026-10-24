import { $, slug } from '../core/util.js';
import { downloadBlob } from '../core/ui.js';
import { FONTS } from '../model.js';
import { buildPdf } from './pdf.js';

export function wrapLines(ctx, text, maxW) {
  const out = [], seg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
  for (const para of text.split('\n')) {
    if (!para) { out.push(''); continue; }
    let line = '';
    for (const word of para.split(/(?<= )/)) {
      const test = line + word;
      if (ctx.measureText(test.trimEnd()).width <= maxW || !line) {
        if (ctx.measureText(word.trimEnd()).width > maxW && !line) {
          let chunk = ''; const parts = seg ? [...seg.segment(word)].map((s) => s.segment) : [...word];
          for (const ch of parts) { if (ctx.measureText(chunk + ch).width > maxW && chunk) { out.push(chunk); chunk = ch; } else chunk += ch; }
          line = chunk;
        } else line = test;
      } else { out.push(line.trimEnd()); line = word; }
    }
    out.push(line.trimEnd());
  }
  return out;
}
const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('An image in this design could not be loaded.')); i.src = src; });

// Draws the design with the browser's own text shaping, so Telugu and emoji match what you see on screen.
export async function renderCanvas(d, sc) {
  const W = Math.round(d.w * sc), H = Math.round(d.h * sc);
  if (W > 16000 || H > 16000 || W * H > 120e6) throw new Error(`${W} × ${H} px is too large for the browser to export. Choose a smaller scale.`);
  if (document.fonts && document.fonts.load) await Promise.all(d.els.filter((e) => e.type === 'text').map((e) => document.fonts.load(`${e.weight} ${e.size}px ${FONTS[e.font]}`, e.text).catch(() => [])));
  if (document.fonts && document.fonts.ready) await document.fonts.ready;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d'); if (!ctx) throw new Error('Canvas is not available in this browser.');
  ctx.scale(sc, sc); ctx.fillStyle = d.bg; ctx.fillRect(0, 0, d.w, d.h);
  for (const e of d.els) {
    ctx.save(); ctx.globalAlpha = e.opacity;
    if (e.type === 'shape') {
      ctx.beginPath();
      if (e.shape === 'ellipse') ctx.ellipse(e.x + e.w / 2, e.y + e.h / 2, e.w / 2, e.h / 2, 0, 0, Math.PI * 2);
      else if (ctx.roundRect) ctx.roundRect(e.x, e.y, e.w, e.h, Math.min(e.radius, e.w / 2, e.h / 2)); else ctx.rect(e.x, e.y, e.w, e.h);
      if (e.fill !== 'transparent') { ctx.fillStyle = e.fill; ctx.fill(); }
      if (e.sw && e.stroke !== 'transparent') { ctx.save(); ctx.clip(); ctx.lineWidth = e.sw * 2; ctx.strokeStyle = e.stroke; ctx.stroke(); ctx.restore(); }
    } else if (e.type === 'image') {
      const im = await loadImg(e.src); let dw = e.w, dh = e.h, dx = e.x, dy = e.y; const ir = im.width / im.height, br = e.w / e.h;
      if (e.fit === 'fill') ctx.drawImage(im, dx, dy, dw, dh);
      else { ctx.beginPath(); ctx.rect(e.x, e.y, e.w, e.h); ctx.clip(); if ((e.fit === 'cover') === (ir > br)) { dh = e.h; dw = e.h * ir; } else { dw = e.w; dh = e.w / ir; } dx = e.x + (e.w - dw) / 2; dy = e.y + (e.h - dh) / 2; ctx.drawImage(im, dx, dy, dw, dh); }
    } else {
      ctx.beginPath(); ctx.rect(e.x, e.y, e.w, e.h); ctx.clip(); ctx.fillStyle = e.color; ctx.font = `${e.weight} ${e.size}px ${FONTS[e.font]}`; ctx.textBaseline = 'middle'; ctx.textAlign = e.align;
      const ax = e.align === 'left' ? e.x : e.align === 'center' ? e.x + e.w / 2 : e.x + e.w;
      wrapLines(ctx, e.text, e.w).forEach((l, i) => ctx.fillText(l, ax, e.y + i * e.size * e.lh + (e.size * e.lh) / 2));
    }
    ctx.restore();
  }
  return cv;
}
const toBlob = (cv, type, q) => new Promise((r) => cv.toBlob(r, type, q));

export async function exportPNG(d) {
  const sc = +($('#exs') && $('#exs').value) || 1, cv = await renderCanvas(d, sc);
  const blob = await toBlob(cv, 'image/png'); if (!blob) throw new Error('The browser could not create the PNG file.');
  downloadBlob(slug(d.name) + '.png', blob); return { W: cv.width, H: cv.height, size: blob.size };
}
// Returns a PNG data URL of the current design (used to hand the design to Adobe Express).
export async function designToDataUrl(d, sc = 1) { return (await renderCanvas(d, sc)).toDataURL('image/png'); }

export async function exportPDF(d) {
  const sc = Math.min(2, Math.max(0.25, 4000 / Math.max(d.w, d.h))), cv = await renderCanvas(d, sc);
  const blob = await toBlob(cv, 'image/jpeg', 0.92); if (!blob) throw new Error('The browser could not encode the page image.');
  const jpeg = new Uint8Array(await blob.arrayBuffer()), pw = d.w * 0.75, ph = d.h * 0.75; // CSS px (96 dpi) -> PDF points (72 dpi)
  if (pw > 14400 || ph > 14400) throw new Error('This size exceeds the PDF page size limit (200 inches).');
  const pdf = buildPdf(jpeg, cv.width, cv.height, pw, ph);
  downloadBlob(slug(d.name) + '.pdf', new Blob([pdf], { type: 'application/pdf' }));
  return { size: pdf.length, pages: 1 };
}

/* ---------- SVG export (editable vector: <rect>, <ellipse>, <text>, <image>) ---------- */
const X = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const measurer = () => document.createElement('canvas').getContext('2d');
async function loadFonts(d) { if (document.fonts && document.fonts.load) await Promise.all(d.els.filter((e) => e.type === 'text').map((e) => document.fonts.load(`${e.weight} ${e.size}px ${FONTS[e.font]}`, e.text).catch(() => []))); }

// Reports text boxes whose wrapped text is taller than the box or has an unbreakable word wider than it.
export async function checkTextFit(d) {
  await loadFonts(d); const ctx = measurer(), bad = [];
  for (const e of d.els) {
    if (e.type !== 'text') continue;
    ctx.font = `${e.weight} ${e.size}px ${FONTS[e.font]}`;
    const lines = wrapLines(ctx, e.text, e.w), tall = lines.length * e.size * e.lh, wide = Math.max(0, ...lines.map((l) => ctx.measureText(l).width));
    if (tall > e.h + 1 || wide > e.w + 1) bad.push({ id: e.id, name: e.name, lines: lines.length, needH: Math.ceil(tall), h: e.h, needW: Math.ceil(wide), w: e.w });
  }
  return bad;
}
export async function designToSVG(d) {
  await loadFonts(d); const ctx = measurer(); let n = 0; const out = [], defs = [];
  for (const e of d.els) {
    const op = e.opacity < 1 ? ` opacity="${e.opacity}"` : '';
    if (e.type === 'shape') {
      const half = e.sw / 2, st = e.sw && e.stroke !== 'transparent' ? ` stroke="${e.stroke}" stroke-width="${e.sw}"` : '', fl = e.fill === 'transparent' ? 'none' : e.fill;
      if (e.shape === 'ellipse') out.push(`<ellipse cx="${e.x + e.w / 2}" cy="${e.y + e.h / 2}" rx="${Math.max(0, e.w / 2 - half)}" ry="${Math.max(0, e.h / 2 - half)}" fill="${fl}"${st}${op}/>`);
      else out.push(`<rect x="${e.x + half}" y="${e.y + half}" width="${Math.max(0, e.w - e.sw)}" height="${Math.max(0, e.h - e.sw)}" rx="${Math.min(e.radius, e.w / 2, e.h / 2)}" fill="${fl}"${st}${op}/>`);
    } else if (e.type === 'image') {
      const id = 'c' + (++n); defs.push(`<clipPath id="${id}"><rect x="${e.x}" y="${e.y}" width="${e.w}" height="${e.h}"/></clipPath>`);
      const par = e.fit === 'fill' ? 'none' : e.fit === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet';
      out.push(`<image x="${e.x}" y="${e.y}" width="${e.w}" height="${e.h}" preserveAspectRatio="${par}" clip-path="url(#${id})" href="${X(e.src)}"${op}><title>${X(e.alt)}</title></image>`);
    } else {
      ctx.font = `${e.weight} ${e.size}px ${FONTS[e.font]}`;
      const lines = wrapLines(ctx, e.text, e.w), ax = e.align === 'left' ? e.x : e.align === 'center' ? e.x + e.w / 2 : e.x + e.w, anchor = { left: 'start', center: 'middle', right: 'end' }[e.align];
      const spans = lines.map((l, i) => `<tspan x="${ax}" y="${Math.round((e.y + i * e.size * e.lh + (e.size * e.lh) / 2) * 100) / 100}">${X(l) || ' '}</tspan>`).join('');
      out.push(`<text font-family="${X(FONTS[e.font])}" font-size="${e.size}" font-weight="${e.weight}" fill="${e.color}" text-anchor="${anchor}" dominant-baseline="central"${op} xml:space="preserve">${spans}</text>`);
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${d.w}" height="${d.h}" viewBox="0 0 ${d.w} ${d.h}"><title>${X(d.name)}</title>${defs.length ? `<defs>${defs.join('')}</defs>` : ''}<rect width="${d.w}" height="${d.h}" fill="${d.bg}"/>${out.join('')}</svg>\n`;
}
export async function exportSVG(d) {
  const svg = await designToSVG(d); downloadBlob(slug(d.name) + '.svg', new Blob([svg], { type: 'image/svg+xml' })); return { size: svg.length };
}
