// Autocorrect, word suggestions and next-word prediction. Pure logic; persistence is optional (localStorage).
import { EN_WORDS, EN_BIGRAMS, TE_WORDS, TE_BIGRAMS, HI_WORDS, HI_BIGRAMS } from './lexicon.js';
import { transliterate } from './translit.js';

const CONTRACTIONS = {
  dont: "don't", cant: "can't", wont: "won't", didnt: "didn't", doesnt: "doesn't",
  isnt: "isn't", arent: "aren't", wasnt: "wasn't", couldnt: "couldn't", shouldnt: "shouldn't",
  wouldnt: "wouldn't", im: "I'm", ive: "I've", youre: "you're", thats: "that's",
  whats: "what's", theyre: "they're", lets: "let's"
};
const STORE_KEY = 'aiprintos:v1:keyboard';

// Optimal-string-alignment distance (insert, delete, substitute, adjacent swap each cost 1).
export function distance(a, b) {
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let p2 = null, p1 = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(p1[j] + 1, cur[j - 1] + 1, p1[j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, p2[j - 2] + 1);
      cur[j] = v;
    }
    p2 = p1; p1 = cur;
  }
  return p1[n];
}

function matchCase(src, w) {
  if (src.length > 1 && src === src.toUpperCase()) return w.toUpperCase();
  if (src[0] === src[0].toUpperCase() && src[0] !== src[0].toLowerCase()) return w[0].toUpperCase() + w.slice(1);
  return w;
}

