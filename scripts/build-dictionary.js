// Build step (run once, offline): expands the Hunspell en_US .dic/.aff pair into a plain lowercase word list that the
// browser loads on demand. Usage: node scripts/build-dictionary.js path/to/en_US.dic path/to/en_US.aff
// Source: LibreOffice/dictionaries (en_US, SCOWL licence; see public/data/dict/en_US.README.txt).
import { readFileSync, writeFileSync } from 'node:fs';

export function expand(dicText, affText) {
  const rules = { SFX: {}, PFX: {} };
  for (const line of affText.split(/\r?\n/)) {
    const p = line.trim().split(/\s+/);
    if ((p[0] === 'SFX' || p[0] === 'PFX') && p.length >= 5) {
      const [kind, flag, strip, add, cond] = p; const addWord = add.split('/')[0];
      (rules[kind][flag] ||= { cross: false, list: [] }).list.push({ strip: strip === '0' ? '' : strip, add: addWord === '0' ? '' : addWord, re: new RegExp(kind === 'SFX' ? `${cond}$` : `^${cond}`) });
    } else if ((p[0] === 'SFX' || p[0] === 'PFX') && p.length === 4) (rules[p[0]][p[1]] ||= { cross: false, list: [] }).cross = p[2] === 'Y';
  }
  const out = new Set(), lines = dicText.split(/\r?\n/).slice(1);
  const apply = (w, kind, flag) => {
    const r = rules[kind][flag]; if (!r) return [];
    return r.list.filter((x) => x.re.test(w)).map((x) => kind === 'SFX' ? w.slice(0, w.length - x.strip.length) + x.add : x.add + w.slice(x.strip.length));
  };
  for (const line of lines) {
    if (!line.trim()) continue;
    const [word, flags = ''] = line.split('/'); const w = word.trim(); out.add(w.toLowerCase());
    const sfx = [], pfx = [];
    for (const f of flags.trim()) { for (const x of apply(w, 'SFX', f)) { out.add(x.toLowerCase()); sfx.push([x, f]); } for (const x of apply(w, 'PFX', f)) { out.add(x.toLowerCase()); pfx.push(x); } }
    if (pfx.length && sfx.length) for (const [s, f] of sfx) if (rules.SFX[f] && rules.SFX[f].cross) for (const pf of flags.trim()) if (rules.PFX[pf] && rules.PFX[pf].cross) for (const x of apply(s, 'PFX', pf)) out.add(x.toLowerCase());
  }
  return [...out].filter((x) => /^[a-z'’-]+$/.test(x)).sort();
}
if (process.argv[1] && process.argv[1].endsWith('build-dictionary.js')) {
  const [dic, aff] = process.argv.slice(2); const words = expand(readFileSync(dic, 'utf8'), readFileSync(aff, 'utf8'));
  writeFileSync(new URL('../public/data/dict/en_US.words.txt', import.meta.url), words.join('\n')); console.log(words.length, 'words');
}
