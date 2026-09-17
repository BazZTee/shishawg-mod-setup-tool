const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const indexHtml = fs.readFileSync(path.join(__dirname, '../src/renderer/index.html'), 'utf8');
const rendererCode = fs.readFileSync(path.join(__dirname, '../src/renderer/renderer.js'), 'utf8');

test('Landing page has 8th tile for Custom Mod Dashboard with data-target="view-custom-dashboard"', () => {
  assert.match(indexHtml, /id="card-custom-dashboard"[^>]*data-target="view-custom-dashboard"/);
  assert.match(indexHtml, /id="icon-custom-dashboard"/);
  assert.match(indexHtml, /id="badge-custom-dashboard"/);
  assert.match(indexHtml, /id="title-custom-dashboard"/);
  assert.match(indexHtml, /id="desc-custom-dashboard"/);
  assert.match(indexHtml, /id="action-custom-dashboard"/);
});

test('View 8 (#view-custom-dashboard) and Add-Widget modal exist in index.html', () => {
  assert.match(indexHtml, /id="view-custom-dashboard"/);
  assert.match(indexHtml, /id="custom-dashboard-grid"/);
  assert.match(indexHtml, /id="btn-custom-dashboard-add-widget"/);
  assert.match(indexHtml, /id="btn-custom-dashboard-reset-layout"/);
  assert.match(indexHtml, /id="modal-add-dashboard-widget"/);
  assert.match(indexHtml, /id="add-widget-catalog-list"/);
  assert.match(indexHtml, /id="btn-close-add-widget-modal"/);
});

test('CUSTOM_DASHBOARD_CATALOG follows navigation order and includes Giveaways', () => {
  const matchCatalog = rendererCode.match(/const CUSTOM_DASHBOARD_CATALOG = (\[[\s\S]*?\]);/);
  assert.ok(matchCatalog, 'CUSTOM_DASHBOARD_CATALOG should be defined in renderer.js');

  const catalog = eval(matchCatalog[1]);
  assert.equal(catalog.length, 8);

  const ids = catalog.map(c => c.id);
  assert.ok(ids.includes('widget-timer'), 'Must include timer widget');
  assert.ok(ids.includes('widget-setup'), 'Must include setup widget');
  assert.ok(ids.includes('widget-modchat'), 'Must include modchat widget');
  assert.ok(ids.includes('widget-giveaways'), 'Must include giveaways widget');
  assert.ok(ids.includes('widget-quickactions'), 'Must include quickactions widget');
  assert.ok(ids.includes('widget-polls'), 'Must include polls widget');
  assert.ok(ids.includes('widget-qna'), 'Must include qna widget');
  assert.ok(ids.includes('widget-stats'), 'Must include stats widget');
  assert.deepEqual(ids, [
    'widget-setup',
    'widget-quickactions',
    'widget-modchat',
    'widget-giveaways',
    'widget-qna',
    'widget-polls',
    'widget-timer',
    'widget-stats'
  ], 'Widget picker must follow the left navigation order');

});

test('Custom Dashboard config persists in localStorage and defaults gracefully', () => {
  let storage = {};
  const mockLocalStorage = {
    getItem: (key) => storage[key] || null,
    setItem: (key, val) => { storage[key] = String(val); }
  };

  const context = {
    localStorage: mockLocalStorage,
    DEFAULT_DASHBOARD_WIDGETS: [
      { id: 'widget-timer', colSpan: 6, collapsed: false },
      { id: 'widget-setup', colSpan: 6, collapsed: false },
      { id: 'widget-modchat', colSpan: 12, collapsed: false }
    ],
    CUSTOM_DASHBOARD_STORAGE_KEY: 'swg_custom_dashboard_config',
    renderCustomDashboardTile: () => {},
    console: { warn: () => {} }
  };

  vm.createContext(context);

  const matchGet = rendererCode.match(/function getCustomDashboardConfig\(\) \{[\s\S]*?^\}/m);
  const matchSave = rendererCode.match(/function saveCustomDashboardConfig\(widgets\) \{[\s\S]*?^\}/m);
  assert.ok(matchGet);
  assert.ok(matchSave);

  vm.runInContext(matchGet[0], context);
  vm.runInContext(matchSave[0], context);

  // Initial load without saved data returns defaults
  const initial = vm.runInContext('getCustomDashboardConfig()', context);
  assert.equal(initial.length, 3);
  assert.equal(initial[0].id, 'widget-timer');

  // Save new configuration with 4 widgets
  const customList = [
    { id: 'widget-setup', colSpan: 8, collapsed: true },
    { id: 'widget-modchat', colSpan: 4, collapsed: false },
    { id: 'widget-polls', colSpan: 6, collapsed: false },
    { id: 'widget-quickactions', colSpan: 6, collapsed: false }
  ];
  vm.runInContext(`saveCustomDashboardConfig(${JSON.stringify(customList)})`, context);

  const reloaded = vm.runInContext('getCustomDashboardConfig()', context);
  assert.equal(reloaded.length, 4);
  assert.equal(reloaded[0].id, 'widget-setup');
  assert.equal(reloaded[0].colSpan, 8);
  assert.equal(reloaded[0].collapsed, true);
  assert.equal(reloaded[1].id, 'widget-modchat');
});