export function createPredictor(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  const rank = new Map(EN_WORDS.map((w, i) => [w, i]));
  const WORDS = { te: TE_WORDS, hi: HI_WORDS };
  const byKey = {
    te: new Map(TE_WORDS.map(([k, v]) => [k.toLowerCase(), v])),
    hi: new Map(HI_WORDS.map(([k, v]) => [k.toLowerCase(), v]))
  };
  let data = { words: {}, pairs: {}, ignore: [], te: {}, hi: {} };
  try {
    const raw = storage && storage.getItem(STORE_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (d && typeof d === 'object') {
        data = {
          words: d.words || {},
          pairs: d.pairs || {},
          ignore: d.ignore || [],
          te: d.te || {},
          hi: d.hi || {}
        };
      }
    }
  } catch { /* start fresh */ }

  const save = () => { try { storage && storage.setItem(STORE_KEY, JSON.stringify(data)); } catch { /* storage full or blocked */ } };
  const bump = (o, k) => { o[k] = (o[k] || 0) + 1; };
  const trim = (o, max) => { const ks = Object.keys(o); if (ks.length > max) ks.sort((a, b) => o[a] - o[b]).slice(0, ks.length - max).forEach((k) => delete o[k]); };

  const api = {
    isKnown(word) {
      const w = word.toLowerCase();
      return rank.has(w) || (data.words[w] || 0) >= 2 || data.ignore.includes(w) || /^(a|i)$/.test(w);
    },

    // Returns a corrected word, or null if the word is fine / no confident fix exists.
    // Conservative autocorrection: never silently replace when multiple candidates tie for minimum distance.
    correct(word) {
      const w = word.toLowerCase();
      if (w.length < 2 || /[^a-z']/.test(w) || w.length > 20) return null;
      if (Object.hasOwn(CONTRACTIONS, w)) return matchCase(word, CONTRACTIONS[w]);
      if (w.length < 3 || api.isKnown(w)) return null;
      const maxD = w.length >= 8 ? 2 : 1;
      let best = null, bestScore = Infinity, countAtMinDist = 0, minDist = Infinity;
      const consider = (c, r) => {
        if (Math.abs(c.length - w.length) > maxD) return;
        const d = distance(w, c); if (d > maxD || d === 0) return;
        if (d === 2 && c[0] !== w[0]) return;
        if (d < minDist) {
          minDist = d;
          countAtMinDist = 1;
        } else if (d === minDist) {
          countAtMinDist++;
        }
        const score = d * 1000 + (c[0] !== w[0] ? 500 : 0) + r;
        if (score < bestScore) { bestScore = score; best = c; }
      };
      for (const [c, r] of rank) consider(c, r);
      for (const c of Object.keys(data.words)) if (data.words[c] >= 2) consider(c, 300);

      // If ambiguous (multiple words at edit distance 1, e.g. "hellp" -> "help", "hello"), don't silently force
      if (countAtMinDist > 1) return null;
      return best ? matchCase(word, best) : null;
    },

    // Current word completions + near-match fuzzy suggestions for typos
    completions(prefix, n = 3) {
      const p = prefix.toLowerCase(); if (!p) return [];
      const out = [];
      const user = Object.keys(data.words).filter((w) => w.startsWith(p) && w !== p && data.words[w] >= 2).sort((a, b) => data.words[b] - data.words[a]);
      for (const w of [...user, ...EN_WORDS.filter((w) => w.startsWith(p) && w !== p)]) {
        if (!out.includes(w)) out.push(w);
        if (out.length >= n) break;
      }
      // If prefix has few/no matches, offer near-distance suggestions (e.g. "hellp" -> "hello", "help")
      if (out.length < n && p.length >= 3) {
        const near = EN_WORDS.filter((w) => Math.abs(w.length - p.length) <= 1 && distance(p, w) === 1);
        for (const w of near) {
          if (!out.includes(w)) out.push(w);
          if (out.length >= n) break;
        }
      }
      return out.map((w) => matchCase(prefix, w));
    },

    nextWords(prev, n = 3) {
      const key = (prev || '').toLowerCase(), out = [];
      const mine = data.pairs[key] ? Object.entries(data.pairs[key]).sort((a, b) => b[1] - a[1]).map((e) => e[0]) : [];
      const built = (EN_BIGRAMS[key] || '').split(' ').filter(Boolean);
      for (const w of [...mine, ...built, ...(key ? [] : ['I', 'The', 'Thank'])]) {
        if (!out.includes(w)) out.push(w);
        if (out.length >= n) break;
      }
      return out;
    },

    learn(prev, word) {
      const w = word.toLowerCase(); if (!/^[a-z']{2,20}$/.test(w)) return;
      if (!rank.has(w)) { bump(data.words, w); trim(data.words, 800); }
      if (prev && /^[a-z']+$/i.test(prev)) {
        const p = prev.toLowerCase(); data.pairs[p] = data.pairs[p] || {};
        bump(data.pairs[p], w); trim(data.pairs, 400);
      }
      save();
    },

    ignore(word) {
      const w = word.toLowerCase();
      if (!data.ignore.includes(w)) {
        data.ignore.push(w);
        if (data.ignore.length > 300) data.ignore.shift();
        save();
      }
    },

    // ---- Multilingual Transliteration & Suggestions ----
    phFromRoman(script, roman) {
      const list = byKey[script];
      return (list && list.get(roman.toLowerCase())) || transliterate(roman, script);
    },

    phSuggest(script, roman, n = 3) {
      const out = [], k = roman.toLowerCase(), list = WORDS[script] || [];
      const first = api.phFromRoman(script, roman);
      if (first) out.push(first);
      const hits = list.filter(([key]) => key.startsWith(k) && key !== k).sort((a, b) => a[0].length - b[0].length);
      for (const [, sc] of hits) { if (!out.includes(sc)) out.push(sc); if (out.length >= n) break; }
      if (out.length < n) {
        const near = list.map(([key, sc]) => [distance(k, key), sc]).filter(([d]) => d <= (k.length > 6 ? 2 : 1)).sort((a, b) => a[0] - b[0]);
        for (const [, sc] of near) { if (!out.includes(sc)) out.push(sc); if (out.length >= n) break; }
      }
      // Always allow retaining the exact Latin roman spelling as a candidate choice
      if (!out.includes(roman)) out.push(roman);
      return out.slice(0, n + 1);
    },

    // ---- Telugu ----
    teFromRoman(roman) { return api.phFromRoman('te', roman); },
    teSuggest(roman, n = 3) { return api.phSuggest('te', roman, n); },
    teComplete(prefix, n = 3) {
      if (!prefix) return [];
      const all = [...new Set([...TE_WORDS.map((e) => e[1]), ...Object.keys(data.te).filter((w) => data.te[w] >= 2)])];
      return all.filter((w) => w.startsWith(prefix) && w !== prefix).slice(0, n);
    },
    teNext(prev, n = 3) {
      const out = [], mine = data.te['>' + prev] ? Object.keys(data.te['>' + prev]) : [];
      for (const w of [...mine, ...(TE_BIGRAMS[prev] || '').split(' ').filter(Boolean)]) {
        if (w && !out.includes(w)) out.push(w);
        if (out.length >= n) break;
      }
      return out;
    },
    teLearn(word) {
      if (word && word.length > 1 && word.length < 30) {
        bump(data.te, word);
        save();
      }
    },

    // ---- Hindi ----
    hiFromRoman(roman) { return api.phFromRoman('hi', roman); },
    hiSuggest(roman, n = 3) { return api.phSuggest('hi', roman, n); },
    hiComplete(prefix, n = 3) {
      if (!prefix) return [];
      const all = [...new Set([...HI_WORDS.map((e) => e[1]), ...Object.keys(data.hi).filter((w) => data.hi[w] >= 2)])];
      return all.filter((w) => w.startsWith(prefix) && w !== prefix).slice(0, n);
    },
    hiNext(prev, n = 3) {
      const out = [], mine = data.hi['>' + prev] ? Object.keys(data.hi['>' + prev]) : [];
      for (const w of [...mine, ...(HI_BIGRAMS[prev] || '').split(' ').filter(Boolean)]) {
        if (w && !out.includes(w)) out.push(w);
        if (out.length >= n) break;
      }
      return out;
    },
    hiLearn(word) {
      if (word && word.length > 1 && word.length < 30) {
        bump(data.hi, word);
        save();
      }
    },

    reset() {
      data = { words: {}, pairs: {}, ignore: [], te: {}, hi: {} };
      save();
    }
  };

  return api;
}
