// Server-side logic shared by the Vercel and Netlify adapters.
// Secrets are read from `env` (process.env on the server) and never reach the browser.
import { randomBytes, createHash } from 'node:crypto';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';
const DEFAULT_MODEL = 'gemini-2.5-flash-image';
const MAX_PROMPT = 1000;
const ASPECTS = { '1:1': 'square (1:1)', '3:4': 'portrait (3:4)', '4:3': 'landscape (4:3)', '9:16': 'tall portrait (9:16)', '16:9': 'wide landscape (16:9)' };
const ASPECT_DIMS = {
  '1:1': { width: 768, height: 768 },
  '3:4': { width: 768, height: 1024 },
  '4:3': { width: 1024, height: 768 },
  '9:16': { width: 576, height: 1024 },
  '16:9': { width: 1024, height: 576 }
};
const CANVA_AUTH = 'https://www.canva.com/api/oauth/authorize';
const CANVA_API = 'https://api.canva.com/rest/v1';

async function generateWithPollinations(prompt, aspect, f) {
  const dims = ASPECT_DIMS[aspect] || { width: 768, height: 768 };
  const query = new URLSearchParams({
    width: String(dims.width),
    height: String(dims.height),
    nologo: 'true'
  });
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${query}`;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 45000);
  try {
    const res = await f(url, { signal: ctl.signal });
    if (res.status === 402 || res.status === 429) {
      return fail(429, 'rate_limited', 'Free generation rate limit (1 image per 45s). Wait a moment and click Retry.', true);
    }
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf || buf.length < 500) return null;
    return json(200, { ok: true, image: { mimeType: 'image/jpeg', data: buf.toString('base64') } });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const json = (status, body, headers = {}, cookies = []) => ({ status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers }, body: JSON.stringify(body), cookies });
const fail = (status, code, message, retryable = false) => json(status, { ok: false, error: { code, message, retryable } });
const redirect = (location, cookies = []) => ({ status: 302, headers: { location, 'cache-control': 'no-store' }, body: '', cookies });

function parseCookies(h = '') {
  const o = {};
  for (const p of String(h).split(';')) { const i = p.indexOf('='); if (i > 0) o[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); }
  return o;
}
const cookie = (name, value, { maxAge, secure }) => `${name}=${encodeURIComponent(value)}; Path=/api; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
const b64url = (buf) => Buffer.from(buf).toString('base64url');

function origin(req) {
  const proto = (req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim();
  const host = (req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  return { base: `${proto}://${host}`, secure: proto === 'https' };
}

// State-changing requests must carry a custom header and a JSON body. Browsers cannot send these
// cross-site without a CORS preflight, and this API sends no CORS headers, so cross-site calls fail.
function guardPost(req, env) {
  if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST.');
  if (req.headers['x-requested-with'] !== 'aiprintos') return fail(403, 'forbidden', 'Missing required request header.');
  if (!String(req.headers['content-type'] || '').includes('application/json')) return fail(415, 'unsupported_media_type', 'Send JSON.');
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (allowed.length && req.headers.origin && !allowed.includes(req.headers.origin)) return fail(403, 'forbidden', 'Origin not allowed.');
  return null;
}
function bodyOf(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch { return null; }
}

const routes = {
  async config(req, env) {
    const c = parseCookies(req.headers.cookie);
    return json(200, {
      gemini: { configured: true },
      canva: { configured: !!(env.CANVA_CLIENT_ID && env.CANVA_CLIENT_SECRET), connected: !!c.aip_canva_token },
      // The Adobe Express client ID is a public identifier by design (it is bound to your allowed domains).
      adobe: { configured: !!env.ADOBE_EXPRESS_CLIENT_ID, clientId: env.ADOBE_EXPRESS_CLIENT_ID || '', appName: env.ADOBE_EXPRESS_APP_NAME || 'AI PrintOS' }
    });
  },

  async 'generate-image'(req, env, f) {
    const bad = guardPost(req, env); if (bad) return bad;
    const b = bodyOf(req);
    if (!b || typeof b.prompt !== 'string') return fail(400, 'invalid_request', 'A text prompt is required.');
    const prompt = b.prompt.trim();
    if (!prompt) return fail(400, 'invalid_request', 'Describe the image you want first.');
    if (prompt.length > MAX_PROMPT) return fail(400, 'invalid_request', `Prompt is longer than ${MAX_PROMPT} characters.`);
    const aspect = b.aspect in ASPECTS ? b.aspect : '1:1';

    // 1. If Gemini API key is configured and not explicitly set to pollinations only, attempt Gemini:
    if (env.GEMINI_API_KEY && env.IMAGE_PROVIDER !== 'pollinations') {
      const model = /^[a-z0-9.\-]+$/i.test(env.GEMINI_IMAGE_MODEL || '') ? env.GEMINI_IMAGE_MODEL : DEFAULT_MODEL;
      const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 55000);
      let r;
      try {
        r = await f(`${GEMINI_BASE}${model}:generateContent`, {
          method: 'POST', signal: ctl.signal,
          headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
          body: JSON.stringify({ contents: [{ parts: [{ text: `${prompt}\n\nCreate a ${ASPECTS[aspect]} image suitable for print design. Do not include watermarks.` }] }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } })
        });
      } catch (e) {
        // Upstream failure: fallback to free generator
        const freeImg = await generateWithPollinations(prompt, aspect, f);
        if (freeImg) return freeImg;
        return e.name === 'AbortError' ? fail(504, 'timeout', 'The image service took too long. Try again.', true) : fail(502, 'upstream_unreachable', 'Could not reach the image service.', true);
      } finally { clearTimeout(timer); }

      let data = null; try { data = await r.json(); } catch { /* handled below */ }
      if (!r.ok) {
        // Quota exceeded (429) or model unavailable (404/503): seamlessly fall back to free generator
        if (r.status === 429 || r.status === 404 || r.status >= 500) {
          const freeImg = await generateWithPollinations(prompt, aspect, f);
          if (freeImg) return freeImg;
        }
        const msg = data && data.error && data.error.message ? String(data.error.message).slice(0, 300) : '';
        if (r.status === 429) return fail(429, 'rate_limited', 'Image quota or rate limit reached. Wait a moment and retry.', true);
        if (r.status === 401 || r.status === 403) return fail(502, 'upstream_auth', 'The server API key was rejected or lacks access to this model.');
        if (r.status === 400) return fail(502, 'upstream_bad_request', msg || 'The image service rejected the request.');
        return fail(502, 'upstream_error', `The image service returned an error (${r.status}).`, r.status >= 500);
      }
      const block = data && data.promptFeedback && data.promptFeedback.blockReason;
      if (block) return fail(422, 'blocked', 'This prompt was blocked by the safety filter. Rephrase it and retry.');
      const cand = data && data.candidates && data.candidates[0];
      const parts = (cand && cand.content && cand.content.parts) || [];
      const img = parts.map((p) => p.inlineData || p.inline_data).find((d) => d && d.data);
      if (!img) {
        const freeImg = await generateWithPollinations(prompt, aspect, f);
        if (freeImg) return freeImg;
        const text = parts.map((p) => p.text).filter(Boolean).join(' ').slice(0, 300);
        const why = cand && /SAFETY|PROHIBITED/.test(cand.finishReason || '') ? 'The result was blocked by the safety filter.' : 'The model returned no image.';
        return fail(422, 'no_image', text ? `${why} Model said: ${text}` : why, true);
      }
      const mime = img.mimeType || img.mime_type || 'image/png';
      if (!/^image\/(png|jpeg|webp)$/.test(mime)) return fail(502, 'bad_image', 'The model returned an unsupported image type.');
      return json(200, { ok: true, image: { mimeType: mime, data: img.data } });
    }

    // 2. If Gemini is not configured, check if IMAGE_PROVIDER is pollinations:
    if (env.IMAGE_PROVIDER === 'pollinations') {
      const freeImg = await generateWithPollinations(prompt, aspect, f);
      if (freeImg) return freeImg;
    }
    return fail(503, 'not_configured', 'Image generation is not configured on the server. Set GEMINI_API_KEY.');
  },

  // ---- Canva Connect (OAuth 2.0 + PKCE). Needs a Canva developer integration. See README. ----
  async 'canva-auth'(req, env) {
    if (!(env.CANVA_CLIENT_ID && env.CANVA_CLIENT_SECRET)) return fail(503, 'not_configured', 'Canva is not configured. Set CANVA_CLIENT_ID and CANVA_CLIENT_SECRET.');
    const { base, secure } = origin(req);
    const verifier = b64url(randomBytes(48)), state = b64url(randomBytes(16));
    const challenge = b64url(createHash('sha256').update(verifier).digest());
    const redirectUri = env.CANVA_REDIRECT_URI || `${base}/api/canva-callback`;
    const q = new URLSearchParams({ code_challenge_method: 's256', response_type: 'code', client_id: env.CANVA_CLIENT_ID, scope: 'design:content:write design:meta:read', code_challenge: challenge, state, redirect_uri: redirectUri });
    return redirect(`${CANVA_AUTH}?${q}`, [cookie('aip_canva_oauth', `${state}.${verifier}`, { maxAge: 600, secure })]);
  },

  async 'canva-callback'(req, env, f) {
    const { base, secure } = origin(req);
    const back = (s) => redirect(`${base}/#/integrations?canva=${s}`, [cookie('aip_canva_oauth', '', { maxAge: 0, secure })]);
    const c = parseCookies(req.headers.cookie), [state, verifier] = (c.aip_canva_oauth || '').split('.');
    const { code, state: gotState } = req.query || {};
    if (!code || !state || !verifier || gotState !== state) return back('error');
    try {
      const r = await f(`${CANVA_API}/oauth/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: 'Basic ' + Buffer.from(`${env.CANVA_CLIENT_ID}:${env.CANVA_CLIENT_SECRET}`).toString('base64') },
        body: new URLSearchParams({ grant_type: 'authorization_code', code, code_verifier: verifier, redirect_uri: env.CANVA_REDIRECT_URI || `${base}/api/canva-callback` })
      });
      const t = await r.json();
      if (!r.ok || !t.access_token) return back('error');
      return redirect(`${base}/#/integrations?canva=connected`, [cookie('aip_canva_token', t.access_token, { maxAge: Math.min(Number(t.expires_in) || 3600, 14400), secure }), cookie('aip_canva_oauth', '', { maxAge: 0, secure })]);
    } catch { return back('error'); }
  },

  async 'canva-design'(req, env, f) {
    const bad = guardPost(req, env); if (bad) return bad;
    const token = parseCookies(req.headers.cookie).aip_canva_token;
    if (!token) return fail(401, 'not_connected', 'Connect your Canva account first.');
    const b = bodyOf(req) || {}, w = Number(b.width), h = Number(b.height);
    if (![w, h].every((n) => Number.isInteger(n) && n >= 40 && n <= 8000)) return fail(400, 'invalid_request', 'Canva designs must be 40–8000 px per side.');
    const title = String(b.title || 'Untitled design').slice(0, 255);
    try {
      const r = await f(`${CANVA_API}/designs`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ design_type: { type: 'custom', width: w, height: h }, title }) });
      const d = await r.json().catch(() => ({}));
      if (r.status === 401) return fail(401, 'not_connected', 'Your Canva session expired. Connect again.');
      if (!r.ok || !d.design || !d.design.urls) return fail(502, 'upstream_error', `Canva returned an error (${r.status}).`);
      return json(200, { ok: true, editUrl: d.design.urls.edit_url });
    } catch { return fail(502, 'upstream_unreachable', 'Could not reach Canva.', true); }
  }
};

export async function handle(name, req, env = {}, fetchImpl = fetch) {
  const fn = Object.hasOwn(routes, name) ? routes[name] : null;
  if (!fn) return fail(404, 'not_found', 'Unknown API route.');
  try { return await fn({ ...req, headers: req.headers || {} }, env, fetchImpl); }
  catch (e) { console.error('api error', name, e && e.message); return fail(500, 'server_error', 'Unexpected server error.'); }
}
