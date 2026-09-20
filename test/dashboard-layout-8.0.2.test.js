const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const dashboardCode = fs.readFileSync(path.join(root, 'src/renderer/modules/11-dashboard.js'), 'utf8');

function extractFunction(name) {
  const match = dashboardCode.match(new RegExp(`function ${name}\\([^)]*\\) \\{[\\s\\S]*?^\\}`, 'm'));
  assert.ok(match, `${name} should exist`);
  return match[0];
}

test('changing a Quick-Actions subtool preserves the complete dock layout', () => {
  const originalLayout = {
    version: 2,
    root: {
      type: 'split',
      id: 'split-root',
      direction: 'row',
      ratio: 0.37,
      first: {
        type: 'panel',
        id: 'panel-tabs',
        activeId: 'widget-quickactions',
        tabs: [
          { id: 'widget-setup', collapsed: false },
          { id: 'widget-quickactions', collapsed: false, subTool: 'youtube' }
        ]
      },
      second: {
        type: 'panel',
        id: 'panel-chat',
        activeId: 'widget-modchat',
        tabs: [{ id: 'widget-modchat', collapsed: false }]
      }
    }
  };
  let savedLayout = null;
  const context = {
    getCustomDashboardLayout: () => structuredClone(originalLayout),
    saveCustomDashboardLayout: layout => { savedLayout = structuredClone(layout); }
  };
  vm.createContext(context);
  vm.runInContext(extractFunction('flattenDashboardWidgets'), context);
  vm.runInContext(extractFunction('updateCustomDashboardWidget'), context);

  const updated = vm.runInContext(
    "updateCustomDashboardWidget('widget-quickactions', { subTool: 'commands' })",
    context
  );

  assert.equal(updated, true);
  assert.equal(savedLayout.version, 2);
  assert.equal(savedLayout.root.id, 'split-root');
  assert.equal(savedLayout.root.direction, 'row');
  assert.equal(savedLayout.root.ratio, 0.37);
  assert.equal(savedLayout.root.first.id, 'panel-tabs');
  assert.deepEqual(savedLayout.root.first.tabs.map(tab => tab.id), ['widget-setup', 'widget-quickactions']);
  assert.equal(savedLayout.root.first.tabs[1].subTool, 'commands');
  assert.equal(savedLayout.root.second.id, 'panel-chat');
});

test('Quick-Actions tabs never use the legacy flat config save path', () => {
  const quickActionsCase = dashboardCode.match(/case 'widget-quickactions': \{[\s\S]*?case 'widget-/)?.[0] || '';
  assert.match(quickActionsCase, /updateCustomDashboardWidget\('widget-quickactions', \{ subTool: targetTool \}\)/);
  assert.match(quickActionsCase, /renderWidgetContent\(wConfig, container\)/);
  assert.doesNotMatch(quickActionsCase, /saveCustomDashboardConfig\(/);
  assert.doesNotMatch(quickActionsCase, /renderCustomDashboard\(\)/);
});

test('locked dashboards block structural actions but keep collapse available', () => {
  const lockUi = extractFunction('updateDashboardLockUI');
  const addModal = extractFunction('openAddWidgetModal');
  const listeners = extractFunction('setupCustomDashboardListeners');

  assert.match(lockUi, /\[btnAdd, btnReset\][\s\S]*?button\.disabled = locked/);
  assert.match(lockUi, /querySelectorAll\('\.btn-widget-remove'\)[\s\S]*?button\.disabled = locked/);
  assert.match(addModal, /if \(isCustomDashboardLocked\(\)\)/);
  assert.match(listeners, /Layout entsperren, um es zurückzusetzen/);

  const removeHandler = dashboardCode.match(/actions\.querySelector\('\.btn-widget-remove'\)\.addEventListener\('click',[\s\S]*?^    \}\);/m)?.[0] || '';
  const collapseHandler = dashboardCode.match(/actions\.querySelector\('\.btn-widget-collapse'\)\.addEventListener\('click',[\s\S]*?^    \}\);/m)?.[0] || '';
  assert.match(removeHandler, /isCustomDashboardLocked\(\)/);
  assert.doesNotMatch(collapseHandler, /isCustomDashboardLocked\(\)/);
});

test('YouTube outside-click handling is registered once outside widget rendering', () => {
  const quickActionsCase = dashboardCode.match(/case 'widget-quickactions': \{[\s\S]*?case 'widget-/)?.[0] || '';
  const listeners = extractFunction('setupCustomDashboardListeners');

  assert.doesNotMatch(quickActionsCase, /document\.addEventListener\('click'/);
  assert.match(listeners, /document\.addEventListener\('click'/);
  assert.match(listeners, /document\.getElementById\('cw-yt-suggestions'\)/);
});

test('saved command changes refresh only Quick-Actions and keep its selected subtool', () => {
  const refresh = extractFunction('refreshDashboardWidgets');
  const listeners = extractFunction('setupCustomDashboardListeners');
  const commandChangeHandler = listeners.match(/window\.addEventListener\('swg:quick-commands-changed',[\s\S]*?^  \}\);/m)?.[0] || '';

  assert.match(refresh, /flattenDashboardWidgets\(getCustomDashboardLayout\(\)\.root\)/);
  assert.match(refresh, /renderWidgetContent\(configuredWidgets\.get\(widgetId\) \|\| widgetId, container\)/);
  assert.match(commandChangeHandler, /refreshDashboardWidgets\('widget-quickactions'\)/);
  assert.doesNotMatch(commandChangeHandler, /renderCustomDashboard\(\)/);
});
