const { ipcRenderer } = require('electron');
const {
  levenshteinDistance,
  similarityScore,
  findBestFuzzyMatch,
  fuzzyFilterList,
  checkDuplicateFuzzy,
  getItemName,
  SHISHA_SYNONYMS
} = require('./fuzzy');

// App State
let state = {
  personCount: 1, // Default 1 person
  catalog: {
    pipes: [],
    bowls: [],
    hmds: [],
    tobacco: [],
    charcoal: []
  },
  persons: [],
  twitchUser: null,
  targetChannel: 'marved', // Default channel: marved
  currentDbTab: 'tab-tobacco',
  clientId: '',
  expandedOptionalCards: new Set() // track which person cards have optional fields open
};

// DOM Elements
const personsContainer = document.getElementById('persons-container');
const personCountLabel = document.getElementById('person-count-label');
const btnIncPersons = document.getElementById('btn-inc-persons');
const commandOutput = document.getElementById('command-output');
const btnCopy = document.getElementById('btn-copy');
const btnSendChat = document.getElementById('btn-send-chat');
const btnFetchChatSetup = document.getElementById('btn-fetch-chat-setup');
const btnTwitchLogin = document.getElementById('btn-twitch-login');
const btnTwitchLogout = document.getElementById('btn-twitch-logout');
const twitchUserBadge = document.getElementById('twitch-user-badge');
const userAvatar = document.getElementById('user-avatar');
const userDisplayName = document.getElementById('user-display-name');
const targetChannelInput = document.getElementById('target-channel-input');
const targetBotInput = document.getElementById('target-bot-input');
const inputGlobalKohle = document.getElementById('input-global-kohle');
const inputGlobalExtra = document.getElementById('input-global-extra');
const inputGlobalPromo = document.getElementById('input-global-promo');
const selectPromoTarget = document.getElementById('select-promo-target');
const chkIncludePromoDesc = document.getElementById('chk-include-promo-desc');
const newItemDescInput = document.getElementById('new-item-desc-input');
const btnResetAll = document.getElementById('btn-reset-all');
const btnToggleNotes = document.getElementById('btn-toggle-notes');
const notesCard = document.getElementById('notes-card');
const btnClearNotes = document.getElementById('btn-clear-notes');
const notesTextarea = document.getElementById('notes-textarea');
const commandLengthBadge = document.getElementById('command-length-badge');
const toastBanner = document.getElementById('toast-banner');
const toastMessage = document.getElementById('toast-message');

// Twitch Modal Elements
const twitchModal = document.getElementById('twitch-modal');
const btnCloseTwitchModal = document.getElementById('btn-close-twitch-modal');
const btnGetTmiToken = document.getElementById('btn-get-tmi-token');
const inputOauthToken = document.getElementById('input-oauth-token');
const btnSaveToken = document.getElementById('btn-save-token');
const inputClientId = document.getElementById('input-client-id');
const btnStartBrowserOauth = document.getElementById('btn-start-browser-oauth');
const linkTwitchDev = document.getElementById('link-twitch-dev');

// Database Modal Elements
const btnOpenDb = document.getElementById('btn-open-db');
const dbModal = document.getElementById('db-modal');
const btnCloseDbModal = document.getElementById('btn-close-db-modal');
const newItemInput = document.getElementById('new-item-input');
const btnAddDbItem = document.getElementById('btn-add-db-item');
const catalogListItems = document.getElementById('catalog-list-items');

// Import Menu & Paste Modal Elements
const btnImportMenu = document.getElementById('btn-import-menu');
const importDropdownMenu = document.getElementById('import-dropdown-menu');
const btnOpenPasteModal = document.getElementById('btn-open-paste-modal');
const pasteModal = document.getElementById('paste-modal');
const btnClosePasteModal = document.getElementById('btn-close-paste-modal');
const inputPasteText = document.getElementById('input-paste-text');
const btnPasteFromClipboard = document.getElementById('btn-paste-from-clipboard');
const btnApplyPasteSetup = document.getElementById('btn-apply-paste-setup');

// Auto-Updater Modal Elements
const updaterModal = document.getElementById('updater-modal');
const btnCloseUpdaterModal = document.getElementById('btn-close-updater-modal');
const btnUpdaterSkip = document.getElementById('btn-updater-skip');
const btnUpdaterAction = document.getElementById('btn-updater-action');
const btnCheckUpdates = document.getElementById('btn-check-updates');
const updaterText = document.getElementById('updater-text');
const updaterProgressContainer = document.getElementById('updater-progress-container');
const updaterStatusText = document.getElementById('updater-status-text');
const updaterPercent = document.getElementById('updater-percent');
const updaterProgressBar = document.getElementById('updater-progress-bar');
let updateState = 'available';

// Live Stream Status & Hub Nav Elements
const streamStatusPill = document.getElementById('stream-status-pill');
const streamStatusDot = document.getElementById('stream-status-dot');
const streamStatusText = document.getElementById('stream-status-text');

// Initialize App
async function initApp() {
  setupHubNavigation();

  try {
    await loadCatalog();
  } catch (e) {
    console.error('Error loading catalog:', e);
  }
  try {
    await checkTwitchAuth();
  } catch (e) {
    console.error('Error checking Twitch auth:', e);
  }
  try {
    initDefaultPersons();
    renderPersonsGrid();
  } catch (e) {
    console.error('Error rendering grid:', e);
  }
  try {
    setupEventListeners();
  } catch (e) {
    console.error('Error setting up listeners:', e);
  }
  try {
    setupQuickActionsListeners();
  } catch (e) {
    console.error('Error setting up quick actions:', e);
  }
  try {
    setupModHQListeners();
  } catch (e) {
    console.error('Error setting up Mod-HQ:', e);
  }
  try {
    setupGiveawaysListeners();
  } catch (e) {
    console.error('Error setting up Giveaways:', e);
  }
  try {
    setupUpdaterEvents();
  } catch (e) {
    console.error('Error setting up updater:', e);
  }
  try {
    generateCommandString();
  } catch (e) {
    console.error('Error generating command:', e);
  }

  // Check live stream status immediately & every 60 seconds
  checkLiveStreamStatus();
  setInterval(checkLiveStreamStatus, 60000);

  // Start global background watcher for Mod-HQ Team-Chat notifications
  startGlobalModChatWatcher();

  // Auto-focus on first name field
  const firstNameInput = document.querySelector('.input-p-name');
  if (firstNameInput) firstNameInput.focus();

  // Auto-sync community catalog from GitHub & HookahTools on startup
  setTimeout(async () => {
    try {
      const res = await ipcRenderer.invoke('db:sync-github');
      if (res && res.success) {
        state.catalog = res.catalog;
        updateDatalists();
        const tobaccoMsg = res.tobaccoCount ? `${res.tobaccoCount} Tabaksorten von HookahTools` : 'Tabak';
        showToast(`Katalog synchronisiert (${tobaccoMsg} & Hardware)!`, 'success');
      }
    } catch(e) {}
  }, 2000);
}

let currentActiveView = 'view-landing';
let unreadModChatCount = 0;
let lastSeenModChatTimestamp = 0;
let globalModChatInterval = null;

// Hub Navigation & View Switcher
function showView(targetViewId) {
  currentActiveView = targetViewId;
  const viewPanes = document.querySelectorAll('.hub-view-pane');
  viewPanes.forEach(pane => pane.classList.add('hidden'));

  const targetPane = document.getElementById(targetViewId);
  if (targetPane) {
    targetPane.classList.remove('hidden');
  }

  // Toggle Hotkey Bulb (only show in Setup Manager)
  const hotkeyBulbWrapper = document.querySelector('.hotkey-bulb-wrapper');
  if (hotkeyBulbWrapper) {
    if (targetViewId === 'view-setup') {
      hotkeyBulbWrapper.classList.remove('hidden');
    } else {
      hotkeyBulbWrapper.classList.add('hidden');
    }
  }

  // If opening setup manager, auto-focus first input
  if (targetViewId === 'view-setup') {
    const firstNameInput = document.querySelector('.input-p-name');
    if (firstNameInput) firstNameInput.focus();
  }

  // If opening Quick-Actions, load current channel title & game
  if (targetViewId === 'view-quickactions') {
    loadStreamChannelInfo();
  }

  // If opening Mod-HQ, start real-time chat sync & load panels, reset unread badge
  if (targetViewId === 'view-modchat') {
    unreadModChatCount = 0;
    const badge = document.getElementById('hub-modchat-unread');
    if (badge) {
      badge.classList.add('hidden');
      badge.textContent = '0';
    }
    lastSeenModChatTimestamp = Date.now();
    startModHQSync();
  } else {
    stopModHQSync();
  }

  // If opening Giveaways, start live sync of winners history for all mods
  if (targetViewId === 'view-giveaways') {
    loadGiveawayWinnersHistory();
    if (!giveawaySyncInterval) {
      giveawaySyncInterval = setInterval(loadGiveawayWinnersHistory, 5000);
    }
  } else {
    if (giveawaySyncInterval) {
      clearInterval(giveawaySyncInterval);
      giveawaySyncInterval = null;
    }
  }
}

function setupHubNavigation() {
  // Tile clicks on Landing Page
  const hubTiles = document.querySelectorAll('.hub-tile-card');
  hubTiles.forEach(tile => {
    tile.addEventListener('click', () => {
      const targetViewId = tile.getAttribute('data-target');
      if (targetViewId) showView(targetViewId);
    });

    // Keyboard Accessibility (Enter or Space to open tile)
    tile.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const targetViewId = tile.getAttribute('data-target');
        if (targetViewId) showView(targetViewId);
      }
    });
  });

  // Back buttons inside tool views
  const backButtons = document.querySelectorAll('.btn-back-hub');
  backButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      showView('view-landing');
    });
  });

  // Global ESC key shortcut: Return to landing page if no modal is open
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const openModal = document.querySelector('.modal-overlay:not(.hidden)');
      if (openModal) return; // let modal close handler handle ESC if any

      const landingPane = document.getElementById('view-landing');
      if (landingPane && landingPane.classList.contains('hidden')) {
        e.preventDefault();
        showView('view-landing');
      }
    }
  });
}

// Check Live Stream Status
async function checkLiveStreamStatus() {
  if (!streamStatusText || !streamStatusDot) return;
  const channel = (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved';

  try {
    const res = await ipcRenderer.invoke('twitch:check-stream-status', channel);
    if (res && res.live) {
      streamStatusDot.className = 'status-indicator-dot red pulse';
      const viewers = res.viewer_count !== undefined ? ` (${res.viewer_count.toLocaleString('de-DE')} 👁️)` : '';
      const game = res.game_name ? ` • ${res.game_name}` : '';
      streamStatusText.textContent = `#${channel}: 🔴 LIVE${viewers}${game}`;
      if (streamStatusPill) {
        streamStatusPill.title = `Live: ${res.title || 'Stream'}\nSpiel: ${res.game_name || '-'}\nZuschauer: ${res.viewer_count || 0}`;
      }
    } else {
      streamStatusDot.className = 'status-indicator-dot grey';
      streamStatusText.textContent = `#${channel}: Offline`;
      if (streamStatusPill) {
        streamStatusPill.title = `Kanal #${channel} ist aktuell offline.`;
      }
    }
  } catch (err) {
    streamStatusDot.className = 'status-indicator-dot grey';
    streamStatusText.textContent = `#${channel}: Offline`;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// Load Database Catalog
async function loadCatalog() {
  state.catalog = await ipcRenderer.invoke('db:get-catalog');
  updateDatalists();
}

// Update person count label text
function updatePersonCountLabel() {
  if (personCountLabel) {
    personCountLabel.textContent = state.personCount === 1
      ? '1 Person'
      : `${state.personCount} Personen`;
  }
}


function updateDatalists() {
  populateDatalist('list-pipes', state.catalog.pipes || []);

  const allBowls = state.catalog.bowls || [];
  const normalBowls = allBowls.filter(b => {
    if (typeof b === 'object') return !b.isElectric;
    return !b.toLowerCase().includes('xkah');
  });
  const electricBowls = allBowls.filter(b => {
    if (typeof b === 'object') return !!b.isElectric;
    return b.toLowerCase().includes('xkah');
  });

  populateDatalist('list-bowls', normalBowls);
  populateDatalist('list-electric-bowls', electricBowls);

  populateDatalist('list-vases', state.catalog.vases || []);
  populateDatalist('list-hmds', state.catalog.hmds || []);
  populateDatalist('list-tobacco', state.catalog.tobacco || []);
  populateDatalist('list-charcoal', state.catalog.charcoal || []);
  populateDatalist('list-persons', state.catalog.persons || []);
  populateDatalist('list-tastings', state.catalog.tastings || []);
  populateDatalist('list-promos', state.catalog.promos || []);
}

function populateDatalist(elementId, items) {
  const datalist = document.getElementById(elementId);
  if (!datalist) return;
  datalist.innerHTML = items.map(item => {
    const val = typeof item === 'string' ? item : item.name;
    return `<option value="${escapeHtml(val)}"></option>`;
  }).join('');
}

// Check Twitch Authentication
async function checkTwitchAuth() {
  const authData = await ipcRenderer.invoke('twitch:check-auth');
  if (authData && authData.user) {
    state.twitchUser = authData.user;
    if (authData.targetChannel) {
      state.targetChannel = authData.targetChannel;
      targetChannelInput.value = state.targetChannel;
    }
    if (authData.clientId) {
      state.clientId = authData.clientId;
      inputClientId.value = state.clientId;
    }
    updateTwitchUI();
  } else {
    const cfg = await ipcRenderer.invoke('twitch:get-config');
    if (cfg && cfg.clientId) {
      state.clientId = cfg.clientId;
      inputClientId.value = state.clientId;
    }
  }
  updateChannelBotTooltips();
}

function updateChannelBotTooltips() {
  if (targetChannelInput) {
    const val = targetChannelInput.value.trim() || 'marved';
    targetChannelInput.title = `Ziel-Kanal: #${val}`;
  }
  if (targetBotInput) {
    const val = targetBotInput.value.trim() || 'marvedbot';
    targetBotInput.title = `Bot-Name: @${val}`;
  }
}

function updateTwitchUI() {
  const previewModName = document.getElementById('preview-mod-name');
  const userColorPicker = document.getElementById('user-color-picker');
  const savedColor = localStorage.getItem('swg_user_color') || (state.twitchUser && state.twitchUser.color ? state.twitchUser.color : '#FF7F00');

  if (state.twitchUser) {
    btnTwitchLogin.classList.add('hidden');
    twitchUserBadge.classList.remove('hidden');
    const name = state.twitchUser.display_name || state.twitchUser.login;
    userDisplayName.textContent = name;
    userAvatar.src = state.twitchUser.profile_image_url || 'https://static-cdn.jtvnw.net/user-default-pictures-uv/75305db0-3a59-4d70-9050-0b42c497426a-profile_image-70x70.png';
    if (previewModName) {
      previewModName.textContent = `${name}:`;
      previewModName.style.color = savedColor;
    }
    if (userColorPicker) {
      userColorPicker.value = savedColor.startsWith('#') ? savedColor : '#FF7F00';
    }
  } else {
    btnTwitchLogin.classList.remove('hidden');
    twitchUserBadge.classList.add('hidden');
    if (previewModName) {
      previewModName.textContent = 'Mod:';
      previewModName.style.color = savedColor;
    }
  }
}

// Default Initial Persons Setup (Default: 1 Person, Empty Fields)
function initDefaultPersons() {
  state.persons = [
    {
      name: '',
      pipe: '',
      bowl: '',
      hmd: '',
      tobaccos: ['']
    }
  ];
}

// Render Person Cards Grid
function renderPersonsGrid() {
  personsContainer.innerHTML = '';

  for (let i = 0; i < state.personCount; i++) {
    let p = state.persons[i];
    if (!p) {
      p = {
        name: '',
        pipe: '',
        bowl: '',
        hmd: '',
        tobaccos: ['']
      };
      state.persons[i] = p;
    }

    if (!p.tobaccos || p.tobaccos.length === 0) {
      p.tobaccos = [''];
    }

    const card = document.createElement('div');
    card.className = 'person-card';
    card.setAttribute('data-index', i);

    // Build Tobacco Slot HTML
    const tobaccoSlotsHtml = (p.tobaccos || ['']).map((tVal, tIdx) => `
      <div class="tobacco-slot-row">
        <div class="clearable-input-wrapper" style="flex:1;">
          <input type="text" class="input-p-tob" data-pindex="${i}" data-tindex="${tIdx}" list="list-tobacco" value="${escapeHtml(tVal)}" placeholder="Tabak ${tIdx + 1}">
          <button class="btn-clear-field ${tVal ? '' : 'hidden'}" tabindex="-1" title="Feld leeren">✕</button>
        </div>
        ${tIdx > 0 ? `<button class="btn-icon btn-remove-tobacco-slot" data-pindex="${i}" data-tindex="${tIdx}" title="Tabaksortenslot entfernen">✕</button>` : ''}
      </div>
    `).join('');

    const isElectric = !!p.isElectric;
    const isOptionalOpen = state.expandedOptionalCards.has(i) || !!(p.vessel || p.vesselColor);
    const optTabIndex = isOptionalOpen ? '0' : '-1';

    card.innerHTML = `
      <div class="person-card-header">
        <div class="person-title">
          <span class="person-number-badge">Person ${i + 1}</span>
          <span class="person-name-display">${escapeHtml(p.name || `Person ${i + 1}`)}</span>
        </div>
        <div class="person-header-actions" style="display:flex; align-items:center; gap:12px;">
          <label class="checkbox-label" style="font-size: 0.78rem; color: var(--accent-cyan);" title="Kennzeichnet diese Person als E-Gerät Nutzer (z. B. XKAH Lite / Pro)">
            <input type="checkbox" class="chk-p-electric" tabindex="-1" data-index="${i}" ${isElectric ? 'checked' : ''}>
            <span>⚡ E-Gerät</span>
          </label>
          <button class="btn-icon btn-clear-person" tabindex="-1" data-index="${i}" title="Person entfernen">✕</button>
        </div>
      </div>

      <div class="input-row">
        <div class="input-group">
          <label>Name:</label>
          <div class="clearable-input-wrapper">
            <input type="text" class="input-p-name" data-index="${i}" value="${escapeHtml(p.name)}" placeholder="z. B. Marvin">
            <button class="btn-clear-field ${p.name ? '' : 'hidden'}" tabindex="-1" title="Feld leeren">✕</button>
          </div>
        </div>
        <div class="input-group">
          <label>Pfeife:</label>
          <div class="clearable-input-wrapper">
            <input type="text" class="input-p-pipe" data-index="${i}" list="list-pipes" value="${escapeHtml(p.pipe)}" placeholder="z. B. Amotion Futr">
            <button class="btn-clear-field ${p.pipe ? '' : 'hidden'}" tabindex="-1" title="Feld leeren">✕</button>
          </div>
        </div>
      </div>

      <button class="optional-fields-toggle" tabindex="-1" aria-expanded="${isOptionalOpen ? 'true' : 'false'}" data-card-index="${i}">
        <svg class="toggle-chevron" viewBox="0 0 24 24" width="12" height="12"><path fill="currentColor" d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>
        Glas / Bowl ${(p.vessel || p.vesselColor) ? '✓' : '(optional)'}
      </button>
      <div class="optional-fields-collapsible ${isOptionalOpen ? '' : 'collapsed'}">
        <div class="optional-fields-box">
          <div class="input-row">
            <div class="input-group">
              <label class="label-optional">Bowl / Glas (optional):</label>
              <div class="clearable-input-wrapper">
                <input type="text" class="input-p-vessel" tabindex="${optTabIndex}" data-index="${i}" list="list-vases" value="${escapeHtml(p.vessel || '')}" placeholder="z. B. Caesar Crystal">
                <button class="btn-clear-field ${p.vessel ? '' : 'hidden'}" tabindex="-1" title="Feld leeren">✕</button>
              </div>
            </div>
            <div class="input-group">
              <label class="label-optional">Bowl-Farbe (optional):</label>
              <div class="clearable-input-wrapper">
                <input type="text" class="input-p-vessel-color" tabindex="${optTabIndex}" data-index="${i}" value="${escapeHtml(p.vesselColor || '')}" placeholder="z. B. Clear, Amber">
                <button class="btn-clear-field ${p.vesselColor ? '' : 'hidden'}" tabindex="-1" title="Feld leeren">✕</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="input-row">
        <div class="input-group" style="${isElectric ? 'grid-column: 1 / -1;' : ''}">
          <label>${isElectric ? '⚡ E-Gerät:' : 'Kopf:'}</label>
          <div class="clearable-input-wrapper">
            <input type="text" class="input-p-bowl" data-index="${i}" list="${isElectric ? 'list-electric-bowls' : 'list-bowls'}" value="${escapeHtml(p.bowl)}" placeholder="${isElectric ? 'z. B. XKAH Lite oder Pro' : 'z. B. Cosmo Bowl'}">
            <button class="btn-clear-field ${p.bowl ? '' : 'hidden'}" tabindex="-1" title="Feld leeren">✕</button>
          </div>
        </div>
        ${!isElectric ? `
        <div class="input-group">
          <label>HMD:</label>
          <div class="clearable-input-wrapper">
            <input type="text" class="input-p-hmd" data-index="${i}" list="list-hmds" value="${escapeHtml(p.hmd)}" placeholder="z. B. ONMO HMD">
            <button class="btn-clear-field ${p.hmd ? '' : 'hidden'}" tabindex="-1" title="Feld leeren">✕</button>
          </div>
        </div>
        ` : ''}
      </div>

      <div class="input-group full-width tobacco-mix-wrapper">
        <label>Tabaksorte(n):</label>
        <div class="tobacco-mix-inputs">
          ${tobaccoSlotsHtml}
        </div>
      </div>
    `;

    personsContainer.appendChild(card);
  }

  attachCardInputListeners();
}

// Attach Live Input Event Listeners
function attachCardInputListeners() {
  document.querySelectorAll('.person-card input').forEach(input => {
    input.addEventListener('input', (e) => {
      const pIdx = parseInt(e.target.getAttribute('data-index'));
      
      if (e.target.classList.contains('input-p-tob')) {
        const personIdx = parseInt(e.target.getAttribute('data-pindex'));
        const tobIdx = parseInt(e.target.getAttribute('data-tindex'));
        if (!isNaN(personIdx) && state.persons[personIdx]) {
          state.persons[personIdx].tobaccos[tobIdx] = e.target.value;

          // Seamless Auto-expand: typing into the last slot automatically appends a new empty slot!
          if (tobIdx === state.persons[personIdx].tobaccos.length - 1 && e.target.value.trim() !== '') {
            state.persons[personIdx].tobaccos.push('');
            renderPersonsGrid();
            const newInputs = document.querySelectorAll(`.input-p-tob[data-pindex="${personIdx}"]`);
            if (newInputs[tobIdx]) {
              newInputs[tobIdx].focus();
              newInputs[tobIdx].setSelectionRange(e.target.value.length, e.target.value.length);
            }
          }
        }
      } else if (!isNaN(pIdx) && state.persons[pIdx]) {
        const p = state.persons[pIdx];
        if (e.target.classList.contains('input-p-name')) {
          p.name = e.target.value;
          const card = e.target.closest('.person-card');
          if (card) {
            const nameDisplay = card.querySelector('.person-name-display');
            if (nameDisplay) nameDisplay.textContent = p.name || `Person ${pIdx + 1}`;
          }
        } else if (e.target.classList.contains('input-p-pipe')) {
          p.pipe = e.target.value;
        } else if (e.target.classList.contains('input-p-vessel')) {
          p.vessel = e.target.value;
        } else if (e.target.classList.contains('input-p-vessel-color')) {
          p.vesselColor = e.target.value;
        } else if (e.target.classList.contains('input-p-bowl')) {
          p.bowl = e.target.value;
        } else if (e.target.classList.contains('input-p-hmd')) {
          p.hmd = e.target.value;
        }
      }

      // Auto-fill Person 1 name with 'Marvin' if any field of Person 1 has content and name is empty/default
      const personIndexForCheck = !isNaN(pIdx) ? pIdx : (typeof personIdx !== 'undefined' ? personIdx : null);
      if (personIndexForCheck === 0 && !e.target.classList.contains('input-p-name')) {
        const p1 = state.persons[0];
        if (p1 && (!p1.name || p1.name.trim() === '' || p1.name === 'Person 1')) {
          const hasContent = !!(p1.pipe || p1.vessel || p1.vesselColor || p1.bowl || p1.hmd || (p1.tobaccos && p1.tobaccos.some(t => t && t.trim())));
          if (hasContent) {
            p1.name = 'Marvin';
            const nameInput = document.querySelector('.input-p-name[data-index="0"]');
            if (nameInput) {
              nameInput.value = 'Marvin';
              const clearBtn = nameInput.parentElement ? nameInput.parentElement.querySelector('.btn-clear-field') : null;
              if (clearBtn) clearBtn.classList.remove('hidden');
            }
            const nameDisplay = document.querySelector('.person-card[data-index="0"] .person-name-display');
            if (nameDisplay) nameDisplay.textContent = 'Marvin';
          }
        }
      }

      generateCommandString();
    });
  });

  // Remove Tobacco Slot Button
  document.querySelectorAll('.btn-remove-tobacco-slot').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const pIdx = parseInt(e.currentTarget.getAttribute('data-pindex'));
      const tIdx = parseInt(e.currentTarget.getAttribute('data-tindex'));
      if (!isNaN(pIdx) && state.persons[pIdx] && state.persons[pIdx].tobaccos[tIdx] !== undefined) {
        state.persons[pIdx].tobaccos.splice(tIdx, 1);
        if (state.persons[pIdx].tobaccos.length === 0) {
          state.persons[pIdx].tobaccos = [''];
        }
        renderPersonsGrid();
        generateCommandString();
      }
    });
  });

  // Remove Person Card Button
  document.querySelectorAll('.btn-clear-person').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.currentTarget.getAttribute('data-index'));
      if (!isNaN(idx) && state.persons[idx]) {
        if (state.personCount > 1) {
          state.persons.splice(idx, 1);
          state.personCount--;
          updatePersonCountLabel();
        } else {
          // If only 1 person, clear fields of the remaining card
          state.persons[0] = { name: '', pipe: '', vessel: '', vesselColor: '', bowl: '', hmd: '', tobaccos: [''], isElectric: false };
        }
        renderPersonsGrid();
        generateCommandString();
      }
    });
  });

  // Electric E-Gerät Checkbox Listener
  document.querySelectorAll('.chk-p-electric').forEach(chk => {
    chk.addEventListener('change', (e) => {
      const idx = parseInt(e.currentTarget.getAttribute('data-index'));
      if (!isNaN(idx) && state.persons[idx]) {
        state.persons[idx].isElectric = e.currentTarget.checked;
        renderPersonsGrid();
        generateCommandString();
      }
    });
  });

  // Optional Fields Toggle Listener
  document.querySelectorAll('.optional-fields-toggle').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const cardIdx = parseInt(e.currentTarget.getAttribute('data-card-index'));
      const collapsible = e.currentTarget.nextElementSibling;
      const isExpanded = e.currentTarget.getAttribute('aria-expanded') === 'true';
      if (isExpanded) {
        e.currentTarget.setAttribute('aria-expanded', 'false');
        collapsible.classList.add('collapsed');
        state.expandedOptionalCards.delete(cardIdx);
        collapsible.querySelectorAll('input').forEach(el => {
          if (!el.classList.contains('btn-clear-field')) el.setAttribute('tabindex', '-1');
        });
      } else {
        e.currentTarget.setAttribute('aria-expanded', 'true');
        collapsible.classList.remove('collapsed');
        state.expandedOptionalCards.add(cardIdx);
        collapsible.querySelectorAll('input').forEach(el => {
          if (!el.classList.contains('btn-clear-field')) el.setAttribute('tabindex', '0');
        });
      }
    });
  });
}

