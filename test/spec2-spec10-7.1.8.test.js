'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const rendererCode = fs.readFileSync(path.join(root, 'src/renderer/renderer.js'), 'utf8');

function setupCommandContext(catalogTobacco = []) {
  const elements = new Map();
  const getEl = (id) => {
    if (!elements.has(id)) {
      elements.set(id, {
        value: '',
        textContent: '',
        checked: true,
        style: {},
        removeAttribute: () => {},
        setAttribute: () => {},
        className: '',
        classList: {
          contains: () => false,
          add: () => {},
          remove: () => {},
          toggle: () => false
        }
      });
    }
    return elements.get(id);
  };

  const context = {
    document: {
      getElementById: getEl,
      querySelectorAll: () => [],
      addEventListener: () => {}
    },
    localStorage: {
      getItem: () => null,
      setItem: () => {}
    },
    state: {
      personCount: 1,
      persons: [
        {
          pipe: 'Moze Varity',
          bowl: 'Cosmo Bowl',
          hmd: 'Onmo HMD',
          kohle: '27er',
          tobaccos: ['MustH - Pynkman'],
          tobaccoAmounts: [''],
          showTobaccoAmounts: false,
          isElectric: false
        }
      ],
      catalog: {
        tobacco: catalogTobacco
      },
      twitchUser: {
        login: 'marved',
        color: '#FF7F00'
      }
    },
    findBestFuzzyMatch: (query, list) => {
      const q = String(query || '').toLowerCase().trim();
      for (const item of list) {
        const n = (typeof item === 'string' ? item : item.name || '').toLowerCase().trim();
        if (n === q) return { item };
      }
      return null;
    }
  };

  vm.createContext(context);

  // Extract KNOWN_STREAM_FLAVORS, findTobaccoFlavor and generateCommandString
  const knownMatch = rendererCode.match(/const KNOWN_STREAM_FLAVORS = \{[\s\S]*?\};/m);
  assert.ok(knownMatch, 'KNOWN_STREAM_FLAVORS should exist in renderer.js');
  vm.runInContext(knownMatch[0], context);

  const findMatch = rendererCode.match(/function findTobaccoFlavor\(tobaccoName\) \{[\s\S]*?^\}/m);
  assert.ok(findMatch, 'findTobaccoFlavor should exist in renderer.js');
  vm.runInContext(findMatch[0], context);

  // Also include MAX_COMMAND_LEN_WITH_FLAVORS and chkIncludeFlavors
  vm.runInContext(`
    const MAX_COMMAND_LEN_WITH_FLAVORS = 300;
    const chkIncludePromoDesc = document.getElementById('chk-include-promo-desc');
    const chkIncludeFlavors = document.getElementById('chk-include-tobacco-flavors');
    const inputGlobalPromo = document.getElementById('input-global-promo');
    const selectPromoTarget = document.getElementById('select-promo-target');
    const inputGlobalKohle = document.getElementById('input-global-kohle');
    const inputGlobalExtra = document.getElementById('input-global-extra');
    const commandOutput = document.getElementById('command-output');
    const previewChatText = document.getElementById('preview-chat-text');
    const commandLengthBadge = document.getElementById('command-length-badge');
    let commandIsReady = false;
  `, context);

  const genMatch = rendererCode.match(/function generateCommandString\(\) \{[\s\S]*?^\}/m);
  assert.ok(genMatch, 'generateCommandString should exist in renderer.js');
  vm.runInContext(genMatch[0], context);

  return { context, getEl };
}

test('findTobaccoFlavor resolves Pynkman to Erdbeere, Himbeere, Grapefruit and never mismatches Yikah Nadelholz', () => {
  const { context } = setupCommandContext([
    { name: 'MustH - Yikah', flavor: 'Nadelholz' },
    { name: 'Musthave Germany - Pynkman', flavor: '' }
  ]);

  const flavor1 = vm.runInContext(`findTobaccoFlavor('MustH - Pynkman')`, context);
  assert.equal(flavor1, 'Erdbeere, Himbeere, Grapefruit');
  assert.notEqual(flavor1, 'Nadelholz');

  const flavorYikah = vm.runInContext(`findTobaccoFlavor('MustH - Yikah')`, context);
  assert.equal(flavorYikah, 'Nadelholz');

  const flavorUnknown = vm.runInContext(`findTobaccoFlavor('Unbekannter Tabak')`, context);
  assert.equal(flavorUnknown, null);
});

