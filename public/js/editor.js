import { $, $$, esc, uid, clamp, hasTe, ic } from './core/util.js';
import { st, route } from './core/state.js';
import { toast, dlg, downloadText } from './core/ui.js';
import { on } from './core/actions.js';
import { T, S, PRESETS, FONTS, FONT_LABEL, HEX } from './model.js';
import { store } from './storage.js';
import { elHTML } from './render.js';
import { exportPNG, exportPDF, exportSVG } from './services/export.js';
import { slug } from './core/util.js';

/* ---------- undo / redo ---------- */
export const curEl = () => st.doc && st.doc.els.find((e) => e.id === st.sel);
const snap = () => JSON.stringify(st.doc);
function pushUndo(s) { st.undo.push(s); if (st.undo.length > 100) st.undo.shift(); st.redo = []; }
export function mutate(fn, key) {
  const now = Date.now();
  if (!(key && key === st.lastKey && now - st.lastT < 1000)) pushUndo(snap());
  st.lastKey = key || ''; st.lastT = now; fn(); st.dirty = true; updateTb();
}
function applySnap(s) { st.doc = JSON.parse(s); if (!st.doc.els.some((e) => e.id === st.sel)) st.sel = null; st.dirty = true; renderStage(); renderInsp(); updateTb(); }
function doUndo() { if (!st.undo.length) return; st.redo.push(snap()); applySnap(st.undo.pop()); st.lastKey = ''; }
function doRedo() { if (!st.redo.length) return; st.undo.push(snap()); applySnap(st.redo.pop()); st.lastKey = ''; }
export function saveDoc() {
  const r = store.save(st.doc);
  if (r.ok) { st.dirty = false; const l = store.list(); if (l.ok) st.docs = l.docs; updateTb(); toast('Saved “' + st.doc.name + '”.'); } else toast(r.error, true);
}

