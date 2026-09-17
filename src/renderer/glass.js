/* Presentation only: move existing DOM nodes, never clone controls or alter state.
 * All event handlers, IDs, inputs and domain controllers remain attached.
 */
(() => {
  'use strict';
  const find = selector => document.querySelector(selector);
  const make = (className, tag = 'div') => Object.assign(document.createElement(tag), { className });
  document.body.classList.add('swg-glass');

  // One page heading contains the original navigation and module actions.
  document.querySelectorAll('.hub-view-pane').forEach(pane => {
    const heading = pane.querySelector('.ws-module-heading');
    const actions = pane.querySelector('.tool-sub-header');
    if (!heading || !actions) return;
    const masthead = make('glass-masthead');
    heading.before(masthead);
    masthead.append(heading, actions);
  });

  // Editing and preview are peers. No fixed command bar covers form fields.
  const setup = find('#view-setup');
  const editor = make('glass-setup-editor');
  const companion = make('glass-setup-companion');
  const layout = make('glass-setup-layout');
  editor.append(setup.querySelector('.persons-section-card'), setup.querySelector('.global-extras-card'));
  companion.append(setup.querySelector('.generator-card'), find('#notes-card'));
  layout.append(editor, companion);
  setup.append(layout);

  // Name the areas without changing any action or generated command.
  const titles = [
    ['.persons-section-card .card-header h2', 'Personen & Ausstattung'],
    ['.global-extras-card .card-header h2', 'Kohle & Ergänzungen'],
    ['.qa-card-yt h3', 'Videos finden & teilen'],
    ['.qa-card-full:not(.qa-card-yt) h3', 'Deine Chat-Befehle']
  ];
  titles.forEach(([selector, title]) => { const node = find(selector); if (node) node.textContent = title; });
  const generatorTitle = setup.querySelector('.generator-header h2');
  const length = find('#command-length-badge');
  generatorTitle.replaceChildren(document.createTextNode('Live-Vorschau '), length);

  // Add section labels to existing surfaces; no extra frame around content.
  [['.persons-section-card','01 / SETUP'], ['.global-extras-card','02 / ERGÄNZEN'],
   ['.generator-card','03 / TEILEN']].forEach(([selector,label]) => {
    const section = setup.querySelector(selector);
    section.dataset.glassSection = label;
  });
  find('#onboarding-hint span').replaceChildren();
  find('#onboarding-hint span').append(document.createTextNode('Personen ausfüllen, bei Bedarf ergänzen und die Live-Vorschau prüfen. Mit Strg+Enter senden.'));

  // Layout hooks refer to complete existing cards, not their functional internals.
  const quick = find('.qa-grid-container');
  [...quick.children].forEach((card, index) => card.dataset.glassArea = ['stream','clip','raid','commands','videos'][index]);
  const quickPrimary = make('glass-action-primary');
  const quickSupport = make('glass-action-support');
  ['stream','raid','videos'].forEach(area => quickPrimary.append(quick.querySelector(`[data-glass-area="${area}"]`)));
  ['clip','commands'].forEach(area => quickSupport.append(quick.querySelector(`[data-glass-area="${area}"]`)));
  quick.append(quickPrimary, quickSupport);

  const glyphs = {
    stream: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/>',
    clip: '<path d="m5 3 14 18M5 21l8-10 6-8"/><circle cx="5" cy="7" r="3"/><circle cx="5" cy="17" r="3"/>',
    raid: '<path d="M4 12h15m-6-6 6 6-6 6M4 5v14"/>',
    commands: '<path d="m13 2-9 12h7l-1 8 10-13h-7z"/>',
    videos: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m10 9 5 3-5 3z"/>'
  };
  quick.querySelectorAll('[data-glass-area]').forEach(card => {
    card.querySelector('.qa-header-icon').innerHTML = `<svg class="ws-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${glyphs[card.dataset.glassArea]}</svg>`;
  });

  // Keep meaning, statuses and emoji pickers. Remove purely decorative emoji
  // from initial control labels that already contain readable text.
  document.querySelectorAll('.hub-view-pane button, .hub-view-pane label, .modal-header h3, .modal-header h2').forEach(element => {
    if (element.matches('[data-emoji], .btn-marker-tag, .btn-chat-emoji')) return;
    for (const node of element.childNodes) {
      if (node.nodeType !== Node.TEXT_NODE) continue;
      const clean = node.textContent.replace(/^(\s*)(?:\p{Extended_Pictographic}[\uFE0F\u200D\p{Extended_Pictographic}]*\s*)+/u, '$1');
      if (/[\p{L}\p{N}]/u.test(clean)) node.textContent = clean;
    }
  });
  document.querySelectorAll('.poll-empty-state .empty-hint').forEach(node => {
    node.textContent = node.textContent.replace('unten', 'im Vorlagenbereich').replace('rechts', 'im Formular');
  });
  // Remove redundant navigation visually, retaining the original controls and
  // all real actions (Q&A listener, OBS links, dashboard management).
  document.querySelectorAll('.glass-masthead').forEach(masthead => {
    if (!masthead.querySelector('button:not(.btn-back-hub),select,input,a[href]')) masthead.classList.add('glass-navigation-only');
  });
  const svg=paths=>`<svg class="ws-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  find('#btn-open-streamer-profiles').innerHTML=svg('<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M18 15a5 5 0 0 1 3 5"/>')+'<span>Profile</span>';
  find('#btn-twitch-logout').innerHTML=svg('<path d="m6 6 12 12M18 6 6 18"/>');
  find('#btn-twitch-logout').setAttribute('aria-label','Von Twitch abmelden');
})();
