// ============================================================
// Spec #3: Individuelles Mod-Dashboard (Grid, Drag & Resize)
// ============================================================

const CUSTOM_DASHBOARD_STORAGE_KEY = 'swg_custom_dashboard_config';
const CUSTOM_DASHBOARD_LOCK_KEY = 'swg_custom_dashboard_locked';
const CUSTOM_DASHBOARD_LAYOUT_VERSION = 2;

const CUSTOM_DASHBOARD_CATALOG = [
  {
    id: 'widget-setup',
    title: 'Setup-Schnellgenerator',
    icon: '💨',
    desc: 'Pfeife, Kopf, Tabak, Kohle & 1-Klick !editsetup Twitch-Chat',
    defaultColSpan: 6,
    features: [
      { id: 'identity', label: 'Person & E-Gerät' },
      { id: 'hardware', label: 'Pfeife, Kopf, HMD & Kohle' },
      { id: 'tobacco', label: 'Tabaksorten' },
      { id: 'preview', label: 'Befehlsvorschau' },
      { id: 'actions', label: 'Kopieren & an Twitch senden' }
    ],
    compactDefaults: ['hardware', 'tobacco', 'actions']
  },
  {
    id: 'widget-quickactions',
    title: 'Stream Quick-Actions & YouTube-Finder',
    icon: '⚡',
    desc: 'Befehle (!dc, !setup, !tabak), ShishaWG YouTube-Suche & Marker',
    defaultColSpan: 6,
    features: [
      { id: 'youtube', label: 'YouTube-Finder' },
      { id: 'commands', label: 'Chat-Befehle' },
      { id: 'streaminfo', label: 'Stream-Titel & Kategorie' },
      { id: 'clipping', label: 'Clip-Tool' },
      { id: 'raid', label: 'Raid-Steuerung' }
    ],
    compactDefaults: ['commands', 'streaminfo']
  },
  {
    id: 'widget-modchat',
    title: 'Mod-HQ Live-Chat',
    icon: '💬',
    desc: 'Team-Chat für Moderatoren mit 7TV-Emotes & Schnelleingabe',
    defaultColSpan: 12,
    features: [
      { id: 'messages', label: 'Nachrichtenverlauf' },
      { id: 'composer', label: 'Nachrichten schreiben & 7TV' }
    ],
    compactDefaults: ['messages']
  },
  {
    id: 'widget-giveaways',
    title: 'Giveaways & Gewinner',
    icon: '🎁',
    desc: 'Giveaway starten, Teilnehmer überwachen und Gewinner auslosen',
    defaultColSpan: 6,
    features: [
      { id: 'overview', label: 'Status & Gewinner' },
      { id: 'configuration', label: 'Gewinn & Teilnahmeart' },
      { id: 'controls', label: 'Start, Stopp & Auslosung' },
      { id: 'participants', label: 'Teilnehmerliste' }
    ],
    compactDefaults: ['overview', 'controls']
  },
  {
    id: 'widget-qna',
    title: 'Community Q&A',
    icon: '🙋',
    desc: 'Fragen der Zuschauer moderieren und beantworten',
    defaultColSpan: 6
  },
  {
    id: 'widget-polls',
    title: 'Live Twitch-Umfragen',
    icon: '🗳️',
    desc: 'Aktuelle Umfragen überwachen mit Live-Balken & Stimmen',
    defaultColSpan: 6
  },
  {
    id: 'widget-timer',
    title: 'Live Kohle- & Session-Timer',
    icon: '⏱️',
    desc: 'Laufender Kopf, Restzeit, Kohle-Wenden & Schnellstart',
    defaultColSpan: 6,
    features: [
      { id: 'status', label: 'Setup, Zeit & Kohlezähler' },
      { id: 'progress', label: 'Fortschrittsbalken' },
      { id: 'controls', label: 'Timer- und Kohle-Aktionen' }
    ],
    compactDefaults: ['status', 'controls']
  },
  {
    id: 'widget-stats',
    title: 'Stream-Statistik KPIs',
    icon: '📊',
    desc: 'Köpfe heute & getrennte Ø Rauchdauer (Kohle vs. E-Kopf)',
    defaultColSpan: 6,
    features: [
      { id: 'heads', label: 'Köpfe heute' },
      { id: 'coal', label: 'Ø Rauchdauer Kohle' },
      { id: 'electric', label: 'Ø Rauchdauer E-Kopf' },
      { id: 'details', label: 'Link zu allen Statistiken' }
    ],
    compactDefaults: ['heads', 'coal', 'electric']
  }
];

const DEFAULT_DASHBOARD_WIDGETS = [
  { id: 'widget-timer', colSpan: 6, collapsed: false },
  { id: 'widget-setup', colSpan: 6, collapsed: false },
  { id: 'widget-modchat', colSpan: 12, collapsed: false }
];

const CUSTOM_DASHBOARD_FULL_VIEWS = {
  'widget-timer': 'view-stats',
  'widget-setup': 'view-setup',
  'widget-modchat': 'view-modchat',
  'widget-giveaways': 'view-giveaways',
  'widget-quickactions': 'view-stream-actions',
  'widget-polls': 'view-polls',
  'widget-qna': 'view-qna',
  'widget-stats': 'view-stats'
};

function isCustomDashboardLocked() {
  try {
    return localStorage.getItem(CUSTOM_DASHBOARD_LOCK_KEY) === 'true';
  } catch(e) {
    return false;
  }
}

function setCustomDashboardLocked(locked) {
  try {
    localStorage.setItem(CUSTOM_DASHBOARD_LOCK_KEY, locked ? 'true' : 'false');
  } catch(e) {}
  updateDashboardLockUI();
}

function updateDashboardLockUI() {
  const locked = isCustomDashboardLocked();
  const btnLock = document.getElementById('btn-custom-dashboard-lock');
  const btnAdd = document.getElementById('btn-custom-dashboard-add-widget');
  const btnReset = document.getElementById('btn-custom-dashboard-reset-layout');
  const grid = document.getElementById('custom-dashboard-grid');
  const layoutHint = document.getElementById('custom-dashboard-layout-hint');

  if (btnLock) {
    if (locked) {
      btnLock.innerHTML = '🔒 Layout fixiert (Gesperrt)';
      btnLock.classList.add('is-locked');
      btnLock.title = 'Klicken zum Entsperren (Verschieben & Ändern erlauben)';
    } else {
      btnLock.innerHTML = '🔓 Layout entsperrt';
      btnLock.classList.remove('is-locked');
      btnLock.title = 'Klicken zum Sperren (Verschieben & Ändern verhindern)';
    }
  }

  if (grid) {
    if (locked) grid.classList.add('is-locked');
    else grid.classList.remove('is-locked');
  }

  if (layoutHint) layoutHint.classList.toggle('hidden', locked);

  [btnAdd, btnReset].forEach(button => {
    if (!button) return;
    button.disabled = locked;
    button.setAttribute('aria-disabled', String(locked));
  });

  document.querySelectorAll('.custom-widget-card').forEach(card => {
    card.setAttribute('draggable', locked ? 'false' : 'true');
    const handle = card.querySelector('.widget-drag-handle');
    if (handle) handle.setAttribute('draggable', locked ? 'false' : 'true');
  });
  document.querySelectorAll('.dashboard-panel-tab').forEach(tab => {
    tab.setAttribute('draggable', locked ? 'false' : 'true');
  });
  document.querySelectorAll('.btn-widget-remove').forEach(button => {
    button.disabled = locked;
    button.setAttribute('aria-disabled', String(locked));
    button.title = locked ? 'Layout entsperren, um das Modul zu entfernen' : 'Modul entfernen';
  });
}

function getCustomDashboardConfig() {
  try {
    const raw = localStorage.getItem(CUSTOM_DASHBOARD_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && Array.isArray(parsed.widgets)) return parsed.widgets;
      if (parsed && parsed.version === 2 && Object.prototype.hasOwnProperty.call(parsed, 'root')) {
        const widgets = [];
        const visit = node => {
          if (!node) return;
          if (node.type === 'panel') (node.tabs || []).forEach(widget => widgets.push(widget));
          else if (node.type === 'split') { visit(node.first); visit(node.second); }
        };
        visit(parsed.root);
        return widgets;
      }
    }
  } catch (e) {
    console.warn('Failed to load custom dashboard config from localStorage:', e);
  }
  return JSON.parse(JSON.stringify(DEFAULT_DASHBOARD_WIDGETS));
}

function saveCustomDashboardConfig(widgets) {
  try {
    localStorage.setItem(CUSTOM_DASHBOARD_STORAGE_KEY, JSON.stringify(widgets));
  } catch (e) {
    console.warn('Failed to save custom dashboard config to localStorage:', e);
  }
  renderCustomDashboardTile();
}

function renderCustomDashboardTile() {
  const card = document.getElementById('card-custom-dashboard');
  if (!card) return;

  const iconEl = document.getElementById('icon-custom-dashboard');
  const badgeEl = document.getElementById('badge-custom-dashboard');
  const titleEl = document.getElementById('title-custom-dashboard');
  const descEl = document.getElementById('desc-custom-dashboard');
  const actionEl = document.getElementById('action-custom-dashboard');

  const widgets = getCustomDashboardConfig();

  if (!widgets || widgets.length === 0) {
    card.classList.add('empty');
    if (iconEl) iconEl.textContent = '➕';
    if (badgeEl) {
      badgeEl.className = 'tile-badge ready';
      badgeEl.textContent = 'Neu gestalten';
    }
    if (titleEl) titleEl.textContent = 'Mein Mod-Dashboard';
    if (descEl) descEl.textContent = 'Klicke hier, um dir dein persönliches Cockpit aus Kacheln zusammenzustellen.';
    if (actionEl) actionEl.textContent = '➕ Cockpit erstellen ➔';
  } else {
    card.classList.remove('empty');
    if (iconEl) iconEl.textContent = '✨';
    if (badgeEl) {
      badgeEl.className = 'tile-badge ready';
      badgeEl.textContent = `${widgets.length} Module aktiv`;
    }
    if (titleEl) titleEl.textContent = 'Mein Mod-Dashboard';
    if (descEl) descEl.textContent = 'Dein persönliches Cockpit mit frei anordenbaren Widgets.';
    if (actionEl) actionEl.textContent = 'Tool öffnen ➔';
  }
}

let draggedWidgetId = null;
let dashboardDropTarget = null;

function makeDashboardPanel(widget) {
  return {
    type: 'panel',
    id: `panel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tabs: [widget],
    activeId: widget.id
  };
}

function makeDashboardSplit(direction, first, second, ratio = 0.5) {
  return {
    type: 'split',
    id: `split-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    direction,
    ratio: Math.max(0.2, Math.min(0.8, Number(ratio) || 0.5)),
    first,
    second
  };
}

function createDefaultDashboardLayout() {
  const timer = makeDashboardPanel({ id: 'widget-timer', collapsed: false });
  const setup = makeDashboardPanel({ id: 'widget-setup', collapsed: false });
  const chat = makeDashboardPanel({ id: 'widget-modchat', collapsed: false });
  return {
    version: CUSTOM_DASHBOARD_LAYOUT_VERSION,
    root: makeDashboardSplit('column', makeDashboardSplit('row', timer, setup, 0.5), chat, 0.47)
  };
}

function dashboardLayoutFromLegacy(widgets) {
  const safeWidgets = (Array.isArray(widgets) ? widgets : []).filter(w => CUSTOM_DASHBOARD_CATALOG.some(c => c.id === w.id));
  if (!safeWidgets.length) return { version: CUSTOM_DASHBOARD_LAYOUT_VERSION, root: null };
  let root = makeDashboardPanel({ ...safeWidgets[0] });
  for (let i = 1; i < safeWidgets.length; i += 1) {
    const next = makeDashboardPanel({ ...safeWidgets[i] });
    const direction = i === safeWidgets.length - 1 && safeWidgets[i].colSpan >= 10 ? 'column' : 'row';
    root = makeDashboardSplit(direction, root, next, direction === 'row' ? 0.5 : 0.55);
  }
  return { version: CUSTOM_DASHBOARD_LAYOUT_VERSION, root };
}

