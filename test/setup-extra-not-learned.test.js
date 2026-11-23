'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

const DatabaseService = require('../src/main/dbService');

const root = path.resolve(__dirname, '..');
const rendererCode = fs.readFileSync(path.join(root, 'src/renderer/renderer.js'), 'utf8');

function makeDb(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'swg-extra-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const db = new DatabaseService();
  db.dataPath = dir;
  db.getHookahToolsCacheData = () => ({ flavors: [] });
  db.saveCatalog({ ...db.getCatalog(), bowls: ['Cosmo Bowl'], customTobacco: [] });
  return db;
}

test('auto-learn never stores the Zusatz-Info as a catalog entry', (t) => {
  const db = makeDb(t);
  const res = db.autoLearnSetup({
    persons: [{ pipe: '', bowl: 'Kaffee', hmd: '', tobaccos: ['Kaffee'] }],
    kohle: '',
    extra: 'Kaffee'
  });

  assert.deepEqual(res.added, []);
  assert.deepEqual(db.getCatalog().bowls, ['Cosmo Bowl']);
  assert.ok(!db.getCatalog().tobacco.some(item => (item.name || item) === 'Kaffee'));
});

function makeParser(extraValue = '') {
  const elements = new Map();
  const getEl = (id) => {
    if (!elements.has(id)) elements.set(id, { value: '', classList: { add() {}, remove() {} } });
    return elements.get(id);
  };
  getEl('input-global-extra').value = extraValue;
  const state = {
    personCount: 1,
    persons: [{ name: 'Marvin' }],
    catalog: {
      pipes: ['Alpha Hookah X Stratos'],
      bowls: ['Cosmo Bowl'],
      hmds: ['ONMO HMD'],
      charcoal: ['Magic Charcoal'],
      tastings: ['Blind Tasting im Stream'],
      tobacco: [{ name: 'Sebero Black - Vanilla' }]
    },
    targetBot: 'marvedbot'
  };
  const context = {
    state,
    inputGlobalKohle: getEl('input-global-kohle'),
    inputGlobalExtra: getEl('input-global-extra'),
    updatePersonCountLabel() {},
    renderPersonsGrid() {},
    generateCommandString() {},
    document: { getElementById: getEl }
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'src/renderer/fuzzy.js'), 'utf8'), context);
  for (const name of ['splitTobaccoString', 'parseTobaccoItem', 'parseChatSetupMessage']) {
    vm.runInContext(rendererCode.match(new RegExp(`function ${name}\\([\\s\\S]*?^\\}`, 'm'))[0], context);
  }
  return context;
}

test('chat import puts free text after the tobaccos into Zusatz-Info', () => {
  const ctx = makeParser();
  const cmd = '!editsetup Alpha Hookah X Stratos // Cosmo Bowl // ONMO HMD // Magic Charcoal // Sebero Black - Vanilla // Kaffee mit Shot //';
  assert.equal(vm.runInContext(`parseChatSetupMessage(${JSON.stringify(cmd)})`, ctx), true);

  const person = ctx.state.persons[0];
  assert.equal(person.bowl, 'Cosmo Bowl');
  assert.deepEqual([...person.tobaccos], ['Sebero Black - Vanilla']);
  assert.equal(ctx.inputGlobalExtra.value, 'Kaffee mit Shot');
});

test('chat import recognises the current Zusatz-Info even without tobacco', () => {
  const ctx = makeParser('Kaffee mit Shot');
  const cmd = '!editsetup Alpha Hookah X Stratos // Cosmo Bowl // Kaffee mit Shot //';
  vm.runInContext(`parseChatSetupMessage(${JSON.stringify(cmd)})`, ctx);

  assert.equal(ctx.state.persons[0].bowl, 'Cosmo Bowl');
  assert.equal(ctx.inputGlobalExtra.value, 'Kaffee mit Shot');
});

test('a second tobacco segment is still read as tobacco', () => {
  const ctx = makeParser();
  const cmd = '!editsetup Alpha Hookah X Stratos // Cosmo Bowl // Sebero Black - Vanilla // Neu - Sorte //';
  vm.runInContext(`parseChatSetupMessage(${JSON.stringify(cmd)})`, ctx);

  assert.deepEqual([...ctx.state.persons[0].tobaccos], ['Sebero Black - Vanilla', 'Neu - Sorte']);
  assert.equal(ctx.inputGlobalExtra.value, '');
});
