'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('address edits are protected from live refreshes until saved or discarded', () => {
  const renderer = read('src/renderer/renderer.js');
  const index = read('src/renderer/index.html');
  assert.match(renderer, /addressDraftDirty:\s*false/);
  assert.match(renderer, /function isAddressDraftProtected\(\)/);
  assert.match(renderer, /if \(isAddressDraftProtected\(\)\)[\s\S]*latestAddressWinner = updated/);
  assert.match(renderer, /saveResult[\s\S]*!saveResult\.success[\s\S]*setAddressDraftDirty\(false\)/);
  assert.match(renderer, /addEventListener\(input\.tagName === 'SELECT' \? 'change' : 'input'/);
  assert.match(index, /id="btn-discard-winner-address"[^>]*disabled/);
});

test('release version is 8.0.0', () => {
  const pkg = JSON.parse(read('package.json'));
  const lock = JSON.parse(read('package-lock.json'));
  assert.equal(pkg.version, '8.0.0');
  assert.equal(lock.version, '8.0.0');
  assert.equal(lock.packages[''].version, '8.0.0');
});

test('repeat Telegram delivery is clearly marked as an address update', () => {
  const renderer = read('src/renderer/renderer.js');
  assert.match(renderer, /const isAddressUpdate = w\.status === 'sent_to_telegram'/);
  assert.match(renderer, /ACHTUNG: ADRESSAKTUALISIERUNG/);
  assert.match(renderer, /getFormattedTelegramMessage\(w, isAddressUpdate\)/);
});
