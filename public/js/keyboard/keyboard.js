// Gboard-style virtual keyboard: English, Telugu (native & phonetic), Hindi (native & phonetic),
// with autocorrect, word suggestions, next-word prediction and emoji. Attaches to any text field;
// edits go through standard "input" events so the design editor reacts exactly as if the user typed.
import { LANGS, EN_ROWS, SYM, TE_CONS, TE_VOW, HI_CONS, HI_VOW, EMOJI } from './layouts.js';
import { createPredictor } from './predict.js';
import { esc } from '../core/util.js';

const P = createPredictor();
const PREF = 'aiprintos:v1:kbprefs';
const TEXT_TYPES = new Set(['text', 'search', 'email', 'url', 'tel', '']);
const BOUNDARY = /^[\s.,!?;:)\]}"”]$/;
const kb = {
  root: null,
  field: null,
  lang: 'en',
  page: 'main',
  tePage: 'cons',
  hiPage: 'cons',
  shift: 0,
  shiftT: 0,
  enabled: false,
  comp: null,
  lastAuto: null,
  exp: null,
  emoji: 1,
  recents: [],
  listeners: [],
  repeat: null
};
const seg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;

export const eligible = (el) => !!el && el.nodeType === 1 && !el.disabled && !el.readOnly && el.dataset.vk !== 'off' &&
  (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && TEXT_TYPES.has((el.getAttribute('type') || '').toLowerCase())));
export const isEnabled = () => kb.enabled;
export const getLang = () => kb.lang;
export const onKeyboardChange = (fn) => kb.listeners.push(fn);
const emit = () => kb.listeners.forEach((fn) => fn({ enabled: kb.enabled, open: !!kb.field, lang: kb.lang }));
const savePrefs = () => { try { localStorage.setItem(PREF, JSON.stringify({ enabled: kb.enabled, lang: kb.lang, recents: kb.recents })); } catch { /* ignore */ } };
export const resetLearning = () => P.reset();

/* ---------- text helpers ---------- */
const sel = () => [kb.field.selectionStart ?? kb.field.value.length, kb.field.selectionEnd ?? kb.field.value.length];
function replace(start, end, text, caret) {
  const f = kb.field; let t = text;
  if (f.maxLength > 0) { const room = f.maxLength - (f.value.length - (end - start)); if (room < t.length) t = t.slice(0, Math.max(0, room)); }
  f.setRangeText(t, start, end, 'end');
  if (caret != null) f.setSelectionRange(caret, caret);
  f.dispatchEvent(new Event('input', { bubbles: true }));
  kb.exp = { v: f.value, c: f.selectionStart };
}
const before = () => kb.field.value.slice(0, sel()[0]);
const compValid = () => !!kb.comp && !!kb.exp && kb.field.value === kb.exp.v && kb.field.selectionStart === kb.exp.c && kb.field.selectionEnd === kb.exp.c;

/* ---------- typing ---------- */
function insert(text) { const [s, e] = sel(); replace(s, e, text); }

