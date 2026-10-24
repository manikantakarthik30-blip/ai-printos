// Netlify adapter: /api/<name> (rewritten in netlify.toml) -> lib/router.js
import { handle } from '../../lib/router.js';

export async function handler(event) {
  const name = String(event.path || '').split('/').filter(Boolean).pop() || '';
  const headers = Object.fromEntries(Object.entries(event.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
  const body = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : event.body;
  const out = await handle(name, { method: event.httpMethod, headers, query: event.queryStringParameters || {}, body }, process.env);
  const res = { statusCode: out.status, headers: out.headers, body: out.body };
  if (out.cookies && out.cookies.length) res.multiValueHeaders = { 'set-cookie': out.cookies };
  return res;
}
