const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'src/main/main.js'), 'utf8');
const workspace = fs.readFileSync(path.join(root, 'src/renderer/modules/01-workspace.js'), 'utf8');

test('Marvin profile defaults use the updated SWG promo values', () => {
  for (const source of [main, workspace]) {
    assert.match(source, /\{ shop: 'Holy', code: 'SWG10', desc: '10% Rabatt auf Deine Holy-Bestellung\.' \}/);
    assert.match(source, /\{ shop: 'Moze', code: 'SWG', desc: 'Zusätzliches Zubehör!' \}/);
  }
  assert.match(workspace, /collectedPromos\.push\(\{ shop: s \|\| '', code: c \|\| '', desc: d \|\| '' \}\)/);
});

test('only the untouched legacy Marvin promo defaults are migrated', () => {
  assert.match(main, /function migrateLegacyMarvinPromoCodes\(profiles\)/);
  assert.match(main, /profile\.id !== 'prof_shishawg'/);
  assert.match(main, /first\?\.shop === 'HookahFloW'/);
  assert.match(main, /second\?\.code === 'SHISHAWG'/);
  assert.match(main, /const isPreviousDefault = first\?\.shop === ''/);
  assert.match(main, /second\?\.desc === 'SWG5'/);
  assert.match(main, /const isLegacyDefault = isOriginalLegacyDefault \|\| isPreviousDefault/);
  assert.match(main, /if \(migrateLegacyMarvinPromoCodes\(profiles\)\)/);
});
