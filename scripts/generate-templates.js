// Generates the ORIGINAL template library (500 editable designs) as editor-native JSON + a manifest.
// No third-party artwork is used. Run: node scripts/generate-templates.js   then   python3 scripts/bake-templates.py
// (the bake step renders SVG + preview images with real fonts and records text-fit results in the manifest).
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';

const OUT = new URL('../public/templates/', import.meta.url);
const px = (mm) => Math.round((mm / 25.4) * 96), n = (v) => Math.round(v);

/* ---------- categories ---------- */
const CATS = {
  'visiting-cards': { id: 'vc', label: 'Visiting card', count: 75, mm: [90, 54], bleed: 3, safe: 5, font: 'sans' },
  'wedding-invitations': { id: 'wi', label: 'Wedding invitation', count: 75, mm: [127, 178], bleed: 3, safe: 6, font: 'serif' },
  brochures: { id: 'br', label: 'Brochure', count: 50, mm: [297, 210], bleed: 3, safe: 8, font: 'sans' },
  flyers: { id: 'fl', label: 'Flyer', count: 75, mm: [148, 210], bleed: 3, safe: 6, font: 'sans' },
  posters: { id: 'po', label: 'Poster', count: 75, mm: [297, 420], bleed: 3, safe: 10, font: 'sans' },
  banners: { id: 'ba', label: 'Banner', count: 50, mm: [1200, 600], bleed: 10, safe: 30, font: 'sans' },
  'stickers-labels': { id: 'st', label: 'Sticker / label', count: 50, mm: [76, 76], bleed: 2, safe: 4, font: 'sans' },
  'product-catalogs': { id: 'ca', label: 'Product catalog cover', count: 50, mm: [210, 297], bleed: 3, safe: 8, font: 'serif' }
};
const SKEL = ['Banded', 'Centered', 'Sidebar'], DECO = ['Framed', 'Circles', 'Stripes', 'Corners', 'Dots', 'Moon'];
const LANGS = ['en', 'te', 'hi', 'en-te', 'en-hi'];
const PAL = [
  ['Studio Light', '#FFFFFF', '#15171F', '#C21A5E', '#007C99', '#F4F5F8'], ['Midnight Teal', '#0E1B26', '#F2F7FA', '#2EC4B6', '#FFBF69', '#17293A'],
  ['Saffron Cream', '#FFF6E5', '#3A2412', '#E8730C', '#8C2F39', '#FFE7BF'], ['Emerald Gold', '#0B3D2E', '#FDF6E3', '#D4A72C', '#7BC8A4', '#12503C'],
  ['Royal Maroon', '#FBF3EA', '#4A0E1B', '#8C1C32', '#C9972B', '#F2E2CF'], ['Ocean Blue', '#F3F8FF', '#0B2545', '#1666D1', '#F2A900', '#DCE9FB'],
  ['Charcoal Lime', '#1B1D21', '#F5F6F7', '#B8E62E', '#6C8CFF', '#272A30'], ['Blush Rose', '#FFF1F3', '#3B1220', '#D6336C', '#7B5EA7', '#FFDDE4'],
  ['Forest Sand', '#F4EFE6', '#1F3A2A', '#2F7D4F', '#B5651D', '#E6DDCB'], ['Indigo Coral', '#EEF0FF', '#1A1A4E', '#3D3FD1', '#FF6B5B', '#DADDFB'],
  ['Mono Bold', '#FFFFFF', '#000000', '#000000', '#E4002B', '#EFEFEF'], ['Plum Peach', '#2A1233', '#FFF3EC', '#FF9E7A', '#C77DFF', '#3B1C48']
].map(([name, bg, fg, ac, a2, soft]) => ({ name, bg, fg, ac, a2, soft }));

