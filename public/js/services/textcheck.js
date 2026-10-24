// Text review: separate, local, opt-in checks. Nothing here edits text by itself: it returns issues with suggested fixes.
//  1. Unicode / spacing checks for Telugu and Hindi (rule-based).
//  2. English spelling against the bundled Hunspell en_US word list.
// Not provided: Telugu/Hindi spelling (no licensed dictionary bundled) and grammar review.
import { distance } from '../keyboard/predict.js';
import { EN_WORDS } from '../keyboard/lexicon.js';

const PROTECT = [
  /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g,                           // email
  /(?:https?:\/\/|www\.)[^\s]+/gi,                            // URL
  /(?:[₹$€£]|Rs\.?|INR)\s?\d[\d,]*(?:\.\d+)?|\d[\d,]*(?:\.\d+)?\s?(?:[₹€£]|Rs\b)/g, // prices
  /\+?\d[\d\s().-]{5,}\d/g,                                   // phone numbers / dates / numeric ranges
  /\b[\p{L}]*\d[\p{L}\d_-]*\b/gu                              // any token containing a digit: product codes, 10th, 30%...
];
export function protectedSpans(text) {
  const spans = [];
  for (const re of PROTECT) for (const m of text.matchAll(new RegExp(re.source, re.flags))) spans.push([m.index, m.index + m[0].length]);
  return spans;
}
const inSpans = (spans, a, b) => spans.some(([s, e]) => a < e && b > s);
export const scriptOf = (ch) => { const c = ch.codePointAt(0); return c >= 0xC00 && c <= 0xC7F ? 'te' : c >= 0x900 && c <= 0x97F ? 'hi' : /\p{L}/u.test(ch) ? 'la' : ''; };

// Telugu: 0C3E-0C4C vowel signs, 0C4D virama, 0C01-0C03 candrabindu/anusvara/visarga, independent vowels 0C05-0C14.
// Devanagari: 093E-094C signs, 094D virama, 0900-0903 marks, independent vowels 0904-0914.
const SIGN = { te: /[\u0C3E-\u0C4D\u0C01-\u0C03\u0C55\u0C56]/, hi: /[\u093E-\u094D\u0900-\u0903]/ };
const VOWEL_SIGN = { te: /[\u0C3E-\u0C4C\u0C55\u0C56]/, hi: /[\u093E-\u094C]/ };
const MARK = { te: /[\u0C01-\u0C03]/, hi: /[\u0900-\u0903]/ };
const IND_VOWEL = { te: /[\u0C05-\u0C14\u0C60\u0C61]/, hi: /[\u0904-\u0914\u0960\u0961]/ };
const VIRAMA = { te: '\u0C4D', hi: '\u094D' };

export function unicodeIssues(text) {
  const out = [], chars = Array.from(text); let pos = 0; const idx = [];
  for (const c of chars) { idx.push(pos); pos += c.length; }
  if (text !== text.normalize('NFC')) out.push({ type: 'normalization', start: 0, end: text.length, message: 'Text is not in normalized Unicode form (NFC). Normalizing can fix rendering and search differences.', suggestion: text.normalize('NFC'), whole: true });
  chars.forEach((c, i) => {
    const s = scriptOf(c); if (s !== 'te' && s !== 'hi') return;
    const prev = chars[i - 1] || '', st = idx[i], en = st + c.length;
    if (SIGN[s].test(c)) {
      const ps = prev && scriptOf(prev);
      if (!prev || ps !== s || IND_VOWEL[s].test(prev)) out.push({ type: 'orphan-sign', start: st, end: en, message: 'A vowel sign or mark appears without a consonant before it.', suggestion: '' });
      else if (c === VIRAMA[s] && prev === VIRAMA[s]) out.push({ type: 'double-virama', start: st, end: en, message: 'Repeated virama (consonant joiner).', suggestion: '' });
      else if (VOWEL_SIGN[s].test(c) && VOWEL_SIGN[s].test(prev)) out.push({ type: 'double-vowel-sign', start: st, end: en, message: 'Two vowel signs in a row on one consonant.', suggestion: '' });
      else if (MARK[s].test(c) && MARK[s].test(prev)) out.push({ type: 'double-mark', start: st, end: en, message: 'Repeated anusvara/visarga mark.', suggestion: '' });
    }
  });
  for (const m of text.matchAll(/\S+/g)) {
    const scripts = new Set(Array.from(m[0]).map(scriptOf).filter((x) => x === 'te' || x === 'hi' || x === 'la'));
    if (scripts.size > 1 && !inSpans(protectedSpans(text), m.index, m.index + m[0].length)) out.push({ type: 'mixed-script', start: m.index, end: m.index + m[0].length, message: 'This word mixes scripts (Latin with Telugu/Hindi letters). Check for a typing mistake.', suggestion: null });
  }
  for (const m of text.matchAll(/ {2,}/g)) out.push({ type: 'spacing', start: m.index, end: m.index + m[0].length, message: 'Repeated spaces.', suggestion: ' ' });
  for (const m of text.matchAll(/ +(?=[,.!?;:।])/g)) out.push({ type: 'spacing', start: m.index, end: m.index + m[0].length, message: 'Space before punctuation.', suggestion: '' });
  return out;
}

