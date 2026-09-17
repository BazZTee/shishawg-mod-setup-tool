'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('running timer is restored from its persisted absolute start timestamp', () => {
  const renderer = read('src/renderer/renderer.js');
  assert.match(renderer, /function restoreActiveTimerState\(timerState\)/);
  assert.match(renderer, /Date\.now\(\) - statsState\.sessionStartTime/);
  assert.match(renderer, /setInterval\(updateStatsTimerTick, 1000\)/);
  assert.match(renderer, /restoreActiveTimerState\(ts\)/);
});

test('electric setups use eight-minute preheat and no coal phase', () => {
  const renderer = read('src/renderer/renderer.js');
  const overlay = read('docs/qna.html');
  assert.match(renderer, /ELECTRIC_PREHEAT_SECONDS = 8 \* 60/);
  assert.match(renderer, /Preheat läuft/);
  assert.match(renderer, /Preheat abgeschlossen/);
  assert.match(renderer, /electricDevice/);
  assert.match(overlay, /isElectric/);
  assert.match(overlay, /\(8 \* 60\) - sessionSecs/);
});

test('analytics keep mixes while ranking individual tobacco and hardware categories', () => {
  const renderer = read('src/renderer/renderer.js');
  const index = read('src/renderer/index.html');
  assert.match(renderer, /splitTobaccoItems\(s\)/);
  assert.match(renderer, /Array\.isArray\(explicitItems\) && explicitItems\.length > 0/);
  assert.match(renderer, /renderRanking\(containerTobacco, tobaccoCounts, 10/);
  assert.match(renderer, /renderRanking\(containerMixes, mixCounts, 10/);
  for (const id of ['analytics-top-pipes', 'analytics-top-bowls', 'analytics-top-hmds', 'analytics-top-electric']) {
    assert.match(index, new RegExp(`id="${id}"`));
  }
});

test('legacy rows with migration-default empty tobacco_items fall back to the saved mix text', () => {
  const renderer = read('src/renderer/renderer.js');
  const functionSource = renderer.match(/function splitTobaccoItems\(session\) \{[\s\S]*?^\}/m)?.[0];
  assert.ok(functionSource, 'splitTobaccoItems must be present');
  const splitTobaccoItems = vm.runInNewContext(`(${functionSource})`);
  assert.deepEqual(
    Array.from(splitTobaccoItems({
      tobacco_items: [],
      tobacco: 'MustH - Pykman & MustH - Kiwi Smooth'
    })),
    ['MustH - Pykman', 'MustH - Kiwi Smooth']
  );
});

test('Supabase enrichment has a safe legacy fallback and migration', () => {
  const service = read('src/main/supabaseService.js');
  const migration = read('scripts/supabase_stats_7_0_11.sql');
  assert.match(service, /tobacco_items:/);
  assert.match(service, /delete legacyRow\.tobacco_items/);
  assert.match(migration, /add column if not exists tobacco_items jsonb/);
  assert.match(migration, /add column if not exists is_electric boolean/);
});
