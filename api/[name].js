// Vercel adapter: /api/<name> -> lib/router.js
import { handle } from '../lib/router.js';

export default async function handler(req, res) {
  const out = await handle(String(req.query.name || ''), { method: req.method, headers: req.headers, query: req.query, body: req.body }, process.env);
  for (const [k, v] of Object.entries(out.headers || {})) res.setHeader(k, v);
  if (out.cookies && out.cookies.length) res.setHeader('Set-Cookie', out.cookies);
  res.status(out.status).send(out.body);
}