// Command Generator Logic
function generateCommandString() {
  let promoText = (inputGlobalPromo ? inputGlobalPromo.value : '').trim();
  const promoTarget = (selectPromoTarget ? selectPromoTarget.value : 'kohle');
  const includeDesc = chkIncludePromoDesc ? chkIncludePromoDesc.checked : true;

  if (promoText) {
    const match = promoText.match(/^([^\s(]+)(?:\s*\((.+)\))?$/);
    if (match) {
      let code = match[1].trim();
      if (!code.startsWith('!')) code = `!${code}`;
      const desc = match[2] ? match[2].trim() : '';

      if (desc && includeDesc) {
        promoText = `(${code} - ${desc})`;
      } else {
        promoText = code;
      }
    } else {
      if (!promoText.startsWith('!')) promoText = `!${promoText}`;
    }
  }

  const hasNonElectricPerson = state.persons.slice(0, state.personCount).some(p => {
    if (!p) return false;
    const bName = (p.bowl || '').toLowerCase();
    return !p.isElectric && !bName.includes('xkah') && !bName.includes('elektr') && !bName.includes('imoto') && !bName.includes('e-kopf');
  });

  const isMixedSetup = state.personCount > 1 && state.persons.slice(0, state.personCount).some(p => {
    if (!p) return false;
    const bName = (p.bowl || '').toLowerCase();
    return p.isElectric || bName.includes('xkah') || bName.includes('elektr') || bName.includes('imoto') || bName.includes('e-kopf');
  }) && hasNonElectricPerson;

  let kohle = hasNonElectricPerson ? (inputGlobalKohle ? inputGlobalKohle.value : '').trim() : '';
  let extra = (inputGlobalExtra ? inputGlobalExtra.value : '').trim();

  if (promoText) {
    if (promoTarget === 'kohle') {
      kohle = kohle ? `${kohle} ${promoText}` : promoText;
    } else if (promoTarget === 'extra') {
      extra = extra ? `${extra} ${promoText}` : promoText;
    }
  }

  const parts = [];

  for (let i = 0; i < state.personCount; i++) {
    const p = state.persons[i];
    if (!p) continue;

    const personSegments = [];
    const pName = (p.name || '').trim();

    let pipeVal = (p.pipe || '').trim();
    const vesselVal = (p.vessel || '').trim();
    const vesselColorVal = (p.vesselColor || '').trim();

    if (pipeVal) {
      if (vesselVal && vesselColorVal) {
        pipeVal = `${pipeVal} auf einer ${vesselVal} in ${vesselColorVal}`;
      } else if (vesselVal) {
        pipeVal = `${pipeVal} auf einer ${vesselVal}`;
      } else if (vesselColorVal) {
        pipeVal = `${pipeVal} in ${vesselColorVal}`;
      }
    }

    let bowlVal = (p.bowl || '').trim();
    let hmdVal = (p.hmd || '').trim();
    const isElec = !!p.isElectric || bowlVal.toLowerCase().includes('xkah') || bowlVal.toLowerCase().includes('elektr') || bowlVal.toLowerCase().includes('imoto') || bowlVal.toLowerCase().includes('e-kopf');

    if (promoText) {
      if (promoTarget === 'pipe' && pipeVal) pipeVal = `${pipeVal} ${promoText}`;
      if (promoTarget === 'bowl' && bowlVal) bowlVal = `${bowlVal} ${promoText}`;
      if (promoTarget === 'hmd' && hmdVal && !isElec) hmdVal = `${hmdVal} ${promoText}`;
    }

    if (pipeVal) personSegments.push(pipeVal);
    if (bowlVal) personSegments.push(bowlVal);
    if (hmdVal && !isElec) personSegments.push(hmdVal);

    const tobaccos = (p.tobaccos || [])
      .map(t => (t || '').replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim())
      .filter(Boolean);

    if (tobaccos.length > 0) {
      let tobStr = '';
      if (tobaccos.length === 1) {
        tobStr = tobaccos[0];
      } else if (tobaccos.length === 2) {
        tobStr = `${tobaccos[0]} und ${tobaccos[1]}`;
      } else {
        const last = tobaccos.pop();
        tobStr = `${tobaccos.join(', ')} und ${last}`;
      }
      personSegments.push(tobStr);
    }

    // If mixed setup (traditional + electric), place the charcoal on the traditional setup!
    if (isMixedSetup && !isElec && kohle) {
      personSegments.push(kohle);
    }

    if (personSegments.length > 0 || pName) {
      let personStr = '';
      if (state.personCount > 1 && pName) {
        personStr = `${pName}: ${personSegments.join(' // ')}`;
      } else {
        personStr = personSegments.join(' // ');
      }
      parts.push(personStr);
    }
  }

  let fullCommand = `!editsetup ${parts.join(' // ')}`;

  const globalParts = [];
  if (kohle && !isMixedSetup) globalParts.push(kohle);
  if (extra) globalParts.push(extra);

  if (globalParts.length > 0) {
    fullCommand += ` // ${globalParts.join(' // ')} //`;
  } else if (parts.length > 0) {
    fullCommand += ' //';
  }

  commandOutput.value = fullCommand;

  // Update Authentic Twitch-Chat Primary Output Box
  const previewModName = document.getElementById('preview-mod-name');
  const previewChatText = document.getElementById('preview-chat-text');
  if (previewModName) {
    const name = state.twitchUser ? (state.twitchUser.display_name || state.twitchUser.login) : 'Mod';
    previewModName.textContent = `${name}:`;
    const color = localStorage.getItem('swg_user_color') || (state.twitchUser && state.twitchUser.color ? state.twitchUser.color : '#FF7F00');
    previewModName.style.color = color;
  }
  if (previewChatText) {
    previewChatText.textContent = fullCommand;
  }

  const len = fullCommand.length;
  if (commandLengthBadge) {
    if (len > 500) {
      commandLengthBadge.classList.add('warning');
      commandLengthBadge.textContent = `⚠️ ${len} / 500 (Zu lang!)`;
    } else {
      commandLengthBadge.classList.remove('warning');
      commandLengthBadge.textContent = `${len} / 500`;
    }
  }
}

// Clean & Robust Parser for Chat Setup Messages
function parseChatSetupMessage(rawText) {
  if (!rawText) return false;

  // Clean non-printable CTCP control characters and ACTION prefix
  let text = rawText.replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim();
  text = text.replace(/^ACTION\s+/i, '').trim();

  // Strip bot user prefix e.g. "marvedbot: Marvin: ..." or custom bot prefix
  const botName = (state.targetBot || 'marvedbot').trim().toLowerCase();
  const botReg = new RegExp(`^${botName}:\\s*`, 'i');
  text = text.replace(botReg, '');
  text = text.replace(/^([a-zA-Z0-9_]+):\s*(?=[a-zA-Z0-9_]+\s*:)/, '');
  text = text.replace(/^!editsetup\s+/i, '').replace(/^!setup\s+/i, '').trim();

  const segments = text.split('//').map(s => s.replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim()).filter(Boolean);
  if (segments.length === 0) return false;

  const parsedPersons = [];
  let globalKohle = '';
  let globalExtra = '';
  let sharedBowl = '';
  let sharedHmd = '';

  for (const seg of segments) {
    // Check if segment contains person name pattern "Name: ..."
    if (seg.includes(':')) {
      const colonIdx = seg.indexOf(':');
      let pName = seg.substring(0, colonIdx).replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim();
      let pSetup = seg.substring(colonIdx + 1).replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim();

      // Clean bot prefixes or ACTION from name
      pName = pName.replace(/^(action|marvedbot|marved|bot)\s*/i, '').replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim();

      let pipe = '';
      let tobaccos = [];

      if (pSetup.includes('&')) {
        const parts = pSetup.split('&').map(x => x.replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim());
        pipe = parts[0];
        if (parts[1]) tobaccos.push(parts[1]);
      } else {
        pipe = pSetup;
      }

      parsedPersons.push({
        name: pName,
        pipe: pipe,
        bowl: '',
        hmd: '',
        tobaccos: tobaccos.length > 0 ? tobaccos : ['']
      });
    } else if (seg.toLowerCase().includes('!kohle') || seg.toLowerCase().includes('kohle') || seg.toLowerCase().includes('cubes')) {
      globalKohle = seg;
    } else if (seg.toLowerCase().includes('tasting') || seg.toLowerCase().includes('no aroma')) {
      globalExtra = seg;
    } else if (seg.toLowerCase().includes('hmd') || seg.toLowerCase().includes('grani') || seg.toLowerCase().includes('lotus')) {
      sharedHmd = seg;
    } else if (seg.toLowerCase().includes('bowl') || seg.toLowerCase().includes('phunnel') || seg.toLowerCase().includes('shot')) {
      if (seg.includes('und') && (seg.toLowerCase().includes('shot') || seg.toLowerCase().includes('darkside'))) {
        const parts = seg.split('und').map(x => x.trim());
        if (parsedPersons.length > 0) {
          if (!parsedPersons[0].tobaccos[0] || parsedPersons[0].tobaccos[0] === '') {
            parsedPersons[0].tobaccos[0] = parts[0];
          } else {
            parsedPersons[0].tobaccos.push(parts[0]);
          }
          if (parts[1]) sharedBowl = parts[1];
        } else {
          sharedBowl = seg;
        }
      } else {
        sharedBowl = seg;
      }
    } else {
      if (parsedPersons.length > 0) {
        if (!parsedPersons[0].tobaccos[0]) {
          parsedPersons[0].tobaccos[0] = seg;
        } else {
          parsedPersons[0].tobaccos.push(seg);
        }
      } else {
        // Fallback: create default Person 1 (Marvin) if no colon was present
        parsedPersons.push({
          name: 'Marvin',
          pipe: seg,
          bowl: '',
          hmd: '',
          tobaccos: ['']
        });
      }
    }
  }

  // Fallback: if segments were found but no person matched, create default Person 1 (Marvin)
  if (parsedPersons.length === 0 && segments.length > 0) {
    parsedPersons.push({
      name: 'Marvin',
      pipe: segments[0] || '',
      bowl: sharedBowl,
      hmd: sharedHmd,
      tobaccos: segments.length > 1 ? [segments[1]] : ['']
    });
  }

  if (parsedPersons.length > 0) {
    state.personCount = parsedPersons.length;
    updatePersonCountLabel();

    const catalog = state.catalog || {};
    state.persons = parsedPersons.map(p => {
      let finalPipe = p.pipe;
      let finalBowl = p.bowl || sharedBowl;
      let finalHmd = p.hmd || sharedHmd;
      let isElec = !!p.isElectric;

      if (finalPipe && catalog.pipes) {
        const match = findBestFuzzyMatch(finalPipe, catalog.pipes, 0.65);
        if (match) finalPipe = match.name;
      }
      if (finalBowl && catalog.bowls) {
        const match = findBestFuzzyMatch(finalBowl, catalog.bowls, 0.65);
        if (match) {
          finalBowl = match.name;
          if (match.item && match.item.isElectric) isElec = true;
        }
      }
      if (finalHmd && catalog.hmds) {
        const match = findBestFuzzyMatch(finalHmd, catalog.hmds, 0.65);
        if (match) finalHmd = match.name;
      }

      const mappedTobaccos = (p.tobaccos || ['']).map(tob => {
        if (!tob || !catalog.tobacco) return tob;
        const match = findBestFuzzyMatch(tob, catalog.tobacco, 0.68);
        return match ? match.name : tob;
      });

      return {
        ...p,
        pipe: finalPipe,
        bowl: finalBowl,
        hmd: isElec ? '' : finalHmd,
        tobaccos: mappedTobaccos,
        isElectric: isElec
      };
    });

    if (globalKohle) {
      if (catalog.charcoal) {
        const match = findBestFuzzyMatch(globalKohle, catalog.charcoal, 0.65);
        if (match) globalKohle = match.name;
      }
      inputGlobalKohle.value = globalKohle;
    }
    if (globalExtra) inputGlobalExtra.value = globalExtra;

    renderPersonsGrid();
    generateCommandString();
    triggerAutoLearn();
    return true;
  }

  return false;
}

async function triggerAutoLearn() {
  try {
    const res = await ipcRenderer.invoke('db:auto-learn', {
      persons: state.persons,
      kohle: inputGlobalKohle ? inputGlobalKohle.value : '',
      extra: inputGlobalExtra ? inputGlobalExtra.value : ''
    });
    if (res && res.addedCount > 0) {
      state.catalog = res.catalog;
      updateDatalists();
      showToast(`${res.addedCount} neue(s) Element(e) automatisch in die Datenbank aufgenommen!`, 'success');
    }
  } catch(e) {}
}

const COMMON_PERSON_NAMES = [
  'marvin', 'marv', 'basti', 'gary', 'janni', 'yanni', 'dennis', 'daniel',
  'niklas', 'tim', 'alex', 'chris', 'jan', 'max', 'sven', 'leon', 'robin',
  'nils', 'lukas', 'jonas', 'paul', 'finn', 'elias', 'noah', 'luis', 'david', 'simon',
  'hannes', 'erik', 'marc', 'lars', 'julian', 'flo', 'stefan', 'micha', 'christian',
  'hasty', 'hastydj', 'bazztee', 'bazzteedj',
  'person 1', 'person 2', 'person 3', 'person 4', 'person 5', 'person 6'
];

const KNOWN_TOBACCO_TERMS = [
  'darkside', 'musthave', 'musth', 'pinkman', 'pynkman', 'black burn', 'burn', 'haribo',
  'holster', 'kaktuz', 'ice kaktuz', 'trofimoff', 'trofimoffs', 'zaghoul', 'anejo',
  'nameless', 'black nana', 'al massiva', 'massiva', 'handgemacht', 'tangiers',
  'fumari', 'social smoke', 'adalya', 'love 66', 'african queen', 'os tobacco',
  'fog your life', 'hookain', 'blaze', 'maridan', 'tingle tangle', 'revoshi', 'chaos',
  'superberry', 'intro', 'shot', 'falling star', 'wild forest', 'bounty hunter', 'space flavour'
];

function matchNotesToForm(text) {
  if (!text || text.trim().length < 2) {
    if (state.persons[0]) {
      const pName = state.persons[0].name || 'Marvin';
      state.persons[0] = { name: pName, pipe: '', vessel: '', vesselColor: '', bowl: '', hmd: '', tobaccos: [''], isElectric: false };
    }
    if (inputGlobalKohle) inputGlobalKohle.value = '';
    renderPersonsGrid();
    generateCommandString();
    return;
  }

  const catalog = state.catalog || {};
  const origText = text.trim();
  const lowerText = origText.toLowerCase();
  const capitalize = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : '';

  // 1. Gather all catalog gear for structure lookahead
  const dbPersons = (catalog.persons || []).map(p => getItemName(p).toLowerCase());
  const allKnownPersons = Array.from(new Set([...COMMON_PERSON_NAMES, ...dbPersons]));

  const pipesList = (catalog.pipes || []).map(p => getItemName(p).toLowerCase());
  const bowlsList = (catalog.bowls || []).map(b => getItemName(b).toLowerCase());
  const hmdsList = (catalog.hmds || []).map(h => getItemName(h).toLowerCase());
  const charcoalList = (catalog.charcoal || []).map(c => getItemName(c).toLowerCase());
  const tobaccoList = (catalog.tobacco || []).map(t => getItemName(t).toLowerCase());

  function isKnownGearToken(tok) {
    if (!tok || tok.length < 2) return false;
    if (SHISHA_SYNONYMS[tok]) return true;
    const allGear = [...pipesList, ...bowlsList, ...hmdsList, ...charcoalList, ...tobaccoList, ...KNOWN_TOBACCO_TERMS];
    return allGear.some(item => {
      const parts = item.split(/[\s-]+/);
      return parts.some(p => p === tok || similarityScore(p, tok) >= 0.82);
    });
  }

  function isKnownPipeOrBowl(tok, nextTok = '') {
    const combined = nextTok ? `${tok} ${nextTok}` : tok;
    if (pipesList.some(p => p.includes(tok) || p.includes(combined)) || bowlsList.some(b => b.includes(tok) || b.includes(combined))) return true;
    if (SHISHA_SYNONYMS[tok] || (nextTok && SHISHA_SYNONYMS[combined])) return true;
    return false;
  }

  // 2. Multi-Person Delimiter Detection (//, \n, ;, or strict known person names / Name: prefix)
  let rawSegments = [];

  if (origText.includes('//')) {
    rawSegments = origText.split(/\/{2,}/);
  } else if (origText.includes('\n')) {
    rawSegments = origText.split(/\n+/);
  } else if (origText.includes(';')) {
    rawSegments = origText.split(/;+/);
  } else {
    // Continuous text: Scan strictly for KNOWN person names or explicit "Name:" pattern
    const words = lowerText.split(/\s+/).filter(Boolean);
    const origWords = origText.split(/\s+/).filter(Boolean);
    const foundIndices = [];

    for (let i = 0; i < words.length; i++) {
      const cleanW = words[i].replace(/[:;,]/g, '');
      const isColonName = words[i].endsWith(':') && cleanW.length >= 2;
      const isKnownPerson = allKnownPersons.includes(cleanW);

      if (isColonName || (isKnownPerson && (i === 0 || isKnownPipeOrBowl(words[i - 1])))) {
        foundIndices.push({ index: i, name: cleanW });
      }
    }

    if (foundIndices.length > 0) {
      // If there is text before the first person name, that's Person 1
      if (foundIndices[0].index > 0) {
        rawSegments.push(origWords.slice(0, foundIndices[0].index).join(' '));
      }

      for (let k = 0; k < foundIndices.length; k++) {
        const startIdx = foundIndices[k].index;
        const endIdx = (k + 1 < foundIndices.length) ? foundIndices[k + 1].index : origWords.length;
        rawSegments.push(origWords.slice(startIdx, endIdx).join(' '));
      }
    } else {
      rawSegments = [origText];
    }
  }

  rawSegments = rawSegments.map(s => s.trim()).filter(Boolean);

  // Global Charcoal Scanner
  let globalCharcoal = '';
  const isCharcoalWord = lowerText.includes('zauber') || lowerText.includes('cubes') || lowerText.includes('magic') || lowerText.includes('blackcoco') || lowerText.includes('kohle');
  if (isCharcoalWord) {
    const charcoalList = catalog.charcoal || [];
    for (const c of charcoalList) {
      const cName = getItemName(c);
      const cLower = cName.toLowerCase();
      if (lowerText.includes('zauber') && (cLower.includes('zauber') || cLower.includes('magic'))) { globalCharcoal = cName; break; }
      if (lowerText.includes('magic') && cLower.includes('magic')) { globalCharcoal = cName; break; }
      if (lowerText.includes('cubes') && cLower.includes('cubes')) { globalCharcoal = cName; break; }
      if (lowerText.includes('blackcoco') && cLower.includes('black')) { globalCharcoal = cName; break; }
    }
    if (!globalCharcoal) {
      const cMatch = findBestFuzzyMatch(lowerText, charcoalList, 0.65);
      globalCharcoal = cMatch ? cMatch.name : (charcoalList[0] ? getItemName(charcoalList[0]) : 'Magic Charcoal (4x 26er - ehem. Zauberwürfel)');
    }
  }

  // Global Tasting Scanner
  let globalExtra = '';
  const isTastingWord = lowerText.includes('no aroma') || lowerText.includes('blind') || lowerText.includes('tasting');
  if (isTastingWord) {
    const tastingList = catalog.tastings || [];
    if (lowerText.includes('no aroma')) {
      const match = tastingList.find(t => getItemName(t).toLowerCase().includes('no aroma'));
      globalExtra = match ? getItemName(match) : 'Trofimoffs No Aroma Tasting';
    } else if (lowerText.includes('blind')) {
      const match = tastingList.find(t => getItemName(t).toLowerCase().includes('blind'));
      globalExtra = match ? getItemName(match) : 'Blind Tasting im Stream';
    } else {
      const tMatch = findBestFuzzyMatch(lowerText, tastingList, 0.65);
      if (tMatch) globalExtra = tMatch.name;
    }
  }

  // Filter out pure charcoal or tasting segments if delimited
  const candidateSegments = [];
  for (const seg of rawSegments) {
    const sLower = seg.toLowerCase();
    const isPureCharcoal = (sLower.includes('zauber') || sLower.includes('cubes') || sLower.includes('magic') || sLower.includes('blackcoco')) && !Object.values(catalog).flat().some(item => {
      const iName = getItemName(item).toLowerCase();
      if ((catalog.charcoal || []).some(c => getItemName(c).toLowerCase() === iName)) return false;
      return sLower.includes(iName.split(' ')[0]);
    }) && !allKnownPersons.some(n => sLower.includes(n));

    const isPureTasting = (sLower.includes('no aroma') || sLower.includes('blind') || sLower === 'tasting') && !allKnownPersons.some(n => sLower.includes(n));

    if (!isPureCharcoal && !isPureTasting) {
      candidateSegments.push(seg);
    }
  }

  const segmentsToProcess = candidateSegments.length > 0 ? candidateSegments : [origText];
  const newPersons = [];

  for (let idx = 0; idx < segmentsToProcess.length; idx++) {
    const seg = segmentsToProcess[idx];
    const sLower = seg.toLowerCase();
    const tokens = sLower.split(/[\s,./\\;:+&|]+/).filter(t => t.length > 0);
    const usedIndices = new Set();

    // 1. Name Scanner
    let matchedName = `Person ${idx + 1}`;
    if (seg.includes(':')) {
      const colonPrefix = seg.split(':')[0].trim();
      if (colonPrefix.length > 0) {
        matchedName = capitalize(colonPrefix);
        const prefixTokens = colonPrefix.toLowerCase().split(/[\s,./\\;:+&|]+/).filter(Boolean);
        for (let i = 0; i < prefixTokens.length && i < tokens.length; i++) {
          usedIndices.add(i);
        }
      }
    } else if (tokens[0] && allKnownPersons.includes(tokens[0])) {
      matchedName = capitalize(tokens[0]);
      usedIndices.add(0);
    }

    // Auto-fill Person 1 name with 'Marvin' if not explicitly given another name
    if (idx === 0 && (!matchedName || matchedName === 'Person 1')) {
      matchedName = 'Marvin';
    }

    // Step 1: Hardware Gear Scanners (Highest score selection & unambiguous brand tokens)
    function scanCategory(catList) {
      if (!catList || catList.length === 0) return null;
      let best = null;
      let highestScore = 0;

      function findFromSynonym(syn) {
        if (!syn) return null;
        const s = syn.toLowerCase().trim();
        let m = catList.find(item => getItemName(item).toLowerCase().trim() === s);
        if (m) return m;
        m = catList.find(item => getItemName(item).toLowerCase().trim().includes(s));
        if (m) return m;
        m = catList.find(item => s.includes(getItemName(item).toLowerCase().trim()));
        if (m) return m;
        return null;
      }

      // 1. Three-word windows (e.g. 'aeon edition 6', 'moze breeze pro', 'cosmo bowl shot')
      for (let i = 0; i <= tokens.length - 3; i++) {
        if (usedIndices.has(i) || usedIndices.has(i + 1) || usedIndices.has(i + 2)) continue;
        const window3 = `${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`;
        const syn = SHISHA_SYNONYMS[window3];
        if (syn) {
          const match = findFromSynonym(syn);
          if (match) {
            const score = 1.0;
            if (score > highestScore) {
              highestScore = score;
              best = { name: getItemName(match), item: match, indices: [i, i + 1, i + 2] };
            }
          }
        }
        const m3 = findBestFuzzyMatch(window3, catList, 0.70);
        if (m3 && m3.score > highestScore) {
          highestScore = m3.score;
          best = { name: m3.name, item: m3.item, indices: [i, i + 1, i + 2] };
        }
      }

      // 2. Two-word windows
      for (let i = 0; i < tokens.length - 1; i++) {
        if (usedIndices.has(i) || usedIndices.has(i + 1)) continue;
        const window2 = `${tokens[i]} ${tokens[i + 1]}`;
        const syn = SHISHA_SYNONYMS[window2];
        if (syn) {
          const match = findFromSynonym(syn);
          if (match) {
            const score = 1.0;
            if (score > highestScore) {
              highestScore = score;
              best = { name: getItemName(match), item: match, indices: [i, i + 1] };
            }
          }
        }
        const m2 = findBestFuzzyMatch(window2, catList, 0.70);
        if (m2 && m2.score > highestScore) {
          highestScore = m2.score;
          best = { name: m2.name, item: m2.item, indices: [i, i + 1] };
        }
      }

      // 3. Single tokens
      for (let i = 0; i < tokens.length; i++) {
        if (usedIndices.has(i)) continue;
        const tok = tokens[i];
        if (tok.length < 2) continue;
        if (tok === 'dark' || tok === 'darkside') continue;

        const syn = SHISHA_SYNONYMS[tok];
        if (syn) {
          const match = findFromSynonym(syn);
          if (match) {
            const score = 0.95;
            if (score > highestScore) {
              highestScore = score;
              best = { name: getItemName(match), item: match, indices: [i] };
            }
          }
        }
        const m1 = findBestFuzzyMatch(tok, catList, 0.70);
        if (m1 && m1.score > highestScore) {
          highestScore = m1.score;
          best = { name: m1.name, item: m1.item, indices: [i] };
        }
      }

      if (best && best.indices) {
        best.indices.forEach(idx => usedIndices.add(idx));
      }
      return best;
    }

    const pipeMatch = scanCategory(catalog.pipes || []);
    const pipe = pipeMatch ? pipeMatch.name : '';

    let bowl = '';
    let isElectric = false;
    if (sLower.includes('xkah') || sLower.includes('xk-ah') || sLower.includes('xk ah') || sLower.includes('xklite') || sLower.includes('xkpro')) {
      bowl = (sLower.includes('pro') || sLower.includes('xkpro')) ? (catalog.bowls && catalog.bowls.some(b => getItemName(b).includes('Pro')) ? 'XKAH Pro E-Kopf & E-HMD' : 'XKAH Pro') : (catalog.bowls && catalog.bowls.some(b => getItemName(b).includes('LITE')) ? 'XKAH LITE E-Kopf & E-HMD' : 'XKAH Lite');
      isElectric = true;
    } else {
      const bowlMatch = scanCategory(catalog.bowls || []);
      if (bowlMatch) {
        bowl = bowlMatch.name;
        if (bowlMatch.item && bowlMatch.item.isElectric) isElectric = true;
      }
    }

    let hmd = '';
    if (!isElectric) {
      const hmdMatch = scanCategory(catalog.hmds || []);
      if (hmdMatch) hmd = hmdMatch.name;
    }

    const vesselMatch = scanCategory(catalog.vases || []);
    const vessel = vesselMatch ? vesselMatch.name : '';

    // Pre-reserve charcoal tokens in usedIndices so they are NEVER matched as tobacco
    for (let i = 0; i <= tokens.length - 2; i++) {
      if (usedIndices.has(i) || usedIndices.has(i + 1)) continue;
      const w2 = `${tokens[i]} ${tokens[i + 1]}`;
      if (w2 === 'magic charcoal' || w2 === 'magic cubes' || w2 === 'black coco' || w2 === 'black coco26' || w2 === 'black coco27' || w2 === 'zauber würfel' || w2 === 'zauber wuerfel' || w2 === 'one nation' || w2 === 'cocodice 27mm' || w2 === 'shaman 26mm') {
        usedIndices.add(i);
        usedIndices.add(i + 1);
      }
    }

    const CHARCOAL_SINGLE_TOKENS = new Set(['zauber', 'zauberwürfel', 'zauberwuerfel', 'cubes', 'blackcoco', 'charcoal', 'kohle', 'shaman', 'cocodice']);
    for (let i = 0; i < tokens.length; i++) {
      if (CHARCOAL_SINGLE_TOKENS.has(tokens[i])) {
        usedIndices.add(i);
      }
    }

    const isPersonTok = (tok) => allKnownPersons.includes(tok) || (matchedName && matchedName.toLowerCase() === tok);

    // Step 2: Multi-Word Tobacco Scanning (2-word & 3-word phrases on remaining tokens)
    const matchedTobaccos = [];
    for (let i = 0; i <= tokens.length - 3; i++) {
      if (usedIndices.has(i) || usedIndices.has(i + 1) || usedIndices.has(i + 2)) continue;
      if (isPersonTok(tokens[i]) || isPersonTok(tokens[i + 1]) || isPersonTok(tokens[i + 2])) continue;
      const w3 = `${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`;
      const syn = SHISHA_SYNONYMS[w3];
      if (syn && (catalog.tobacco || []).some(t => getItemName(t) === syn)) {
        matchedTobaccos.push(syn);
        usedIndices.add(i); usedIndices.add(i + 1); usedIndices.add(i + 2);
        continue;
      }
      const m = findBestFuzzyMatch(w3, catalog.tobacco || [], 0.75);
      if (m) {
        matchedTobaccos.push(m.name);
        usedIndices.add(i); usedIndices.add(i + 1); usedIndices.add(i + 2);
      }
    }

    for (let i = 0; i <= tokens.length - 2; i++) {
      if (usedIndices.has(i) || usedIndices.has(i + 1)) continue;
      if (isPersonTok(tokens[i]) || isPersonTok(tokens[i + 1])) continue;
      const w2 = `${tokens[i]} ${tokens[i + 1]}`;
      const syn = SHISHA_SYNONYMS[w2];
      if (syn && (catalog.tobacco || []).some(t => getItemName(t) === syn)) {
        matchedTobaccos.push(syn);
        usedIndices.add(i); usedIndices.add(i + 1);
        continue;
      }
      const m = findBestFuzzyMatch(w2, catalog.tobacco || [], 0.75);
      if (m) {
        matchedTobaccos.push(m.name);
        usedIndices.add(i); usedIndices.add(i + 1);
      }
    }

    // Step 3: Single-Token Tobacco Scanning for remaining unreserved tokens
    const HARDWARE_ONLY_TOKENS = new Set([
      'dark', 'shot', 'intro', 'aeon', 'edition', 'breeze', 'varity', 'futr', 'pedal',
      'flashbang', 'flash', 'bang', 'specter', 'fibonacci', 'cosmo', 'mumiya', 'mumia', 'vosku', 'litbowl',
      'onmo', 'nagrani', 'kaloud', 'lotus', 'cubes', 'magic', 'zauber', 'zauberwürfel', 'zauberwuerfel', 'xkah', 'smart', 'stratos',
      'ocean', 'kaif', 'solaris', 'vandenberg', 'oblako', 'moon', 'alpha',
      'charcoal', 'kohle', 'blackcoco', 'shaman', 'cocodice', 'würfel', 'wuerfel', '26er', '27er',
      ...allKnownPersons
    ]);

    for (let i = 0; i < tokens.length; i++) {
      if (usedIndices.has(i)) continue;
      const tok = tokens[i];
      if (tok.length < 3) continue;
      if (HARDWARE_ONLY_TOKENS.has(tok)) continue;
      if (isPersonTok(tok)) continue;

      const syn = SHISHA_SYNONYMS[tok];
      if (syn && (catalog.tobacco || []).some(t => getItemName(t) === syn)) {
        if (!matchedTobaccos.includes(syn)) matchedTobaccos.push(syn);
        usedIndices.add(i);
        continue;
      }
      const m = findBestFuzzyMatch(tok, catalog.tobacco || [], 0.70);
      if (m && !matchedTobaccos.includes(m.name)) {
        matchedTobaccos.push(m.name);
        usedIndices.add(i);
      }
    }

    newPersons.push({
      name: matchedName,
      pipe,
      bowl,
      hmd,
      vessel,
      vesselColor: '',
      tobaccos: matchedTobaccos.length > 0 ? [...matchedTobaccos, ''] : [''],
      isElectric
    });
  }

  state.personCount = Math.min(10, Math.max(1, newPersons.length));
  updatePersonCountLabel();
  state.persons = newPersons;

  if (inputGlobalKohle) {
    inputGlobalKohle.value = globalCharcoal;
    const btn = inputGlobalKohle.parentElement ? inputGlobalKohle.parentElement.querySelector('.btn-clear-field') : null;
    if (btn) btn.classList.toggle('hidden', !globalCharcoal);
  }

  if (inputGlobalExtra) {
    inputGlobalExtra.value = globalExtra;
    const btn = inputGlobalExtra.parentElement ? inputGlobalExtra.parentElement.querySelector('.btn-clear-field') : null;
    if (btn) btn.classList.toggle('hidden', !globalExtra);
  }

  renderPersonsGrid();
  generateCommandString();
}

// Global Event Listeners
function setupEventListeners() {
  // Person Count — only + button, count shown as label
  btnIncPersons.addEventListener('click', () => {
    if (state.personCount < 10) {
      state.personCount++;
      updatePersonCountLabel();
      renderPersonsGrid();
      generateCommandString();
    }
  });

  // Import Setup Dropdown Menu Toggle
  if (btnImportMenu && importDropdownMenu) {
    btnImportMenu.addEventListener('click', (e) => {
      e.stopPropagation();
      importDropdownMenu.classList.toggle('hidden');
    });

    document.addEventListener('click', () => {
      importDropdownMenu.classList.add('hidden');
    });

    importDropdownMenu.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  // Open Manual Paste Setup Modal
  if (btnOpenPasteModal) {
    btnOpenPasteModal.addEventListener('click', async () => {
      importDropdownMenu.classList.add('hidden');
      pasteModal.classList.remove('hidden');
      try {
        const text = await navigator.clipboard.readText();
        if (text && (text.includes('//') || text.includes(':'))) {
          inputPasteText.value = text;
        }
      } catch(e) {}
    });
  }

  if (btnClosePasteModal) {
    btnClosePasteModal.addEventListener('click', () => {
      pasteModal.classList.add('hidden');
    });
  }

  if (btnPasteFromClipboard) {
    btnPasteFromClipboard.addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          inputPasteText.value = text;
          showToast('Text aus Zwischenablage eingefügt', 'info');
        }
      } catch(e) {
        showToast('Konnte Zwischenablage nicht lesen', 'error');
      }
    });
  }

  if (btnApplyPasteSetup) {
    btnApplyPasteSetup.addEventListener('click', () => {
      const raw = inputPasteText.value.trim();
      if (!raw) {
        showToast('Bitte gib einen Setup-Text ein', 'error');
        return;
      }
      const success = parseChatSetupMessage(raw);
      if (success) {
        pasteModal.classList.add('hidden');
        inputPasteText.value = '';
        showToast('Setup erfolgreich übernommen!', 'success');
      } else {
        showToast('Konnte den Setup-Text nicht parsen. Bitte Format prüfen.', 'error');
      }
    });
  }

  // Extras & Promo input listeners
  if (inputGlobalKohle) inputGlobalKohle.addEventListener('input', generateCommandString);
  if (inputGlobalExtra) inputGlobalExtra.addEventListener('input', generateCommandString);
  if (inputGlobalPromo) inputGlobalPromo.addEventListener('input', generateCommandString);
  if (selectPromoTarget) selectPromoTarget.addEventListener('change', generateCommandString);

  // Target Channel Listener
  if (targetChannelInput) {
    targetChannelInput.addEventListener('input', () => {
      targetChannelInput.title = `Ziel-Kanal: #${targetChannelInput.value.trim() || 'marved'}`;
    });
    targetChannelInput.addEventListener('change', async () => {
      state.targetChannel = targetChannelInput.value.trim().toLowerCase() || 'marved';
      updateChannelBotTooltips();
      if (typeof updateObsUrls === 'function') updateObsUrls();
      await ipcRenderer.invoke('twitch:set-channel', state.targetChannel);
      checkLiveStreamStatus();
      showToast(`Ziel-Kanal auf #${state.targetChannel} gesetzt`, 'success');
    });
  }

  // Twitch Auth Listeners - 1-Click Seamless Browser Login
  btnTwitchLogin.addEventListener('click', async () => {
    showToast('Öffne Twitch-Login im Browser...', 'info');
    await ipcRenderer.invoke('twitch:login');
  });

  btnCloseTwitchModal.addEventListener('click', () => {
    twitchModal.classList.add('hidden');
  });

  // Direct Token link
  btnGetTmiToken.addEventListener('click', () => {
    ipcRenderer.invoke('app:open-external', 'https://twitchapps.com/tmi/');
  });

  if (linkTwitchDev) {
    linkTwitchDev.addEventListener('click', (e) => {
      e.preventDefault();
      ipcRenderer.invoke('app:open-external', 'https://dev.twitch.tv/console/apps');
    });
  }

  // Save Direct Token
  btnSaveToken.addEventListener('click', async () => {
    const rawToken = inputOauthToken.value.trim();
    if (!rawToken) {
      showToast('Bitte gib einen Token ein', 'error');
      return;
    }

    btnSaveToken.disabled = true;
    btnSaveToken.textContent = 'Prüfe...';

    const res = await ipcRenderer.invoke('twitch:save-token', rawToken);
    btnSaveToken.disabled = false;
    btnSaveToken.textContent = 'Verbinden';

    if (res.success) {
      state.twitchUser = res.user;
      updateTwitchUI();
      twitchModal.classList.add('hidden');
      inputOauthToken.value = '';
      checkLiveStreamStatus();
      showToast(`Erfolgreich eingeloggt als ${res.user.display_name || res.user.login}!`, 'success');
    } else {
      showToast(res.error || 'Ungültiger Twitch Token', 'error');
    }
  });

  // Browser OAuth with Client ID
  btnStartBrowserOauth.addEventListener('click', async () => {
    const customCid = inputClientId.value.trim();
    showToast('Öffne Twitch Login im Browser...', 'info');
    await ipcRenderer.invoke('twitch:login', customCid);
  });

  btnTwitchLogout.addEventListener('click', async () => {
    await ipcRenderer.invoke('twitch:logout');
    state.twitchUser = null;
    updateTwitchUI();
    checkLiveStreamStatus();
    showToast('Erfolgreich von Twitch abgemeldet', 'info');
  });

  ipcRenderer.on('twitch:authenticated', (event, { user }) => {
    state.twitchUser = user;
    updateTwitchUI();
    twitchModal.classList.add('hidden');
    checkLiveStreamStatus();
    showToast(`Erfolgreich eingeloggt als ${user.display_name || user.login}!`, 'success');
  });

  // User Chat Color Customization & Sync
  const previewModName = document.getElementById('preview-mod-name');
  const userColorPicker = document.getElementById('user-color-picker');

  if (previewModName && userColorPicker) {
    previewModName.style.cursor = 'pointer';
    previewModName.addEventListener('click', () => {
      userColorPicker.click();
    });

    userColorPicker.addEventListener('input', (e) => {
      const newColor = e.target.value;
      previewModName.style.color = newColor;
      localStorage.setItem('swg_user_color', newColor);
      ipcRenderer.invoke('twitch:set-color', newColor).catch(() => {});
    });
  }

  ipcRenderer.on('twitch:color-updated', (event, { color }) => {
    if (color) {
      localStorage.setItem('swg_user_color', color);
      if (previewModName) previewModName.style.color = color;
      if (userColorPicker) userColorPicker.value = color;
    }
  });

  // Query color from Twitch on startup
  ipcRenderer.invoke('twitch:get-color').then(c => {
    if (c) {
      localStorage.setItem('swg_user_color', c);
      if (previewModName) previewModName.style.color = c;
      if (userColorPicker) userColorPicker.value = c;
    }
  }).catch(() => {});

  // Fetch Setup from Twitch Chat
  btnFetchChatSetup.addEventListener('click', async () => {
    importDropdownMenu.classList.add('hidden');
    if (!state.twitchUser) {
      showToast('Bitte verbinde dich zuerst mit Twitch', 'error');
      return;
    }

    btnFetchChatSetup.disabled = true;
    showToast('Sende !setup und warte auf Antwort aus dem Chat...', 'info');

    const res = await ipcRenderer.invoke('twitch:fetch-setup', state.targetChannel);

    btnFetchChatSetup.disabled = false;

    if (res.success && res.res && res.res.text) {
      const parsed = parseChatSetupMessage(res.res.text);
      if (parsed) {
        showToast(`Setup erfolgreich aus dem Chat geladen (von ${res.res.author})!`, 'success');
      } else {
        showToast(`Antwort von ${res.res.author} erhalten, konnte aber nicht geparst werden.`, 'error');
      }
    } else {
      showToast(res.error || 'Fehler beim Laden des Setups aus dem Chat', 'error');
    }
  });

  // Copy to Clipboard
  btnCopy.addEventListener('click', async () => {
    const text = commandOutput.value;
    if (text) {
      await ipcRenderer.invoke('app:copy-clipboard', text);
      btnCopy.classList.add('copied');
      btnCopy.innerHTML = `✓ Kopiert!`;
      showToast('Befehl in Zwischenablage kopiert!', 'success');
      setTimeout(() => {
        btnCopy.classList.remove('copied');
        btnCopy.innerHTML = `<svg class="icon" viewBox="0 0 24 24"><path fill="currentColor" d="M19 21H8V7h11m0-2H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2m-3-4H4a2 2 0 0 0-2 2v14h2V3h12V1z"/></svg> Kopieren`;
      }, 1500);
    }
  });

  // Send to Twitch Chat
  btnSendChat.addEventListener('click', async () => {
    const message = commandOutput.value.trim();
    if (!message) {
      showToast('Kein Befehl zum Senden vorhanden', 'error');
      return;
    }

    if (message.length > 500) {
      showToast(`⚠️ Befehl ist zu lang (${message.length} / 500 Zeichen)! Er muss unter 500 Zeichen gekürzt werden.`, 'error');
      return;
    }

    if (!state.twitchUser) {
      showToast('Bitte verbinde dich zuerst mit Twitch', 'error');
      return;
    }

    btnSendChat.disabled = true;
    btnSendChat.innerHTML = '<span class="status-dot green"></span> Sende an Twitch Chat...';

    const res = await ipcRenderer.invoke('twitch:send-chat', {
      message,
      channel: state.targetChannel
    });

    btnSendChat.disabled = false;
    btnSendChat.innerHTML = `<svg class="icon-lg" viewBox="0 0 24 24"><path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg> In Twitch-Chat Senden (!editsetup)`;

    if (res.success) {
      showToast(`!editsetup Befehl in #${state.targetChannel} gesendet!`, 'success');
      triggerAutoLearn();

      // Publish confirmed setup to OBS Overlay Server & Cloud Gist
      const kohleVal = (inputGlobalKohle ? inputGlobalKohle.value : '').trim();
      const extraVal = (inputGlobalExtra ? inputGlobalExtra.value : '').trim();
      ipcRenderer.invoke('obs:publish-setup', {
        commandText: message,
        persons: state.persons,
        kohle: kohleVal,
        extra: extraVal
      }).catch(() => {});
    } else {
      showToast(`Fehler beim Senden: ${res.error}`, 'error');
    }
  });

  // Clearable Input Field Listeners (1-Click Clear Button ✕)
  document.addEventListener('input', (e) => {
    if (e.target && e.target.matches('.clearable-input-wrapper input')) {
      const btn = e.target.parentElement ? e.target.parentElement.querySelector('.btn-clear-field') : null;
      if (btn) {
        if (e.target.value.trim() !== '') btn.classList.remove('hidden');
        else btn.classList.add('hidden');
      }
    }
  });

  document.addEventListener('click', (e) => {
    if (e.target && e.target.matches('.btn-clear-field')) {
      e.preventDefault();
      const input = e.target.parentElement ? e.target.parentElement.querySelector('input') : null;
      if (input) {
        input.value = '';
        e.target.classList.add('hidden');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.focus();
      }
    }
  });

  // Hamburger Secondary Menu Toggle
  const btnHamburgerMenu = document.getElementById('btn-hamburger-menu');
  const hamburgerDropdownMenu = document.getElementById('hamburger-dropdown-menu');
  if (btnHamburgerMenu && hamburgerDropdownMenu) {
    btnHamburgerMenu.addEventListener('click', (e) => {
      e.stopPropagation();
      hamburgerDropdownMenu.classList.toggle('hidden');
      if (importDropdownMenu) importDropdownMenu.classList.add('hidden');
    });
  }

  // Promo Block Toggle
  const btnTogglePromo = document.getElementById('btn-toggle-promo');
  const promoBlock = document.getElementById('promo-block');
  if (btnTogglePromo && promoBlock) {
    btnTogglePromo.addEventListener('click', () => {
      const isExpanded = btnTogglePromo.getAttribute('aria-expanded') === 'true';
      btnTogglePromo.setAttribute('aria-expanded', isExpanded ? 'false' : 'true');
      promoBlock.classList.toggle('collapsed', isExpanded);
      promoBlock.querySelectorAll('input, select').forEach(el => {
        if (!el.classList.contains('btn-clear-field')) {
          el.setAttribute('tabindex', isExpanded ? '-1' : '0');
        }
      });
    });
  }

  // Power-User Hotkeys (Ctrl+N, Ctrl+L, Ctrl+Enter, Ctrl+Shift+C)
  document.addEventListener('keydown', (e) => {
    // Ctrl+N -> Focus notes textarea
    if ((e.ctrlKey || e.metaKey) && (e.key === 'n' || e.key === 'N') && !e.shiftKey) {
      e.preventDefault();
      if (notesCard && notesCard.classList.contains('hidden') && btnToggleNotes) {
        btnToggleNotes.click();
      }
      if (notesTextarea) {
        notesTextarea.focus();
        notesTextarea.select();
      }
    }
    // Ctrl+L -> Reset all
    if ((e.ctrlKey || e.metaKey) && (e.key === 'l' || e.key === 'L') && !e.shiftKey) {
      e.preventDefault();
      if (btnResetAll) btnResetAll.click();
    }
    // Ctrl+Shift+C -> Copy command
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'c' || e.key === 'C')) {
      e.preventDefault();
      if (btnCopy) btnCopy.click();
    }
    // Ctrl+Enter -> Send to chat
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (btnSendChat) btnSendChat.click();
    }
  });

  // OBS Stream Overlay Modal Elements
  const btnOpenObs = document.getElementById('btn-open-obs');
  const obsModal = document.getElementById('obs-modal');
  const btnCloseObsModal = document.getElementById('btn-close-obs-modal');
  const btnCloseObs = document.getElementById('btn-close-obs');
  const btnCopyObsCloud = document.getElementById('btn-copy-obs-cloud');
  const btnCopyObsLocal = document.getElementById('btn-copy-obs-local');
  const btnTestOverlayBrowser = document.getElementById('btn-test-overlay-browser');

  function updateObsUrls() {
    const chan = (state.targetChannel || 'marved').toLowerCase().replace('#', '').trim();
    const cloudInput = document.getElementById('obs-cloud-url');
    if (cloudInput) {
      cloudInput.value = `https://bazztee.github.io/shishawg-mod-setup-tool/overlay.html?channel=${chan}`;
    }
  }

  if (btnOpenObs && obsModal) {
    btnOpenObs.addEventListener('click', () => {
      updateObsUrls();
      obsModal.classList.remove('hidden');
      if (hamburgerDropdownMenu) hamburgerDropdownMenu.classList.add('hidden');
    });
  }
  if (btnCloseObsModal && obsModal) {
    btnCloseObsModal.addEventListener('click', () => obsModal.classList.add('hidden'));
  }
  if (btnCloseObs && obsModal) {
    btnCloseObs.addEventListener('click', () => obsModal.classList.add('hidden'));
  }
  if (btnCopyObsCloud) {
    btnCopyObsCloud.addEventListener('click', async () => {
      const url = document.getElementById('obs-cloud-url').value;
      await ipcRenderer.invoke('app:copy-clipboard', url);
      showToast('Cloud OBS-URL in Zwischenablage kopiert!', 'success');
    });
  }
  if (btnCopyObsLocal) {
    btnCopyObsLocal.addEventListener('click', async () => {
      const url = document.getElementById('obs-local-url').value;
      await ipcRenderer.invoke('app:copy-clipboard', url);
      showToast('Lokale OBS-URL in Zwischenablage kopiert!', 'success');
    });
  }
  if (btnTestOverlayBrowser) {
    btnTestOverlayBrowser.addEventListener('click', () => {
      const chan = (state.targetChannel || 'marved').toLowerCase().replace('#', '').trim();
      ipcRenderer.invoke('app:open-external', `https://bazztee.github.io/shishawg-mod-setup-tool/overlay.html?channel=${chan}`);
    });
  }

  // Onboarding Hint — show once on first ever launch
  const onboardingHint = document.getElementById('onboarding-hint');
  const btnDismissOnboarding = document.getElementById('btn-dismiss-onboarding');
  if (onboardingHint && !localStorage.getItem('swg_onboarding_done')) {
    onboardingHint.classList.remove('hidden');
    const onboardingTimer = setTimeout(() => {
      onboardingHint.classList.add('hidden');
      localStorage.setItem('swg_onboarding_done', '1');
    }, 8000);
    if (btnDismissOnboarding) {
      btnDismissOnboarding.addEventListener('click', () => {
        clearTimeout(onboardingTimer);
        onboardingHint.classList.add('hidden');
        localStorage.setItem('swg_onboarding_done', '1');
      });
    }
  }

  // Close all dropdowns when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.dropdown-wrapper')) {
      if (hamburgerDropdownMenu) hamburgerDropdownMenu.classList.add('hidden');
      if (importDropdownMenu) importDropdownMenu.classList.add('hidden');
    }
  });

  // Reset Form
  btnResetAll.addEventListener('click', () => {
    state.personCount = 1;
    updatePersonCountLabel();
    state.persons = [];
    if (notesTextarea) notesTextarea.value = '';
    if (inputGlobalKohle) inputGlobalKohle.value = '';
    if (inputGlobalExtra) inputGlobalExtra.value = '';
    if (inputGlobalPromo) inputGlobalPromo.value = '';
    if (selectPromoTarget) selectPromoTarget.value = 'kohle';
    if (chkIncludePromoDesc) chkIncludePromoDesc.checked = true;
    renderPersonsGrid();
    generateCommandString();
    showToast('Gesamtes Formular & Extras vollständig geleert', 'info');
  });

  // Notes Listeners
  if (btnToggleNotes && notesCard) {
    btnToggleNotes.addEventListener('click', () => {
      notesCard.classList.toggle('hidden');
      btnToggleNotes.classList.toggle('active', !notesCard.classList.contains('hidden'));
      if (!notesCard.classList.contains('hidden') && notesTextarea) {
        notesTextarea.focus();
      }
    });
  }

  if (btnClearNotes && notesTextarea) {
    btnClearNotes.addEventListener('click', () => {
      notesTextarea.value = '';
      if (state.persons[0]) {
        const pName = state.persons[0].name || 'Marvin';
        state.persons[0] = { name: pName, pipe: '', vessel: '', vesselColor: '', bowl: '', hmd: '', tobaccos: [''] };
      }
      if (inputGlobalKohle) inputGlobalKohle.value = '';
      renderPersonsGrid();
      generateCommandString();
      showToast('Notizen & Formular geleert', 'info');
    });
  }

  let notesDebounceTimer = null;
  if (notesTextarea) {
    notesTextarea.addEventListener('input', () => {
      if (notesDebounceTimer) clearTimeout(notesDebounceTimer);
      notesDebounceTimer = setTimeout(() => {
        matchNotesToForm(notesTextarea.value);
      }, 500);
    });

    notesTextarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        if (notesDebounceTimer) clearTimeout(notesDebounceTimer);
        matchNotesToForm(notesTextarea.value);
      }
    });

    notesTextarea.addEventListener('blur', () => {
      if (notesDebounceTimer) clearTimeout(notesDebounceTimer);
      matchNotesToForm(notesTextarea.value);
    });
  }

  // Target Bot Listener
  if (targetBotInput) {
    targetBotInput.addEventListener('input', () => {
      targetBotInput.title = `Bot-Name: @${targetBotInput.value.trim() || 'marvedbot'}`;
    });
    targetBotInput.addEventListener('change', () => {
      state.targetBot = targetBotInput.value.trim().toLowerCase() || 'marvedbot';
      updateChannelBotTooltips();
      generateCommandString();
      showToast(`Bot-Name zum Auslesen auf @${state.targetBot} gesetzt`, 'success');
    });
  }

  // Promo Checkbox Listener
  if (chkIncludePromoDesc) {
    chkIncludePromoDesc.addEventListener('change', generateCommandString);
  }

  // Database Modal Listeners
  btnOpenDb.addEventListener('click', () => {
    dbModal.classList.remove('hidden');
    renderCatalogList();
  });

  const btnSyncGithubDb = document.getElementById('btn-sync-github-db');
  if (btnSyncGithubDb) {
    btnSyncGithubDb.addEventListener('click', async () => {
      btnSyncGithubDb.disabled = true;
      btnSyncGithubDb.textContent = '🔄 Abgleich läuft...';
      const res = await ipcRenderer.invoke('db:sync-github');
      btnSyncGithubDb.disabled = false;
      btnSyncGithubDb.textContent = '🔄 Sync (HookahTools + GitHub)';
      if (res && res.success) {
        state.catalog = res.catalog;
        updateDatalists();
        renderCatalogList();
        const tobaccoMsg = res.tobaccoCount ? `${res.tobaccoCount} Tabaksorten von HookahTools` : 'Tabak';
        showToast(`Katalog synchronisiert (${tobaccoMsg} & Hardware)!`, 'success');
      } else {
        showToast('Konnte Katalog nicht abgleichen', 'error');
      }
    });
  }

  btnCloseDbModal.addEventListener('click', () => {
    dbModal.classList.add('hidden');
  });

  const lblIsElectric = document.getElementById('lbl-is-electric');
  const chkIsElectric = document.getElementById('chk-is-electric');

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      state.currentDbTab = e.target.getAttribute('data-tab');

      if (lblIsElectric) {
        if (state.currentDbTab === 'tab-bowls') {
          lblIsElectric.classList.remove('hidden');
        } else {
          lblIsElectric.classList.add('hidden');
        }
      }

      if (state.currentDbTab === 'tab-promos') {
        if (newItemInput) newItemInput.placeholder = 'Promo-Command (z. B. !xkah)...';
        if (newItemDescInput) newItemDescInput.classList.remove('hidden');
      } else {
        if (newItemInput) newItemInput.placeholder = 'Neues Element hinzufügen...';
        if (newItemDescInput) newItemDescInput.classList.add('hidden');
      }
      renderCatalogList();
    });
  });

  btnAddDbItem.addEventListener('click', async () => {
    const code = newItemInput.value.trim();
    if (!code) return;

    let itemVal = code;
    if (state.currentDbTab === 'tab-bowls' && chkIsElectric && chkIsElectric.checked) {
      itemVal = { name: code, isElectric: true };
    } else if (state.currentDbTab === 'tab-promos') {
      const desc = newItemDescInput ? newItemDescInput.value.trim() : '';
      if (desc) {
        itemVal = `${code} (${desc})`;
      }
    }

    const catKey = getCategoryKeyForTab(state.currentDbTab);
    const existingList = state.catalog[catKey] || [];
    const checkName = typeof itemVal === 'string' ? itemVal : itemVal.name;
    const dupCheck = checkDuplicateFuzzy(checkName, existingList);

    if (dupCheck.isExact) {
      showToast(`⚠️ "${dupCheck.matchName}" existiert bereits in dieser Kategorie!`, 'warning');
      return;
    }
    if (dupCheck.isNearDuplicate) {
      const pct = Math.round(dupCheck.similarity * 100);
      showToast(`⚠️ Ähnlicher Eintrag existiert bereits: "${dupCheck.matchName}" (${pct}% Ähnlichkeit)`, 'info');
    }

    const res = await ipcRenderer.invoke('db:add-item', { category: catKey, item: itemVal });
    if (res.success) {
      state.catalog = res.catalog;
      updateDatalists();
      newItemInput.value = '';
      if (newItemDescInput) newItemDescInput.value = '';
      if (chkIsElectric) chkIsElectric.checked = false;
      renderCatalogList();
      const addedName = typeof itemVal === 'string' ? itemVal : itemVal.name;
      showToast(`"${addedName}" zur Datenbank hinzugefügt`, 'success');
    } else {
      showToast(`Eintrag existiert bereits!`, 'warning');
    }
  });

  const dbSearchInput = document.getElementById('db-search-input');
  if (dbSearchInput) {
    dbSearchInput.addEventListener('input', renderCatalogList);
  }
}

