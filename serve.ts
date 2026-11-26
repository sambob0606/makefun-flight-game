// A tiny static server for play-testing Skyline Courier locally (Node 22, stdlib only).
// Run `node serve.ts` and open http://localhost:8080 — it serves game/ exactly as a
// static host would, so what plays here is what the entry ships.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), 'game');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
};

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const rel = normalize(url.pathname === '/' ? 'index.html' : url.pathname.slice(1));
  if (rel.startsWith('..')) { res.writeHead(403); res.end(); return; }
  try {
    const body = await readFile(join(root, rel));
    res.writeHead(200, { 'content-type': types[extname(rel)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404); res.end('not found');
  }
}).listen(8080, () => console.log('Skyline Courier at http://localhost:8080'));