/* ---------- sample copy (placeholder text; has not been reviewed by native speakers) ---------- */
const N = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Array.isArray(v) ? v.map((x) => x.normalize('NFC')) : v.normalize('NFC')]));
const COPY = {
  'visiting-cards': { en: N({ a: 'Lakshmi Rao', b: 'Print & Design Studio', c: 'Sample Street, Your City' }), te: N({ a: 'లక్ష్మి రావు', b: 'ప్రింట్ & డిజైన్ స్టూడియో', c: 'నమూనా వీధి, మీ నగరం' }), hi: N({ a: 'प्रिया शर्मा', b: 'प्रिंट और डिज़ाइन स्टूडियो', c: 'नमूना गली, आपका शहर' }) },
  'wedding-invitations': { en: N({ a: 'Asha & Ravi', b: 'Together with their families', c: 'request the pleasure of your company', d: 'Sunday, 14 March 2027 · 10:30 am', e: 'Sample Hall, Your City' }), te: N({ a: 'ఆశ & రవి', b: 'శుభ వివాహ ఆహ్వానం', c: 'మీ రాకను ఆకాంక్షిస్తూ', d: 'ఆదివారం, 14 మార్చి 2027 · ఉదయం 10:30', e: 'నమూనా హాల్, మీ నగరం' }), hi: N({ a: 'आशा और रवि', b: 'शुभ विवाह आमंत्रण', c: 'आपकी उपस्थिति सादर प्रार्थनीय है', d: 'रविवार, 14 मार्च 2027 · सुबह 10:30 बजे', e: 'नमूना हॉल, आपका शहर' }) },
  brochures: { en: N({ a: 'Our Services', b: 'Quality printing for every occasion', h: ['Design', 'Print', 'Deliver'], p: 'Describe this service in one or two short lines.' }), te: N({ a: 'మా సేవలు', b: 'ప్రతి సందర్భానికి నాణ్యమైన ముద్రణ', h: ['డిజైన్', 'ముద్రణ', 'డెలివరీ'], p: 'ఈ సేవను ఒకటి రెండు చిన్న వాక్యాల్లో వివరించండి.' }), hi: N({ a: 'हमारी सेवाएँ', b: 'हर अवसर के लिए गुणवत्तापूर्ण छपाई', h: ['डिज़ाइन', 'छपाई', 'डिलीवरी'], p: 'इस सेवा का एक-दो छोटी पंक्तियों में वर्णन करें।' }) },
  flyers: { en: N({ a: 'Special Offer', b: '30% off', c: 'Valid on all orders this month.', d: 'Visit us today' }), te: N({ a: 'ప్రత్యేక ఆఫర్', b: '30% తగ్గింపు', c: 'ఈ నెల అన్ని ఆర్డర్లపై వర్తిస్తుంది.', d: 'ఈరోజే సందర్శించండి' }), hi: N({ a: 'विशेष ऑफ़र', b: '30% की छूट', c: 'इस महीने सभी ऑर्डर पर मान्य।', d: 'आज ही आइए' }) },
  posters: { en: N({ a: 'Annual Festival', b: 'Music · Food · Culture', c: '21 November · 6 pm', d: 'Sample Ground, Your City' }), te: N({ a: 'వార్షిక ఉత్సవం', b: 'సంగీతం · ఆహారం · సంస్కృతి', c: '21 నవంబర్ · సాయంత్రం 6', d: 'నమూనా మైదానం, మీ నగరం' }), hi: N({ a: 'वार्षिक उत्सव', b: 'संगीत · भोजन · संस्कृति', c: '21 नवंबर · शाम 6 बजे', d: 'नमूना मैदान, आपका शहर' }) },
  banners: { en: N({ a: 'Grand Opening', b: 'This Friday at 10 am', c: 'Everyone is welcome' }), te: N({ a: 'గ్రాండ్ ఓపెనింగ్', b: 'ఈ శుక్రవారం ఉదయం 10 గంటలకు', c: 'అందరికీ స్వాగతం' }), hi: N({ a: 'भव्य उद्घाटन', b: 'इस शुक्रवार सुबह 10 बजे', c: 'सभी का स्वागत है' }) },
  'stickers-labels': { en: N({ a: 'Fresh & Handmade', b: 'Small batch', c: 'Made with care' }), te: N({ a: 'తాజా & చేతితో చేసినది', b: 'చిన్న బ్యాచ్', c: 'శ్రద్ధతో తయారు' }), hi: N({ a: 'ताज़ा और हस्तनिर्मित', b: 'छोटा बैच', c: 'देखभाल से बना' }) },
  'product-catalogs': { en: N({ a: 'Product Catalog', b: 'Collection 2027', c: 'Product name', d: 'www.example.com' }), te: N({ a: 'ఉత్పత్తుల కేటలాగ్', b: 'కలెక్షన్ 2027', c: 'ఉత్పత్తి పేరు', d: 'www.example.com' }), hi: N({ a: 'उत्पाद सूची', b: 'संग्रह 2027', c: 'उत्पाद का नाम', d: 'www.example.com' }) }
};
const CONTACT = ['hello@example.com', '+00 00000 00000', 'www.example.com'];