// Auto-Updater Event Handlers
function setupUpdaterEvents() {
  if (btnCheckUpdates) {
    btnCheckUpdates.addEventListener('click', async () => {
      showToast('Prüfe auf Updates von GitHub...', 'info');
      const res = await ipcRenderer.invoke('updater:check');
      if (!res.success) {
        showToast(`Keine Verbindung zum GitHub-Update-Server (${res.error})`, 'info');
      }
    });
  }

  if (btnCloseUpdaterModal) {
    btnCloseUpdaterModal.addEventListener('click', () => {
      updaterModal.classList.add('hidden');
    });
  }

  if (btnUpdaterSkip) {
    btnUpdaterSkip.addEventListener('click', () => {
      updaterModal.classList.add('hidden');
    });
  }

  if (btnUpdaterAction) {
    btnUpdaterAction.addEventListener('click', async () => {
      if (updateState === 'available') {
        updateState = 'downloading';
        btnUpdaterAction.disabled = true;
        btnUpdaterAction.textContent = 'Lade herunter...';
        updaterProgressContainer.classList.remove('hidden');
        await ipcRenderer.invoke('updater:download');
      } else if (updateState === 'downloaded') {
        btnUpdaterAction.textContent = 'Starte Installation...';
        await ipcRenderer.invoke('updater:install');
      }
    });
  }

  ipcRenderer.on('updater:available', (event, info) => {
    updateState = 'available';
    updaterText.innerHTML = `Eine neue Version (<strong>v${info.version}</strong>) ist auf GitHub verfügbar!<br>Möchtest du sie jetzt herunterladen und installieren?`;
    btnUpdaterAction.disabled = false;
    btnUpdaterAction.textContent = 'Jetzt Updaten & Drüberinstallieren';
    updaterProgressContainer.classList.add('hidden');
    updaterModal.classList.remove('hidden');
  });

  ipcRenderer.on('updater:not-available', () => {
    showToast('Du verwendest bereits die neueste Version!', 'success');
  });

  ipcRenderer.on('updater:progress', (event, progressObj) => {
    const percent = Math.round(progressObj.percent || 0);
    updaterPercent.textContent = `${percent}%`;
    updaterProgressBar.style.width = `${percent}%`;
  });

  ipcRenderer.on('updater:downloaded', (event, info) => {
    updateState = 'downloaded';
    updaterStatusText.textContent = 'Download abgeschlossen!';
    updaterPercent.textContent = '100%';
    updaterProgressBar.style.width = '100%';
    btnUpdaterAction.disabled = false;
    btnUpdaterAction.textContent = 'Jetzt Neu Starten & Installieren';
  });

  ipcRenderer.on('updater:error', (event, errMessage) => {
    if (!errMessage) return;
    if (errMessage.includes('app-update.yml') || errMessage.includes('ENOENT') || errMessage.includes('dev-app-update.yml')) {
      return; // Silently ignore in portable test build
    }
    updaterStatusText.textContent = `Fehler: ${errMessage || 'Asset-Name auf GitHub weicht ab'}`;
    btnUpdaterAction.disabled = false;
    btnUpdaterAction.textContent = '🌐 Im Browser öffnen & Herunterladen';
    btnUpdaterAction.onclick = () => {
      ipcRenderer.invoke('app:open-external', 'https://github.com/BazZTee/shishawg-mod-setup-tool/releases/latest');
    };
    showToast(`Update-Fehler: ${errMessage}`, 'error');
  });

  // Display version tag
  ipcRenderer.invoke('app:get-version').then(ver => {
    const tag = document.getElementById('app-version-tag');
    if (tag) tag.textContent = `v${ver}`;
  }).catch(() => {});

  // Automatically check updates 3s after startup
  setTimeout(() => {
    ipcRenderer.invoke('updater:check').catch(() => {});
  }, 3000);
}

