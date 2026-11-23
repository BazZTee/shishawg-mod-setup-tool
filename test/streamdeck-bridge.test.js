const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const zlib = require('node:zlib');

const { StreamDeckBridge, crc32, PLUGIN_UUID } = require('../src/main/streamDeckBridge');
const { splitLabel } = require('../src/streamdeck/de.shishawg.modtool.sdPlugin/plugin/render.js');

const COMMANDS = [
  { id: 'cmd-discord', label: '💬 !discord', command: '!discord', isDefault: true },
  { id: 'cmd-x', label: 'Ohne Emoji', command: '!ohne' },
  { id: 'bad' },
];

async function withServer(bridge, fn) {
  const server = http.createServer((req, res) => {
    if (!bridge.handle(req, res)) { res.writeHead(418); res.end(); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  bridge.port = server.address().port;
  try { return await fn(`http://127.0.0.1:${bridge.port}`); } finally { server.close(); }
}

function makeBridge(sent = []) {
  let saved = null;
  const bridge = new StreamDeckBridge({
    port: 0,
    loadToken: () => null,
    saveToken: t => { saved = t; },
    sendChat: async msg => { sent.push(msg); }
  });
  assert.equal(saved, bridge.token, 'new token is persisted');
  bridge.setCommands(COMMANDS);
  return bridge;
}

test('commands are sanitized and only exposed with the token', async () => {
  const bridge = makeBridge();
  assert.equal(bridge.commands.length, 2, 'invalid entries dropped');
  await withServer(bridge, async base => {
    const denied = await fetch(base + '/api/streamdeck/commands');
    assert.equal(denied.status, 401);
    const ok = await fetch(base + '/api/streamdeck/commands', { headers: { 'X-SWG-Token': bridge.token } });
    const data = await ok.json();
    assert.deepEqual(data.commands[0], { id: 'cmd-discord', label: '💬 !discord', command: '!discord' });
    const other = await fetch(base + '/other');
    assert.equal(other.status, 418, 'non stream deck routes fall through');
  });
});

test('run posts only known commands to chat', async () => {
  const sent = [];
  const bridge = makeBridge(sent);
  await withServer(bridge, async base => {
    const headers = { 'X-SWG-Token': bridge.token, 'Content-Type': 'application/json' };
    const ok = await fetch(base + '/api/streamdeck/run', { method: 'POST', headers, body: JSON.stringify({ id: 'cmd-discord' }) });
    assert.equal(ok.status, 200);
    const unknown = await fetch(base + '/api/streamdeck/run', { method: 'POST', headers, body: JSON.stringify({ id: 'nope' }) });
    assert.equal(unknown.status, 404);
    const noToken = await fetch(base + '/api/streamdeck/run', { method: 'POST', body: JSON.stringify({ id: 'cmd-discord' }) });
    assert.equal(noToken.status, 401);
  });
  assert.deepEqual(sent, ['!discord']);
});

test('foreign Host header is rejected (DNS rebinding)', async () => {
  const bridge = makeBridge();
  await withServer(bridge, base => new Promise((resolve, reject) => {
    const req = http.request(base + '/api/streamdeck/commands', { headers: { Host: 'evil.example:80', 'X-SWG-Token': bridge.token } }, res => {
      try { assert.equal(res.statusCode, 403); resolve(); } catch (e) { reject(e); }
      res.resume();
    });
    req.on('error', reject);
    req.end();
  }));
});

test('existing token is reused', () => {
  const token = 'a'.repeat(48);
  const bridge = new StreamDeckBridge({ port: 1, loadToken: () => token, saveToken: () => assert.fail('must not regenerate'), sendChat: () => {} });
  assert.equal(bridge.token, token);
});

// Read our own zip back: local headers in order, inflate and check CRC.
function readZip(buf) {
  const out = {};
  let p = 0;
  while (buf.readUInt32LE(p) === 0x04034b50) {
    const crc = buf.readUInt32LE(p + 14);
    const size = buf.readUInt32LE(p + 18);
    const nameLen = buf.readUInt16LE(p + 26);
    const name = buf.slice(p + 30, p + 30 + nameLen).toString('utf8');
    const data = zlib.inflateRawSync(buf.slice(p + 30 + nameLen, p + 30 + nameLen + size));
    assert.equal(crc32(data), crc, name + ' crc');
    out[name] = data;
    p += 30 + nameLen + size;
  }
  assert.equal(buf.readUInt32LE(buf.length - 22), 0x06054b50, 'end of central directory');
  return out;
}

test('plugin package contains manifest, code and connection with token', () => {
  const bridge = makeBridge();
  bridge.port = 18942;
  const file = path.join(os.tmpdir(), `swg-test-${process.pid}.streamDeckPlugin`);
  bridge.writePackage(file, { 'imgs/key.png': Buffer.from([1, 2, 3]) });
  const files = readZip(fs.readFileSync(file));
  fs.unlinkSync(file);
  const root = PLUGIN_UUID + '.sdPlugin/';
  const manifest = JSON.parse(files[root + 'manifest.json']);
  assert.equal(manifest.UUID, PLUGIN_UUID);
  assert.ok(files[root + manifest.CodePath], 'CodePath exists');
  assert.ok(files[root + manifest.Actions[0].PropertyInspectorPath], 'PI exists');
  assert.match(files[root + 'connection.js'].toString(), new RegExp(bridge.token));
  assert.match(files[root + 'connection.js'].toString(), /"port":18942/);
  assert.deepEqual([...files[root + 'imgs/key.png']], [1, 2, 3]);
});

test('key label splits emoji pictogram from text', () => {
  assert.deepEqual(splitLabel('💬 !discord', '!discord'), { emoji: '💬', text: '!discord' });
  assert.deepEqual(splitLabel('👨‍👩‍👧 Family', '!fam'), { emoji: '👨‍👩‍👧', text: 'Family' });
  assert.deepEqual(splitLabel('🇩🇪 Deutsch', '!de'), { emoji: '🇩🇪', text: 'Deutsch' });
  assert.deepEqual(splitLabel('Ohne Emoji', '!ohne'), { emoji: '', text: 'Ohne Emoji' });
  assert.deepEqual(splitLabel('🔥', '!fire'), { emoji: '🔥', text: '!fire' });
  assert.deepEqual(splitLabel('', '!nur'), { emoji: '', text: '!nur' });
});

test('renderer syncs quick commands and offers the install button', () => {
  const mod = fs.readFileSync(path.join(__dirname, '../src/renderer/modules/03-quick-actions.js'), 'utf8');
  const html = fs.readFileSync(path.join(__dirname, '../src/renderer/index.html'), 'utf8');
  const contract = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/shared/ipc-contract.json'), 'utf8'));
  assert.match(mod, /streamdeck:sync-commands/);
  assert.match(html, /id="btn-qa-streamdeck"/);
  assert.ok(contract.invoke.includes('streamdeck:sync-commands'));
  assert.ok(contract.invoke.includes('streamdeck:install-plugin'));
});
