'use strict';
const test = require('node:test');
const assert = require('node:assert');
const nodeCrypto = require('crypto');
const shimCrypto = require('../shims/crypto');
const vfs = require('../shims/vfs');
const fs = require('../shims/fs');
const http = require('../shims/http');
const url = require('../shims/url');
const { compareVersions } = require('../shims/electron-updater');

test('scryptSync matches Node (address key derivation)', () => {
  const a = nodeCrypto.scryptSync('shishawg-mod-tool-address-key-v1', 'shishawg-salt-2026', 32);
  const b = shimCrypto.scryptSync('shishawg-mod-tool-address-key-v1', 'shishawg-salt-2026', 32);
  assert.strictEqual(Buffer.from(b).toString('hex'), a.toString('hex'));
});

test('AES-256-GCM is compatible in both directions with desktop format', () => {
  const key = nodeCrypto.randomBytes(32);
  const iv = nodeCrypto.randomBytes(16);
  const plain = JSON.stringify({ street: 'Musterstraße 1', city: 'Köln' });

  const c1 = nodeCrypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([c1.update(plain, 'utf8'), c1.final()]);
  const d1 = shimCrypto.createDecipheriv('aes-256-gcm', key, iv);
  d1.setAuthTag(c1.getAuthTag());
  assert.strictEqual(Buffer.concat([d1.update(enc), d1.final()]).toString('utf8'), plain);

  const c2 = shimCrypto.createCipheriv('aes-256-gcm', key, iv);
  const enc2 = Buffer.concat([c2.update(plain, 'utf8'), c2.final()]);
  const d2 = nodeCrypto.createDecipheriv('aes-256-gcm', key, iv);
  d2.setAuthTag(Buffer.from(c2.getAuthTag()));
  assert.strictEqual(Buffer.concat([d2.update(Buffer.from(enc2)), d2.final()]).toString('utf8'), plain);
});

test('fs shim keeps settings-store write pattern working', async () => {
  await vfs.load({ '/app/readonly.json': '{"a":1}' });
  fs.writeFileSync('/userData/app_settings.json.pending', '{"x":1}');
  assert.ok(fs.existsSync('/userData'));
  fs.renameSync('/userData/app_settings.json.pending', '/userData/app_settings.json');
  assert.strictEqual(fs.existsSync('/userData/app_settings.json.pending'), false);
  assert.strictEqual(fs.readFileSync('/userData/app_settings.json', 'utf8'), '{"x":1}');
  assert.strictEqual(fs.readFileSync('/userData/./x/../app_settings.json').toString(), '{"x":1}');
  assert.throws(() => fs.readFileSync('/missing.json'), /ENOENT/);
  assert.throws(() => fs.writeFileSync('/app/readonly.json', '{}'), /EROFS/);
});

test('virtual http server receives the Twitch token redirect', async () => {
  let received = null;
  const server = http.createServer((req, res) => {
    received = url.parse(req.url, true).query.token;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{"success":true}');
  });
  await new Promise(resolve => server.listen(17525, resolve));
  const response = await http.__dispatch(17525, '/token?token=abc123');
  assert.strictEqual(received, 'abc123');
  assert.strictEqual(response.status, 200);
  server.close();
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.strictEqual(await http.__dispatch(17525, '/token?token=x'), null);
});

test('update check compares versions numerically', () => {
  assert.ok(compareVersions('8.0.10', '8.0.9') > 0);
  assert.ok(compareVersions('v8.1.0', '8.0.5') > 0);
  assert.strictEqual(compareVersions('8.0.5', '8.0.5'), 0);
});
