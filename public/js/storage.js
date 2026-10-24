import { validate } from './model.js';

const KEY = 'aiprintos:v1:project:';
export const store = {
  list() {
    const a = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(KEY)) { try { const r = validate(JSON.parse(localStorage.getItem(k))); if (r.ok) a.push(r.doc); else console.warn('Skipped unreadable project', k, r.error); } catch { console.warn('Skipped corrupt project', k); } }
      }
    } catch { return { ok: false, error: 'Browser storage is unavailable, so saved designs cannot be read.' }; }
    a.sort((x, y) => Date.parse(y.updated) - Date.parse(x.updated));
    return { ok: true, docs: a };
  },
  get(id) {
    try {
      const raw = localStorage.getItem(KEY + id); if (!raw) return { ok: false, error: 'That design was not found in this browser.' };
      const r = validate(JSON.parse(raw)); return r.ok ? { ok: true, doc: r.doc } : { ok: false, error: r.error };
    } catch { return { ok: false, error: 'That design could not be read.' }; }
  },
  save(doc) {
    doc.updated = new Date().toISOString();
    try { localStorage.setItem(KEY + doc.id, JSON.stringify(doc)); return { ok: true }; }
    catch (e) { return { ok: false, error: e && e.name === 'QuotaExceededError' ? 'Browser storage is full (about 5 MB). Delete a design or download it as JSON, then try again.' : 'The design could not be saved to browser storage.' }; }
  },
  remove(id) { try { localStorage.removeItem(KEY + id); return { ok: true }; } catch { return { ok: false, error: 'Storage is unavailable.' }; } },
  clear() { let n = 0; try { for (const k of Object.keys(localStorage)) if (k.startsWith(KEY)) { localStorage.removeItem(k); n++; } return { ok: true, n }; } catch { return { ok: false, error: 'Storage is unavailable.' }; } }
};
