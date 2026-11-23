const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../src/renderer/modules/02-setup.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../src/renderer/index.html'), 'utf8');

function extract(name) {
  const fn = source.match(new RegExp(`^(?:async )?function ${name}\\([^)]*\\) \\{[\\s\\S]*?^\\}`, 'm'))?.[0];
  assert.ok(fn, `${name} missing`);
  return fn;
}

function makeContext() {
  const store = new Map();
  const field = value => ({ value, checked: true });
  const context = vm.createContext({
    JSON, Array, Number, String, Date, Math,
    state: { personCount: 2, persons: [] },
    localStorage: {
      getItem: key => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value))
    },
    inputGlobalKohle: field(''),
    inputGlobalExtra: field(''),
    inputGlobalPromo: field(''),
    selectPromoTarget: field('kohle'),
    chkIncludePromoDesc: field(''),
    chkIncludeFlavors: field(''),
    renders: 0,
    updatePersonCountLabel: () => {},
    generateCommandString: () => {},
    document: { getElementById: () => null },
    showToast: () => {},
    showAppConfirm: async () => true
  });
  context.renderPersonsGrid = () => { context.renders++; };
  const constants = source.match(/^const SETUP_SLOT_STORAGE_KEY[^\n]*\n^const SETUP_SLOT_COUNT[^\n]*/m)[0];
  vm.runInContext([
    constants.replace(/^const /gm, 'var '),
    ...['isSetupPersonFilled', 'snapshotCurrentSetup', 'isSetupSnapshotEmpty', 'readSetupSlots', 'writeSetupSlots',
      'describeSetupSnapshot', 'applySetupSnapshot', 'renderSetupSlotMenus', 'saveSetupToSlot', 'loadSetupFromSlot'].map(extract)
  ].join('\n'), context);
  return context;
}

test('setup slot UI: save button in toolbar, load list in import menu', () => {
  assert.match(html, /id="btn-setup-slots-menu"/);
  assert.match(html, /id="setup-slots-save-menu"/);
  const importMenu = html.match(/<div id="import-dropdown-menu"[\s\S]*?<!-- Setup-Zwischenspeicher/)[0];
  assert.match(importMenu, /id="setup-slots-load-list"/);
});

test('setup is saved to a slot, survives as JSON and is restored with globals', async () => {
  const ctx = makeContext();
  ctx.state.persons = [
    { name: 'Marvin', pipe: 'Futr', bowl: 'Cosmo', hmd: 'ONMO', tobaccos: ['Aino - Black'], tobaccoAmounts: ['12'], tobaccoUnit: 'g' },
    { name: 'Tom', pipe: '', bowl: '', hmd: '', tobaccos: ['MustH - Early Grey'] },
    { name: 'Hidden', tobaccos: ['ignored'] }
  ];
  ctx.inputGlobalKohle.value = 'Cocobrico 26er';
  ctx.inputGlobalPromo.value = 'SWG10';
  ctx.chkIncludeFlavors.checked = false;

  assert.equal(await ctx.saveSetupToSlot(1), true);
  const slots = ctx.readSetupSlots();
  assert.equal(slots.length, 3);
  assert.equal(slots[0], null);
  assert.equal(slots[1].persons.length, 2, 'only visible persons are stored');
  assert.match(ctx.describeSetupSnapshot(slots[1]), /^Marvin, Tom · \d\d\.\d\d\. \d\d:\d\d$/);

  ctx.state.personCount = 1;
  ctx.state.persons = [{ name: '', tobaccos: [''] }];
  ctx.inputGlobalKohle.value = '';
  ctx.inputGlobalPromo.value = '';
  ctx.chkIncludeFlavors.checked = true;

  assert.equal(await ctx.loadSetupFromSlot(1), true);
  assert.equal(ctx.state.personCount, 2);
  assert.equal(ctx.state.persons[0].pipe, 'Futr');
  assert.deepEqual(ctx.state.persons[1].tobaccos, ['MustH - Early Grey']);
  assert.equal(ctx.inputGlobalKohle.value, 'Cocobrico 26er');
  assert.equal(ctx.inputGlobalPromo.value, 'SWG10');
  assert.equal(ctx.chkIncludeFlavors.checked, false);
  assert.equal(ctx.renders, 1);

  ctx.state.persons[0].pipe = 'changed';
  assert.equal(ctx.readSetupSlots()[1].persons[0].pipe, 'Futr', 'loaded setup is a copy, slot stays unchanged');
});

test('empty form is not saved, empty slot is not loaded, declined overwrite keeps slot', async () => {
  const ctx = makeContext();
  ctx.state.personCount = 1;
  ctx.state.persons = [{ name: '', pipe: '', bowl: '', hmd: '', tobaccos: [''] }];
  assert.equal(await ctx.saveSetupToSlot(0), false);
  assert.equal(await ctx.loadSetupFromSlot(0), false);

  ctx.state.persons = [{ name: 'Marvin', tobaccos: [''] }];
  assert.equal(await ctx.saveSetupToSlot(0), true);
  ctx.state.persons = [{ name: 'Tom', tobaccos: [''] }];
  ctx.showAppConfirm = async () => false;
  assert.equal(await ctx.saveSetupToSlot(0), false);
  assert.equal(ctx.readSetupSlots()[0].persons[0].name, 'Marvin');
});

test('broken storage data falls back to empty slots', () => {
  const ctx = makeContext();
  ctx.localStorage.setItem('swg_setup_slots_v1', '{kaputt');
  assert.deepEqual(Array.from(ctx.readSetupSlots()), [null, null, null]);
});