function getCategoryKeyForTab(tabId) {
  switch (tabId) {
    case 'tab-pipes': return 'pipes';
    case 'tab-bowls': return 'bowls';
    case 'tab-vases': return 'vases';
    case 'tab-hmds': return 'hmds';
    case 'tab-charcoal': return 'charcoal';
    case 'tab-persons': return 'persons';
    case 'tab-tastings': return 'tastings';
    case 'tab-promos': return 'promos';
    default: return 'tobacco';
  }
}

function renderCatalogList() {
  const catKey = getCategoryKeyForTab(state.currentDbTab);
  let items = state.catalog[catKey] || [];

  const dbSearchInput = document.getElementById('db-search-input');
  const searchVal = dbSearchInput ? dbSearchInput.value.trim() : '';
  if (searchVal) {
    items = fuzzyFilterList(searchVal, items, 0.40);
  }

  if (items.length === 0) {
    catalogListItems.innerHTML = `<p class="subtitle" style="text-align:center; padding: 12px;">${searchVal ? 'Keine Treffer gefunden' : 'Keine Einträge vorhanden'}</p>`;
    return;
  }

  catalogListItems.innerHTML = items.map((item, idx) => {
    const itemName = typeof item === 'string' ? item : item.name;
    const isElectricItem = typeof item === 'object' && item.isElectric;
    const isGistTobacco = catKey === 'tobacco' && (typeof item === 'object' ? (item.source === 'gist' || item.isCustom) : true);
    const isHookahToolsTobacco = catKey === 'tobacco' && (typeof item === 'object' && item.source === 'hookahtools');

    let displayHtml = `<span>${escapeHtml(itemName)}${isElectricItem ? ' <span class="char-badge" style="color:var(--accent-cyan); margin-left:6px;">⚡ Elektro</span>' : ''}</span>`;
    
    if (catKey === 'tobacco') {
      if (isGistTobacco) {
        displayHtml = `<span>${escapeHtml(itemName)} <span class="badge-source-gist" title="Eigene Custom-Sorte (bearbeitbar & löschbar)">🟢 Custom</span></span>`;
      } else if (isHookahToolsTobacco) {
        displayHtml = `<span>${escapeHtml(itemName)} <span class="badge-source-ht" title="Automatisch von HookahTools.de synchronisiert">🌐 HookahTools</span></span>`;
      }
    } else if (catKey === 'promos') {
      const match = itemName.match(/^([^\(]+?)(?:\s*\((.+)\))?$/);
      if (match) {
        const code = match[1].trim();
        const desc = match[2] ? match[2].trim() : '';
        displayHtml = `<span><strong class="promo-code">${escapeHtml(code)}</strong>${desc ? `<span class="promo-desc">(${escapeHtml(desc)})</span>` : ''}</span>`;
      }
    }

    const itemAttr = escapeHtml(typeof item === 'string' ? item : JSON.stringify(item));

    // Action buttons: HookahTools items have NEITHER trash nor edit button
    let actionsHtml = '';
    if (catKey === 'tobacco' && isHookahToolsTobacco) {
      actionsHtml = `<span class="ht-sync-info" title="Automatisch von HookahTools.de synchronisiert">🌐 Synchronisiert</span>`;
    } else {
      actionsHtml = `
        <div class="catalog-actions">
          <button class="btn-icon btn-edit-item" data-idx="${idx}" data-item="${itemAttr}" title="Bearbeiten">✏️</button>
          <button class="btn-icon btn-delete-item" data-item="${itemAttr}" title="Löschen">🗑️</button>
        </div>
      `;
    }

    const itemClass = (catKey === 'tobacco' && isGistTobacco) ? 'catalog-item item-source-gist catalog-item-fade' : 'catalog-item catalog-item-fade';

    return `
      <div class="${itemClass}" id="catalog-item-${idx}">
        <div class="item-view" style="display:flex; justify-content:space-between; align-items:center; width:100%;">
          ${displayHtml}
          ${actionsHtml}
        </div>
      </div>
    `;
  }).join('');

  // Attach Inline Edit Listener for ✏️
  catalogListItems.querySelectorAll('.btn-edit-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = e.currentTarget.getAttribute('data-idx');
      const oldItemStr = e.currentTarget.getAttribute('data-item');
      const itemContainer = document.getElementById(`catalog-item-${idx}`);
      if (!itemContainer) return;

      let oldObj = oldItemStr;
      try {
        if (oldItemStr.startsWith('{')) oldObj = JSON.parse(oldItemStr);
      } catch (err) {}

      const oldName = typeof oldObj === 'string' ? oldObj : oldObj.name;
      const oldIsElec = typeof oldObj === 'object' && oldObj.isElectric;

      if (catKey === 'promos') {
        let codeVal = oldName;
        let descVal = '';
        const match = oldName.match(/^([^\(]+?)(?:\s*\((.+)\))?$/);
        if (match) {
          codeVal = match[1].trim();
          descVal = match[2] ? match[2].trim() : '';
        }

        itemContainer.innerHTML = `
          <div class="inline-edit-box">
            <input type="text" id="inline-code-${idx}" value="${escapeHtml(codeVal)}" placeholder="Command (max 30)" maxlength="30" style="flex:1;">
            <input type="text" id="inline-desc-${idx}" value="${escapeHtml(descVal)}" placeholder="Beschreibung (max 30)" maxlength="30" style="flex:1;">
            <button class="btn btn-primary btn-sm btn-save-inline">✓ Speichern</button>
            <button class="btn btn-secondary btn-sm btn-cancel-inline">✕ Abbrechen</button>
          </div>
        `;
      } else {
        itemContainer.innerHTML = `
          <div class="inline-edit-box">
            <input type="text" id="inline-input-${idx}" value="${escapeHtml(oldName)}" maxlength="60" style="flex:1;">
            ${catKey === 'bowls' ? `
            <label class="checkbox-label" title="Als Elektro-Gerät kennzeichnen"><input type="checkbox" id="inline-elec-${idx}" ${oldIsElec ? 'checked' : ''}> <span>⚡ Elektro</span></label>
            ` : ''}
            <button class="btn btn-primary btn-sm btn-save-inline">✓ Speichern</button>
            <button class="btn btn-secondary btn-sm btn-cancel-inline">✕ Abbrechen</button>
          </div>
        `;
      }

      const firstInput = itemContainer.querySelector('input');
      if (firstInput) {
        firstInput.focus();
        firstInput.select();
      }

      itemContainer.querySelector('.btn-cancel-inline').addEventListener('click', () => {
        renderCatalogList();
      });

      itemContainer.querySelector('.btn-save-inline').addEventListener('click', async () => {
        let newItem = '';
        if (catKey === 'promos') {
          const c = document.getElementById(`inline-code-${idx}`).value.trim();
          const d = document.getElementById(`inline-desc-${idx}`).value.trim();
          if (!c) return renderCatalogList();
          newItem = d ? `${c} (${d})` : c;
        } else {
          const val = document.getElementById(`inline-input-${idx}`).value.trim();
          const isElecChecked = document.getElementById(`inline-elec-${idx}`) ? document.getElementById(`inline-elec-${idx}`).checked : false;
          if (catKey === 'bowls' && isElecChecked) {
            newItem = { name: val, isElectric: true };
          } else {
            newItem = val;
          }
        }

        if (newItem) {
          const res = await ipcRenderer.invoke('db:edit-item', { category: catKey, oldItem: oldObj, newItem });
          if (res.success) {
            state.catalog = res.catalog;
            updateDatalists();
            renderCatalogList();
            showToast(`Eintrag aktualisiert`, 'success');
          }
        } else {
          renderCatalogList();
        }
      });
    });
  });

  catalogListItems.querySelectorAll('.btn-delete-item').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const rawItem = e.currentTarget.getAttribute('data-item');
      let itemToDelete = rawItem;
      try {
        if (rawItem.startsWith('{')) itemToDelete = JSON.parse(rawItem);
      } catch (err) {}
      const res = await ipcRenderer.invoke('db:remove-item', { category: catKey, item: itemToDelete });
      if (res.success) {
        state.catalog = res.catalog;
        updateDatalists();
        renderCatalogList();
        showToast(`Eintrag gelöscht`, 'info');
      }
    });
  });
}

