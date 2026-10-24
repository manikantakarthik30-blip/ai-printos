import { $, $$, esc, uid, ic, slug, clamp } from '../core/util.js';
import { st, route, hooks } from '../core/state.js';
import { on } from '../core/actions.js';
import { toast, openDlg, confirmDlg, dlg, downloadText } from '../core/ui.js';
import { PRESETS, FONTS, FONT_LABEL, newDoc, validate } from '../model.js';
import { store } from '../storage.js';
import { TPL, buildTpl } from '../data/templates.js';
import { CATALOG, CATALOG_GROUPS } from '../data/catalog.js';
import { pvHTML, fitPreviews } from '../render.js';
import { aiPanel } from './ai.js';
import { loadManifest, loadTemplateDoc, copyForEditing, fetchSource, assetUrl } from '../services/library.js';
import { loadConfig, canvaCreateDesign } from '../services/api.js';
import { openInAdobe } from '../services/adobe.js';
import { designToDataUrl } from '../services/export.js';
import { addImageEl } from '../editor.js';
import { THEMES, getTheme } from '../core/theme.js';
import { isEnabled, resetLearning } from '../keyboard/keyboard.js';

export function refreshDocs() { const r = store.list(); if (r.ok) { st.docs = r.docs; st.listErr = ''; } else { st.docs = []; st.listErr = r.error; } }
const cap = (s) => s[0].toUpperCase() + s.slice(1);

/* ---------- cards ---------- */
function card(d) {
  const when = new Date(d.updated).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const origin = { blank: 'Blank', template: 'From template', catalog: 'From catalog', ai: 'AI image', import: 'Imported' }[d.meta.origin] || '';
  return `<article class="card"><a class="thumb" href="#/editor/${encodeURIComponent(d.id)}" aria-label="Open: ${esc(d.name)}"><span class="crop"><span class="frame">${pvHTML(d)}</span></span></a>
 <div><h3 class="ct" title="${esc(d.name)}">${esc(d.name)}</h3><p class="cm">${origin} · ${d.w} × ${d.h}</p><p class="cm">Updated ${when}</p></div>
 <div class="ca"><button class="btn q i" data-act="dup" data-id="${d.id}" aria-label="Duplicate: ${esc(d.name)}" title="Duplicate">${ic('copy')}</button><button class="btn q i" data-act="dl" data-id="${d.id}" aria-label="Download JSON: ${esc(d.name)}" title="Download JSON">${ic('dl')}</button><button class="btn q i" data-act="del" data-id="${d.id}" aria-label="Delete: ${esc(d.name)}" title="Delete">${ic('trash')}</button></div></article>`;
}
const tplCard = (t) => `<article class="card"><div class="thumb"><span class="crop"><span class="frame">${pvHTML(buildTpl(t))}</span></span></div><div><h3 class="ct">${esc(t.name)}</h3><p class="cm"><span class="bdg sample">Sample</span> ${t.w} × ${t.h}</p></div><div><button class="btn s" data-act="tpl" data-id="${t.id}">Use template</button></div></article>`;
const prodCard = (p) => `<article class="panel prod"><h3>${esc(p.name)}</h3><p class="cm">${p.mm[0]} × ${p.mm[1]} mm · ${p.w} × ${p.h} px at 96 dpi</p><p>${esc(p.use)}</p><div><button class="btn s p" data-act="prod" data-id="${p.id}">Design at this size</button></div></article>`;
const emptyState = `<div class="empty"><h3>No designs yet</h3><p>Designs you create are saved in this browser and appear here.</p><button class="btn p" data-act="new">New design</button></div>`;

