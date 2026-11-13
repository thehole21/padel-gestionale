import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('./public/', import.meta.url));
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.svg':'image/svg+xml' };
const server = http.createServer(async (req, res) => {
  try {
    const requested = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const filename = path.resolve(root, '.' + (requested === '/' ? '/index.html' : requested));
    if (!filename.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    const body = await readFile(filename);
    res.writeHead(200, { 'Content-Type': types[path.extname(filename)] || 'application/octet-stream', 'X-Content-Type-Options':'nosniff', 'Cache-Control':'no-cache' });
    res.end(body);
  } catch { res.writeHead(404).end('Non trovato'); }
});
server.listen(Number(process.env.PORT || 3000), '127.0.0.1', () => console.log(`Local: http://localhost:${server.address().port}`));