// Toast Helper
let toastTimer = null;
function showToast(msg, type = 'info') {
  if (!toastMessage || !toastBanner) return;
  toastMessage.textContent = msg;
  toastBanner.className = `toast ${type}`;
  toastBanner.classList.remove('hidden');

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastBanner.classList.add('hidden');
  }, 4500);
}

// Utility HTML escape
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// =========================================================================
// QUICK-ACTIONS & STREAM-MANAGER LOGIC
// =========================================================================

// Quick Actions Elements
const btnRefreshStreamInfo = document.getElementById('btn-refresh-stream-info');
const qaInputTitle = document.getElementById('qa-input-title');
const qaTitleCharCount = document.getElementById('qa-title-char-count');
const btnQaUpdateTitle = document.getElementById('btn-qa-update-title');
const qaInputGame = document.getElementById('qa-input-game');
const qaCategorySuggestions = document.getElementById('qa-category-suggestions');
const btnQaUpdateGame = document.getElementById('btn-qa-update-game');

// Clip Elements
const btnQaCreateClip = document.getElementById('btn-qa-create-clip');
const qaClipResult = document.getElementById('qa-clip-result');
const qaClipUrl = document.getElementById('qa-clip-url');
const btnQaTrimClip = document.getElementById('btn-qa-trim-clip');
const btnQaPostClipChat = document.getElementById('btn-qa-post-clip-chat');
const btnQaCopyClip = document.getElementById('btn-qa-copy-clip');
let currentClipData = null;

// Raid Elements
const qaInputRaidTarget = document.getElementById('qa-input-raid-target');
const qaRaidSuggestions = document.getElementById('qa-raid-suggestions');
const btnQaStartRaid = document.getElementById('btn-qa-start-raid');
const btnQaCancelRaid = document.getElementById('btn-qa-cancel-raid');
const qaRaidSelectedTarget = document.getElementById('qa-raid-selected-target');
const qaRaidTargetAvatar = document.getElementById('qa-raid-target-avatar');
const qaRaidTargetName = document.getElementById('qa-raid-target-name');
const qaRaidTargetStatus = document.getElementById('qa-raid-target-status');
const qaRaidTargetGame = document.getElementById('qa-raid-target-game');

// Custom Commands Elements
const qaCommandsGrid = document.getElementById('qa-commands-grid');
const btnQaAddCustomCmd = document.getElementById('btn-qa-add-custom-cmd');
const qaCustomCmdModal = document.getElementById('qa-custom-cmd-modal');
const btnCloseQaCustomModal = document.getElementById('btn-close-qa-custom-modal');
const inputCustomCmdLabel = document.getElementById('input-custom-cmd-label');
const inputCustomCmdText = document.getElementById('input-custom-cmd-text');
const btnCancelCustomCmd = document.getElementById('btn-cancel-custom-cmd');
const btnSaveCustomCmd = document.getElementById('btn-save-custom-cmd');

const DEFAULT_QUICK_COMMANDS = [
  { id: 'cmd-discord', label: '💬 !discord', command: '!discord', isDefault: true },
  { id: 'cmd-setup', label: '💨 !setup', command: '!setup', isDefault: true },
  { id: 'cmd-shisha', label: '🫁 !shisha', command: '!shisha', isDefault: true },
  { id: 'cmd-tabak', label: '🍂 !tabak', command: '!tabak', isDefault: true },
  { id: 'cmd-masterclass', label: '🎓 !masterclass', command: '!masterclass', isDefault: true }
];

let quickCommands = [];

function loadQuickCommands() {
  try {
    const saved = localStorage.getItem('swg_quick_commands');
    if (saved) {
      quickCommands = JSON.parse(saved);
    } else {
      quickCommands = [...DEFAULT_QUICK_COMMANDS];
      saveQuickCommands();
    }
  } catch(e) {
    quickCommands = [...DEFAULT_QUICK_COMMANDS];
  }
  renderQuickCommands();
}

function saveQuickCommands() {
  try {
    localStorage.setItem('swg_quick_commands', JSON.stringify(quickCommands));
  } catch(e) {}
}

