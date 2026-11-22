// Local preview of mobile/www in a normal browser (no native plugins).
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const www = path.resolve(__dirname, '../www');
const port = Number(process.env.PORT || 5179);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.json': 'application/json' };

http.createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.join(www, urlPath === '/' ? 'index.html' : urlPath);
  if (!file.startsWith(www) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('Not found'); return;
  }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}).listen(port, '127.0.0.1', () => console.log(`Vorschau: http://127.0.0.1:${port}/`));
