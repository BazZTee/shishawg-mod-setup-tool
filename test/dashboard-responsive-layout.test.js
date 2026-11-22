const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const code = fs.readFileSync(path.join(__dirname, '../src/renderer/renderer.js'), 'utf8');
const styles = fs.readFileSync(path.join(__dirname, '../src/renderer/styles.css'), 'utf8');
const workspace = fs.readFileSync(path.join(__dirname, '../src/renderer/workspace.css'), 'utf8');

const functions = ['isDashboardNodeCollapsed', 'getDashboardCollapsedHeight', 'getDashboardMinimumSize', 'adaptDashboardLayout'];
const source = functions.map(name => {
  const match = code.match(new RegExp(`function ${name}\\([^]*?^\\}`, 'm'));
  assert.ok(match, `${name} exists`);
  return match[0];
}).join('\n');
const context = vm.createContext({ updateDashboardTabOverflow() {} });
vm.runInContext(source, context);

function panel(id, collapsed = false) {
  return { type: 'panel', id, activeId: id, tabs: [{ id, collapsed }] };
}

function element(node) {
  if (node.type === 'panel') return {
    querySelector(selector) { return selector === '.dashboard-panel-tabs' ? { offsetHeight: 43 } : { scrollHeight: 0 }; }
  };
  const classes = new Set();
  const first = { style: {}, firstElementChild: element(node.first) };
  const second = { style: {}, firstElementChild: element(node.second) };
  return {
    children: [first, {}, second],
    classList: {
      toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); },
      contains(name) { return classes.has(name); }
    }
  };
}

function gridFor(root, width) {
  return {
    clientWidth: width,
    firstElementChild: element(root),
    querySelectorAll() { return []; }
  };
}

test('narrow row stacks, then restores horizontal layout on widening', () => {
  const root = { type: 'split', direction: 'row', ratio: 0.5, first: panel('widget-setup'), second: panel('widget-modchat') };
  const grid = gridFor(root, 650);
  context.adaptDashboardLayout(grid, root);
  assert.equal(grid.firstElementChild.classList.contains('is-auto-stacked'), true);

  grid.clientWidth = 1000;
  context.adaptDashboardLayout(grid, root);
  assert.equal(grid.firstElementChild.classList.contains('is-auto-stacked'), false);
  assert.equal(root.ratio, 0.5);

  root.ratio = 0.2;
  context.adaptDashboardLayout(grid, root);
  assert.ok(parseFloat(grid.firstElementChild.children[0].style.flex.slice(4)) >= 499.9);
  assert.equal(root.ratio, 0.2);
});

test('tab group keeps the same minimum width when its active tab changes', () => {
  const left = panel('widget-quickactions');
  left.tabs.push({ id: 'widget-setup', collapsed: false });
  const root = { type: 'split', direction: 'row', ratio: 0.5, first: left, second: panel('widget-modchat') };
  const grid = gridFor(root, 920);
  context.adaptDashboardLayout(grid, root);
  const before = grid.firstElementChild.children[0].style.flex;
  assert.equal(context.getDashboardMinimumSize(left).width, 500);
  left.activeId = 'widget-setup';
  context.adaptDashboardLayout(grid, root);
  assert.equal(grid.firstElementChild.children[0].style.flex, before);
  assert.equal(grid.firstElementChild.classList.contains('is-auto-stacked'), false);
});

test('vertical stacks reserve pane height and collapsed tabs stay compact', () => {
  const root = {
    type: 'split', direction: 'column', ratio: 0.5,
    first: { type: 'split', direction: 'column', ratio: 0.5, first: panel('widget-setup'), second: panel('widget-qna', true) },
    second: panel('widget-modchat')
  };
  const grid = gridFor(root, 900);
  context.adaptDashboardLayout(grid, root);
  assert.equal(grid.firstElementChild.children[0].style.minHeight, '574px');
  root.firstHeightOffset = -100;
  context.adaptDashboardLayout(grid, root);
  assert.equal(grid.firstElementChild.children[0].style.height, '474px');
  assert.equal(grid.firstElementChild.children[0].style.overflowY, 'auto');
});

test('dashboard page scrolls and embedded setup switches to one column', () => {
  assert.match(styles, /\.custom-dashboard-grid \{[\s\S]*?height: auto;/);
  assert.match(styles, /#view-custom-dashboard \.dashboard-panel > \.custom-widget-body \{[^}]*overflow: visible;/);
  assert.match(workspace, /#view-custom-dashboard \{ scrollbar-gutter: stable; \}/);
  assert.match(workspace, /\.dashboard-embedded-source-view#view-setup \.glass-setup-layout[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);
});