/* ---------- view ---------- */
const tbBtn = (act, icon, label, extra = '') => `<button class="btn s" data-act="${act}" ${extra}>${ic(icon)}<span>${label}</span></button>`;
function viewEditor() {
  return `<div class="ed"><div class="tb" role="toolbar" aria-label="Editor toolbar">
  <button class="btn q i" data-act="exit" aria-label="Back to projects" title="Back to projects">${ic('back')}</button>
  <input class="nm" id="nm" aria-label="Design name" maxlength="120" value="${esc(st.doc.name)}">
  <span class="st" id="stt" role="status"></span><span class="sep"></span>
  <button class="btn q i" data-act="undo" id="bUndo" aria-label="Undo" title="Undo (Ctrl+Z)">${ic('undo')}</button><button class="btn q i" data-act="redo" id="bRedo" aria-label="Redo" title="Redo (Ctrl+Y)">${ic('redo')}</button><span class="sep"></span>
  ${tbBtn('add-text', 'txt', 'Text')}${tbBtn('add-rect', 'rect', 'Rectangle')}${tbBtn('add-ell', 'ell', 'Ellipse')}${tbBtn('add-img', 'img', 'Image')}${tbBtn('ai-open', 'spark', 'AI image')}${tbBtn('review', 'txt', 'Review text')}<button class="btn s" data-act="guides" id="bGuides" aria-pressed="${st.guides}" title="Show trim, bleed and safe-area guides">${ic('rect')}<span>Guides</span></button><span class="sep"></span>
  <button class="btn s needsel" data-act="eldup" title="Duplicate selected">${ic('copy')}<span>Duplicate</span></button>
  <button class="btn s needsel" data-act="front" title="Bring forward">${ic('fwd')}<span>Forward</span></button>
  <button class="btn s needsel" data-act="back" title="Send backward">${ic('bwd')}<span>Backward</span></button>
  <button class="btn s needsel" data-act="eldel" title="Delete selected (Delete key)">${ic('trash')}<span>Delete</span></button>
  <span class="sp"></span>
  <button class="btn s p" data-act="save">${ic('save')}<span>Save</span></button>
  <label class="fld" style="flex-direction:row;align-items:center;gap:6px"><span class="sr">PNG scale</span><select id="exs" aria-label="PNG export scale" style="min-height:36px;border:1px solid var(--line);border-radius:8px;padding:0 6px"><option value="1">1×</option><option value="2" selected>2×</option><option value="3">3×</option></select></label>
  <button class="btn s" data-act="png">${ic('dl')}<span>PNG</span></button><button class="btn s" data-act="pdf">${ic('dl')}<span>PDF</span></button>
  <button class="btn s" data-act="svg" title="Download as editable SVG vector">${ic('dl')}<span>SVG</span></button><button class="btn s" data-act="json" title="Download project JSON">${ic('dl')}<span>JSON</span></button>
  <button class="btn s" data-act="adobe-edit" title="Open this design in Adobe Express">${ic('ext')}<span>Express</span></button>
  <button class="btn s" data-act="canva-new" title="Create a Canva design at this size">${ic('ext')}<span>Canva</span></button></div>
 <div class="edl"><div class="wrap" id="wrap"><div class="holder" id="holder"><div class="stg" id="stg"></div></div></div><aside class="insp" id="insp" aria-label="Inspector"></aside></div></div>`;
}
export function fitStage() {
  const wrap = $('#wrap'); if (!wrap || !st.doc) return;
  const d = st.doc, pad = 28, s = Math.min((wrap.clientWidth - pad) / d.w, (wrap.clientHeight - pad) / d.h, 1.5);
  st.scale = s > 0 ? s : .1;
  const h = $('#holder'), g = $('#stg');
  h.style.width = d.w * st.scale + 'px'; h.style.height = d.h * st.scale + 'px';
  g.style.width = d.w + 'px'; g.style.height = d.h + 'px'; g.style.transform = `scale(${st.scale})`; g.style.setProperty('--s', st.scale); g.style.background = d.bg;
}
const MM = 96 / 25.4;
export const printInfo = (d) => ({ bleedMm: 3, safeMm: 5, ...(d.meta && d.meta.print ? d.meta.print : {}) });
function guidesHTML() {
  if (!st.guides) return ''; const p = printInfo(st.doc), b = p.bleedMm * MM, f = p.safeMm * MM, line = 'calc(1.5px / var(--s))';
  return `<div class="gd" aria-hidden="true" style="left:${-b}px;top:${-b}px;width:${st.doc.w + 2 * b}px;height:${st.doc.h + 2 * b}px;border:${line} dashed #e0357a"></div><div class="gd" aria-hidden="true" style="left:0;top:0;width:${st.doc.w}px;height:${st.doc.h}px;border:${line} solid #111"></div><div class="gd" aria-hidden="true" style="left:${f}px;top:${f}px;width:${st.doc.w - 2 * f}px;height:${st.doc.h - 2 * f}px;border:${line} dashed #0a8fb0"></div>`;
}
export function renderStage() { const g = $('#stg'); if (!g) return; fitStage(); g.innerHTML = st.doc.els.map((e) => elHTML(e, e.id === st.sel)).join('') + guidesHTML(); }
function updateTb() {
  const t = $('#stt'); if (!t) return;
  t.textContent = st.dirty ? 'Unsaved changes' : 'All changes saved'; t.classList.toggle('dirty', st.dirty);
  $('#bUndo').disabled = !st.undo.length; $('#bRedo').disabled = !st.redo.length;
  $$('.needsel').forEach((b) => { b.disabled = !st.sel; if (!st.sel) b.title = 'Select an element first'; });
}
const numF = (p, l, v, min, max, step) => `<label class="fld"><span>${l}</span><input type="number" data-p="${p}" data-t="num" value="${Math.round(v * 100) / 100}" ${min != null ? `min="${min}"` : ''} ${max != null ? `max="${max}"` : ''} step="${step || 1}"></label>`;
const selF = (p, l, v, opts) => `<label class="fld"><span>${l}</span><select data-p="${p}" data-t="${typeof opts[0][0] === 'number' ? 'numsel' : 'str'}">${opts.map((o) => `<option value="${o[0]}" ${String(o[0]) === String(v) ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></label>`;
const colF = (p, l, v) => `<label class="fld"><span>${l}</span><input type="color" data-p="${p}" data-t="str" value="${HEX.test(v) ? v.toLowerCase() : '#ffffff'}"></label>`;

export function renderInsp() {
  const el = curEl(), box = $('#insp'); if (!box) return; let h = '';
  const layers = `<h2>Layers <span class="cm">(front to back)</span></h2>${st.doc.els.length ? `<ul class="lay">${[...st.doc.els].reverse().map((e) => `<li><button data-act="sel" data-id="${e.id}" aria-current="${e.id === st.sel}"><span class="k">${e.type === 'text' ? 'Text' : e.type === 'shape' ? 'Shape' : 'Image'}</span><span class="n"${e.type === 'text' && hasTe(e.text) ? ' lang="te"' : ''}>${esc(e.type === 'text' ? e.text.split('\n')[0] || '(empty)' : e.name)}</span></button></li>`).join('')}</ul>` : '<p class="hint">No elements yet. Use Text, Rectangle, Ellipse, Image or AI image above.</p>'}`;
  if (!el) {
    const d = st.doc, pre = PRESETS.findIndex((p) => p[1] === d.w && p[2] === d.h);
    h = `<h2>Design</h2><p class="hint">Click an element on the canvas, or choose one from Layers. Drag to move; drag the round handle to resize. Arrow keys nudge the selection.</p>
  <label class="fld"><span>Size preset</span><select id="preset"><option value="-1" ${pre < 0 ? 'selected' : ''}>Custom</option>${PRESETS.map((p, i) => `<option value="${i}" ${i === pre ? 'selected' : ''}>${p[0]} (${p[1]} × ${p[2]})</option>`).join('')}</select></label>
  <div class="row2"><label class="fld"><span>Width (px)</span><input type="number" id="dw" min="50" max="10000" value="${d.w}"></label><label class="fld"><span>Height (px)</span><input type="number" id="dh" min="50" max="10000" value="${d.h}"></label></div>
  <p class="err" id="derr" role="alert"></p>
  <label class="fld"><span>Background</span><input type="color" id="dbg" value="${d.bg.toLowerCase()}"></label><p class="hint">Sizes are CSS pixels at 96 dpi (${Math.round(d.w / MM * 10) / 10} × ${Math.round(d.h / MM * 10) / 10} mm).</p>
  <p class="hint"><strong>Guides</strong> (toolbar): black = trim edge, <span style="color:#e0357a">pink dashed</span> = bleed edge (${printInfo(d).bleedMm} mm${d.meta.print ? '' : ', default'}), <span style="color:#0a8fb0">teal dashed</span> = safe area (${printInfo(d).safeMm} mm). Keep text inside the safe area. Exports are trimmed to the trim edge; bleed is not exported.</p>` + layers;
  } else {
    const common = numF('x', 'X', el.x) + numF('y', 'Y', el.y) + numF('w', 'Width', el.w, 1) + numF('h', 'Height', el.h, 1);
    const op = `<label class="fld"><span>Opacity</span><input type="range" data-p="opacity" data-t="num" min="0" max="1" step="0.05" value="${el.opacity}"></label>`;
    if (el.type === 'text') {
      h = `<h2>Text</h2><label class="fld"><span>Content</span><textarea id="tx" data-p="text" data-t="str" rows="4">${esc(el.text)}</textarea></label>
   <p class="hint">Turn on the keyboard button in the top bar to type English or Telugu with the on-screen keyboard (including phonetic Telugu).</p>
   <div class="row2">${selF('font', 'Font', el.font, Object.keys(FONTS).map((k) => [k, FONT_LABEL[k]]))}${numF('size', 'Size (px)', el.size, 1, 2000)}</div>
   <div class="row2">${selF('weight', 'Weight', el.weight, [[400, 'Regular'], [600, 'Semibold'], [700, 'Bold']])}${selF('align', 'Align', el.align, [['left', 'Left'], ['center', 'Center'], ['right', 'Right']])}</div>
   <div class="row2">${colF('color', 'Color', el.color)}${numF('lh', 'Line spacing', el.lh, .5, 4, .1)}</div>${op}<div class="row2">${common}</div>`;
    } else if (el.type === 'shape') {
      h = `<h2>Shape</h2>${selF('shape', 'Shape', el.shape, [['rect', 'Rectangle'], ['ellipse', 'Ellipse']])}
   <div class="row2">${colF('fill', 'Fill', el.fill)}<label class="fld"><span>No fill</span><input type="checkbox" data-p="nofill" data-t="nofill" ${el.fill === 'transparent' ? 'checked' : ''}></label></div>
   <div class="row2">${colF('stroke', 'Border color', el.stroke)}${numF('sw', 'Border width', el.sw, 0, 500)}</div>${numF('radius', 'Corner radius (rectangle)', el.radius, 0, 10000)}${el.placeholder ? `<button class="btn s p" data-act="ph-replace">${ic('img')}Replace with image…</button>` : ''}${op}<div class="row2">${common}</div>`;
    } else {
      h = `<h2>Image</h2>${selF('fit', 'Fit', el.fit, [['cover', 'Cover'], ['contain', 'Contain'], ['fill', 'Stretch']])}<label class="fld"><span>Alt text</span><input data-p="alt" data-t="str" value="${esc(el.alt)}" maxlength="500"></label>${op}<div class="row2">${common}</div>`;
    }
    h += layers;
  }
  box.innerHTML = h;
}
export function openDoc(id, mainEl) {
  const r = store.get(id);
  if (!r.ok) { st.doc = null; mainEl.innerHTML = `<div class="page"><div class="note" role="alert"><p>${esc(r.error)}</p></div><a class="btn" href="#/projects">${ic('back')}Back to projects</a></div>`; return; }
  try { st.guides = localStorage.getItem('aiprintos:v1:guides') === '1'; } catch { st.guides = false; }
  st.doc = r.doc; st.sel = null; st.undo = []; st.redo = []; st.dirty = false; st.lastKey = '';
  mainEl.innerHTML = viewEditor(); renderStage(); renderInsp(); updateTb();
}
export function addEl(el) { mutate(() => { st.doc.els.push(el); st.sel = el.id; }); renderStage(); renderInsp(); updateTb(); }

/* ---------- images: shrink so browser storage (about 5 MB) is not exhausted ---------- */
const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('That file is not a readable image.')); i.src = src; });
export async function shrinkImage(src, max = 1600) {
  const im = await loadImg(src), k = Math.min(1, max / Math.max(im.width, im.height));
  if (k === 1 && src.length < 900000) return src;
  const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(im.width * k)); cv.height = Math.max(1, Math.round(im.height * k));
  const ctx = cv.getContext('2d'); ctx.drawImage(im, 0, 0, cv.width, cv.height);
  const png = cv.toDataURL('image/png'); if (png.length < 1.2e6) return png;
  const j = document.createElement('canvas'); j.width = cv.width; j.height = cv.height; const jc = j.getContext('2d'); jc.fillStyle = '#fff'; jc.fillRect(0, 0, j.width, j.height); jc.drawImage(cv, 0, 0);
  return j.toDataURL('image/jpeg', 0.88);
}
export async function addImageEl(src, name, alt) {
  const small = await shrinkImage(src), im = await loadImg(small);
  const r = Math.min(st.doc.w * .6 / im.width, st.doc.h * .6 / im.height, 1), w = Math.max(10, Math.round(im.width * r)), h = Math.max(10, Math.round(im.height * r));
  addEl({ id: uid('i'), type: 'image', name: String(name).slice(0, 100), x: Math.round((st.doc.w - w) / 2), y: Math.round((st.doc.h - h) / 2), w, h, opacity: 1, src: small, alt: String(alt || name).slice(0, 200), fit: 'contain' });
}

export async function replacePlaceholder(id, src, alt) {
  const small = await shrinkImage(src), i = st.doc.els.findIndex((e) => e.id === id); if (i < 0) throw new Error('That placeholder is no longer in the design.');
  const o = st.doc.els[i];
  mutate(() => { st.doc.els[i] = { id: uid('i'), type: 'image', name: 'Image', x: o.x, y: o.y, w: o.w, h: o.h, opacity: o.opacity, src: small, alt: String(alt).slice(0, 200), fit: 'cover' }; st.sel = st.doc.els[i].id; });
  renderStage(); renderInsp(); updateTb(); toast('Placeholder replaced with your image.');
}

/* ---------- canvas pointer interaction ---------- */
let drag = null;
document.addEventListener('pointerdown', (e) => {
  const g = $('#stg'); if (!g || (!g.contains(e.target) && e.target !== $('#wrap') && e.target !== $('#holder'))) return;
  const hd = e.target.closest('.hd'), elN = e.target.closest('.el');
  if (!elN) { if (st.sel) { st.sel = null; renderStage(); renderInsp(); updateTb(); } return; }
  const id = elN.dataset.id; if (st.sel !== id) { st.sel = id; renderStage(); renderInsp(); updateTb(); }
  const el = curEl(); if (!el) return;
  drag = { mode: hd ? 'resize' : 'move', x0: e.clientX, y0: e.clientY, ox: el.x, oy: el.y, ow: el.w, oh: el.h, snap: snap(), moved: false };
  try { $('#wrap').setPointerCapture(e.pointerId); } catch { /* ignore */ }
  e.preventDefault();
});
document.addEventListener('pointermove', (e) => {
  if (!drag) return; const el = curEl(); if (!el) return;
  const dx = (e.clientX - drag.x0) / st.scale, dy = (e.clientY - drag.y0) / st.scale;
  if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true; if (!drag.moved) return;
  if (drag.mode === 'move') { el.x = Math.round(drag.ox + dx); el.y = Math.round(drag.oy + dy); } else { el.w = Math.max(10, Math.round(drag.ow + dx)); el.h = Math.max(10, Math.round(drag.oh + dy)); }
  const n = $(`#stg [data-id="${el.id}"]`); if (n) { n.style.left = el.x + 'px'; n.style.top = el.y + 'px'; n.style.width = el.w + 'px'; n.style.height = el.h + 'px'; }
});
const endDrag = () => { if (!drag) return; if (drag.moved) { pushUndo(drag.snap); st.dirty = true; st.lastKey = ''; syncNums(); updateTb(); } drag = null; };
document.addEventListener('pointerup', endDrag); document.addEventListener('pointercancel', endDrag);
function syncNums() { const el = curEl(); if (!el) return; ['x', 'y', 'w', 'h'].forEach((k) => { const i = $(`#insp [data-p="${k}"]`); if (i) i.value = Math.round(el[k] * 100) / 100; }); }