test('Header has Lock/Unlock button and renderer handles lock state persistence', () => {
  assert.match(indexHtml, /id="btn-custom-dashboard-lock"/, 'Lock button must exist in custom dashboard header');
  assert.match(indexHtml, /id="custom-dashboard-layout-hint"/, 'Layout help must have a lock-aware target');
  assert.match(rendererCode, /layoutHint\.classList\.toggle\('hidden', locked\)/, 'Layout help must hide while locked');

  let storage = {};
  const mockLocalStorage = {
    getItem: (key) => storage[key] || null,
    setItem: (key, val) => { storage[key] = String(val); }
  };

  const context = {
    localStorage: mockLocalStorage,
    CUSTOM_DASHBOARD_LOCK_KEY: 'swg_custom_dashboard_locked',
    updateDashboardLockUI: () => {}
  };
  vm.createContext(context);

  const matchIsLocked = rendererCode.match(/function isCustomDashboardLocked\(\) \{[\s\S]*?^\}/m);
  const matchSetLocked = rendererCode.match(/function setCustomDashboardLocked\(locked\) \{[\s\S]*?^\}/m);
  assert.ok(matchIsLocked, 'isCustomDashboardLocked should be defined');
  assert.ok(matchSetLocked, 'setCustomDashboardLocked should be defined');

  vm.runInContext(matchIsLocked[0], context);
  vm.runInContext(matchSetLocked[0], context);

  // Defaults to false (unlocked)
  assert.equal(vm.runInContext('isCustomDashboardLocked()', context), false);

  // Lock the dashboard
  vm.runInContext('setCustomDashboardLocked(true)', context);
  assert.equal(vm.runInContext('isCustomDashboardLocked()', context), true);
  assert.equal(storage['swg_custom_dashboard_locked'], 'true');

  // Unlock the dashboard
  vm.runInContext('setCustomDashboardLocked(false)', context);
  assert.equal(vm.runInContext('isCustomDashboardLocked()', context), false);
  assert.equal(storage['swg_custom_dashboard_locked'], 'false');
});

test('Twitch / OBS Docks resize handles and flexible column spans exist in styles.css', () => {
  const stylesCss = fs.readFileSync(path.join(__dirname, '../src/renderer/styles.css'), 'utf8');
  assert.match(stylesCss, /\.widget-resize-handle-e/, 'Right edge resize handle must exist in styles.css');
  assert.match(stylesCss, /\.widget-resize-handle-s/, 'Bottom edge resize handle must exist in styles.css');
  assert.match(stylesCss, /\.widget-resize-handle-se/, 'Corner resize handle must exist in styles.css');
  assert.match(stylesCss, /\.custom-dashboard-grid\.is-locked/, 'Locked grid styles must exist in styles.css');
  assert.match(stylesCss, /\.col-span-3/, 'Flexible column spans must exist in styles.css');
  assert.match(stylesCss, /\.col-span-12/, '12-column spans must exist in styles.css');
});

test('renderDashboardModChat and Quick-Actions configurable subtools are defined in renderer.js', () => {
  assert.match(rendererCode, /function renderDashboardModChat\(messages\)/, 'renderDashboardModChat must exist in renderer.js');
  assert.match(rendererCode, /sendDashboardModChatMessage/, 'sendDashboardModChatMessage must exist in renderer.js');
  assert.match(rendererCode, /data-tool="youtube"/, 'Quick actions must support YouTube search subtool');
  assert.match(rendererCode, /data-tool="commands"/, 'Quick actions must support Commands subtool');
});

test('widget-setup provides full-featured setup tool with multi-tobacco and database verification', () => {
  assert.match(rendererCode, /id="cw-setup-name"/, 'Must contain Person Name input');
  assert.match(rendererCode, /id="cw-setup-electric"/, 'Must contain E-Gerät toggle');
  assert.match(rendererCode, /id="cw-setup-pipe"/, 'Must contain Pfeife input');
  assert.match(rendererCode, /id="cw-setup-bowl"/, 'Must contain Kopf input');
  assert.match(rendererCode, /id="cw-setup-hmd"/, 'Must contain HMD input');
  assert.match(rendererCode, /id="cw-setup-charcoal"/, 'Must contain Kohle input');
  assert.match(rendererCode, /id="cw-setup-btn-add-tob"/, 'Must have button to add more tobaccos');
  assert.match(rendererCode, /cw-tob-badge/, 'Must render database check badge for tobaccos');
  assert.match(rendererCode, /id="cw-setup-cmd-preview"/, 'Must render live command preview');
  assert.match(rendererCode, /id="cw-setup-btn-copy"/, 'Must have copy button');
  assert.match(rendererCode, /id="cw-setup-btn-send"/, 'Must have send button');
});

