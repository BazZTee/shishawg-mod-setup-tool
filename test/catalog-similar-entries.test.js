const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DatabaseService = require('../src/main/dbService');
const { findSimilarCatalogEntry } = require('../src/renderer/fuzzy');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('variants with extra words, typos and spacing are found as similar', () => {
  const list = ['Blade Mini', { name: 'XKAH Pro', isElectric: true }, 'Kaloud Lotus'];
  assert.equal(findSimilarCatalogEntry('Blade Mini Rot', list).name, 'Blade Mini');
  assert.equal(findSimilarCatalogEntry('blade  mini', list).reason, 'exact');
  assert.equal(findSimilarCatalogEntry('Bladee Mini', list).name, 'Blade Mini');
  assert.equal(findSimilarCatalogEntry('XKAH Pro Max', list).name, 'XKAH Pro');
  assert.equal(findSimilarCatalogEntry('Kalaud Lotus', list).name, 'Kaloud Lotus');
});

test('different products are not reported as similar', () => {
  const list = ['Blade Mini', 'Kaloud Lotus'];
  assert.equal(findSimilarCatalogEntry('Hookain LitBowl', list), null);
  assert.equal(findSimilarCatalogEntry('Moze Breeze', list), null);
  assert.equal(findSimilarCatalogEntry('Blad', ['Blade Mini']), null, 'a partial word is not a word prefix');
});

test('auto-learn never adds a variant of an existing entry', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'swg-similar-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const db = new DatabaseService();
  db.dataPath = dir;
  db.getHookahToolsCacheData = () => ({ flavors: [{ name: 'Musthave - Pinkman' }] });
  db.saveCatalog({ ...db.getCatalog(), pipes: ['Blade Mini'], customTobacco: [] });

  const res = db.autoLearnSetup({
    persons: [{ pipe: 'Blade Mini Rot', bowl: '', hmd: '', tobaccos: ['Musthave - Pinkman Ice', 'Neu - Sorte'] }]
  });

  assert.deepEqual(db.getCatalog().pipes, ['Blade Mini']);
  assert.deepEqual(res.added, [{ category: 'tobacco', item: 'Neu - Sorte' }]);
});

test('manual add asks before creating a similar entry', () => {
  const setup = read('src/renderer/modules/02-setup.js');
  assert.match(setup, /const similar = findSimilarCatalogEntry\(checkName, existingList\);/);
  assert.match(setup, /if \(similar && !\(await showAppConfirm\(\{/);
  assert.match(setup, /function showAppConfirm\(/);
  assert.doesNotMatch(setup, /!confirm\(`„\$\{similar\.name\}/, 'no native browser dialog');
});

test('Enter in the database input adds the entry like the button', () => {
  const setup = read('src/renderer/modules/02-setup.js');
  assert.match(setup, /\[newItemInput, newItemDescInput\]\.forEach\(input => \{[\s\S]*?event\.key !== 'Enter'[\s\S]*?btnAddDbItem\.click\(\);/);
});
