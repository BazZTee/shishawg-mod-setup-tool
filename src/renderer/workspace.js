/* Workspace shell. Domain actions continue to use the established controllers. */
(() => {
  'use strict';
  const icons = {
    home: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    setup: '<path d="M8 21h8M9 21l1-7h4l1 7M8 10h8l-2 4h-4zM12 3v4M16 3c3 2-1 3 1 5M8 6c-2-2 1-3 0-5"/>',
    bolt: '<path d="m13 2-9 12h7l-1 8 10-13h-7z"/>',
    chat: '<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-2 2V11.5A8.5 8.5 0 0 1 10.5 3H13a8 8 0 0 1 8 8.5Z"/><path d="M7 9h9M7 13h6"/>',
    gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v9h14v-9M12 8v13M12 8H8a3 3 0 1 1 3-3l1 3Zm0 0h4a3 3 0 1 0-3-3l-1 3Z"/>',
    question: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1 .7-1.5 1-1.5 2M12 17h.01"/>',
    poll: '<path d="M4 20h16M6 16v-5M12 16V4M18 16V8"/>',
    timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6M12 2v3M18 5l2-2"/>',
    dashboard: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 10h18M12 10v11"/>',
    catalog: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 4 16 4 16 0V5M4 12v7c0 4 16 4 16 0v-7"/>',
    screen: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
    collapse: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18m7-12-3 3 3 3"/>',
    arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    link: '<path d="m10 13 4-4m-5 6-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 2 2-2a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0"/>',
    feedback: '<path d="M9 18h6m-5 3h4M8 14a6 6 0 1 1 8 0c-1 .7-1 1.5-1 2H9c0-.5 0-1.3-1-2Z"/>'
  };
  const icon = name => `<svg class="ws-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.home}</svg>`;
  const routes = [
    { id: 'view-landing', name: 'Übersicht', icon: 'home', description: 'Deine Zentrale für den nächsten Stream.' },
    { id: 'view-setup', name: 'Setup-Manager', icon: 'setup', description: 'Setups zusammenstellen, importieren und im Chat teilen.', keys: 'Tabak Pfeifen Köpfe Kohle Import Notizen' },
    { id: 'view-quickactions', name: 'Stream-Aktionen', icon: 'bolt', description: 'Titel, Clips, Raids und schnelle Befehle an einem Ort.', keys: 'Quick Actions YouTube Soundboard Kategorie' },
    { id: 'view-modchat', name: 'Mod-HQ & Chat', icon: 'chat', description: 'Team abstimmen, Marker setzen, Chat verfolgen.', keys: 'Watchlist Moderation 7TV' },
    { id: 'view-giveaways', name: 'Giveaways & Adressen', icon: 'gift', description: 'Teilnahme, Auslosung und Versand übersichtlich begleiten.', keys: 'Gewinner Telegram Kanalpunkte Kohle' },
    { id: 'view-qna', name: 'Fragen & Antworten', icon: 'question', description: 'Zuschauerfragen sammeln, moderieren und on air bringen.', keys: 'Q&A Fragerunde Bestrafungsrad OBS' },
    { id: 'view-polls', name: 'Umfragen & Vorhersagen', icon: 'poll', description: 'Die Community abstimmen lassen und Ergebnisse live verfolgen.', keys: 'Polls Predictions Templates Kanalpunkte' },
    { id: 'view-stats', name: 'Statistiken & Timer', icon: 'timer', description: 'Laufende Köpfe, Kohlewechsel und deine Session-Historie.', keys: 'Rauchdauer Rankings Analytics' },
    { id: 'view-custom-dashboard', name: 'Mein Dashboard', icon: 'dashboard', description: 'Deine Module. Dein Layout. Alles griffbereit.', keys: 'Widgets Drag Resize Cockpit' }
  ];
  const $ = id => document.getElementById(id);
  const storage = {
    get(key, fallback = '') { try { return localStorage.getItem('swg_workspace_' + key) ?? fallback; } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem('swg_workspace_' + key, value); } catch { /* Read-only profiles remain usable. */ } }
  };
  let ready = false;
  let startApplied = false;
  let previousFocus = null;
  let paletteIndex = 0;
  let visibleCommands = [];
  const app = document.querySelector('.app-container');
  const sidebar = document.createElement('aside');
  sidebar.className = 'workspace-sidebar';
  sidebar.setAttribute('aria-label', 'Workspace-Navigation');
  sidebar.innerHTML = `<div class="ws-brand-slot"></div>
    <div class="ws-nav-label">WORKSPACE</div>
    <nav class="ws-nav" aria-label="Hauptnavigation">${routes.map((route,i) => `<button type="button" class="ws-nav-item" data-ws-route="${route.id}" title="${route.name} (Alt+${i+1})">${icon(route.icon)}<span class="ws-nav-text">${route.name}</span>${route.id === 'view-modchat' || route.id === 'view-qna' ? `<span class="ws-unread hidden" data-unread-for="${route.id}"></span>` : ''}</button>`).join('')}</nav>
    <div class="ws-nav-label ws-tools-label">WERKZEUGE</div>
    <nav class="ws-nav ws-tools" aria-label="Werkzeuge">
      <button type="button" class="ws-nav-item" data-ws-action="catalog" title="Katalog & Datenbank">${icon('catalog')}<span class="ws-nav-text">Katalog & Datenbank</span></button>
      <button type="button" class="ws-nav-item" data-ws-action="obs" title="OBS-Overlay">${icon('screen')}<span class="ws-nav-text">OBS-Overlay</span></button>
      <button type="button" class="ws-nav-item" data-ws-action="preferences" title="Einstellungen">${icon('settings')}<span class="ws-nav-text">Einstellungen</span></button>
    </nav>
    <div class="ws-sidebar-bottom"><div class="ws-stream-slot"></div><div class="ws-build"><span class="ws-build-dot"></span><span class="ws-nav-text">VERSION 8</span></div><div class="ws-version-slot"></div><button type="button" id="ws-collapse" class="ws-nav-item" title="Navigation einklappen" aria-label="Navigation einklappen" aria-expanded="true">${icon('collapse')}<span class="ws-nav-text">Navigation einklappen</span></button></div>`;
  app.prepend(sidebar);
  sidebar.querySelector('.ws-brand-slot').append(document.querySelector('.brand'));
  sidebar.querySelector('.ws-version-slot').append($('btn-check-updates'));
  sidebar.querySelector('.ws-stream-slot').append($('stream-status-pill'));
  document.querySelector('.brand .subtitle').textContent = 'Mod Setup Tool';
  const header = document.querySelector('.app-header');
  header.insertAdjacentHTML('afterbegin', '<div class="ws-breadcrumb"><span>Workspace</span><span class="ws-breadcrumb-divider">/</span><strong id="ws-current-title">Übersicht</strong></div>');
  header.insertAdjacentHTML('beforeend', `<button type="button" id="ws-search" class="ws-search-trigger" aria-label="Module und Werkzeuge suchen">${icon('search')}<span>Suchen</span><kbd>Strg K</kbd></button>`);
  const feedback = $('btn-open-change-request');
  sidebar.querySelector('.ws-tools').append(feedback);
  feedback.querySelector('.fab-icon').innerHTML = icon('feedback');
  feedback.classList.add('ws-nav-item');
  feedback.querySelector('.fab-label').classList.add('ws-nav-text');
  const landing = $('view-landing');
  const hero = landing.querySelector('.landing-hero');
  hero.insertAdjacentHTML('afterbegin', '<div class="ws-eyebrow">SHISHAWG · MOD WORKSPACE</div>');
  hero.querySelector('h2').textContent = 'Dein Stream. Alles im Blick.';
  hero.insertAdjacentHTML('beforeend', '<div class="ws-date" id="ws-date"></div>');
  $('ws-date').textContent = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  const status = document.createElement('div');
  status.className = 'ws-status-strip';
  status.innerHTML = `<div><span class="ws-status-label">AKTIVER KANAL</span><strong id="ws-summary-channel">#marved</strong></div><div><span class="ws-status-label">TWITCH-VERBINDUNG</span><strong id="ws-summary-connection">Nicht verbunden</strong></div><div><span class="ws-status-label">DEIN ARBEITSPLATZ</span><strong>8 Module <span class="ws-status-light">· ein Workspace</span></strong></div>`;
  hero.after(status);
  const grid = landing.querySelector('.hub-tiles-grid');
  grid.before(Object.assign(document.createElement('div'), { className: 'ws-section-title', innerHTML: '<h3>Deine Module</h3><span>Für alles, was im Stream ansteht</span>' }));
  landing.querySelectorAll('.hub-tile-card').forEach(tile => {
    const route = routes.find(r => r.id === tile.dataset.target);
    if (!route) return;
    tile.querySelector('.tile-icon').innerHTML = icon(route.icon);
    tile.querySelector('h3').textContent = route.name;
    tile.querySelector('p').textContent = route.description;
    tile.querySelector('.tile-action').insertAdjacentHTML('beforeend', icon('arrow'));
  });
  const alert = $('landing-twitch-banner');
  alert.querySelector('.landing-alert-icon').innerHTML = icon('link');
  alert.querySelector('strong').textContent = 'Bereit, wenn du es bist.';
  alert.querySelector('p').textContent = 'Verbinde Twitch, um deine Moderator-Module zu öffnen. Profile und Katalog kannst du schon vorbereiten.';
  alert.insertAdjacentHTML('beforeend', '<button type="button" class="btn btn-primary" id="ws-connect">Twitch verbinden</button>');
  $('ws-connect').addEventListener('click', () => $('btn-twitch-login').click());
  landing.insertAdjacentHTML('beforeend', '<div class="ws-overview-foot"><span>Dein persönlicher Workspace für die ShishaWG.</span><span><kbd>Strg K</kbd> Schnellsuche <span class="ws-foot-separator">·</span> <kbd>Esc</kbd> Übersicht</span></div>');
  // Make page titles and card icons follow one visual language.
  routes.slice(1).forEach(route => {
    const pane = $(route.id);
    const bar = pane.querySelector('.tool-sub-header');
    const heading = document.createElement('div');
    heading.className = 'ws-module-heading';
    heading.innerHTML = `<span class="ws-module-symbol">${icon(route.icon)}</span><div><h2>${route.name}</h2><p>${route.description}</p></div>`;
    if (bar) bar.after(heading); else pane.prepend(heading);
  });
  document.querySelectorAll('.tool-breadcrumb').forEach(el => {
    const route = routes.find(r => r.id === el.closest('.hub-view-pane')?.id);
    if (route) el.innerHTML = `Workspace <span aria-hidden="true">/</span> <strong>${route.name}</strong>`;
  });
  // Keep legacy labels and controls, replace decorative emoji in headings only.
  document.querySelectorAll('.hub-view-pane h2, .hub-view-pane h3, .hub-view-pane h4').forEach(el => {
    const node = el.firstChild;
    if (node?.nodeType === Node.TEXT_NODE) node.textContent = node.textContent.replace(/^[\s\p{Extended_Pictographic}\uFE0F\u200D]+/u, '');
  });
  document.querySelectorAll('.qa-header-icon, .modhq-header-icon').forEach(el => {
    const route = routes.find(r => r.id === el.closest('.hub-view-pane')?.id);
    const label = el.parentElement.textContent.toLocaleLowerCase('de');
    const glyph = label.includes('on-air') ? 'screen' : label.includes('adresse') ? 'check' : label.includes('statistik') ? 'poll' : route?.icon || 'bolt';
    el.innerHTML = icon(glyph);
  });
  document.querySelector('#notes-card h4').textContent = 'Schnell-Notizen';
  $('toast-banner').setAttribute('role', 'status');
  $('toast-banner').setAttribute('aria-live', 'polite');
  document.body.insertAdjacentHTML('beforeend', `<div id="ws-palette" class="modal-overlay ws-modal hidden" role="dialog" aria-modal="true" aria-labelledby="ws-palette-title">
      <div class="modal-card ws-palette-card"><div class="ws-palette-search">${icon('search')}<label class="ws-sr-only" id="ws-palette-title" for="ws-query">Module und Werkzeuge suchen</label><input id="ws-query" type="search" placeholder="Modul oder Werkzeug suchen …" autocomplete="off" role="combobox" aria-controls="ws-results" aria-expanded="true"><button type="button" class="btn-icon" data-ws-close="ws-palette" aria-label="Suche schließen">×</button></div><div id="ws-results" role="listbox" aria-label="Suchergebnisse"></div><div class="ws-palette-footer"><span>↑ ↓ Auswählen</span><span>↵ Öffnen</span><span>Esc Schließen</span></div></div></div>
    <div id="ws-preferences" class="modal-overlay ws-modal hidden" role="dialog" aria-modal="true" aria-labelledby="ws-preferences-title"><div class="modal-card ws-preferences-card"><div class="modal-header"><h3 id="ws-preferences-title">Einstellungen</h3><button type="button" class="btn-icon" data-ws-close="ws-preferences" aria-label="Einstellungen schließen">×</button></div><div class="modal-body">
      <h4>Ansicht &amp; Startseite</h4><label class="ws-setting-label" for="ws-start-view">Beim Start öffnen</label><p class="ws-setting-help">Deine bevorzugte Ansicht wird nach der Twitch-Anmeldung geöffnet.</p><select id="ws-start-view"><option value="view-landing">Übersicht</option><option value="last">Zuletzt verwendetes Modul</option>${routes.slice(1).map(r=>`<option value="${r.id}">${r.name}</option>`).join('')}</select>
      <div class="ws-setting-row"><div><label for="ws-density">Kompakte Darstellung</label><p class="ws-setting-help">Weniger Abstand für kleinere Bildschirme.</p></div><input type="checkbox" id="ws-density"></div>
      <div class="ws-setting-row"><div><label for="ws-motion">Animationen reduzieren</label><p class="ws-setting-help">Ruhige Übergänge und weniger Bewegung.</p></div><input type="checkbox" id="ws-motion"></div>
      <div class="ws-setting-row"><div><h4>Streamer-Profile &amp; Kanäle</h4><p class="ws-setting-help">Streamer, Kanäle und Profile verwalten.</p></div><button type="button" id="ws-manage-profiles" class="btn btn-secondary">Verwalten</button></div><div class="ws-build-note"><strong>ShishaWG Mod Setup Tool · v8.0.0</strong><p>Deine Einstellungen und Daten aus der bisherigen installierten Version werden weiterverwendet.</p><p>Lokales OBS-Overlay: <code>http://localhost:18942/overlay</code></p><button type="button" class="btn btn-secondary" id="ws-copy-obs">Lokalen OBS-Link kopieren</button></div>
    </div><div class="modal-footer"><span class="ws-setting-help">Änderungen werden automatisch gespeichert.</span><button type="button" class="btn btn-primary" data-ws-close="ws-preferences">Fertig</button></div></div></div>`);
  function navigate(id) {
    if (id !== 'view-landing' && !state.twitchUser) {
      showToast('Verbinde Twitch, um dieses Modul zu öffnen.', 'info');
      $('btn-twitch-login').click();
      return;
    }
    showView(id);
  }
  $("ws-manage-profiles").addEventListener("click", () => { closeModal("ws-preferences"); action("profiles"); });
  function action(name) {
    if (name === 'preferences') return openModal('ws-preferences');
    const targets = { catalog: 'btn-open-db', obs: 'btn-open-obs', profiles: 'btn-open-streamer-profiles', feedback: 'btn-open-change-request' };
    $(targets[name])?.click();
  }
  sidebar.addEventListener('click', event => {
    const button = event.target.closest('[data-ws-route], [data-ws-action]');
    if (!button) return;
    if (button.dataset.wsRoute) navigate(button.dataset.wsRoute); else action(button.dataset.wsAction);
  });
  function refreshShell(view = currentActiveView) {
    const route = routes.find(r => r.id === view) || routes[0];
    $('ws-current-title').textContent = route.name;
    document.body.dataset.view = route.id;
    sidebar.querySelectorAll('[data-ws-route]').forEach(button => {
      const active = button.dataset.wsRoute === route.id;
      button.classList.toggle('is-active', active);
      if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
      button.classList.toggle('requires-login', !state.twitchUser && button.dataset.wsRoute !== 'view-landing');
    });
    $('ws-summary-channel').textContent = '#' + state.targetChannel.replace(/^#/, '');
    $('ws-summary-connection').textContent = state.twitchUser ? 'Verbunden als ' + (state.twitchUser.display_name || state.twitchUser.login) : 'Noch nicht verbunden';
    $('ws-summary-connection').classList.toggle('is-connected', !!state.twitchUser);
    document.querySelector('.landing-subtitle').textContent = state.twitchUser ? 'Deine Tools sind bereit. Womit geht es los?' : 'Ein klarer Überblick. Kurze Wege. Mehr Zeit für die Community.';
    $('icon-custom-dashboard').innerHTML = icon('dashboard');
  }
  function applyStart() {
    if (!ready || startApplied || !state.twitchUser) return;
    startApplied = true;
    let target = storage.get('start', 'view-landing');
    if (target === 'last') target = storage.get('last', 'view-landing');
    if (routes.some(r => r.id === target)) showView(target);
  }
  window.addEventListener('swg:view-changed', event => {
    refreshShell(event.detail);
    storage.set('last', event.detail);
  });
  window.addEventListener('swg:auth-changed', () => { refreshShell(); applyStart(); });
  window.addEventListener('swg:ready', () => { ready = true; refreshShell(); applyStart(); });
  $('select-active-streamer-profile').addEventListener('change', () => queueMicrotask(refreshShell));
  function setCollapsed(collapsed) {
    document.body.classList.toggle('ws-collapsed', collapsed);
    $('ws-collapse').setAttribute('aria-expanded', String(!collapsed));
    $('ws-collapse').setAttribute('aria-label', collapsed ? 'Navigation ausklappen' : 'Navigation einklappen');
    $('ws-collapse').title = $('ws-collapse').getAttribute('aria-label');
    storage.set('collapsed', String(collapsed));
  }
  $('ws-collapse').addEventListener('click', () => setCollapsed(!document.body.classList.contains('ws-collapsed')));
  setCollapsed(storage.get('collapsed') === 'true');
  $('ws-start-view').value = storage.get('start', 'view-landing');
  $('ws-start-view').addEventListener('change', e => storage.set('start', e.target.value));
  for (const [name, cssClass] of [['density', 'ws-compact'], ['motion', 'ws-reduced-motion']]) {
    const input = $('ws-' + name);
    input.checked = storage.get(name) === 'true';
    document.body.classList.toggle(cssClass, input.checked);
    input.addEventListener('change', () => { document.body.classList.toggle(cssClass, input.checked); storage.set(name, String(input.checked)); });
  }
  $('ws-copy-obs').addEventListener('click', async () => {
    try {
      const info = await ipcRenderer.invoke('obs:get-info');
      await ipcRenderer.invoke('app:copy-clipboard', info.localUrl);
      showToast('Lokalen OBS-Link kopiert.', 'success');
    } catch { showToast('OBS-Link konnte nicht kopiert werden.', 'error'); }
  });
  function openModal(id) { previousFocus = document.activeElement; $(id).classList.remove('hidden'); if (id === 'ws-palette') { $('ws-query').value = ''; renderResults(); } requestAnimationFrame(() => $(id).querySelector('input, select, button')?.focus()); }
  function closeModal(id) { $(id).classList.add('hidden'); previousFocus?.focus(); }
  document.querySelectorAll('[data-ws-close]').forEach(button => button.addEventListener('click', () => closeModal(button.dataset.wsClose)));
  document.querySelectorAll('.ws-modal').forEach(modal => modal.addEventListener('click', event => { if (event.target === modal) closeModal(modal.id); }));
  const commands = [...routes.map(r => ({ ...r, run: () => navigate(r.id) })),
    ...[['catalog', 'Katalog & Datenbank', 'catalog'], ['obs', 'OBS-Overlay', 'screen'], ['profiles', 'Streamer-Profile', 'settings'], ['preferences', 'Einstellungen', 'settings'], ['feedback', 'Feedback & Wünsche', 'feedback']].map(([id,name,glyph])=>({id,name,icon:glyph,run:()=>action(id)}))];
  function renderResults() {
    const query = $('ws-query').value.toLocaleLowerCase('de').trim();
    visibleCommands = commands.filter(c => `${c.name} ${c.description || ''} ${c.keys || ''}`.toLocaleLowerCase('de').includes(query));
    paletteIndex = 0;
    $('ws-results').innerHTML = visibleCommands.length ? visibleCommands.map((c,i)=>`<div class="ws-command" id="ws-result-${i}" data-command-index="${i}" role="option" aria-selected="${i === 0}">${icon(c.icon)}<span>${c.name}</span><small>${c.description ? 'Modul' : 'Werkzeug'}</small></div>`).join('') : '<p class="ws-search-empty">Kein Treffer. Versuche „Setup“, „Timer“ oder „Katalog“.</p>';
    updateSelection();
  }
  function updateSelection() {
    $('ws-results').querySelectorAll('[data-command-index]').forEach((el,i)=>el.setAttribute('aria-selected', String(i===paletteIndex)));
    const option = $('ws-result-' + paletteIndex);
    if (option) { $('ws-query').setAttribute('aria-activedescendant', option.id); option.scrollIntoView({block:'nearest'}); }
    else $('ws-query').removeAttribute('aria-activedescendant');
  }
  function runCommand(index) { const command = visibleCommands[index]; if (command) { closeModal('ws-palette'); command.run(); } }
  $('ws-results').addEventListener('click', e => { const item = e.target.closest('[data-command-index]'); if (item) runCommand(Number(item.dataset.commandIndex)); });
  $('ws-query').addEventListener('input', renderResults);
  $('ws-search').addEventListener('click', () => openModal('ws-palette'));
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); event.stopImmediatePropagation(); openModal('ws-palette'); return; }
    const ownModal = document.querySelector('.ws-modal:not(.hidden)');
    if (event.key === 'Escape' && ownModal) { event.preventDefault(); event.stopImmediatePropagation(); closeModal(ownModal.id); return; }
    if (ownModal?.id === 'ws-palette' && ['ArrowDown','ArrowUp','Enter'].includes(event.key)) {
      event.preventDefault();
      if (event.key === 'Enter') runCommand(paletteIndex);
      else { paletteIndex = Math.max(0,Math.min(visibleCommands.length-1,paletteIndex+(event.key==='ArrowDown'?1:-1))); updateSelection(); }
      return;
    }
    if (event.altKey && /^[1-9]$/.test(event.key) && !document.querySelector('.modal-overlay:not(.hidden)')) { event.preventDefault(); navigate(routes[Number(event.key)-1].id); }
    if (event.key === 'Tab') {
      const modals = [...document.querySelectorAll('.modal-overlay:not(.hidden)')];
      const modal = modals.at(-1);
      if (!modal) return;
      const focusable = [...modal.querySelectorAll('button, input, select, textarea, a[href], [tabindex="0"]')].filter(el=>!el.disabled && el.getClientRects().length);
      const first = focusable[0], last = focusable.at(-1);
      if (!first) return;
      if (event.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    }
  }, true);
  for (const [source, target] of [['hub-modchat-unread','view-modchat'], ['hub-qna-unread','view-qna']]) {
    const original = $(source);
    const badge = sidebar.querySelector(`[data-unread-for="${target}"]`);
    new MutationObserver(() => { badge.textContent = original.textContent; badge.classList.toggle('hidden', original.classList.contains('hidden')); }).observe(original, {attributes:true, childList:true, characterData:true, subtree:true});
  }
  document.querySelectorAll('.modal-overlay').forEach((modal,i) => {
    modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true');
    const title = modal.querySelector('.modal-header h2, .modal-header h3');
    if (title) { if (!title.id) title.id = `ws-dialog-title-${i}`; modal.setAttribute('aria-labelledby', title.id); }
  });
  refreshShell();
})();


