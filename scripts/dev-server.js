// Zero-dependency local server: serves /public and mounts the same API handlers used on Vercel/Netlify.
// Usage: copy .env.example to .env, fill in keys, then `node scripts/dev-server.js`
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handle } from '../lib/router.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const pub = join(root, 'public');
const envFile = join(root, '.env');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon' };
const port = Number(process.env.PORT) || 3000;

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith('/api/')) {
      const chunks = []; for await (const c of req) chunks.push(c);
      const raw = Buffer.concat(chunks).toString('utf8');
      let body = raw; if (String(req.headers['content-type'] || '').includes('json')) { try { body = JSON.parse(raw); } catch { body = raw; } }
      const out = await handle(url.pathname.slice(5), { method: req.method, headers: req.headers, query: Object.fromEntries(url.searchParams), body }, process.env);
      for (const [k, v] of Object.entries(out.headers || {})) res.setHeader(k, v);
      if (out.cookies && out.cookies.length) res.setHeader('Set-Cookie', out.cookies);
      res.statusCode = out.status; return res.end(out.body);
    }
    const rawRel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const rel = normalize(rawRel).replace(/^(\.\.[/\\])+/, '');
    let file = join(pub, (rel === '' || rel === '.' || rel === '/' || rel === '\\') ? 'index.html' : rel);
    if (!file.startsWith(pub)) { res.statusCode = 403; return res.end('Forbidden'); }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    const data = await readFile(file);
    res.setHeader('content-type', MIME[extname(file)] || 'application/octet-stream');
    res.end(data);
  } catch (e) {
    res.statusCode = e.code === 'ENOENT' || e.code === 'EISDIR' ? 404 : 500; res.end(res.statusCode === 404 ? 'Not found' : 'Server error');
  }
}).listen(port, () => console.log(`AI PrintOS dev server: http://localhost:${port}  (Gemini ${process.env.GEMINI_API_KEY ? 'configured' : 'NOT configured'})`));
