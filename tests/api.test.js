import test from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../lib/router.js';

const H = { 'content-type': 'application/json', 'x-requested-with': 'aiprintos', host: 'example.test', 'x-forwarded-proto': 'https' };
const env = { GEMINI_API_KEY: 'test-key', CANVA_CLIENT_ID: 'cid', CANVA_CLIENT_SECRET: 'sec' };
const mock = (status, body) => async (url, opts) => { mock.last = { url, opts }; return { ok: status < 400, status, json: async () => body }; };
const gen = (body, e = env, f) => handle('generate-image', { method: 'POST', headers: H, body }, e, f);

test('config never leaks secrets', async () => {
  const r = await handle('config', { method: 'GET', headers: {} }, { ...env, ADOBE_EXPRESS_CLIENT_ID: 'pub' });
  const b = JSON.parse(r.body); assert.equal(b.gemini.configured, true); assert.equal(b.adobe.clientId, 'pub');
  assert.ok(!r.body.includes('test-key') && !r.body.includes('sec"'));
});
test('generate-image: guards and validation', async () => {
  assert.equal((await handle('generate-image', { method: 'GET', headers: H }, env)).status, 405);
  assert.equal((await handle('generate-image', { method: 'POST', headers: { ...H, 'x-requested-with': '' }, body: {} }, env)).status, 403);
  assert.equal((await gen({ prompt: 'x' }, {})).status, 503);
  assert.equal((await gen({ prompt: '   ' })).status, 400);
  assert.equal((await gen({ prompt: 'a'.repeat(1001) })).status, 400);
  assert.equal((await handle('nope', { method: 'GET', headers: {} }, env)).status, 404);
});
test('generate-image: success sends key in header only, never in URL or body', async () => {
  const f = mock(200, { candidates: [{ content: { parts: [{ text: 'ok' }, { inlineData: { mimeType: 'image/png', data: 'QUJD' } }] } }] });
  const r = await gen({ prompt: 'marigolds', aspect: '16:9' }, env, f);
  assert.equal(r.status, 200); assert.deepEqual(JSON.parse(r.body), { ok: true, image: { mimeType: 'image/png', data: 'QUJD' } });
  assert.equal(mock.last.opts.headers['x-goog-api-key'], 'test-key'); assert.ok(!mock.last.url.includes('test-key') && !mock.last.opts.body.includes('test-key'));
  assert.match(mock.last.url, /gemini-2\.5-flash-image:generateContent$/); assert.match(mock.last.opts.body, /16:9/);
});
test('generate-image: upstream failures map to clear errors', async () => {
  const cases = [[429, {}, 429, 'rate_limited', true], [403, {}, 502, 'upstream_auth', false], [500, {}, 502, 'upstream_error', true]];
  for (const [s, b, st, code, retry] of cases) { const r = await gen({ prompt: 'x' }, env, mock(s, b)); const j = JSON.parse(r.body); assert.equal(r.status, st); assert.equal(j.error.code, code); assert.equal(j.error.retryable, retry); }
  let r = await gen({ prompt: 'x' }, env, mock(200, { promptFeedback: { blockReason: 'SAFETY' } })); assert.equal(JSON.parse(r.body).error.code, 'blocked');
  r = await gen({ prompt: 'x' }, env, mock(200, { candidates: [{ content: { parts: [{ text: 'sorry' }] } }] })); assert.equal(JSON.parse(r.body).error.code, 'no_image');
  r = await gen({ prompt: 'x' }, env, mock(200, { candidates: [{ content: { parts: [{ inlineData: { mimeType: 'text/html', data: 'QQ==' } }] } }] })); assert.equal(JSON.parse(r.body).error.code, 'bad_image');
  r = await gen({ prompt: 'x' }, env, async () => { throw Object.assign(new Error('x'), { name: 'AbortError' }); }); assert.equal(r.status, 504);
  r = await gen({ prompt: 'x' }, env, async () => { throw new Error('dns'); }); assert.equal(r.status, 502);
});
test('canva: auth redirect uses PKCE, derives host, sets HttpOnly cookie; design needs a token', async () => {
  const r = await handle('canva-auth', { method: 'GET', headers: H }, env);
  assert.equal(r.status, 302); const u = new URL(r.headers.location);
  assert.equal(u.origin + u.pathname, 'https://www.canva.com/api/oauth/authorize'); assert.equal(u.searchParams.get('redirect_uri'), 'https://example.test/api/canva-callback');
  assert.equal(u.searchParams.get('code_challenge_method'), 's256'); assert.ok(!r.headers.location.includes('sec'));
  assert.match(r.cookies[0], /HttpOnly/); assert.match(r.cookies[0], /Secure/);
  assert.equal((await handle('canva-auth', { method: 'GET', headers: H }, {})).status, 503);
  assert.equal((await handle('canva-design', { method: 'POST', headers: H, body: { width: 100, height: 100 } }, env)).status, 401);
  const withTok = { ...H, cookie: 'aip_canva_token=abc' };
  assert.equal((await handle('canva-design', { method: 'POST', headers: withTok, body: { width: 5, height: 100 } }, env)).status, 400);
  const ok = await handle('canva-design', { method: 'POST', headers: withTok, body: { width: 800, height: 600, title: 't' } }, env, mock(200, { design: { urls: { edit_url: 'https://canva.example/e' } } }));
  assert.equal(JSON.parse(ok.body).editUrl, 'https://canva.example/e'); assert.equal(mock.last.opts.headers.authorization, 'Bearer abc');
});
test('canva callback rejects a mismatched state', async () => {
  const r = await handle('canva-callback', { method: 'GET', headers: { ...H, cookie: 'aip_canva_oauth=good.verifier' }, query: { code: 'c', state: 'evil' } }, env);
  assert.match(r.headers.location, /canva=error/);
});
