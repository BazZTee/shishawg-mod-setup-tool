const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '../..');
const output = path.join(root, 'qa-output', 'dashboard-responsive');
fs.mkdirSync(output, { recursive: true });
for (const stream of [process.stdout, process.stderr]) {
  stream.on('error', error => { if (error.code !== 'EPIPE') throw error; });
}
const stage = message => fs.writeFileSync(path.join(output, 'stage.txt'), message);
stage('starting');
app.setPath('userData', path.join(output, 'profile'));
app.disableHardwareAcceleration();

async function run() {
  await app.whenReady();
  stage('ready');
  const messages = [
    { id: 'qa-1', senderName: 'Mod Alpha', senderColor: '#00f0ff', timestamp: Date.now() - 180000, text: '[HQ-Pinnwand #testkanal] Bitte die aktuelle Absprache hier im Blick behalten.' },
    { id: 'qa-2', senderName: 'Mod Beta', senderColor: '#ff7f00', timestamp: Date.now() - 120000, text: '[Twitch #testkanal · Zuschauer] Eine längere Frage zum aktuellen Ablauf und zur Moderation im Stream.\nIch kümmere mich darum und melde mich gleich zurück.' },
    { id: 'qa-3', senderName: 'Mod Alpha', senderColor: '#00f0ff', timestamp: Date.now() - 60000, text: '[Antwort auf @Mod Beta] Ich kümmere mich darum\nDanke, bitte auch den zweiten Kanal prüfen.' },
    { id: 'qa-4', senderName: 'Mod Beta', senderColor: '#ff7f00', timestamp: Date.now(), text: 'Status für das Team: Alle Funktionen im schmalen Dashboard müssen weiterhin erreichbar bleiben.' }
  ];
  ipcMain.handle('modchat:get-messages', () => ({ success: true, messages }));
  ipcMain.handle('twitch:get-user-info', () => ({ success: true, user: null }));
  const win = new BrowserWindow({
    width: 1320, height: 900, show: false,
    webPreferences: { preload: path.join(root, 'src/main/preload.js'), contextIsolation: true, sandbox: true, offscreen: true }
  });
  await win.loadFile(path.join(root, 'src/renderer/index.html'));
  stage('loaded');
  await new Promise(resolve => setTimeout(resolve, 500));
  const evaluate = script => win.webContents.executeJavaScript(script, true);
  await evaluate(`(() => {
    document.documentElement.classList.remove('swg-starting');
    document.body.classList.add('swg-glass');
    document.querySelectorAll('.hub-view-pane').forEach(pane => pane.classList.add('hidden'));
    document.getElementById('view-custom-dashboard').classList.remove('hidden');
    currentActiveView = 'view-custom-dashboard';
    setCustomDashboardLocked(false);
    const left = makeDashboardPanel({ id: 'widget-setup', collapsed: false });
    left.tabs.push({ id: 'widget-quickactions', collapsed: false });
    const right = makeDashboardPanel({ id: 'widget-modchat', collapsed: false });
    saveCustomDashboardLayout({ version: CUSTOM_DASHBOARD_LAYOUT_VERSION, root: makeDashboardSplit('row', left, right, 0.32) });
    renderCustomDashboard();
  })()`);
  await evaluate('loadModChatMessages()');
  stage('rendered');
  const viewMode = await evaluate(`(() => {
    setCustomDashboardLocked(true);
    const grid = document.getElementById('custom-dashboard-grid');
    dashboardUndoStack.push({layout:createDefaultDashboardLayout(),label:'QA'});
    updateDashboardUndoUI();
    const before = localStorage.getItem(CUSTOM_DASHBOARD_STORAGE_KEY);
    undoDashboardLayout();
    document.dispatchEvent(new KeyboardEvent('keydown', {key:'z',ctrlKey:true,bubbles:true}));
    return { locked:isCustomDashboardLocked(), label:document.getElementById('btn-custom-dashboard-lock').textContent.trim(), addHidden:document.getElementById('btn-custom-dashboard-add-widget').classList.contains('hidden'), resetHidden:document.getElementById('btn-custom-dashboard-reset-layout').classList.contains('hidden'), undoHidden:document.getElementById('custom-dashboard-undo-bar').classList.contains('hidden'), undoPreserved:dashboardUndoStack.length>0 && before===localStorage.getItem(CUSTOM_DASHBOARD_STORAGE_KEY), jumpRemoved:!document.getElementById('custom-dashboard-jump-nav'), removeHidden:grid.querySelector('.btn-widget-remove').classList.contains('hidden'), moveHidden:grid.querySelector('.btn-widget-move').classList.contains('hidden'), fullAvailable:!grid.querySelector('.btn-widget-open-full').disabled };
  })()`);
  assert.ok(viewMode.locked && viewMode.label.includes('Layout anpassen') && viewMode.addHidden && viewMode.resetHidden && viewMode.undoHidden && viewMode.undoPreserved && viewMode.jumpRemoved && viewMode.removeHidden && viewMode.moveHidden && viewMode.fullAvailable, 'view mode hides and blocks edits; jump control is gone');
  await new Promise(resolve => setTimeout(resolve, 130));
  fs.writeFileSync(path.join(output, 'view-mode.png'), (await win.webContents.capturePage()).toPNG());
  await evaluate('setCustomDashboardLocked(false)');
  const inspect = async name => {
    await new Promise(resolve => setTimeout(resolve, 300));
    const metrics = await evaluate(`(() => {
      const rect = selector => { const el = document.querySelector(selector); if (!el) return null; const r = el.getBoundingClientRect(); return { x:r.x, y:r.y, width:r.width, height:r.height, scrollHeight:el.scrollHeight, clientHeight:el.clientHeight, scrollWidth:el.scrollWidth, clientWidth:el.clientWidth }; };
      const modGrid = document.querySelector('#view-modchat .modhq-grid-container');
      return { view:rect('#view-custom-dashboard'), grid:rect('#custom-dashboard-grid'), left:rect('.dashboard-panel'), leftBody:rect('.dashboard-panel .custom-widget-body'), setup:rect('#view-setup'), setupLayout:rect('#view-setup .glass-setup-layout'), setupEditor:rect('#view-setup .glass-setup-editor'), setupCompanion:rect('#view-setup .glass-setup-companion'), right:rect('.split-pane-second .dashboard-panel'), bodyOverflow:getComputedStyle(document.querySelector('.dashboard-panel .custom-widget-body')).overflowY, setupColumns:getComputedStyle(document.querySelector('#view-setup .glass-setup-layout')).gridTemplateColumns, modColumns:modGrid ? getComputedStyle(modGrid).gridTemplateColumns : null, modGrid:rect('#view-modchat .modhq-grid-container'), modMessages:document.querySelectorAll('#view-modchat .mod-chat-msg-row').length, modRows:[...document.querySelectorAll('#view-modchat .mod-chat-msg-row')].map(el => { const r = el.getBoundingClientRect(); return { x:r.x, right:r.right, width:r.width }; }) };
    })()`);
    fs.writeFileSync(path.join(output, name + '.json'), JSON.stringify(metrics, null, 2));
    fs.writeFileSync(path.join(output, name + '.png'), (await win.webContents.capturePage()).toPNG());
    return metrics;
  };
  const wide = await inspect('wide');
  assert.ok(wide.view.scrollHeight > wide.view.clientHeight + 300, 'wide dashboard page scrolls');
  assert.ok(wide.leftBody.scrollHeight <= wide.leftBody.clientHeight + 2, 'setup panel does not require internal scroll');
  assert.ok(wide.leftBody.scrollWidth <= wide.leftBody.clientWidth + 2, 'setup panel fits horizontally');
  assert.ok(wide.setupEditor.x + wide.setupEditor.width <= wide.setupLayout.x + wide.setupLayout.width + 2, 'setup editor stays inside panel');
  assert.equal(wide.bodyOverflow, 'visible', 'dashboard panel body uses page flow');
  assert.ok(wide.modColumns.split(' ').length === 1, 'chat follows panel width');
  assert.equal(wide.modMessages, messages.length, 'populated chat renders every message');
  assert.ok(wide.modRows.every(row => row.x >= wide.modGrid.x - 2 && row.right <= wide.modGrid.x + wide.modGrid.width + 2), 'chat messages fit panel width');
  const pageScroll = await evaluate(`(() => { const view = document.getElementById('view-custom-dashboard'); view.scrollTop = 500; return view.scrollTop; })()`);
  assert.ok(pageScroll > 300, 'whole dashboard page scrolls to lower content');
  await evaluate(`document.querySelector('.dashboard-panel-tab[data-widget-id="widget-quickactions"]').click()`);
  assert.equal(await evaluate(`document.querySelector('.dashboard-panel:first-child .custom-widget-body')?.dataset.widgetId`), 'widget-quickactions', 'tab activates its module');
  await evaluate(`document.querySelector('.dashboard-panel-tab[data-widget-id="widget-setup"]').click()`);
  assert.equal(await evaluate(`document.querySelector('.dashboard-panel:first-child .custom-widget-body')?.dataset.widgetId`), 'widget-setup', 'tab restores setup without losing it');
  const beforePerson = await evaluate(`document.getElementById('view-custom-dashboard').scrollHeight`);
  await evaluate(`document.getElementById('btn-inc-persons').click()`);
  await new Promise(resolve => setTimeout(resolve, 100));
  const afterPerson = await evaluate(`document.getElementById('view-custom-dashboard').scrollHeight`);
  assert.ok(afterPerson > beforePerson + 100, 'adding setup content grows the whole dashboard page');
  const horizontalDrag = await evaluate(`(() => {
    const split = document.querySelector('#custom-dashboard-grid > .dashboard-split');
    const divider = split.children[1];
    const first = split.children[0];
    const before = first.getBoundingClientRect().width;
    const x = divider.getBoundingClientRect().x + 4;
    divider.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: x }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: x + 90 }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: x + 90 }));
    return { before, after: first.getBoundingClientRect().width };
  })()`);
  assert.ok(horizontalDrag.after > horizontalDrag.before + 60, 'horizontal divider enlarges panel');
  stage('wide captured');
  win.setSize(1000, 720);
  await evaluate(`document.getElementById('view-custom-dashboard').scrollTop = 0`);
  const narrow = await inspect('narrow');
  assert.ok(narrow.right.y >= narrow.left.y + narrow.left.height, 'panels stack in narrow window');
  assert.ok(narrow.view.scrollHeight > narrow.view.clientHeight + 500, 'narrow dashboard page scrolls');
  assert.ok(narrow.view.scrollWidth <= narrow.view.clientWidth + 2, 'narrow page has no horizontal overflow');
  assert.equal(narrow.modMessages, messages.length, 'chat messages survive window resize');
  stage('narrow captured');
  const dockPreview = await evaluate(`(() => {
    const tab = document.querySelector('.dashboard-panel-tab[data-widget-id="widget-quickactions"]');
    const target = document.querySelector('.split-pane-second .dashboard-panel');
    target.scrollIntoView({block:'start'});
    const dataTransfer = new DataTransfer();
    tab.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer }));
    const rect = target.getBoundingClientRect();
    const position = { clientX: rect.right - 10, clientY: rect.top + 80 };
    target.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer, ...position }));
    const preview = target.querySelector('.dashboard-dock-preview');
    const previewVisible = target.querySelector('.dashboard-dock-overlay')?.dataset.zone === 'right' && preview?.getAttribute('aria-label') === 'Rechts andocken' && target.querySelector('.dashboard-dock-caption')?.textContent === 'Rechts andocken' && !target.querySelector('.dashboard-dock-zone');
    window.qaDrop = { target, dataTransfer, position };
    return { previewVisible };
  })()`);
  await new Promise(resolve => setTimeout(resolve, 130));
  fs.writeFileSync(path.join(output, 'dock-preview.png'), (await win.webContents.capturePage()).toPNG());
  const docked = await evaluate(`(() => {
    const {target,dataTransfer,position} = window.qaDrop;
    target.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer, ...position }));
    delete window.qaDrop;
    return { panels: document.querySelectorAll('#custom-dashboard-grid .dashboard-panel').length, quickActions: !!document.querySelector('#custom-dashboard-grid .dashboard-embedded-source-view#view-quickactions') };
  })()`);
  assert.equal(docked.panels, 3, 'edge drop creates another panel');
  assert.ok(docked.quickActions, 'docked module keeps its real features');
  assert.ok(dockPreview.previewVisible, 'drag preview names the target before drop');
  await evaluate(`(() => {
    const ids = ['widget-setup', 'widget-quickactions', 'widget-modchat', 'widget-qna', 'widget-timer'];
    let root = makeDashboardPanel({ id: ids[0], collapsed: false });
    for (const id of ids.slice(1)) root = makeDashboardSplit('column', root, makeDashboardPanel({ id, collapsed: false }), 0.5);
    saveCustomDashboardLayout({ version: CUSTOM_DASHBOARD_LAYOUT_VERSION, root });
    renderCustomDashboard();
    document.getElementById('view-custom-dashboard').scrollTop = 0;
  })()`);
  const five = await inspect('five-vertical');
  assert.equal(await evaluate(`document.querySelectorAll('#custom-dashboard-grid .dashboard-panel').length`), 5);
  assert.ok(five.view.scrollHeight > five.view.clientHeight * 2, 'five modules extend dashboard page');
  assert.ok(five.view.scrollWidth <= five.view.clientWidth + 2, 'five modules stay within page width');
  stage('five vertical captured');
  const verticalDrag = await evaluate(`(() => {
    const split = document.querySelector('#custom-dashboard-grid > .dashboard-split');
    const divider = split.children[1];
    const first = split.children[0];
    const start = first.getBoundingClientRect().height;
    const y = divider.getBoundingClientRect().y + 4;
    divider.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientY: y }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientY: y + 120 }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientY: y + 120 }));
    return { before: start, after: first.getBoundingClientRect().height };
  })()`);
  fs.writeFileSync(path.join(output, 'vertical-drag.json'), JSON.stringify(verticalDrag, null, 2));
  assert.ok(verticalDrag.after > verticalDrag.before + 100, 'vertical divider enlarges first group');
  const verticalShrink = await evaluate(`(() => {
    const split = document.querySelector('#custom-dashboard-grid > .dashboard-split');
    const divider = split.children[1];
    const first = split.children[0];
    const before = first.getBoundingClientRect().height;
    const y = divider.getBoundingClientRect().y + 4;
    divider.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientY: y }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientY: y - 240 }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientY: y - 240 }));
    first.scrollTop = 100;
    return { before, after: first.getBoundingClientRect().height, overflow: getComputedStyle(first).overflowY, scrollTop: first.scrollTop };
  })()`);
  fs.writeFileSync(path.join(output, 'vertical-shrink.json'), JSON.stringify(verticalShrink, null, 2));
  assert.ok(verticalShrink.after < verticalShrink.before - 100, 'vertical divider reduces first group');
  assert.equal(verticalShrink.overflow, 'auto', 'manually shortened content remains scrollable');
  assert.ok(verticalShrink.scrollTop > 0, 'manual resize keeps hidden content reachable');
  win.setSize(1320, 900);
  await new Promise(resolve => setTimeout(resolve, 600));
  await evaluate(`(() => {
    const ids = ['widget-setup', 'widget-quickactions', 'widget-giveaways', 'widget-qna', 'widget-polls', 'widget-timer'];
    const left = makeDashboardPanel({ id: ids[0], collapsed: false });
    left.tabs.push(...ids.slice(1).map(id => ({ id, collapsed: false })));
    const right = makeDashboardPanel({ id: 'widget-modchat', collapsed: false });
    saveCustomDashboardLayout({ version: CUSTOM_DASHBOARD_LAYOUT_VERSION, root: makeDashboardSplit('row', left, right, 0.5) });
    renderCustomDashboard();
    window.qaStableRightPanel = document.querySelector('.split-pane-second .dashboard-panel');
    const name = document.querySelector('#view-setup .input-p-name');
    if (name) name.value = 'QA erhalten';
  })()`);
  await new Promise(resolve => setTimeout(resolve, 350));
  const tabMenu = await evaluate(`(() => {
    const shell = document.querySelector('.split-pane-first .dashboard-panel');
    const button = shell.querySelector('.dashboard-tabs-more-button');
    const active = shell.querySelector('.dashboard-panel-tab.is-active');
    button.click();
    return { count:Number(button.textContent.slice(1)), wrapVisible:!button.parentElement.classList.contains('hidden'), activeVisible:!active.classList.contains('hidden'), menuVisible:!shell.querySelector('.dashboard-tabs-more-menu').classList.contains('hidden'), items:shell.querySelectorAll('.dashboard-tabs-more-menu button').length };
  })()`);
  assert.ok(tabMenu.count >= 2 && tabMenu.wrapVisible && tabMenu.activeVisible && tabMenu.menuVisible && tabMenu.items === tabMenu.count, 'overflow menu exposes hidden tabs and keeps active tab visible');
  await new Promise(resolve => setTimeout(resolve, 130));
  fs.writeFileSync(path.join(output, 'all-tabs.png'), (await win.webContents.capturePage()).toPNG());
  const tabMetrics = [];
  for (const id of ['widget-setup', 'widget-quickactions', 'widget-giveaways', 'widget-qna', 'widget-polls', 'widget-timer', 'widget-setup']) {
    const result = await evaluate(`(() => {
      document.querySelector('.split-pane-first .dashboard-panel-tab[data-widget-id="${id}"]').click();
      const left = document.querySelector('.split-pane-first .dashboard-panel');
      const right = document.querySelector('.split-pane-second .dashboard-panel');
      const body = left.querySelector('.custom-widget-body');
      const source = body.querySelector('.dashboard-embedded-source-view');
      const view = document.getElementById('view-custom-dashboard');
      return { id:'${id}', windowWidth:innerWidth, viewWidth:view.clientWidth, gridWidth:document.getElementById('custom-dashboard-grid').clientWidth, leftFlex:left.parentElement.style.flex, leftWidth:left.getBoundingClientRect().width, rightX:right.getBoundingClientRect().x, rightUnchanged:right===window.qaStableRightPanel, mounted:!!source && !source.classList.contains('hidden'), bodyOverflow:body.scrollWidth-body.clientWidth, sourceOverflow:source ? source.scrollWidth-source.clientWidth : null, pageOverflow:view.scrollWidth-view.clientWidth };
    })()`);
    tabMetrics.push(result);
  }
  fs.writeFileSync(path.join(output, 'all-tabs.json'), JSON.stringify(tabMetrics, null, 2));
  assert.ok(tabMetrics.every(metric => metric.rightUnchanged && metric.mounted), 'all seven modules keep sibling panel mounted');
  assert.ok(tabMetrics.every(metric => Math.abs(metric.leftWidth - tabMetrics[0].leftWidth) < 2 && Math.abs(metric.rightX - tabMetrics[0].rightX) < 2), 'every tab keeps group widths and positions');
  assert.ok(tabMetrics.every(metric => metric.bodyOverflow <= 2 && metric.sourceOverflow <= 2 && metric.pageOverflow <= 2), 'all module tabs fit without horizontal overflow');
  assert.equal(await evaluate(`document.querySelector('#view-setup .input-p-name')?.value`), 'QA erhalten', 'unsaved setup input survives tab switches');
  stage('all tabs captured');
  win.setSize(1000, 720);
  await new Promise(resolve => setTimeout(resolve, 600));
  const narrowTabs = [];
  for (const id of ['widget-quickactions', 'widget-giveaways', 'widget-qna', 'widget-polls', 'widget-timer', 'widget-setup']) {
    narrowTabs.push(await evaluate(`(() => {
      document.querySelector('.split-pane-first .dashboard-panel-tab[data-widget-id="${id}"]').click();
      const left = document.querySelector('.split-pane-first .dashboard-panel');
      const right = document.querySelector('.split-pane-second .dashboard-panel');
      const view = document.getElementById('view-custom-dashboard');
      return { id:'${id}', leftX:left.getBoundingClientRect().x, leftWidth:left.getBoundingClientRect().width, rightX:right.getBoundingClientRect().x, rightY:right.getBoundingClientRect().y, leftBottom:left.getBoundingClientRect().bottom, rightUnchanged:right===window.qaStableRightPanel, pageOverflow:view.scrollWidth-view.clientWidth };
    })()`));
  }
  fs.writeFileSync(path.join(output, 'all-tabs-narrow.json'), JSON.stringify(narrowTabs, null, 2));
  assert.ok(narrowTabs.every(metric => metric.rightUnchanged && metric.rightY >= metric.leftBottom), 'all module tabs remain stacked in narrow window');
  assert.ok(narrowTabs.every(metric => Math.abs(metric.leftX-narrowTabs[0].leftX)<2 && Math.abs(metric.leftWidth-narrowTabs[0].leftWidth)<2 && metric.pageOverflow<=2), 'narrow tabs keep a stable full-width group');
  const undoActions = await evaluate(`(() => {
    const grid = document.getElementById('custom-dashboard-grid');
    const before = grid.querySelectorAll('.dashboard-panel-tab').length;
    grid.querySelector('.split-pane-first .btn-widget-remove').click();
    const removed = grid.querySelectorAll('.dashboard-panel-tab').length;
    document.getElementById('btn-custom-dashboard-undo').click();
    const restored = grid.querySelectorAll('.dashboard-panel-tab').length;
    document.getElementById('btn-custom-dashboard-reset-layout').click();
    const reset = grid.querySelectorAll('.dashboard-panel-tab').length;
    document.getElementById('btn-custom-dashboard-undo').click();
    const resetRestored = grid.querySelectorAll('.dashboard-panel-tab').length;
    return { before, removed, restored, reset, resetRestored, badge: document.getElementById('badge-custom-dashboard')?.textContent };
  })()`);
  assert.equal(undoActions.removed, undoActions.before - 1, 'remove changes module list');
  assert.equal(undoActions.restored, undoActions.before, 'remove can be undone');
  assert.ok(undoActions.reset < undoActions.before, 'reset changes layout');
  assert.equal(undoActions.resetRestored, undoActions.before, 'reset can be undone');
  assert.equal(undoActions.badge, '7 Module aktiv', 'dashboard tile shows actual v3 module count');
  fs.writeFileSync(path.join(output, 'undo-actions.json'), JSON.stringify(undoActions, null, 2));
  await evaluate(`(() => {
    const layout = { version:CUSTOM_DASHBOARD_LAYOUT_VERSION, root:makeDashboardSplit('row', makeDashboardPanel({id:'widget-setup',collapsed:false}), makeDashboardPanel({id:'widget-modchat',collapsed:false}), 0.5) };
    saveCustomDashboardLayout(layout);
    renderCustomDashboard();
    openAddWidgetModal();
    const item = [...document.querySelectorAll('#add-widget-catalog-list .catalog-widget-item')].find(row => row.querySelector('.catalog-widget-title')?.textContent === 'Community Q&A');
    item.open = true;
  })()`);
  await new Promise(resolve => setTimeout(resolve, 200));
  const fullPreview = await evaluate(`(() => {
    const item = [...document.querySelectorAll('#add-widget-catalog-list .catalog-widget-item')].find(row => row.querySelector('.catalog-widget-title')?.textContent === 'Community Q&A');
    const preview = item.querySelector('.catalog-full-module-preview');
    return { rendered:preview.childElementCount === 1, visible:!preview.classList.contains('hidden'), featureGalleryHidden:item.querySelector('.catalog-widget-features').classList.contains('hidden') };
  })()`);
  assert.ok(fullPreview.rendered && fullPreview.visible && fullPreview.featureGalleryHidden, 'expanded module shows its complete visual preview');
  fs.writeFileSync(path.join(output, 'full-module-preview.png'), (await win.webContents.capturePage()).toPNG());
  await evaluate(`(() => {
    const item = [...document.querySelectorAll('#add-widget-catalog-list .catalog-widget-item')].find(row => row.querySelector('.catalog-widget-title')?.textContent === 'Community Q&A');
    const compact = item.querySelector('input[value="compact"]');
    compact.checked = true;
    compact.dispatchEvent(new Event('change', {bubbles:true}));
  })()`);
  const featurePreview = await evaluate(`(() => {
    const item = [...document.querySelectorAll('#add-widget-catalog-list .catalog-widget-item')].find(row => row.querySelector('.catalog-widget-title')?.textContent === 'Community Q&A');
    const cards = [...item.querySelectorAll('.catalog-feature-card')];
    const card = cards.find(entry => entry.dataset.featureId === 'round');
    const before = card.getAttribute('aria-checked');
    card.click();
    return { count:cards.length, thumbnails:cards.filter(entry=>entry.querySelector('.catalog-feature-thumbnail')?.childElementCount).length, before, after:card.getAttribute('aria-checked'), checked:card.querySelector('input').checked, duplicateIds:document.querySelectorAll('[id="view-qna"]').length };
  })()`);
  assert.deepEqual(featurePreview, { count:3, thumbnails:3, before:'false', after:'true', checked:true, duplicateIds:1 }, 'visual module regions map directly to feature selection');
  fs.writeFileSync(path.join(output, 'feature-preview.png'), (await win.webContents.capturePage()).toPNG());
  const expandedPreview = await evaluate(`(() => {
    const item = [...document.querySelectorAll('#add-widget-catalog-list .catalog-widget-item')].find(row => row.querySelector('.catalog-widget-title')?.textContent === 'Community Q&A');
    const button = item.querySelector('.catalog-feature-expand');
    button.click();
    return { expanded:button.getAttribute('aria-expanded'), height:item.querySelector('.catalog-feature-thumbnail').getBoundingClientRect().height };
  })()`);
  assert.ok(expandedPreview.expanded === 'true' && expandedPreview.height > 200, 'full-size feature preview can be opened');
  const allPreviews = await evaluate(`(async () => {
    const items = [...document.querySelectorAll('#add-widget-catalog-list .catalog-widget-item')];
    const result = [];
    for (const item of items) {
      item.open = true;
      await new Promise(resolve => setTimeout(resolve, 0));
      const cards = [...item.querySelectorAll('.catalog-feature-card')];
      result.push({ title:item.querySelector('.catalog-widget-title').textContent, total:cards.length, rendered:cards.filter(card=>card.querySelector('.catalog-feature-thumbnail')?.childElementCount).length });
    }
    return result;
  })()`);
  fs.writeFileSync(path.join(output, 'feature-previews.json'), JSON.stringify(allPreviews, null, 2));
  assert.ok(allPreviews.every(item => item.total === item.rendered), 'every selectable module area has a visual preview');
  await evaluate(`closeAddWidgetModal()`);
  assert.equal(await evaluate(`document.querySelectorAll('#add-widget-catalog-list .catalog-feature-thumbnail > *').length`), 0, 'closing picker removes cloned previews');
  const placement = await evaluate(`(() => {
    const layout = { version:CUSTOM_DASHBOARD_LAYOUT_VERSION, root:makeDashboardSplit('row', makeDashboardPanel({id:'widget-setup',collapsed:false}), makeDashboardPanel({id:'widget-modchat',collapsed:false}), 0.5) };
    saveCustomDashboardLayout(layout);
    renderCustomDashboard();
    const firstId = layout.root.first.id;
    openAddWidgetModal();
    const item = [...document.querySelectorAll('#add-widget-catalog-list .catalog-widget-item')].find(row => row.querySelector('.catalog-widget-title')?.textContent === 'Community Q&A');
    const mode = item.querySelector('.catalog-widget-placement-mode');
    mode.value = 'center';
    mode.dispatchEvent(new Event('change', {bubbles:true}));
    item.querySelector('.catalog-widget-placement-target select').value = firstId;
    item.querySelector('.catalog-widget-save').click();
    const afterAdd = document.querySelectorAll('#custom-dashboard-grid .dashboard-panel').length;
    const firstTabs = document.querySelector('.split-pane-first .dashboard-panel').querySelectorAll('.dashboard-panel-tab').length;
    document.querySelector('.split-pane-first .btn-widget-move').click();
    const moveOpen = !document.getElementById('modal-move-dashboard-widget').classList.contains('hidden');
    document.getElementById('dashboard-move-zone').value = 'end';
    document.getElementById('btn-confirm-move-dashboard-widget').click();
    const afterMove = document.querySelectorAll('#custom-dashboard-grid .dashboard-panel').length;
    document.getElementById('btn-custom-dashboard-undo').click();
    const afterMoveUndo = document.querySelectorAll('#custom-dashboard-grid .dashboard-panel').length;
    return { afterAdd, firstTabs, moveOpen, afterMove, afterMoveUndo };
  })()`);
  fs.writeFileSync(path.join(output, 'placement.json'), JSON.stringify(placement, null, 2));
  assert.equal(placement.afterAdd, 2, 'selected placement adds Q&A as a tab in existing group');
  assert.equal(placement.firstTabs, 2, 'new module joins chosen tab group');
  assert.ok(placement.moveOpen && placement.afterMove === 3, 'move dialog places a tab into a new row without dragging');
  assert.equal(placement.afterMoveUndo, 2, 'move can be undone');
  const featureMatrix = await evaluate(`(() => {
    const results = [];
    for (const catalog of CUSTOM_DASHBOARD_CATALOG) {
      for (const feature of catalog.features) {
        saveCustomDashboardLayout({version:CUSTOM_DASHBOARD_LAYOUT_VERSION,root:makeDashboardPanel({id:catalog.id,features:[feature.id],collapsed:false})});
        renderCustomDashboard();
        const view = document.getElementById(catalog.sourceView);
        const matches = [...view.querySelectorAll(feature.selector)];
        const otherHidden = catalog.features.filter(other=>other.id!==feature.id).every(other=>[...view.querySelectorAll(other.selector)].every(element=>element.classList.contains('dashboard-source-feature-hidden')));
        results.push({module:catalog.id,feature:feature.id,matched:matches.length,visible:matches.some(element=>element.getClientRects().length>0),otherHidden});
      }
    }
    return results;
  })()`);
  fs.writeFileSync(path.join(output, 'feature-matrix.json'), JSON.stringify(featureMatrix, null, 2));
  assert.ok(featureMatrix.every(row=>row.matched>0 && row.visible && row.otherHidden), 'every selectable area is visible alone and hides unrelated areas');
  const dependentViews = await evaluate(`(() => {
    const mount = (id,feature) => {
      saveCustomDashboardLayout({version:CUSTOM_DASHBOARD_LAYOUT_VERSION,root:makeDashboardPanel({id,features:[feature],collapsed:false})});
      renderCustomDashboard();
    };
    mount('widget-quickactions','library');
    const library = !document.querySelector('#sa-library-1').hidden && document.querySelector('#sa-library-0').hidden;
    mount('widget-giveaways','fulfillment');
    const addresses = document.querySelector('#giveaway-workspace-addresses').classList.contains('active') && document.querySelector('.giveaway-workspace-tabs').classList.contains('dashboard-source-feature-hidden');
    mount('widget-polls','prediction-manage');
    const prediction = {active:!document.querySelector('#panel-mode-predictions').classList.contains('hidden'),cards:[...document.querySelectorAll('#panel-mode-predictions .poll-presets-card, #panel-mode-predictions .poll-creator-card, #panel-mode-predictions .poll-saved-templates-card')].map(card=>card.getClientRects().length>0),navHidden:document.querySelector('.polls-full-switcher-container').classList.contains('dashboard-source-feature-hidden')};
    mount('widget-timer','analytics');
    const analytics = {active:!document.querySelector('#panel-stats-analytics').classList.contains('hidden'),overlayHidden:document.querySelector('#btn-open-timer-overlays').closest('.sub-header-actions').classList.contains('dashboard-source-feature-hidden')};
    return {library,addresses,prediction,analytics};
  })()`);
  fs.writeFileSync(path.join(output, 'dependent-views.json'), JSON.stringify(dependentViews, null, 2));
  assert.ok(dependentViews.library && dependentViews.addresses && dependentViews.prediction.active && dependentViews.prediction.cards.every(Boolean) && dependentViews.prediction.navHidden && dependentViews.analytics.active && dependentViews.analytics.overlayHidden,'single selected workflows open the required content and hide irrelevant navigation');
  const legacyFeatures = await evaluate(`(() => ({
    setup:getDashboardWidgetFeatures({id:'widget-setup',features:['toolbar','persons','extras','command']},CUSTOM_DASHBOARD_CATALOG[0]),
    quick:getDashboardWidgetFeatures({id:'widget-quickactions',features:['favorites','commands']},CUSTOM_DASHBOARD_CATALOG[1]),
    giveaway:getDashboardWidgetFeatures({id:'widget-giveaways',features:['winner','participants','addresses']},CUSTOM_DASHBOARD_CATALOG[3]),
    qna:getDashboardWidgetFeatures({id:'widget-qna',features:['tools']},CUSTOM_DASHBOARD_CATALOG[4]),
    polls:getDashboardWidgetFeatures({id:'widget-polls',features:['poll-presets','poll-create','prediction-saved']},CUSTOM_DASHBOARD_CATALOG[5]),
    timer:getDashboardWidgetFeatures({id:'widget-timer',features:['overlay']},CUSTOM_DASHBOARD_CATALOG[6])
  }))()`);
  assert.deepEqual(legacyFeatures, {setup:['setup'],quick:['library'],giveaway:['live','fulfillment'],qna:['inbox'],polls:['poll-manage','prediction-manage'],timer:['timer']}, 'saved feature choices migrate to useful groups');
  const tabDropPreview = await evaluate(`(() => {
    const left = makeDashboardPanel({id:'widget-modchat',collapsed:false});
    const right = makeDashboardPanel({id:'widget-timer',collapsed:false});
    saveCustomDashboardLayout({version:CUSTOM_DASHBOARD_LAYOUT_VERSION,root:makeDashboardSplit('row',left,right,0.5)});
    renderCustomDashboard();
    document.getElementById('view-custom-dashboard').scrollTop = 0;
    const source = document.querySelector('.dashboard-panel-tab[data-widget-id="widget-timer"]');
    const target = document.querySelector('.dashboard-panel-tab[data-widget-id="widget-modchat"]');
    target.scrollIntoView({block:'start'});
    const dataTransfer = new DataTransfer();
    source.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer}));
    const rect = target.getBoundingClientRect();
    const position = {clientX:rect.right-8,clientY:rect.top+rect.height/2};
    target.dispatchEvent(new DragEvent('dragover',{bubbles:true,dataTransfer,...position}));
    window.qaTabDrop = {target,dataTransfer,position};
    return {zone:dashboardDropTarget?.zone,tabIndex:dashboardDropTarget?.tabIndex,slot:target.parentElement.querySelector('.dashboard-tab-drop-slot')?.textContent,bodyPreview:target.closest('.dashboard-panel').classList.contains('is-drop-target')};
  })()`);
  assert.deepEqual(tabDropPreview,{zone:'center',tabIndex:1,slot:'+ Als Tab',bodyPreview:false},'dragging beside a tab shows a tab insertion slot');
  await new Promise(resolve => setTimeout(resolve, 150));
  fs.writeFileSync(path.join(output, 'tab-drop-preview.png'), (await win.webContents.capturePage()).toPNG());
  const tabDrop = await evaluate(`(() => {
    const {target,dataTransfer,position} = window.qaTabDrop;
    target.dispatchEvent(new DragEvent('drop',{bubbles:true,dataTransfer,...position}));
    delete window.qaTabDrop;
    return {panels:document.querySelectorAll('#custom-dashboard-grid .dashboard-panel').length,tabs:[...document.querySelectorAll('.dashboard-panel-tab')].map(tab=>tab.dataset.widgetId)};
  })()`);
  assert.deepEqual(tabDrop,{panels:1,tabs:['widget-modchat','widget-timer']},'dropping beside a tab joins its group at the chosen position');
  const reordered = await evaluate(`(() => {
    const source = document.querySelector('.dashboard-panel-tab[data-widget-id="widget-timer"]');
    const target = document.querySelector('.dashboard-panel-tab[data-widget-id="widget-modchat"]');
    const dataTransfer = new DataTransfer();
    source.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer}));
    const rect = target.getBoundingClientRect();
    const position = {clientX:rect.left+8,clientY:rect.top+rect.height/2};
    target.dispatchEvent(new DragEvent('dragover',{bubbles:true,dataTransfer,...position}));
    target.dispatchEvent(new DragEvent('drop',{bubbles:true,dataTransfer,...position}));
    return [...document.querySelectorAll('.dashboard-panel-tab')].map(tab=>tab.dataset.widgetId);
  })()`);
  assert.deepEqual(reordered,['widget-timer','widget-modchat'],'tabs can be reordered within one group');
  await win.close();
  stage('done');
  app.quit();
}

run().catch(error => {
  fs.writeFileSync(path.join(output, 'error.txt'), String(error.stack || error));
  app.exit(1);
});