const RANK = new Map(EN_WORDS.map((w, i) => [w, i]));
export function suggestEnglish(word, dict, n = 3) {
  const w = word.toLowerCase(), out = [];
  for (const c of dict) {
    if (Math.abs(c.length - w.length) > 2 || c.length < 2) continue;
    const d = distance(w, c); if (d > 2) continue;
    out.push([d * 10 + (c[0] === w[0] ? 0 : 6) + (RANK.has(c) ? Math.min(RANK.get(c) / 400, 3) - 3 : 0) + Math.abs(c.length - w.length), c]);
  }
  out.sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1]));
  return out.slice(0, n).map((x) => (/^[A-Z]/.test(word) ? x[1][0].toUpperCase() + x[1].slice(1) : x[1]));
}
// dict: Set of lowercase words. Protected tokens (emails, URLs, phones, prices, dates, codes, anything with digits) and likely names are skipped.
export function spellEnglish(text, dict, ignore = new Set()) {
  const spans = protectedSpans(text), out = [];
  for (const m of text.matchAll(/[A-Za-z][A-Za-z'’-]*/g)) {
    const a = m.index, b = a + m[0].length; let w = m[0].replace(/’/g, "'");
    if (inSpans(spans, a, b) || w.length < 3 || ignore.has(w.toLowerCase())) continue;
    if (/[\p{L}\d]/u.test(text[a - 1] || '') || /[\p{L}\d]/u.test(text[b] || '')) continue; // part of a larger token (other script, digits)
    if (w === w.toUpperCase()) continue;                                               // acronyms
    const head = text.slice(0, a), sentenceStart = /(^|[.!?]\s+|\n\s*)$/.test(head);
    if (/^[A-Z]/.test(w) && !sentenceStart) continue;                                  // probable names
    const lw = w.toLowerCase().replace(/^-+|-+$/g, '').replace(/'s$/, '');
    if (dict.has(lw) || lw.split('-').every((p) => !p || dict.has(p))) continue;
    out.push({ type: 'spelling', start: a, end: b, word: m[0], message: `“${m[0]}” is not in the English dictionary.`, suggestions: suggestEnglish(w.replace(/^-+|-+$/g, '').replace(/'s$/, ''), dict) });
  }
  return out;
}
export async function loadEnglishDict(url = 'data/dict/en_US.words.txt') {
  const inl = typeof window !== 'undefined' && window.__AIP_LIB__; if (inl && inl[url]) return new Set(inl[url].split(/\r?\n/).map((w) => w.trim()).filter(Boolean)); // single-file preview build
  const r = await fetch(url); if (!r.ok) throw new Error(`The English dictionary could not be loaded (${r.status}).`);
  return new Set((await r.text()).split(/\r?\n/).map((w) => w.trim()).filter(Boolean));
}
export function reviewText(text, dict, ignore) { return [...unicodeIssues(text), ...(dict ? spellEnglish(text, dict, ignore) : [])].sort((x, y) => x.start - y.start); }
export const applyIssue = (text, issue, replacement) => (issue.whole ? replacement : text.slice(0, issue.start) + replacement + text.slice(issue.end));