function renderQuickCommands() {
  if (!qaCommandsGrid) return;
  qaCommandsGrid.innerHTML = '';

  quickCommands.forEach(cmd => {
    const card = document.createElement('div');
    card.className = 'qa-cmd-card';
    card.title = `Klicken zum Senden: ${cmd.command}`;
    
    card.innerHTML = `
      <div class="qa-cmd-info">
        <span class="qa-cmd-label">${escapeHtml(cmd.label)}</span>
        <span class="qa-cmd-text">${escapeHtml(cmd.command)}</span>
      </div>
      <div class="qa-cmd-actions">
        ${!cmd.isDefault ? `<button class="btn-delete-cmd" data-id="${cmd.id}" title="Löschen">✕</button>` : ''}
      </div>
    `;

    // Click to send command
    card.addEventListener('click', async (e) => {
      if (e.target.closest('.btn-delete-cmd')) return;
      try {
        const channel = (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved';
        const res = await ipcRenderer.invoke('twitch:send-chat', { message: cmd.command, channel });
        if (res.success) {
          showToast(`Befehl '${cmd.command}' gesendet!`, 'success');
        } else {
          showToast(res.error || 'Fehler beim Senden', 'error');
        }
      } catch(err) {
        showToast(err.message || 'Fehler beim Senden', 'error');
      }
    });

    // Delete custom button
    const btnDel = card.querySelector('.btn-delete-cmd');
    if (btnDel) {
      btnDel.addEventListener('click', (e) => {
        e.stopPropagation();
        quickCommands = quickCommands.filter(c => c.id !== cmd.id);
        saveQuickCommands();
        renderQuickCommands();
        showToast('Button entfernt', 'info');
      });
    }

    qaCommandsGrid.appendChild(card);
  });
}

// Load Channel Information (Title & Game)
async function loadStreamChannelInfo() {
  const channel = (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved';
  if (!qaInputTitle || !qaInputGame) return;

  try {
    const info = await ipcRenderer.invoke('twitch:get-channel-info', channel);
    if (info && info.success) {
      if (info.title !== undefined) {
        qaInputTitle.value = info.title;
        if (qaTitleCharCount) qaTitleCharCount.textContent = `${info.title.length} / 140`;
      }
      if (info.game_name !== undefined) {
        qaInputGame.value = info.game_name;
      }
    }
  } catch(e) {
    console.error('Error loading stream info:', e);
  }
}

// Setup Quick-Actions Listeners
function setupQuickActionsListeners() {
  loadQuickCommands();

  if (btnRefreshStreamInfo) {
    btnRefreshStreamInfo.addEventListener('click', async () => {
      showToast('Lade Kanal-Info von Twitch...', 'info');
      await loadStreamChannelInfo();
      showToast('Kanal-Info aktualisiert!', 'success');
    });
  }

  // Title Char Counter
  if (qaInputTitle && qaTitleCharCount) {
    qaInputTitle.addEventListener('input', () => {
      qaTitleCharCount.textContent = `${qaInputTitle.value.length} / 140`;
    });
  }

  // Update Title Button
  if (btnQaUpdateTitle && qaInputTitle) {
    btnQaUpdateTitle.addEventListener('click', async () => {
      const title = qaInputTitle.value.trim();
      if (!title) {
        showToast('Bitte gib einen Streamtitel ein.', 'error');
        return;
      }
      btnQaUpdateTitle.disabled = true;
      btnQaUpdateTitle.textContent = 'Speichere...';
      const channel = (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved';
      const res = await ipcRenderer.invoke('twitch:set-title', { title, channel });
      btnQaUpdateTitle.disabled = false;
      btnQaUpdateTitle.textContent = '💾 Titel setzen';

      if (res.success) {
        showToast(`Streamtitel auf "${title}" gesetzt!`, 'success');
        checkLiveStreamStatus();
      } else {
        showToast(res.error || 'Fehler beim Setzen des Titels', 'error');
      }
    });
  }

  // Category Search with Debounce
  let catSearchTimeout = null;
  if (qaInputGame && qaCategorySuggestions) {
    qaInputGame.addEventListener('input', () => {
      clearTimeout(catSearchTimeout);
      const query = qaInputGame.value.trim();
      if (query.length < 2) {
        qaCategorySuggestions.classList.add('hidden');
        qaCategorySuggestions.innerHTML = '';
        return;
      }

      catSearchTimeout = setTimeout(async () => {
        const results = await ipcRenderer.invoke('twitch:search-categories', query);
        if (results && results.length > 0) {
          qaCategorySuggestions.innerHTML = '';
          results.slice(0, 8).forEach(cat => {
            const item = document.createElement('div');
            item.className = 'qa-suggestion-item';
            item.innerHTML = `
              <img src="${escapeHtml(cat.box_art_url)}" alt="${escapeHtml(cat.name)}" class="qa-cat-thumb" onerror="this.style.display='none'">
              <div class="qa-sugg-info">
                <span class="qa-sugg-name">${escapeHtml(cat.name)}</span>
              </div>
            `;
            item.addEventListener('click', () => {
              qaInputGame.value = cat.name;
              qaCategorySuggestions.classList.add('hidden');
            });
            qaCategorySuggestions.appendChild(item);
          });
          qaCategorySuggestions.classList.remove('hidden');
        } else {
          qaCategorySuggestions.classList.add('hidden');
        }
      }, 250);
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.qa-category-input-wrapper')) {
        qaCategorySuggestions.classList.add('hidden');
      }
    });
  }

  // Update Game Button
  if (btnQaUpdateGame && qaInputGame) {
    btnQaUpdateGame.addEventListener('click', async () => {
      const game = qaInputGame.value.trim();
      if (!game) {
        showToast('Bitte wähle eine Spiel-Kategorie.', 'error');
        return;
      }
      btnQaUpdateGame.disabled = true;
      btnQaUpdateGame.textContent = 'Speichere...';
      const channel = (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved';
      const res = await ipcRenderer.invoke('twitch:set-game', { game, channel });
      btnQaUpdateGame.disabled = false;
      btnQaUpdateGame.textContent = '🎮 Spiel setzen';

      if (res.success) {
        showToast(`Kategorie auf "${game}" gesetzt!`, 'success');
        checkLiveStreamStatus();
      } else {
        showToast(res.error || 'Fehler beim Setzen des Spiels', 'error');
      }
    });
  }

  // Quick Category Pills
  document.querySelectorAll('.btn-quick-cat').forEach(pill => {
    pill.addEventListener('click', async () => {
      const game = pill.getAttribute('data-game');
      if (game && qaInputGame) {
        qaInputGame.value = game;
        btnQaUpdateGame.click();
      }
    });
  });

  // Clip Creation
  if (btnQaCreateClip) {
    btnQaCreateClip.addEventListener('click', async () => {
      btnQaCreateClip.disabled = true;
      btnQaCreateClip.textContent = '⏳ Erstelle Clip...';
      const channel = (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved';
      const res = await ipcRenderer.invoke('twitch:create-clip', channel);
      btnQaCreateClip.disabled = false;
      btnQaCreateClip.innerHTML = `
        <svg class="icon-sm" viewBox="0 0 24 24"><path fill="currentColor" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>
        🎬 Clip der letzten 60s erstellen
      `;

      if (res.success) {
        currentClipData = res;
        qaClipUrl.value = res.clip_url;
        qaClipResult.classList.remove('hidden');
        showToast('Clip erfolgreich erstellt!', 'success');
      } else {
        showToast(res.error || 'Clip konnte nicht erstellt werden', 'error');
      }
    });
  }

  if (btnQaTrimClip) {
    btnQaTrimClip.addEventListener('click', () => {
      if (currentClipData && currentClipData.edit_url) {
        ipcRenderer.invoke('app:open-external', currentClipData.edit_url);
      } else if (currentClipData && currentClipData.clip_url) {
        ipcRenderer.invoke('app:open-external', currentClipData.clip_url);
      }
    });
  }

  if (btnQaPostClipChat) {
    btnQaPostClipChat.addEventListener('click', async () => {
      if (currentClipData && currentClipData.clip_url) {
        const channel = (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved';
        const res = await ipcRenderer.invoke('twitch:send-chat', { message: `Clip: ${currentClipData.clip_url}`, channel });
        if (res.success) {
          showToast('Clip-Link in Chat gepostet!', 'success');
        } else {
          showToast(res.error || 'Fehler beim Posten', 'error');
        }
      }
    });
  }

  if (btnQaCopyClip) {
    btnQaCopyClip.addEventListener('click', () => {
      if (qaClipUrl && qaClipUrl.value) {
        navigator.clipboard.writeText(qaClipUrl.value);
        showToast('Clip-Link kopiert!', 'info');
      }
    });
  }

  // Raid Search with Debounce
  let raidSearchTimeout = null;
  let selectedRaidTarget = '';
  if (qaInputRaidTarget && qaRaidSuggestions) {
    qaInputRaidTarget.addEventListener('input', () => {
      clearTimeout(raidSearchTimeout);
      const query = qaInputRaidTarget.value.trim();
      if (query.length < 2) {
        qaRaidSuggestions.classList.add('hidden');
        qaRaidSuggestions.innerHTML = '';
        return;
      }

      raidSearchTimeout = setTimeout(async () => {
        const results = await ipcRenderer.invoke('twitch:search-channels', query);
        if (results && results.length > 0) {
          qaRaidSuggestions.innerHTML = '';
          results.slice(0, 6).forEach(ch => {
            const item = document.createElement('div');
            item.className = 'qa-suggestion-item';
            const statusTag = ch.is_live ? '<span class="status-pill-small live">🔴 LIVE</span>' : '<span class="status-pill-small offline">Offline</span>';
            const gameText = ch.game_name ? ` • ${escapeHtml(ch.game_name)}` : '';
            
            item.innerHTML = `
              <img src="${escapeHtml(ch.thumbnail_url || '')}" alt="${escapeHtml(ch.display_name)}" class="qa-raid-thumb" onerror="this.style.display='none'">
              <div class="qa-sugg-info">
                <div class="qa-sugg-name">${escapeHtml(ch.display_name)} (${escapeHtml(ch.broadcaster_login)})</div>
                <div class="qa-sugg-sub">${statusTag}${gameText}</div>
              </div>
            `;

            item.addEventListener('click', () => {
              selectedRaidTarget = ch.broadcaster_login;
              qaInputRaidTarget.value = ch.display_name;
              qaRaidSuggestions.classList.add('hidden');

              // Show selected target card
              if (qaRaidSelectedTarget) {
                qaRaidSelectedTarget.classList.remove('hidden');
                if (qaRaidTargetAvatar) qaRaidTargetAvatar.src = ch.thumbnail_url || '';
                if (qaRaidTargetName) qaRaidTargetName.textContent = ch.display_name;
                if (qaRaidTargetStatus) {
                  qaRaidTargetStatus.className = `status-pill-small ${ch.is_live ? 'live' : 'offline'}`;
                  qaRaidTargetStatus.textContent = ch.is_live ? '🔴 LIVE' : 'Offline';
                }
                if (qaRaidTargetGame) qaRaidTargetGame.textContent = ch.game_name ? `Spielt: ${ch.game_name}` : (ch.title || 'Keine Kategorie');
              }
            });

            qaRaidSuggestions.appendChild(item);
          });
          qaRaidSuggestions.classList.remove('hidden');
        } else {
          qaRaidSuggestions.classList.add('hidden');
        }
      }, 250);
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.qa-raid-input-wrapper')) {
        qaRaidSuggestions.classList.add('hidden');
      }
    });
  }

  // Start Raid
  if (btnQaStartRaid) {
    btnQaStartRaid.addEventListener('click', async () => {
      const target = selectedRaidTarget || (qaInputRaidTarget ? qaInputRaidTarget.value.trim() : '');
      if (!target) {
        showToast('Bitte wähle einen Zielkanal für den Raid.', 'error');
        return;
      }
      btnQaStartRaid.disabled = true;
      btnQaStartRaid.textContent = 'Starte Raid...';
      const channel = (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved';
      const res = await ipcRenderer.invoke('twitch:start-raid', { target, channel });
      btnQaStartRaid.disabled = false;
      btnQaStartRaid.textContent = '🚀 Raid starten';

      if (res.success) {
        showToast(`Raid auf #${target} gestartet! (/raid ${target})`, 'success');
      } else {
        showToast(res.error || 'Fehler beim Starten des Raids', 'error');
      }
    });
  }

  // Cancel Raid
  if (btnQaCancelRaid) {
    btnQaCancelRaid.addEventListener('click', async () => {
      const channel = (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved';
      const res = await ipcRenderer.invoke('twitch:cancel-raid', channel);
      if (res.success) {
        showToast('Raid abgebrochen (/unraid)', 'info');
      } else {
        showToast(res.error || 'Fehler beim Abbrechen', 'error');
      }
    });
  }

  // Custom Command Modal Listeners
  if (btnQaAddCustomCmd && qaCustomCmdModal) {
    btnQaAddCustomCmd.addEventListener('click', () => {
      qaCustomCmdModal.classList.remove('hidden');
      if (inputCustomCmdLabel) inputCustomCmdLabel.value = '';
      if (inputCustomCmdText) inputCustomCmdText.value = '';
      if (inputCustomCmdLabel) inputCustomCmdLabel.focus();
    });
  }

  if (btnCloseQaCustomModal && qaCustomCmdModal) {
    btnCloseQaCustomModal.addEventListener('click', () => {
      qaCustomCmdModal.classList.add('hidden');
    });
  }

  if (btnCancelCustomCmd && qaCustomCmdModal) {
    btnCancelCustomCmd.addEventListener('click', () => {
      qaCustomCmdModal.classList.add('hidden');
    });
  }

  if (btnSaveCustomCmd) {
    btnSaveCustomCmd.addEventListener('click', () => {
      const label = inputCustomCmdLabel.value.trim();
      const command = inputCustomCmdText.value.trim();

      if (!label || !command) {
        showToast('Bitte fülle Beschriftung und Befehl aus.', 'error');
        return;
      }

      quickCommands.push({
        id: 'cmd-' + Date.now(),
        label: label,
        command: command,
        isDefault: false
      });
      saveQuickCommands();
      renderQuickCommands();
      qaCustomCmdModal.classList.add('hidden');
      showToast(`Quick-Command '${label}' hinzugefügt!`, 'success');
    });
  }
}

// =========================================================================
// MOD-HQ & LIVE-TEAM-CHAT LOGIC
// =========================================================================

// Mod-Chat Elements
const btnRefreshModChat = document.getElementById('btn-refresh-mod-chat');
const btnClearModChat = document.getElementById('btn-clear-mod-chat');
const modChatMessages = document.getElementById('mod-chat-messages');
const chatLoggedName = document.getElementById('chat-logged-name');
const inputModChat = document.getElementById('input-mod-chat');
const btnSendModChat = document.getElementById('btn-send-mod-chat');

// Cutter-Marker Elements
const inputCustomMarker = document.getElementById('input-custom-marker');
const btnAddCustomMarker = document.getElementById('btn-add-custom-marker');
const markersCount = document.getElementById('markers-count');
const btnCopyCutterTimestamps = document.getElementById('btn-copy-cutter-timestamps');
const btnClearMarkers = document.getElementById('btn-clear-markers');
const markersStreamList = document.getElementById('markers-stream-list');

// Watchlist Elements
const inputWatchlistName = document.getElementById('input-watchlist-name');
const inputWatchlistNote = document.getElementById('input-watchlist-note');
const btnAddWatchlistItem = document.getElementById('btn-add-watchlist-item');
const watchlistItemsList = document.getElementById('watchlist-items-list');

let modChatPollInterval = null;
let streamMarkers = [];
let watchlistItems = [];
let lastRenderedMessagesCount = 0;
let lastMessagesSignature = '';

function getActiveModInfo() {
  const customColor = localStorage.getItem('swg_user_color') || (state.twitchUser && state.twitchUser.color ? state.twitchUser.color : '#00f0ff');
  const customModName = localStorage.getItem('swg_custom_mod_name');
  const senderName = customModName || (state.twitchUser ? (state.twitchUser.display_name || state.twitchUser.login) : 'Mod');
  const senderAvatar = state.twitchUser && state.twitchUser.profile_image_url ? state.twitchUser.profile_image_url : 'https://static-cdn.jtvnw.net/user-default-pictures-uv/75305db0-3a59-4d70-9050-0b42c497426a-profile_image-70x70.png';

  return { name: senderName, avatar: senderAvatar, color: customColor };
}

function startModHQSync() {
  updateModHQUserInfo();
  loadModChatMessages();
  loadStreamMarkers();
  loadWatchlist();
  loadChatters();
}

function stopModHQSync() {
  // Global watcher handles chat polling seamlessly
}

// Notification Audio Synthesizer (Crystal 2-Tone Chime)
function playNotificationSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const now = ctx.currentTime;
    
    // Tone 1: E5 (659.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.18, now);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Tone 2: B5 (987.77 Hz - Harmonic sparkle)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(987.77, now + 0.08);
    gain2.gain.setValueAtTime(0.22, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.6);
  } catch(e) {
    console.warn('Could not play notification sound:', e);
  }
}

async function startGlobalModChatWatcher() {
  try {
    const res = await ipcRenderer.invoke('modchat:get-messages');
    if (res && res.success && Array.isArray(res.messages) && res.messages.length > 0) {
      const maxTs = Math.max(...res.messages.map(m => m.timestamp || 0));
      lastSeenModChatTimestamp = Math.max(maxTs, Date.now() - 500);
    } else {
      lastSeenModChatTimestamp = Date.now();
    }
  } catch(e) {
    lastSeenModChatTimestamp = Date.now();
  }

  if (globalModChatInterval) clearInterval(globalModChatInterval);
  globalModChatInterval = setInterval(async () => {
    try {
      const res = await ipcRenderer.invoke('modchat:get-messages');
      if (res && res.success && Array.isArray(res.messages)) {
        const currentMod = getActiveModInfo();
        const currentUserName = (currentMod.name || '').toLowerCase();

        // Check for new incoming messages from other mods
        const newIncoming = res.messages.filter(m => 
          m.timestamp && 
          m.timestamp > lastSeenModChatTimestamp && 
          m.senderName && 
          m.senderName.toLowerCase() !== currentUserName
        );

        if (newIncoming.length > 0) {
          const isWindowFocused = document.hasFocus();
          const isActivelyInChat = (currentActiveView === 'view-modchat') && isWindowFocused;

          // Play sound & flash taskbar when NOT actively looking at the chat
          if (!isActivelyInChat) {
            playNotificationSound();
            ipcRenderer.invoke('app:notify-background').catch(() => {});
          }

          if (currentActiveView === 'view-modchat') {
            renderModChatMessages(res.messages);
            lastSeenModChatTimestamp = Math.max(...newIncoming.map(m => m.timestamp || 0), Date.now());
          } else {
            newIncoming.forEach(msg => {
              const preview = msg.text.length > 60 ? msg.text.substring(0, 60) + '...' : msg.text;
              showToast(`💬 ${msg.senderName}: ${preview}`, 'info');
              unreadModChatCount++;
            });

            const maxTs = Math.max(...newIncoming.map(m => m.timestamp || 0));
            lastSeenModChatTimestamp = Math.max(maxTs, Date.now());

            const badge = document.getElementById('hub-modchat-unread');
            if (badge) {
              badge.textContent = unreadModChatCount;
              badge.classList.remove('hidden');
            }
          }
        } else if (currentActiveView === 'view-modchat') {
          renderModChatMessages(res.messages);
        }
      }
    } catch(e) {}
  }, 4000);
}

function updateModHQUserInfo() {
  const modInfo = getActiveModInfo();
  if (chatLoggedName) {
    chatLoggedName.textContent = modInfo.name;
    chatLoggedName.style.color = modInfo.color;
  }
  const chatLoggedAvatar = document.getElementById('chat-logged-avatar');
  if (chatLoggedAvatar) {
    chatLoggedAvatar.src = modInfo.avatar;
    chatLoggedAvatar.classList.remove('hidden');
  }
}

async function loadModChatMessages(silent = false) {
  if (!modChatMessages) return;
  try {
    const res = await ipcRenderer.invoke('modchat:get-messages');
    if (res && res.success && Array.isArray(res.messages)) {
      renderModChatMessages(res.messages);
    }
  } catch(e) {
    if (!silent) console.error('Error loading mod chat:', e);
  }
}

function renderModChatMessages(messages) {
  if (!modChatMessages) return;

  const currentMod = getActiveModInfo();
  const currentUserName = currentMod.name.toLowerCase();

  // If no messages
  if (!messages || messages.length === 0) {
    if (lastMessagesSignature !== 'empty') {
      lastMessagesSignature = 'empty';
      modChatMessages.innerHTML = `
        <div class="chat-welcome-notice">
          <span>👋 Willkommen im internen Mod-Team-Chat! Hier könnt ihr euch während des Streams absprechen.</span>
        </div>
      `;
    }
    return;
  }

  // Create signature to compare
  const sig = messages.map(m => `${m.id}-${m.timestamp}-${m.senderName}`).join('|');
  if (sig === lastMessagesSignature) {
    // Absolutely no changes, do NOT re-render DOM to prevent any flickering!
    return;
  }
  lastMessagesSignature = sig;

  // Check if user was scrolled near bottom
  const wasScrolledToBottom = modChatMessages.scrollHeight - modChatMessages.clientHeight <= modChatMessages.scrollTop + 60;

  let html = `
    <div class="chat-welcome-notice">
      <span>👋 Willkommen im internen Mod-Team-Chat! Hier könnt ihr euch während des Streams absprechen.</span>
    </div>
  `;

  messages.forEach(msg => {
    const isOwn = currentUserName && msg.senderName && msg.senderName.toLowerCase() === currentUserName;
    const timeStr = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    const senderColor = msg.senderColor || '#00f0ff';
    const avatarSrc = msg.senderAvatar || 'https://static-cdn.jtvnw.net/user-default-pictures-uv/75305db0-3a59-4d70-9050-0b42c497426a-profile_image-70x70.png';

    html += `
      <div class="mod-chat-msg-row ${isOwn ? 'outgoing' : 'incoming'}">
        <img src="${escapeHtml(avatarSrc)}" alt="${escapeHtml(msg.senderName)}" class="chat-msg-avatar" onerror="this.src='https://static-cdn.jtvnw.net/user-default-pictures-uv/75305db0-3a59-4d70-9050-0b42c497426a-profile_image-70x70.png'">
        <div class="chat-bubble">
          <div class="chat-bubble-header">
            <span class="chat-sender-name" style="color: ${escapeHtml(senderColor)}">${escapeHtml(msg.senderName || 'Mod')}</span>
            <span class="chat-time">${escapeHtml(timeStr)}</span>
          </div>
          <div class="chat-text">${escapeHtml(msg.text)}</div>
        </div>
      </div>
    `;
  });

  modChatMessages.innerHTML = html;

  if (wasScrolledToBottom) {
    modChatMessages.scrollTop = modChatMessages.scrollHeight;
  }
}

async function sendModChatMessage() {
  if (!inputModChat) return;
  const text = inputModChat.value.trim();
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

  inputModChat.value = '';
  inputModChat.focus();

  try {
    const res = await ipcRenderer.invoke('modchat:send-message', msgObj);
    if (res && res.success && Array.isArray(res.messages)) {
      renderModChatMessages(res.messages);
    } else {
      showToast('Fehler beim Senden der Nachricht: ' + (res && res.error ? res.error : 'Unbekannter Fehler'), 'error');
    }
  } catch(e) {
    showToast('Fehler beim Senden der Nachricht: ' + e.message, 'error');
  }
}

// Chatters List
async function loadChatters() {
  const channel = (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved';
  const chattersCountEl = document.getElementById('chatters-count');
  const modalChattersCount = document.getElementById('modal-chatters-count');
  const chattersListGrid = document.getElementById('chatters-list-grid');

  try {
    const res = await ipcRenderer.invoke('twitch:get-chatters', channel);
    if (res) {
      const total = res.total || (res.chatters ? res.chatters.length : 0);
      if (chattersCountEl) chattersCountEl.textContent = total;
      if (modalChattersCount) modalChattersCount.textContent = total;
      if (chattersListGrid) {
        if (res.chatters && res.chatters.length > 0) {
          chattersListGrid.innerHTML = res.chatters.map(c => `
            <span class="chatter-pill">👤 ${escapeHtml(c.name || c.login)}</span>
          `).join('');
        } else {
          chattersListGrid.innerHTML = '<div class="empty-list-placeholder">Keine Chatters gefunden oder Twitch-Login erforderlich.</div>';
        }
      }
    }
  } catch(e) {}
}

// Cutter Stream Markers Logic
async function loadStreamMarkers() {
  try {
    const res = await ipcRenderer.invoke('markers:get');
    if (res && res.success) {
      streamMarkers = res.markers || [];
      renderStreamMarkers();
    }
  } catch(e) {}
}

function renderStreamMarkers() {
  if (!markersStreamList || !markersCount) return;
  markersCount.textContent = streamMarkers.length;

  if (streamMarkers.length === 0) {
    markersStreamList.innerHTML = '<div class="empty-list-placeholder">Noch keine Marker in dieser Session gesetzt.</div>';
    return;
  }

  let html = '';
  streamMarkers.forEach((m, idx) => {
    html += `
      <div class="marker-item">
        <span class="marker-time-badge">${escapeHtml(m.timeStr || '00:00:00')}</span>
        <span class="marker-desc" title="${escapeHtml(m.description)}">${escapeHtml(m.description)}</span>
        <button class="btn-delete-cmd btn-delete-marker" data-idx="${idx}" title="Löschen">✕</button>
      </div>
    `;
  });

  markersStreamList.innerHTML = html;

  markersStreamList.querySelectorAll('.btn-delete-marker').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const idx = parseInt(e.currentTarget.getAttribute('data-idx'));
      streamMarkers.splice(idx, 1);
      await ipcRenderer.invoke('markers:save', streamMarkers);
      renderStreamMarkers();
      showToast('Marker gelöscht', 'info');
    });
  });
}

function formatVodTime(seconds) {
  const s = Math.floor(seconds % 60);
  const m = Math.floor((seconds / 60) % 60);
  const h = Math.floor(seconds / 3600);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

async function addMarker(description) {
  if (!description) return;
  const channel = (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved';
  const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  let timeFormatted = nowStr;

  try {
    const res = await ipcRenderer.invoke('twitch:create-stream-marker', { description, channel });
    if (res && res.success && res.position_seconds !== undefined) {
      timeFormatted = formatVodTime(res.position_seconds);
      showToast(`Twitch-Marker (${timeFormatted}) gesetzt!`, 'success');
    } else {
      showToast(`Marker "${description}" lokal notiert!`, 'info');
    }
  } catch(e) {
    showToast(`Marker "${description}" notiert (${timeFormatted})`, 'info');
  }

  streamMarkers.unshift({
    id: 'marker-' + Date.now(),
    timeStr: timeFormatted,
    description: description,
    createdAt: Date.now()
  });

  await ipcRenderer.invoke('markers:save', streamMarkers);
  renderStreamMarkers();
}

function copyCutterTimestamps() {
  if (!streamMarkers || streamMarkers.length === 0) {
    showToast('Keine Marker zum Kopieren vorhanden', 'info');
    return;
  }

  // Sort chronological for cutter
  const sorted = [...streamMarkers].reverse();
  const text = sorted.map(m => `${m.timeStr} - ${m.description}`).join('\n');
  navigator.clipboard.writeText(text);
  showToast(`${sorted.length} Timestamps für Cutter kopiert!`, 'success');
}

// Watchlist Logic
async function loadWatchlist() {
  try {
    const res = await ipcRenderer.invoke('watchlist:get');
    if (res && res.success) {
      watchlistItems = res.list || [];
      renderWatchlist();
    }
  } catch(e) {}
}

function renderWatchlist() {
  if (!watchlistItemsList) return;
  if (watchlistItems.length === 0) {
    watchlistItemsList.innerHTML = '<div class="empty-list-placeholder">Keine vermerkten User auf der Watchlist.</div>';
    return;
  }

  let html = '';
  watchlistItems.forEach(item => {
    html += `
      <div class="watchlist-item ${item.completed ? 'completed' : ''}" data-id="${item.id}">
        <div class="watchlist-info">
          <span class="watchlist-name">${escapeHtml(item.username)}</span>
          <span class="watchlist-note">${escapeHtml(item.note)}</span>
        </div>
        <div class="watchlist-actions">
          <button class="btn btn-secondary btn-xs btn-toggle-watchlist" data-id="${item.id}" title="${item.completed ? 'Als offen markieren' : 'Erledigt'}">
            ${item.completed ? '↩️' : '✓'}
          </button>
          <button class="btn-delete-cmd btn-delete-watchlist" data-id="${item.id}" title="Löschen">✕</button>
        </div>
      </div>
    `;
  });

  watchlistItemsList.innerHTML = html;

  watchlistItemsList.querySelectorAll('.btn-toggle-watchlist').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      const item = watchlistItems.find(w => w.id === id);
      if (item) {
        item.completed = !item.completed;
        await ipcRenderer.invoke('watchlist:save', watchlistItems);
        renderWatchlist();
      }
    });
  });

  watchlistItemsList.querySelectorAll('.btn-delete-watchlist').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      watchlistItems = watchlistItems.filter(w => w.id !== id);
      await ipcRenderer.invoke('watchlist:save', watchlistItems);
      renderWatchlist();
      showToast('Eintrag gelöscht', 'info');
    });
  });
}

