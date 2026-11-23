'use strict';
// Stream Deck bridge: local token-protected API for the Stream Deck plugin
// and the generator for the installable .streamDeckPlugin package.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const PLUGIN_UUID = 'de.shishawg.modtool';
const PLUGIN_DIR = path.join(__dirname, '../streamdeck', PLUGIN_UUID + '.sdPlugin');
const MAX_COMMANDS = 200;
const MAX_BODY = 4096;

function sanitizeCommands(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter(c => c && typeof c === 'object' && typeof c.id === 'string' && typeof c.command === 'string' && c.command.trim())
    .slice(0, MAX_COMMANDS)
    .map(c => ({
      id: c.id.slice(0, 100),
      label: String(c.label || c.command).slice(0, 100),
      command: c.command.trim().slice(0, 500)
    }));
}

function tokensEqual(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  if (x.length !== y.length || x.length === 0) return false;
  if (typeof crypto.timingSafeEqual === 'function') return crypto.timingSafeEqual(x, y);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

class StreamDeckBridge {
  // getToken/saveToken persist the shared secret; sendChat(text) posts to Twitch.
  constructor({ port, loadToken, saveToken, sendChat, onRun }) {
    this.port = port;
    this.sendChat = sendChat;
    this.onRun = onRun || (() => {});
    this.commands = [];
    this.token = loadToken && loadToken();
    if (!/^[a-f0-9]{48}$/.test(this.token || '')) {
      this.token = crypto.randomBytes(24).toString('hex');
      if (saveToken) saveToken(this.token);
    }
  }

  setCommands(list) {
    this.commands = sanitizeCommands(list);
    return this.commands.length;
  }

  // Returns true when the request was a Stream Deck route and has been answered.
  handle(req, res) {
    const url = String(req.url || '').split('?')[0];
    if (!url.startsWith('/api/streamdeck/')) return false;

    // The plugin runs in a file:// page; the token, not CORS, is the gate.
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-SWG-Token');
    res.setHeader('Cache-Control', 'no-store');

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return true; }

    const host = String(req.headers.host || '').toLowerCase();
    const allowedHosts = [`127.0.0.1:${this.port}`, `localhost:${this.port}`];
    if (!allowedHosts.includes(host)) return this.json(res, 403, { success: false, error: 'Host nicht erlaubt' });
    if (!tokensEqual(req.headers['x-swg-token'], this.token)) {
      return this.json(res, 401, { success: false, error: 'Ungültiger Stream-Deck-Schlüssel. Plugin im Mod-Tool neu installieren.' });
    }

    if (url === '/api/streamdeck/commands' && req.method === 'GET') {
      return this.json(res, 200, { success: true, commands: this.commands });
    }
    if (url === '/api/streamdeck/run' && req.method === 'POST') {
      this.readBody(req, (err, body) => {
        if (err) return this.json(res, 413, { success: false, error: err.message });
        let id = null;
        try { id = JSON.parse(body).id; } catch (e) {}
        const cmd = this.commands.find(c => c.id === id);
        if (!cmd) return this.json(res, 404, { success: false, error: 'Command nicht gefunden' });
        Promise.resolve()
          .then(() => this.sendChat(cmd.command))
          .then(() => { this.onRun(cmd, null); this.json(res, 200, { success: true }); })
          .catch(e => { this.onRun(cmd, e); this.json(res, 502, { success: false, error: e.message }); });
      });
      return true;
    }
    return this.json(res, 404, { success: false, error: 'Unbekannt' });
  }

  readBody(req, cb) {
    let body = '';
    let done = false;
    req.on('data', chunk => {
      if (done) return;
      body += chunk;
      if (body.length > MAX_BODY) { done = true; cb(new Error('Anfrage zu groß')); }
    });
    req.on('end', () => { if (!done) { done = true; cb(null, body); } });
  }

  json(res, status, data) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data));
    return true;
  }

  // Files of the plugin package. `images` maps "imgs/<name>.png" to PNG buffers.
  packageFiles(images = {}) {
    const files = [];
    const walk = (dir, rel) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const abs = path.join(dir, entry.name);
        const r = rel ? rel + '/' + entry.name : entry.name;
        if (entry.isDirectory()) walk(abs, r);
        else files.push({ name: r, data: fs.readFileSync(abs) });
      }
    };
    walk(PLUGIN_DIR, '');
    const connection = `window.SWG_CONNECTION = ${JSON.stringify({ port: this.port, token: this.token })};\n`;
    files.push({ name: 'connection.js', data: Buffer.from(connection, 'utf8') });
    for (const [name, data] of Object.entries(images)) files.push({ name, data });
    return files.map(f => ({ name: PLUGIN_UUID + '.sdPlugin/' + f.name, data: f.data }));
  }

  writePackage(targetFile, images) {
    fs.writeFileSync(targetFile, createZip(this.packageFiles(images)));
    return targetFile;
  }
}

// ---- minimal ZIP writer (deflate) ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function createZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const compressed = zlib.deflateRawSync(data);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(8, 8);      // deflate
    local.writeUInt32LE(0, 10);     // time/date
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBuf, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(0, 12);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);
    offset += 30 + nameBuf.length + compressed.length;
  }
  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuf, end]);
}

module.exports = { StreamDeckBridge, sanitizeCommands, createZip, crc32, PLUGIN_UUID, PLUGIN_DIR };
