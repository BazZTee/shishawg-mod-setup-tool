'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const fuzzy = require('../src/renderer/fuzzy');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('quick notes prefer the current ONMO catalog name', () => {
  const catalog = ['ONMO Alu HMD', 'ONMO Edelstahl HMD', 'Na Grani'];
  const match = fuzzy.findBestFuzzyMatch('onmo alu hmd', catalog, 0.70);

  assert.equal(match?.name, 'ONMO Alu HMD');
  assert.equal(fuzzy.SHISHA_SYNONYMS.onmo, 'ONMO Alu HMD');
});

test('generic hardware labels cannot turn an HMD note into an electric bowl', () => {
  const setupModule = read('src/renderer/modules/02-setup.js');

  assert.equal(fuzzy.isGenericGearToken('HMD'), true);
  assert.equal(fuzzy.isGenericGearToken('Alu'), true);
  assert.equal(fuzzy.isGenericGearToken('ONMO'), false);
  assert.match(setupModule, /if \(isGenericGearToken\(tok\)\) continue;/);
});

test('the offline fallback uses the renamed ONMO Alu HMD entry', () => {
  const dbService = read('src/main/dbService.js');
  const defaultHmds = dbService.match(/hmds:\s*\[([\s\S]*?)\]\s*,\s*tobacco:/)?.[1] || '';

  assert.match(defaultHmds, /ONMO Alu HMD/);
  assert.doesNotMatch(defaultHmds, /ONMO Edelstahl HMD/);
});