// Setup Mod-HQ Listeners
function setupModHQListeners() {
  if (btnRefreshModChat) {
    btnRefreshModChat.addEventListener('click', async () => {
      showToast('Aktualisiere Mod-Chat...', 'info');
      await loadModChatMessages();
      showToast('Mod-Chat aktualisiert!', 'success');
    });
  }

  if (btnClearModChat) {
    btnClearModChat.addEventListener('click', async () => {
      lastMessagesSignature = '';
      await ipcRenderer.invoke('modchat:clear-messages');
      renderModChatMessages([]);
      showToast('Mod-Chat geleert', 'info');
      if (inputModChat) {
        inputModChat.disabled = false;
        inputModChat.focus();
      }
    });
  }

  if (btnSendModChat) {
    btnSendModChat.addEventListener('click', sendModChatMessage);
  }

  if (inputModChat) {
    inputModChat.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendModChatMessage();
      }
    });
  }

  // Quick Chat Emojis
  document.querySelectorAll('.btn-chat-emoji').forEach(btn => {
    btn.addEventListener('click', () => {
      const emoji = btn.getAttribute('data-emoji');
      if (emoji && inputModChat) {
        inputModChat.value += emoji;
        inputModChat.focus();
      }
    });
  });

  // Marker Quick Tags
  document.querySelectorAll('.btn-marker-tag').forEach(btn => {
    btn.addEventListener('click', () => {
      const tag = btn.getAttribute('data-tag');
      if (tag) addMarker(tag);
    });
  });

  // Custom Marker
  if (btnAddCustomMarker && inputCustomMarker) {
    btnAddCustomMarker.addEventListener('click', () => {
      const text = inputCustomMarker.value.trim();
      if (!text) {
        showToast('Bitte gib einen Marker-Text ein', 'error');
        return;
      }
      addMarker(`🎯 ${text}`);
      inputCustomMarker.value = '';
    });

    inputCustomMarker.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        btnAddCustomMarker.click();
      }
    });
  }

  if (btnCopyCutterTimestamps) {
    btnCopyCutterTimestamps.addEventListener('click', copyCutterTimestamps);
  }

  if (btnClearMarkers) {
    btnClearMarkers.addEventListener('click', async () => {
      streamMarkers = [];
      await ipcRenderer.invoke('markers:save', streamMarkers);
      renderStreamMarkers();
      showToast('Marker geleert', 'info');
    });
  }

  // Add Watchlist Item
  if (btnAddWatchlistItem && inputWatchlistName && inputWatchlistNote) {
    btnAddWatchlistItem.addEventListener('click', async () => {
      const username = inputWatchlistName.value.trim().replace('@', '');
      const note = inputWatchlistNote.value.trim();
      if (!username || !note) {
        showToast('Bitte gib Username und Vermerk ein', 'error');
        return;
      }

      watchlistItems.unshift({
        id: 'wl-' + Date.now(),
        username,
        note,
        completed: false,
        createdAt: Date.now()
      });

      await ipcRenderer.invoke('watchlist:save', watchlistItems);
      inputWatchlistName.value = '';
      inputWatchlistNote.value = '';
      renderWatchlist();
      showToast(`User '${username}' vermerkt`, 'success');
    });

    inputWatchlistNote.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        btnAddWatchlistItem.click();
      }
    });
  }

  // Edit Mod Profile (Custom Name & Color Modal)
  const btnEditModName = document.getElementById('btn-edit-mod-name');
  const modProfileModal = document.getElementById('mod-profile-modal');
  const inputEditModName = document.getElementById('input-edit-mod-name');
  const inputEditModColor = document.getElementById('input-edit-mod-color');
  const previewEditModBadge = document.getElementById('preview-edit-mod-badge');
  const btnCloseModProfileModal = document.getElementById('btn-close-mod-profile-modal');
  const btnCancelModProfile = document.getElementById('btn-cancel-mod-profile');
  const btnSaveModProfile = document.getElementById('btn-save-mod-profile');

  function updateModProfilePreview() {
    if (!previewEditModBadge) return;
    const name = (inputEditModName ? inputEditModName.value.trim() : '') || (state.twitchUser ? (state.twitchUser.display_name || state.twitchUser.login) : 'Mod');
    const color = inputEditModColor ? inputEditModColor.value : '#00f0ff';
    previewEditModBadge.textContent = name + ':';
    previewEditModBadge.style.color = color;
  }

  if (btnEditModName && modProfileModal) {
    btnEditModName.addEventListener('click', () => {
      const currentName = localStorage.getItem('swg_custom_mod_name') || '';
      const currentColor = localStorage.getItem('swg_user_color') || (state.twitchUser && state.twitchUser.color ? state.twitchUser.color : '#00f0ff');

      if (inputEditModName) inputEditModName.value = currentName;
      if (inputEditModColor) inputEditModColor.value = currentColor;

      updateModProfilePreview();
      modProfileModal.classList.remove('hidden');
      if (inputEditModName) inputEditModName.focus();
    });
  }

  if (inputEditModName) inputEditModName.addEventListener('input', updateModProfilePreview);
  if (inputEditModColor) inputEditModColor.addEventListener('input', updateModProfilePreview);

  if (btnCloseModProfileModal && modProfileModal) {
    btnCloseModProfileModal.addEventListener('click', () => modProfileModal.classList.add('hidden'));
  }
  if (btnCancelModProfile && modProfileModal) {
    btnCancelModProfile.addEventListener('click', () => modProfileModal.classList.add('hidden'));
  }

  if (btnSaveModProfile && modProfileModal) {
    btnSaveModProfile.addEventListener('click', () => {
      const newName = inputEditModName ? inputEditModName.value.trim() : '';
      const newColor = inputEditModColor ? inputEditModColor.value : '#00f0ff';

      if (newName) {
        localStorage.setItem('swg_custom_mod_name', newName);
      } else {
        localStorage.removeItem('swg_custom_mod_name');
      }

      localStorage.setItem('swg_user_color', newColor);
      if (userColorPicker) userColorPicker.value = newColor;

      updateModHQUserInfo();
      updateTwitchUI();
      modProfileModal.classList.add('hidden');
      showToast('Mod-Profil erfolgreich gespeichert!', 'success');
    });
  }

  // Chatters Modal Listeners
  const btnShowChatters = document.getElementById('btn-show-chatters');
  const chattersModal = document.getElementById('chatters-modal');
  const btnCloseChattersModal = document.getElementById('btn-close-chatters-modal');
  const btnReloadChatters = document.getElementById('btn-reload-chatters');

  if (btnShowChatters && chattersModal) {
    btnShowChatters.addEventListener('click', async () => {
      chattersModal.classList.remove('hidden');
      await loadChatters();
    });
  }

  if (btnCloseChattersModal && chattersModal) {
    btnCloseChattersModal.addEventListener('click', () => {
      chattersModal.classList.add('hidden');
    });
  }

  if (btnReloadChatters) {
    btnReloadChatters.addEventListener('click', async () => {
      showToast('Lade Chatters...', 'info');
      await loadChatters();
      showToast('Chatter-Liste aktualisiert!', 'success');
    });
  }
}

// =========================================================================
// GIVEAWAYS & 2-STUFEN DSGVO-ADRESSVERSAND LOGIC
// =========================================================================

let giveawaySyncInterval = null;

const giveawayState = {
  isActive: false,
  prize: '',
  mode: 'keyword',
  keyword: '!join',
  participants: new Map(),
  currentWinner: null,
  winnersHistory: []
};

// UI Elements
const inputGiveawayPrize = document.getElementById('input-giveaway-prize');
const selectGiveawayMode = document.getElementById('select-giveaway-mode');
const groupGwKeyword = document.getElementById('group-gw-keyword');
const inputGiveawayKeyword = document.getElementById('input-giveaway-keyword');
const giveawayStatusIndicator = document.getElementById('giveaway-status-indicator');

// Filters
const chkGwExcludeBots = document.getElementById('chk-gw-exclude-bots');
const chkGwExcludeMods = document.getElementById('chk-gw-exclude-mods');
const chkGwExcludeWatchlist = document.getElementById('chk-gw-exclude-watchlist');
const chkGwExcludePrevWinners = document.getElementById('chk-gw-exclude-prev-winners');
const chkGwSendChat = document.getElementById('chk-gw-send-chat');

// Buttons
const btnStartGiveaway = document.getElementById('btn-start-giveaway');
const btnStopGiveaway = document.getElementById('btn-stop-giveaway');
const btnClearParticipants = document.getElementById('btn-clear-participants');
const btnDrawWinner = document.getElementById('btn-draw-winner');
const btnResetGiveaway = document.getElementById('btn-reset-giveaway');

// Participants Grid
const giveawayParticipantsCount = document.getElementById('giveaway-participants-count');
const giveawayParticipantsGrid = document.getElementById('giveaway-participants-grid');

// Winner Display Elements
const winnerDisplayContainer = document.getElementById('winner-display-container');
const winnerQuickActions = document.getElementById('winner-quick-actions');
const btnRerollWinner = document.getElementById('btn-reroll-winner');

// Address & Telegram Elements
const winnerAddressStatusPill = document.getElementById('winner-address-status-pill');
const displayWinnerPrize = document.getElementById('display-winner-prize');
const inputWinnerFullname = document.getElementById('input-winner-fullname');
const inputWinnerStreet = document.getElementById('input-winner-street');
const inputWinnerZip = document.getElementById('input-winner-zip');
const inputWinnerCity = document.getElementById('input-winner-city');
const inputWinnerCountry = document.getElementById('input-winner-country');
const btnSendWinnerTelegram = document.getElementById('btn-send-winner-telegram');
const btnCopyWinnerTelegramText = document.getElementById('btn-copy-winner-telegram-text');
const btnSaveWinnerAddress = document.getElementById('btn-save-winner-address');
const btnFinishGiveaway = document.getElementById('btn-finish-giveaway');

// History Table
const winnersHistoryTbody = document.getElementById('winners-history-tbody');
const btnRefreshWinnersHistory = document.getElementById('btn-refresh-winners-history');

// Telegram Config Modal Elements
const btnOpenTelegramConfig = document.getElementById('btn-open-telegram-config');
const telegramConfigModal = document.getElementById('telegram-config-modal');
const btnCloseTelegramConfigModal = document.getElementById('btn-close-telegram-config-modal');
const btnCancelTelegramConfig = document.getElementById('btn-cancel-telegram-config');
const btnSaveTelegramConfig = document.getElementById('btn-save-telegram-config');
const btnTestTelegramBot = document.getElementById('btn-test-telegram-bot');
const inputTelegramBotToken = document.getElementById('input-telegram-bot-token');
const inputTelegramChatId = document.getElementById('input-telegram-chat-id');
const inputGiveawayClaimUrl = document.getElementById('input-giveaway-claim-url');

const KNOWN_BOTS = ['nightbot', 'streamelements', 'moobot', 'wizebot', 'fossabot', 'marvedbot', 'bot', 'soundbot', 'chatterino', 'streamlabs'];

function isParticipantExcluded(participant) {
  const login = (participant.login || '').toLowerCase();

  // Bot check
  if (chkGwExcludeBots && chkGwExcludeBots.checked) {
    if (KNOWN_BOTS.includes(login) || login.endsWith('bot')) return true;
  }

  // Mod check
  if (chkGwExcludeMods && chkGwExcludeMods.checked) {
    if (participant.isMod) return true;
  }

  // Watchlist check
  if (chkGwExcludeWatchlist && chkGwExcludeWatchlist.checked) {
    if (watchlistItems && watchlistItems.some(w => (w.username || '').toLowerCase() === login)) {
      return true;
    }
  }

  // Previous winners check
  if (chkGwExcludePrevWinners && chkGwExcludePrevWinners.checked) {
    if (giveawayState.winnersHistory && giveawayState.winnersHistory.some(w => (w.username || '').toLowerCase() === login)) {
      return true;
    }
  }

  return false;
}

function renderParticipantsPool() {
  if (!giveawayParticipantsGrid || !giveawayParticipantsCount) return;

  const validParticipants = Array.from(giveawayState.participants.values()).filter(p => !isParticipantExcluded(p));
  giveawayParticipantsCount.textContent = validParticipants.length;

  if (validParticipants.length === 0) {
    giveawayParticipantsGrid.innerHTML = giveawayState.isActive 
      ? '<div class="empty-list-placeholder">Warte auf Teilnehmer im Chat...</div>'
      : '<div class="empty-list-placeholder">Noch keine Teilnehmer. Starte die Registrierung, damit Zuschauer beitreten können.</div>';
    return;
  }

  giveawayParticipantsGrid.innerHTML = validParticipants.map(p => `
    <span class="participant-pill ${p.isMod ? 'is-mod' : ''} ${p.isSub ? 'is-sub' : ''}">
      <span style="color: ${escapeHtml(p.color || '#00f0ff')}">●</span>
      ${escapeHtml(p.displayName || p.login)}
      ${p.isSub ? '⭐' : ''}
    </span>
  `).join('');
}

function updateGiveawayStatus(status) {
  if (!giveawayStatusIndicator) return;
  if (status === 'live') {
    giveawayStatusIndicator.className = 'gw-status-badge live';
    giveawayStatusIndicator.innerHTML = '<span class="status-dot"></span><span class="status-text">Registrierung läuft</span>';
  } else if (status === 'closed') {
    giveawayStatusIndicator.className = 'gw-status-badge closed';
    giveawayStatusIndicator.innerHTML = '<span class="status-dot"></span><span class="status-text">Geschlossen</span>';
  } else {
    giveawayStatusIndicator.className = 'gw-status-badge offline';
    giveawayStatusIndicator.innerHTML = '<span class="status-dot"></span><span class="status-text">Bereit</span>';
  }
}