/* ---------- colour helpers ---------- */
const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
export const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const bestOn = (bg) => (contrast('#FFFFFF', bg) >= contrast('#111111', bg) ? '#FFFFFF' : '#111111');
const ink = (want, bg) => (contrast(want, bg) >= 4.5 ? want : bestOn(bg));

/* ---------- element builders ---------- */
function Ctx(cat, lang, P, v, deco) {
  const C = CATS[cat], [wm, hm] = C.mm, W = px(wm), H = px(hm), u = Math.min(W, H) / 100, M = Math.max(px(C.safe) + 2, Math.round(6 * u));
  const parts = lang.split('-'), L1 = COPY[cat][parts[0]], L2 = parts[1] ? COPY[cat][parts[1]] : null;
  return { cat, W, H, u, M, P, v, deco, lang, L1, L2, s1: parts[0], s2: parts[1] || parts[0], font: C.font, els: [], texts: [] };
}
const rect = (c, x, y, w, h, fill, name, o = {}) => c.els.push({ type: 'shape', name, shape: 'rect', x: n(x), y: n(y), w: n(w), h: n(h), opacity: o.op ?? 1, fill, stroke: o.stroke || '#000000', sw: o.sw || 0, radius: n(o.r || 0), ...(o.ph ? { placeholder: true } : {}) });
const oval = (c, x, y, w, h, fill, name, o = {}) => c.els.push({ type: 'shape', name, shape: 'ellipse', x: n(x), y: n(y), w: n(w), h: n(h), opacity: o.op ?? 1, fill, stroke: o.stroke || '#000000', sw: o.sw || 0, radius: 0, ...(o.ph ? { placeholder: true } : {}) });
const photo = (c, x, y, w, h, name = 'Image placeholder', round = false) => (round ? oval : rect)(c, x, y, w, h, c.P.soft, name, { stroke: c.P.a2, sw: Math.max(1, n(c.u * 0.4)), ph: true });
// Text with a size estimate so the box is tall enough; sizes are in "u" (1u = 1% of the short side).
function tx(c, text, x, y, w, size, o = {}) {
  const sc = o.script || 'en', k = sc === 'en' ? 1 : 0.84, cw = sc === 'en' ? (o.bold ? 0.62 : 0.58) : 0.78, lh = o.lh || (sc === 'en' ? 1.25 : 1.65), max = o.max || 2;
  let fs = Math.max(8, n(size * c.u * k)), lines;
  const count = (f) => text.split('\n').reduce((a, l) => a + Math.max(1, Math.ceil((l.length * cw * f) / w)), 0);
  for (lines = count(fs); lines > max && fs > 8; lines = count(fs)) fs -= 1;
  const h = Math.ceil(lines * fs * lh) + 2, bg = o.bg || c.P.bg, color = ink(o.color || c.P.fg, bg);
  const el = { type: 'text', name: o.name || 'Text', x: n(x), y: n(y), w: n(w), h, opacity: 1, font: c.font, size: fs, weight: o.bold ? 700 : 400, color, align: o.align || 'left', lh, text };
  c.els.push(el); c.texts.push({ el, bg }); return { y2: y + h, h };
}
function decorate(c) {
  const { W, H, u, P, deco, M } = c, a = [];
  const before = c.els.length;
  if (deco === 0) rect(c, M / 2, M / 2, W - M, H - M, 'transparent', 'Frame', { stroke: P.a2, sw: Math.max(1, n(u * 0.5)) });
  if (deco === 1) { oval(c, W - 34 * u, -16 * u, 50 * u, 50 * u, P.a2, 'Circle A', { op: 0.16 }); oval(c, -18 * u, H - 28 * u, 40 * u, 40 * u, P.ac, 'Circle B', { op: 0.14 }); }
  if (deco === 2) for (let i = 0; i < 3; i++) rect(c, 0, H - (3 + i * 2.2) * u - M * 0.3, W, Math.max(1, u * 0.8), i === 1 ? P.a2 : P.ac, 'Stripe ' + (i + 1));
  if (deco === 3) { const s = 5 * u; [[0, 0], [W - s, 0], [0, H - s], [W - s, H - s]].forEach(([x, y], i) => rect(c, x, y, s, s, i % 3 === 0 ? P.ac : P.a2, 'Corner ' + (i + 1))); }
  if (deco === 4) for (let i = 0; i < 5; i++) oval(c, W / 2 - 14 * u + i * 6 * u, H - M * 0.8 - 1.5 * u, 3 * u, 3 * u, i % 2 ? P.a2 : P.ac, 'Dot ' + (i + 1));
  if (deco === 5) oval(c, W - 30 * u, H - 24 * u, 52 * u, 52 * u, P.soft === P.bg ? P.a2 : P.ac, 'Moon', { op: 0.2 });
  // decorations sit behind the content
  const added = c.els.splice(before); c.els.unshift(...added); return a;
}
// Header with three skeletons: 0 banded, 1 centered, 2 sidebar. Returns where the body may start.
function head(c, t1, t2, o) {
  const { W, H, u, M, P, v } = c; let x = M, w = W - 2 * M, al = 'left', bg = P.bg, y = M;
  const s1 = c.s1, s2 = c.s2;
  if (v === 0) {
    bg = P.ac; const col = bestOn(P.ac), start = c.els.length, bandIdx = c.els.length;
    rect(c, 0, 0, W, 10, P.ac, 'Header band');
    let r = tx(c, t1, x, M * 0.9, w, o.ts, { bold: 1, color: col, bg, script: s1, max: o.max || 2 }); y = r.y2;
    if (t2) { r = tx(c, t2, x, y + u, w, o.ss, { color: col, bg, script: s2, max: 2 }); y = r.y2; }
    c.els[bandIdx].h = n(Math.max(y + M * 0.7, H * (o.band || 0.25))); y = c.els[bandIdx].h + M * 0.6; bg = P.bg; void start;
  } else if (v === 1) {
    al = 'center'; let r = tx(c, t1, x, y, w, o.ts, { bold: 1, script: s1, align: 'center', max: o.max || 2, color: P.fg }); y = r.y2 + u * 1.2;
    rect(c, W / 2 - 9 * u, y, 18 * u, Math.max(2, u * 0.9), P.ac, 'Accent rule'); y += u * 3;
    if (t2) { r = tx(c, t2, x, y, w, o.ss, { script: s2, align: 'center', max: 2, color: P.fg }); y = r.y2 + u * 1.5; }
  } else {
    const sb = Math.max(8, n(W * 0.035)); rect(c, 0, 0, sb, H, P.ac, 'Side bar'); x = M + sb; w = W - x - M;
    let r = tx(c, t1, x, y, w, o.ts, { bold: 1, script: s1, max: o.max || 2, color: P.fg }); y = r.y2 + u;
    if (t2) { r = tx(c, t2, x, y, w, o.ss, { script: s2, max: 2, color: P.a2 }); y = r.y2 + u * 1.5; }
  }
  return { x, y, w, al, bg, idx: c.els.length };
}
// Centres the body block in the space left under the header (text-only layouts would otherwise leave the bottom empty).
const balance = (c, from, max = 18) => { const els = c.els.slice(from); if (!els.length) return; const free = c.H - c.M - Math.max(...els.map((e) => e.y + e.h)); const sh = Math.max(0, Math.min(free / 2, max * c.u)); els.forEach((e) => { e.y = n(e.y + sh); }); };
const body = (c, text, h, y, o = {}) => tx(c, text, h.x, y, o.w || h.w, o.size || 4, { script: o.script || c.s1, align: o.align || h.al, bold: o.bold, color: o.color, bg: o.bg || h.bg, max: o.max || 3, ...o.rest });
const pill = (c, label, cx, y, w, size, script) => { const h = Math.round(size * c.u * 2.4); rect(c, cx, y, w, h, c.P.ac, 'Button', { r: h / 2 }); tx(c, label, cx + 4, y + (h - size * c.u * 1.3) / 2, w - 8, size, { bold: 1, align: 'center', color: c.P.ac === '#000000' ? '#FFFFFF' : bestOn(c.P.ac), bg: c.P.ac, script, max: 1, lh: 1.2 }); return y + h; };
const two = (c, k) => (c.L2 ? c.L2[k] : c.L1[k]); const s2of = (c) => (c.L2 ? c.s2 : c.s1);