/* ---------- inspector inputs ---------- */
document.addEventListener('input', (e) => {
  const t = e.target; if (!st.doc || route().n !== 'editor') return;
  if (t.id === 'nm') { mutate(() => { st.doc.name = t.value.trim() || 'Untitled design'; }, 'name'); return; }
  if (t.id === 'dbg') { mutate(() => { st.doc.bg = t.value.toUpperCase(); }, 'bg'); fitStage(); return; }
  if (t.dataset && t.dataset.p) {
    const el = curEl(); if (!el) return; const p = t.dataset.p, ty = t.dataset.t; let v;
    if (ty === 'num') { v = parseFloat(t.value); if (!isFinite(v)) return; if (['w', 'h'].includes(p)) v = Math.max(1, v); if (p === 'size') v = clamp(v, 1, 2000); if (p === 'lh') v = clamp(v, .5, 4); if (p === 'opacity') v = clamp(v, 0, 1); if (p === 'sw') v = clamp(v, 0, 500); if (p === 'radius') v = clamp(v, 0, 1e4); v = clamp(v, -1e5, 1e5); }
    else if (ty === 'numsel') v = parseInt(t.value, 10);
    else if (ty === 'nofill') { mutate(() => { el.fill = t.checked ? 'transparent' : '#CCCCCC'; }, 'fillchk'); renderStage(); renderInsp(); return; }
    else { v = t.value; if (p === 'fill' || p === 'color' || p === 'stroke') v = v.toUpperCase(); }
    mutate(() => { el[p] = v; }, p + el.id); renderStage();
  }
});
document.addEventListener('change', (e) => {
  const t = e.target; if (!st.doc || route().n !== 'editor') return;
  if (t.id === 'preset') { const i = +t.value; if (i >= 0) { mutate(() => { st.doc.w = PRESETS[i][1]; st.doc.h = PRESETS[i][2]; }); renderStage(); renderInsp(); } }
  if (t.id === 'dw' || t.id === 'dh') {
    const w = Number($('#dw').value), h = Number($('#dh').value), ok = [w, h].every((n) => Number.isInteger(n) && n >= 50 && n <= 10000), er = $('#derr');
    if (!ok) { er.textContent = 'Width and height must be whole numbers between 50 and 10000.'; return; }
    er.textContent = ''; mutate(() => { st.doc.w = w; st.doc.h = h; }); renderStage(); renderInsp();
  }
});
document.addEventListener('keydown', (e) => {
  if (!st.doc || route().n !== 'editor') return;
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) || dlg.open;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveDoc(); return; }
  if (typing) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? doRedo() : doUndo(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); doRedo(); return; }
  const el = curEl(); if (!el) return;
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); delEl(); return; }
  const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
  if (d) { e.preventDefault(); const n = e.shiftKey ? 10 : 1; mutate(() => { el.x += d[0] * n; el.y += d[1] * n; }, 'nudge' + el.id); renderStage(); syncNums(); }
});
window.addEventListener('beforeunload', (e) => { if (st.dirty) { e.preventDefault(); e.returnValue = ''; } });
window.addEventListener('resize', () => { if (st.doc && route().n === 'editor') fitStage(); });

