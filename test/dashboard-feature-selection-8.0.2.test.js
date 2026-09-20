const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const dashboard = read('src/renderer/modules/11-dashboard.js');

test('dashboard catalog offers full or selected feature modes', () => {
  assert.match(dashboard, /features:\s*\[[\s\S]*?compactDefaults:/);
  assert.match(dashboard, /value="full"/);
  assert.match(dashboard, /value="compact"/);
  assert.match(dashboard, /Ausgewählte Funktionen/);
  assert.match(dashboard, /Bitte wähle mindestens eine Funktion aus/);
});

test('existing widgets are reconfigured without being added a second time', () => {
  assert.match(dashboard, /if \(isAdded && existingWidget\)/);
  assert.match(dashboard, /existingWidget\.features = features/);
  assert.match(dashboard, /delete existingWidget\.features/);
  assert.match(dashboard, /Auswahl für .* gespeichert/);
});

test('feature selection hides only unselected widget sections and keeps legacy widgets complete', () => {
  assert.match(dashboard, /if \(!Array\.isArray\(widgetConfig\?\.features\)\) return null/);
  assert.match(dashboard, /dashboard-feature-hidden/);
  assert.match(dashboard, /data-dashboard-feature="hardware"/);
  assert.match(dashboard, /data-dashboard-feature="messages"/);
  assert.match(dashboard, /data-dashboard-feature="participants"/);
  assert.match(dashboard, /data-dashboard-feature="coal"/);
});

test('a reduced Quick-Actions module opens an enabled tool and shows only selected tabs', () => {
  assert.match(dashboard, /const availableTools = selectedTools\?\.length \? selectedTools/);
  assert.match(dashboard, /availableTools\.includes\(wConfig\.subTool\)/);
  assert.match(dashboard, /data-dashboard-feature="commands"/);
  assert.match(dashboard, /newWidget\.subTool = newWidget\.features\[0\]/);
});

test('widget picker uses the available window and scrolls without shrinking open cards', () => {
  const html = read('src/renderer/index.html');
  const styles = read('src/renderer/styles.css');
  assert.match(html, /dashboard-widget-picker-modal/);
  assert.match(html, /dashboard-widget-picker-list/);
  assert.match(styles, /\.dashboard-widget-picker-modal[\s\S]*?100dvh - 48px/);
  assert.match(styles, /\.dashboard-widget-picker-list[\s\S]*?overflow-y: auto/);
  assert.match(styles, /\.catalog-widget-item[\s\S]*?flex: 0 0 auto/);
  assert.match(dashboard, /otherItem\.open = false/);
});
