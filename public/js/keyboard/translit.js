// Rule-based romanized -> Telugu / Hindi transliteration (ITRANS-like). Pure functions, no DOM, works offline.
// Lowercase = default letters. Capitals select variants: T D N L Sh = retroflex, A I U = long vowels, E O = long e/o, M = anusvara, H = visarga.
const mk = (v, c, s, virama, finalM) => ({ VOW: new Map(v), CON: new Map(c), SIGN: new Map(s), virama, finalM, finalVirama: finalM }); // Telugu closes a final consonant with a virama; Hindi writes it bare (silent schwa)
const CONS = (x) => [['chh', x.chh], ['kh', x.kh], ['gh', x.gh], ['ch', x.ch], ['jh', x.jh], ['Th', x.Th], ['Dh', x.Dh], ['th', x.th], ['dh', x.dh], ['ph', x.ph], ['bh', x.bh], ['sh', x.sh], ['Sh', x.Sh], ['k', x.k], ['g', x.g], ['c', x.ch], ['j', x.j], ['T', x.T], ['D', x.D], ['N', x.N], ['t', x.t], ['d', x.d], ['n', x.n], ['p', x.p], ['b', x.b], ['m', x.m], ['y', x.y], ['r', x.r], ['l', x.l], ['L', x.L], ['v', x.v], ['w', x.v], ['s', x.s], ['h', x.h], ['f', x.ph], ['z', x.j], ['q', x.k]];
const TE = mk(
  [['aa', ['\u0C06', '\u0C3E']], ['ai', ['\u0C10', '\u0C48']], ['au', ['\u0C14', '\u0C4C']], ['ee', ['\u0C08', '\u0C40']], ['ii', ['\u0C08', '\u0C40']], ['oo', ['\u0C0A', '\u0C42']], ['uu', ['\u0C0A', '\u0C42']], ['a', ['\u0C05', '']], ['i', ['\u0C07', '\u0C3F']], ['u', ['\u0C09', '\u0C41']], ['e', ['\u0C0E', '\u0C46']], ['o', ['\u0C12', '\u0C4A']], ['A', ['\u0C06', '\u0C3E']], ['I', ['\u0C08', '\u0C40']], ['U', ['\u0C0A', '\u0C42']], ['E', ['\u0C0F', '\u0C47']], ['O', ['\u0C13', '\u0C4B']], ['R', ['\u0C0B', '\u0C43']]],
  [['ksh', '\u0C15\u0C4D\u0C37'], ...CONS({ chh: '\u0C1B', kh: '\u0C16', gh: '\u0C18', ch: '\u0C1A', jh: '\u0C1D', Th: '\u0C20', Dh: '\u0C22', th: '\u0C25', dh: '\u0C27', ph: '\u0C2B', bh: '\u0C2D', sh: '\u0C36', Sh: '\u0C37', k: '\u0C15', g: '\u0C17', j: '\u0C1C', T: '\u0C1F', D: '\u0C21', N: '\u0C23', t: '\u0C24', d: '\u0C26', n: '\u0C28', p: '\u0C2A', b: '\u0C2C', m: '\u0C2E', y: '\u0C2F', r: '\u0C30', l: '\u0C32', L: '\u0C33', v: '\u0C35', s: '\u0C38', h: '\u0C39' }), ['x', '\u0C15\u0C4D\u0C38']],
  [['M', '\u0C02'], ['H', '\u0C03']], '\u0C4D', true);
const HI = mk(
  [['aa', ['\u0906', '\u093E']], ['ai', ['\u0910', '\u0948']], ['au', ['\u0914', '\u094C']], ['ee', ['\u0908', '\u0940']], ['ii', ['\u0908', '\u0940']], ['oo', ['\u090A', '\u0942']], ['uu', ['\u090A', '\u0942']], ['a', ['\u0905', '']], ['i', ['\u0907', '\u093F']], ['u', ['\u0909', '\u0941']], ['e', ['\u090F', '\u0947']], ['o', ['\u0913', '\u094B']], ['A', ['\u0906', '\u093E']], ['I', ['\u0908', '\u0940']], ['U', ['\u090A', '\u0942']], ['E', ['\u090F', '\u0947']], ['O', ['\u0913', '\u094B']], ['R', ['\u090B', '\u0943']]],
  [['ksh', '\u0915\u094D\u0937'], ['gy', '\u091C\u094D\u091E'], ...CONS({ chh: '\u091B', kh: '\u0916', gh: '\u0918', ch: '\u091A', jh: '\u091D', Th: '\u0920', Dh: '\u0922', th: '\u0925', dh: '\u0927', ph: '\u092B', bh: '\u092D', sh: '\u0936', Sh: '\u0937', k: '\u0915', g: '\u0917', j: '\u091C', T: '\u091F', D: '\u0921', N: '\u0923', t: '\u0924', d: '\u0926', n: '\u0928', p: '\u092A', b: '\u092C', m: '\u092E', y: '\u092F', r: '\u0930', l: '\u0932', L: '\u0933', v: '\u0935', s: '\u0938', h: '\u0939' }), ['x', '\u0915\u094D\u0938']],
  [['M', '\u0902'], ['H', '\u0903']], '\u094D', false);
export const SCRIPTS = { te: TE, hi: HI };

function tokenize(src, T) {
  const toks = []; let i = 0;
  while (i < src.length) {
    let t = null;
    for (const len of [3, 2, 1]) {
      const k = src.substr(i, len); if (k.length < len) continue;
      if (T.VOW.has(k)) { t = { t: 'v', k, len }; break; }
      if (T.CON.has(k)) { t = { t: 'c', k, len }; break; }
      if (T.SIGN.has(k)) { t = { t: 's', k, len }; break; }
    }
    if (!t) t = { t: 'o', k: src[i], len: 1 };
    toks.push(t); i += t.len;
  }
  return toks;
}

export function transliterate(src, script = 'te') {
  const T = SCRIPTS[script] || TE, toks = tokenize(String(src), T), n = toks.length;
  // Telugu: word-final "m" after a vowel becomes the anusvara (namaskaaram -> \u0C28\u0C2E\u0C38\u0C4D\u0C15\u0C3E\u0C30\u0C02).
  if (T.finalM && n >= 2 && toks[n - 1].t === 'c' && toks[n - 1].k === 'm' && toks[n - 2].t === 'v') toks[n - 1] = { t: 's', k: 'M', len: 1 };
  let out = '', pend = false;
  for (const tk of toks) {
    if (tk.t === 'c') { if (pend) out += T.virama; out += T.CON.get(tk.k); pend = true; }
    else if (tk.t === 'v') { const [ind, mat] = T.VOW.get(tk.k); if (pend) { out += mat; pend = false; } else out += ind; }
    else if (tk.t === 's') { pend = false; out += T.SIGN.get(tk.k); }
    else { if (pend && T.finalVirama) out += T.virama; pend = false; out += tk.k; }
  }
  if (pend && T.finalVirama) out += T.virama;
  return out;
}