/* ---------- actions ---------- */
function delEl() { const el = curEl(); if (!el) return; mutate(() => { st.doc.els = st.doc.els.filter((e) => e.id !== el.id); st.sel = null; }); renderStage(); renderInsp(); updateTb(); }
const pct = (k, f) => Math.round(k * f);
on('undo', doUndo); on('redo', doRedo); on('save', saveDoc); on('exit', () => { location.hash = '#/projects'; });
on('add-text', () => addEl(T({ name: 'Text', text: 'New text', x: pct(st.doc.w, .1), y: pct(st.doc.h, .1), w: pct(st.doc.w, .6), h: Math.max(40, pct(st.doc.h, .12)), size: Math.max(12, Math.round(Math.min(st.doc.w, st.doc.h) * .06)) })));
on('add-rect', () => addEl(S({ name: 'Rectangle', x: pct(st.doc.w, .2), y: pct(st.doc.h, .2), w: pct(st.doc.w, .4), h: pct(st.doc.h, .25), fill: '#C21A5E' })));
on('add-ell', () => addEl(S({ name: 'Ellipse', shape: 'ellipse', x: pct(st.doc.w, .25), y: pct(st.doc.h, .3), w: pct(st.doc.w, .3), h: pct(st.doc.w, .3), fill: '#00A3C4' })));
on('add-img', () => { st.phTarget = null; $('#fImage').click(); });
on('sel', (b) => { st.sel = b.dataset.id; renderStage(); renderInsp(); updateTb(); });
on('eldup', () => { const el = curEl(); if (!el) return; const c = JSON.parse(JSON.stringify(el)); c.id = uid(el.type[0]); c.x += 20; c.y += 20; addEl(c); });
on('eldel', delEl);
const moveEl = (dir) => () => { const i = st.doc.els.findIndex((e) => e.id === st.sel), j = i + dir; if (i < 0 || j < 0 || j >= st.doc.els.length) return; mutate(() => { const [x] = st.doc.els.splice(i, 1); st.doc.els.splice(j, 0, x); }); renderStage(); renderInsp(); };
on('front', moveEl(1)); on('back', moveEl(-1));
on('json', () => downloadText(slug(st.doc.name) + '.aiprintos.json', JSON.stringify(st.doc, null, 2), 'application/json'));
const exporter = (fn, label) => async (b) => { b.disabled = true; try { const r = await fn(st.doc); toast(`Exported ${label} (${r.W ? r.W + ' × ' + r.H + ' px, ' : ''}${Math.round(r.size / 1024)} KB).`); } catch (e) { toast('Export failed. ' + e.message + ' Your design was not changed.', true); } finally { b.disabled = false; } };
on('png', exporter(exportPNG, 'PNG')); on('pdf', exporter(exportPDF, 'PDF')); on('svg', exporter(exportSVG, 'SVG'));
on('guides', (b) => { st.guides = !st.guides; b.setAttribute('aria-pressed', String(st.guides)); try { localStorage.setItem('aiprintos:v1:guides', st.guides ? '1' : '0'); } catch { /* not persisted */ } renderStage(); });
on('ph-replace', () => { const el = curEl(); if (!el || !el.placeholder) return; st.phTarget = el.id; $('#fImage').click(); });

$('#fImage').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = ''; if (!f || !st.doc) return;
  if (!/^image\/(png|jpeg|webp|gif)$/.test(f.type)) return toast('Unsupported file. Choose a PNG, JPEG, WebP or GIF image.', true);
  if (f.size > 8 * 1024 * 1024) return toast('That image is larger than 8 MB. Choose a smaller image.', true);
  const src = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(); r.readAsDataURL(f); }).catch(() => null);
  if (!src) return toast('That image could not be read.', true);
  try {
    const target = st.phTarget, alt = f.name.replace(/\.[^.]+$/, '');
    st.phTarget = null;
    if (target) await replacePlaceholder(target, src, alt); else await addImageEl(src, f.name, alt);
  } catch (err) { toast(err.message, true); }
});