function autocorrect(boundary) {
  const [s, e] = sel(); if (s !== e) return;
  const b = kb.field.value.slice(0, s), m = b.match(/[A-Za-z'’]+$/);
  if (!m) { kb.lastAuto = null; return; }
  const word = m[0].replace(/’/g, "'"), start = s - m[0].length, head = b.slice(0, start);
  const prev = (head.match(/([A-Za-z']+)[^A-Za-z']*$/) || [])[1] || '';
  const sentenceStart = /(^|[.!?]\s+|\n\s*)$/.test(head);
  const skip = /[@/#._\d-]$/.test(head) || (/^[A-Z]/.test(word) && !sentenceStart && word !== word.toUpperCase());
  const fix = skip ? null : P.correct(word);
  if (fix && fix !== word) { replace(start, s, fix); kb.lastAuto = { orig: word, fix, start, boundary }; }
  else { kb.lastAuto = null; if (!skip) P.learn(prev, word); }
}

function typeChar(ch) {
  const L = kb.lang;
  if ((L === 'ph' || L === 'hph') && kb.page === 'main' && /^[A-Za-z]$/.test(ch)) return phLetter(ch);
  if (kb.comp) commitComp();
  if (ch === ' ' && L === 'en' && /[A-Za-z0-9\u0C00-\u0C7F\u0900-\u097F)\]"'] $/.test(before()) && sel()[0] === sel()[1]) { // double space -> ". "
    const c = sel()[0]; kb.lastAuto = null; replace(c - 1, c, '. '); return afterEdit();
  }
  const boundary = BOUNDARY.test(ch);
  if (boundary && L === 'en') autocorrect(ch);
  else if (boundary && (L === 'te' || L === 'ph')) teLearn();
  else if (boundary && (L === 'hi' || L === 'hph')) hiLearn();
  else if (!boundary) kb.lastAuto = null;
  insert(ch);
  if (kb.lastAuto && boundary && kb.lastAuto.end == null) kb.lastAuto.end = sel()[0];
  if (kb.shift === 1 && /^[A-Za-z]$/.test(ch)) { kb.shift = 0; render(); }
  afterEdit();
}

function phLetter(ch) {
  if (!compValid()) { const [s, e] = sel(); if (s !== e) replace(s, e, ''); kb.comp = { start: sel()[0], roman: '', len: 0 }; }
  kb.comp.roman += ch; renderComp();
  if (kb.shift === 1) { kb.shift = 0; render(); }
}

const scr = () => (kb.lang === 'hph' || kb.lang === 'hi' ? 'hi' : 'te');
function renderComp() {
  const c = kb.comp, out = P.phFromRoman(scr(), c.roman);
  replace(c.start, c.start + c.len, out);
  c.len = out.length;
  afterEdit();
}
function commitComp() {
  if (kb.comp && kb.comp.roman) {
    const w = P.phFromRoman(scr(), kb.comp.roman);
    if (scr() === 'hi') P.hiLearn(w); else P.teLearn(w);
  }
  kb.comp = null;
}
function teLearn() { const m = before().match(/[\u0C00-\u0C7F]+$/); if (m) P.teLearn(m[0]); }
function hiLearn() { const m = before().match(/[\u0900-\u097F]+$/); if (m) P.hiLearn(m[0]); }

function backspace() {
  const f = kb.field;
  if (kb.comp && compValid()) {
    const c = kb.comp; c.roman = c.roman.slice(0, -1);
    if (!c.roman) { replace(c.start, c.start + c.len, ''); kb.comp = null; afterEdit(); } else renderComp();
    return;
  }
  kb.comp = null;
  const [s, e] = sel();
  const a = kb.lastAuto;
  if (a && s === e && a.end === s && f.value.slice(a.start, s) === a.fix + a.boundary) { // undo the autocorrect
    kb.lastAuto = null; P.ignore(a.orig); replace(a.start, s, a.orig); return afterEdit();
  }
  kb.lastAuto = null;
  if (s !== e) { replace(s, e, ''); return afterEdit(); }
  if (s === 0) return;
  const head = f.value.slice(0, s); let n = 1;
  if (/[\u0C00-\u0C7F\u0900-\u097F]$/.test(head)) {
    n = 1; // Indic combining marks / matras / virama peeled back unit-by-unit
  } else if (seg) {
    const parts = [...seg.segment(head.slice(-16))];
    n = parts.length ? parts[parts.length - 1].segment.length : 1;
  } else if (/[\uDC00-\uDFFF]$/.test(head)) {
    n = 2;
  }
  replace(s - n, s, ''); afterEdit();
}

function enter() {
  if (kb.comp) commitComp();
  if (kb.lang === 'en') autocorrect('\n');
  const f = kb.field;
  if (f.tagName === 'TEXTAREA') { insert('\n'); afterEdit(); }
  else { f.dispatchEvent(new Event('change', { bubbles: true })); hide(); f.blur(); }
}

function autoShift() {
  if (kb.lang !== 'en' || kb.shift === 2 || kb.page !== 'main') return;
  const b = before(), want = !b || /(^|[.!?]\s+|\n)$/.test(b) ? 1 : 0;
  if (want !== kb.shift) { kb.shift = want; render(); }
}
function afterEdit() { autoShift(); renderSuggest(); }

function pickSuggestion(i) {
  const s = kb.sug && kb.sug[i]; if (!s) return;
  const f = kb.field; kb.lastAuto = null;
  if (kb.comp && compValid()) {
    const c = kb.comp;
    replace(c.start, c.start + c.len, s.text + ' ');
    if (scr() === 'hi') P.hiLearn(s.text); else P.teLearn(s.text);
    kb.comp = null;
    return afterEdit();
  }
  const [cs] = sel(), head = f.value.slice(0, cs);
  let m = null;
  if (kb.lang === 'en') m = head.match(/[A-Za-z'’]+$/);
  else if (kb.lang === 'te' || kb.lang === 'ph') m = head.match(/[\u0C00-\u0C7F]+$/);
  else if (kb.lang === 'hi' || kb.lang === 'hph') m = head.match(/[\u0900-\u097F]+$/);
  const cur = m ? m[0] : '';
  replace(cs - cur.length, cs, s.text + ' ');
  if (kb.lang === 'en') {
    P.learn((head.slice(0, cs - cur.length).match(/([A-Za-z']+)\W*$/) || [])[1] || '', s.text);
  } else if (kb.lang === 'te' || kb.lang === 'ph') {
    P.teLearn(s.text);
  } else {
    P.hiLearn(s.text);
  }
  afterEdit();
}

function computeSuggestions() {
  const b = before(), L = kb.lang;
  if (kb.comp && compValid()) return P.phSuggest(scr(), kb.comp.roman, 3).map((t) => ({ text: t }));
  if (L === 'en') {
    const m = b.match(/[A-Za-z'’]+$/);
    if (m) {
      const w = m[0].replace(/’/g, "'"), fix = P.correct(w), c = P.completions(w, 3);
      const list = [...(fix ? [fix, w] : []), ...c.filter((x) => x !== fix)];
      const out = [...new Set(list.length ? list : [w])].slice(0, 3);
      return out.map((t) => ({ text: t, lit: t === w && !!fix, fix: t === fix }));
    }
    const prev = (b.match(/([A-Za-z']+)[ ]$/) || [])[1] || '';
    const cap = !b || /(^|[.!?]\s+|\n)$/.test(b);
    return P.nextWords(prev, 3).map((t) => ({ text: cap ? t[0].toUpperCase() + t.slice(1) : t }));
  }
  if (L === 'te' || L === 'ph') {
    const m = b.match(/[\u0C00-\u0C7F]+$/);
    if (m) return P.teComplete(m[0], 3).map((t) => ({ text: t }));
    const prev = (b.match(/([\u0C00-\u0C7F]+)\s$/) || [])[1] || '';
    return P.teNext(prev, 3).map((t) => ({ text: t }));
  }
  if (L === 'hi' || L === 'hph') {
    const m = b.match(/[\u0900-\u097F]+$/);
    if (m) return P.hiComplete(m[0], 3).map((t) => ({ text: t }));
    const prev = (b.match(/([\u0900-\u097F]+)\s$/) || [])[1] || '';
    return P.hiNext(prev, 3).map((t) => ({ text: t }));
  }
  return [];
}

/* ---------- rendering ---------- */
const key = (t, v, label, cls = '', aria = '') => `<button type="button" tabindex="-1" class="vk-k ${cls}" data-t="${t}" data-v="${esc(v)}"${aria ? ` aria-label="${esc(aria)}"` : ''}>${label}</button>`;
const row = (keys, cls = '') => `<div class="vk-row ${cls}">${keys.join('')}</div>`;
const BS = key('bs', '', '⌫', 'fn', 'Backspace');

function letterRows() {
  const up = kb.shift > 0, lab = (c) => (up ? c.toUpperCase() : c);
  const sh = key('shift', '', kb.shift === 2 ? '⇪' : '⇧', 'fn' + (kb.shift ? ' on' : ''), 'Shift');
  return row(EN_ROWS[0].map((c) => key('ch', lab(c), lab(c)))) + row(EN_ROWS[1].map((c) => key('ch', lab(c), lab(c))), 'pad') + row([sh, ...EN_ROWS[2].map((c) => key('ch', lab(c), lab(c))), BS]);
}

function teRows() {
  const vow = kb.tePage === 'vow', rows = vow ? TE_VOW : TE_CONS;
  const toggle = key('tepage', vow ? 'cons' : 'vow', vow ? 'క' : 'అ', 'fn', vow ? 'Consonants' : 'Vowels');
  const glyph = (c, i) => (vow && i >= 2 ? key('ch', c, '◌' + c, 'te') : key('ch', c, c, 'te'));
  return row(rows[0].map((c) => glyph(c, 0))) + row(rows[1].map((c) => glyph(c, 1))) + row(rows[2].map((c) => glyph(c, 2))) + row([toggle, ...rows[3].map((c) => glyph(c, 3)), BS]);
}

function hiRows() {
  const vow = kb.hiPage === 'vow', rows = vow ? HI_VOW : HI_CONS;
  const toggle = key('hipage', vow ? 'cons' : 'vow', vow ? 'क' : 'अ', 'fn', vow ? 'Consonants' : 'Vowels');
  const glyph = (c, i) => (vow && i >= 2 ? key('ch', c, '◌' + c, 'hi') : key('ch', c, c, 'hi'));
  return row(rows[0].map((c) => glyph(c, 0))) + row(rows[1].map((c) => glyph(c, 1))) + row(rows[2].map((c) => glyph(c, 2))) + row([toggle, ...rows[3].map((c) => glyph(c, 3)), BS]);
}

function symRows() {
  const n = kb.page, o = n === 'sym1' ? 'sym2' : 'sym1';
  return row(SYM[n][0].map((c) => key('ch', c, c))) + row(SYM[n][1].map((c) => key('ch', c, c))) + row([key('page', o, n === 'sym1' ? '=\\&lt;' : '?123', 'fn', 'More symbols'), ...SYM[n][2].map((c) => key('ch', c, c)), BS]);
}

function emojiRows() {
  const cats = [{ icon: '🕘', name: 'Recent', list: kb.recents }, ...EMOJI];
  const tabs = cats.map((c, i) => key('ecat', String(i), c.icon, 'tab' + (i === kb.emoji ? ' on' : ''), c.name)).join('');
  const list = cats[kb.emoji].list;
  const grid = list.length ? list.map((e) => key('emoji', e, e, 'emo')).join('') : '<p class="vk-empty">Emoji you use appear here.</p>';
  return `<div class="vk-tabs">${tabs}</div><div class="vk-egrid" role="group" aria-label="${esc(cats[kb.emoji].name)}">${grid}</div>`;
}

function bottomRow() {
  if (kb.page === 'emoji') return row([key('page', 'main', 'ABC', 'fn wide', 'Letters'), key('space', ' ', '', 'space', 'Space'), BS, key('enter', '', '↵', 'fn', 'Enter')]);
  const lang = LANGS.find((l) => l.id === kb.lang);
  const first = kb.page === 'main' ? key('page', 'sym1', '?123', 'fn wide', 'Numbers and symbols') : key('page', 'main', 'ABC', 'fn wide', 'Letters');
  return row([first, key('lang', '', '🌐', 'fn', 'Switch language. Current: ' + lang.label), key('page', 'emoji', '😊', 'fn', 'Emoji'), key('space', ' ', esc(lang.label), 'space', 'Space'), key('ch', '.', '.', ''), key('enter', '', '↵', 'fn', 'Enter')]);
}

export function setLang(id) {
  if (kb.comp) commitComp();
  if (LANGS.some((l) => l.id === id)) {
    kb.lang = id;
    kb.page = 'main';
    kb.shift = 0;
    savePrefs();
    render();
    autoShift();
    emit();
  }
}

function renderTopBar() {
  if (!kb.root) return;
  const isTe = kb.lang === 'te' || kb.lang === 'ph';
  const isHi = kb.lang === 'hi' || kb.lang === 'hph';
  const modeBtn = isTe
    ? `<button type="button" tabindex="-1" class="vk-mode-btn" data-t="togglemode" aria-label="Toggle Telugu Script and Phonetic">${kb.lang === 'ph' ? 'abc→తె' : 'క/అ'}</button>`
    : isHi
    ? `<button type="button" tabindex="-1" class="vk-mode-btn" data-t="togglemode" aria-label="Toggle Hindi Script and Phonetic">${kb.lang === 'hph' ? 'abc→हि' : 'क/अ'}</button>`
    : '';

  const selector = `<div class="vk-langs" role="tablist" aria-label="Language selection">
    <button type="button" tabindex="-1" class="vk-lang-btn ${kb.lang === 'en' ? 'active' : ''}" data-t="setlang" data-v="en">English</button>
    <button type="button" tabindex="-1" class="vk-lang-btn ${isTe ? 'active' : ''}" data-t="setlang" data-v="${kb.lang === 'te' ? 'te' : 'ph'}">తెలుగు</button>
    <button type="button" tabindex="-1" class="vk-lang-btn ${isHi ? 'active' : ''}" data-t="setlang" data-v="${kb.lang === 'hi' ? 'hi' : 'hph'}">हिन्दी</button>
    ${modeBtn}
  </div>`;

  const top = kb.root.querySelector('.vk-top');
  const curLangs = top.querySelector('.vk-langs');
  if (curLangs) curLangs.outerHTML = selector;
}

function render() {
  if (!kb.root) return;
  const body = kb.page === 'emoji' ? emojiRows()
    : kb.page !== 'main' ? symRows()
    : kb.lang === 'te' ? teRows()
    : kb.lang === 'hi' ? hiRows()
    : letterRows();
  kb.root.querySelector('.vk-body').innerHTML = body + bottomRow();
  renderTopBar();
  renderSuggest();
}

function renderSuggest() {
  if (!kb.root || !kb.field) return;
  kb.sug = kb.page === 'emoji' ? [] : computeSuggestions();
  const strip = kb.root.querySelector('.vk-sug');
  strip.innerHTML = kb.sug.map((s, i) => {
    const isIndic = /[\u0C00-\u0C7F\u0900-\u097F]/.test(s.text);
    const langAttr = /[\u0C00-\u0C7F]/.test(s.text) ? ' lang="te"' : /[\u0900-\u097F]/.test(s.text) ? ' lang="hi"' : '';
    return `<button type="button" tabindex="-1" class="vk-s${s.fix ? ' fix' : ''}${isIndic ? ' indic' : ''}" data-t="sug" data-v="${i}"${langAttr}>${s.lit ? '“' + esc(s.text) + '”' : esc(s.text)}</button>`;
  }).join('') || '<span class="vk-hint">Suggestions appear as you type</span>';
}

/* ---------- show / hide ---------- */
function suppress(f) { if (f.dataset.vkIm === undefined) f.dataset.vkIm = f.getAttribute('inputmode') ?? '__none__'; f.setAttribute('inputmode', 'none'); }
function restore(f) { const o = f.dataset.vkIm; if (o === undefined) return; if (o === '__none__') f.removeAttribute('inputmode'); else f.setAttribute('inputmode', o); delete f.dataset.vkIm; }

function attach(f) {
  if (kb.field === f && !kb.root.hidden) return;
  if (kb.field && kb.field !== f) detach();
  kb.field = f; kb.comp = null; kb.lastAuto = null; kb.exp = null;
  suppress(f);
  const host = f.closest('dialog[open]') || document.body;
  if (kb.root.parentNode !== host) host.append(kb.root);
  kb.root.hidden = false; document.body.classList.add('kb-open');
  render(); autoShift(); emit();
  try { f.scrollIntoView({ block: 'center' }); } catch { /* older browsers */ }
}

function detach() {
  const f = kb.field; if (!f) return;
  if (kb.comp) commitComp();
  restore(f); kb.field = null;
}

export function hide() {
  detach(); if (!kb.root) return;
  kb.root.hidden = true; if (kb.root.parentNode !== document.body) document.body.append(kb.root);
  document.body.classList.remove('kb-open'); document.documentElement.style.setProperty('--kb-h', '0px'); emit();
}

export function setEnabled(on) {
  kb.enabled = !!on; savePrefs();
  if (!on) hide(); else if (eligible(document.activeElement)) attach(document.activeElement);
  emit();
}

/* ---------- input handling ---------- */
function handle(b) {
  if (!kb.field || !kb.field.isConnected) return hide();
  const t = b.dataset.t, v = b.dataset.v;
  switch (t) {
    case 'ch': typeChar(v); break;
    case 'space': typeChar(' '); break;
    case 'bs': backspace(); break;
    case 'enter': enter(); break;
    case 'shift': { const now = Date.now(); kb.shift = kb.shift === 0 ? 1 : kb.shift === 1 && now - kb.shiftT < 400 ? 2 : 0; kb.shiftT = now; render(); break; }
    case 'page': if (kb.comp) commitComp(); kb.page = v; render(); break;
    case 'tepage': kb.tePage = v; render(); break;
    case 'hipage': kb.hiPage = v; render(); break;
    case 'lang': {
      if (kb.comp) commitComp();
      const i = LANGS.findIndex((l) => l.id === kb.lang);
      kb.lang = LANGS[(i + 1) % LANGS.length].id;
      kb.page = 'main'; kb.shift = 0; savePrefs(); render(); autoShift(); emit(); break;
    }
    case 'setlang': setLang(v); break;
    case 'togglemode': {
      if (kb.comp) commitComp();
      if (kb.lang === 'te') setLang('ph');
      else if (kb.lang === 'ph') setLang('te');
      else if (kb.lang === 'hi') setLang('hph');
      else if (kb.lang === 'hph') setLang('hi');
      break;
    }
    case 'emoji': { if (kb.comp) commitComp(); kb.lastAuto = null; insert(v); kb.recents = [v, ...kb.recents.filter((x) => x !== v)].slice(0, 16); savePrefs(); renderSuggest(); break; }
    case 'ecat': kb.emoji = +v; render(); break;
    case 'sug': pickSuggestion(+v); break;
    case 'close': hide(); break;
  }
}

function stopRepeat() { clearTimeout(kb.repeat); clearInterval(kb.repeat); kb.repeat = null; }
function sync() { if (!kb.field) return; if (!compValid()) { if (kb.comp) commitComp(); kb.comp = null; } kb.lastAuto = kb.lastAuto && kb.lastAuto.end === sel()[0] ? kb.lastAuto : null; autoShift(); renderSuggest(); }

export function initKeyboard() {
  try {
    const p = JSON.parse(localStorage.getItem(PREF) || '{}');
    kb.enabled = typeof p.enabled === 'boolean' ? p.enabled : matchMedia('(pointer:coarse)').matches;
    if (LANGS.some((l) => l.id === p.lang)) kb.lang = p.lang;
    if (Array.isArray(p.recents)) kb.recents = p.recents.filter((x) => typeof x === 'string').slice(0, 16);
  } catch {
    kb.enabled = matchMedia('(pointer:coarse)').matches;
  }

  const root = document.createElement('div');
  root.id = 'vk'; root.className = 'vk'; root.hidden = true; root.setAttribute('role', 'group'); root.setAttribute('aria-label', 'On-screen keyboard: English, Telugu and Hindi');
  root.innerHTML = '<div class="vk-top"><div class="vk-langs" role="tablist"></div><div class="vk-sug" aria-live="polite"></div><button type="button" tabindex="-1" class="vk-close" data-t="close" aria-label="Hide keyboard">⌄</button></div><div class="vk-body"></div>';
  document.body.append(root); kb.root = root;
  new ResizeObserver(() => { if (!root.hidden) document.documentElement.style.setProperty('--kb-h', root.offsetHeight + 'px'); }).observe(root);

  root.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('[data-t]'); if (!b) return;
    e.preventDefault(); // keep focus (and caret) in the text field
    handle(b);
    if (b.dataset.t === 'bs') { stopRepeat(); kb.repeat = setTimeout(() => { kb.repeat = setInterval(() => handle(b), 55); }, 420); }
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => root.addEventListener(ev, stopRepeat));
  root.addEventListener('contextmenu', (e) => e.preventDefault());

  document.addEventListener('pointerdown', (e) => { if (kb.enabled && eligible(e.target)) suppress(e.target); }, true);
  document.addEventListener('focusin', (e) => { if (kb.enabled && eligible(e.target)) attach(e.target); });
  document.addEventListener('focusout', () => setTimeout(() => { if (kb.field && !root.hidden && document.activeElement !== kb.field && !root.contains(document.activeElement)) hide(); }, 0));
  document.addEventListener('input', (e) => { if (e.target === kb.field && e.isTrusted) sync(); });
  document.addEventListener('keyup', (e) => { if (e.target === kb.field) { if (e.key === 'Escape') hide(); else sync(); } });
  document.addEventListener('click', (e) => { if (e.target === kb.field) sync(); });
  window.addEventListener('hashchange', hide);
  emit();
}
