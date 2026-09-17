'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const rendererCode = fs.readFileSync(path.join(root, 'src/renderer/renderer.js'), 'utf8');

function setupTestEnvironment() {
  const elements = new Map();
  const getEl = (id) => {
    if (!elements.has(id)) {
      elements.set(id, {
        value: '',
        textContent: '',
        checked: false,
        classList: {
          contains: () => false,
          add: () => {},
          remove: () => {}
        },
        removeAttribute: () => {},
        setAttribute: () => {}
      });
    }
    return elements.get(id);
  };

  const state = {
    personCount: 1,
    persons: [{
      name: 'Marvin',
      pipe: '',
      bowl: '',
      hmd: '',
      tobaccos: [''],
      tobaccoAmounts: [''],
      tobaccoUnit: 'g',
      showTobaccoAmounts: false
    }],
    catalog: {
      pipes: ['Ocean Hookah', 'Moze Varity'],
      bowls: ['Cosmo Bowl', 'Phunnel'],
      hmds: ['Onmo HMD', 'Lotus'],
      charcoal: ['27er', '26er'],
      tobacco: [
        { name: 'MustH - Pynkman' },
        { name: 'Black Burn - Green T' },
        { name: 'Kismet - Black Lavender' }
      ]
    },
    targetBot: 'marvedbot'
  };

  const context = {
    state,
    inputGlobalKohle: getEl('input-global-kohle'),
    inputGlobalExtra: getEl('input-global-extra'),
    inputGlobalPromo: getEl('input-global-promo'),
    selectPromoTarget: getEl('select-promo-target'),
    chkIncludePromoDesc: getEl('chk-include-promo-desc'),
    commandOutput: getEl('command-output'),
    previewChatText: getEl('preview-chat-text'),
    commandLengthBadge: getEl('command-length-badge'),
    commandIsReady: false,
    updatePersonCountLabel: () => {},
    renderPersonsGrid: () => {},
    generateCommandString: () => {},
    triggerAutoLearn: () => {},
    escapeHtml: (s) => String(s || ''),
    document: {
      getElementById: getEl
    },
    localStorage: {
      getItem: () => null,
      setItem: () => {}
    }
  };

  vm.createContext(context);

  // Extract helper functions and parseChatSetupMessage
  const fuzzyCode = fs.readFileSync(path.join(root, 'src/renderer/fuzzy.js'), 'utf8');
  vm.runInContext(fuzzyCode, context);

  // Extract parseChatSetupMessage and dependencies
  const splitFn = rendererCode.match(/function splitTobaccoString\([\s\S]*?^\}/m)[0];
  const parseItemFn = rendererCode.match(/function parseTobaccoItem\([\s\S]*?^\}/m)[0];
  const parseSetupFn = rendererCode.match(/function parseChatSetupMessage\([\s\S]*?^function /m)[0].replace(/function\s*$/, '');

  vm.runInContext(splitFn, context);
  vm.runInContext(parseItemFn, context);
  vm.runInContext(parseSetupFn, context);

  return context;
}

test('Single-Person Setup Import correctly imports tobacco variety and amount', () => {
  const ctx = setupTestEnvironment();
  const rawCommand = '!editsetup Ocean Hookah // Cosmo Bowl // Onmo HMD // 27er // MustH - Pynkman (12g) //';

  const success = vm.runInContext(`parseChatSetupMessage(${JSON.stringify(rawCommand)})`, ctx);
  assert.equal(success, true);

  const person = ctx.state.persons[0];
  assert.equal(person.pipe, 'Ocean Hookah');
  assert.equal(person.bowl, 'Cosmo Bowl');
  assert.equal(person.hmd, 'Onmo HMD');
  assert.equal(ctx.inputGlobalKohle.value, '27er');

  // Verify tobacco was NOT dropped
  assert.equal(person.tobaccos.length, 1);
  assert.equal(person.tobaccos[0], 'MustH - Pynkman');
  assert.equal(person.tobaccoAmounts[0], '12');
  assert.equal(person.tobaccoUnit, 'g');
  assert.equal(person.showTobaccoAmounts, true);
});

test('Single-Person Setup with tobacco mix imports all varieties cleanly', () => {
  const ctx = setupTestEnvironment();
  const rawCommand = '!editsetup Moze Varity // Phunnel // Onmo HMD // 26er // Black Burn - Green T (10g) und MustH - Pynkman (8g) //';

  const success = vm.runInContext(`parseChatSetupMessage(${JSON.stringify(rawCommand)})`, ctx);
  assert.equal(success, true);

  const person = ctx.state.persons[0];
  assert.equal(person.tobaccos.length, 2);
  assert.equal(person.tobaccos[0], 'Black Burn - Green T');
  assert.equal(person.tobaccoAmounts[0], '10');
  assert.equal(person.tobaccos[1], 'MustH - Pynkman');
  assert.equal(person.tobaccoAmounts[1], '8');
  assert.equal(person.showTobaccoAmounts, true);
});

test('Multi-Person Setup correctly associates tobaccos with each individual person', () => {
  const ctx = setupTestEnvironment();
  const rawCommand = '!editsetup Marvin: Ocean Hookah // Cosmo Bowl // Onmo HMD // MustH - Pynkman // Bastian: Moze Varity // Phunnel // Lotus // Black Burn - Green T (15g) //';

  const success = vm.runInContext(`parseChatSetupMessage(${JSON.stringify(rawCommand)})`, ctx);
  assert.equal(success, true);
  assert.equal(ctx.state.personCount, 2);

  const p1 = ctx.state.persons[0];
  assert.equal(p1.name, 'Marvin');
  assert.equal(p1.pipe, 'Ocean Hookah');
  assert.equal(p1.bowl, 'Cosmo Bowl');
  assert.equal(p1.tobaccos[0], 'MustH - Pynkman');

  const p2 = ctx.state.persons[1];
  assert.equal(p2.name, 'Bastian');
  assert.equal(p2.pipe, 'Moze Varity');
  assert.equal(p2.bowl, 'Phunnel');
  assert.equal(p2.hmd, 'Lotus');
  assert.equal(p2.tobaccos[0], 'Black Burn - Green T');
  assert.equal(p2.tobaccoAmounts[0], '15');
});

test('Custom freetext tobacco not in catalog is preserved 1:1', () => {
  const ctx = setupTestEnvironment();
  const rawCommand = '!editsetup Ocean Hookah // Cosmo Bowl // Onmo HMD // 27er // Geheimer Spezialtabak Mango Lassi //';

  const success = vm.runInContext(`parseChatSetupMessage(${JSON.stringify(rawCommand)})`, ctx);
  assert.equal(success, true);

  const person = ctx.state.persons[0];
  assert.equal(person.tobaccos[0], 'Geheimer Spezialtabak Mango Lassi');
});
