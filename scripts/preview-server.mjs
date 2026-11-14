import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve('dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.ttf': 'font/ttf', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };
http.createServer(async (req, res) => {
  const target = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname.replace(/\/$/, '/index.html'));
  if (!target.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  try { res.setHeader('Content-Type', types[path.extname(target)] ?? 'application/octet-stream'); res.end(await readFile(target)); }
  catch {
    if (path.extname(target)) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', 'text/html');
    res.end(await readFile(path.join(root, 'index.html')));
  }
}).listen(8089, '127.0.0.1');