function getCustomDashboardLayout() {
  try {
    const raw = localStorage.getItem(CUSTOM_DASHBOARD_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.version === CUSTOM_DASHBOARD_LAYOUT_VERSION && Object.prototype.hasOwnProperty.call(parsed, 'root')) return parsed;
      if (Array.isArray(parsed)) return dashboardLayoutFromLegacy(parsed);
      if (parsed && Array.isArray(parsed.widgets)) return dashboardLayoutFromLegacy(parsed.widgets);
    }
  } catch (e) {
    console.warn('Failed to load dashboard layout:', e);
  }
  return createDefaultDashboardLayout();
}

function flattenDashboardWidgets(node, result = []) {
  if (!node) return result;
  if (node.type === 'panel') {
    (node.tabs || []).forEach(widget => result.push(widget));
  } else if (node.type === 'split') {
    flattenDashboardWidgets(node.first, result);
    flattenDashboardWidgets(node.second, result);
  }
  return result;
}

function updateCustomDashboardWidget(widgetId, updates) {
  const layout = getCustomDashboardLayout();
  const widget = flattenDashboardWidgets(layout.root).find(item => item.id === widgetId);
  if (!widget) return false;
  Object.assign(widget, updates);
  saveCustomDashboardLayout(layout);
  return true;
}

function getDashboardWidgetFeatures(widgetConfig, catalogItem) {
  if (!Array.isArray(widgetConfig?.features)) return null;
  const allowed = new Set((catalogItem?.features || []).map(feature => feature.id));
  return widgetConfig.features.filter(featureId => allowed.has(featureId));
}

function applyDashboardFeatureSelection(widgetConfig, container) {
  const catalogItem = CUSTOM_DASHBOARD_CATALOG.find(item => item.id === widgetConfig?.id);
  const selected = getDashboardWidgetFeatures(widgetConfig, catalogItem);
  if (!selected) return;
  const enabled = new Set(selected);
  container.querySelectorAll('[data-dashboard-feature]').forEach(element => {
    const featureIds = String(element.dataset.dashboardFeature || '').split(/\s+/).filter(Boolean);
    element.classList.toggle('dashboard-feature-hidden', featureIds.length > 0 && !featureIds.some(featureId => enabled.has(featureId)));
  });
}

function saveCustomDashboardLayout(layout) {
  try {
    localStorage.setItem(CUSTOM_DASHBOARD_STORAGE_KEY, JSON.stringify(layout));
  } catch (e) {
    console.warn('Failed to save dashboard layout:', e);
  }
  renderCustomDashboardTile();
}

function findDashboardPanel(node, panelId) {
  if (!node) return null;
  if (node.type === 'panel') return node.id === panelId ? node : null;
  return findDashboardPanel(node.first, panelId) || findDashboardPanel(node.second, panelId);
}

function replaceDashboardNode(node, nodeId, replacement) {
  if (!node) return node;
  if (node.id === nodeId) return replacement;
  if (node.type === 'split') {
    node.first = replaceDashboardNode(node.first, nodeId, replacement);
    node.second = replaceDashboardNode(node.second, nodeId, replacement);
  }
  return node;
}

function removeDashboardWidget(node, widgetId) {
  if (!node) return null;
  if (node.type === 'panel') {
    node.tabs = (node.tabs || []).filter(tab => tab.id !== widgetId);
    if (!node.tabs.length) return null;
    if (!node.tabs.some(tab => tab.id === node.activeId)) node.activeId = node.tabs[0].id;
    return node;
  }
  node.first = removeDashboardWidget(node.first, widgetId);
  node.second = removeDashboardWidget(node.second, widgetId);
  if (!node.first) return node.second;
  if (!node.second) return node.first;
  return node;
}

function isDashboardNodeCollapsed(node) {
  if (!node) return true;
  if (node.type === 'panel') {
    const tabs = node.tabs || [];
    const active = tabs.find(tab => tab.id === node.activeId) || tabs[0];
    return Boolean(active?.collapsed);
  }
  return isDashboardNodeCollapsed(node.first) && isDashboardNodeCollapsed(node.second);
}

function getDashboardCollapsedHeight(node) {
  if (!node || !isDashboardNodeCollapsed(node)) return 0;
  if (node.type === 'panel') return 45;
  if (node.direction === 'column') {
    return getDashboardCollapsedHeight(node.first) + getDashboardCollapsedHeight(node.second) + 9;
  }
  return Math.max(getDashboardCollapsedHeight(node.first), getDashboardCollapsedHeight(node.second));
}

function clearDashboardDropState() {
  dashboardDropTarget = null;
  document.querySelectorAll('.dashboard-dock-zone.is-active').forEach(zone => zone.classList.remove('is-active'));
  document.querySelectorAll('.dashboard-panel.is-drop-target').forEach(panel => panel.classList.remove('is-drop-target'));
}

function dockDashboardWidget(layout, widgetId, targetPanelId, zone) {
  const widget = flattenDashboardWidgets(layout.root).find(item => item.id === widgetId);
  if (!widget) return false;
  const targetBeforeRemoval = findDashboardPanel(layout.root, targetPanelId);
  if (!targetBeforeRemoval || (targetBeforeRemoval.tabs || []).some(tab => tab.id === widgetId) && zone === 'center') return false;

  layout.root = removeDashboardWidget(layout.root, widgetId);
  const targetPanel = findDashboardPanel(layout.root, targetPanelId);
  if (!targetPanel) {
    layout.root = layout.root || makeDashboardPanel(widget);
    return true;
  }
  if (zone === 'center') {
    targetPanel.tabs.push(widget);
    targetPanel.activeId = widget.id;
    return true;
  }

  const incoming = makeDashboardPanel(widget);
  const direction = (zone === 'left' || zone === 'right') ? 'row' : 'column';
  const incomingFirst = zone === 'left' || zone === 'top';
  const split = makeDashboardSplit(direction, incomingFirst ? incoming : targetPanel, incomingFirst ? targetPanel : incoming, 0.5);
  layout.root = replaceDashboardNode(layout.root, targetPanel.id, split);
  return true;
}

function renderCustomDashboard() {
  const grid = document.getElementById('custom-dashboard-grid');
  if (!grid) return;

  grid.innerHTML = '';
  const layout = getCustomDashboardLayout();
  const locked = isCustomDashboardLocked();

  if (locked) grid.classList.add('is-locked');
  else grid.classList.remove('is-locked');

  function renderPanel(panel) {
    const shell = document.createElement('section');
    shell.className = 'dashboard-panel';
    shell.dataset.panelId = panel.id;
    const validTabs = (panel.tabs || []).filter(tab => CUSTOM_DASHBOARD_CATALOG.some(cat => cat.id === tab.id));
    if (!validTabs.length) return shell;
    if (!validTabs.some(tab => tab.id === panel.activeId)) panel.activeId = validTabs[0].id;
    const active = validTabs.find(tab => tab.id === panel.activeId) || validTabs[0];
    if (active.collapsed) shell.classList.add('is-collapsed');

    const tabbar = document.createElement('div');
    tabbar.className = 'dashboard-panel-tabs';
    validTabs.forEach(tab => {
      const catalogItem = CUSTOM_DASHBOARD_CATALOG.find(cat => cat.id === tab.id);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `dashboard-panel-tab${tab.id === active.id ? ' is-active' : ''}`;
      button.draggable = !locked;
      button.dataset.widgetId = tab.id;
      button.innerHTML = `<span class="widget-drag-handle" title="Ziehen und andocken">⠿</span><span>${catalogItem.icon}</span><span>${escapeHtml(catalogItem.title)}</span>`;
      button.addEventListener('click', () => {
        panel.activeId = tab.id;
        saveCustomDashboardLayout(layout);
        renderCustomDashboard();
      });
      button.addEventListener('dragstart', event => {
        if (locked) return event.preventDefault();
        draggedWidgetId = tab.id;
        shell.classList.add('is-dragging-source');
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', tab.id);
      });
      button.addEventListener('dragend', () => {
        draggedWidgetId = null;
        shell.classList.remove('is-dragging-source');
        clearDashboardDropState();
      });
      tabbar.appendChild(button);
    });

    const actions = document.createElement('div');
    actions.className = 'dashboard-panel-actions';
    actions.innerHTML = `<button type="button" class="btn-widget-action btn-widget-open-full" title="Vollständiges Werkzeug mit allen Funktionen öffnen">↗</button><button type="button" class="btn-widget-action btn-widget-collapse" title="${active.collapsed ? 'Inhalt anzeigen' : 'Inhalt einklappen'}">${active.collapsed ? '▣' : '—'}</button><button type="button" class="btn-widget-action btn-widget-remove" title="Modul entfernen">✕</button>`;
    tabbar.appendChild(actions);
    shell.appendChild(tabbar);

    const body = document.createElement('div');
    body.className = `custom-widget-body${active.collapsed ? ' hidden' : ''}`;
    body.dataset.widgetId = active.id;
    if (!active.collapsed) renderWidgetContent(active, body);
    shell.appendChild(body);

    const overlay = document.createElement('div');
    overlay.className = 'dashboard-dock-overlay';
    overlay.innerHTML = `
      <div class="dashboard-dock-zone zone-top" data-zone="top"><span>Oben</span></div>
      <div class="dashboard-dock-zone zone-right" data-zone="right"><span>Rechts</span></div>
      <div class="dashboard-dock-zone zone-bottom" data-zone="bottom"><span>Unten</span></div>
      <div class="dashboard-dock-zone zone-left" data-zone="left"><span>Links</span></div>
      <div class="dashboard-dock-zone zone-center" data-zone="center"><span>Als Tab</span></div>`;
    shell.appendChild(overlay);

    shell.addEventListener('dragover', event => {
      if (locked || !draggedWidgetId) return;
      event.preventDefault();
      shell.classList.add('is-drop-target');
      const rect = shell.getBoundingClientRect();
      const px = (event.clientX - rect.left) / Math.max(rect.width, 1);
      const py = (event.clientY - rect.top) / Math.max(rect.height, 1);
      let zone = 'center';
      if (px < 0.25) zone = 'left';
      else if (px > 0.75) zone = 'right';
      else if (py < 0.25) zone = 'top';
      else if (py > 0.75) zone = 'bottom';
      overlay.querySelectorAll('.dashboard-dock-zone').forEach(item => item.classList.toggle('is-active', item.dataset.zone === zone));
      dashboardDropTarget = { panelId: panel.id, zone };
    });
    shell.addEventListener('dragleave', event => {
      if (!shell.contains(event.relatedTarget)) clearDashboardDropState();
    });
    shell.addEventListener('drop', event => {
      if (locked || !draggedWidgetId || !dashboardDropTarget) return;
      event.preventDefault();
      const movedTitle = CUSTOM_DASHBOARD_CATALOG.find(cat => cat.id === draggedWidgetId)?.title || 'Modul';
      if (dockDashboardWidget(layout, draggedWidgetId, dashboardDropTarget.panelId, dashboardDropTarget.zone)) {
        saveCustomDashboardLayout(layout);
        showToast(`📍 „${movedTitle}“ neu angedockt.`, 'success');
      }
      draggedWidgetId = null;
      clearDashboardDropState();
      renderCustomDashboard();
    });

    actions.querySelector('.btn-widget-collapse').addEventListener('click', () => {
      active.collapsed = !active.collapsed;
      saveCustomDashboardLayout(layout);
      renderCustomDashboard();
    });
    actions.querySelector('.btn-widget-open-full').addEventListener('click', () => {
      const targetView = CUSTOM_DASHBOARD_FULL_VIEWS[active.id];
      if (targetView) showView(targetView);
    });
    actions.querySelector('.btn-widget-remove').addEventListener('click', () => {
      if (isCustomDashboardLocked()) {
        showToast('🔒 Layout entsperren, um ein Modul zu entfernen.', 'info');
        return;
      }
      layout.root = removeDashboardWidget(layout.root, active.id);
      saveCustomDashboardLayout(layout);
      renderCustomDashboard();
      showToast(`🗑️ „${CUSTOM_DASHBOARD_CATALOG.find(cat => cat.id === active.id)?.title || 'Modul'}“ entfernt.`, 'info');
    });
    return shell;
  }

  function renderNode(node) {
    if (!node) return null;
    if (node.type === 'panel') return renderPanel(node);
    const split = document.createElement('div');
    split.className = `dashboard-split split-${node.direction}`;
    split.dataset.splitId = node.id;
    const first = document.createElement('div');
    const second = document.createElement('div');
    first.className = 'dashboard-split-pane split-pane-first';
    second.className = 'dashboard-split-pane split-pane-second';
    const ratio = Math.max(0.2, Math.min(0.8, Number(node.ratio) || 0.5));
    const firstCollapsed = isDashboardNodeCollapsed(node.first);
    const secondCollapsed = isDashboardNodeCollapsed(node.second);
    const hasVerticalCollapse = node.direction === 'column' && (firstCollapsed || secondCollapsed);
    if (hasVerticalCollapse) {
      split.classList.add('has-collapsed-pane');
      first.style.flex = firstCollapsed ? `0 0 ${getDashboardCollapsedHeight(node.first)}px` : '1 1 0';
      second.style.flex = secondCollapsed ? `0 0 ${getDashboardCollapsedHeight(node.second)}px` : '1 1 0';
    } else {
      first.style.flexBasis = `${ratio * 100}%`;
      second.style.flexBasis = `${(1 - ratio) * 100}%`;
    }
    const firstNode = renderNode(node.first);
    const secondNode = renderNode(node.second);
    if (firstNode) first.appendChild(firstNode);
    if (secondNode) second.appendChild(secondNode);
    const divider = document.createElement('div');
    divider.className = 'dashboard-split-divider';
    divider.title = locked ? 'Layout entsperren, um Größen zu ändern' : 'Ziehen, um Bereiche zu vergrößern oder zu verkleinern';
    divider.addEventListener('mousedown', event => {
      if (isCustomDashboardLocked() || hasVerticalCollapse) return;
      event.preventDefault();
      const rect = split.getBoundingClientRect();
      split.classList.add('is-resizing');
      const move = ev => {
        const raw = node.direction === 'row' ? (ev.clientX - rect.left) / rect.width : (ev.clientY - rect.top) / rect.height;
        node.ratio = Math.max(0.2, Math.min(0.8, raw));
        first.style.flexBasis = `${node.ratio * 100}%`;
        second.style.flexBasis = `${(1 - node.ratio) * 100}%`;
      };
      const up = () => {
        split.classList.remove('is-resizing');
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
        saveCustomDashboardLayout(layout);
      };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    });
    split.append(first, divider, second);
    return split;
  }

  const renderedRoot = renderNode(layout.root);
  if (renderedRoot) grid.appendChild(renderedRoot);
  else {
    const empty = document.createElement('button');
    empty.type = 'button';
    empty.className = 'custom-widget-add-slot dashboard-empty-state';
    empty.id = 'btn-add-widget-slot';
    empty.innerHTML = '<span class="add-slot-plus">＋</span><strong>Erstes Werkzeug hinzufügen</strong><span>Stelle dir hier deine persönliche Arbeitsfläche zusammen.</span>';
    empty.addEventListener('click', openAddWidgetModal);
    grid.appendChild(empty);
  }

  updateDashboardLockUI();
}