test('generateCommandString adds flavors to ALL tobaccos in a mix when length <= 300', () => {
  const { context, getEl } = setupCommandContext([
    { name: 'MustH - Yikah', flavor: 'Nadelholz' },
    { name: 'MustH - Kwi Smooth', flavor: 'Kiwi, Apfel' }
  ]);
  context.state.persons[0].tobaccos = ['MustH - Pynkman', 'MustH - Kwi Smooth'];
  getEl('input-global-kohle').value = '27er';

  vm.runInContext(`generateCommandString()`, context);

  const cmd = getEl('command-output').value;
  assert.ok(cmd.length <= 300, `Command length was ${cmd.length}, expected <= 300`);
  assert.ok(cmd.includes('MustH - Pynkman (Erdbeere, Himbeere, Grapefruit)'), `Pynkman should have Erdbeere, Himbeere, Grapefruit: ${cmd}`);
  assert.ok(!cmd.includes('Nadelholz'), `Pynkman must never have Nadelholz: ${cmd}`);
  assert.ok(cmd.includes('MustH - Kwi Smooth (Kiwi, Apfel)'), `Kwi Smooth should have Kiwi, Apfel: ${cmd}`);
});

test('generateCommandString drops flavors when total command length exceeds 300', () => {
  const veryLongFlavor = 'Extrem langer Geschmack mit Schokolade, Vanille, Karamell, Keks, gerösteten Nüssen, Kokosmilch, Sahne, Bourbon, Zimt, Kardamom, Mandel, Honig, Nougat und Pistazie';
  const { context, getEl } = setupCommandContext([
    { name: 'MustH - Pynkman', flavor: veryLongFlavor },
    { name: 'MustH - Kwi Smooth', flavor: veryLongFlavor }
  ]);

  context.state.persons[0].pipe = 'Steamulation Pro X Prime II Black Matt Edition auf einer Caesar Crystal Bowl in Midnight Blue Shiny Gold';
  context.state.persons[0].bowl = 'Oblako Flow Glazed Funnel Limited Edition 2026';
  context.state.persons[0].hmd = 'Na Grani HMD Edelstahl Version 2 Heavy Duty';
  context.state.persons[0].tobaccos = ['MustH - Pynkman', 'MustH - Kwi Smooth'];

  vm.runInContext(`generateCommandString()`, context);

  const cmd = getEl('command-output').value;
  assert.ok(!cmd.includes(veryLongFlavor), 'Flavors should be dropped when command exceeds 300 characters');
  assert.ok(cmd.includes('MustH - Pynkman'), 'Command should still include tobacco names');
});

test('renderModChatMessageWithEmotes converts 7TV emote to img and escapes XSS', () => {
  const context = {
    sevenTvEmoteMap: new Map([
      ['KEKW', { id: '60ae8d9bf39a75528d7d9f78', name: 'KEKW', url: 'https://cdn.7tv.app/emote/60ae8d9bf39a75528d7d9f78/1x.webp' }],
      ['monkaW', { id: '60ae8d9bf39a75528d7d9f79', name: 'monkaW', url: 'https://cdn.7tv.app/emote/60ae8d9bf39a75528d7d9f79/1x.webp' }]
    ]),
    escapeHtml: (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  };

  vm.createContext(context);
  const emoteRenderMatch = rendererCode.match(/function renderModChatMessageWithEmotes\(rawText\) \{[\s\S]*?^\}/m);
  assert.ok(emoteRenderMatch, 'renderModChatMessageWithEmotes should exist in renderer.js');
  vm.runInContext(emoteRenderMatch[0], context);

  const rendered = vm.runInContext(`renderModChatMessageWithEmotes('Hallo KEKW schau mal monkaW <script>alert(1)</script>')`, context);

  // KEKW should be an image
  assert.ok(rendered.includes('<img src="https://cdn.7tv.app/emote/60ae8d9bf39a75528d7d9f78/1x.webp" alt="KEKW" title="KEKW" class="chat-7tv-emote" loading="lazy">'));
  // monkaW should be an image
  assert.ok(rendered.includes('<img src="https://cdn.7tv.app/emote/60ae8d9bf39a75528d7d9f79/1x.webp" alt="monkaW" title="monkaW" class="chat-7tv-emote" loading="lazy">'));
  // Script tag must be escaped
  assert.ok(rendered.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(!rendered.includes('<script>'));
});
