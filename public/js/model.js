import { uid } from './core/util.js';

export const FONTS = {
  sans: "'Noto Sans Telugu','Noto Sans Devanagari','Nirmala UI','Gautami','Telugu Sangam MN','Segoe UI',system-ui,'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif",
  serif: "'Noto Serif Telugu','Noto Serif Devanagari','Nirmala UI','Telugu MN','Georgia','Times New Roman','Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',serif",
  latin: "system-ui,'Noto Sans Devanagari','Noto Sans Telugu','Segoe UI',Roboto,Arial,'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif"
};
export const FONT_LABEL = { sans: 'Sans (Telugu, Hindi, Latin)', serif: 'Serif (Telugu, Hindi, Latin)', latin: 'System (Latin first)' };
export const PRESETS = [['Social post', 1080, 1080], ['Story', 1080, 1920], ['A4 portrait (210×297 mm)', 794, 1123], ['A4 landscape', 1123, 794], ['A5 flyer (148×210 mm)', 559, 794], ['Invitation 5×7 in', 480, 672], ['Business card 3.5×2 in', 336, 192]];

export const T = (o) => ({ id: uid('t'), type: 'text', name: 'Text', x: 0, y: 0, w: 300, h: 60, opacity: 1, font: 'sans', size: 32, weight: 400, color: '#15171F', align: 'left', lh: 1.5, text: '', ...o });
export const S = (o) => ({ id: uid('s'), type: 'shape', name: 'Shape', shape: 'rect', x: 0, y: 0, w: 100, h: 100, opacity: 1, fill: '#CCCCCC', stroke: '#000000', sw: 0, radius: 0, ...o });
export const newDoc = (name, w, h, bg, els, meta) => {
  const n = new Date().toISOString();
  return { id: uid('d'), v: 1, name, w, h, bg: bg || '#FFFFFF', els: els || [], meta: meta || { origin: 'blank' }, created: n, updated: n };
};

export const HEX = /^#[0-9a-fA-F]{6}$/, SID = /^[A-Za-z0-9_-]{1,100}$/;
const ORIGINS = ['blank', 'template', 'catalog', 'ai', 'import'];
const DATA_IMG = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/;

// Validation for untrusted JSON (file import and localStorage). Images must be data URLs so that
// PNG/PDF export is never blocked by cross-origin canvas tainting and nothing is fetched on load.
export function validate(d) {
  const bad = (m) => { throw new Error(m); };
  const num = (o, k, a, b, p) => { const v = o[k]; if (typeof v !== 'number' || !isFinite(v) || v < a || v > b) bad(`${p}${k} must be a number between ${a} and ${b}`); return v; };
  const str = (o, k, max, p) => { const v = o[k]; if (typeof v !== 'string' || v.length > max) bad(`${p}${k} must be text up to ${max} characters`); return v; };
  const col = (o, k, tr, p) => { const v = o[k]; if (!(HEX.test(v) || (tr && v === 'transparent'))) bad(`${p}${k} must be a hex color like #1A2B3C`); return v; };
  const oneOf = (o, k, list, p) => { if (!list.includes(o[k])) bad(`${p}${k} must be one of ${list.join(', ')}`); return o[k]; };
  try {
    if (!d || typeof d !== 'object' || Array.isArray(d)) bad('Project data must be a JSON object.');
    if (!Number.isInteger(d.v) || d.v < 1) bad('Missing version: this does not look like an AI PrintOS project.');
    if (d.v > 1) bad('This project was saved by a newer version and cannot be opened.');
    if (typeof d.id !== 'string' || !SID.test(d.id)) bad('id must use letters, numbers, - and _ only');
    const out = { id: d.id, v: 1, name: (str(d, 'name', 120, '').trim() || 'Untitled design'), w: num(d, 'w', 1, 20000, ''), h: num(d, 'h', 1, 20000, ''), bg: col(d, 'bg', false, ''), els: [], meta: { origin: 'import' }, created: str(d, 'created', 40, ''), updated: str(d, 'updated', 40, '') };
    if (isNaN(Date.parse(out.created)) || isNaN(Date.parse(out.updated))) bad('created/updated must be dates');
    if (d.meta && typeof d.meta === 'object') {
      out.meta.origin = oneOf(d.meta, 'origin', ORIGINS, 'meta.');
      if (typeof d.meta.prompt === 'string') out.meta.prompt = d.meta.prompt.slice(0, 2000);
      if (typeof d.meta.templateId === 'string') out.meta.templateId = d.meta.templateId.slice(0, 60);
      if (typeof d.meta.productId === 'string') out.meta.productId = d.meta.productId.slice(0, 60);
      if (typeof d.meta.category === 'string') out.meta.category = d.meta.category.slice(0, 40);
      if (typeof d.meta.templateName === 'string') out.meta.templateName = d.meta.templateName.slice(0, 160);
      if (d.meta.print && typeof d.meta.print === 'object') { const pr = d.meta.print; out.meta.print = {}; for (const k of ['wMm', 'hMm', 'bleedMm', 'safeMm']) if (typeof pr[k] === 'number' && isFinite(pr[k]) && pr[k] >= 0 && pr[k] <= 5000) out.meta.print[k] = pr[k]; }
      if (d.meta.source && typeof d.meta.source === 'object') out.meta.source = { licence: String(d.meta.source.licence || '').slice(0, 120), origin: String(d.meta.source.origin || '').slice(0, 120) };
    }
    if (!Array.isArray(d.els) || d.els.length > 500) bad('els must be a list of up to 500 elements');
    const seen = new Set();
    d.els.forEach((e, i) => {
      const p = `els[${i}].`; if (!e || typeof e !== 'object') bad(p + ' must be an object');
      if (typeof e.id !== 'string' || !SID.test(e.id) || seen.has(e.id)) bad(p + 'id must be unique, using letters, numbers, - and _'); seen.add(e.id);
      const b = { id: e.id, name: str(e, 'name', 120, p), x: num(e, 'x', -1e5, 1e5, p), y: num(e, 'y', -1e5, 1e5, p), w: num(e, 'w', 1, 1e5, p), h: num(e, 'h', 1, 1e5, p), opacity: num(e, 'opacity', 0, 1, p) };
      if (e.type === 'text') out.els.push({ ...b, type: 'text', text: str(e, 'text', 20000, p), font: oneOf(e, 'font', Object.keys(FONTS), p), size: num(e, 'size', 1, 2000, p), weight: oneOf(e, 'weight', [400, 600, 700], p), color: col(e, 'color', false, p), align: oneOf(e, 'align', ['left', 'center', 'right'], p), lh: num(e, 'lh', .5, 4, p) });
      else if (e.type === 'shape') out.els.push({ ...b, type: 'shape', shape: oneOf(e, 'shape', ['rect', 'ellipse'], p), fill: col(e, 'fill', true, p), stroke: col(e, 'stroke', true, p), sw: num(e, 'sw', 0, 500, p), radius: num(e, 'radius', 0, 1e4, p), ...(typeof e.placeholder === 'boolean' ? { placeholder: e.placeholder } : {}) });
      else if (e.type === 'image') { const s = str(e, 'src', 14e6, p); if (!DATA_IMG.test(s)) bad(p + 'src must be a PNG/JPEG/WebP/GIF data URL'); out.els.push({ ...b, type: 'image', src: s, alt: str(e, 'alt', 500, p), fit: oneOf(e, 'fit', ['cover', 'contain', 'fill'], p) }); }
      else bad(p + 'type must be text, shape or image');
    });
    return { ok: true, doc: out };
  } catch (err) { return { ok: false, error: err.message }; }
}
