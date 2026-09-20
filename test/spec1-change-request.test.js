'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const rendererCode = fs.readFileSync(path.join(root, 'src/renderer/renderer.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'src/renderer/index.html'), 'utf8');
const pkgJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

test('Spec #1 UI elements exist in index.html with native btn-icon close button', () => {
  assert.match(indexHtml, /class="fab-change-request"[^>]*id="btn-open-change-request"|id="btn-open-change-request"[^>]*class="fab-change-request"/, 'Floating action button should exist');
  assert.match(indexHtml, /id="change-request-modal"/, 'Change request modal should exist');
  assert.match(indexHtml, /<button[^>]*id="btn-close-change-request-modal"[^>]*class="btn-icon"|<button[^>]*class="btn-icon"[^>]*id="btn-close-change-request-modal"/, 'Close button should use class btn-icon');
  assert.match(indexHtml, /id="cr-category"/, 'Category dropdown should exist');
  assert.match(indexHtml, /id="cr-title"/, 'Title input should exist');
  assert.match(indexHtml, /id="cr-details"/, 'Details textarea should exist');
  assert.match(indexHtml, /id="cr-preview-view"/, 'Context preview view should exist');
  assert.match(indexHtml, /id="btn-submit-change-request"/, 'Submit button should exist');
});

test('buildChangeRequestIssueUrl creates correct pre-filled GitHub Issue URL with rich context table', () => {
  const context = {
    state: {
      twitchUser: {
        display_name: 'MarvedMod',
        login: 'marvedmod'
      },
      config: {
        twitch_channel: '#marved'
      }
    },
    currentActiveView: 'view-setup',
    statsState: {
      sessionStartTime: Date.now() - 600000,
      sessionElapsedSeconds: 600,
      activeHeadCount: 2,
      activeSetup: { tobacco: 'MustH - Pynkman' }
    },
    document: {
      getElementById: (id) => {
        if (id === 'app-version-tag') return { textContent: 'v7.2.0' };
        if (id === 'select-active-streamer-profile') {
          return { selectedIndex: 0, options: [{ text: 'ShishaWG (Marvin)' }] };
        }
        return null;
      }
    }
  };

  vm.createContext(context);
  const viewMapMatch = rendererCode.match(/function getCurrentViewDisplayName\(viewId\) \{[\s\S]*?^\}/m);
  assert.ok(viewMapMatch, 'getCurrentViewDisplayName function should exist in renderer.js');
  vm.runInContext(viewMapMatch[0], context);

  const contextTableMatch = rendererCode.match(/function buildChangeRequestContextTable\(category\) \{[\s\S]*?^\}/m);
  assert.ok(contextTableMatch, 'buildChangeRequestContextTable function should exist in renderer.js');
  vm.runInContext(contextTableMatch[0], context);

  const match = rendererCode.match(/function buildChangeRequestIssueUrl\(category, title, details\) \{[\s\S]*?^\}/m);
  assert.ok(match, 'buildChangeRequestIssueUrl function should exist in renderer.js');
  vm.runInContext(match[0], context);

  const urlStr = vm.runInContext(`buildChangeRequestIssueUrl('Wunsch', 'Neuer Tabakhersteller', 'Bitte Trofimoff Tabak aufnehmen')`, context);

  assert.ok(urlStr.startsWith('https://github.com/BazZTee/shishawg-mod-setup-tool/issues/new?'));

  const parsed = new URL(urlStr);
  assert.equal(parsed.hostname, 'github.com');
  assert.equal(parsed.pathname, '/BazZTee/shishawg-mod-setup-tool/issues/new');

  const titleParam = parsed.searchParams.get('title');
  assert.equal(titleParam, '[CR]: Neuer Tabakhersteller');

  const bodyParam = parsed.searchParams.get('body');
  assert.ok(bodyParam.includes('### 📋 System- & Kontext-Informationen'));
  assert.ok(bodyParam.includes('| **Kategorie** | Wunsch |'));
  assert.ok(bodyParam.includes('| **Aktuelle Ansicht / Feature** | Setup Generator & Befehl (`view-setup`) |'));
  assert.ok(bodyParam.includes('| **Tool-Version** | v7.2.0 |'));
  assert.ok(bodyParam.includes('| **Mod-Benutzer** | MarvedMod (@marvedmod) |'));
  assert.ok(bodyParam.includes('| **Streamer-Profil / Kanal** | ShishaWG (Marvin) (`#marved`) |'));
  assert.ok(bodyParam.includes('Kopf #2 (10 Min) – MustH - Pynkman'));
  assert.ok(bodyParam.includes('Bitte Trofimoff Tabak aufnehmen'));
});

test('buildChangeRequestIssueUrl handles logged-out mod gracefully', () => {
  const context = {
    state: {
      twitchUser: null
    },
    currentActiveView: 'view-landing',
    statsState: {},
    document: {
      getElementById: (id) => {
        if (id === 'app-version-tag') return { textContent: 'v7.2.0' };
        return null;
      }
    }
  };

  vm.createContext(context);
  const viewMapMatch = rendererCode.match(/function getCurrentViewDisplayName\(viewId\) \{[\s\S]*?^\}/m);
  vm.runInContext(viewMapMatch[0], context);

  const contextTableMatch = rendererCode.match(/function buildChangeRequestContextTable\(category\) \{[\s\S]*?^\}/m);
  vm.runInContext(contextTableMatch[0], context);

  const match = rendererCode.match(/function buildChangeRequestIssueUrl\(category, title, details\) \{[\s\S]*?^\}/m);
  vm.runInContext(match[0], context);

  const urlStr = vm.runInContext(`buildChangeRequestIssueUrl('Fehler', 'Timer stockt', 'Der Timer lief rückwärts')`, context);
  const parsed = new URL(urlStr);
  const bodyParam = parsed.searchParams.get('body');

  assert.ok(bodyParam.includes('| **Mod-Benutzer** | (nicht angemeldet) |'));
  assert.ok(bodyParam.includes('| **Kategorie** | Fehler |'));
  assert.ok(bodyParam.includes('| **Aktuelle Ansicht / Feature** | Hauptmenü / Hub (`view-landing`) |'));
  assert.ok(bodyParam.includes('Keine aktive Kopf-Session'));
});

test('release version bumped to 8.0.1 in package.json and index.html', () => {
  assert.equal(pkgJson.version, '8.0.1');
  assert.match(indexHtml, /id="app-version-tag">v8\.0\.1</);
});

test('trelloService maps categories to valid label IDs', () => {
  const trelloService = require('../src/main/trelloService');
  assert.ok(trelloService.TRELLO_CONFIG.boardId, 'boardId must be configured');
  assert.ok(trelloService.TRELLO_CONFIG.listIdEingang, 'listIdEingang must be configured');

  assert.equal(trelloService.getLabelIdForCategory('Fehler'), trelloService.TRELLO_CONFIG.labels['Fehler']);
  assert.equal(trelloService.getLabelIdForCategory('Wunsch'), trelloService.TRELLO_CONFIG.labels['Wunsch']);
  assert.equal(trelloService.getLabelIdForCategory('UI'), trelloService.TRELLO_CONFIG.labels['UI']);
  assert.equal(trelloService.getLabelIdForCategory('Inhalt & Daten'), trelloService.TRELLO_CONFIG.labels['Inhalt & Daten']);
  assert.equal(trelloService.getLabelIdForCategory('Sonstiges'), trelloService.TRELLO_CONFIG.labels['Sonstiges']);
});