/* ---------- views ---------- */
export function viewHome() {
  const rec = st.docs.slice(0, 4);
  return `<div class="page"><h1>Start a design</h1>${aiPanel()}
 <section class="sec" aria-labelledby="qh"><h2 class="sr" id="qh">Other ways to start</h2><div class="quick">
  <button class="qi" data-act="new">${ic('plus')}<strong>Blank design</strong><span>Pick a size and start empty</span></button>
  <a class="qi" href="#/catalog">${ic('cat')}<strong>Print product sizes</strong><span>Start from a real print size</span></a>
  <div class="qi">${ic('up')}<span>Open a design saved earlier</span><button class="btn s" data-act="import">Import project JSON</button></div></div></section>
 <section class="sec" aria-labelledby="rh"><div class="head"><h2 id="rh">Recent designs</h2>${st.docs.length > 4 ? '<a href="#/projects">Projects</a>' : ''}</div>
  ${st.listErr ? `<div class="note" role="alert">Saved designs could not be read. ${esc(st.listErr)}</div>` : rec.length ? `<div class="grid">${rec.map(card).join('')}</div>` : emptyState}</section>
 <section class="sec" aria-labelledby="th"><div class="head"><h2 id="th">Templates</h2><a href="#/templates">See all templates</a></div><div class="grid">${TPL.slice(0, 4).map(tplCard).join('')}</div></section></div>`;
}
const PER = 24, CAT_NAMES = { 'visiting-cards': 'Visiting cards', 'wedding-invitations': 'Wedding invitations', brochures: 'Brochures', flyers: 'Flyers', posters: 'Posters', banners: 'Banners', 'stickers-labels': 'Stickers & labels', 'product-catalogs': 'Product catalogs' };
const LANG_NAME = { en: 'English', te: 'Telugu', hi: 'Hindi' };
export function viewTemplates() {
  return `<div class="page"><h1>Template library</h1><p class="hint">Original, fully editable designs (no third-party artwork). Sample text is placeholder copy and has not been reviewed by native speakers. Open any template to get your own copy; the library originals are never changed.</p>
 <div id="libBody" aria-live="polite"></div>
 <section class="sec" aria-labelledby="sh"><div class="head"><h2 id="sh">Starter samples</h2></div><div class="grid">${TPL.map(tplCard).join('')}</div></section></div>`;
}
const libMatch = (t) => { const f = st.lib, q = f.q.trim().toLowerCase();
  return (f.cat === 'all' || t.category === f.cat) && (f.lang === 'all' || (f.lang === 'bi' ? t.languages.length > 1 : t.languages.length === 1 && t.languages[0] === f.lang)) && (f.layout === 'all' || t.tags.includes(f.layout)) && (f.tone === 'all' || t.tags.includes(f.tone)) &&
    (!q || q.split(/\s+/).every((w) => (t.name + ' ' + t.tags.join(' ')).toLowerCase().includes(w))); };
const libCard = (t) => `<article class="card libcard"><button class="thumb" data-act="lib-open" data-id="${t.id}" aria-label="Preview: ${esc(t.name)}"><span class="frame"><img class="libimg" loading="lazy" decoding="async" src="${esc(assetUrl(t.preview))}" alt="" width="${t.size.w}" height="${t.size.h}"></span></button>
 <div><h3 class="ct" title="${esc(t.name)}">${esc(t.name)}</h3><p class="cm">${t.size.wMm} × ${t.size.hMm} mm · ${t.languages.map((l) => LANG_NAME[l]).join(' + ')}</p></div></article>`;
