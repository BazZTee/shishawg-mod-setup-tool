const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const DatabaseService = require('../src/main/dbService');

test('main.js db:auto-learn handler syncs only when res.addedCount > 0 instead of res.learned', () => {
  const mainCode = fs.readFileSync(path.join(root, 'src/main/main.js'), 'utf8');
  assert.match(mainCode, /ipcMain\.handle\('db:auto-learn', async \(event, setupData\) => {[\s\S]*?if \(!res \|\| res\.addedCount === 0\) return/);
  assert.doesNotMatch(mainCode, /res\.learned/);
});

test('autoLearnSetup learns new pipe and returns addedCount > 0', () => {
  const db = new DatabaseService();
  const testPipeName = 'Test-Moze-Varity-Special-' + Date.now();

  const res = db.autoLearnSetup({
    persons: [{ pipe: testPipeName, bowl: '', hmd: '', tobaccos: [] }]
  });

  assert.ok(res.addedCount >= 1, 'addedCount should be at least 1');
  assert.ok(res.catalog.pipes.includes(testPipeName), 'catalog.pipes should contain the new pipe');

  // Clean up
  db.removeItem('pipes', testPipeName);
  const afterClean = db.getCatalog();
  assert.ok(!afterClean.pipes.includes(testPipeName), 'catalog.pipes should no longer contain test pipe');
});

test('copy action in 02-setup.js and 11-dashboard.js invokes triggerAutoLearn', () => {
  const setupCode = fs.readFileSync(path.join(root, 'src/renderer/modules/02-setup.js'), 'utf8');
  assert.match(setupCode, /btnCopy\.addEventListener\('click', async \(\) => {[\s\S]*?triggerAutoLearn\(\);/);

  const dashboardCode = fs.readFileSync(path.join(root, 'src/renderer/modules/11-dashboard.js'), 'utf8');
  assert.match(dashboardCode, /btnCopy\.addEventListener\('click', \(\) => {[\s\S]*?triggerAutoLearn\(\);/);
});
