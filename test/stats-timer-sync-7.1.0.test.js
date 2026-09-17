'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('updateHeadCounterUI is defined and does not throw ReferenceError', () => {
  const renderer = read('src/renderer/renderer.js');
  assert.match(renderer, /function\s+updateHeadCounterUI\s*\(\)/);

  const funcMatch = renderer.match(/function updateHeadCounterUI\(\) \{[\s\S]*?^\}/m);
  assert.ok(funcMatch, 'updateHeadCounterUI function definition must exist');

  const domMock = {
    document: {
      getElementById: (id) => ({
        textContent: '',
        classList: { contains: () => false, add: () => {}, remove: () => {} }
      })
    },
    statsState: {
      isRunning: true,
      headCountToday: 2,
      activeSetup: { tobacco: 'Aino Strong - Cassia' }
    }
  };

  const sandbox = vm.createContext(domMock);
  vm.runInContext(funcMatch[0], sandbox);
  assert.doesNotThrow(() => {
    vm.runInContext('updateHeadCounterUI()', sandbox);
  });
});

test('supabase:settings-changed unconditionally synchronizes stats state', () => {
  const renderer = read('src/renderer/renderer.js');
  const listenerMatch = renderer.match(/ipcRenderer\.on\('supabase:settings-changed'[\s\S]*?\}\);/);
  assert.ok(listenerMatch, 'supabase:settings-changed listener must exist');
  assert.doesNotMatch(listenerMatch[0], /view-stats.*classList.*contains.*hidden/);
  assert.match(listenerMatch[0], /loadStatsState\(\)/);
});

test('statsSyncInterval polls live state when viewing stats and clears when leaving', () => {
  const renderer = read('src/renderer/renderer.js');
  assert.match(renderer, /let\s+statsSyncInterval\s*=\s*null;/);
  assert.match(renderer, /statsSyncInterval\s*=\s*setInterval\(loadStatsState,\s*4000\);/);
  assert.match(renderer, /clearInterval\(statsSyncInterval\);/);
});

test('restoreActiveTimerState uses absolute sessionStartTime for sync', () => {
  const renderer = read('src/renderer/renderer.js');
  assert.match(renderer, /statsState\.sessionStartTime\s*=\s*sessionStartTime;/);
  assert.match(renderer, /Math\.floor\(\(Date\.now\(\)\s*-\s*statsState\.sessionStartTime\)\s*\/\s*1000\)/);
});

test('history table exposes resume button and bottom bar has start button', () => {
  const renderer = read('src/renderer/renderer.js');
  const index = read('src/renderer/index.html');

  assert.match(index, /id="btn-timer-start-head"/);
  assert.match(renderer, /btn-resume-session/);
  assert.match(renderer, /btnStartHead\.classList\.remove\('hidden'\)/);
  assert.match(renderer, /btnFinishHead\.classList\.add\('hidden'\)/);
});

test('history rows expose an editor that updates the existing session', () => {
  const renderer = read('src/renderer/renderer.js');
  const index = read('src/renderer/index.html');
  const styles = read('src/renderer/styles.css');

  assert.match(renderer, /class="btn btn-xs btn-secondary btn-edit-session"/);
  assert.match(renderer, /function openStatsSessionEditModal\(session\)/);
  assert.match(renderer, /async function saveStatsSessionEdits\(\)/);
  assert.match(renderer, /id: existing\.id/);
  assert.match(renderer, /ipcRenderer\.invoke\('stats:save-session', updatedSession\)/);
  for (const id of ['modal-edit-stats-session', 'input-edit-session-tobacco', 'input-edit-session-duration', 'select-edit-session-rating', 'btn-save-edit-stats-session']) {
    assert.match(index, new RegExp(`id="${id}"`));
  }
  for (const id of ['btn-edit-session-datetime', 'edit-session-datetime-popover', 'edit-session-calendar-grid', 'input-edit-date-hour', 'input-edit-date-minute']) {
    assert.match(index, new RegExp(`id="${id}"`));
  }
  assert.doesNotMatch(index, /type="datetime-local"/);
  assert.match(renderer, /function renderStatsEditDateTimePicker\(\)/);
  assert.match(styles, /\.stats-edit-modal-card[\s\S]*min-height:\s*min\(720px,/);
  assert.match(styles, /\.stats-edit-modal-body[\s\S]*overflow:\s*visible/);
});

test('session saves surface cloud database failures while preserving the local fallback', async () => {
  const service = require('../src/main/supabaseService');
  service.client = {
    from() {
      return {
        upsert() {
          return {
            select: async () => ({ data: null, error: new Error('DB offline') })
          };
        }
      };
    }
  };

  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    const result = await service.saveShishaSession({ id: 'sess-edit-test', tobacco: 'Testtabak' });
    assert.equal(result.success, false);
    assert.match(result.error, /DB offline/);
  } finally {
    console.error = originalConsoleError;
  }

  const main = read('src/main/main.js');
  const renderer = read('src/renderer/renderer.js');
  assert.match(main, /localSaved: true/);
  assert.match(main, /cloudSynced: false/);
  assert.match(renderer, /Lokal gespeichert, aber nicht mit der Online-Datenbank synchronisiert/);
});

test('analytics counts pipes even when electric device is used and excludes electric devices from bowls/hmds', () => {
  const renderer = read('src/renderer/renderer.js');
  assert.match(renderer, /incrementItems\(pipeCounts,\s*pipe\)/);
  assert.match(renderer, /pipe && !isElectricDeviceText\(pipe\) && pipe !== electricDevice/);
  assert.match(renderer, /bowl && !isElectricDeviceText\(bowl\) && bowl !== electricDevice/);
  assert.match(renderer, /hmd && !isElectricDeviceText\(hmd\) && hmd !== electricDevice/);
});

test('in-place session update toggle updates active setup without resetting timer', () => {
  const renderer = read('src/renderer/renderer.js');
  const index = read('src/renderer/index.html');

  assert.match(index, /id="chk-update-active-session-only"/);
  assert.match(renderer, /chk-update-active-session-only/);
  assert.match(renderer, /statsState\.isRunning && chkUpdateOnly && chkUpdateOnly\.checked/);
  assert.match(renderer, /saveActiveTimerStateToBackend\(\)/);
});

test('filling form fields does not start timer; timer requires explicit send or start action', () => {
  const renderer = read('src/renderer/renderer.js');
  const generatorFunc = renderer.match(/function generateCommandString\(\) \{[\s\S]*?^\}/m)?.[0];
  assert.ok(generatorFunc, 'generateCommandString definition exists');
  assert.doesNotMatch(generatorFunc, /checkAndAutoStartHeadSession/);
  assert.match(renderer, /function checkAndAutoStartHeadSession\(force = false\) \{\s+if \(!force\) return;/);
});