/* ---------- category layouts ---------- */
const LAY = {
  'visiting-cards'(c) {
    const h = head(c, c.L1.a, two(c, 'b'), { ts: 8.4, ss: 4.7, band: 0.4, max: 1 }); let y = h.y;
    const small = { size: 4.6, max: 1 }; CONTACT.forEach((t) => { y = body(c, t, h, y, small).y2 + 1; });
    body(c, two(c, 'c'), h, y + 2, small); balance(c, h.idx, 10); if (c.v !== 1) photo(c, c.W - c.M - 14 * c.u, c.H - c.M - 14 * c.u, 14 * c.u, 14 * c.u, 'Logo placeholder');
  },
  'wedding-invitations'(c) {
    const h = head(c, c.L1.a, c.L1.b, { ts: 11, ss: 4.6, band: 0.3, max: 2 }); let y = h.y;
    if (c.v === 1) { photo(c, c.W / 2 - 13 * c.u, y, 26 * c.u, 26 * c.u, 'Photo placeholder', true); y += 28 * c.u; }
    y = body(c, c.L1.c, h, y, { size: 4.6, max: 2 }).y2 + c.u * 2; y = body(c, c.L1.d, h, y, { size: 4.8, bold: 1, max: 2 }).y2 + c.u; y = body(c, c.L1.e, h, y, { size: 4.6, max: 2 }).y2 + c.u * 2;
    if (c.L2) body(c, c.L2.a + '\n' + c.L2.d, h, y, { size: 4.8, script: c.s2, max: 3 });
    balance(c, h.idx, 14);
  },
  brochures(c) {
    const h = head(c, c.L1.a, two(c, 'b'), { ts: 9, ss: 4, band: 0.28, max: 1 }), gap = c.u * 4, cw = (c.W - 2 * c.M - 2 * gap) / 3; let bottom = 0;
    for (let i = 0; i < 3; i++) {
      const x = c.M + i * (cw + gap); photo(c, x, h.y, cw, 20 * c.u, 'Image placeholder ' + (i + 1));
      let r = tx(c, c.L1.h[i], x, h.y + 22 * c.u, cw, 4.6, { bold: 1, script: c.s1, max: 1 });
      r = tx(c, c.L2 ? c.L2.p : c.L1.p, x, r.y2 + c.u, cw, 3.4, { script: s2of(c), max: 3 }); bottom = Math.max(bottom, r.y2);
    }
  },
  flyers(c) {
    const h = head(c, c.L1.a, two(c, 'a') === c.L1.a ? null : two(c, 'a'), { ts: 11, ss: 6, band: 0.24, max: 2 }); let y = h.y;
    y = body(c, c.L1.b, h, y, { size: 15, bold: 1, color: c.P.ac, max: 2 }).y2 + c.u * 2;
    photo(c, h.x, y, h.w, 22 * c.u, 'Image placeholder'); y += 24 * c.u;
    y = body(c, two(c, 'c'), h, y, { size: 4.2, script: s2of(c), max: 2 }).y2 + c.u * 3;
    pill(c, two(c, 'd'), h.al === 'center' ? c.W / 2 - 22 * c.u : h.x, Math.min(y, c.H - c.M - 10 * c.u), 44 * c.u, 4.4, s2of(c));
  },
  posters(c) {
    const h = head(c, c.L1.a, two(c, 'a') === c.L1.a ? null : two(c, 'a'), { ts: 13, ss: 6.5, band: 0.22, max: 2 }); let y = h.y;
    photo(c, h.x, y, h.w, 40 * c.W / c.H * c.u * 1.9, 'Hero image placeholder'); y += 40 * c.W / c.H * c.u * 1.9 + c.u * 3;
    y = body(c, c.L1.b, h, y, { size: 5.6, bold: 1, max: 2 }).y2 + c.u * 1.5; y = body(c, c.L1.c, h, y, { size: 4.6, color: c.P.a2, bold: 1, max: 1 }).y2 + c.u; body(c, two(c, 'd'), h, y, { size: 4.2, script: s2of(c), max: 2 });
  },
  banners(c) {
    const h = head(c, c.L1.a, null, { ts: 12, ss: 5, band: 0.5, max: 1 }); let y = h.y;
    y = body(c, c.L1.b, h, y, { size: 7, bold: 1, w: h.w * 0.62, max: 1 }).y2 + c.u * 3; if (c.L2) y = body(c, c.L2.a + ' · ' + c.L2.b, h, y, { size: 5, script: c.s2, w: h.w * 0.62, max: 1 }).y2 + c.u * 3;
    pill(c, two(c, 'c'), h.x, Math.min(y, c.H - c.M - 14 * c.u), 52 * c.u, 5.2, s2of(c)); photo(c, c.W - c.M - 62 * c.u, Math.max(h.y, c.H * 0.3), 62 * c.u, 62 * c.u, 'Image placeholder');
  },
  'stickers-labels'(c) {
    const { W, H, u, P } = c; c.els.length = 0; const pad = Math.round(c.M * 0.4);
    if (c.v === 1) oval(c, pad, pad, W - 2 * pad, H - 2 * pad, P.ac, 'Label shape'); else rect(c, pad, pad, W - 2 * pad, H - 2 * pad, P.ac, 'Label shape', { r: c.v === 0 ? 8 * u : 2 * u });
    const col = bestOn(P.ac), x = c.M + (c.v === 1 ? 6 * u : 0), w = W - 2 * x; let y = H * 0.24;
    if (c.v === 2) { rect(c, pad, pad, Math.max(8, W * 0.06), H - 2 * pad, P.a2, 'Side stripe'); }
    const lt = P.bg, d = c.deco, r0 = pad + 3 * u;   // decoration drawn on the label itself, in the background colour
    if (d === 0) (c.v === 1 ? oval : rect)(c, r0, r0, W - 2 * r0, H - 2 * r0, 'transparent', 'Inner ring', { stroke: lt, sw: Math.max(1, n(u * 0.5)), r: c.v === 1 ? 0 : 5 * u });
    if (d === 1) { oval(c, W * 0.62, H * 0.1, 22 * u, 22 * u, lt, 'Circle A', { op: 0.22 }); oval(c, W * 0.1, H * 0.66, 18 * u, 18 * u, lt, 'Circle B', { op: 0.18 }); }
    if (d === 2) { rect(c, x, H * 0.17, w, Math.max(2, u * 0.7), lt, 'Rule top', { op: 0.8 }); rect(c, x, H * 0.86, w, Math.max(2, u * 0.7), lt, 'Rule bottom', { op: 0.8 }); }
    if (d === 3) [[0.16, 0.5], [0.5, 0.14], [0.84, 0.5], [0.5, 0.88]].forEach(([fx, fy], i) => rect(c, W * fx - 1.5 * u, H * fy - 1.5 * u, 3 * u, 3 * u, lt, 'Mark ' + (i + 1), { op: 0.85 }));
    if (d === 4) for (let i = 0; i < 5; i++) oval(c, W / 2 - 14 * u + i * 6 * u, H * 0.16, 3 * u, 3 * u, lt, 'Dot ' + (i + 1), { op: 0.85 });
    if (d === 5) oval(c, W * 0.5, H * 0.45, 70 * u, 70 * u, lt, 'Moon', { op: 0.16 });
    y = tx(c, c.L1.a, x, y, w, 9, { bold: 1, color: col, bg: P.ac, script: c.s1, align: 'center', max: 2 }).y2 + u * 2;
    y = tx(c, two(c, 'b'), x, y, w, 5.4, { color: col, bg: P.ac, script: s2of(c), align: 'center', max: 1 }).y2 + u * 2;
    tx(c, two(c, 'c'), x, Math.min(y + u, H - c.M - 7 * u), w, 4.4, { color: col, bg: P.ac, script: s2of(c), align: 'center', max: 1 });
    decorate.skip = true;
  },
  'product-catalogs'(c) {
    const h = head(c, c.L1.a, two(c, 'b'), { ts: 11, ss: 5, band: 0.3, max: 2 }), gap = c.u * 4, cw = (c.W - 2 * c.M - gap) / 2, ph = 24 * c.u; let y = h.y;
    for (let r = 0; r < 2; r++) for (let k = 0; k < 2; k++) { const x = c.M + k * (cw + gap), yy = y + r * (ph + 14 * c.u); photo(c, x, yy, cw, ph, `Product image ${r * 2 + k + 1}`); tx(c, two(c, 'c') + ' ' + (r * 2 + k + 1), x, yy + ph + c.u, cw, 4, { bold: 1, script: s2of(c), max: 1 }); }
    tx(c, c.L1.d, c.M, c.H - c.M - 6 * c.u, c.W - 2 * c.M, 3.6, { script: 'en', align: h.al === 'center' ? 'center' : 'left', max: 1 });
  }
};

