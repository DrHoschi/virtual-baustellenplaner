/**
 * scripts/static-server.mjs
 * Version: v1.0.0 (2026-02-08)
 *
 * Kleiner Zero-Dependency Static Server für Playwright/CI.
 *
 * Nutzung:
 *   node scripts/static-server.mjs --port 4173 --root .
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

function getArg(name, fallback = null) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return fallback;
  const v = process.argv[idx + 1];
  return v == null ? fallback : v;
}

const port = Number(getArg('--port', '4173'));
const root = path.resolve(process.cwd(), getArg('--root', '.'));

const MIME = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
  ['.gif', 'image/gif'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2']
]);

function safeJoin(rootDir, reqPath) {
  // decode + strip query handled by URL parsing
  const cleaned = reqPath.replace(/\0/g, '');
  const joined = path.normalize(path.join(rootDir, cleaned));
  // Prevent path traversal
  if (!joined.startsWith(rootDir)) return null;
  return joined;
}

function send(res, code, body, headers = {}) {
  res.writeHead(code, {
    'Cache-Control': 'no-store',
    ...headers
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  try {
    const u = new URL(req.url, `http://${req.headers.host}`);
    let pathname = u.pathname || '/';

    // Root -> index.html
    if (pathname === '/') pathname = '/index.html';

    const abs = safeJoin(root, pathname);
    if (!abs) return send(res, 403, 'Forbidden');

    if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) {
      return send(res, 404, 'Not Found');
    }

    const ext = path.extname(abs).toLowerCase();
    const mime = MIME.get(ext) || 'application/octet-stream';

    const buf = fs.readFileSync(abs);
    return send(res, 200, buf, { 'Content-Type': mime });
  } catch (e) {
    return send(res, 500, `Server Error: ${String(e?.message || e)}`);
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`[static-server] serving "${root}" on http://127.0.0.1:${port}`);
});
