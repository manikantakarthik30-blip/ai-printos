// Template library client: loads templates/manifest.json and individual template files, validates them, and makes
// editable COPIES (the library files are never modified).
import { validate } from '../model.js';
import { uid } from '../core/util.js';

let cache = null;
const inline = () => (typeof window !== 'undefined' && window.__AIP_LIB__) || null; // set only by the single-file preview build
export const assetUrl = (path) => { const i = inline(); return i && i[path] ? i[path] : path; };

async function getText(path) {
  const i = inline(); if (i && i[path] && !i[path].startsWith('data:')) return i[path];
  let r; try { r = await fetch(path); } catch { throw new Error('Network error while loading ' + path + '. Check your connection and retry.'); }
  if (!r.ok) throw new Error(`File not found or unavailable (${r.status}): ${path}`);
  return r.text();
}
export async function loadManifest(force = false) {
  if (cache && !force) return cache;
  let m; try { m = JSON.parse(await getText('templates/manifest.json')); } catch (e) { throw new Error('The template library could not be loaded. ' + e.message); }
  if (!m || !Array.isArray(m.templates) || !m.templates.length) throw new Error('The template manifest is empty or malformed.');
  return (cache = m);
}
export async function loadTemplateDoc(entry) {
  let j; try { j = JSON.parse(await getText(entry.file)); } catch (e) { throw new Error(e instanceof SyntaxError ? 'The template file is not valid JSON.' : e.message); }
  const v = validate(j); if (!v.ok) throw new Error('The template file failed validation: ' + v.error);
  return v.doc;
}
export function copyForEditing(doc, entry) {
  const d = JSON.parse(JSON.stringify(doc)), now = new Date().toISOString();
  d.id = uid('d'); d.els.forEach((e) => { e.id = uid(e.type[0]); }); d.created = d.updated = now; d.name = entry.name;
  d.meta = { ...d.meta, origin: 'template', templateId: entry.id };
  return d;
}
export const fetchSource = (entry, kind) => getText(entry[kind]);