let lastDashboardChatSig = '';

function renderDashboardModChat(messages) {
  const msgBox = document.getElementById('cw-modchat-messages');
  if (!msgBox) return;

  const msgs = Array.isArray(messages) ? messages : (Array.isArray(lastLoadedModChatMessages) ? lastLoadedModChatMessages : []);
  if (msgs.length === 0) {
    msgBox.innerHTML = '<div style="color:var(--text-muted); font-size:0.8rem; text-align:center; padding:35px 10px;">👋 Noch keine Chat-Nachrichten vorhanden. Schreibe unten die erste Nachricht!</div>';
    lastDashboardChatSig = 'empty';
    return;
  }

  const sig = msgs.map(m => `${m.id}-${m.timestamp}-${m.senderName}-${m.text}`).join('|');
  if (sig === lastDashboardChatSig) return;
  lastDashboardChatSig = sig;

  const wasScrolledToBottom = msgBox.scrollHeight - msgBox.clientHeight <= msgBox.scrollTop + 60;
  const currentMod = getActiveModInfo();
  const currentUserName = (currentMod.name || '').toLowerCase();

  const recent = msgs.slice(-40);
  let html = '';

  recent.forEach(m => {
    const isOwn = currentUserName && m.senderName && m.senderName.toLowerCase() === currentUserName;
    const timeStr = m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    const senderColor = isOwn ? (currentMod.color || m.senderColor || '#FF7F00') : (m.senderColor || '#00f0ff');
    const fallbackSvg = getInitialsAvatarSvg(m.senderName, senderColor);
    let avatarSrc = m.senderAvatar || fallbackSvg;

    const textStr = typeof m.text === 'string' ? m.text : '';
    const pinnwandMatch = textStr.match(/^\[HQ-(?:Absprache|Pinnwand) #([^\]]+)\]\s*([\s\S]*)$/i);
    const quoteMatch = textStr.match(/^\[(Twitch|YouTube) #([^·\s]+)\s*·\s*([^\]]+)\]\s*([\s\S]*)$/i);
    const replyMatch = textStr.match(/^\[Antwort auf @?([^\]]+)\]\s*([^\n]*)\n([\s\S]*)$/i);

    if (pinnwandMatch) {
      const pChan = pinnwandMatch[1];
      const pBody = pinnwandMatch[2].trim();
      const isDeleted = !pBody || pBody === '[gelöscht]' || pBody === '[keine Absprache]' || pBody === '[entfernt]';
      html += `
        <div class="cw-chat-msg-row">
          <img src="${escapeHtml(avatarSrc)}" class="cw-chat-avatar" onerror="this.onerror=null; this.src='${escapeHtml(fallbackSvg)}';">
          <div class="cw-chat-bubble cw-pinnwand-bubble">
            <div class="cw-chat-bubble-header">
              <strong style="color: #fef08a; font-size:0.75rem;">📌 Pinnwand #${escapeHtml(pChan)}</strong>
              <span class="cw-chat-time">${escapeHtml(timeStr)}</span>
            </div>
            <div class="cw-chat-text">${isDeleted ? '<em style="color:#94a3b8;">Pinnwand geleert</em>' : renderModChatMessageWithEmotes(pBody)}</div>
          </div>
        </div>
      `;
    } else if (quoteMatch) {
      const platform = quoteMatch[1];
      const qChan = quoteMatch[2];
      const chatter = quoteMatch[3];
      const rest = quoteMatch[4];
      html += `
        <div class="cw-chat-msg-row">
          <img src="${escapeHtml(avatarSrc)}" class="cw-chat-avatar" onerror="this.onerror=null; this.src='${escapeHtml(fallbackSvg)}';">
          <div class="cw-chat-bubble cw-twitch-bubble">
            <div class="cw-chat-bubble-header">
              <strong style="color: #e9d5ff; font-size:0.75rem;">🟣 ${escapeHtml(platform)} @${escapeHtml(chatter)}</strong>
              <span class="cw-chat-time">${escapeHtml(timeStr)}</span>
            </div>
            <div class="cw-chat-text">${renderModChatMessageWithEmotes(rest.trim())}</div>
          </div>
        </div>
      `;
    } else if (replyMatch) {
      const replySender = replyMatch[1].trim();
      const replyQuote = replyMatch[2].trim();
      const replyText = replyMatch[3].trim();
      html += `
        <div class="cw-chat-msg-row cw-mod-reply-row">
          <img src="${escapeHtml(avatarSrc)}" class="cw-chat-avatar" onerror="this.onerror=null; this.src='${escapeHtml(fallbackSvg)}';">
          <div class="cw-mod-reply-stack">
            <div class="cw-mod-reply-preview" title="${escapeHtml(replyQuote)}">
              <strong>@${escapeHtml(replySender)}</strong>
              <span>${renderModChatMessageWithEmotes(replyQuote)}</span>
            </div>
            <div class="cw-chat-bubble">
              <div class="cw-chat-bubble-header">
                <strong style="color: ${escapeHtml(senderColor)}; font-size:0.78rem;">${escapeHtml(m.senderName || 'Mod')}</strong>
                <span class="cw-chat-time">${escapeHtml(timeStr)}</span>
              </div>
              <div class="cw-chat-text">${replyText ? renderModChatMessageWithEmotes(replyText) : '<em>Antwort</em>'}</div>
            </div>
          </div>
        </div>
      `;
    } else {
      html += `
        <div class="cw-chat-msg-row">
          <img src="${escapeHtml(avatarSrc)}" class="cw-chat-avatar" onerror="this.onerror=null; this.src='${escapeHtml(fallbackSvg)}';">
          <div class="cw-chat-bubble">
            <div class="cw-chat-bubble-header">
              <strong style="color: ${escapeHtml(senderColor)}; font-size:0.78rem;">${escapeHtml(m.senderName || 'Mod')}</strong>
              <span class="cw-chat-time">${escapeHtml(timeStr)}</span>
            </div>
            <div class="cw-chat-text">${renderModChatMessageWithEmotes(m.text || '')}</div>
          </div>
        </div>
      `;
    }
  });

  msgBox.innerHTML = html;
  if (wasScrolledToBottom || msgs.length <= 10) {
    msgBox.scrollTop = msgBox.scrollHeight;
  }
}

async function sendDashboardModChatMessage(inputEl) {
  if (!inputEl) return;
  const text = inputEl.value.trim();
  if (!text) return;

  const modInfo = getActiveModInfo();
  const msgObj = {
    id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
    senderName: modInfo.name,
    senderAvatar: modInfo.avatar,
    senderColor: modInfo.color,
    text,
    timestamp: Date.now()
  };

  inputEl.value = '';
  if (typeof resizeChatComposer === 'function') resizeChatComposer(inputEl);
  inputEl.focus();

  try {
    const res = await ipcRenderer.invoke('modchat:send-message', msgObj);
    if (res && res.success && Array.isArray(res.messages)) {
      lastLoadedModChatMessages = res.messages;
      renderDashboardModChat(res.messages);
      if (currentActiveView === 'view-modchat') {
        renderModChatMessages(res.messages);
      }
    } else {
      showToast('Fehler beim Senden: ' + (res?.error || 'Unbekannt'), 'error');
    }
  } catch(e) {
    showToast('Fehler beim Senden: ' + e.message, 'error');
  }
}

function updateDashboardGiveawayWidget() {
  const root = document.getElementById('cw-giveaway-widget');
  if (!root || typeof giveawayState === 'undefined') return;
  const eligible = Array.from(giveawayState.participants?.values?.() || []).filter(participant => {
    return typeof isParticipantExcluded === 'function' ? !isParticipantExcluded(participant) : true;
  });
  const status = root.querySelector('#cw-giveaway-status');
  const count = root.querySelector('#cw-giveaway-count');
  const list = root.querySelector('#cw-giveaway-participants');
  const winner = root.querySelector('#cw-giveaway-winner');
  const drawButton = root.querySelector('#cw-giveaway-draw');
  const startButton = root.querySelector('#cw-giveaway-start');
  const stopButton = root.querySelector('#cw-giveaway-stop');
  if (status) {
    status.className = `cw-giveaway-status ${giveawayState.isActive ? 'is-live' : 'is-ready'}`;
    status.textContent = giveawayState.isActive ? '● Registrierung läuft' : 'Bereit';
  }
  if (count) count.textContent = String(eligible.length);
  if (list) {
    list.innerHTML = eligible.length
      ? eligible.slice(0, 18).map(participant => `<span class="cw-giveaway-person" title="${escapeHtml(participant.displayName || participant.login)}">${escapeHtml(participant.displayName || participant.login)}</span>`).join('')
      : `<span class="cw-giveaway-empty">${giveawayState.isActive ? 'Warte auf Teilnehmer …' : 'Noch keine Teilnehmer'}</span>`;
  }
  if (winner) {
    winner.innerHTML = giveawayState.currentWinner
      ? `<span>🏆 Gewinner</span><strong>@${escapeHtml(giveawayState.currentWinner.displayName || giveawayState.currentWinner.username || '')}</strong><small>${escapeHtml(giveawayState.currentWinner.prize || '')}</small>`
      : '<span>🏆 Noch kein Gewinner ausgelost</span>';
  }
  if (drawButton) drawButton.disabled = eligible.length === 0;
  if (startButton) startButton.classList.toggle('hidden', giveawayState.isActive);
  if (stopButton) stopButton.classList.toggle('hidden', !giveawayState.isActive);
}

/**
 * Redraw only the requested, currently visible dashboard widgets.
 * This keeps the dashboard tied to the same live state as the full tools
 * without rebuilding the complete dock layout or disturbing text inputs.
 */
function refreshDashboardWidgets(widgetIds) {
  if (currentActiveView !== 'view-custom-dashboard') return;
  const requested = new Set(Array.isArray(widgetIds) ? widgetIds : [widgetIds]);
  const configuredWidgets = new Map(
    flattenDashboardWidgets(getCustomDashboardLayout().root).map(widget => [widget.id, widget])
  );
  document.querySelectorAll('.custom-widget-body[data-widget-id]').forEach(container => {
    const widgetId = container.dataset.widgetId;
    if (!requested.has(widgetId) || container.classList.contains('hidden')) return;
    renderWidgetContent(configuredWidgets.get(widgetId) || widgetId, container);
  });
}

function renderWidgetContent(widgetObj, container) {
  const widgetId = typeof widgetObj === 'string' ? widgetObj : widgetObj.id;
  const wConfig = typeof widgetObj === 'object' ? widgetObj : {};

  switch (widgetId) {
    case 'widget-timer': {
      const isRunning = Boolean(statsState && statsState.isRunning);
      const headNum = statsState && statsState.activeHeadCount ? statsState.activeHeadCount : (statsState?.headCountToday || 1);
      const activeSetup = statsState && statsState.activeSetup ? statsState.activeSetup : {};
      const tobaccoName = activeSetup.tobacco || 'Kein aktiver Kopf';
      const durationStr = formatTimerClock(statsState?.sessionElapsedSeconds || 0);
      const coalsStr = isElectricSetup(activeSetup) ? 'E-Kopf' : `${statsState?.coalRotations || 0}x`;

      container.innerHTML = `
        <div class="cw-timer-summary" data-dashboard-feature="status">
          <div class="cw-timer-details">
            <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;">
              ${isRunning ? `Kopf #${headNum} (Läuft)` : 'Bereit'}
            </div>
            <div class="cw-timer-setup-name" title="${escapeHtml(tobaccoName)}">
              ${escapeHtml(tobaccoName)}
            </div>
            <div id="custom-timer-phase-label" style="font-size:0.72rem; color:#ffca28; margin-top:2px;">
              ${isRunning ? 'Phase: Läuft' : 'Timer gestoppt'}
            </div>
          </div>
          <div class="cw-timer-metrics">
            <div id="custom-timer-duration-display" class="cw-timer-duration">
              ${durationStr}
            </div>
            <div class="cw-timer-coals">
              🪵 Kohle: <strong style="color:#fff;" id="custom-timer-coals-display">${coalsStr}</strong>
            </div>
          </div>
        </div>

        <div data-dashboard-feature="progress" style="width:100%; background:rgba(255,255,255,0.06); height:5px; border-radius:4px; overflow:hidden; margin-top:6px;">
          <div id="custom-timer-progress-bar" style="height:100%; width:0%; background:linear-gradient(90deg, #ffca28, #ff8f00); transition:width 0.4s;"></div>
        </div>

        <div data-dashboard-feature="controls" style="display:flex; gap:8px; flex-wrap:wrap; margin-top:6px;">
          ${isRunning ? `
            <button type="button" class="btn btn-sm btn-secondary" id="custom-widget-btn-rotate-coals" style="flex:1; min-width:120px;">
              🔥 Kohle gewendet (+1)
            </button>
            <button type="button" class="btn btn-sm btn-primary" id="custom-widget-btn-finish-head" style="flex:1; min-width:120px; background:#4caf50; color:#fff; border:none; font-weight:700;">
              🏁 Kopf beenden
            </button>
          ` : `
            <button type="button" class="btn btn-sm btn-primary" id="custom-widget-btn-start-head" style="flex:1; min-width:140px; background:#ffca28; color:#121218; font-weight:700; border:none;">
              ▶️ Neuen Kopf starten
            </button>
          `}
        </div>
      `;

      const btnRotate = container.querySelector('#custom-widget-btn-rotate-coals');
      if (btnRotate) {
        btnRotate.addEventListener('click', () => {
          if (typeof rotateCoal === 'function') rotateCoal();
          else showToast('Kohle gewendet!', 'info');
        });
      }

      const btnFinish = container.querySelector('#custom-widget-btn-finish-head');
      if (btnFinish) {
        btnFinish.addEventListener('click', () => {
          if (typeof finishHeadSession === 'function') finishHeadSession();
          else showToast('Kopf beendet!', 'info');
        });
      }

      const btnStart = container.querySelector('#custom-widget-btn-start-head');
      if (btnStart) {
        btnStart.addEventListener('click', () => {
          const mainStartButton = document.getElementById('btn-timer-start-head');
          if (mainStartButton) mainStartButton.click();
          else if (typeof checkAndAutoStartHeadSession === 'function') checkAndAutoStartHeadSession(true);
        });
      }
      break;
    }

    case 'widget-setup': {
      if (!state.persons || !state.persons.length) {
        state.persons = [{
          name: 'Marvin',
          pipe: '',
          vessel: '',
          vesselColor: '',
          bowl: '',
          hmd: '',
          tobaccos: [''],
          tobaccoAmounts: [''],
          tobaccoUnit: 'g',
          showTobaccoAmounts: false,
          isElectric: false
        }];
        state.personCount = 1;
      }
      const p1 = state.persons[0];
      if (!p1.tobaccos || !p1.tobaccos.length) p1.tobaccos = [''];

      const isElectric = Boolean(p1.isElectric);
      const currentKohle = (inputGlobalKohle ? inputGlobalKohle.value : (state.activeSetup?.charcoal || '')) || '';

      container.innerHTML = `
        <div class="cw-setup-wrapper" style="display:flex; flex-direction:column; gap:10px;">
          <!-- Person & E-Gerät Header Row -->
          <div data-dashboard-feature="identity" style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
            <div style="flex:1; display:flex; align-items:center; gap:6px;">
              <label style="font-size:0.75rem; color:var(--text-muted); font-weight:700; white-space:nowrap;">👤 Name:</label>
              <input type="text" id="cw-setup-name" class="input-field" style="padding:4px 8px; font-size:0.82rem; flex:1;" value="${escapeHtml(p1.name || '')}" placeholder="z. B. Marvin">
            </div>
            <label class="toggle-switch checkbox-label" style="font-size:0.78rem;" title="Kennzeichnet als E-Gerät (z. B. XKAH Lite / Pro)">
              <input type="checkbox" id="cw-setup-electric" ${isElectric ? 'checked' : ''}>
              <span class="toggle-slider"></span>
              <span class="toggle-text">⚡ E-Gerät</span>
            </label>
          </div>

          <!-- Hardware Grid (Pfeife, Kopf, HMD, Kohle) -->
          <div id="cw-setup-hardware-grid" data-dashboard-feature="hardware" style="display:grid; grid-template-columns: 1fr 1fr; gap:8px;">
            <div>
              <label style="font-size:0.73rem; color:var(--text-muted); font-weight:600; display:block; margin-bottom:2px;">Pfeife</label>
              <input type="text" id="cw-setup-pipe" class="input-field" list="list-pipes" style="width:100%; padding:5px 8px; font-size:0.82rem;" value="${escapeHtml(p1.pipe || '')}" placeholder="z. B. Amotion Futr">
            </div>
            <div>
              <label id="cw-setup-bowl-label" style="font-size:0.73rem; color:var(--text-muted); font-weight:600; display:block; margin-bottom:2px;">${isElectric ? '⚡ E-Gerät / Kopf' : 'Kopf'}</label>
              <input type="text" id="cw-setup-bowl" class="input-field" list="${isElectric ? 'list-electric-bowls' : 'list-bowls'}" style="width:100%; padding:5px 8px; font-size:0.82rem;" value="${escapeHtml(p1.bowl || '')}" placeholder="${isElectric ? 'z. B. XKAH Lite / Pro' : 'z. B. Cosmo Bowl'}">
            </div>
            <div id="cw-setup-hmd-group" style="${isElectric ? 'display:none;' : ''}">
              <label style="font-size:0.73rem; color:var(--text-muted); font-weight:600; display:block; margin-bottom:2px;">HMD</label>
              <input type="text" id="cw-setup-hmd" class="input-field" list="list-hmds" style="width:100%; padding:5px 8px; font-size:0.82rem;" value="${escapeHtml(p1.hmd || '')}" placeholder="z. B. ONMO HMD">
            </div>
            <div id="cw-setup-charcoal-group" style="${isElectric ? 'display:none;' : ''}">
              <label style="font-size:0.73rem; color:var(--text-muted); font-weight:600; display:block; margin-bottom:2px;">🪵 Kohlesorte</label>
              <input type="text" id="cw-setup-charcoal" class="input-field" list="list-charcoal" style="width:100%; padding:5px 8px; font-size:0.82rem;" value="${escapeHtml(currentKohle)}" placeholder="z. B. Magic Cubes">
            </div>
          </div>

          <!-- Multi-Tobacco Section -->
          <div class="cw-setup-tobacco-section" data-dashboard-feature="tobacco" style="border-top:1px solid rgba(255,255,255,0.06); padding-top:8px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <label style="font-size:0.75rem; color:var(--text-muted); font-weight:700;">📦 Tabaksorte(n):</label>
              <button type="button" class="btn btn-xs btn-secondary" id="cw-setup-btn-add-tob" style="font-size:0.72rem; padding:2px 8px;">
                ➕ Tabak hinzufügen
              </button>
            </div>
            <div id="cw-setup-tobaccos-list" style="display:flex; flex-direction:column; gap:6px;">
              <!-- Dynamic tobacco slot rows -->
            </div>
          </div>

          <!-- Live Command Preview Box -->
          <div data-dashboard-feature="preview" style="background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:8px 10px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
              <span style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Vorschau (!editsetup)</span>
              <span id="cw-setup-char-count" style="font-size:0.7rem; font-family:'JetBrains Mono',monospace; color:var(--text-muted);">0 / 500</span>
            </div>
            <div id="cw-setup-cmd-preview" style="font-family:'JetBrains Mono',monospace; font-size:0.78rem; color:#00f0ff; word-break:break-all; max-height:48px; overflow-y:auto;">
              !editsetup ...
            </div>
          </div>

          <!-- Action Buttons Row -->
          <div data-dashboard-feature="actions" style="display:flex; gap:8px; flex-wrap:wrap;">
            <button type="button" class="btn btn-sm btn-secondary" id="cw-setup-btn-copy" style="flex:1; min-width:110px;">
              📋 Befehl kopieren
            </button>
            <button type="button" class="btn btn-sm btn-primary" id="cw-setup-btn-send" style="flex:1.2; min-width:140px; background:#ffca28; color:#121218; font-weight:700; border:none;">
              📤 In Twitch-Chat
            </button>
          </div>
        </div>
      `;

      const inputName = container.querySelector('#cw-setup-name');
      const chkElectric = container.querySelector('#cw-setup-electric');
      const inputPipe = container.querySelector('#cw-setup-pipe');
      const inputBowl = container.querySelector('#cw-setup-bowl');
      const inputHmd = container.querySelector('#cw-setup-hmd');
      const inputCharcoal = container.querySelector('#cw-setup-charcoal');
      const lblBowl = container.querySelector('#cw-setup-bowl-label');
      const grpHmd = container.querySelector('#cw-setup-hmd-group');
      const grpCharcoal = container.querySelector('#cw-setup-charcoal-group');
      const btnAddTob = container.querySelector('#cw-setup-btn-add-tob');

      const updateAll = () => {
        if (!state.activeSetup) state.activeSetup = {};
        p1.name = inputName ? inputName.value.trim() : (p1.name || 'Marvin');
        p1.pipe = inputPipe ? inputPipe.value.trim() : '';
        p1.bowl = inputBowl ? inputBowl.value.trim() : '';
        p1.isElectric = Boolean(chkElectric && chkElectric.checked);
        p1.hmd = p1.isElectric ? '' : (inputHmd ? inputHmd.value.trim() : '');

        state.activeSetup.name = p1.name;
        state.activeSetup.pipe = p1.pipe;
        state.activeSetup.bowl = p1.bowl;
        state.activeSetup.hmd = p1.hmd;
        state.activeSetup.isElectric = p1.isElectric;
        const coalVal = p1.isElectric ? '' : (inputCharcoal ? inputCharcoal.value.trim() : '');
        state.activeSetup.charcoal = coalVal;
        state.activeSetup.tobacco = (p1.tobaccos || []).filter(t => t && t.trim()).join(' und ');

        if (inputGlobalKohle && !p1.isElectric) {
          inputGlobalKohle.value = coalVal;
        }

        const cmd = (typeof generateCommandString === 'function') ? generateCommandString() : '';
        const previewEl = container.querySelector('#cw-setup-cmd-preview');
        const charCountEl = container.querySelector('#cw-setup-char-count');
        if (previewEl) previewEl.textContent = cmd || '!editsetup ...';
        if (charCountEl) {
          charCountEl.textContent = `${cmd.length} / 500`;
          charCountEl.style.color = cmd.length > 500 ? '#ef4444' : 'var(--text-muted)';
        }

        const mainP1Name = document.querySelector('.input-p-name[data-index="0"]');
        const mainP1Pipe = document.querySelector('.input-p-pipe[data-index="0"]');
        const mainP1Bowl = document.querySelector('.input-p-bowl[data-index="0"]');
        const mainP1Hmd = document.querySelector('.input-p-hmd[data-index="0"]');
        const mainP1Electric = document.querySelector('.chk-p-electric[data-index="0"]');
        if (mainP1Name && inputName) mainP1Name.value = inputName.value;
        if (mainP1Pipe && inputPipe) mainP1Pipe.value = inputPipe.value;
        if (mainP1Bowl && inputBowl) mainP1Bowl.value = inputBowl.value;
        if (mainP1Hmd && inputHmd) mainP1Hmd.value = inputHmd.value;
        if (mainP1Electric && chkElectric) mainP1Electric.checked = chkElectric.checked;
      };

      const renderTobaccoSlots = () => {
        const listEl = container.querySelector('#cw-setup-tobaccos-list');
        if (!listEl) return;
        listEl.innerHTML = '';
        const tobaccos = p1.tobaccos;

        tobaccos.forEach((tVal, tIdx) => {
          const slot = document.createElement('div');
          slot.className = 'cw-tob-slot';
          slot.style.cssText = 'display:flex; flex-direction:column; gap:2px;';

          const inputRow = document.createElement('div');
          inputRow.style.cssText = 'display:flex; gap:6px; align-items:center;';

          const input = document.createElement('input');
          input.type = 'text';
          input.className = 'input-field cw-tob-input';
          input.setAttribute('list', 'list-tobacco');
          input.style.cssText = 'flex:1; padding:5px 8px; font-size:0.82rem;';
          input.value = tVal || '';
          input.placeholder = `z. B. MustH - Pynkman (Tabak ${tIdx + 1})`;

          inputRow.appendChild(input);

          if (tobaccos.length > 1) {
            const btnRemove = document.createElement('button');
            btnRemove.type = 'button';
            btnRemove.className = 'btn-icon cw-tob-remove';
            btnRemove.style.cssText = 'color:#ef4444; width:26px; height:26px; font-size:0.8rem;';
            btnRemove.title = 'Tabak entfernen';
            btnRemove.textContent = '✕';
            btnRemove.addEventListener('click', () => {
              p1.tobaccos.splice(tIdx, 1);
              if (!p1.tobaccos.length) p1.tobaccos = [''];
              renderTobaccoSlots();
              updateAll();
            });
            inputRow.appendChild(btnRemove);
          }

          const badgeBox = document.createElement('div');
          badgeBox.className = 'cw-tob-badge-box';

          const updateSlotBadge = (val) => {
            const clean = (val || '').trim();
            if (!clean) {
              badgeBox.innerHTML = '';
              return;
            }
            const flavor = typeof findTobaccoFlavor === 'function' ? findTobaccoFlavor(clean) : null;
            const inCat = (state.catalog?.tobacco || []).some(t => {
              const tn = (typeof t === 'string' ? t : t.name || '').toLowerCase().trim();
              return tn === clean.toLowerCase() || tn.includes(clean.toLowerCase());
            });

            if (flavor) {
              badgeBox.innerHTML = `<span style="display:inline-flex; align-items:center; gap:4px; font-size:0.72rem; padding:2px 8px; border-radius:4px; font-weight:600; background:rgba(16,185,129,0.15); color:#34d399; border:1px solid rgba(16,185,129,0.35); max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="Aromen: ${escapeHtml(flavor)}">✓ DB: ${escapeHtml(flavor)}</span>`;
            } else if (inCat) {
              badgeBox.innerHTML = `<span style="display:inline-flex; align-items:center; gap:4px; font-size:0.72rem; padding:2px 8px; border-radius:4px; font-weight:600; background:rgba(16,185,129,0.15); color:#34d399; border:1px solid rgba(16,185,129,0.35);">✓ In Datenbank</span>`;
            } else {
              badgeBox.innerHTML = `<span style="display:inline-flex; align-items:center; gap:4px; font-size:0.72rem; padding:2px 8px; border-radius:4px; font-weight:600; background:rgba(255,202,40,0.12); color:#ffca28; border:1px solid rgba(255,202,40,0.3);">✨ Freitext</span>`;
            }
          };

          updateSlotBadge(tVal);

          input.addEventListener('input', () => {
            p1.tobaccos[tIdx] = input.value;
            updateSlotBadge(input.value);
            updateAll();
          });

          slot.appendChild(inputRow);
          slot.appendChild(badgeBox);
          listEl.appendChild(slot);
        });
      };

      renderTobaccoSlots();

      if (btnAddTob) {
        btnAddTob.addEventListener('click', () => {
          p1.tobaccos.push('');
          renderTobaccoSlots();
          const inputs = container.querySelectorAll('.cw-tob-input');
          const lastInput = inputs[inputs.length - 1];
          if (lastInput) lastInput.focus();
          updateAll();
        });
      }

      if (chkElectric) {
        chkElectric.addEventListener('change', () => {
          const ele = chkElectric.checked;
          p1.isElectric = ele;
          if (lblBowl) lblBowl.textContent = ele ? '⚡ E-Gerät / Kopf' : 'Kopf';
          if (inputBowl) {
            inputBowl.setAttribute('list', ele ? 'list-electric-bowls' : 'list-bowls');
            inputBowl.placeholder = ele ? 'z. B. XKAH Lite / Pro' : 'z. B. Cosmo Bowl';
          }
          if (grpHmd) grpHmd.style.display = ele ? 'none' : '';
          if (grpCharcoal) grpCharcoal.style.display = ele ? 'none' : '';
          updateAll();
        });
      }

      if (inputName) inputName.addEventListener('input', updateAll);
      if (inputPipe) inputPipe.addEventListener('input', updateAll);
      if (inputBowl) inputBowl.addEventListener('input', updateAll);
      if (inputHmd) inputHmd.addEventListener('input', updateAll);
      if (inputCharcoal) inputCharcoal.addEventListener('input', updateAll);

      updateAll();

      const btnCopy = container.querySelector('#cw-setup-btn-copy');
      if (btnCopy) {
        btnCopy.addEventListener('click', () => {
          updateAll();
          const cmd = (typeof generateCommandString === 'function') ? generateCommandString() : '';
          if (cmd && cmd.trim() !== '!editsetup') {
            navigator.clipboard.writeText(cmd).catch(() => {});
            ipcRenderer.invoke('app:copy-clipboard', cmd).then(() => {
              showToast('📋 !editsetup Befehl kopiert!', 'success');
              if (typeof triggerAutoLearn === 'function') triggerAutoLearn();
            });
          } else {
            showToast('Kein Setup zum Kopieren vorhanden', 'warning');
          }
        });
      }

      const btnSend = container.querySelector('#cw-setup-btn-send');
      if (btnSend) {
        btnSend.addEventListener('click', async () => {
          updateAll();
          const cmd = (typeof generateCommandString === 'function') ? generateCommandString() : '';
          if (!cmd || cmd.trim() === '!editsetup') {
            showToast('Kein Setup zum Senden vorhanden', 'warning');
            return;
          }

          const mainBtnSend = document.getElementById('btn-send-chat');
          if (mainBtnSend && !mainBtnSend.disabled) {
            mainBtnSend.click();
          } else {
            const chan = (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved';
            const res = await ipcRenderer.invoke('twitch:send-chat', { message: cmd, channel: chan });
            if (res && res.success) {
              showToast(`!editsetup Befehl in #${chan} gesendet!`, 'success');
              if (typeof triggerAutoLearn === 'function') triggerAutoLearn();
              if (typeof checkAndAutoStartHeadSession === 'function') checkAndAutoStartHeadSession(cmd);
            } else {
              showToast(res?.error || 'Konnte nicht an Twitch senden (Verbunden?)', 'error');
            }
          }
        });
      }

      break;
    }

    case 'widget-modchat': {
      container.innerHTML = `
        <div class="cw-modchat-container" style="position:relative;">
          <div id="cw-modchat-messages" class="cw-modchat-messages" data-dashboard-feature="messages">
            <div style="color:var(--text-muted); font-size:0.8rem; text-align:center; padding:35px 10px;">Lade Nachrichten...</div>
          </div>
          <div id="cw-modchat-7tv-popover" class="cw-modchat-7tv-popover hidden" data-dashboard-feature="composer">
            <div class="cw-modchat-7tv-header">
              <strong>7TV Emotes</strong>
              <input type="text" id="cw-modchat-7tv-search" class="input-field" placeholder="Emote suchen…" autocomplete="off">
              <button type="button" id="cw-modchat-7tv-close" class="btn-icon" title="Schließen">✕</button>
            </div>
            <div id="cw-modchat-7tv-grid" class="cw-modchat-7tv-grid">
              <div class="popover-7tv-status">Lade 7TV Emotes…</div>
            </div>
          </div>
          <div class="cw-chat-input-row" data-dashboard-feature="composer">
            <textarea id="cw-modchat-input" class="cw-chat-input" placeholder="Nachricht an Moderatoren (Enter zum Senden, Umschalt+Enter für neue Zeile)..." maxlength="300" rows="1"></textarea>
            <button type="button" class="btn btn-secondary btn-sm" id="cw-modchat-btn-emotes" title="7TV Emotes einfügen" style="padding:7px 10px;">😀</button>
            <button type="button" class="btn btn-primary btn-sm" id="cw-modchat-send" style="background:#ffca28; color:#121218; font-weight:700; border:none; padding:7px 14px;">
              Senden
            </button>
          </div>
        </div>
      `;

      const input = container.querySelector('#cw-modchat-input');
      const btnSend = container.querySelector('#cw-modchat-send');
      const btnEmotes = container.querySelector('#cw-modchat-btn-emotes');
      const emotePopover = container.querySelector('#cw-modchat-7tv-popover');
      const emoteSearch = container.querySelector('#cw-modchat-7tv-search');
      const emoteGrid = container.querySelector('#cw-modchat-7tv-grid');
      const btnCloseEmotes = container.querySelector('#cw-modchat-7tv-close');

      renderDashboardModChat(lastLoadedModChatMessages);
      loadModChatMessages(true);

      const doSend = () => sendDashboardModChatMessage(input);

      if (btnSend) btnSend.addEventListener('click', doSend);
      if (input) {
        input.addEventListener('input', () => resizeChatComposer(input));
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            doSend();
          }
        });
        resizeChatComposer(input);
      }

      const renderDashboardEmotePicker = (query = '') => {
        if (!emoteGrid) return;
        const normalized = query.trim().toLowerCase();
        const matches = normalized
          ? sevenTvEmoteList.filter(emote => emote.name.toLowerCase().includes(normalized))
          : sevenTvEmoteList;
        if (!matches.length) {
          emoteGrid.innerHTML = `<div class="popover-7tv-status">${sevenTvEmoteList.length ? 'Kein passendes Emote gefunden' : 'Keine 7TV-Emotes verfügbar'}</div>`;
          return;
        }
        emoteGrid.innerHTML = matches.slice(0, 160).map(emote => `
          <button type="button" class="cw-modchat-7tv-item" data-name="${escapeHtml(emote.name)}" title="${escapeHtml(emote.name)}">
            <img src="${escapeHtml(emote.url)}" alt="${escapeHtml(emote.name)}" loading="lazy">
            <span>${escapeHtml(emote.name)}</span>
          </button>
        `).join('');
        emoteGrid.querySelectorAll('.cw-modchat-7tv-item').forEach(item => {
          item.addEventListener('click', () => {
            const name = item.dataset.name || '';
            if (!name || !input) return;
            const separator = input.value && !input.value.endsWith(' ') ? ' ' : '';
            input.value = `${input.value}${separator}${name} `;
            resizeChatComposer(input);
            input.focus();
          });
        });
      };

      if (btnEmotes && emotePopover) {
        btnEmotes.addEventListener('click', async () => {
          if (sevenTvEmoteList.length === 0) await loadSevenTvEmotes();
          renderDashboardEmotePicker(emoteSearch?.value || '');
          emotePopover.classList.toggle('hidden');
          if (!emotePopover.classList.contains('hidden')) emoteSearch?.focus();
        });
      }
      if (btnCloseEmotes && emotePopover) btnCloseEmotes.addEventListener('click', () => emotePopover.classList.add('hidden'));
      if (emoteSearch) emoteSearch.addEventListener('input', () => renderDashboardEmotePicker(emoteSearch.value));
      break;
    }

    case 'widget-giveaways': {
      const isActive = Boolean(giveawayState?.isActive);
      container.innerHTML = `
        <div id="cw-giveaway-widget" class="cw-giveaway-widget">
          <div class="cw-giveaway-summary" data-dashboard-feature="overview">
            <span id="cw-giveaway-status" class="cw-giveaway-status ${isActive ? 'is-live' : 'is-ready'}">${isActive ? '● Registrierung läuft' : 'Bereit'}</span>
            <span><strong id="cw-giveaway-count">0</strong> Teilnehmer</span>
          </div>
          <div class="cw-giveaway-form" data-dashboard-feature="configuration">
            <input type="text" id="cw-giveaway-prize" class="input-field" value="${escapeHtml(giveawayState?.prize || inputGiveawayPrize?.value || '')}" placeholder="Gewinnpreis eingeben …" ${isActive ? 'disabled' : ''}>
            <select id="cw-giveaway-mode" class="gw-select" ${isActive ? 'disabled' : ''}>
              <option value="keyword" ${giveawayState?.mode !== 'chatters' ? 'selected' : ''}>Chat-Keyword</option>
              <option value="chatters" ${giveawayState?.mode === 'chatters' ? 'selected' : ''}>Aktive Chatter</option>
            </select>
            <input type="text" id="cw-giveaway-keyword" class="input-field" value="${escapeHtml(giveawayState?.keyword || '!join')}" placeholder="!join" ${isActive || giveawayState?.mode === 'chatters' ? 'disabled' : ''}>
          </div>
          <div class="cw-giveaway-actions" data-dashboard-feature="controls">
            <button type="button" id="cw-giveaway-start" class="btn btn-sm btn-success ${isActive ? 'hidden' : ''}">▶ Giveaway starten</button>
            <button type="button" id="cw-giveaway-stop" class="btn btn-sm btn-danger ${isActive ? '' : 'hidden'}">■ Registrierung stoppen</button>
            <button type="button" id="cw-giveaway-draw" class="btn btn-sm btn-primary">🎲 Gewinner auslosen</button>
            <button type="button" id="cw-giveaway-clear" class="btn btn-sm btn-secondary" title="Teilnehmerliste leeren">🧹 Pool leeren</button>
          </div>
          <div id="cw-giveaway-winner" class="cw-giveaway-winner" data-dashboard-feature="overview"><span>🏆 Noch kein Gewinner ausgelost</span></div>
          <div id="cw-giveaway-participants" class="cw-giveaway-participants" data-dashboard-feature="participants"></div>
        </div>
      `;

      const prize = container.querySelector('#cw-giveaway-prize');
      const mode = container.querySelector('#cw-giveaway-mode');
      const keyword = container.querySelector('#cw-giveaway-keyword');
      const start = container.querySelector('#cw-giveaway-start');
      const stop = container.querySelector('#cw-giveaway-stop');
      const draw = container.querySelector('#cw-giveaway-draw');
      const clear = container.querySelector('#cw-giveaway-clear');
      if (mode && keyword) {
        mode.addEventListener('change', () => {
          keyword.disabled = mode.value === 'chatters';
        });
      }
      if (start) start.addEventListener('click', async () => {
        if (inputGiveawayPrize) inputGiveawayPrize.value = prize?.value || '';
        if (selectGiveawayMode) selectGiveawayMode.value = mode?.value || 'keyword';
        if (inputGiveawayKeyword) inputGiveawayKeyword.value = keyword?.value || '!join';
        await startGiveawayRegistration();
        if (giveawayState.isActive) {
          if (prize) prize.disabled = true;
          if (mode) mode.disabled = true;
          if (keyword) keyword.disabled = true;
        }
        updateDashboardGiveawayWidget();
      });
      if (stop) stop.addEventListener('click', async () => {
        await stopGiveawayRegistration();
        if (prize) prize.disabled = false;
        if (mode) mode.disabled = false;
        if (keyword) keyword.disabled = mode?.value === 'chatters';
        updateDashboardGiveawayWidget();
      });
      if (draw) draw.addEventListener('click', async () => {
        await drawGiveawayWinner();
        updateDashboardGiveawayWidget();
      });
      if (clear) clear.addEventListener('click', () => {
        giveawayState.participants.clear();
        if (typeof renderParticipantsPool === 'function') renderParticipantsPool();
        updateDashboardGiveawayWidget();
        showToast('Teilnehmer-Pool geleert.', 'info');
      });
      updateDashboardGiveawayWidget();
      break;
    }

    case 'widget-quickactions': {
      const quickActionCatalog = CUSTOM_DASHBOARD_CATALOG.find(item => item.id === 'widget-quickactions');
      const selectedTools = getDashboardWidgetFeatures(wConfig, quickActionCatalog);
      const availableTools = selectedTools?.length ? selectedTools : ['youtube', 'commands', 'streaminfo', 'clipping', 'raid'];
      const activeTool = availableTools.includes(wConfig.subTool) ? wConfig.subTool : availableTools[0];

      container.innerHTML = `
        <div class="cw-qa-tabs">
          <button type="button" class="cw-qa-tab ${activeTool === 'youtube' ? 'active' : ''}" data-tool="youtube" data-dashboard-feature="youtube">🎥 YouTube-Finder</button>
          <button type="button" class="cw-qa-tab ${activeTool === 'commands' ? 'active' : ''}" data-tool="commands" data-dashboard-feature="commands">⚡ Chat-Befehle</button>
          <button type="button" class="cw-qa-tab ${activeTool === 'streaminfo' ? 'active' : ''}" data-tool="streaminfo" data-dashboard-feature="streaminfo">🎮 Stream-Titel</button>
          <button type="button" class="cw-qa-tab ${activeTool === 'clipping' ? 'active' : ''}" data-tool="clipping" data-dashboard-feature="clipping">🎬 Clip-Tool</button>
          <button type="button" class="cw-qa-tab ${activeTool === 'raid' ? 'active' : ''}" data-tool="raid" data-dashboard-feature="raid">🚀 Raid</button>
        </div>
        <div id="cw-qa-tool-content" style="flex:1;"></div>
      `;

      // Persist only the selected subtool inside the existing dock layout.
      // Saving a flattened widget list here would discard tab groups and splits.
      container.querySelectorAll('.cw-qa-tab').forEach(tabBtn => {
        tabBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const targetTool = tabBtn.getAttribute('data-tool');
          if (!updateCustomDashboardWidget('widget-quickactions', { subTool: targetTool })) return;
          wConfig.subTool = targetTool;
          renderWidgetContent(wConfig, container);
        });
      });

      const toolContent = container.querySelector('#cw-qa-tool-content');
      if (!toolContent) break;

      if (activeTool === 'youtube') {
        toolContent.innerHTML = `
          <div class="cw-yt-search-wrapper">
            <div class="cw-yt-input-row">
              <input type="text" id="cw-yt-input" class="input-field" placeholder="🔍 ShishaWG Videos & Themen durchsuchen..." style="flex:1; padding:6px 10px; font-size:0.85rem;" autocomplete="off">
              <div id="cw-yt-suggestions" class="cw-yt-suggestions hidden"></div>
            </div>
            <div style="font-size:0.75rem; color:var(--text-muted); font-weight:700; margin-top:4px;">📌 Schnellzugriff (1-Klick im Chat teilen):</div>
            <div id="cw-yt-pinned-list" class="cw-yt-pinned-grid"></div>
          </div>
        `;

        const ytInput = toolContent.querySelector('#cw-yt-input');
        const ytSuggestions = toolContent.querySelector('#cw-yt-suggestions');
        const ytPinnedList = toolContent.querySelector('#cw-yt-pinned-list');

        // Populate Pinned Videos
        const pinned = (youtubeVideos && youtubeVideos.length > 0) ? youtubeVideos.filter(v => v.pinned) : DEFAULT_SHISHAWG_VIDEOS.slice(0, 4);
        if (ytPinnedList) {
          ytPinnedList.innerHTML = pinned.slice(0, 6).map(v => `
            <button type="button" class="cw-yt-pinned-btn" data-url="${escapeHtml(v.url)}" title="Im Twitch-Chat teilen:\n${escapeHtml(v.title)}">
              <span>▶</span> <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(v.title)}</span>
            </button>
          `).join('');

          ytPinnedList.querySelectorAll('.cw-yt-pinned-btn').forEach((btn, idx) => {
            btn.addEventListener('click', () => {
              const video = pinned[idx];
              if (typeof postYouTubeVideoToChat === 'function') postYouTubeVideoToChat(video);
              else showToast(`Video im Chat geteilt: ${video.title}`, 'success');
            });
          });
        }

        // Live Search Input with Debounce
        let ytSearchDebounce = null;
        if (ytInput && ytSuggestions) {
          ytInput.addEventListener('input', () => {
            clearTimeout(ytSearchDebounce);
            const q = ytInput.value.toLowerCase().trim();
            if (q.length < 2) {
              ytSuggestions.classList.add('hidden');
              ytSuggestions.innerHTML = '';
              return;
            }

            ytSearchDebounce = setTimeout(() => {
              const allVids = (youtubeVideos && youtubeVideos.length > 0) ? youtubeVideos : DEFAULT_SHISHAWG_VIDEOS;
              const matches = allVids.filter(v => 
                (v.title || '').toLowerCase().includes(q) ||
                (v.category || '').toLowerCase().includes(q) ||
                (v.desc || '').toLowerCase().includes(q)
              );

              if (matches.length === 0) {
                ytSuggestions.innerHTML = `<div style="padding:10px; font-size:0.8rem; color:var(--text-muted); text-align:center;">Kein Video zu "${escapeHtml(q)}" gefunden</div>`;
              } else {
                ytSuggestions.innerHTML = matches.slice(0, 6).map(v => `
                  <div class="cw-yt-suggestion-item">
                    <div style="flex:1; min-width:0; padding-right:8px;">
                      <div style="font-weight:700; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(v.title)}</div>
                      <span style="font-size:0.7rem; color:#ffca28;">${escapeHtml(v.category || 'ShishaWG')}</span>
                    </div>
                    <button type="button" class="btn btn-xs btn-primary cw-btn-share-sugg" style="background:#ff0033; color:#fff; border:none; font-weight:700; padding:3px 8px;">
                      💬 In Chat
                    </button>
                  </div>
                `).join('');

                ytSuggestions.querySelectorAll('.cw-btn-share-sugg').forEach((btn, sIdx) => {
                  btn.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    const v = matches[sIdx];
                    if (typeof postYouTubeVideoToChat === 'function') postYouTubeVideoToChat(v);
                    else showToast(`Video geteilt: ${v.title}`, 'success');
                    ytSuggestions.classList.add('hidden');
                  });
                });
              }
              ytSuggestions.classList.remove('hidden');
            }, 200);
          });

        }
      } else if (activeTool === 'commands') {
        const dashboardCommands = Array.isArray(quickCommands) && quickCommands.length
          ? quickCommands
          : DEFAULT_QUICK_COMMANDS;
        toolContent.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:7px;">
            <span style="font-size:0.74rem; color:var(--text-muted);">${dashboardCommands.length} gespeicherte Chat-Befehle</span>
            <button type="button" class="btn btn-xs btn-secondary" id="cw-add-custom-command">＋ Command</button>
          </div>
          <div class="cw-command-grid">
            ${dashboardCommands.map(command => `
              <div class="cw-command-item">
                <button type="button" class="btn btn-sm btn-secondary cw-cmd-btn" data-id="${escapeHtml(command.id)}" data-cmd="${escapeHtml(command.command)}" title="${escapeHtml(command.command)} senden">
                  <span>${escapeHtml(command.label)}</span>
                  <small>${escapeHtml(command.command)}</small>
                </button>
                <button type="button" class="btn-widget-action cw-edit-command" data-id="${escapeHtml(command.id)}" title="Command bearbeiten">✏️</button>
              </div>
            `).join('')}
          </div>
          <button type="button" class="btn btn-sm btn-secondary" id="cw-qa-btn-marker" style="margin-top:6px; width:100%; border:1px dashed rgba(255,202,40,0.4); color:#ffca28; font-weight:600;">
            🚩 Stream-Marker für Cutter setzen
          </button>
        `;

        toolContent.querySelectorAll('.cw-cmd-btn').forEach(btn => {
          btn.addEventListener('click', async () => {
            const cmd = btn.getAttribute('data-cmd');
            const chan = (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved';
            const res = await ipcRenderer.invoke('twitch:send-chat', { message: cmd, channel: chan });
            if (res && res.success) showToast(`Befehl '${cmd}' im Twitch-Chat gesendet!`, 'success');
            else showToast(res?.error || `Befehl ${cmd} konnte nicht gesendet werden`, 'error');
          });
        });

        toolContent.querySelectorAll('.cw-edit-command').forEach(btn => {
          btn.addEventListener('click', () => openEditCommandModal(btn.dataset.id));
        });
        const btnAddCommand = toolContent.querySelector('#cw-add-custom-command');
        if (btnAddCommand) btnAddCommand.addEventListener('click', openAddCommandModal);

        const btnMarker = toolContent.querySelector('#cw-qa-btn-marker');
        if (btnMarker) {
          btnMarker.addEventListener('click', () => {
            const mainMarkerBtn = document.getElementById('btn-stream-marker');
            if (mainMarkerBtn) mainMarkerBtn.click();
            else showToast('🚩 Stream-Marker gesetzt!', 'success');
          });
        }
      } else if (activeTool === 'streaminfo') {
        toolContent.innerHTML = `
          <div style="display:flex; flex-direction:column; gap:6px;">
            <div style="display:flex; gap:6px;">
              <input type="text" id="cw-stream-title" class="input-field" placeholder="Stream-Titel setzen..." style="flex:1; padding:6px 10px; font-size:0.82rem;">
              <button type="button" class="btn btn-sm btn-primary" id="cw-btn-set-title" style="background:#ffca28; color:#121218; font-weight:700; border:none;">💾 Titel</button>
            </div>
            <div style="display:flex; gap:6px;">
              <input type="text" id="cw-stream-game" class="input-field" placeholder="Kategorie (z. B. Just Chatting, Shisha)..." style="flex:1; padding:6px 10px; font-size:0.82rem;">
              <button type="button" class="btn btn-sm btn-primary" id="cw-btn-set-game" style="background:#ffca28; color:#121218; font-weight:700; border:none;">🎮 Spiel</button>
            </div>
          </div>
        `;

        const inputTitle = toolContent.querySelector('#cw-stream-title');
        const btnSetTitle = toolContent.querySelector('#cw-btn-set-title');
        const inputGame = toolContent.querySelector('#cw-stream-game');
        const btnSetGame = toolContent.querySelector('#cw-btn-set-game');

        ipcRenderer.invoke('twitch:get-channel-info', (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved')
          .then(info => {
            if (!info || !info.success) return;
            if (inputTitle && info.title !== undefined) inputTitle.value = info.title;
            if (inputGame && info.game_name !== undefined) inputGame.value = info.game_name;
          })
          .catch(() => {});

        if (btnSetTitle && inputTitle) {
          btnSetTitle.addEventListener('click', async () => {
            const title = inputTitle.value.trim();
            if (!title) return showToast('Titel darf nicht leer sein', 'warning');
            const chan = (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved';
            const res = await ipcRenderer.invoke('twitch:set-title', { title, channel: chan });
            if (res && res.success) showToast(`Titel auf "${title}" gesetzt!`, 'success');
            else showToast(res?.error || 'Fehler beim Setzen des Titels', 'error');
          });
        }

        if (btnSetGame && inputGame) {
          btnSetGame.addEventListener('click', async () => {
            const game = inputGame.value.trim();
            if (!game) return showToast('Kategorie darf nicht leer sein', 'warning');
            const chan = (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved';
            const res = await ipcRenderer.invoke('twitch:set-game', { game, channel: chan });
            if (res && res.success) showToast(`Kategorie auf "${game}" gesetzt!`, 'success');
            else showToast(res?.error || 'Fehler beim Setzen des Spiels', 'error');
          });
        }
      } else if (activeTool === 'clipping') {
        toolContent.innerHTML = `
          <div style="text-align:center; padding:10px 4px;">
            <button type="button" class="btn btn-primary" id="cw-btn-make-clip" style="background:#9146ff; color:#fff; font-weight:700; border:none; width:100%; padding:10px;">
              🎬 Clip der letzten 60s erstellen
            </button>
            <div id="cw-clip-feedback" style="margin-top:8px; font-size:0.8rem; color:var(--text-muted);">Erstellt sofort einen Clip auf Twitch</div>
          </div>
        `;
        const btnClip = toolContent.querySelector('#cw-btn-make-clip');
        const feedback = toolContent.querySelector('#cw-clip-feedback');
        if (btnClip) {
          btnClip.addEventListener('click', async () => {
            btnClip.disabled = true;
            btnClip.textContent = '⏳ Clip wird generiert...';
            const chan = (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved';
            const res = await ipcRenderer.invoke('twitch:create-clip', chan);
            btnClip.disabled = false;
            btnClip.textContent = '🎬 Clip der letzten 60s erstellen';
            if (res && res.success && res.clip_url) {
              if (feedback) feedback.innerHTML = `✅ Clip erstellt: <a href="#" style="color:#00f0ff;">${escapeHtml(res.clip_url)}</a>`;
              const clipLink = feedback ? feedback.querySelector('a') : null;
              if (clipLink) {
                clipLink.addEventListener('click', event => {
                  event.preventDefault();
                  ipcRenderer.invoke('app:open-external', res.clip_url);
                });
              }
              showToast('🎬 Clip erfolgreich erstellt!', 'success');
            } else {
              showToast(res?.error || 'Fehler beim Clip-Erstellen', 'error');
            }
          });
        }
      } else if (activeTool === 'raid') {
        toolContent.innerHTML = `
          <div style="display:flex; flex-direction:column; gap:6px;">
            <div style="display:flex; gap:6px;">
              <input type="text" id="cw-raid-input" class="input-field" placeholder="Zielkanal eingeben..." style="flex:1; padding:6px 10px; font-size:0.85rem;">
              <button type="button" class="btn btn-sm btn-primary" id="cw-btn-raid-start" style="background:#ffca28; color:#121218; font-weight:700; border:none;">🚀 Raid</button>
              <button type="button" class="btn btn-sm btn-secondary" id="cw-btn-raid-cancel" style="color:#ef4444;">🛑</button>
            </div>
            <div style="font-size:0.75rem; color:var(--text-muted);">Startet oder bricht den Twitch-Raid ab.</div>
          </div>
        `;

        const rInput = toolContent.querySelector('#cw-raid-input');
        const rStart = toolContent.querySelector('#cw-btn-raid-start');
        const rCancel = toolContent.querySelector('#cw-btn-raid-cancel');

        if (rStart && rInput) {
          rStart.addEventListener('click', async () => {
            const target = rInput.value.trim();
            if (!target) return showToast('Bitte Zielkanal eingeben', 'warning');
            const chan = (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved';
            const res = await ipcRenderer.invoke('twitch:start-raid', { target, channel: chan });
            if (res && res.success) showToast(`🚀 Raid auf @${target} gestartet!`, 'success');
            else showToast(res?.error || 'Fehler beim Raid', 'error');
          });
        }

        if (rCancel) {
          rCancel.addEventListener('click', async () => {
            const chan = (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved';
            const res = await ipcRenderer.invoke('twitch:cancel-raid', chan);
            if (res && res.success) showToast('Raid abgebrochen (/unraid)', 'info');
            else showToast(res?.error || 'Fehler beim Abbrechen', 'error');
          });
        }
      }
      break;
    }

    case 'widget-polls': {
      const activePoll = (typeof pollsState !== 'undefined' && pollsState.activePoll) ? pollsState.activePoll : null;

      if (activePoll) {
        container.innerHTML = `
          <div style="background:rgba(255,255,255,0.03); border:1px solid var(--border-color); border-radius:8px; padding:10px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <span class="qna-status-badge live" style="font-size:0.7rem;">🔴 POLL LIVE</span>
              <button type="button" class="btn btn-xs btn-secondary" id="cw-btn-end-poll" style="color:#ef4444;">Beenden</button>
            </div>
            <strong style="color:#fff; font-size:0.9rem; display:block; margin-bottom:8px;">„${escapeHtml(activePoll.title)}“</strong>
            <div style="display:flex; flex-direction:column; gap:6px;">
              ${(activePoll.choices || []).map(c => `
                <div>
                  <div style="display:flex; justify-content:space-between; font-size:0.75rem; margin-bottom:2px;">
                    <span>${escapeHtml(c.title)}</span>
                    <strong>${c.votes || 0} Stimmen</strong>
                  </div>
                  <div style="height:4px; background:rgba(255,255,255,0.1); border-radius:2px; overflow:hidden;">
                    <div style="height:100%; width:${Math.min(100, Math.max(0, c.percentage || 0))}%; background:#ffca28;"></div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
        const btnEnd = container.querySelector('#cw-btn-end-poll');
        if (btnEnd) {
          btnEnd.addEventListener('click', async () => {
            const chan = (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved';
            await ipcRenderer.invoke('polls:end', { pollId: activePoll.id, status: 'TERMINATED', channel: chan });
            if (typeof pollsState !== 'undefined') pollsState.activePoll = null;
            renderWidgetContent('widget-polls', container);
            showToast('Umfrage beendet', 'info');
          });
        }
      } else {
        container.innerHTML = `
          <div style="display:flex; flex-direction:column; gap:8px;">
            <div style="font-size:0.75rem; color:var(--text-muted); font-weight:700;">1-Klick Vorlagen starten:</div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:6px;">
              <button type="button" class="btn btn-sm btn-secondary cw-poll-preset-btn" data-preset="preset_setup_rating" style="padding:6px; font-size:0.75rem; text-align:left;">
                🌟 Setup-Bewertung
              </button>
              <button type="button" class="btn btn-sm btn-secondary cw-poll-preset-btn" data-preset="preset_next_bowl" style="padding:6px; font-size:0.75rem; text-align:left;">
                🥣 Nächster Kopf?
              </button>
            </div>
            <button type="button" class="btn btn-sm btn-primary" id="cw-btn-open-polls" style="background:#ffca28; color:#121218; font-weight:700; border:none; margin-top:2px;">
              📊 Umfragen-Center öffnen ➔
            </button>
          </div>
        `;

        container.querySelectorAll('.cw-poll-preset-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const pKey = btn.getAttribute('data-preset');
            if (typeof applyPollPreset === 'function') {
              applyPollPreset(pKey);
              showView('view-polls');
            } else {
              showView('view-polls');
            }
          });
        });

        const btnOpen = container.querySelector('#cw-btn-open-polls');
        if (btnOpen) btnOpen.addEventListener('click', () => showView('view-polls'));
      }
      break;
    }

    case 'widget-qna': {
      const questions = (typeof qnaState !== 'undefined' && Array.isArray(qnaState.questions)) ? qnaState.questions : [];
      const openQuestions = questions.filter(q => q.status === 'pending' || q.status === 'approved');

      if (openQuestions.length === 0) {
        container.innerHTML = `
          <div style="background:rgba(255,255,255,0.02); padding:12px; border-radius:8px; border:1px solid var(--border-color); text-align:center;">
            <div style="font-size:1.1rem; margin-bottom:2px;">🙋</div>
            <div style="font-size:0.8rem; font-weight:700; color:#fff;">Keine offenen Fragen</div>
            <p style="font-size:0.72rem; color:var(--text-muted); margin:4px 0 8px 0;">Zuschauer können im Chat <code>!frage Text</code> schreiben.</p>
            <button type="button" class="btn btn-sm btn-primary" id="cw-btn-open-qna" style="background:#ffca28; color:#121218; font-weight:700; border:none;">
              Q&amp;A Manager öffnen ➔
            </button>
          </div>
        `;
      } else {
        container.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <span style="font-size:0.75rem; color:#00f0ff; font-weight:700;">💬 ${openQuestions.length} offene Frage(n)</span>
            <button type="button" class="btn btn-xs btn-secondary" id="cw-btn-open-qna-link">Alle ➔</button>
          </div>
          <div style="display:flex; flex-direction:column; gap:6px; max-height:190px; overflow-y:auto;">
            ${openQuestions.slice(0, 3).map(q => `
              <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:6px; padding:6px 8px; font-size:0.78rem;">
                <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                  <strong style="color:#00f0ff;">@${escapeHtml(q.displayName || q.login)}</strong>
                  <div style="display:flex; gap:4px;">
                    <button type="button" class="btn btn-xs btn-primary cw-qna-approve" data-id="${q.id}" data-next-status="${q.status === 'approved' ? 'on_air' : 'approved'}" title="${q.status === 'approved' ? 'Live schalten' : 'Freigeben'}">${q.status === 'approved' ? '📺' : '✓'}</button>
                    <button type="button" class="btn btn-xs btn-secondary cw-qna-del" data-id="${q.id}" title="Löschen" style="color:#ef4444;">✕</button>
                  </div>
                </div>
                <div style="color:#fff; word-break:break-word;">„${escapeHtml(q.question)}“</div>
              </div>
            `).join('')}
          </div>
        `;

        container.querySelectorAll('.cw-qna-approve').forEach(btn => {
          btn.addEventListener('click', async () => {
            const qId = btn.getAttribute('data-id');
            const nextStatus = btn.getAttribute('data-next-status') || 'approved';
            if (typeof setQuestionStatus === 'function') await setQuestionStatus(qId, nextStatus);
            renderWidgetContent('widget-qna', container);
          });
        });

        container.querySelectorAll('.cw-qna-del').forEach(btn => {
          btn.addEventListener('click', async () => {
            const qId = btn.getAttribute('data-id');
            if (typeof deleteQuestion === 'function') await deleteQuestion(qId);
            renderWidgetContent('widget-qna', container);
          });
        });

        const btnLink = container.querySelector('#cw-btn-open-qna-link');
        if (btnLink) btnLink.addEventListener('click', () => showView('view-qna'));
      }

      const btnOpen = container.querySelector('#cw-btn-open-qna');
      if (btnOpen) btnOpen.addEventListener('click', () => showView('view-qna'));
      break;
    }

    case 'widget-stats': {
      const coalAvg = document.getElementById('kpi-avg-duration-coal')?.textContent || '0 Min';
      const elecAvg = document.getElementById('kpi-avg-duration-electric')?.textContent || '0 Min';
      const countToday = statsState?.headCountToday || 0;

      container.innerHTML = `
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap:8px; text-align:center;">
          <div data-dashboard-feature="heads" style="background:rgba(255,255,255,0.03); border:1px solid var(--border-color); border-radius:8px; padding:8px 4px;">
            <div style="font-size:0.7rem; color:var(--text-muted); font-weight:600;">Köpfe heute</div>
            <div style="font-size:1.15rem; font-weight:800; color:#ffca28; margin-top:2px;">${countToday}</div>
          </div>
          <div data-dashboard-feature="coal" style="background:rgba(255,255,255,0.03); border:1px solid var(--border-color); border-radius:8px; padding:8px 4px;">
            <div style="font-size:0.7rem; color:var(--text-muted); font-weight:600;">🪵 Ø Kohle</div>
            <div style="font-size:1.15rem; font-weight:800; color:#4fc3f7; margin-top:2px;">${coalAvg}</div>
          </div>
          <div data-dashboard-feature="electric" style="background:rgba(255,255,255,0.03); border:1px solid var(--border-color); border-radius:8px; padding:8px 4px;">
            <div style="font-size:0.7rem; color:var(--text-muted); font-weight:600;">⚡ Ø E-Kopf</div>
            <div style="font-size:1.15rem; font-weight:800; color:#81c784; margin-top:2px;">${elecAvg}</div>
          </div>
        </div>
        <button type="button" class="btn btn-sm btn-secondary" id="cw-btn-open-stats" data-dashboard-feature="details" style="margin-top:6px; width:100%;">
          📊 Detaillierte Statistiken öffnen ➔
        </button>
      `;

      const btnStats = container.querySelector('#cw-btn-open-stats');
      if (btnStats) btnStats.addEventListener('click', () => showView('view-stats'));
      break;
    }

    default:
      container.innerHTML = `<div style="color:var(--text-muted); font-size:0.85rem;">Modul nicht gefunden</div>`;
  }
  applyDashboardFeatureSelection(wConfig, container);
}

