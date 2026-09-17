'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const rendererCode = fs.readFileSync(path.join(root, 'src/renderer/renderer.js'), 'utf8');

function setupAnalyticsContext() {
  const elements = new Map();
  const getEl = (id) => {
    if (!elements.has(id)) {
      elements.set(id, {
        textContent: '',
        innerHTML: '',
        value: '',
        classList: {
          contains: () => false,
          add: () => {},
          remove: () => {}
        }
      });
    }
    return elements.get(id);
  };

  const context = {
    document: {
      getElementById: getEl
    },
    escapeHtml: (s) => String(s || ''),
    splitTobaccoItems: (s) => {
      const tob = (s.tobacco || '').trim();
      return tob ? [tob] : [];
    }
  };

  vm.createContext(context);

  const renderStatsAnalyticsMatch = rendererCode.match(/function renderStatsAnalytics\(sessions\) \{[\s\S]*?^\}/m);
  assert.ok(renderStatsAnalyticsMatch, 'renderStatsAnalytics must be defined');
  vm.runInContext(renderStatsAnalyticsMatch[0], context);

  return { context, getEl };
}

test('renderStatsAnalytics cleanly separates coal and electric duration and counts', () => {
  const { context, getEl } = setupAnalyticsContext();

  const sessions = [
    // Coal session 1: 60 min
    {
      duration_minutes: 60,
      pipe: 'Moze Varity',
      bowl: 'Cosmo Bowl',
      hmd: 'Onmo HMD',
      tobacco: 'MustH - Pynkman',
      is_electric: false
    },
    // Coal session 2: 80 min
    {
      duration_minutes: 80,
      pipe: 'Ocean Hookah',
      bowl: 'Phunnel',
      hmd: 'Lotus',
      tobacco: 'Black Burn - Green T',
      is_electric: false
    },
    // Electric session 1: 40 min (detected by bowl: XKAH)
    {
      duration_minutes: 40,
      pipe: 'Moze Varity',
      bowl: 'XKAH Shii',
      hmd: '',
      tobacco: 'Kismet - Black Lavender'
    },
    // Electric session 2: 50 min (marked is_electric: true)
    {
      duration_minutes: 50,
      pipe: 'Ocean Hookah',
      bowl: 'IMOTO Head',
      hmd: '',
      tobacco: 'Darkside - Cola',
      is_electric: true
    }
  ];

  vm.runInContext(`renderStatsAnalytics(${JSON.stringify(sessions)})`, context);

  // Coal avg: (60 + 80) / 2 = 70 Min
  assert.equal(getEl('kpi-avg-duration-coal').textContent, '70 Min');
  assert.equal(getEl('kpi-count-coal').textContent, '2 Köpfe');

  // Electric avg: (40 + 50) / 2 = 45 Min
  assert.equal(getEl('kpi-avg-duration-electric').textContent, '45 Min');
  assert.equal(getEl('kpi-count-electric').textContent, '2 Köpfe');

  // Total count
  assert.equal(getEl('kpi-total-heads').textContent, '4');
});

test('renderStatsAnalytics handles zero sessions for one category gracefully', () => {
  const { context, getEl } = setupAnalyticsContext();

  const sessions = [
    // Only 1 coal session
    {
      duration_minutes: 65,
      pipe: 'Moze Varity',
      bowl: 'Cosmo Bowl',
      hmd: 'Onmo HMD',
      tobacco: 'MustH - Pynkman'
    }
  ];

  vm.runInContext(`renderStatsAnalytics(${JSON.stringify(sessions)})`, context);

  assert.equal(getEl('kpi-avg-duration-coal').textContent, '65 Min');
  assert.equal(getEl('kpi-count-coal').textContent, '1 Kopf');

  assert.equal(getEl('kpi-avg-duration-electric').textContent, '0 Min');
  assert.equal(getEl('kpi-count-electric').textContent, '0 Köpfe');
});

test('analytics presents tobacco and mix rankings as top 10 without a coal-change KPI', () => {
  const index = fs.readFileSync(path.join(root, 'src/renderer/index.html'), 'utf8');
  const renderer = fs.readFileSync(path.join(root, 'src/renderer/renderer.js'), 'utf8');

  assert.match(index, /Top 10 meistgerauchte Tabaksorten/);
  assert.match(index, /Top 10 Tabak-Mixes/);
  assert.doesNotMatch(index, /id="kpi-total-coals"/);
  assert.doesNotMatch(index, />Kohlewechsel</);
  assert.match(renderer, /renderRanking\(containerTobacco, tobaccoCounts, 10,/);
  assert.match(renderer, /renderRanking\(containerMixes, mixCounts, 10,/);
});