/* ---------- build ---------- */
rmSync(OUT, { recursive: true, force: true }); mkdirSync(OUT, { recursive: true });
const manifest = [], seen = new Set(), pad = (i) => String(i).padStart(3, '0'); let issues = 0;
for (const [cat, C] of Object.entries(CATS)) {
  mkdirSync(new URL(cat + '/', OUT), { recursive: true });
  for (let i = 0; i < C.count; i++) {
    const layout = i % 18, k = Math.floor(i / 18), combo = (k * 13 + layout * 5) % 60;
    const v = layout % 3, deco = Math.floor(layout / 3), P = PAL[combo % 12], lang = LANGS[Math.floor(combo / 12)];
    const c = Ctx(cat, lang, P, v, deco); LAY[cat](c);
    if (!decorate.skip) decorate(c); decorate.skip = false;
    c.els.forEach((e, j) => { e.id = 'e' + (j + 1); });
    const bg = P.bg, id = `${C.id}-${pad(i + 1)}`;
    // ----- checks recorded in the manifest -----
    const minPx = Math.min(...c.texts.map((t) => t.el.size)), lowContrast = c.texts.filter((t) => contrast(t.el.color, t.bg) < 4.5).length;
    const safePx = px(C.safe), out = c.texts.filter(({ el }) => el.x < safePx - 1 || el.y < safePx - 1 || el.x + el.w > c.W - safePx + 1 || el.y + el.h > c.H - safePx + 1).length;
    const style = `${SKEL[v]} ${DECO[deco]}`, langName = { en: 'English', te: 'Telugu', hi: 'Hindi', 'en-te': 'English + Telugu', 'en-hi': 'English + Hindi' }[lang];
    const doc = { v: 1, id, name: `${C.label} · ${P.name} ${style} (${langName})`, w: c.W, h: c.H, bg, els: c.els, meta: { origin: 'template', templateId: id, category: cat, templateName: `${P.name} ${style}`, print: { wMm: C.mm[0], hMm: C.mm[1], bleedMm: C.bleed, safeMm: C.safe }, source: { licence: 'Original work, no third-party content', origin: 'AI PrintOS generator' } }, created: '2026-10-22T00:00:00.000Z', updated: '2026-10-22T00:00:00.000Z' };
    const sig = createHash('sha1').update(JSON.stringify({ w: c.W, h: c.H, bg, els: doc.els.map(({ id: _x, ...r }) => r) })).digest('hex');
    if (seen.has(sig)) { console.error('DUPLICATE', id); issues++; } seen.add(sig);
    if (lowContrast || out) { console.error(`${id}: lowContrast=${lowContrast} outsideSafe=${out}`); issues++; }
    writeFileSync(new URL(`${cat}/${id}.json`, OUT), JSON.stringify(doc));
    manifest.push({
      id, name: doc.name, category: cat, categoryLabel: C.label, style: style.toLowerCase(), palette: P.name, languages: lang.split('-'), tags: [...new Set([cat, C.label.toLowerCase(), SKEL[v].toLowerCase(), DECO[deco].toLowerCase(), P.name.toLowerCase(), ...lang.split('-'), lang.includes('-') ? 'bilingual' : 'single-language', lum(bg) < 0.2 ? 'dark' : 'light'])],
      size: { w: c.W, h: c.H, unit: 'px', dpi: 96, wMm: C.mm[0], hMm: C.mm[1], orientation: c.W === c.H ? 'square' : c.W > c.H ? 'landscape' : 'portrait' }, bleedMm: C.bleed, safeMm: C.safe,
      suggestedPrint: `${C.mm[0]} × ${C.mm[1]} mm trim, ${C.bleed} mm bleed`,
      file: `templates/${cat}/${id}.json`, svg: `templates/${cat}/${id}.svg`, preview: `templates/${cat}/${id}.webp`,
      editable: { textFields: c.els.filter((e) => e.type === 'text').length, imagePlaceholders: c.els.filter((e) => e.placeholder).length, shapes: c.els.filter((e) => e.type === 'shape').length, elementTypes: [...new Set(c.els.map((e) => e.type))] },
      provenance: { origin: 'original', author: 'AI PrintOS project', generator: 'scripts/generate-templates.js', thirdParty: null }, licence: 'Original work, no third-party content; no attribution required',
      printValidation: { status: 'layout-checked', pressReady: false, textContrastAA: lowContrast === 0, textInsideSafeArea: out === 0, minTextPx: minPx, textFits: null, notes: 'Trim size, safe area and contrast checked. Bleed art, CMYK conversion and font outlining are NOT validated, so this is not press-ready.' }
    });
  }
}
const counts = Object.fromEntries(Object.keys(CATS).map((k) => [k, manifest.filter((m) => m.category === k).length]));
writeFileSync(new URL('manifest.json', OUT), JSON.stringify({ version: 1, generated: '2026-10-22', total: manifest.length, counts, copyNote: 'Sample copy is placeholder text and has not been reviewed by native speakers.', templates: manifest }));
console.log('templates', manifest.length, counts, 'unique layouts', seen.size, 'issues', issues);