function openAddWidgetModal() {
  if (isCustomDashboardLocked()) {
    showToast('🔒 Layout entsperren, um ein Modul hinzuzufügen.', 'info');
    return;
  }
  const modal = document.getElementById('modal-add-dashboard-widget');
  const list = document.getElementById('add-widget-catalog-list');
  if (!modal || !list) return;

  const layout = getCustomDashboardLayout();
  const currentWidgets = flattenDashboardWidgets(layout.root);
  const activeIds = new Set(currentWidgets.map(w => w.id));

  list.innerHTML = '';
  CUSTOM_DASHBOARD_CATALOG.forEach(cat => {
    const isAdded = activeIds.has(cat.id);
    const existingWidget = currentWidgets.find(widget => widget.id === cat.id);
    const selectedFeatures = getDashboardWidgetFeatures(existingWidget, cat);
    const isCompact = Array.isArray(selectedFeatures);
    const initialFeatures = isCompact ? selectedFeatures : (cat.compactDefaults || cat.features?.map(feature => feature.id) || []);
    const item = document.createElement('details');
    item.className = `catalog-widget-item${isAdded ? ' already-added' : ''}`;
    item.innerHTML = `
      <summary class="catalog-widget-summary">
        <span class="catalog-widget-info">
          <span class="catalog-widget-icon">${cat.icon}</span>
          <span>
            <span class="catalog-widget-title">${escapeHtml(cat.title)}</span>
            <span class="catalog-widget-desc">${escapeHtml(cat.desc)}</span>
          </span>
        </span>
        <span class="catalog-widget-state">${isAdded ? '✓ Aktiv' : 'Konfigurieren'} <span class="catalog-widget-chevron">⌄</span></span>
      </summary>
      <div class="catalog-widget-options">
        <label class="catalog-widget-mode">
          <input type="radio" name="dashboard-mode-${cat.id}" value="full" ${isCompact ? '' : 'checked'}>
          <span><strong>Gesamtes Modul</strong><small>Alle Funktionen anzeigen</small></span>
        </label>
        ${cat.features?.length ? `
          <label class="catalog-widget-mode">
            <input type="radio" name="dashboard-mode-${cat.id}" value="compact" ${isCompact ? 'checked' : ''}>
            <span><strong>Ausgewählte Funktionen</strong><small>Nur das anzeigen, was du wirklich brauchst</small></span>
          </label>
          <div class="catalog-widget-features">
            ${cat.features.map(feature => `
              <label>
                <input type="checkbox" value="${escapeHtml(feature.id)}" ${initialFeatures.includes(feature.id) ? 'checked' : ''} ${isCompact ? '' : 'disabled'}>
                <span>${escapeHtml(feature.label)}</span>
              </label>`).join('')}
          </div>` : ''}
        <button type="button" class="btn btn-sm btn-primary catalog-widget-save">
          ${isAdded ? 'Auswahl speichern' : '➕ Modul hinzufügen'}
        </button>
      </div>
    `;

    item.addEventListener('toggle', () => {
      if (!item.open) return;
      list.querySelectorAll('details.catalog-widget-item[open]').forEach(otherItem => {
        if (otherItem !== item) otherItem.open = false;
      });
      requestAnimationFrame(() => item.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
    });

    const modeInputs = [...item.querySelectorAll(`input[name="dashboard-mode-${cat.id}"]`)];
    const featureInputs = [...item.querySelectorAll('.catalog-widget-features input[type="checkbox"]')];
    const syncFeatureInputs = () => {
      const compact = modeInputs.find(input => input.checked)?.value === 'compact';
      featureInputs.forEach(input => { input.disabled = !compact; });
    };
    modeInputs.forEach(input => input.addEventListener('change', syncFeatureInputs));

    const btn = item.querySelector('.catalog-widget-save');
    btn.addEventListener('click', () => {
      if (isCustomDashboardLocked()) {
        modal.classList.add('hidden');
        showToast('🔒 Layout entsperren, um ein Modul hinzuzufügen.', 'info');
        return;
      }
      const mode = modeInputs.find(input => input.checked)?.value || 'full';
      const features = featureInputs.filter(input => input.checked).map(input => input.value);
      if (mode === 'compact' && features.length === 0) {
        showToast('Bitte wähle mindestens eine Funktion aus.', 'warning');
        return;
      }
      if (isAdded && existingWidget) {
        if (mode === 'compact') existingWidget.features = features;
        else delete existingWidget.features;
        if (cat.id === 'widget-quickactions' && Array.isArray(existingWidget.features) && !existingWidget.features.includes(existingWidget.subTool)) {
          existingWidget.subTool = existingWidget.features[0];
        }
        saveCustomDashboardLayout(layout);
        modal.classList.add('hidden');
        renderCustomDashboard();
        showToast(`✅ Auswahl für „${cat.title}“ gespeichert.`, 'success');
        return;
      }
      const newWidget = {
        id: cat.id,
        colSpan: cat.defaultColSpan || 6,
        collapsed: false
      };
      if (mode === 'compact') newWidget.features = features;
      if (cat.id === 'widget-quickactions' && Array.isArray(newWidget.features)) newWidget.subTool = newWidget.features[0];
      const newPanel = makeDashboardPanel(newWidget);
      layout.root = layout.root ? makeDashboardSplit('row', layout.root, newPanel, 0.7) : newPanel;
      saveCustomDashboardLayout(layout);
      modal.classList.add('hidden');
      renderCustomDashboard();
      showToast(`✨ „${cat.title}“ zu deinem Dashboard hinzugefügt!`, 'success');
    });

    list.appendChild(item);
  });

  modal.classList.remove('hidden');
}

function setupCustomDashboardListeners() {
  const btnLock = document.getElementById('btn-custom-dashboard-lock');
  const btnAdd = document.getElementById('btn-custom-dashboard-add-widget');
  const btnReset = document.getElementById('btn-custom-dashboard-reset-layout');
  const modalAdd = document.getElementById('modal-add-dashboard-widget');
  const btnCloseModal = document.getElementById('btn-close-add-widget-modal');

  if (btnLock) {
    btnLock.addEventListener('click', () => {
      const nowLocked = !isCustomDashboardLocked();
      setCustomDashboardLocked(nowLocked);
      showToast(nowLocked ? '🔒 Dashboard-Layout fixiert (Gesperrt)' : '🔓 Dashboard-Layout entsperrt (Verschieben & Ändern aktiv)', 'info');
    });
  }

  if (btnAdd) btnAdd.addEventListener('click', openAddWidgetModal);
  document.addEventListener('click', (event) => {
    const suggestions = document.getElementById('cw-yt-suggestions');
    if (suggestions && !event.target.closest('.cw-yt-search-wrapper')) {
      suggestions.classList.add('hidden');
    }
  });
  window.addEventListener('swg:quick-commands-changed', () => {
    refreshDashboardWidgets('widget-quickactions');
  });
  if (btnCloseModal && modalAdd) {
    btnCloseModal.addEventListener('click', () => modalAdd.classList.add('hidden'));
    modalAdd.addEventListener('click', (e) => {
      if (e.target === modalAdd) modalAdd.classList.add('hidden');
    });
  }

  if (btnReset) {
    btnReset.addEventListener('click', () => {
      if (isCustomDashboardLocked()) {
        showToast('🔒 Layout entsperren, um es zurückzusetzen.', 'info');
        return;
      }
      saveCustomDashboardLayout(createDefaultDashboardLayout());
      renderCustomDashboard();
      showToast('📐 Layout auf das Standard-Cockpit zurückgesetzt!', 'info');
    });
  }

  updateDashboardLockUI();
  renderCustomDashboardTile();
}
