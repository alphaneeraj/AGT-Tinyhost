// Local preview of the built site at the same path it has on GitHub Pages: npm run preview
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { config } from '../src/config.js';
import { buildSite } from '../src/build.js';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
  '.xml': 'application/xml', '.xsl': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif',
  '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
};

const result = buildSite();
const base = config.basePath;

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (!url.pathname.startsWith(base + '/')) {
    res.writeHead(302, { Location: base + '/' });
    return res.end();
  }
  let file = path.join(config.paths.dist, decodeURIComponent(url.pathname.slice(base.length)));
  if (!file.startsWith(config.paths.dist)) { res.writeHead(400); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) {
    res.writeHead(404, { 'Content-Type': TYPES['.html'] });
    return res.end(fs.readFileSync(path.join(config.paths.dist, '404.html')));
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}).listen(config.port, () => {
  console.log(`Built ${result.sitemapUrls} URLs. Preview: http://localhost:${config.port}${base}/  (admin: ${base}/admin/)`);
});
