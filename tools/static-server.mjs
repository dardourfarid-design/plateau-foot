// ===================== SERVEUR STATIQUE (E2E / dev) =====================
// Sert un répertoire donné À LA RACINE, comme le fait Vercel avec public/
// (outputDirectory: public). Indispensable pour que les chemins absolus
// (/plausible-init.js, /og-image.jpg, /src/...) résolvent comme en prod.
//
// Usage : node tools/static-server.mjs <racine> <port>
// Ex.   : node tools/static-server.mjs public 8080
//
// Utilisé par playwright.config.js (webServer) et lançable à la main.

import { createServer } from 'http';
import { readFile } from 'fs';
import { extname, join, normalize, resolve } from 'path';

const ROOT = resolve(process.argv[2] || 'public');
const PORT = Number(process.argv[3] || 8080);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8'
};

createServer((req, res) => {
  let pathname = decodeURIComponent((req.url || '/').split('?')[0]);
  if (pathname === '/' || pathname.endsWith('/')) pathname += 'index.html';
  // Empêche la traversée de répertoire.
  const filePath = join(ROOT, normalize(pathname));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }
  readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[extname(filePath).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, () => {
  console.log(`static-server: ${ROOT} servi sur http://localhost:${PORT}`);
});