async function startGiveawayRegistration() {
  const prize = inputGiveawayPrize ? inputGiveawayPrize.value.trim() : '';
  if (!prize) {
    showToast('⚠️ Bitte gib zuerst einen Gewinnpreis ein, bevor du das Giveaway startest!', 'error');
    if (inputGiveawayPrize) inputGiveawayPrize.focus();
    return;
  }
  giveawayState.prize = prize;
  giveawayState.mode = selectGiveawayMode ? selectGiveawayMode.value : 'keyword';
  giveawayState.keyword = inputGiveawayKeyword ? inputGiveawayKeyword.value.trim() : '!join';

  const channel = (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved';

  if (giveawayState.mode === 'keyword') {
    const res = await ipcRenderer.invoke('giveaway:start-listener', { keyword: giveawayState.keyword, channel });
    if (res && !res.success) {
      showToast(res.error || 'Fehler beim Starten des Twitch-Listeners', 'error');
      return;
    }
  } else {
    // Chatters Mode: Load current chatters into pool
    try {
      const res = await ipcRenderer.invoke('twitch:get-chatters', channel);
      if (res && res.chatters) {
        giveawayState.participants.clear();
        res.chatters.forEach(c => {
          giveawayState.participants.set(c.login.toLowerCase(), {
            login: c.login.toLowerCase(),
            displayName: c.name || c.login,
            color: '#00f0ff',
            isMod: false,
            isSub: false,
            timestamp: Date.now()
          });
        });
      }
    } catch(e) {}
  }

  giveawayState.isActive = true;

  if (btnStartGiveaway) btnStartGiveaway.classList.add('hidden');
  if (btnStopGiveaway) btnStopGiveaway.classList.remove('hidden');
  updateGiveawayStatus('live');

  renderParticipantsPool();

  // Automatically post start announcement in Twitch chat (if enabled)
  const sendChat = chkGwSendChat ? chkGwSendChat.checked : true;
  if (sendChat) {
    const startMsg = giveawayState.mode === 'keyword'
      ? `🎉 GIVEAWAY GESTARTET! Gewinn: "${prize}" | Schreibt ${giveawayState.keyword} in den Chat, um teilzunehmen!`
      : `🎉 GIVEAWAY GESTARTET! Gewinn: "${prize}" | Alle aktiven Chatter sind im Lostopf!`;

    try {
      await ipcRenderer.invoke('twitch:send-chat', { message: startMsg, channel });
      showToast('Giveaway gestartet & Start-Ansage automatisch im Chat gepostet!', 'success');
    } catch(e) {
      showToast('Giveaway gestartet!', 'success');
    }
  } else {
    showToast('Giveaway gestartet (Stiller Test-Modus – keine Chat-Ansage).', 'info');
  }
}

async function stopGiveawayRegistration(notifyChat = true) {
  await ipcRenderer.invoke('giveaway:stop-listener');
  giveawayState.isActive = false;

  if (btnStartGiveaway) btnStartGiveaway.classList.remove('hidden');
  if (btnStopGiveaway) btnStopGiveaway.classList.add('hidden');
  updateGiveawayStatus('closed');

  const sendChat = chkGwSendChat ? chkGwSendChat.checked : true;
  if (notifyChat && sendChat) {
    const channel = (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved';
    try {
      await ipcRenderer.invoke('twitch:send-chat', { message: '🔒 Die Giveaway-Registrierung ist beendet! Der Gewinner wird jetzt ermittelt...', channel });
    } catch(e) {}
    showToast('Giveaway-Registrierung geschlossen & Chat informiert.', 'info');
  } else if (notifyChat) {
    showToast('Giveaway-Registrierung geschlossen (Stiller Modus).', 'info');
  }
}

// Roulette / Dice Drawing
async function drawGiveawayWinner() {
  const validParticipants = Array.from(giveawayState.participants.values()).filter(p => !isParticipantExcluded(p));

  if (validParticipants.length === 0) {
    showToast('Keine berechtigten Teilnehmer im Pool gefunden!', 'error');
    return;
  }

  if (btnDrawWinner) {
    btnDrawWinner.disabled = true;
    btnDrawWinner.classList.add('rolling');
    btnDrawWinner.textContent = '🎲 ZIEHE GEWINNER...';
  }

  // Animation: rapidly cycle names
  let count = 0;
  const maxShuffles = 18;
  const interval = setInterval(async () => {
    count++;
    const randomPick = validParticipants[Math.floor(Math.random() * validParticipants.length)];
    if (winnerDisplayContainer) {
      winnerDisplayContainer.innerHTML = `
        <div class="winner-card-inner" style="justify-content:center;">
          <div class="winner-username-hero" style="color:var(--accent-cyan); font-size:1.6rem; animation: participantPop 0.1s;">
            🎲 ${escapeHtml(randomPick.displayName || randomPick.login)}
          </div>
        </div>
      `;
    }

    if (count >= maxShuffles) {
      clearInterval(interval);

      // Final Winner Selected
      const finalWinner = validParticipants[Math.floor(Math.random() * validParticipants.length)];
      const prize = inputGiveawayPrize ? inputGiveawayPrize.value.trim() : giveawayState.prize;

      const winnerObj = {
        id: 'gw-' + Date.now(),
        username: finalWinner.login,
        displayName: finalWinner.displayName || finalWinner.login,
        avatar: 'https://static-cdn.jtvnw.net/user-default-pictures-uv/75305db0-3a59-4d70-9050-0b42c497426a-profile_image-70x70.png',
        prize: prize || 'Shisha-Paket',
        timestamp: Date.now(),
        status: 'waiting_address',
        address: {
          fullName: '',
          street: '',
          zip: '',
          city: '',
          country: 'Deutschland',
          note: ''
        }
      };

      // Fetch avatar from Twitch Helix backend
      try {
        const uRes = await ipcRenderer.invoke('twitch:get-user-info', finalWinner.login);
        if (uRes && uRes.user && uRes.user.profile_image_url) {
          winnerObj.avatar = uRes.user.profile_image_url;
        }
      } catch(e) {}

      giveawayState.currentWinner = winnerObj;
      await ipcRenderer.invoke('giveaway:save-winner', winnerObj);

      renderWinnerHero(winnerObj);
      renderAddressReview(winnerObj);
      loadGiveawayWinnersHistory();

      // Play victory chime
      playNotificationSound();

      if (btnDrawWinner) {
        btnDrawWinner.disabled = false;
        btnDrawWinner.classList.remove('rolling');
        btnDrawWinner.textContent = '🎲 GEWINNER AUSLOSEN';
      }

      // Announce winner in Twitch chat (if enabled)
      const sendChat = chkGwSendChat ? chkGwSendChat.checked : true;
      if (sendChat) {
        const channel = (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved';
        let claimBaseUrl = 'https://bazztee.github.io/shishawg-mod-setup-tool/claim.html';
        try {
          const cfg = await ipcRenderer.invoke('giveaway:get-telegram-config');
          if (cfg && cfg.claimUrl && cfg.claimUrl.trim()) {
            claimBaseUrl = cfg.claimUrl.trim();
          }
        } catch(e) {}

        const sep = claimBaseUrl.includes('?') ? '&' : '?';
        const link = `${claimBaseUrl}${sep}id=${winnerObj.id}&user=${encodeURIComponent(winnerObj.username)}&prize=${encodeURIComponent(winnerObj.prize)}`;
        const winChatMsg = `🎉 Glückwunsch @${winnerObj.username}! Du hast "${winnerObj.prize}" gewonnen! 🎁 Bitte trage deine Versandadresse direkt hier ein: ${link}`;

        try {
          await ipcRenderer.invoke('twitch:send-chat', { message: winChatMsg, channel });
          showToast(`🎉 Gewinner ausgelost & live im Twitch-Chat verkündet: @${winnerObj.displayName}!`, 'success');
        } catch(e) {
          showToast(`🎉 Gewinner ausgelost: ${winnerObj.displayName}!`, 'success');
        }
      } else {
        showToast(`🎉 Gewinner ausgelost (Stiller Modus): @${winnerObj.displayName}!`, 'success');
      }
    }
  }, 90);
}

function renderWinnerHero(winner) {
  if (!winnerDisplayContainer) return;
  if (!winner) {
    winnerDisplayContainer.className = 'winner-hero-box';
    winnerDisplayContainer.innerHTML = `
      <div class="empty-winner-state">
        <span>🎲 Klicke auf <strong>„GEWINNER AUSLOSEN“</strong>, um einen Gewinner zu ermitteln.</span>
      </div>
    `;
    if (winnerQuickActions) winnerQuickActions.classList.add('hidden');
    return;
  }

  const timeStr = new Date(winner.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  winnerDisplayContainer.className = 'winner-hero-box celebrate';
  winnerDisplayContainer.innerHTML = `
    <div class="winner-card-inner">
      <img src="${escapeHtml(winner.avatar)}" alt="${escapeHtml(winner.displayName)}" class="winner-avatar-lg" onerror="this.src='https://static-cdn.jtvnw.net/user-default-pictures-uv/75305db0-3a59-4d70-9050-0b42c497426a-profile_image-70x70.png'">
      <div class="winner-details-col">
        <span class="winner-username-hero">${escapeHtml(winner.displayName)}</span>
        <span class="winner-time-badge">🏆 Gewonnen um ${escapeHtml(timeStr)} Uhr</span>
      </div>
    </div>
  `;

  if (winnerQuickActions) winnerQuickActions.classList.remove('hidden');
}

function renderAddressReview(winner) {
  if (!displayWinnerPrize) return;

  if (!winner) {
    displayWinnerPrize.textContent = '—';
    if (winnerAddressStatusPill) {
      winnerAddressStatusPill.className = 'address-status-pill pending';
      winnerAddressStatusPill.textContent = 'Kein Gewinner';
    }
    if (inputWinnerFullname) inputWinnerFullname.value = '';
    if (inputWinnerStreet) inputWinnerStreet.value = '';
    if (inputWinnerZip) inputWinnerZip.value = '';
    if (inputWinnerCity) inputWinnerCity.value = '';
    if (inputWinnerCountry) inputWinnerCountry.value = 'Deutschland';
    return;
  }

  displayWinnerPrize.textContent = `🎁 ${winner.prize || 'Shisha-Paket'}`;

  // Update Status Pill
  if (winnerAddressStatusPill) {
    if (winner.status === 'sent_to_telegram') {
      winnerAddressStatusPill.className = 'address-status-pill sent';
      winnerAddressStatusPill.textContent = '✅ An Marvin übermittelt';
    } else if (winner.status === 'address_received') {
      winnerAddressStatusPill.className = 'address-status-pill received';
      winnerAddressStatusPill.textContent = '📥 Adresse eingegangen (Prüfen)';
    } else if (winner.status === 'shipped') {
      winnerAddressStatusPill.className = 'address-status-pill shipped';
      winnerAddressStatusPill.textContent = '📦 Verschickt';
    } else {
      winnerAddressStatusPill.className = 'address-status-pill waiting';
      winnerAddressStatusPill.textContent = '⏳ Wartet auf Adresse';
    }
  }

  // Populate address inputs if present
  const addr = winner.address || {};
  if (inputWinnerFullname) inputWinnerFullname.value = addr.fullName || '';
  if (inputWinnerStreet) inputWinnerStreet.value = addr.street || '';
  if (inputWinnerZip) inputWinnerZip.value = addr.zip || '';
  if (inputWinnerCity) inputWinnerCity.value = addr.city || '';
  if (inputWinnerCountry) inputWinnerCountry.value = addr.country || 'Deutschland';
}

async function loadGiveawayWinnersHistory() {
  if (!winnersHistoryTbody) return;
  try {
    const res = await ipcRenderer.invoke('giveaway:get-winners');
    if (res && res.success && Array.isArray(res.winners)) {
      giveawayState.winnersHistory = res.winners;
      renderWinnersHistory(res.winners);
    }
  } catch(e) {}
}

function renderWinnersHistory(winners) {
  if (!winnersHistoryTbody) return;
  if (!winners || winners.length === 0) {
    winnersHistoryTbody.innerHTML = '<tr><td colspan="7" class="empty-list-placeholder">Noch keine Gewinner in der Historie.</td></tr>';
    return;
  }

  let html = '';
  winners.forEach(w => {
    const timeStr = w.timestamp ? new Date(w.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    const dateStr = w.timestamp ? new Date(w.timestamp).toLocaleDateString([], { day: '2-digit', month: '2-digit' }) : '';
    const addr = w.address || {};
    const addrPreview = addr.street ? `${addr.street}, ${addr.zip} ${addr.city}` : '—';
    const recipient = addr.fullName || '—';

    let statusHtml = '<span class="address-status-pill waiting">Wartend</span>';
    if (w.status === 'sent_to_telegram') statusHtml = '<span class="address-status-pill sent">✅ Telegram</span>';
    if (w.status === 'address_received') statusHtml = '<span class="address-status-pill received">📥 Prüfen</span>';
    if (w.status === 'shipped') statusHtml = '<span class="address-status-pill shipped">📦 Verschickt</span>';

    html += `
      <tr data-id="${w.id}">
        <td><span style="color:var(--text-secondary); font-size:0.75rem;">${dateStr} ${timeStr}</span></td>
        <td><strong style="color:var(--accent-cyan)">@${escapeHtml(w.username)}</strong></td>
        <td><span style="font-size:0.78rem; font-weight:600;">${escapeHtml(w.prize)}</span></td>
        <td>${escapeHtml(recipient)}</td>
        <td><span style="font-size:0.75rem; color:var(--text-secondary);">${escapeHtml(addrPreview)}</span></td>
        <td>${statusHtml}</td>
        <td>
          <div style="display:flex; gap:4px;">
            <button class="btn btn-secondary btn-xs btn-load-winner" data-id="${w.id}" title="In Adressmaske laden">👁️</button>
            <button class="btn-delete-cmd btn-delete-winner" data-id="${w.id}" title="Löschen">✕</button>
          </div>
        </td>
      </tr>
    `;
  });

  winnersHistoryTbody.innerHTML = html;

  // Row Action Listeners
  winnersHistoryTbody.querySelectorAll('.btn-load-winner').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      const found = giveawayState.winnersHistory.find(w => w.id === id);
      if (found) {
        giveawayState.currentWinner = found;
        renderWinnerHero(found);
        renderAddressReview(found);
        showToast(`Gewinner @${found.username} in Adressmaske geladen.`, 'info');
      }
    });
  });

  winnersHistoryTbody.querySelectorAll('.btn-delete-winner').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      // Optimistic instant UI deletion
      giveawayState.winnersHistory = giveawayState.winnersHistory.filter(w => w.id !== id);
      renderWinnersHistory(giveawayState.winnersHistory);

      const res = await ipcRenderer.invoke('giveaway:delete-winner', id);
      if (res && res.success && Array.isArray(res.winners)) {
        giveawayState.winnersHistory = res.winners;
        renderWinnersHistory(res.winners);
      }
      showToast('Eintrag aus Gewinner-Historie gelöscht', 'info');
    });
  });
}

function getFormattedTelegramMessage(winner) {
  if (!winner) return '';
  const addr = winner.address || {};
  const dateStr = new Date(winner.timestamp || Date.now()).toLocaleString('de-DE');

  return `🎁 <b>NEUER GEWINNER - ShishaWG Giveaway</b>\n` +
         `🏆 <b>Twitch-User:</b> @${winner.username}\n` +
         `📦 <b>Gewinn:</b> ${winner.prize || 'Shisha Paket'}\n` +
         `👤 <b>Empfänger:</b> ${addr.fullName || '—'}\n` +
         `🏠 <b>Adresse:</b> ${addr.street || '—'}, ${addr.zip || ''} ${addr.city || ''} (${addr.country || 'Deutschland'})\n` +
         `📅 <b>Datum:</b> ${dateStr}\n` +
         `✅ <b>Status:</b> Adresse von Mod-Team geprüft & freigegeben`;
}

function setupGiveawaysListeners() {
  // Mode Change
  if (selectGiveawayMode && groupGwKeyword) {
    selectGiveawayMode.addEventListener('change', () => {
      if (selectGiveawayMode.value === 'keyword') {
        groupGwKeyword.classList.remove('hidden');
      } else {
        groupGwKeyword.classList.add('hidden');
      }
    });
  }

  // Chat Announcement Toggle
  if (chkGwSendChat) {
    chkGwSendChat.addEventListener('change', () => {
      if (btnStartGiveaway) {
        btnStartGiveaway.textContent = chkGwSendChat.checked
          ? '▶️ Giveaway starten & Chat informieren'
          : '▶️ Giveaway starten (Stiller Test-Modus)';
      }
      showToast(chkGwSendChat.checked ? '📢 Twitch-Chat Benachrichtigungen aktiviert' : '🔇 Stiller Test-Modus aktiv (keine Chat-Nachrichten)', 'info');
    });
  }

  // Start Giveaway
  if (btnStartGiveaway) {
    btnStartGiveaway.addEventListener('click', startGiveawayRegistration);
  }

  // Stop Giveaway
  if (btnStopGiveaway) {
    btnStopGiveaway.addEventListener('click', stopGiveawayRegistration);
  }

  // Clear Participants
  if (btnClearParticipants) {
    btnClearParticipants.addEventListener('click', () => {
      giveawayState.participants.clear();
      renderParticipantsPool();
      showToast('Teilnehmerliste geleert', 'info');
    });
  }

  // Draw Winner Button
  if (btnDrawWinner) {
    btnDrawWinner.addEventListener('click', drawGiveawayWinner);
  }

  // Reroll Winner Button
  if (btnRerollWinner) {
    btnRerollWinner.addEventListener('click', () => {
      drawGiveawayWinner();
    });
  }

  // Save Address Button
  if (btnSaveWinnerAddress) {
    btnSaveWinnerAddress.addEventListener('click', async () => {
      if (!giveawayState.currentWinner) {
        showToast('Kein aktiver Gewinner ausgewählt', 'error');
        return;
      }

      const addr = {
        fullName: inputWinnerFullname ? inputWinnerFullname.value.trim() : '',
        street: inputWinnerStreet ? inputWinnerStreet.value.trim() : '',
        zip: inputWinnerZip ? inputWinnerZip.value.trim() : '',
        city: inputWinnerCity ? inputWinnerCity.value.trim() : '',
        country: inputWinnerCountry ? inputWinnerCountry.value.trim() : 'Deutschland'
      };

      giveawayState.currentWinner.address = addr;
      if (giveawayState.currentWinner.status === 'waiting_address' && addr.street) {
        giveawayState.currentWinner.status = 'address_received';
      }

      await ipcRenderer.invoke('giveaway:save-winner', giveawayState.currentWinner);
      renderAddressReview(giveawayState.currentWinner);
      loadGiveawayWinnersHistory();
      showToast('Adresse erfolgreich gespeichert!', 'success');
    });
  }

  // Send to Telegram Bot Button (Freigeben & an Marvin senden)
  if (btnSendWinnerTelegram) {
    btnSendWinnerTelegram.addEventListener('click', async () => {
      if (!giveawayState.currentWinner) {
        showToast('Kein aktiver Gewinner ausgewählt', 'error');
        return;
      }

      const w = giveawayState.currentWinner;
      w.address = {
        fullName: inputWinnerFullname ? inputWinnerFullname.value.trim() : '',
        street: inputWinnerStreet ? inputWinnerStreet.value.trim() : '',
        zip: inputWinnerZip ? inputWinnerZip.value.trim() : '',
        city: inputWinnerCity ? inputWinnerCity.value.trim() : '',
        country: inputWinnerCountry ? inputWinnerCountry.value.trim() : 'Deutschland'
      };

      const text = getFormattedTelegramMessage(w);

      showToast('Sende Datensatz an Marvins Telegram-Bot...', 'info');
      try {
        const res = await ipcRenderer.invoke('giveaway:send-telegram', { text });
        if (res && res.success) {
          w.status = 'sent_to_telegram';
          await ipcRenderer.invoke('giveaway:save-winner', w);
          renderAddressReview(w);
          loadGiveawayWinnersHistory();
          showToast('🚀 Gewinner & Adresse erfolgreich an Marvin (Telegram) übermittelt!', 'success');
        } else {
          showToast(`Telegram-Fehler: ${res && res.error ? res.error : 'Übertragung fehlgeschlagen'}`, 'error');
          if (telegramConfigModal) telegramConfigModal.classList.remove('hidden');
        }
      } catch(e) {
        showToast('Telegram-Fehler: ' + e.message, 'error');
      }
    });
  }

  // Copy Telegram Text Button
  if (btnCopyWinnerTelegramText) {
    btnCopyWinnerTelegramText.addEventListener('click', () => {
      if (!giveawayState.currentWinner) {
        showToast('Kein aktiver Gewinner ausgewählt', 'error');
        return;
      }
      const text = getFormattedTelegramMessage(giveawayState.currentWinner);
      navigator.clipboard.writeText(text);
      showToast('Formatierter Telegram-Text kopiert!', 'success');
    });
  }

  // Refresh History
  if (btnRefreshWinnersHistory) {
    btnRefreshWinnersHistory.addEventListener('click', async () => {
      await loadGiveawayWinnersHistory();
      showToast('Gewinner-Historie aktualisiert', 'info');
    });
  }

  // Reset Giveaway Button (Silent reset, no chat spam)
  if (btnResetGiveaway) {
    btnResetGiveaway.addEventListener('click', async () => {
      await stopGiveawayRegistration(false); // Silent stop, no chat message
      giveawayState.participants.clear();
      giveawayState.currentWinner = null;
      renderParticipantsPool();
      renderWinnerHero(null);
      renderAddressReview(null);
      updateGiveawayStatus('offline');
      showToast('Giveaway zurückgesetzt.', 'info');
    });
  }

  // Finish & Archive Giveaway Button
  if (btnFinishGiveaway) {
    btnFinishGiveaway.addEventListener('click', async () => {
      if (giveawayState.currentWinner) {
        // Save current winner data to history
        await ipcRenderer.invoke('giveaway:save-winner', giveawayState.currentWinner);
      }
      await stopGiveawayRegistration(false); // Silent stop
      giveawayState.participants.clear();
      giveawayState.currentWinner = null;
      renderParticipantsPool();
      renderWinnerHero(null);
      renderAddressReview(null);
      updateGiveawayStatus('offline');
      await loadGiveawayWinnersHistory();
      showToast('✨ Giveaway erfolgreich archiviert! Bereit für die nächste Runde.', 'success');
    });
  }

  // Telegram Config Modal
  if (btnOpenTelegramConfig && telegramConfigModal) {
    btnOpenTelegramConfig.addEventListener('click', async () => {
      const cfg = await ipcRenderer.invoke('giveaway:get-telegram-config');
      if (cfg) {
        if (inputTelegramBotToken) inputTelegramBotToken.value = cfg.botToken || '';
        if (inputTelegramChatId) inputTelegramChatId.value = cfg.chatId || '';
        if (inputGiveawayClaimUrl) inputGiveawayClaimUrl.value = cfg.claimUrl || '';
      }
      telegramConfigModal.classList.remove('hidden');
    });
  }

  if (btnCloseTelegramConfigModal && telegramConfigModal) {
    btnCloseTelegramConfigModal.addEventListener('click', () => telegramConfigModal.classList.add('hidden'));
  }
  if (btnCancelTelegramConfig && telegramConfigModal) {
    btnCancelTelegramConfig.addEventListener('click', () => telegramConfigModal.classList.add('hidden'));
  }

  if (btnSaveTelegramConfig && telegramConfigModal) {
    btnSaveTelegramConfig.addEventListener('click', async () => {
      const botToken = inputTelegramBotToken ? inputTelegramBotToken.value.trim() : '';
      const chatId = inputTelegramChatId ? inputTelegramChatId.value.trim() : '';
      const claimUrl = inputGiveawayClaimUrl ? inputGiveawayClaimUrl.value.trim() : '';
      await ipcRenderer.invoke('giveaway:save-telegram-config', { botToken, chatId, claimUrl });
      telegramConfigModal.classList.add('hidden');
      showToast('Einstellungen gespeichert & synchronisiert!', 'success');
    });
  }

  if (btnTestTelegramBot) {
    btnTestTelegramBot.addEventListener('click', async () => {
      const botToken = inputTelegramBotToken ? inputTelegramBotToken.value.trim() : '';
      const chatId = inputTelegramChatId ? inputTelegramChatId.value.trim() : '';
      if (!botToken || !chatId) {
        showToast('Bitte erst Token und Chat-ID eingeben', 'error');
        return;
      }
      showToast('Sende Test-Nachricht an Telegram...', 'info');
      const testText = `🔔 <b>ShishaWG Mod Tool - Test-Nachricht</b>\nTelegram-Bot erfolgreich verbunden! 🚀`;
      const res = await ipcRenderer.invoke('giveaway:send-telegram', { text: testText, botToken, chatId });
      if (res && res.success) {
        showToast('✅ Test-Nachricht erfolgreich an Telegram gesendet!', 'success');
      } else {
        showToast(`❌ Fehler: ${res && res.error ? res.error : 'Ungültiger Token oder Chat-ID'}`, 'error');
      }
    });
  }

  // Filter changes update pool immediately
  [chkGwExcludeBots, chkGwExcludeMods, chkGwExcludeWatchlist, chkGwExcludePrevWinners].forEach(chk => {
    if (chk) {
      chk.addEventListener('change', () => {
        renderParticipantsPool();
      });
    }
  });

  // Incoming Participant from Twitch IRC Listener
  ipcRenderer.on('giveaway:new-participant', (event, participant) => {
    if (!giveawayState.isActive) return;
    if (!participant || !participant.login) return;

    giveawayState.participants.set(participant.login.toLowerCase(), participant);
    renderParticipantsPool();
  });
}