const chips = () => { const m = st.lib.manifest; return ['all', ...Object.keys(CAT_NAMES)].map((c) => `<button class="chip" data-act="lib-cat" data-c="${c}" aria-pressed="${st.lib.cat === c}">${c === 'all' ? `All (${m.total})` : `${CAT_NAMES[c]} (${m.counts[c]})`}</button>`).join(''); };
const selOpts = (list, cur) => list.map(([v, l]) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${l}</option>`).join('');
export async function paintLibrary() {
  const box = $('#libBody'); if (!box) return; const f = st.lib;
  if (!f.manifest) {
    box.innerHTML = '<div class="note"><p>Loading templates…</p></div>';
    try { f.manifest = await loadManifest(); f.err = ''; } catch (e) { f.err = e.message; }
    if (!$('#libBody')) return;
  }
  if (f.err) { box.innerHTML = `<div class="note" role="alert"><p class="err">${esc(f.err)}</p><div><button class="btn s" data-act="lib-retry">${ic('refresh')}Retry</button></div></div>`; return; }
  box.innerHTML = `<div class="head" style="justify-content:flex-start;gap:12px"><label class="fld" style="flex:1 1 220px;max-width:340px"><span class="sr">Search templates</span><input type="search" id="lq" placeholder="Search name or tag, e.g. wedding gold" value="${esc(f.q)}"></label>
  <label class="fld sel"><span class="sr">Language</span><select id="ll">${selOpts([['all', 'All languages'], ['en', 'English'], ['te', 'Telugu'], ['hi', 'Hindi'], ['bi', 'Bilingual']], f.lang)}</select></label>
  <label class="fld sel"><span class="sr">Layout</span><select id="ly">${selOpts([['all', 'Any layout'], ['banded', 'Banded'], ['centered', 'Centered'], ['sidebar', 'Sidebar']], f.layout)}</select></label>
  <label class="fld sel"><span class="sr">Tone</span><select id="lt">${selOpts([['all', 'Light and dark'], ['light', 'Light'], ['dark', 'Dark']], f.tone)}</select></label></div>
  <div class="chips" role="group" aria-label="Template categories" id="libChips">${chips()}</div><p class="cm" id="libCount"></p><div class="grid libgrid" id="libGrid"></div><nav class="pager" id="libPager" aria-label="Template pages"></nav>`;
  updateLibrary();
}
function updateLibrary() {
  const f = st.lib, all = f.manifest.templates.filter(libMatch), pages = Math.max(1, Math.ceil(all.length / PER)); f.page = clamp(f.page, 1, pages);
  const from = (f.page - 1) * PER, list = all.slice(from, from + PER);
  $('#libChips').innerHTML = chips();
  $('#libCount').textContent = all.length ? `Showing ${from + 1}–${from + list.length} of ${all.length} templates` : '0 templates';
  $('#libGrid').innerHTML = list.length ? list.map(libCard).join('') : '<p>No templates match these filters. Clear the search or choose another category.</p>';
  $('#libPager').innerHTML = pages > 1 ? `<button class="btn s" data-act="lib-page" data-d="-1" ${f.page === 1 ? 'disabled' : ''}>Previous</button><span>Page ${f.page} of ${pages}</span><button class="btn s" data-act="lib-page" data-d="1" ${f.page === pages ? 'disabled' : ''}>Next</button>` : '';
}
const tById = (id) => st.lib.manifest && st.lib.manifest.templates.find((t) => t.id === id);
function openPreview(t, err) {
  const v = t.printValidation, ok = (b) => (b ? 'Yes' : 'No');
  openDlg(t.name, `<div class="libdlg"><img class="libimg big" src="${esc(assetUrl(t.preview))}" alt="Preview of ${esc(t.name)}" width="${t.size.w}" height="${t.size.h}">
  <dl class="meta"><dt>Category</dt><dd>${esc(t.categoryLabel)}</dd><dt>Size</dt><dd>${t.size.wMm} × ${t.size.hMm} mm (${t.size.w} × ${t.size.h} px at 96 dpi, ${t.size.orientation})</dd><dt>Suggested print</dt><dd>${esc(t.suggestedPrint)}</dd><dt>Languages</dt><dd>${t.languages.map((l) => LANG_NAME[l]).join(' + ')}</dd>
  <dt>Editable</dt><dd>${t.editable.textFields} text fields, ${t.editable.imagePlaceholders} image placeholders, ${t.editable.shapes} shapes</dd><dt>Source</dt><dd>${esc(t.provenance.origin)} · ${esc(t.provenance.author)} · ${esc(t.licence)}</dd>
  <dt>Checks</dt><dd>Text contrast AA: ${ok(v.textContrastAA)} · Inside safe area: ${ok(v.textInsideSafeArea)} · Text fits boxes: ${ok(v.textFits)}</dd><dt>Press-ready</dt><dd><strong>No.</strong> ${esc(v.notes)}</dd></dl></div>
  <p class="err" id="libErr" role="alert">${err ? esc(err) : ''}</p>
  <div class="da"><button class="btn" data-act="lib-dl" data-id="${t.id}" data-k="svg">${ic('dl')}SVG</button><button class="btn" data-act="lib-dl" data-id="${t.id}" data-k="file">${ic('dl')}JSON</button><button class="btn" data-act="dclose">Close</button><button class="btn p" data-act="lib-use" data-id="${t.id}">Open in editor</button></div>`);
}
on('lib-open', (b) => { const t = tById(b.dataset.id); if (t) openPreview(t); });
on('lib-use', async (b) => {
  const t = tById(b.dataset.id); if (!t) return; b.disabled = true; const er = $('#libErr');
  try { const doc = copyForEditing(await loadTemplateDoc(t), t); const r = store.save(doc); if (!r.ok) throw new Error(r.error); refreshDocs(); if (dlg.open) dlg.close(); toast('Created your copy of “' + t.name + '”.'); location.hash = '#/editor/' + encodeURIComponent(doc.id); }
  catch (e) { if (er) er.textContent = e.message; toast(e.message, true); b.disabled = false; }
});
on('lib-dl', async (b) => { const t = tById(b.dataset.id); if (!t) return; try { const txt = await fetchSource(t, b.dataset.k); downloadText(`${t.id}.${b.dataset.k === 'svg' ? 'svg' : 'json'}`, txt, b.dataset.k === 'svg' ? 'image/svg+xml' : 'application/json'); } catch (e) { const er = $('#libErr'); if (er) er.textContent = e.message; toast(e.message, true); } });
on('lib-cat', (b) => { st.lib.cat = b.dataset.c; st.lib.page = 1; updateLibrary(); });
on('lib-page', (b) => { st.lib.page += +b.dataset.d; updateLibrary(); $('#libCount').scrollIntoView({ block: 'start' }); });
on('lib-retry', () => { st.lib.manifest = null; paintLibrary(); });
document.addEventListener('input', (e) => { if (e.target.id === 'lq') { st.lib.q = e.target.value; st.lib.page = 1; updateLibrary(); } });
document.addEventListener('change', (e) => { const m = { ll: 'lang', ly: 'layout', lt: 'tone' }[e.target.id]; if (m) { st.lib[m] = e.target.value; st.lib.page = 1; updateLibrary(); } });
document.addEventListener('error', (e) => { const i = e.target; if (i && i.classList && i.classList.contains('libimg')) { console.warn('Template preview missing:', i.src); const s = document.createElement('span'); s.className = 'cm'; s.textContent = 'Preview unavailable'; i.replaceWith(s); } }, true);

const prodList = () => { const q = st.catQ.trim().toLowerCase(); return CATALOG.filter((p) => (st.catGroup === 'all' || p.group === st.catGroup) && (!q || p.name.toLowerCase().includes(q))); };
const prodGrid = () => { const l = prodList(); return l.length ? l.map(prodCard).join('') : '<p>No products match.</p>'; };
export function viewCatalog() {
  return `<div class="page"><h1>Print product catalog</h1><p class="hint">Standard print sizes to design for. Pricing, ordering and delivery are not part of this build, so none are shown. Add 3 mm bleed with your printer's template if they require it.</p>
 <div class="head" style="justify-content:flex-start"><label class="fld" style="flex:1 1 220px;max-width:340px"><span class="sr">Search products</span><input type="search" id="cq" placeholder="Search products" value="${esc(st.catQ)}"></label>
 <div class="chips" role="group" aria-label="Product groups">${['all', ...CATALOG_GROUPS].map((c) => `<button class="chip" data-act="grp" data-c="${c}" aria-pressed="${st.catGroup === c}">${c === 'all' ? 'All' : cap(c)}</button>`).join('')}</div></div>
 <div class="grid pgrid" id="pg">${prodGrid()}</div></div>`;
}
export const viewProjects = () => `<div class="page"><div class="head"><h1>Projects</h1><button class="btn" data-act="import">${ic('up')}Import project JSON</button></div><p class="hint">Saved in this browser only (there are no accounts). Download a project as JSON to keep a backup.</p>
 ${st.listErr ? `<div class="note" role="alert">Saved designs could not be read. ${esc(st.listErr)}</div>` : st.docs.length ? `<div class="grid">${st.docs.map(card).join('')}</div>` : emptyState}</div>`;

const SAMPLES = ['నమస్కారం', 'తెలుగు భాష', 'పెళ్లికి అందరికీ స్వాగతం', 'ధన్యవాదాలు! 2026, ఫోన్ 98765-43210.', 'नमस्ते', 'हिन्दी भाषा', 'विवाह में आप सभी सादर आमंत्रित हैं', 'धन्यवाद! 2026, फ़ोन 98765-43210।'];
export const viewStudio = () => `<div class="page"><h1>Language Studio</h1><p class="hint">Try the on-screen keyboard and check that Telugu renders correctly on this device.</p>
 <section class="panel" aria-labelledby="ph"><h2 id="ph">Practice text</h2>
 <textarea id="sf" rows="4" aria-label="Practice text" style="font-size:1.5rem" placeholder="Tap here, then use the keyboard"></textarea>
 <p class="hint">Turn on the keyboard button in the top bar. Press 🌐 to cycle English → తెలుగు → Telugu phonetic → हिन्दी phonetic. In phonetic mode type <code>namaskaaram</code> (Telugu) or <code>namaste</code> (Hindi) and press space. Capitals pick variants: <code>T D N L</code> retroflex, <code>A I U</code> long vowels, <code>E O</code> long e/o, <code>Sh</code> ష, <code>M</code> ం.</p></section>
 <section class="panel" aria-labelledby="rh2"><h2 id="rh2">Telugu rendering check</h2><p class="hint">If you see empty boxes instead of letters, your device has no Telugu font.</p>
 <div class="samples">${['sans', 'serif'].map((k) => `<div style="font-family:${FONTS[k]};display:flex;flex-direction:column;gap:8px"><p class="cm" style="font-family:var(--font)">${FONT_LABEL[k]}</p>${SAMPLES.map((s) => `<p lang="${/[\u0900-\u097F]/.test(s) ? 'hi' : 'te'}" style="display:flex;gap:16px;align-items:baseline;flex-wrap:wrap"><span style="font-size:16px">${s}</span><span style="font-size:32px">${s}</span></p>`).join('')}</div>`).join('')}</div></section></div>`;

const badge = (s) => ({ live: '<span class="bdg live">Ready</span>', off: '<span class="bdg off">Not configured</span>', none: '<span class="bdg off">Not included</span>', part: '<span class="bdg demo">Needs sign-in</span>' }[s]);
export function viewSettings(cfg) {
  const q = new URLSearchParams((location.hash.split('?')[1] || '')).get('canva');
  const c = cfg.canva, a = cfg.adobe;
  const items = [
    ['Image generation (Google Gemini)', cfg.gemini.configured ? 'live' : 'off', 'Runs on this site\'s server using GEMINI_API_KEY. Prompts are sent to Google.', cfg.gemini.configured ? '' : 'Set GEMINI_API_KEY on the server.'],
    ['Canva Connect', !c.configured ? 'off' : c.connected ? 'live' : 'part', 'Creates a blank Canva design at your design\'s size and opens it in Canva (OAuth, official Canva Connect API). It cannot import Canva templates or send edits back: Canva\'s public API does not offer that to all accounts.', !c.configured ? 'Set CANVA_CLIENT_ID and CANVA_CLIENT_SECRET.' : c.connected ? '<button class="btn s" data-act="canva-connect">Reconnect</button>' : '<button class="btn s p" data-act="canva-connect">Connect Canva</button>'],
    ['Adobe Express (Embed SDK)', a.configured ? 'live' : 'off', 'Opens your design in the Adobe Express editor inside this page and brings the published result back as an image layer. Your domain must be allow-listed in Adobe Developer Console.', a.configured ? '<button class="btn s" data-act="adobe-create">Open blank Express design</button>' : 'Set ADOBE_EXPRESS_CLIENT_ID.'],
    ['Telugu typing (built-in)', 'live', 'Rule-based transliteration, dictionary suggestions and autocorrect run in your browser. Telugu autocorrect is suggestion-based; automatic correction applies to English only.', ''],
    ['Translation', 'none', 'No translation service is included.', '']
  ];
  return `<div class="page"><h1>Settings</h1>
 ${!cfg.reachable ? '<div class="note" role="alert"><p><strong>API not reachable.</strong> Features that need the server (AI images, Canva) are off. Run with <code>npm run dev</code>, <code>vercel dev</code> or <code>netlify dev</code>, or deploy the project.</p></div>' : ''}
 ${q === 'connected' ? '<div class="note"><p>Canva connected.</p></div>' : q === 'error' ? '<div class="note" role="alert"><p class="err">Canva sign-in failed. Check the redirect URL and credentials, then try again.</p></div>' : ''}
 <section class="panel" aria-labelledby="sv"><h2 id="sv">Services and integrations</h2>
 <ul class="pl">${items.map((i) => `<li><div class="head" style="justify-content:flex-start;gap:10px"><strong>${i[0]}</strong>${badge(i[1])}</div><p>${i[2]}</p>${i[3] ? `<p class="cm">${i[3]}</p>` : ''}</li>`).join('')}</ul></section>
 <section class="panel" aria-labelledby="ap"><h2 id="ap">Appearance</h2><ul class="thm">${THEMES.map((t) => `<li><button data-act="theme-set" data-id="${t.id}" aria-pressed="${getTheme() === t.id}"><strong>${t.name}</strong><span class="cm">${t.note}</span><span class="dots" aria-hidden="true">${t.dots.map((c) => `<i style="background:${c}"></i>`).join('')}</span></button></li>`).join('')}</ul><p class="hint">Themes are plain CSS variables, documented in DESIGN.md. <a href="#/design">Open the design-system preview</a>.</p></section>
 <section class="panel" aria-labelledby="kb"><h2 id="kb">Keyboard</h2><p>On-screen keyboard: <strong>${isEnabled() ? 'on' : 'off'}</strong> (toggle with the keyboard button in the top bar).</p><div><button class="btn" data-act="kb-reset">Clear learned words</button></div><p class="hint">Learned words stay in this browser only.</p></section>
 <section class="panel" aria-labelledby="sg"><h2 id="sg">Local storage</h2><p>${st.docs.length} design${st.docs.length === 1 ? '' : 's'} saved in this browser.</p><p class="hint">Browser storage is limited (about 5 MB) and can be cleared by your browser. Download projects as JSON for backups.</p>
 <div><button class="btn d" data-act="clear" ${st.docs.length ? '' : 'disabled'}>Delete all local designs</button></div></section></div>`;
}

/* ---------- search inputs update only the grid so the text field keeps focus ---------- */
document.addEventListener('input', (e) => {
  if (e.target.id === 'cq') { st.catQ = e.target.value; $('#pg').innerHTML = prodGrid(); }
});

/* ---------- actions ---------- */
export function createAndOpen(doc, closeDialog) {
  const r = store.save(doc); if (!r.ok) { const e = $('#ne'); if (e && dlg.open) e.textContent = r.error; toast(r.error, true); return false; }
  refreshDocs(); if (closeDialog && dlg.open) dlg.close(); toast('Created “' + doc.name + '”.'); location.hash = '#/editor/' + encodeURIComponent(doc.id); return true;
}
on('dclose', () => dlg.close()); on('dyes', () => { dlg.dataset.res = '1'; dlg.close(); });
on('new', () => {
  openDlg('New blank design', `<form class="form" id="nf"><label class="fld"><span>Design name</span><input id="nn" maxlength="120" placeholder="Untitled design"></label>
 <label class="fld"><span>Size</span><select id="ns">${PRESETS.map((p, i) => `<option value="${i}" ${i === 2 ? 'selected' : ''}>${p[0]} (${p[1]} × ${p[2]})</option>`).join('')}<option value="c">Custom size</option></select></label>
 <div class="row2" id="cs" hidden><label class="fld"><span>Width (px)</span><input id="cw" inputmode="numeric" value="1000"></label><label class="fld"><span>Height (px)</span><input id="ch" inputmode="numeric" value="1000"></label></div>
 <p class="hint">Sizes are CSS pixels at 96 dpi.</p><p class="err" id="ne" role="alert"></p><div class="da"><button type="button" class="btn" data-act="dclose">Cancel</button><button class="btn p" type="submit">Create design</button></div></form>`);
  $('#ns').addEventListener('change', (e) => { $('#cs').hidden = e.target.value !== 'c'; });
  $('#nf').addEventListener('submit', (ev) => {
    ev.preventDefault(); let w, h; const v = $('#ns').value;
    if (v === 'c') { w = Number($('#cw').value); h = Number($('#ch').value); if (![w, h].every((n) => Number.isInteger(n) && n >= 50 && n <= 10000)) { $('#ne').textContent = 'Width and height must be whole numbers between 50 and 10000.'; return; } } else { w = PRESETS[v][1]; h = PRESETS[v][2]; }
    createAndOpen(newDoc($('#nn').value.trim() || 'Untitled design', w, h, '#FFFFFF', [], { origin: 'blank' }), true);
  });
});
on('tpl', (b) => { const t = TPL.find((x) => x.id === b.dataset.id); if (t) createAndOpen(buildTpl(t), false); });
on('prod', (b) => { const p = CATALOG.find((x) => x.id === b.dataset.id); if (p) createAndOpen(newDoc(p.name, p.w, p.h, '#FFFFFF', [], { origin: 'catalog', productId: p.id }), false); });
on('grp', (b) => { st.catGroup = b.dataset.c; hooks.render(); });
on('dup', (b) => { const d = st.docs.find((x) => x.id === b.dataset.id); if (!d) return; const c = JSON.parse(JSON.stringify(d)); c.id = uid('d'); c.name = d.name + ' copy'; c.els.forEach((e) => { e.id = uid(e.type[0]); }); c.created = c.updated = new Date().toISOString(); const r = store.save(c); if (r.ok) { refreshDocs(); hooks.render(); toast('Created “' + c.name + '”.'); } else toast(r.error, true); });
on('dl', (b) => { const d = st.docs.find((x) => x.id === b.dataset.id); if (d) downloadText(slug(d.name) + '.aiprintos.json', JSON.stringify(d, null, 2), 'application/json'); });
on('del', async (b) => { const d = st.docs.find((x) => x.id === b.dataset.id); if (!d) return; if (await confirmDlg('Delete this design?', `“${d.name}” will be removed from this browser. This cannot be undone.`, 'Delete')) { const r = store.remove(d.id); if (r.ok) { refreshDocs(); hooks.render(); toast('Deleted “' + d.name + '”.'); } else toast(r.error, true); } });
on('clear', async () => { if (await confirmDlg('Delete all local designs?', 'Every design saved in this browser will be removed. This cannot be undone.', 'Delete')) { const r = store.clear(); if (r.ok) { refreshDocs(); hooks.render(); toast(`Deleted ${r.n} design${r.n === 1 ? '' : 's'}.`); } else toast(r.error, true); } });
on('import', () => $('#fImport').click());
on('kb-reset', () => { resetLearning(); toast('Learned words cleared.'); });
$('#fImport').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  if (f.size > 15e6) return toast('Import failed. That file is larger than 15 MB.', true);
  let j; try { j = JSON.parse(await f.text()); } catch { return toast('Import failed. That file is not valid JSON.', true); }
  const r = validate(j); if (!r.ok) return toast('Import failed. ' + r.error, true);
  const d = r.doc; d.id = uid('d'); d.meta.origin = 'import'; const s = store.save(d); if (!s.ok) return toast(s.error, true);
  refreshDocs(); hooks.render(); toast('Imported “' + d.name + '”.');
});

/* ---------- integrations ---------- */
const setup = (name, vars) => openDlg(name + ' is not configured', `<p>This deployment has no ${esc(name)} credentials, so the feature is off. Nothing was sent anywhere.</p><p class="hint">Set <code>${esc(vars)}</code> on the server and redeploy. See the README, section "Canva and Adobe Express".</p><div class="da"><button class="btn p" data-act="dclose">OK</button></div>`);
const adobeRun = async (mode) => {
  const cfg = await loadConfig(true); if (!cfg.adobe.configured) return setup('Adobe Express', 'ADOBE_EXPRESS_CLIENT_ID');
  try {
    const img = await openInAdobe(cfg.adobe, mode, mode === 'edit' ? await designToDataUrl(st.doc, 1) : null);
    if (img && st.doc && route().n === 'editor') { await addImageEl(img, 'Adobe Express design', 'Design from Adobe Express'); toast('Adobe Express result added as an image layer.'); }
    else if (img) toast('Adobe Express returned a design. Open a design in the editor to place it.');
  } catch (e) { toast(e.message, true); }
};
on('adobe-edit', () => adobeRun('edit')); on('adobe-create', () => adobeRun('create'));
on('canva-connect', async () => { const cfg = await loadConfig(true); if (!cfg.canva.configured) return setup('Canva', 'CANVA_CLIENT_ID and CANVA_CLIENT_SECRET'); location.href = '/api/canva-auth'; });
on('canva-new', async () => {
  const cfg = await loadConfig(true); if (!cfg.canva.configured) return setup('Canva', 'CANVA_CLIENT_ID and CANVA_CLIENT_SECRET');
  if (!cfg.canva.connected) { if (st.dirty && !await confirmDlg('Leave to connect Canva?', 'You have unsaved changes. Save first, or they will be lost when you leave this page.', 'Connect anyway')) return; location.href = '/api/canva-auth'; return; }
  try { const r = await canvaCreateDesign(clamp(st.doc.w, 40, 8000), clamp(st.doc.h, 40, 8000), st.doc.name); window.open(r.editUrl, '_blank', 'noopener'); toast('Opened a new Canva design. Edits there are not synced back.'); }
  catch (e) { if (e.code === 'not_connected') st.config.canva.connected = false; toast(e.message, true); }
});

/* ---------- design-system preview (live tokens and components for the active theme) ---------- */
const TOKENS = [['--paper', 'Page background'], ['--surf', 'Surface (cards, inputs)'], ['--ink', 'Primary text'], ['--ink2', 'Secondary text'], ['--ink3', 'Muted text'], ['--line', 'Borders'], ['--mag', 'Accent / primary action'], ['--cyan', 'Secondary accent'], ['--yel', 'Highlight'], ['--danger', 'Error'], ['--focus', 'Focus ring'], ['--side-bg', 'Sidebar']];
export function viewDesign() {
  return `<div class="page"><div class="head"><h1>Design system</h1><a class="btn" href="#/settings">Back to Settings</a></div><p class="hint">Live preview of the active theme (<strong>${THEMES.find((t) => t.id === getTheme()).name}</strong>). Change theme with the top-bar button. Rules are written in DESIGN.md.</p>
 <section class="panel"><h2>Colour tokens</h2><div class="sw">${TOKENS.map(([v, n]) => `<div><i style="background:var(${v})"></i><span><strong>${n}</strong><br><code>${v}</code></span></div>`).join('')}</div></section>
 <section class="panel ts"><h2>Typography</h2><h1 style="margin:0">Heading one · తెలుగు</h1><h2 style="margin:0">Heading two · శుభాకాంక్షలు</h2><p>Body text at 16px: Design, print and share in English and తెలుగు.</p><p class="cm">Caption text for hints and metadata.</p></section>
 <section class="panel"><h2>Buttons and badges</h2><div class="chips"><button class="btn p">Primary</button><button class="btn">Secondary</button><button class="btn d">Danger</button><button class="btn" disabled>Disabled</button><span class="bdg live">Ready</span><span class="bdg off">Not configured</span><span class="bdg sample">Sample</span></div></section>
 <section class="panel"><h2>Form controls</h2><div class="row2"><label class="fld"><span>Text input</span><input placeholder="Type here"></label><label class="fld"><span>Select</span><select><option>Option one</option><option>Option two</option></select></label></div><label class="fld"><span>Textarea</span><textarea rows="2" placeholder="Focus me to see the keyboard"></textarea></label></section>
 <section class="panel"><h2>Cards and notes</h2><div class="grid">${TPL.slice(0, 2).map(tplCard).join('')}</div><div class="note"><p>A note or empty state looks like this.</p></div></section></div>`;
}
