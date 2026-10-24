// Browser-side client for the serverless API. No secrets live here: all private calls go through /api/*.
import { st } from '../core/state.js';

const HEADERS = { 'content-type': 'application/json', 'x-requested-with': 'aiprintos' };

export async function loadConfig(force = false) {
  if (st.config && !force) return st.config;
  try {
    const r = await fetch('/api/config', { cache: 'no-store' });
    if (!r.ok) throw new Error('status ' + r.status);
    st.config = { reachable: true, ...(await r.json()) };
  } catch {
    st.config = { reachable: false, gemini: { configured: false }, canva: { configured: false, connected: false }, adobe: { configured: false } };
  }
  return st.config;
}

async function post(path, body, signal) {
  let r;
  try { r = await fetch(path, { method: 'POST', headers: HEADERS, body: JSON.stringify(body), signal }); }
  catch (e) { if (e.name === 'AbortError') throw Object.assign(new Error('Cancelled.'), { code: 'cancelled' }); throw Object.assign(new Error('Network error. Check your connection and try again.'), { code: 'network', retryable: true }); }
  let data = null; try { data = await r.json(); } catch { /* non-JSON response */ }
  if (r.status === 404 && !data) throw Object.assign(new Error('The API is not available here. Run the project with "npm run dev", "vercel dev" or "netlify dev", or deploy it (see README).'), { code: 'no_api' });
  if (!r.ok || !data || data.ok === false) {
    const e = (data && data.error) || {}; throw Object.assign(new Error(e.message || `Request failed (${r.status}).`), { code: e.code || 'error', retryable: !!e.retryable });
  }
  return data;
}

export async function generateImage(prompt, aspect, signal) {
  const data = await post('/api/generate-image', { prompt, aspect }, signal);
  if (!data.image || !/^image\/(png|jpeg|webp)$/.test(data.image.mimeType) || !/^[A-Za-z0-9+/=]+$/.test(data.image.data)) throw Object.assign(new Error('The server returned an invalid image.'), { code: 'bad_image' });
  return data.image;
}
export const canvaCreateDesign = (width, height, title) => post('/api/canva-design', { width, height, title });