test('dashboard uses Premiere-style directional docking, tab groups, and persistent split ratios', () => {
  const stylesCss = fs.readFileSync(path.join(__dirname, '../src/renderer/styles.css'), 'utf8');
  assert.match(rendererCode, /CUSTOM_DASHBOARD_LAYOUT_VERSION = 2/);
  assert.match(rendererCode, /function makeDashboardSplit\(direction, first, second/);
  assert.match(rendererCode, /function dockDashboardWidget\(layout, widgetId, targetPanelId, zone\)/);
  assert.match(rendererCode, /data-zone="left"/);
  assert.match(rendererCode, /data-zone="right"/);
  assert.match(rendererCode, /data-zone="top"/);
  assert.match(rendererCode, /data-zone="bottom"/);
  assert.match(rendererCode, /data-zone="center"/);
  assert.match(rendererCode, /targetPanel\.tabs\.push\(widget\)/, 'Center drop must create a tab group');
  assert.match(rendererCode, /node\.ratio = Math\.max\(0\.2, Math\.min\(0\.8, raw\)\)/, 'Divider resize ratio must be bounded');
  assert.match(stylesCss, /\.dashboard-dock-zone\.is-active/);
  assert.match(stylesCss, /\.dashboard-split-divider/);
  assert.match(rendererCode, /function isDashboardNodeCollapsed\(node\)/);
  assert.match(rendererCode, /getDashboardCollapsedHeight\(node\.first\)/);
  assert.match(rendererCode, /first\.style\.flex = firstCollapsed \? `0 0 \$\{getDashboardCollapsedHeight\(node\.first\)\}px` : '1 1 0'/);
  assert.match(stylesCss, /\.dashboard-panel\.is-collapsed/);
  assert.match(rendererCode, /if \(isCustomDashboardLocked\(\) \|\| hasVerticalCollapse\) return;/);
  assert.match(stylesCss, /\.custom-dashboard-grid\.is-locked \.dashboard-split-divider \{ pointer-events: none; \}/);
});

test('dashboard refreshes database-backed data automatically and exposes full tools', () => {
  assert.doesNotMatch(indexHtml, /id="btn-custom-dashboard-sync"/);
  assert.match(rendererCode, /targetViewId === 'view-custom-dashboard'[\s\S]*?loadQnAState\(\)[\s\S]*?setInterval\(loadQnAState, 2500\)[\s\S]*?loadStatsState\(\)[\s\S]*?setInterval\(loadStatsState, 4000\)/);
  assert.match(rendererCode, /loadQnAState/);
  assert.match(rendererCode, /loadStatsState/);
  assert.match(rendererCode, /CUSTOM_DASHBOARD_FULL_VIEWS/);
  assert.match(rendererCode, /btn-widget-open-full/);
});

test('setup widget avoids duplicate full-view action and dashboard chat has its own 7TV picker', () => {
  assert.doesNotMatch(rendererCode, /id="cw-setup-btn-full"/);
  assert.match(rendererCode, /id="cw-modchat-7tv-popover"/);
  assert.match(rendererCode, /id="cw-modchat-7tv-search"/);
  assert.match(rendererCode, /sevenTvEmoteList\.filter/);
  assert.match(rendererCode, /input\.value = `\$\{input\.value\}\$\{separator\}\$\{name\} `/);
  assert.match(rendererCode, /renderModChatMessageWithEmotes\(m\.text \|\| ''\)/);
});

test('dashboard commands use saved custom commands and Giveaway widget reuses shared logic', () => {
  assert.match(rendererCode, /const dashboardCommands = Array\.isArray\(quickCommands\)/);
  assert.match(rendererCode, /id="cw-add-custom-command"/);
  assert.match(rendererCode, /openEditCommandModal\(btn\.dataset\.id\)/);
  assert.match(rendererCode, /window\.dispatchEvent\(new CustomEvent\('swg:quick-commands-changed'\)\)/);
  assert.match(rendererCode, /case 'widget-giveaways'/);
  assert.match(rendererCode, /await startGiveawayRegistration\(\)/);
  assert.match(rendererCode, /await stopGiveawayRegistration\(\)/);
  assert.match(rendererCode, /await drawGiveawayWinner\(\)/);
  assert.match(rendererCode, /loadGiveawayWinnersHistory\(\)\.then/);
  assert.match(rendererCode, /updateDashboardGiveawayWidget/);
});

test('dashboard live widgets redraw from the same Q&A, poll and stats state as full views', () => {
  assert.match(rendererCode, /body\.dataset\.widgetId = active\.id/);
  assert.match(rendererCode, /function refreshDashboardWidgets\(widgetIds\)/);
  assert.match(rendererCode, /refreshDashboardWidgets\(\['widget-qna', 'widget-polls'\]\)/);
  assert.match(rendererCode, /refreshDashboardWidgets\(\['widget-timer', 'widget-stats'\]\)/);
  assert.match(rendererCode, /data-next-status="\$\{q\.status === 'approved' \? 'on_air' : 'approved'\}"/);
  assert.doesNotMatch(rendererCode, /setQuestionStatus\(qId, 'answered'\)/);
});
