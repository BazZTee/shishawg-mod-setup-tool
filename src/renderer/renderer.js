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

// =========================================================================
// STREAMER PROFILES MANAGEMENT SYSTEM
// =========================================================================
let streamerProfiles = [];
let activeProfileId = 'prof_shishawg';
let editingProfileId = null;

function getActiveStreamerProfile() {
  return streamerProfiles.find(p => p.id === activeProfileId) || streamerProfiles[0] || {
    id: 'prof_shishawg',
    name: 'ShishaWG (Marvin)',
    targetChannel: 'marved',
    botName: 'marvedbot',
    defaultPersons: ['Marvin', 'Hasty', 'Kai'],
    youtubeChannels: ['@shishawg', '@marvocado'],
    promoCodes: [
      { shop: 'HookahFloW', code: 'SHISHAWG10', desc: '10% Rabatt' },
      { shop: 'Moze', code: 'SHISHAWG', desc: 'Rabattcode' }
    ],
    telegram: { botToken: '', chatId: '', claimUrl: '' },
    isDefault: true
  };
}

async function loadStreamerProfiles() {
  try {
    const res = await ipcRenderer.invoke('profiles:get-all');
    if (res && res.success) {
      streamerProfiles = res.profiles || [];
      activeProfileId = res.activeProfileId || (streamerProfiles[0]?.id || 'prof_shishawg');
    }
  } catch(e) {
    console.error('Failed to load streamer profiles:', e);
  }
  updateLandingProfileDropdown();
  await applyActiveStreamerProfile(false);
}

function updateLandingProfileDropdown() {
  const select = document.getElementById('select-active-streamer-profile');
  if (!select) return;
  select.innerHTML = streamerProfiles.map(p => `
    <option value="${escapeHtml(p.id)}" ${p.id === activeProfileId ? 'selected' : ''}>
      ${escapeHtml(p.name)} (#${escapeHtml(p.targetChannel || 'marved')})
    </option>
  `).join('');
}

async function applyActiveStreamerProfile(saveToBackend = true) {
  const prof = getActiveStreamerProfile();
  if (!prof) return;

  // 1. Update Target Channel & Bot in UI & state
  if (prof.targetChannel) {
    state.targetChannel = prof.targetChannel;
    if (targetChannelInput) targetChannelInput.value = prof.targetChannel;
  }
  if (prof.botName && targetBotInput) {
    targetBotInput.value = prof.botName;
  }

  // 2. Update Channel status pill & tooltips
  updateChannelBotTooltips();
  checkLiveStreamStatus();

  // 3. Update Landing Page Dropdown selection
  const select = document.getElementById('select-active-streamer-profile');
  if (select && select.value !== activeProfileId) {
    select.value = activeProfileId;
  }

  // 4. Update YouTube Search Placeholder
  const ytSearchInput = document.getElementById('qa-yt-search-input');
  if (ytSearchInput) {
    const ytNames = (prof.youtubeChannels || []).join(', ') || '@shishawg';
    ytSearchInput.placeholder = `🔍 YouTube-Videos (${ytNames}) durchsuchen (z. B. phunnel, kopfbau, hmd)...`;
  }

  // 5. Update Q&A Persons Pills if applicable
  if (Array.isArray(prof.defaultPersons) && prof.defaultPersons.length > 0 && typeof renderQnAPersonsPillList === 'function') {
    renderQnAPersonsPillList(prof.defaultPersons);
  }

  // 6. Re-bind Channel Points Listener
  try {
    ipcRenderer.invoke('channelpoints:start-listener', { channel: prof.targetChannel }).catch(() => {});
  } catch(e) {}

  if (saveToBackend) {
    await ipcRenderer.invoke('profiles:set-active', activeProfileId);
    showToast(`🎮 Aktiver Streamer: ${prof.name} (#${prof.targetChannel})`, 'success');
  }
}

function setupProfileEventListeners() {
  const select = document.getElementById('select-active-streamer-profile');
  if (select) {
    select.addEventListener('change', async (e) => {
      activeProfileId = e.target.value;
      await applyActiveStreamerProfile(true);
    });
  }

  const btnOpen = document.getElementById('btn-open-streamer-profiles');
  if (btnOpen) {
    btnOpen.addEventListener('click', openStreamerProfilesModal);
  }

  const btnClose = document.getElementById('btn-close-profiles-modal');
  if (btnClose) {
    btnClose.addEventListener('click', closeStreamerProfilesModal);
  }

  const btnCancel = document.getElementById('btn-cancel-profile-edit');
  if (btnCancel) {
    btnCancel.addEventListener('click', closeStreamerProfilesModal);
  }

  const btnAddNew = document.getElementById('btn-add-new-profile');
  if (btnAddNew) {
    btnAddNew.addEventListener('click', () => {
      const newId = 'prof_' + Date.now();
      const newProf = {
        id: newId,
        name: 'Neuer Streamer',
        targetChannel: 'channel',
        botName: 'bot',
        defaultPersons: ['Streamer', 'Gast 1'],
        youtubeChannels: ['@channel'],
        promoCodes: [
          { shop: 'Shop 1', code: 'CODE10', desc: '10% Rabatt' }
        ],
        telegram: { botToken: '', chatId: '', claimUrl: '' },
        isDefault: false
      };
      streamerProfiles.push(newProf);
      editingProfileId = newId;
      renderProfilesSidebar();
      loadProfileIntoEditor(newId);
      const nameInp = document.getElementById('input-profile-name');
      if (nameInp) {
        nameInp.focus();
        nameInp.select();
      }
    });
  }

  const btnDelete = document.getElementById('btn-delete-profile');
  if (btnDelete) {
    btnDelete.addEventListener('click', async () => {
      if (streamerProfiles.length <= 1) {
        showToast('Das letzte verbleibende Profil kann nicht gelöscht werden.', 'error');
        return;
      }
      const toDelete = streamerProfiles.find(p => p.id === editingProfileId);
      const toDeleteName = toDelete ? toDelete.name : 'Profil';
      streamerProfiles = streamerProfiles.filter(p => p.id !== editingProfileId);
      if (activeProfileId === editingProfileId) {
        activeProfileId = streamerProfiles[0].id;
      }
      editingProfileId = streamerProfiles[0].id;
      renderProfilesSidebar();
      loadProfileIntoEditor(editingProfileId);
      updateLandingProfileDropdown();
      await applyActiveStreamerProfile(false);
      await ipcRenderer.invoke('profiles:save-all', { profiles: streamerProfiles, activeProfileId });
      showToast(`Profil "${toDeleteName}" gelöscht.`, 'info');
    });
  }

  const btnAddPromo = document.getElementById('btn-add-profile-promo');
  if (btnAddPromo) {
    btnAddPromo.addEventListener('click', () => {
      const container = document.getElementById('profile-promo-codes-list');
      if (!container) return;
      const newRow = document.createElement('div');
      newRow.className = 'promo-code-row';
      newRow.innerHTML = `
        <input type="text" class="input-promo-shop" placeholder="Shop Name (z. B. HookahFloW)" value="">
        <input type="text" class="input-promo-code" placeholder="Code (z. B. SHISHAWG10)" value="">
        <input type="text" class="input-promo-desc" placeholder="Rabatt (z. B. 10% Rabatt)" value="">
        <button type="button" class="btn-icon btn-remove-promo-row" title="Entfernen">✕</button>
      `;
      newRow.querySelector('.btn-remove-promo-row').addEventListener('click', () => newRow.remove());
      container.appendChild(newRow);
      newRow.querySelector('.input-promo-shop').focus();
    });
  }

  const btnSave = document.getElementById('btn-save-profile-edit');
  if (btnSave) {
    btnSave.addEventListener('click', async () => {
      const nameVal = document.getElementById('input-profile-name')?.value.trim();
      const chanVal = document.getElementById('input-profile-channel')?.value.trim().toLowerCase().replace('#', '');
      const botVal = document.getElementById('input-profile-bot')?.value.trim().toLowerCase().replace('@', '');
      const personsVal = document.getElementById('input-profile-persons')?.value.trim();
      const ytVal = document.getElementById('input-profile-youtube')?.value.trim();
      const tgTokenVal = document.getElementById('input-profile-telegram-token')?.value.trim();
      const tgChatVal = document.getElementById('input-profile-telegram-chatid')?.value.trim();
      const isDefVal = document.getElementById('chk-profile-is-default')?.checked;

      if (!nameVal) {
        showToast('Bitte gib einen Profil-Namen an.', 'error');
        return;
      }

      const currentProf = streamerProfiles.find(p => p.id === editingProfileId);
      if (currentProf) {
        currentProf.name = nameVal;
        currentProf.targetChannel = chanVal || 'marved';
        currentProf.botName = botVal || 'bot';
        currentProf.defaultPersons = personsVal ? personsVal.split(',').map(s => s.trim()).filter(Boolean) : ['Marvin'];
        currentProf.youtubeChannels = ytVal ? ytVal.split(',').map(s => s.trim()).filter(Boolean) : ['@shishawg'];
        currentProf.telegram = {
          botToken: tgTokenVal || '',
          chatId: tgChatVal || '',
          claimUrl: currentProf.telegram?.claimUrl || ''
        };

        const promoRows = document.querySelectorAll('.promo-code-row');
        const collectedPromos = [];
        promoRows.forEach(row => {
          const s = row.querySelector('.input-promo-shop')?.value.trim();
          const c = row.querySelector('.input-promo-code')?.value.trim();
          const d = row.querySelector('.input-promo-desc')?.value.trim();
          if (s || c) {
            collectedPromos.push({ shop: s || 'Shop', code: c || '', desc: d || '' });
          }
        });
        currentProf.promoCodes = collectedPromos;

        if (isDefVal) {
          streamerProfiles.forEach(p => p.isDefault = (p.id === currentProf.id));
        }
      }

      await ipcRenderer.invoke('profiles:save-all', { profiles: streamerProfiles, activeProfileId });
      updateLandingProfileDropdown();
      await applyActiveStreamerProfile(false);
      closeStreamerProfilesModal();
      showToast(`Profil "${nameVal}" gespeichert! ⭐`, 'success');
    });
  }
}

async function openStreamerProfilesModal() {
  const modal = document.getElementById('modal-streamer-profiles');
  if (!modal) return;
  editingProfileId = activeProfileId;
  renderProfilesSidebar();
  loadProfileIntoEditor(editingProfileId);
  modal.classList.remove('hidden');
}

function closeStreamerProfilesModal() {
  const modal = document.getElementById('modal-streamer-profiles');
  if (modal) modal.classList.add('hidden');
}

function renderProfilesSidebar() {
  const listContainer = document.getElementById('profiles-list-container');
  if (!listContainer) return;
  listContainer.innerHTML = streamerProfiles.map(p => `
    <div class="profile-card-item ${p.id === editingProfileId ? 'active' : ''}" data-id="${p.id}">
      <div>
        <div class="profile-card-item-title">${escapeHtml(p.name)} ${p.isDefault ? '⭐' : ''}</div>
        <div class="profile-card-item-channel">#${escapeHtml(p.targetChannel || 'marved')}</div>
      </div>
      ${p.id === activeProfileId ? '<span class="status-dot green" title="Aktuell aktiv"></span>' : ''}
    </div>
  `).join('');

  listContainer.querySelectorAll('.profile-card-item').forEach(card => {
    card.addEventListener('click', () => {
      const pId = card.getAttribute('data-id');
      editingProfileId = pId;
      renderProfilesSidebar();
      loadProfileIntoEditor(pId);
    });
  });
}

async function loadProfileIntoEditor(profileId) {
  const p = streamerProfiles.find(item => item.id === profileId) || streamerProfiles[0];
  if (!p) return;

  const inputName = document.getElementById('input-profile-name');
  const inputChannel = document.getElementById('input-profile-channel');
  const inputBot = document.getElementById('input-profile-bot');
  const inputPersons = document.getElementById('input-profile-persons');
  const inputYt = document.getElementById('input-profile-youtube');
  const inputTgToken = document.getElementById('input-profile-telegram-token');
  const inputTgChatId = document.getElementById('input-profile-telegram-chatid');
  const chkDefault = document.getElementById('chk-profile-is-default');

  if (inputName) inputName.value = p.name || '';
  if (inputChannel) inputChannel.value = p.targetChannel || '';
  if (inputBot) inputBot.value = p.botName || '';
  if (inputPersons) inputPersons.value = Array.isArray(p.defaultPersons) ? p.defaultPersons.join(', ') : (p.defaultPersons || '');
  if (inputYt) inputYt.value = Array.isArray(p.youtubeChannels) ? p.youtubeChannels.join(', ') : (p.youtubeChannels || '');
  if (inputTgToken) inputTgToken.value = p.telegram?.botToken || '';
  if (inputTgChatId) inputTgChatId.value = p.telegram?.chatId || '';
  if (chkDefault) chkDefault.checked = !!p.isDefault;

  // If Telegram token is empty, auto-fetch from Supabase config
  if ((!p.telegram || !p.telegram.botToken) && (inputTgToken && !inputTgToken.value)) {
    try {
      const tgCfg = await ipcRenderer.invoke('giveaway:get-telegram-config');
      if (tgCfg && tgCfg.botToken) {
        if (inputTgToken) inputTgToken.value = tgCfg.botToken;
        if (inputTgChatId) inputTgChatId.value = tgCfg.chatId || '';
        p.telegram = {
          botToken: tgCfg.botToken,
          chatId: tgCfg.chatId || '',
          claimUrl: tgCfg.claimUrl || 'https://bazztee.github.io/shishawg-mod-setup-tool/claim.html'
        };
      }
    } catch(e) {}
  }

  renderPromoCodesEditorList(p.promoCodes || []);
}

function renderPromoCodesEditorList(promos) {
  const container = document.getElementById('profile-promo-codes-list');
  if (!container) return;

  container.innerHTML = (promos.length === 0 ? [{ shop: '', code: '', desc: '' }] : promos).map((promo, idx) => `
    <div class="promo-code-row" data-idx="${idx}">
      <input type="text" class="input-promo-shop" placeholder="Shop Name (z. B. HookahFloW)" value="${escapeHtml(promo.shop || '')}">
      <input type="text" class="input-promo-code" placeholder="Code (z. B. SHISHAWG10)" value="${escapeHtml(promo.code || '')}">
      <input type="text" class="input-promo-desc" placeholder="Rabatt (z. B. 10% Rabatt)" value="${escapeHtml(promo.desc || '')}">
      <button type="button" class="btn-icon btn-remove-promo-row" data-idx="${idx}" title="Entfernen">✕</button>
    </div>
  `).join('');

  container.querySelectorAll('.btn-remove-promo-row').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const row = e.currentTarget.closest('.promo-code-row');
      if (row) row.remove();
    });
  });
}

// Initialize App
async function initApp() {
  setupHubNavigation();
  updateTwitchUI();

  try {
    await loadStreamerProfiles();
    setupProfileEventListeners();
  } catch(e) {
    console.error('Error loading streamer profiles:', e);
  }

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
    setupQnAListeners();
  } catch (e) {
    console.error('Error setting up Q&A & Umfragen:', e);
  }
  try {
    setupStatsListeners();
    loadStatsState();
  } catch (e) {
    console.error('Error setting up Stats & Kohletimer:', e);
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

  // Auto-start Channel Points (Kohle Stücke) listener
  ipcRenderer.invoke('channelpoints:start-listener', { channel: state.targetChannel }).catch(() => {});
  ipcRenderer.on('channelpoints:new-redemption', (event, item) => {
    playNotificationSound();
    showToast(`⬛ Kanalpunkte eingelöst: @${item.user_name || item.user_login} hat Kohle Stücke eingelöst!`, 'success');
    if (typeof pollWinnersUpdates === 'function') pollWinnersUpdates();
  });

  // Auto-focus on first name field
  const firstNameInput = document.querySelector('.input-p-name');
  if (firstNameInput) firstNameInput.focus();

  // Auto-sync catalog from Cloud & HookahTools on startup
  setTimeout(async () => {
    try {
      const res = await ipcRenderer.invoke('db:sync-cloud');
      if (res && res.success && res.catalog) {
        state.catalog = res.catalog;
        updateDatalists();
        const tobaccoMsg = res.hookahTobaccoCount ? `${res.hookahTobaccoCount} Tabaksorten von HookahTools` : 'Tabak';
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
      giveawaySyncInterval = setInterval(loadGiveawayWinnersHistory, 2500);
    }
  } else {
    if (giveawaySyncInterval) {
      clearInterval(giveawaySyncInterval);
      giveawaySyncInterval = null;
    }
  }

  // If opening Q&A or Polls, load state & start live sync
  if (targetViewId === 'view-qna' || targetViewId === 'view-polls') {
    unreadQnACount = 0;
    const badge = document.getElementById('hub-qna-unread');
    if (badge) {
      badge.classList.add('hidden');
      badge.textContent = '0';
    }
    loadQnAState();
    if (!qnaSyncInterval) {
      qnaSyncInterval = setInterval(loadQnAState, 2500);
    }
  } else {
    if (qnaSyncInterval) {
      clearInterval(qnaSyncInterval);
      qnaSyncInterval = null;
    }
  }

  // If opening Stats & Kohletimer, load state
  if (targetViewId === 'view-stats') {
    loadStatsState();
  }
}

function highlightTwitchLoginButton() {
  const btn = document.getElementById('btn-twitch-login');
  if (!btn) return;
  btn.classList.remove('pulse-highlight');
  void btn.offsetWidth;
  btn.classList.add('pulse-highlight');
  setTimeout(() => {
    btn.classList.remove('pulse-highlight');
  }, 2400);
}

function setupHubNavigation() {
  // Tile clicks on Landing Page
  const hubTiles = document.querySelectorAll('.hub-tile-card');
  hubTiles.forEach(tile => {
    tile.addEventListener('click', () => {
      if (!state.twitchUser) {
        showToast('🔒 Bitte verbinde dich zuerst oben rechts mit Twitch!', 'warning');
        highlightTwitchLoginButton();
        return;
      }
      const targetViewId = tile.getAttribute('data-target');
      if (targetViewId) showView(targetViewId);
    });

    // Keyboard Accessibility (Enter or Space to open tile)
    tile.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (!state.twitchUser) {
          showToast('🔒 Bitte verbinde dich zuerst oben rechts mit Twitch!', 'warning');
          highlightTwitchLoginButton();
          return;
        }
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
let wasStreamLiveBefore = false;

async function checkLiveStreamStatus() {
  if (!streamStatusText || !streamStatusDot) return;
  const channel = (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved';

  try {
    const res = await ipcRenderer.invoke('twitch:check-stream-status', channel);
    if (res && res.live) {
      wasStreamLiveBefore = true;
      streamStatusDot.className = 'status-indicator-dot red pulse';
      const viewers = res.viewer_count !== undefined ? ` (${res.viewer_count.toLocaleString('de-DE')} 👁️)` : '';
      const game = res.game_name ? ` • ${res.game_name}` : '';
      streamStatusText.textContent = `#${channel}: 🔴 LIVE${viewers}${game}`;
      if (streamStatusPill) {
        streamStatusPill.title = `Live: ${res.title || 'Stream'}\nSpiel: ${res.game_name || '-'}\nZuschauer: ${res.viewer_count || 0}`;
      }
    } else {
      if (wasStreamLiveBefore) {
        // Stream just went offline! Auto-archive any active smoking head session
        wasStreamLiveBefore = false;
        if (typeof statsState !== 'undefined' && statsState.isRunning && statsState.sessionElapsedSeconds >= 120 && statsState.activeSetup && statsState.activeSetup.tobacco) {
          autoArchiveFinishedSession(statsState.activeSetup, statsState.sessionElapsedSeconds, statsState.coalRotations, statsState.sessionStartTime);
          resetActiveTimer();
          showToast('Stream ist offline gegangen: Aktiver Kopf wurde automatisch archiviert! 🏁', 'info');
        }
      }

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
  try {
    const authData = await ipcRenderer.invoke('twitch:check-auth');
    if (authData && authData.user) {
      state.twitchUser = authData.user;
      if (authData.targetChannel) {
        state.targetChannel = authData.targetChannel;
        if (targetChannelInput) targetChannelInput.value = state.targetChannel;
      }
      if (authData.clientId) {
        state.clientId = authData.clientId;
        if (inputClientId) inputClientId.value = state.clientId;
      }
    } else {
      state.twitchUser = null;
      const cfg = await ipcRenderer.invoke('twitch:get-config');
      if (cfg && cfg.clientId) {
        state.clientId = cfg.clientId;
        if (inputClientId) inputClientId.value = state.clientId;
      }
    }
  } catch (err) {
    console.error('Error during checkTwitchAuth:', err);
    state.twitchUser = null;
  }
  updateTwitchUI();
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
  const hubTiles = document.querySelectorAll('.hub-tile-card');
  const landingSubtitle = document.querySelector('.landing-subtitle');
  const landingTwitchBanner = document.getElementById('landing-twitch-banner');

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

    if (landingTwitchBanner) landingTwitchBanner.classList.add('hidden');
    if (landingSubtitle) landingSubtitle.textContent = 'Wähle ein Modul aus, um zu starten:';

    // Unlock all tiles
    hubTiles.forEach(tile => {
      tile.classList.remove('locked');
      tile.removeAttribute('aria-disabled');
      const badge = tile.querySelector('.tile-badge');
      if (badge && !badge.classList.contains('planned')) {
        badge.className = 'tile-badge ready';
        badge.textContent = 'Bereit / Aktiv';
      }
      const actionSpan = tile.querySelector('.tile-action span');
      if (actionSpan) {
        actionSpan.textContent = 'Tool öffnen ➔';
      }
    });
  } else {
    btnTwitchLogin.classList.remove('hidden');
    twitchUserBadge.classList.add('hidden');
    if (previewModName) {
      previewModName.textContent = 'Mod:';
      previewModName.style.color = savedColor;
    }

    if (landingTwitchBanner) landingTwitchBanner.classList.remove('hidden');
    if (landingSubtitle) landingSubtitle.textContent = 'Bitte verbinde dich zuerst mit Twitch, um auf die Module zuzugreifen:';

    // Lock all tiles (grey out & non-clickable)
    hubTiles.forEach(tile => {
      tile.classList.add('locked');
      tile.setAttribute('aria-disabled', 'true');
      const badge = tile.querySelector('.tile-badge');
      if (badge && !badge.classList.contains('planned')) {
        badge.className = 'tile-badge locked';
        badge.textContent = '🔒 Login erforderlich';
      }
      const actionSpan = tile.querySelector('.tile-action span');
      if (actionSpan) {
        actionSpan.textContent = '🔒 Twitch verbinden';
      }
    });
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
      tobaccos: [''],
      tobaccoAmounts: [''],
      tobaccoUnit: 'g',
      showTobaccoAmounts: false
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
        tobaccos: [''],
        tobaccoAmounts: [''],
        tobaccoUnit: 'g',
        showTobaccoAmounts: false
      };
      state.persons[i] = p;
    }

    if (!p.tobaccos || p.tobaccos.length === 0) {
      p.tobaccos = [''];
    }
    if (!p.tobaccoAmounts) {
      p.tobaccoAmounts = p.tobaccos.map(() => '');
    }
    if (!p.tobaccoUnit) {
      p.tobaccoUnit = 'g';
    }

    const card = document.createElement('div');
    card.className = 'person-card';
    card.setAttribute('data-index', i);

    // Build Tobacco Slot HTML
    const tobaccoSlotsHtml = (p.tobaccos || ['']).map((tVal, tIdx) => {
      const amtVal = (p.tobaccoAmounts && p.tobaccoAmounts[tIdx] !== undefined) ? p.tobaccoAmounts[tIdx] : '';
      const unit = p.tobaccoUnit || 'g';
      return `
      <div class="tobacco-slot-row">
        <div class="clearable-input-wrapper" style="flex:1;">
          <input type="text" class="input-p-tob" data-pindex="${i}" data-tindex="${tIdx}" list="list-tobacco" value="${escapeHtml(tVal)}" placeholder="Tabak ${tIdx + 1}">
          <button class="btn-clear-field ${tVal ? '' : 'hidden'}" tabindex="-1" title="Feld leeren">✕</button>
        </div>
        ${p.showTobaccoAmounts ? `
        <div class="tobacco-amount-input-wrapper">
          <input type="text" class="input-p-tob-amount" data-pindex="${i}" data-tindex="${tIdx}" value="${escapeHtml(amtVal)}" placeholder="${unit === '%' ? '50%' : '12g'}">
        </div>
        ` : ''}
        ${tIdx > 0 ? `<button class="btn-icon btn-remove-tobacco-slot" data-pindex="${i}" data-tindex="${tIdx}" title="Tabaksortenslot entfernen">✕</button>` : ''}
      </div>
    `;
    }).join('');

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
          <label class="toggle-switch checkbox-label" style="font-size: 0.78rem;" title="Kennzeichnet diese Person als E-Gerät Nutzer (z. B. XKAH Lite / Pro)">
            <input type="checkbox" class="chk-p-electric" tabindex="-1" data-index="${i}" ${isElectric ? 'checked' : ''}>
            <span class="toggle-slider"></span>
            <span class="toggle-text">⚡ E-Gerät</span>
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
        <div class="tobacco-header-bar">
          <label style="margin-bottom:0;">Tabaksorte(n):</label>
          <div class="tobacco-amount-toggle-group">
            ${p.showTobaccoAmounts ? `
              <div class="unit-selector-pills">
                <button type="button" class="btn-unit-pill ${p.tobaccoUnit === 'g' ? 'active' : ''}" data-pindex="${i}" data-unit="g">g</button>
                <button type="button" class="btn-unit-pill ${p.tobaccoUnit === '%' ? 'active' : ''}" data-pindex="${i}" data-unit="%">%</button>
              </div>
            ` : ''}
            <label class="toggle-switch tobacco-amount-switch-label" title="Mischverhältnis oder Mengenangaben (% oder g) aktivieren">
              <input type="checkbox" class="chk-p-tob-amount" data-pindex="${i}" ${p.showTobaccoAmounts ? 'checked' : ''}>
              <span class="toggle-slider"></span>
              <span class="toggle-text">⚖️ Mengen</span>
            </label>
          </div>
        </div>
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
            if (state.persons[personIdx].tobaccoAmounts) {
              state.persons[personIdx].tobaccoAmounts.push('');
            }
            renderPersonsGrid();
            const newInputs = document.querySelectorAll(`.input-p-tob[data-pindex="${personIdx}"]`);
            if (newInputs[tobIdx]) {
              newInputs[tobIdx].focus();
              newInputs[tobIdx].setSelectionRange(e.target.value.length, e.target.value.length);
            }
          }
        }
      } else if (e.target.classList.contains('input-p-tob-amount')) {
        const personIdx = parseInt(e.target.getAttribute('data-pindex'));
        const tobIdx = parseInt(e.target.getAttribute('data-tindex'));
        if (!isNaN(personIdx) && state.persons[personIdx]) {
          if (!state.persons[personIdx].tobaccoAmounts) {
            state.persons[personIdx].tobaccoAmounts = [];
          }
          state.persons[personIdx].tobaccoAmounts[tobIdx] = e.target.value;
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

  // Tobacco Amount Checkbox Toggle Listener
  document.querySelectorAll('.chk-p-tob-amount').forEach(chk => {
    chk.addEventListener('change', (e) => {
      const pIdx = parseInt(e.currentTarget.getAttribute('data-pindex'));
      if (!isNaN(pIdx) && state.persons[pIdx]) {
        state.persons[pIdx].showTobaccoAmounts = e.currentTarget.checked;
        if (!state.persons[pIdx].tobaccoAmounts) {
          state.persons[pIdx].tobaccoAmounts = state.persons[pIdx].tobaccos.map(() => '');
        }
        if (!state.persons[pIdx].tobaccoUnit) {
          state.persons[pIdx].tobaccoUnit = 'g';
        }
        renderPersonsGrid();
        generateCommandString();
      }
    });
  });

  // Tobacco Amount Unit Toggle Pills (g / %)
  document.querySelectorAll('.btn-unit-pill').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const pIdx = parseInt(e.currentTarget.getAttribute('data-pindex'));
      const unit = e.currentTarget.getAttribute('data-unit');
      if (!isNaN(pIdx) && state.persons[pIdx]) {
        state.persons[pIdx].tobaccoUnit = unit;
        renderPersonsGrid();
        generateCommandString();
      }
    });
  });

  // Remove Tobacco Slot Button
  document.querySelectorAll('.btn-remove-tobacco-slot').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const pIdx = parseInt(e.currentTarget.getAttribute('data-pindex'));
      const tIdx = parseInt(e.currentTarget.getAttribute('data-tindex'));
      if (!isNaN(pIdx) && state.persons[pIdx] && state.persons[pIdx].tobaccos[tIdx] !== undefined) {
        state.persons[pIdx].tobaccos.splice(tIdx, 1);
        if (state.persons[pIdx].tobaccoAmounts && state.persons[pIdx].tobaccoAmounts[tIdx] !== undefined) {
          state.persons[pIdx].tobaccoAmounts.splice(tIdx, 1);
        }
        if (state.persons[pIdx].tobaccos.length === 0) {
          state.persons[pIdx].tobaccos = [''];
          if (state.persons[pIdx].tobaccoAmounts) state.persons[pIdx].tobaccoAmounts = [''];
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
          state.persons[0] = { name: '', pipe: '', vessel: '', vesselColor: '', bowl: '', hmd: '', tobaccos: [''], tobaccoAmounts: [''], tobaccoUnit: 'g', showTobaccoAmounts: false, isElectric: false };
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

    // Kohle (Magic Charcoal) placed directly behind HMD!
    if (!isElec && kohle) {
      personSegments.push(kohle);
    }

    const tobaccos = [];
    const rawTobaccos = p.tobaccos || [];
    const rawAmounts = p.tobaccoAmounts || [];
    const showAmt = !!p.showTobaccoAmounts;
    const unit = p.tobaccoUnit || 'g';

    for (let tIdx = 0; tIdx < rawTobaccos.length; tIdx++) {
      let tVal = (rawTobaccos[tIdx] || '').replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim();
      if (!tVal) continue;
      const amtVal = (rawAmounts[tIdx] || '').replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim();
      if (showAmt && amtVal) {
        const cleanAmt = amtVal.replace(/[^0-9.,]/g, '').trim();
        if (cleanAmt) {
          tVal = `${tVal} (${cleanAmt}${unit})`;
        } else {
          tVal = `${tVal} (${amtVal})`;
        }
      }
      tobaccos.push(tVal);
    }

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

  // Automatic Shisha Session & Head Detection
  if (typeof checkAndAutoStartHeadSession === 'function') {
    checkAndAutoStartHeadSession(false);
  }
}

// Smart Tobacco String Splitter (splits by comma, ' und ', ' & ', ' + ')
function splitTobaccoString(str) {
  if (!str) return [];
  const normalized = str
    .replace(/\s+und\s+/gi, ', ')
    .replace(/\s*&\s*/g, ', ')
    .replace(/\s*\+\s*/g, ', ');
  return normalized.split(',').map(s => s.trim()).filter(Boolean);
}

// Parse individual tobacco item for amount and unit e.g. "MustH - Pynkman (12g)", "Pinkman 12 Gramm", "50%"
function parseTobaccoItem(item) {
  let name = (item || '').replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim();
  let amount = '';
  let unit = 'g';
  let hasAmount = false;

  // Check for bracketed amount e.g. "(12g)", "(12 g)", "(50%)"
  const bracketMatch = name.match(/\(([^)]+)\)$/);
  if (bracketMatch) {
    const inner = bracketMatch[1].trim();
    const amtMatch = inner.match(/^(\d+(?:[.,]\d+)?)\s*(g|gramm|%|prozent)?$/i);
    if (amtMatch) {
      amount = amtMatch[1].replace(',', '.');
      unit = (amtMatch[2] && amtMatch[2].startsWith('%')) ? '%' : 'g';
      hasAmount = true;
      name = name.substring(0, bracketMatch.index).trim();
    }
  } else {
    // Check for trailing amount e.g. "12g", "12 Gramm", "12 g", "50%", "50 %"
    const trailingMatch = name.match(/\s+(\d+(?:[.,]\d+)?)\s*(g|gramm|%|prozent)?$/i);
    if (trailingMatch && trailingMatch[2]) {
      amount = trailingMatch[1].replace(',', '.');
      unit = trailingMatch[2].startsWith('%') ? '%' : 'g';
      hasAmount = true;
      name = name.substring(0, trailingMatch.index).trim();
    }
  }

  return { name, amount, unit, hasAmount };
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
      let tobaccoAmounts = [];
      let hasAmounts = false;
      let unit = 'g';

      if (pSetup.includes('&') || pSetup.includes(',') || pSetup.includes(' und ')) {
        const rawTobs = splitTobaccoString(pSetup);
        pipe = rawTobs.shift() || '';
        rawTobs.forEach(tRaw => {
          const parsedItem = parseTobaccoItem(tRaw);
          if (parsedItem.name) {
            tobaccos.push(parsedItem.name);
            tobaccoAmounts.push(parsedItem.amount);
            if (parsedItem.hasAmount) {
              hasAmounts = true;
              unit = parsedItem.unit;
            }
          }
        });
      } else {
        pipe = pSetup;
      }

      parsedPersons.push({
        name: pName,
        pipe: pipe,
        bowl: '',
        hmd: '',
        tobaccos: tobaccos.length > 0 ? tobaccos : [''],
        tobaccoAmounts: tobaccoAmounts.length > 0 ? tobaccoAmounts : [''],
        tobaccoUnit: unit,
        showTobaccoAmounts: hasAmounts
      });
    } else if (seg.toLowerCase().includes('!kohle') || seg.toLowerCase().includes('kohle') || seg.toLowerCase().includes('cubes') || seg.toLowerCase().includes('zauberwürfel') || seg.toLowerCase().includes('charcoal')) {
      globalKohle = seg;
    } else if (seg.toLowerCase().includes('tasting') || seg.toLowerCase().includes('no aroma')) {
      globalExtra = seg;
    } else if (seg.toLowerCase().includes('hmd') || seg.toLowerCase().includes('grani') || seg.toLowerCase().includes('lotus') || seg.toLowerCase().includes('onmo') || seg.toLowerCase().includes('ao 912')) {
      sharedHmd = seg;
    } else if (seg.toLowerCase().includes('bowl') || seg.toLowerCase().includes('phunnel') || seg.toLowerCase().includes('shot') || seg.toLowerCase().includes('mehrloch') || seg.toLowerCase().includes('cosmo')) {
      sharedBowl = seg;
    } else {
      // Tobacco segment (e.g. "MustH - Pynkman, Blackburn - Green T und Kismet - Black Lavender")
      const currentPerson = parsedPersons.length > 0 ? parsedPersons[parsedPersons.length - 1] : null;
      const rawTobs = splitTobaccoString(seg);

      if (currentPerson && (!currentPerson.pipe || currentPerson.tobaccos[0])) {
        // If first person has no pipe yet and this doesn't look like a mix, assign as pipe
        if (!currentPerson.pipe && rawTobs.length === 1 && !rawTobs[0].includes('-')) {
          currentPerson.pipe = seg;
        } else {
          // Append tobacco items
          rawTobs.forEach(tRaw => {
            const parsedItem = parseTobaccoItem(tRaw);
            if (parsedItem.name) {
              if (currentPerson.tobaccos.length === 1 && !currentPerson.tobaccos[0]) {
                currentPerson.tobaccos[0] = parsedItem.name;
                currentPerson.tobaccoAmounts[0] = parsedItem.amount;
              } else {
                currentPerson.tobaccos.push(parsedItem.name);
                currentPerson.tobaccoAmounts.push(parsedItem.amount);
              }
              if (parsedItem.hasAmount) {
                currentPerson.showTobaccoAmounts = true;
                currentPerson.tobaccoUnit = parsedItem.unit;
              }
            }
          });
        }
      } else if (!currentPerson) {
        // Create default Person 1 (Marvin)
        const newPerson = {
          name: 'Marvin',
          pipe: '',
          bowl: '',
          hmd: '',
          tobaccos: [],
          tobaccoAmounts: [],
          tobaccoUnit: 'g',
          showTobaccoAmounts: false
        };

        if (rawTobs.length === 1 && !rawTobs[0].includes('-')) {
          newPerson.pipe = seg;
          newPerson.tobaccos = [''];
          newPerson.tobaccoAmounts = [''];
        } else {
          rawTobs.forEach(tRaw => {
            const parsedItem = parseTobaccoItem(tRaw);
            if (parsedItem.name) {
              newPerson.tobaccos.push(parsedItem.name);
              newPerson.tobaccoAmounts.push(parsedItem.amount);
              if (parsedItem.hasAmount) {
                newPerson.showTobaccoAmounts = true;
                newPerson.tobaccoUnit = parsedItem.unit;
              }
            }
          });
        }
        parsedPersons.push(newPerson);
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
      tobaccos: segments.length > 1 ? [segments[1]] : [''],
      tobaccoAmounts: [''],
      tobaccoUnit: 'g',
      showTobaccoAmounts: false
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

    // Step 2 & 3: Multi-Word and Single-Token Tobacco Scanning with Amount Detection
    let detectedUnit = 'g';
    const tobaccoMatchesWithAmounts = [];

    function extractAmountFollowing(lastIdx) {
      const nextIdx = lastIdx + 1;
      if (nextIdx >= tokens.length) return '';
      const nextTok = tokens[nextIdx];
      if (usedIndices.has(nextIdx)) return '';

      // Check format like '13g', '3g', '50%', '13.5g'
      const mInline = nextTok.match(/^(\d+(?:[.,]\d+)?)(g|gramm|%|prozent)?$/i);
      if (mInline) {
        const num = mInline[1].replace(',', '.');
        const unit = mInline[2] ? mInline[2].toLowerCase() : '';
        if (unit.includes('%') || unit.includes('prozent')) {
          detectedUnit = '%';
        } else if (unit) {
          detectedUnit = 'g';
        }
        usedIndices.add(nextIdx);

        // Check if next token is unit (e.g. '13' followed by 'g' / 'gramm' / '%')
        if (!unit && nextIdx + 1 < tokens.length && !usedIndices.has(nextIdx + 1)) {
          const uTok = tokens[nextIdx + 1];
          if (/^(g|gramm|%|prozent)$/i.test(uTok)) {
            if (/^(%|prozent)$/i.test(uTok)) detectedUnit = '%';
            else detectedUnit = 'g';
            usedIndices.add(nextIdx + 1);
          }
        }
        return num;
      }
      return '';
    }

    // 2. Multi-word phrase scanning (3-word & 2-word)
    for (let i = 0; i <= tokens.length - 3; i++) {
      if (usedIndices.has(i) || usedIndices.has(i + 1) || usedIndices.has(i + 2)) continue;
      if (isPersonTok(tokens[i]) || isPersonTok(tokens[i + 1]) || isPersonTok(tokens[i + 2])) continue;
      const w3 = `${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`;
      const syn = SHISHA_SYNONYMS[w3];
      if (syn && (catalog.tobacco || []).some(t => getItemName(t) === syn)) {
        usedIndices.add(i); usedIndices.add(i + 1); usedIndices.add(i + 2);
        const amt = extractAmountFollowing(i + 2);
        tobaccoMatchesWithAmounts.push({ firstIdx: i, name: syn, amount: amt });
        continue;
      }
      const m = findBestFuzzyMatch(w3, catalog.tobacco || [], 0.75);
      if (m) {
        usedIndices.add(i); usedIndices.add(i + 1); usedIndices.add(i + 2);
        const amt = extractAmountFollowing(i + 2);
        tobaccoMatchesWithAmounts.push({ firstIdx: i, name: m.name, amount: amt });
      }
    }

    for (let i = 0; i <= tokens.length - 2; i++) {
      if (usedIndices.has(i) || usedIndices.has(i + 1)) continue;
      if (isPersonTok(tokens[i]) || isPersonTok(tokens[i + 1])) continue;
      const w2 = `${tokens[i]} ${tokens[i + 1]}`;
      const syn = SHISHA_SYNONYMS[w2];
      if (syn && (catalog.tobacco || []).some(t => getItemName(t) === syn)) {
        usedIndices.add(i); usedIndices.add(i + 1);
        const amt = extractAmountFollowing(i + 1);
        tobaccoMatchesWithAmounts.push({ firstIdx: i, name: syn, amount: amt });
        continue;
      }
      const m = findBestFuzzyMatch(w2, catalog.tobacco || [], 0.75);
      if (m) {
        usedIndices.add(i); usedIndices.add(i + 1);
        const amt = extractAmountFollowing(i + 1);
        tobaccoMatchesWithAmounts.push({ firstIdx: i, name: m.name, amount: amt });
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
        usedIndices.add(i);
        const amt = extractAmountFollowing(i);
        if (!tobaccoMatchesWithAmounts.some(t => t.name === syn)) {
          tobaccoMatchesWithAmounts.push({ firstIdx: i, name: syn, amount: amt });
        }
        continue;
      }
      const m = findBestFuzzyMatch(tok, catalog.tobacco || [], 0.70);
      if (m && !tobaccoMatchesWithAmounts.some(t => t.name === m.name)) {
        usedIndices.add(i);
        const amt = extractAmountFollowing(i);
        tobaccoMatchesWithAmounts.push({ firstIdx: i, name: m.name, amount: amt });
      }
    }

    // Sort tobaccos by position in text
    tobaccoMatchesWithAmounts.sort((a, b) => a.firstIdx - b.firstIdx);

    const matchedTobaccos = tobaccoMatchesWithAmounts.map(t => t.name);
    const matchedAmounts = tobaccoMatchesWithAmounts.map(t => t.amount || '');
    const hasAmounts = matchedAmounts.some(a => a && a.trim() !== '');

    newPersons.push({
      name: matchedName,
      pipe,
      bowl,
      hmd,
      vessel,
      vesselColor: '',
      tobaccos: matchedTobaccos.length > 0 ? [...matchedTobaccos, ''] : [''],
      showTobaccoAmounts: hasAmounts,
      tobaccoAmounts: hasAmounts ? [...matchedAmounts, ''] : [],
      tobaccoUnit: detectedUnit || 'g',
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

  // Hamburger Menu Profile Manager Button
  const btnHamburgerOpenProfiles = document.getElementById('btn-hamburger-open-profiles');
  if (btnHamburgerOpenProfiles) {
    btnHamburgerOpenProfiles.addEventListener('click', () => {
      if (hamburgerDropdownMenu) hamburgerDropdownMenu.classList.add('hidden');
      openStreamerProfilesModal();
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
    showView('view-landing');
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

      // Auto start / sync head session and timer
      if (typeof checkAndAutoStartHeadSession === 'function') {
        checkAndAutoStartHeadSession(true);
      }

      // Publish confirmed setup to OBS Overlay Server & Cloud
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

  const btnSyncCloudDb = document.getElementById('btn-sync-cloud-db') || document.getElementById('btn-sync-github-db');
  if (btnSyncCloudDb) {
    btnSyncCloudDb.addEventListener('click', async () => {
      btnSyncCloudDb.disabled = true;
      btnSyncCloudDb.textContent = '🔄 Abgleich läuft...';
      const res = await ipcRenderer.invoke('db:sync-cloud');
      btnSyncCloudDb.disabled = false;
      btnSyncCloudDb.textContent = '🔄 Sync (HookahTools + Cloud)';
      if (res && res.success) {
        if (res.catalog) state.catalog = res.catalog;
        updateDatalists();
        renderCatalogList();
        const tobaccoMsg = res.hookahTobaccoCount ? `${res.hookahTobaccoCount} Tabaksorten von HookahTools` : 'Tabak';
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
    const isCustomTobacco = catKey === 'tobacco' && (typeof item === 'object' ? (item.source === 'custom' || item.isCustom) : true);
    const isHookahToolsTobacco = catKey === 'tobacco' && (typeof item === 'object' && item.source === 'hookahtools');

    let displayHtml = `<span>${escapeHtml(itemName)}${isElectricItem ? ' <span class="char-badge" style="color:var(--accent-cyan); margin-left:6px;">⚡ Elektro</span>' : ''}</span>`;
    
    if (catKey === 'tobacco') {
      if (isCustomTobacco) {
        displayHtml = `<span>${escapeHtml(itemName)} <span class="badge-source-custom" title="Eigene Custom-Sorte (bearbeitbar & löschbar)">🟢 Custom</span></span>`;
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

    const itemClass = (catKey === 'tobacco' && isCustomTobacco) ? 'catalog-item item-source-custom catalog-item-fade' : 'catalog-item catalog-item-fade';

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
            <label class="toggle-switch checkbox-label" title="Als Elektro-Gerät kennzeichnen"><input type="checkbox" id="inline-elec-${idx}" ${oldIsElec ? 'checked' : ''}><span class="toggle-slider"></span><span class="toggle-text">⚡ Elektro</span></label>
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
      const label = inputCustomCmdLabel ? inputCustomCmdLabel.value.trim() : '';
      const command = inputCustomCmdText ? inputCustomCmdText.value.trim() : '';

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
      if (qaCustomCmdModal) qaCustomCmdModal.classList.add('hidden');
      showToast(`Quick-Command '${label}' hinzugefügt!`, 'success');
    });
  }

  // Initialize YouTube Video Finder
  setupYouTubeVideoFinder();
}

// =========================================================================
// SHISHAWG YOUTUBE VIDEO-FINDER & QUICK-SHARE
// =========================================================================

const qaYtSearchInput = document.getElementById('qa-yt-search-input');
const btnQaClearYtSearch = document.getElementById('btn-qa-clear-yt-search');
const qaYtPinnedGrid = document.getElementById('qa-yt-pinned-grid');
const qaYtSuggestionsList = document.getElementById('qa-yt-suggestions-list');
const btnQaAddCustomVideo = document.getElementById('btn-qa-add-custom-video');
const qaCustomYtModal = document.getElementById('qa-custom-yt-modal');
const btnCloseQaYtModal = document.getElementById('btn-close-qa-yt-modal');
const btnCancelCustomYt = document.getElementById('btn-cancel-custom-yt');
const btnSaveCustomYt = document.getElementById('btn-save-custom-yt');
const inputCustomYtUrl = document.getElementById('input-custom-yt-url');
const inputCustomYtTitle = document.getElementById('input-custom-yt-title');
const inputCustomYtCategory = document.getElementById('input-custom-yt-category');

const DEFAULT_SHISHAWG_VIDEOS = [
  {
    id: 'yt-phunnel-guide',
    title: 'Der ultimative Phunnel Kopfbau Guide (Schritt für Schritt)',
    url: 'https://www.youtube.com/@shishawg',
    category: 'Kopfbau',
    desc: 'Perfekter Durchzug & Hitzeverteilung im Phunnel-Kopf. Tabak locker flockig verteilen & Alufolie / HMD.',
    pinned: true,
    isDefault: true
  },
  {
    id: 'yt-hmd-guide',
    title: 'HMD Guide: AO 912 vs ONMO vs Na Grani im Hitzetest',
    url: 'https://www.youtube.com/@shishawg',
    category: 'HMD',
    desc: 'Welcher HMD passt zu welchem Setup? Hitzeentwicklung, Aluguss vs. Edelstahl und Kohleverbrauch.',
    pinned: true,
    isDefault: true
  },
  {
    id: 'yt-kohle-guide',
    title: 'Kohle richtig anmachen & Hitze managen (Magic Charcoal)',
    url: 'https://www.youtube.com/@shishawg',
    category: 'Kohle',
    desc: 'Tipps zum schnellen & gleichmäßigen Durchglühen der Naturkohlen ohne Aschebildung oder Eigengeschmack.',
    pinned: true,
    isDefault: true
  },
  {
    id: 'yt-darkblend-tipps',
    title: 'Darkblend für Einsteiger: MustH & Blackburn rauchen ohne Kratzen',
    url: 'https://www.youtube.com/@shishawg',
    category: 'Tabak',
    desc: 'Bauweise, Hitzetoleranz und Tipps für starken Grundtabak. So schmeckt Darkblend intensiv & smooth.',
    pinned: true,
    isDefault: true
  },
  {
    id: 'yt-mehrloch-guide',
    title: 'Mehrlochkopf / Traditional Bowl richtig bauen & rauchen',
    url: 'https://www.youtube.com/@shishawg',
    category: 'Kopfbau',
    desc: 'Fluffig oder leicht angedrückt? Alles über Durchzug, Alufolie vs. Kamin und HMD auf Mehrlochköpfen.',
    pinned: false,
    isDefault: true
  },
  {
    id: 'yt-reinigung-guide',
    title: 'Shisha, Bowl & Schläuche richtig reinigen',
    url: 'https://www.youtube.com/@shishawg',
    category: 'Pflege',
    desc: 'Schmand und Ablagerungen sauber entfernen – für dauerhaft frischen Durchzug & puren Geschmack.',
    pinned: false,
    isDefault: true
  },
  {
    id: 'yt-fehler-guide',
    title: 'Die 5 häufigsten Fehler beim Shisha Kopfbau & wie man sie vermeidet',
    url: 'https://www.youtube.com/@shishawg',
    category: 'Tutorial',
    desc: 'Warum der Kopf kratzt, anbrennt oder zu wenig Rauch liefert – Fehleranalyse & Soforthilfe.',
    pinned: false,
    isDefault: true
  }
];

let youtubeVideos = [];

function extractYouTubeVideoId(url) {
  if (!url) return '';
  const clean = url.trim();
  const match = clean.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|(?:embed|v|shorts)\/))([\w-]{11})/i);
  if (match) return match[1];
  if (/^[\w-]{11}$/.test(clean)) return clean;
  return '';
}

function loadYouTubeVideos() {
  try {
    const saved = localStorage.getItem('swg_youtube_videos');
    if (saved) {
      youtubeVideos = JSON.parse(saved);
    } else {
      youtubeVideos = [...DEFAULT_SHISHAWG_VIDEOS];
    }
  } catch(e) {
    youtubeVideos = [...DEFAULT_SHISHAWG_VIDEOS];
  }
  renderYouTubeBoard();
}

let ytSearchDebounce = null;
let lastLiveQuery = '';
let liveSearchResults = [];

function renderYouTubeBoard(isLiveSearch = false) {
  if (!qaYtPinnedGrid) return;

  const rawQuery = (qaYtSearchInput ? qaYtSearchInput.value : '');
  const searchQuery = rawQuery.toLowerCase().trim();

  // 1. Render Pinned Videos Bar
  qaYtPinnedGrid.innerHTML = '';
  const pinnedVideos = youtubeVideos.filter(v => v.pinned);
  if (pinnedVideos.length === 0) {
    qaYtPinnedGrid.innerHTML = '<span style="font-size:0.75rem; color:var(--text-muted);">Keine Favoriten angeheftet. Klicke in der Suche bei einem Video auf "📌".</span>';
  } else {
    pinnedVideos.forEach(v => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-yt-pinned';
      btn.title = `Klicken zum Posten im Chat:\n"${v.title}"\n(${v.url})`;
      btn.innerHTML = `💬 ${escapeHtml(v.title.length > 34 ? v.title.substring(0, 34) + '...' : v.title)}`;
      btn.addEventListener('click', () => postYouTubeVideoToChat(v));
      qaYtPinnedGrid.appendChild(btn);
    });
  }

  // 2. Suggestions List
  if (!qaYtSuggestionsList) return;

  if (!searchQuery) {
    qaYtSuggestionsList.classList.add('hidden');
    qaYtSuggestionsList.innerHTML = '';
    liveSearchResults = [];
    lastLiveQuery = '';
    return;
  }

  // Combine local videos and live results (deduplicating by videoId / URL)
  const localFiltered = youtubeVideos.filter(v => {
    const titleMatch = (v.title || '').toLowerCase().includes(searchQuery);
    const catMatch = (v.category || '').toLowerCase().includes(searchQuery);
    const descMatch = (v.desc || '').toLowerCase().includes(searchQuery);
    return titleMatch || catMatch || descMatch;
  });

  const combined = [...localFiltered];
  const seenUrls = new Set(localFiltered.map(v => v.url.toLowerCase()));

  liveSearchResults.forEach(liveVid => {
    if (!seenUrls.has(liveVid.url.toLowerCase())) {
      seenUrls.add(liveVid.url.toLowerCase());
      combined.push(liveVid);
    }
  });

  qaYtSuggestionsList.innerHTML = '';
  qaYtSuggestionsList.classList.remove('hidden');

  if (combined.length === 0) {
    if (!isLiveSearch) {
      qaYtSuggestionsList.innerHTML = `
        <div style="text-align:center; padding: 14px; color: var(--text-muted); font-size: 0.85rem;">
          ⏳ Suche auf ShishaWG YouTube-Kanal nach "<strong>${escapeHtml(searchQuery)}</strong>"...
        </div>
      `;
    } else {
      qaYtSuggestionsList.innerHTML = `
        <div style="text-align:center; padding: 16px; color: var(--text-muted); font-size: 0.85rem;">
          🔍 Kein YouTube-Video zu "<strong>${escapeHtml(searchQuery)}</strong>" gefunden.
          <br><button id="btn-qa-yt-add-from-search" class="btn btn-secondary btn-sm" style="margin-top:8px;">➕ Video-Link manuell hinzufügen</button>
        </div>
      `;
      const btnAddSearch = document.getElementById('btn-qa-yt-add-from-search');
      if (btnAddSearch) {
        btnAddSearch.addEventListener('click', () => {
          if (qaCustomYtModal) qaCustomYtModal.classList.remove('hidden');
          if (inputCustomYtTitle) inputCustomYtTitle.value = rawQuery;
          if (inputCustomYtCategory) inputCustomYtCategory.value = 'Tutorial';
        });
      }
    }
    return;
  }

  // Multi-Channel Tag Color resolver (Red for 1st / ShishaWG, Blue for 2nd / Marvocado, Purple for 3rd, Green for 4th, Amber for 5th)
  function getYtChannelTagStyle(catOrChannel) {
    const defaultRed = 'background: linear-gradient(135deg, rgba(239, 68, 68, 0.25), rgba(220, 38, 38, 0.35)); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.4);';
    if (!catOrChannel) return defaultRed;
    const name = catOrChannel.toLowerCase().replace('@', '').trim();
    const prof = getActiveStreamerProfile();
    const channels = (prof && Array.isArray(prof.youtubeChannels)) ? prof.youtubeChannels.map(c => c.toLowerCase().replace('@', '').trim()) : [];

    let idx = channels.findIndex(c => name.includes(c) || c.includes(name));
    if (idx === -1) {
      if (name.includes('shisha') || name.includes('marvin')) idx = 0;
      else if (name.includes('marvocado') || name.includes('vlog') || name.includes('food')) idx = 1;
      else idx = 2;
    }

    const colorStyles = [
      'background: linear-gradient(135deg, rgba(239, 68, 68, 0.25), rgba(220, 38, 38, 0.35)); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.4);', // 1: Red (ShishaWG)
      'background: linear-gradient(135deg, rgba(59, 130, 246, 0.25), rgba(37, 99, 235, 0.35)); color: #93c5fd; border: 1px solid rgba(59, 130, 246, 0.4);', // 2: Blue (Marvocado)
      'background: linear-gradient(135deg, rgba(168, 85, 247, 0.25), rgba(124, 58, 237, 0.35)); color: #d8b4fe; border: 1px solid rgba(168, 85, 247, 0.4);', // 3: Purple
      'background: linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(5, 150, 105, 0.35)); color: #6ee7b7; border: 1px solid rgba(16, 185, 129, 0.4);', // 4: Emerald
      'background: linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(217, 119, 6, 0.35)); color: #fcd34d; border: 1px solid rgba(245, 158, 11, 0.4);'   // 5: Amber
    ];

    return colorStyles[idx % colorStyles.length];
  }

  combined.forEach(video => {
    const item = document.createElement('div');
    item.className = 'qa-yt-suggestion-item';

    const videoId = video.videoId || extractYouTubeVideoId(video.url);
    const thumbUrl = video.thumb || (videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : '');
    const isPinned = youtubeVideos.some(v => v.url === video.url && v.pinned);
    const tagText = video.category || (video.channel || 'ShishaWG');
    const tagStyle = getYtChannelTagStyle(tagText);

    item.innerHTML = `
      <div class="qa-yt-sugg-left">
        ${thumbUrl ? `<img src="${escapeHtml(thumbUrl)}" class="qa-yt-thumb-mini" alt="Thumb" onerror="this.style.display='none'">` : '<div class="qa-yt-icon-badge">▶</div>'}
        <div class="qa-yt-sugg-content">
          <div class="qa-yt-sugg-title-row">
            <span class="qa-yt-category-tag" style="${tagStyle}">${escapeHtml(tagText)}</span>
            <span class="qa-yt-sugg-title" title="${escapeHtml(video.title)}">${escapeHtml(video.title)}</span>
          </div>
          <div class="qa-yt-sugg-desc" title="${escapeHtml(video.desc || video.url)}">${escapeHtml(video.desc || video.url)}</div>
        </div>
      </div>
      <div class="qa-yt-sugg-actions">
        <button class="btn-yt-share" title="Diesen Video-Link direkt im Twitch-Chat posten">
          💬 In Chat
        </button>
        <button class="btn-icon btn-yt-pin-toggle ${isPinned ? 'pinned' : ''}" title="${isPinned ? 'Von Favoriten lösen' : 'Oben als Favorit anheften'}">
          ${isPinned ? '📌' : '☆'}
        </button>
        <button class="btn-icon btn-yt-copy" title="Link kopieren" style="padding:6px 8px; font-size:0.8rem; background:rgba(255,255,255,0.06); border-radius:6px;">
          📋
        </button>
        <button class="btn-icon btn-yt-open" title="Auf YouTube ansehen" style="padding:6px 8px; font-size:0.8rem; background:rgba(255,255,255,0.06); border-radius:6px;">
          🔗
        </button>
        ${!video.isDefault && !video.isLiveResult ? `
          <button class="btn-icon btn-yt-delete" title="Video löschen" style="padding:6px 8px; font-size:0.8rem; color:#ef4444; background:rgba(239,68,68,0.1); border-radius:6px;">
            ✕
          </button>
        ` : ''}
      </div>
    `;

    // Share button listener
    const btnShare = item.querySelector('.btn-yt-share');
    if (btnShare) {
      btnShare.addEventListener('click', () => postYouTubeVideoToChat(video));
    }

    // Pin toggle listener
    const btnPin = item.querySelector('.btn-yt-pin-toggle');
    if (btnPin) {
      btnPin.addEventListener('click', () => {
        let existing = youtubeVideos.find(v => v.url === video.url);
        if (existing) {
          existing.pinned = !existing.pinned;
        } else {
          youtubeVideos.push({
            id: 'yt-' + (video.videoId || Date.now()),
            title: video.title,
            url: video.url,
            videoId: video.videoId || '',
            category: video.category || 'ShishaWG',
            desc: video.desc || '',
            pinned: true,
            isDefault: false
          });
        }
        saveYouTubeVideos();
        renderYouTubeBoard(true);
        showToast('Favorit aktualisiert', 'info');
      });
    }

    // Copy link listener
    const btnCopy = item.querySelector('.btn-yt-copy');
    if (btnCopy) {
      btnCopy.addEventListener('click', () => {
        navigator.clipboard.writeText(video.url);
        showToast('Video-Link in Zwischenablage kopiert!', 'info');
      });
    }

    // Open link listener
    const btnOpen = item.querySelector('.btn-yt-open');
    if (btnOpen) {
      btnOpen.addEventListener('click', () => {
        ipcRenderer.invoke('app:open-external', video.url);
      });
    }

    // Delete custom video
    const btnDel = item.querySelector('.btn-yt-delete');
    if (btnDel) {
      btnDel.addEventListener('click', () => {
        youtubeVideos = youtubeVideos.filter(v => v.id !== video.id && v.url !== video.url);
        saveYouTubeVideos();
        renderYouTubeBoard(true);
        showToast('Video gelöscht', 'info');
      });
    }

    qaYtSuggestionsList.appendChild(item);
  });
}

async function postYouTubeVideoToChat(video) {
  if (!video || !video.url) return;
  try {
    const activeProf = getActiveStreamerProfile();
    const channel = (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || activeProf.targetChannel || 'marved';
    const streamerName = (activeProf.name || 'Streamer').split(' ')[0] || 'Streamer';
    const message = `🎥 Video-Tipp von ${streamerName}: "${video.title}" 👉 ${video.url}`;
    const res = await ipcRenderer.invoke('twitch:send-chat', { message, channel });
    if (res && res.success) {
      showToast(`Video im Chat gepostet: ${video.title}`, 'success');
    } else {
      showToast(res.error || 'Fehler beim Senden', 'error');
    }
  } catch(err) {
    showToast(err.message || 'Fehler beim Senden in Chat', 'error');
  }
}

function setupYouTubeVideoFinder() {
  loadYouTubeVideos();

  // Live Search input listener with Debounce & YouTube Live API
  if (qaYtSearchInput) {
    qaYtSearchInput.addEventListener('input', () => {
      const q = qaYtSearchInput.value.trim();
      if (btnQaClearYtSearch) {
        btnQaClearYtSearch.classList.toggle('hidden', !q);
      }

      renderYouTubeBoard(false);

      if (ytSearchDebounce) clearTimeout(ytSearchDebounce);
      if (q.length >= 2) {
        ytSearchDebounce = setTimeout(async () => {
          try {
            const activeProf = getActiveStreamerProfile();
            const channels = (activeProf && Array.isArray(activeProf.youtubeChannels) && activeProf.youtubeChannels.length > 0)
              ? activeProf.youtubeChannels
              : ['@shishawg', '@marvocado'];
            const liveRes = await ipcRenderer.invoke('youtube:search', { query: q, channels });
            if (Array.isArray(liveRes) && qaYtSearchInput.value.trim() === q) {
              liveSearchResults = liveRes;
              lastLiveQuery = q;
              renderYouTubeBoard(true);
            }
          } catch(err) {
            console.error('YouTube live search error:', err);
          }
        }, 250);
      }
    });

    qaYtSearchInput.addEventListener('focus', () => {
      if (qaYtSearchInput.value.trim()) {
        renderYouTubeBoard(true);
      }
    });
  }

  // Close suggestions on click outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.qa-yt-search-wrapper')) {
      if (qaYtSuggestionsList) {
        qaYtSuggestionsList.classList.add('hidden');
      }
    }
  });

  // Clear search button
  if (btnQaClearYtSearch) {
    btnQaClearYtSearch.addEventListener('click', () => {
      if (qaYtSearchInput) qaYtSearchInput.value = '';
      btnQaClearYtSearch.classList.add('hidden');
      renderYouTubeBoard(false);
      if (qaYtSearchInput) qaYtSearchInput.focus();
    });
  }

  // Open custom video modal
  if (btnQaAddCustomVideo && qaCustomYtModal) {
    btnQaAddCustomVideo.addEventListener('click', () => {
      qaCustomYtModal.classList.remove('hidden');
      if (inputCustomYtUrl) inputCustomYtUrl.value = '';
      if (inputCustomYtTitle) inputCustomYtTitle.value = '';
      if (inputCustomYtCategory) inputCustomYtCategory.value = '';
      if (inputCustomYtUrl) inputCustomYtUrl.focus();
    });
  }

  if (btnCloseQaYtModal && qaCustomYtModal) {
    btnCloseQaYtModal.addEventListener('click', () => {
      qaCustomYtModal.classList.add('hidden');
    });
  }

  if (btnCancelCustomYt && qaCustomYtModal) {
    btnCancelCustomYt.addEventListener('click', () => {
      qaCustomYtModal.classList.add('hidden');
    });
  }

  // Save custom video
  if (btnSaveCustomYt) {
    btnSaveCustomYt.addEventListener('click', () => {
      const url = inputCustomYtUrl ? inputCustomYtUrl.value.trim() : '';
      const title = inputCustomYtTitle ? inputCustomYtTitle.value.trim() : '';
      const category = inputCustomYtCategory ? inputCustomYtCategory.value.trim() : 'Video';

      if (!url || !title) {
        showToast('Bitte gib mindestens einen YouTube-Link und Titel ein.', 'error');
        return;
      }

      const videoId = extractYouTubeVideoId(url);
      const newVideo = {
        id: 'yt-' + Date.now(),
        title: title,
        url: url,
        videoId: videoId || 'custom',
        category: category || 'Video',
        desc: `YouTube Video: ${title}`,
        pinned: true,
        isDefault: false
      };

      youtubeVideos.unshift(newVideo);
      saveYouTubeVideos();
      renderYouTubeBoard();
      if (qaCustomYtModal) qaCustomYtModal.classList.add('hidden');
      showToast(`Video "${title}" erfolgreich hinzugefügt!`, 'success');
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

const modAvatarCache = new Map();

function getInitialsAvatarSvg(name, color = '#7c3aed') {
  const clean = (name || 'Mod').replace(/^@/, '').trim();
  const letter = clean.charAt(0).toUpperCase() || 'M';
  const bg = color || '#7c3aed';
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="${encodeURIComponent(bg)}"/><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif" font-size="28" font-weight="800" fill="%23ffffff">${encodeURIComponent(letter)}</text></svg>`;
}

function getActiveModInfo() {
  const customColor = localStorage.getItem('swg_user_color') || (state.twitchUser && state.twitchUser.color ? state.twitchUser.color : '#00f0ff');
  const customModName = localStorage.getItem('swg_custom_mod_name');
  const senderName = customModName || (state.twitchUser ? (state.twitchUser.display_name || state.twitchUser.login) : 'Mod');
  const senderAvatar = (state.twitchUser && state.twitchUser.profile_image_url)
    ? state.twitchUser.profile_image_url
    : getInitialsAvatarSvg(senderName, customColor);

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
  globalModChatInterval = setInterval(checkModChatUpdates, 4000);
}

async function checkModChatUpdates() {
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
}

function updateModHQUserInfo() {
  const modInfo = getActiveModInfo();
  if (chatLoggedName) {
    chatLoggedName.textContent = modInfo.name;
    chatLoggedName.style.color = modInfo.color;
  }
  const chatLoggedAvatar = document.getElementById('chat-logged-avatar');
  if (chatLoggedAvatar) {
    const fallbackSvg = getInitialsAvatarSvg(modInfo.name, modInfo.color);
    chatLoggedAvatar.onerror = function() {
      this.onerror = null;
      this.src = fallbackSvg;
    };
    chatLoggedAvatar.src = modInfo.avatar || fallbackSvg;
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
  const sig = messages.map(m => `${m.id}-${m.timestamp}-${m.senderName}-${m.text}`).join('|');
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
    const cleanSender = (msg.senderName || 'Mod').toLowerCase().trim();
    const fallbackSvg = getInitialsAvatarSvg(msg.senderName, senderColor);

    let avatarSrc = msg.senderAvatar;
    if (!avatarSrc || avatarSrc.includes('user-default-pictures')) {
      if (isOwn && currentMod.avatar && !currentMod.avatar.startsWith('data:image/svg')) {
        avatarSrc = currentMod.avatar;
      } else if (modAvatarCache.has(cleanSender)) {
        avatarSrc = modAvatarCache.get(cleanSender);
      } else {
        avatarSrc = fallbackSvg;
        if (cleanSender && cleanSender !== 'mod') {
          ipcRenderer.invoke('twitch:get-user-info', cleanSender).then(res => {
            const url = res?.user?.profile_image_url || res?.profile_image_url;
            if (url) {
              modAvatarCache.set(cleanSender, url);
              const els = modChatMessages.querySelectorAll(`img.chat-msg-avatar[data-sender="${cleanSender}"]`);
              els.forEach(el => { el.src = url; });
            }
          }).catch(() => {});
        }
      }
    }

    html += `
      <div class="mod-chat-msg-row ${isOwn ? 'outgoing' : 'incoming'}">
        <img src="${escapeHtml(avatarSrc)}" data-sender="${escapeHtml(cleanSender)}" alt="${escapeHtml(msg.senderName)}" class="chat-msg-avatar" onerror="this.onerror=null; this.src='${escapeHtml(fallbackSvg)}';">
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
      <span>${escapeHtml(p.displayName || p.login)}</span>
      ${p.isSub ? '⭐' : ''}
      <button class="btn-remove-participant" data-login="${escapeHtml(p.login)}" title="${escapeHtml(p.displayName || p.login)} aus dem Pool entfernen">✕</button>
    </span>
  `).join('');

  // Attach remove button listeners
  giveawayParticipantsGrid.querySelectorAll('.btn-remove-participant').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const login = btn.getAttribute('data-login');
      if (login && giveawayState.participants.has(login.toLowerCase())) {
        const removed = giveawayState.participants.get(login.toLowerCase());
        giveawayState.participants.delete(login.toLowerCase());
        renderParticipantsPool();
        showToast(`👤 ${removed ? removed.displayName : login} aus dem Pool entfernt`, 'info');
      }
    });
  });
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
        const link = `${claimBaseUrl}${sep}id=${winnerObj.id}&user=${encodeURIComponent(winnerObj.username)}&prize=${encodeURIComponent(winnerObj.prize)}&v=${Date.now()}`;
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
  try {
    const res = await ipcRenderer.invoke('giveaway:get-winners');
    if (res && res.success && Array.isArray(res.winners)) {
      giveawayState.winnersHistory = res.winners;
      renderWinnersHistory(res.winners);

      // Auto-update the active winner form if an address was submitted
      if (giveawayState.currentWinner) {
        const updated = res.winners.find(w => w.id === giveawayState.currentWinner.id || (w.username && w.username.toLowerCase() === giveawayState.currentWinner.username.toLowerCase()));
        if (updated) {
          const hadNoAddress = !giveawayState.currentWinner.address || !giveawayState.currentWinner.address.street;
          const nowHasAddress = updated.address && updated.address.street;
          
          giveawayState.currentWinner = updated;
          renderAddressReview(updated);

          if (hadNoAddress && nowHasAddress) {
            playNotificationSound();
            showToast(`📥 Lieferadresse für @${updated.displayName || updated.username} eingegangen!`, 'success');
          }
        }
      }
    }
  } catch(e) {}
}

let currentGiveawayTabFilter = 'all';

function renderWinnersHistory(winners) {
  if (!winnersHistoryTbody) return;
  const list = winners || [];

  const isCpCheck = (w) => w.type === 'channel_points' || w.prize?.toLowerCase().includes('kohle') || w.prize?.toLowerCase().includes('zauber') || w.prize?.toLowerCase().includes('punkte');

  // Update Counters
  const countAll = list.length;
  const countGw = list.filter(w => !isCpCheck(w)).length;
  const countCp = list.filter(w => isCpCheck(w)).length;

  const elCountAll = document.getElementById('count-gw-all');
  const elCountGw = document.getElementById('count-gw-giveaway');
  const elCountCp = document.getElementById('count-gw-channelpoints');
  if (elCountAll) elCountAll.textContent = countAll;
  if (elCountGw) elCountGw.textContent = countGw;
  if (elCountCp) elCountCp.textContent = countCp;

  // Filter list
  let filtered = list;
  if (currentGiveawayTabFilter === 'giveaway') {
    filtered = list.filter(w => !isCpCheck(w));
  } else if (currentGiveawayTabFilter === 'channel_points') {
    filtered = list.filter(w => isCpCheck(w));
  }

  if (filtered.length === 0) {
    winnersHistoryTbody.innerHTML = '<tr><td colspan="7" class="empty-list-placeholder">Keine Einträge für diesen Filter.</td></tr>';
    return;
  }

  let html = '';
  filtered.forEach(w => {
    const timeStr = w.timestamp ? new Date(w.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    const dateStr = w.timestamp ? new Date(w.timestamp).toLocaleDateString([], { day: '2-digit', month: '2-digit' }) : '';
    const addr = w.address || {};
    const addrPreview = addr.street ? `${addr.street}, ${addr.zip} ${addr.city}` : '—';
    const recipient = addr.fullName || '—';
    const isChannelPoints = isCpCheck(w);

    let statusHtml = '<span class="address-status-pill waiting">Wartend</span>';
    if (w.status === 'sent_to_telegram') statusHtml = '<span class="address-status-pill sent">✅ Telegram</span>';
    if (w.status === 'address_received' || w.status === 'address_submitted') statusHtml = '<span class="address-status-pill received">📥 Prüfen</span>';
    if (w.status === 'shipped') statusHtml = '<span class="address-status-pill shipped">📦 Verschickt</span>';

    const typeBadge = isChannelPoints
      ? '<span style="display:inline-block; font-size:0.65rem; font-weight:800; padding:2px 6px; border-radius:4px; background:rgba(124,58,237,0.25); color:#c4b5fd; border:1px solid rgba(124,58,237,0.4); margin-right:4px;">⬛ 1KG KOHLE</span>'
      : '<span style="display:inline-block; font-size:0.65rem; font-weight:800; padding:2px 6px; border-radius:4px; background:rgba(16,185,129,0.25); color:#6ee7b7; border:1px solid rgba(16,185,129,0.4); margin-right:4px;">🎁 GIVEAWAY</span>';

    html += `
      <tr data-id="${w.id}">
        <td><span style="color:var(--text-secondary); font-size:0.75rem;">${dateStr} ${timeStr}</span></td>
        <td><strong style="color:var(--accent-cyan)">@${escapeHtml(w.username || w.user_name || w.user_login)}</strong></td>
        <td>
          <div style="display:flex; align-items:center; flex-wrap:wrap; gap:2px;">
            ${typeBadge}
            <span style="font-size:0.78rem; font-weight:600;">${escapeHtml(w.prize || '1KG Zauberwürfel FREE!')}</span>
          </div>
        </td>
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
        showToast(`Eintrag @${found.username || found.user_name} in Adressmaske geladen.`, 'info');
      }
    });
  });

  winnersHistoryTbody.querySelectorAll('.btn-delete-winner').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      giveawayState.winnersHistory = giveawayState.winnersHistory.filter(w => w.id !== id);
      renderWinnersHistory(giveawayState.winnersHistory);

      const res = await ipcRenderer.invoke('giveaway:delete-winner', id);
      if (res && res.success && Array.isArray(res.winners)) {
        giveawayState.winnersHistory = res.winners;
        renderWinnersHistory(res.winners);
      }
      showToast('Eintrag aus Historie gelöscht', 'info');
    });
  });
}

function getFormattedTelegramMessage(winner) {
  if (!winner) return '';
  const addr = winner.address || {};
  const dateStr = new Date(winner.timestamp || Date.now()).toLocaleString('de-DE');
  const isChannelPoints = winner.type === 'channel_points' || winner.prize?.toLowerCase().includes('kohle') || winner.prize?.toLowerCase().includes('zauber');
  const activeProf = getActiveStreamerProfile();
  const streamerName = activeProf ? activeProf.name : 'Marvin';

  if (isChannelPoints) {
    return `⬛ <b>KANALPUNKTE-PRÄMIE (1KG ZAUBERWÜRFEL)</b>\n` +
           `👤 <b>Twitch-User:</b> @${winner.username || winner.user_name || winner.user_login}\n` +
           `🎁 <b>Prämie:</b> ${winner.prize || '1KG Zauberwürfel FREE!'}\n` +
           `📦 <b>Empfänger:</b> ${addr.fullName || '—'}\n` +
           `🏠 <b>Adresse:</b> ${addr.street || '—'}, ${addr.zip || ''} ${addr.city || ''} (${addr.country || 'Deutschland'})\n` +
           `📅 <b>Datum:</b> ${dateStr}\n` +
           `✅ <b>Status:</b> Lieferadresse von Mod-Team geprüft & freigegeben`;
  }

  return `🎁 <b>NEUER GEWINNER - ${escapeHtml(streamerName)} Giveaway</b>\n` +
         `🏆 <b>Twitch-User:</b> @${winner.username || winner.user_name || winner.user_login}\n` +
         `📦 <b>Gewinn:</b> ${winner.prize || 'Shisha Paket'}\n` +
         `👤 <b>Empfänger:</b> ${addr.fullName || '—'}\n` +
         `🏠 <b>Adresse:</b> ${addr.street || '—'}, ${addr.zip || ''} ${addr.city || ''} (${addr.country || 'Deutschland'})\n` +
         `📅 <b>Datum:</b> ${dateStr}\n` +
         `✅ <b>Status:</b> Adresse von Mod-Team geprüft & freigegeben`;
}

function setupGiveawaysListeners() {
  // Filter Pills for History
  const btnFilterAll = document.getElementById('btn-filter-gw-all');
  const btnFilterGw = document.getElementById('btn-filter-gw-giveaway');
  const btnFilterCp = document.getElementById('btn-filter-gw-channelpoints');

  const updateFilterPills = (tab) => {
    currentGiveawayTabFilter = tab;
    [btnFilterAll, btnFilterGw, btnFilterCp].forEach(btn => {
      if (btn) btn.classList.toggle('active', btn.getAttribute('data-filter') === tab);
    });
    renderWinnersHistory(giveawayState.winnersHistory);
  };

  if (btnFilterAll) btnFilterAll.addEventListener('click', () => updateFilterPills('all'));
  if (btnFilterGw) btnFilterGw.addEventListener('click', () => updateFilterPills('giveaway'));
  if (btnFilterCp) btnFilterCp.addEventListener('click', () => updateFilterPills('channel_points'));

  // Manual Reward Modal Listeners
  const btnOpenManual = document.getElementById('btn-open-manual-reward-modal');
  const modalManual = document.getElementById('modal-manual-reward');
  const btnCloseManual = document.getElementById('btn-close-manual-reward-modal');
  const btnCancelManual = document.getElementById('btn-cancel-manual-reward');
  const btnSubmitManual = document.getElementById('btn-create-manual-reward-submit');

  if (btnOpenManual && modalManual) {
    btnOpenManual.addEventListener('click', () => {
      modalManual.classList.remove('hidden');
      const inputUser = document.getElementById('input-manual-reward-user');
      if (inputUser) { inputUser.value = ''; inputUser.focus(); }
    });
  }

  if (btnCloseManual && modalManual) {
    btnCloseManual.addEventListener('click', () => modalManual.classList.add('hidden'));
  }
  if (btnCancelManual && modalManual) {
    btnCancelManual.addEventListener('click', () => modalManual.classList.add('hidden'));
  }

  if (btnSubmitManual && modalManual) {
    btnSubmitManual.addEventListener('click', async () => {
      const user = document.getElementById('input-manual-reward-user')?.value.trim();
      const prize = document.getElementById('input-manual-reward-prize')?.value.trim() || 'Shisha-Kohle (Kohle Stücke)';
      const postChat = document.getElementById('chk-manual-reward-post-chat')?.checked;

      if (!user) {
        showToast('Bitte gib einen Twitch-Usernamen ein.', 'error');
        return;
      }

      const chan = (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved';
      btnSubmitManual.disabled = true;
      btnSubmitManual.textContent = '⏳ Erstelle...';

      try {
        const res = await ipcRenderer.invoke('channelpoints:create-manual-link', {
          user,
          prize,
          channel: chan,
          postToChat: postChat
        });

        if (res && res.success) {
          modalManual.classList.add('hidden');
          // Copy link to clipboard
          navigator.clipboard.writeText(res.claimUrl);
          showToast(`✨ Adresslink für @${user} erstellt & kopiert! ${postChat ? '(Im Chat gepostet)' : ''}`, 'success');
          // Refresh list
          await pollWinnersUpdates();
        } else {
          showToast(res?.error || 'Fehler beim Erstellen des Links', 'error');
        }
      } catch(err) {
        showToast(err.message || 'Fehler', 'error');
      } finally {
        btnSubmitManual.disabled = false;
        btnSubmitManual.textContent = '✨ Link generieren';
      }
    });
  }
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

// =============================================================================
// MODULE 5: Q&A & UMFRAGEN LOGIC & CONTROLLER
// =============================================================================

let qnaSyncInterval = null;
let pollLiveCheckInterval = null;
let unreadQnACount = 0;

let qnaPersons = ['Marved', 'Hasty', 'Kai'];
let qnaWheelEnabled = true;
let bestrafungenList = [];

let qnaState = {
  questions: [],
  activeQuestion: null,
  currentFilter: 'pending',
  searchQuery: '',
  isListenerActive: true,
  settings: {
    cmdFrage: true,
    cmdQ: true,
    cmdQuestion: true,
    cooldown: 60,
    minLength: 5,
    autoDupe: true,
    soundAlert: true
  }
};

let pollsState = {
  activePoll: null,
  templates: []
};

let predictionsState = {
  activePrediction: null,
  templates: []
};

async function loadQnASettings() {
  try {
    const chan = (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved';
    const res = await ipcRenderer.invoke('qna:get-settings', chan);
    if (res && res.success && res.settings) {
      qnaPersons = Array.isArray(res.settings.persons) && res.settings.persons.length > 0 ? res.settings.persons : ['Marved', 'Hasty', 'Kai'];
      qnaWheelEnabled = res.settings.wheelEnabled !== false;
      const chkWheel = document.getElementById('chk-qna-wheel-enabled');
      if (chkWheel) chkWheel.checked = qnaWheelEnabled;
      renderPersonsPills();
    }
  } catch(e) {}
}

function renderPersonsPills() {
  const container = document.getElementById('qna-persons-pill-list');
  if (!container) return;
  container.innerHTML = qnaPersons.map((p, idx) => {
    const pLower = p.toLowerCase();
    const cls = (pLower === 'marved' || pLower === 'hasty' || pLower === 'kai') ? pLower : '';
    return `
      <span class="qna-person-pill ${cls}">
        ${escapeHtml(p)}
        <span class="btn-remove-pill" data-index="${idx}" title="${escapeHtml(p)} entfernen">✕</span>
      </span>
    `;
  }).join('');

  container.querySelectorAll('.btn-remove-pill').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const idx = parseInt(e.currentTarget.getAttribute('data-index'), 10);
      if (!isNaN(idx)) {
        qnaPersons.splice(idx, 1);
        if (qnaPersons.length === 0) qnaPersons = ['Marved'];
        await saveQnASettings();
        renderPersonsPills();
      }
    });
  });
}

async function saveQnASettings() {
  const chan = (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved';
  await ipcRenderer.invoke('qna:save-settings', chan, {
    persons: qnaPersons,
    activePerson: qnaPersons[0] || 'Marved',
    wheelEnabled: qnaWheelEnabled
  });
}

async function loadBestrafungen() {
  try {
    const res = await ipcRenderer.invoke('bestrafungen:get');
    if (res && res.success && Array.isArray(res.bestrafungen)) {
      bestrafungenList = res.bestrafungen;
      renderBestrafungen();
    }
  } catch(e) {}
}

function renderBestrafungen() {
  const container = document.getElementById('bestrafungen-list-container');
  const countBadge = document.getElementById('badge-bestrafungen-count');
  if (!container) return;

  const openCount = bestrafungenList.filter(b => b.status === 'offen').length;
  if (countBadge) countBadge.textContent = `${openCount} offen`;

  if (bestrafungenList.length === 0) {
    container.innerHTML = `<div class="bestrafungen-empty">Keine Bestrafungen angelegt.</div>`;
    return;
  }

  container.innerHTML = bestrafungenList.map(b => {
    const isErledigt = b.status === 'erledigt';
    const executedLabel = (isErledigt && b.executedBy) ? `<span style="font-size:0.75rem; color:#10b981; font-weight:700; margin-left:6px;">(von ${escapeHtml(b.executedBy)})</span>` : '';
    return `
      <div class="bestrafung-item ${isErledigt ? 'erledigt' : ''}">
        <span>${isErledigt ? '✔️ ' : '🔥 '} ${escapeHtml(b.name)}${executedLabel}</span>
        <div class="bestrafung-actions">
          <button class="btn-toggle-bestrafung" data-id="${b.id}" data-status="${isErledigt ? 'offen' : 'erledigt'}" title="${isErledigt ? 'Als offen markieren' : 'Als erledigt abhaken'}">
            ${isErledigt ? '↩️' : '✅'}
          </button>
          <button class="btn-delete-bestrafung" data-id="${b.id}" title="Löschen">🗑️</button>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.btn-toggle-bestrafung').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      const status = e.currentTarget.getAttribute('data-status');
      await ipcRenderer.invoke('bestrafungen:update-status', id, status);
      await loadBestrafungen();
    });
  });

  container.querySelectorAll('.btn-delete-bestrafung').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      await ipcRenderer.invoke('bestrafungen:delete', id);
      await loadBestrafungen();
    });
  });

  renderQnAQuickLeaderboard();
}

// Play subtle synthesized notification chime for incoming questions
function playQnANotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch(e) {}
}

function setupQnAListeners() {
  // Navigation & Action Buttons
  const btnToggleListener = document.getElementById('btn-toggle-qna-listener');
  const btnCopyObs = document.getElementById('btn-copy-qna-obs');
  const btnCopyPrompter = document.getElementById('btn-copy-qna-prompter');
  const btnOpenManual = document.getElementById('btn-open-manual-qna-modal');
  const btnOpenSettings = document.getElementById('btn-open-qna-settings-modal');
  const btnRefresh = document.getElementById('btn-refresh-qna');
  const btnClearAnswered = document.getElementById('btn-clear-answered-qna');

  // Search & Filter Tabs
  const inputSearch = document.getElementById('input-qna-search');
  const btnClearSearch = document.getElementById('btn-clear-qna-search');
  const tabBtns = document.querySelectorAll('.qna-tab-btn');

  // Manual Question Modal Elements
  const manualModal = document.getElementById('manual-qna-modal');
  const btnCloseManual = document.getElementById('btn-close-manual-qna-modal');
  const btnCancelManual = document.getElementById('btn-cancel-manual-qna');
  const btnSaveManual = document.getElementById('btn-save-manual-qna');
  const inputManualUser = document.getElementById('input-manual-qna-user');
  const inputManualText = document.getElementById('input-manual-qna-text');
  const selectManualStatus = document.getElementById('select-manual-qna-status');

  // Settings Modal Elements
  const settingsModal = document.getElementById('qna-settings-modal');
  const btnCloseSettings = document.getElementById('btn-close-qna-settings-modal');
  const btnCancelSettings = document.getElementById('btn-cancel-qna-settings');
  const btnSaveSettings = document.getElementById('btn-save-qna-settings');
  const chkCmdFrage = document.getElementById('chk-qna-cmd-frage');
  const chkCmdQ = document.getElementById('chk-qna-cmd-q');
  const chkCmdQuestion = document.getElementById('chk-qna-cmd-question');
  const inputCooldown = document.getElementById('input-qna-cooldown');
  const inputMinLength = document.getElementById('input-qna-min-length');
  const chkAutoDupe = document.getElementById('chk-qna-auto-dupe');
  const chkSoundAlert = document.getElementById('chk-qna-sound-alert');

  // Poll Creator Elements
  const inputPollTitle = document.getElementById('input-poll-title');
  const lblPollTitleCount = document.getElementById('lbl-poll-title-count');
  const pollChoicesContainer = document.getElementById('poll-choices-container');
  const btnAddChoice = document.getElementById('btn-add-poll-choice');
  const selectPollDuration = document.getElementById('select-poll-duration');
  const selectPollChannelPoints = document.getElementById('select-poll-channel-points');
  const btnStartPoll = document.getElementById('btn-start-twitch-poll');
  const btnSaveTemplate = document.getElementById('btn-save-custom-poll-template');

  // Q&A Options Dropdown Menu Toggle
  const btnQnaMenu = document.getElementById('btn-qna-menu');
  const qnaDropdownMenu = document.getElementById('qna-dropdown-menu');
  if (btnQnaMenu && qnaDropdownMenu) {
    btnQnaMenu.addEventListener('click', (e) => {
      e.stopPropagation();
      qnaDropdownMenu.classList.toggle('hidden');
    });
  }

  // Close Q&A dropdown on outside click
  document.addEventListener('click', () => {
    if (qnaDropdownMenu) qnaDropdownMenu.classList.add('hidden');
  });

  // Toggle Chat Listener Button (Disabled by default)
  qnaState.isListenerActive = false;
  if (btnToggleListener) {
    btnToggleListener.className = 'btn btn-sm btn-secondary';
    btnToggleListener.innerHTML = '<span class="status-dot red"></span> <span>Listener: Aus</span>';
    btnToggleListener.style.height = '32px';
    btnToggleListener.style.minWidth = '135px';
    btnToggleListener.style.display = 'inline-flex';
    btnToggleListener.style.alignItems = 'center';
    btnToggleListener.style.justifyContent = 'center';
    btnToggleListener.style.gap = '6px';

    btnToggleListener.addEventListener('click', async () => {
      qnaState.isListenerActive = !qnaState.isListenerActive;
      if (qnaState.isListenerActive) {
        const chan = (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved';
        await ipcRenderer.invoke('qna:start-listener', chan);
        btnToggleListener.className = 'btn btn-sm btn-primary';
        btnToggleListener.innerHTML = '<span class="status-dot green"></span> <span>Listener: Aktiv</span>';
        btnToggleListener.style.height = '32px';
        btnToggleListener.style.minWidth = '135px';
        showToast('Twitch Chat-Listener für !frage gestartet!', 'success');
      } else {
        await ipcRenderer.invoke('qna:stop-listener');
        btnToggleListener.className = 'btn btn-sm btn-secondary';
        btnToggleListener.innerHTML = '<span class="status-dot red"></span> <span>Listener: Aus</span>';
        btnToggleListener.style.height = '32px';
        btnToggleListener.style.minWidth = '135px';
        showToast('Twitch Chat-Listener ausgeschaltet.', 'info');
      }
    });
  }

  // Refresh Polls Button
  const btnRefreshPolls = document.getElementById('btn-refresh-polls');
  if (btnRefreshPolls) {
    btnRefreshPolls.addEventListener('click', async () => {
      showToast('Aktualisiere Umfragen...', 'info');
      await loadQnAState();
      showToast('Umfragen synchronisiert! 🔄', 'success');
    });
  }

  // Quick Leaderboard Details Button
  const btnOpenStatsCard = document.getElementById('btn-open-stats-from-card');
  if (btnOpenStatsCard) {
    btnOpenStatsCard.addEventListener('click', () => {
      renderQnAStatsModal();
      const statsM = document.getElementById('modal-qna-stats');
      if (statsM) statsM.classList.remove('hidden');
    });
  }

  // Copy OBS Overlay Link
  if (btnCopyObs) {
    btnCopyObs.addEventListener('click', () => {
      const chan = (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved';
      const obsUrl = `https://bazztee.github.io/shishawg-mod-setup-tool/qna.html?channel=${encodeURIComponent(chan)}&mode=overlay`;
      navigator.clipboard.writeText(obsUrl);
      if (qnaDropdownMenu) qnaDropdownMenu.classList.add('hidden');
      showToast('OBS-Overlay Link in die Zwischenablage kopiert! 📺', 'success');
    });
  }

  // Copy Prompter Link (Marvin Screen)
  if (btnCopyPrompter) {
    btnCopyPrompter.addEventListener('click', () => {
      const chan = (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved';
      const prompterUrl = `https://bazztee.github.io/shishawg-mod-setup-tool/qna.html?channel=${encodeURIComponent(chan)}&mode=screen`;
      navigator.clipboard.writeText(prompterUrl);
      if (qnaDropdownMenu) qnaDropdownMenu.classList.add('hidden');
      showToast('Prompter-Link für Marvins Monitor kopiert! 🖥️', 'success');
    });
  }

  // Clear Answered Questions
  if (btnClearAnswered) {
    btnClearAnswered.addEventListener('click', async () => {
      const answeredCount = qnaState.questions.filter(q => q.status === 'answered').length;
      if (answeredCount === 0) {
        showToast('Keine beantworteten Fragen zum Löschen vorhanden.', 'info');
        return;
      }
      const chan = (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved';
      qnaState.questions = qnaState.questions.filter(q => q.status !== 'answered');
      await ipcRenderer.invoke('qna:clear-answered-questions', chan);
      renderQnAQuestionsList();
      showToast(`${answeredCount} beantwortete Frage(n) gelöscht.`, 'success');
    });
  }

  // Add Person / Guest
  const inputNewPerson = document.getElementById('input-new-person-name');
  const btnAddPerson = document.getElementById('btn-add-qna-person');

  async function handleAddNewPerson() {
    if (!inputNewPerson) return;
    const name = inputNewPerson.value.trim();
    if (!name) return;
    if (!qnaPersons.includes(name)) {
      qnaPersons.push(name);
      await saveQnASettings();
      renderPersonsPills();
      showToast(`Person „${name}“ hinzugefügt! 👥`, 'success');
    }
    inputNewPerson.value = '';
  }

  if (btnAddPerson) {
    btnAddPerson.addEventListener('click', handleAddNewPerson);
  }
  if (inputNewPerson) {
    inputNewPerson.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddNewPerson();
      }
    });
  }

  // Wheel Toggle Checkbox
  const chkWheel = document.getElementById('chk-qna-wheel-enabled');
  if (chkWheel) {
    chkWheel.addEventListener('change', async (e) => {
      qnaWheelEnabled = !!e.target.checked;
      await saveQnASettings();
      showToast(`Bestrafungs-Glücksrad ${qnaWheelEnabled ? 'aktiviert 🎡' : 'deaktiviert ⏸️'}`, 'info');
    });
  }

  // Delete Duplicates Button
  const btnDeleteDuplicates = document.getElementById('btn-qna-delete-duplicates');
  if (btnDeleteDuplicates) {
    btnDeleteDuplicates.addEventListener('click', async () => {
      const res = await ipcRenderer.invoke('qna:delete-duplicates');
      if (res && res.success) {
        await loadQnAState();
        showToast(`${res.deletedCount || 0} doppelte Frage(n) bereinigt! 🧹`, 'success');
      }
    });
  }

  // Delete All Questions Button
  const btnDeleteAll = document.getElementById('btn-qna-delete-all');
  if (btnDeleteAll) {
    btnDeleteAll.addEventListener('click', async () => {
      if (confirm('Möchtest du wirklich ALLE Fragen in der Inbox unwiderruflich löschen?')) {
        const chan = (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved';
        qnaState.questions = [];
        qnaState.activeQuestion = null;
        await ipcRenderer.invoke('qna:delete-all-questions', chan);
        await ipcRenderer.invoke('qna:set-active', null, chan);
        renderQnASpotlight();
        renderQnAQuestionsList();
        showToast('Alle Fragen wurden gelöscht. 🗑️', 'info');
      }
    });
  }

  // Add Bestrafung Button & Enter Key
  const inputNewBestrafung = document.getElementById('input-new-bestrafung');
  const btnAddBestrafung = document.getElementById('btn-add-bestrafung');

  async function handleAddBestrafung() {
    if (!inputNewBestrafung) return;
    const text = inputNewBestrafung.value.trim();
    if (!text) return;
    await ipcRenderer.invoke('bestrafungen:save', {
      id: 'pen_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      name: text,
      status: 'offen',
      timestamp: Date.now()
    });
    inputNewBestrafung.value = '';
    await loadBestrafungen();
    showToast(`Bestrafung „${text}“ hinzugefügt! 🔥`, 'success');
  }

  if (btnAddBestrafung) {
    btnAddBestrafung.addEventListener('click', handleAddBestrafung);
  }
  if (inputNewBestrafung) {
    inputNewBestrafung.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleAddBestrafung();
    });
  }

  // Search Input
  if (inputSearch) {
    inputSearch.addEventListener('input', (e) => {
      qnaState.searchQuery = (e.target.value || '').trim().toLowerCase();
      if (btnClearSearch) {
        if (qnaState.searchQuery) {
          btnClearSearch.classList.remove('hidden');
        } else {
          btnClearSearch.classList.add('hidden');
        }
      }
      renderQnAQuestionsList();
    });
  }

  if (btnClearSearch && inputSearch) {
    btnClearSearch.addEventListener('click', () => {
      inputSearch.value = '';
      qnaState.searchQuery = '';
      btnClearSearch.classList.add('hidden');
      renderQnAQuestionsList();
    });
  }

  // Filter Tabs
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      qnaState.currentFilter = btn.getAttribute('data-filter') || 'pending';
      renderQnAQuestionsList();
    });
  });

  // Manual Question Modal Open / Close / Save
  if (btnOpenManual && manualModal) {
    btnOpenManual.addEventListener('click', () => {
      if (inputManualUser) inputManualUser.value = '';
      if (inputManualText) inputManualText.value = '';
      if (selectManualStatus) selectManualStatus.value = 'approved';
      manualModal.classList.remove('hidden');
      if (inputManualUser) inputManualUser.focus();
    });
  }

  if (btnCloseManual && manualModal) {
    btnCloseManual.addEventListener('click', () => manualModal.classList.add('hidden'));
  }
  if (btnCancelManual && manualModal) {
    btnCancelManual.addEventListener('click', () => manualModal.classList.add('hidden'));
  }

  if (btnSaveManual && manualModal) {
    btnSaveManual.addEventListener('click', async () => {
      const uName = (inputManualUser ? inputManualUser.value.trim() : '') || 'Zuschauer';
      const qText = inputManualText ? inputManualText.value.trim() : '';
      const status = selectManualStatus ? selectManualStatus.value : 'approved';

      if (!qText || qText.length < 3) {
        showToast('Bitte gib einen Fragetext ein (mind. 3 Zeichen).', 'error');
        return;
      }

      const chan = (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved';
      const newQ = {
        id: 'q_manual_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        login: uName.toLowerCase().replace('@', ''),
        displayName: uName,
        userColor: '#00f0ff',
        userId: '',
        isMod: false,
        isSub: false,
        badges: '',
        question: qText,
        timestamp: Date.now(),
        status: status === 'on_air' ? 'on_air' : status,
        channel: chan,
        isManual: true
      };

      if (status === 'on_air') {
        qnaState.activeQuestion = newQ;
        await ipcRenderer.invoke('qna:set-active', newQ);
      }

      qnaState.questions.unshift(newQ);
      await ipcRenderer.invoke('qna:save-questions', qnaState.questions);
      manualModal.classList.add('hidden');
      renderQnASpotlight();
      renderQnAQuestionsList();
      showToast('Frage erfolgreich erfasst! ➕', 'success');
    });
  }

  // Settings Modal Open / Close / Save
  if (btnOpenSettings && settingsModal) {
    btnOpenSettings.addEventListener('click', () => {
      if (chkCmdFrage) chkCmdFrage.checked = qnaState.settings.cmdFrage;
      if (chkCmdQ) chkCmdQ.checked = qnaState.settings.cmdQ;
      if (chkCmdQuestion) chkCmdQuestion.checked = qnaState.settings.cmdQuestion;
      if (inputCooldown) inputCooldown.value = qnaState.settings.cooldown;
      if (inputMinLength) inputMinLength.value = qnaState.settings.minLength;
      if (chkAutoDupe) chkAutoDupe.checked = qnaState.settings.autoDupe;
      if (chkSoundAlert) chkSoundAlert.checked = qnaState.settings.soundAlert;
      settingsModal.classList.remove('hidden');
    });
  }

  if (btnCloseSettings && settingsModal) {
    btnCloseSettings.addEventListener('click', () => settingsModal.classList.add('hidden'));
  }
  if (btnCancelSettings && settingsModal) {
    btnCancelSettings.addEventListener('click', () => settingsModal.classList.add('hidden'));
  }

  if (btnSaveSettings && settingsModal) {
    btnSaveSettings.addEventListener('click', () => {
      qnaState.settings = {
        cmdFrage: chkCmdFrage ? chkCmdFrage.checked : true,
        cmdQ: chkCmdQ ? chkCmdQ.checked : true,
        cmdQuestion: chkCmdQuestion ? chkCmdQuestion.checked : true,
        cooldown: inputCooldown ? (parseInt(inputCooldown.value, 10) || 60) : 60,
        minLength: inputMinLength ? (parseInt(inputMinLength.value, 10) || 5) : 5,
        autoDupe: chkAutoDupe ? chkAutoDupe.checked : true,
        soundAlert: chkSoundAlert ? chkSoundAlert.checked : true
      };
      settingsModal.classList.add('hidden');
      showToast('Q&A Filter-Einstellungen gespeichert! 💾', 'success');
    });
  }

  // Streamer Stats & Auswertung Modal
  const btnOpenStatsModal = document.getElementById('btn-open-qna-stats-modal');
  const statsModal = document.getElementById('modal-qna-stats');
  const btnCloseStatsModal = document.getElementById('btn-close-qna-stats-modal');
  const btnCopyStatsSummary = document.getElementById('btn-copy-stats-summary');

  if (btnOpenStatsModal && statsModal) {
    btnOpenStatsModal.addEventListener('click', () => {
      renderQnAStatsModal();
      statsModal.classList.remove('hidden');
    });
  }

  if (btnCloseStatsModal && statsModal) {
    btnCloseStatsModal.addEventListener('click', () => {
      statsModal.classList.add('hidden');
    });
  }

  if (btnCopyStatsSummary) {
    btnCopyStatsSummary.addEventListener('click', () => {
      copyStatsSummaryToClipboard();
    });
  }

  // Poll Title Character Counter
  if (inputPollTitle && lblPollTitleCount) {
    inputPollTitle.addEventListener('input', () => {
      const len = (inputPollTitle.value || '').length;
      lblPollTitleCount.textContent = `${len}/60`;
    });
  }

  // Add Choice Button in Poll Creator
  if (btnAddChoice && pollChoicesContainer) {
    btnAddChoice.addEventListener('click', () => {
      const currentChoices = pollChoicesContainer.querySelectorAll('.poll-choice-row');
      if (currentChoices.length >= 5) {
        showToast('Maximal 5 Antwortmöglichkeiten erlaubt.', 'info');
        return;
      }
      const nextNum = currentChoices.length + 1;
      const row = document.createElement('div');
      row.className = 'poll-choice-row';
      row.innerHTML = `
        <span class="choice-num">${nextNum}</span>
        <input type="text" class="input-poll-choice" placeholder="Option ${nextNum} (max. 25 Z.)" maxlength="25">
        <button class="btn-remove-choice" title="Option entfernen">✕</button>
      `;
      row.querySelector('.btn-remove-choice').addEventListener('click', () => {
        row.remove();
        updatePollChoiceNumbers();
      });
      pollChoicesContainer.appendChild(row);
      const input = row.querySelector('.input-poll-choice');
      if (input) input.focus();
    });
  }

  // Preset Buttons Click
  const presetBtns = document.querySelectorAll('.poll-preset-btn');
  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const pKey = btn.getAttribute('data-preset');
      applyPollPreset(pKey);
    });
  });

  // Start Twitch Poll Button
  if (btnStartPoll) {
    btnStartPoll.addEventListener('click', async () => {
      await startTwitchPollFromForm();
    });
  }

  // Save Custom Poll Template Button
  if (btnSaveTemplate) {
    btnSaveTemplate.addEventListener('click', async () => {
      await saveCustomPollTemplateFromForm();
    });
  }

  // Setup Predictions and Mode Switcher Listeners
  setupPollsAndPredictionsListeners();

  // Incoming Q&A Question from Twitch IRC Listener
  ipcRenderer.on('qna:new-question', (event, questionObj) => {
    handleNewQnAQuestion(questionObj);
  });
}

function updatePollChoiceNumbers() {
  const pollChoicesContainer = document.getElementById('poll-choices-container');
  if (!pollChoicesContainer) return;
  const rows = pollChoicesContainer.querySelectorAll('.poll-choice-row');
  rows.forEach((r, idx) => {
    const numSpan = r.querySelector('.choice-num');
    if (numSpan) numSpan.textContent = String(idx + 1);
  });
}

function applyPollPreset(presetKey) {
  const inputPollTitle = document.getElementById('input-poll-title');
  const lblPollTitleCount = document.getElementById('lbl-poll-title-count');
  const pollChoicesContainer = document.getElementById('poll-choices-container');
  const selectPollDuration = document.getElementById('select-poll-duration');

  if (!inputPollTitle || !pollChoicesContainer) return;

  let title = '';
  let choices = [];

  if (presetKey === 'preset_setup_rating') {
    title = 'Wie bewertet ihr das aktuelle Setup?';
    choices = ['10/10 Perfekt 🔥', '8/10 Sehr gut 👍', '5/10 Geht so 🤔', '0/10 Ausleeren 💀'];
  } else if (presetKey === 'preset_next_bowl') {
    title = 'Welcher Kopf soll als nächstes geraucht werden?';
    choices = ['Oblako Phunnel', 'Hookain LiT LiP', 'Vandenberg V1', 'Kaloud Samsaris'];
  } else if (presetKey === 'preset_tobacco_direction') {
    title = 'Welche Geschmacksrichtung soll in den Kopf?';
    choices = ['Fruchtig / Süß 🍇', 'Cremig / Teigig 🍦', 'Frisch / Ice ❄️', 'Doppelapfel / Anis 🍏'];
  } else if (presetKey === 'preset_coal_check') {
    title = 'Kohle nachlegen oder neuer Kopf?';
    choices = ['Neue Kohlen drauf! 🪵', 'Neuer Kopf muss her! 💨', 'Passt noch so 👍'];
  }

  inputPollTitle.value = title;
  if (lblPollTitleCount) lblPollTitleCount.textContent = `${title.length}/60`;
  if (selectPollDuration) selectPollDuration.value = '60';

  pollChoicesContainer.innerHTML = '';
  choices.forEach((c, idx) => {
    const row = document.createElement('div');
    row.className = 'poll-choice-row';
    const canRemove = idx >= 2;
    row.innerHTML = `
      <span class="choice-num">${idx + 1}</span>
      <input type="text" class="input-poll-choice" placeholder="Option ${idx + 1} (max. 25 Z.)" maxlength="25" value="${c}">
      ${canRemove ? '<button class="btn-remove-choice" title="Option entfernen">✕</button>' : ''}
    `;
    if (canRemove) {
      row.querySelector('.btn-remove-choice').addEventListener('click', () => {
        row.remove();
        updatePollChoiceNumbers();
      });
    }
    pollChoicesContainer.appendChild(row);
  });

  showToast(`Vorlage „${title}“ geladen!`, 'info');
}

async function loadQnAState() {
  try {
    const chan = (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved';
    const qRes = await ipcRenderer.invoke('qna:get-questions', chan);
    if (qRes && qRes.success && Array.isArray(qRes.questions)) {
      qnaState.questions = qRes.questions;
      qnaState.activeQuestion = qRes.questions.find(q => q.status === 'on_air') || null;
    }

    const tmplRes = await ipcRenderer.invoke('polls:get-templates');
    if (tmplRes && tmplRes.success && Array.isArray(tmplRes.templates)) {
      pollsState.templates = tmplRes.templates;
    }

    const pollRes = await ipcRenderer.invoke('polls:get-active', chan);
    if (pollRes && pollRes.success) {
      pollsState.activePoll = pollRes.poll;
    }

    const predRes = await ipcRenderer.invoke('predictions:get-active', chan);
    if (predRes && predRes.success) {
      predictionsState.activePrediction = predRes.prediction;
    }

    await loadQnASettings();
    await loadBestrafungen();

    renderQnASpotlight();
    renderQnAQuestionsList();
    renderPollActiveSection(pollsState.activePoll);
    renderSavedPollTemplates();
    renderPredictionActiveSection(predictionsState.activePrediction);
    renderSavedPredictionTemplates();
  } catch(e) {
    console.error('Error loading Q&A state:', e);
  }
}

// Realtime listeners from main process
ipcRenderer.on('supabase:chat-changed', () => {
  if (typeof checkModChatUpdates === 'function') {
    checkModChatUpdates();
  }
});

ipcRenderer.on('supabase:bestrafungen-changed', () => {
  loadBestrafungen();
});

ipcRenderer.on('supabase:settings-changed', () => {
  loadQnASettings();
});

ipcRenderer.on('supabase:qna-changed', () => {
  loadQnAState();
});

ipcRenderer.on('supabase:giveaway-changed', () => {
  loadGiveawayWinnersHistory();
});

ipcRenderer.on('supabase:setup-changed', () => {
  if (typeof fetchCurrentSetupRemote === 'function') {
    fetchCurrentSetupRemote(true);
  }
});

ipcRenderer.on('supabase:catalog-changed', async () => {
  state.catalog = await ipcRenderer.invoke('db:get-catalog');
  updateDatalists();
  const dbModal = document.getElementById('db-modal');
  if (dbModal && !dbModal.classList.contains('hidden') && typeof renderCatalogList === 'function') {
    renderCatalogList();
  }
});

function handleNewQnAQuestion(q) {
  if (!q || !q.question) return;

  const rawText = (q.question || '').trim();
  // Validate minimum length
  if (rawText.length < qnaState.settings.minLength) return;

  // Normalized clean text for matching (strip trailing punctuation, emojis, multiple spaces)
  const normNew = rawText.toLowerCase().replace(/[?!.,;:_~#+*^$'"„“”\s]+/g, ' ').trim();
  const uName = q.displayName || q.login || 'Viewer';
  const chan = (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved';

  // Auto Duplicate Detection via Fuzzy Matching across all statuses
  let matchedExisting = null;

  if (qnaState.settings.autoDupe && qnaState.questions.length > 0) {
    for (const existing of qnaState.questions) {
      const normExisting = (existing.question || '').toLowerCase().replace(/[?!.,;:_~#+*^$'"„“”\s]+/g, ' ').trim();
      const isExact = (normNew === normExisting);
      const sim = isExact ? 1.0 : similarityScore(rawText, existing.question);

      if (isExact || sim >= 0.70) {
        matchedExisting = existing;
        break;
      }
    }
  }

  if (matchedExisting) {
    const status = matchedExisting.status;
    const sameUser = (matchedExisting.login && matchedExisting.login.toLowerCase() === (q.login || '').toLowerCase());

    if (status === 'answered') {
      const replyMsg = `@${uName} Diese Frage wurde heute bereits im Stream beantwortet! ✔️`;
      ipcRenderer.invoke('twitch:send-chat', { channel: chan, message: replyMsg }).catch(() => {});
      showToast(`@${uName} stellte eine bereits beantwortete Frage.`, 'info');
      return;
    }

    if (status === 'rejected') {
      const replyMsg = `@${uName} Deine Frage hat leider nicht unseren Chat-Richtlinien entsprochen und wurde abgelehnt. ❌`;
      ipcRenderer.invoke('twitch:send-chat', { channel: chan, message: replyMsg }).catch(() => {});
      showToast(`@${uName} stellte eine bereits abgelehnte Frage.`, 'info');
      return;
    }

    // Status is 'pending', 'approved', or 'on_air'
    matchedExisting.duplicateCount = (matchedExisting.duplicateCount || 1) + 1;
    matchedExisting.updatedAt = Date.now();
    if (!matchedExisting.duplicateUsers) {
      matchedExisting.duplicateUsers = [matchedExisting.displayName || matchedExisting.login];
    }
    if (!matchedExisting.duplicateUsers.includes(uName)) {
      matchedExisting.duplicateUsers.push(uName);
    }

    // Persist updated existing question with increased duplicateCount
    ipcRenderer.invoke('qna:upsert-question', matchedExisting).catch(() => {});

    const replyMsg = sameUser
      ? `@${uName} Du hast diese Frage bereits gestellt – sie ist bereits im Fragen-Pool! 💬`
      : `@${uName} Eine sehr ähnliche Frage ist bereits im Fragen-Pool! 🔥`;

    ipcRenderer.invoke('twitch:send-chat', { channel: chan, message: replyMsg }).catch(() => {});
    showToast(`Doppelte Frage von @${uName} zusammengeführt! 🔥`, 'info');
    renderQnAQuestionsList();
    return;
  }

  // Not a duplicate: Add new question
  q.updatedAt = Date.now();
  q.duplicateCount = 1;
  q.duplicateUsers = [uName];
  qnaState.questions.unshift(q);

  // Play sound if enabled
  if (qnaState.settings.soundAlert) {
    playQnANotificationSound();
  }

  // Hub badge counter
  if (currentActiveView !== 'view-qna') {
    unreadQnACount++;
    const badge = document.getElementById('hub-qna-unread');
    if (badge) {
      badge.classList.remove('hidden');
      badge.textContent = String(unreadQnACount);
    }
  }

  showToast(`🙋 Neue Frage von @${uName}!`, 'info');

  // Persist new question to Supabase
  ipcRenderer.invoke('qna:upsert-question', q).catch(() => {});

  renderQnAQuestionsList();
}

async function setQuestionStatus(questionId, newStatus) {
  const q = qnaState.questions.find(item => item.id === questionId);
  if (!q) return;

  const oldStatus = q.status;
  q.status = newStatus;
  q.updatedAt = Date.now();
  if (newStatus === 'approved') {
    q.answeredBy = null;
  }

  const chan = (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved';
  if (newStatus === 'on_air') {
    // Reset any other question that was previously on_air
    qnaState.questions.forEach(item => {
      if (item.id !== questionId && item.status === 'on_air') {
        item.status = 'approved';
        item.updatedAt = Date.now();
      }
    });

    qnaState.activeQuestion = q;
    await ipcRenderer.invoke('qna:set-active', q, chan);
    showToast(`Frage von @${q.displayName || q.login} ist jetzt LIVE ON-AIR! 📺`, 'success');
  } else if (qnaState.activeQuestion && qnaState.activeQuestion.id === questionId) {
    qnaState.activeQuestion = null;
    await ipcRenderer.invoke('qna:set-active', null, chan);
  }

  if (newStatus === 'approved' && oldStatus !== 'approved') {
    showToast(`Frage von @${q.displayName || q.login} freigegeben! ✅`, 'success');
  } else if (newStatus === 'rejected' && oldStatus !== 'rejected') {
    showToast(`Frage von @${q.displayName || q.login} abgelehnt! ❌`, 'info');
  }

  await ipcRenderer.invoke('qna:save-questions', qnaState.questions);
  renderQnASpotlight();
  renderQnAQuestionsList();
}

async function deleteQuestion(questionId) {
  const chan = (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved';
  if (qnaState.activeQuestion && qnaState.activeQuestion.id === questionId) {
    qnaState.activeQuestion = null;
    await ipcRenderer.invoke('qna:set-active', null, chan);
  }
  qnaState.questions = qnaState.questions.filter(q => q.id !== questionId);
  await ipcRenderer.invoke('qna:delete-question', questionId);
  renderQnASpotlight();
  renderQnAQuestionsList();
  showToast('Frage gelöscht. 🗑️', 'info');
}

function renderQnASpotlight() {
  const container = document.getElementById('qna-spotlight-content');
  const badge = document.getElementById('qna-on-air-badge');
  if (!container) return;

  const active = qnaState.activeQuestion;
  if (!active || active.status !== 'on_air') {
    if (badge) {
      badge.className = 'qna-status-badge offline';
      badge.innerHTML = '<span class="status-dot"></span> <span class="status-text">Keine aktiv</span>';
    }
    container.innerHTML = `
      <div class="qna-spotlight-empty">
        <span class="empty-icon">📭</span>
        <p>Aktuell wird <strong>keine Frage</strong> im Stream eingeblendet.</p>
        <span class="empty-hint">Wähle unten eine Frage aus und klicke auf <strong>„📺 Live schalten“</strong>, um sie auf Marvins Monitor und in OBS anzuzeigen.</span>
      </div>
    `;
    return;
  }

  if (badge) {
    badge.className = 'qna-status-badge on-air';
    badge.innerHTML = '<span class="status-dot green pulse"></span> <span class="status-text">LIVE AUF SCREEN</span>';
  }

  const userColor = active.userColor || '#00f0ff';
  const timeStr = active.timestamp ? new Date(active.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '';

  container.innerHTML = `
    <div class="qna-spotlight-active">
      <div class="qna-spotlight-top">
        <div class="qna-user-pill">
          <span class="qna-user-dot" style="background:${userColor};"></span>
          <strong style="color:${userColor};">@${escapeHtml(active.displayName || active.login)}</strong>
          ${active.isSub ? '<span style="background:#a855f7; color:#fff; font-size:0.68rem; padding:1px 6px; border-radius:4px;">SUB</span>' : ''}
          ${active.isMod ? '<span style="background:#10b981; color:#fff; font-size:0.68rem; padding:1px 6px; border-radius:4px;">MOD</span>' : ''}
        </div>
        <span class="qna-spotlight-time">${timeStr}</span>
      </div>
      <div class="qna-spotlight-body">
        „${escapeHtml(active.question)}“
      </div>
      <div class="qna-spotlight-actions">
        <button id="btn-spotlight-offair" class="btn btn-sm btn-secondary">⏹️ Vom Stream nehmen</button>
      </div>
    </div>
  `;

  const btnOffAir = document.getElementById('btn-spotlight-offair');
  if (btnOffAir) {
    btnOffAir.addEventListener('click', () => setQuestionStatus(active.id, 'approved'));
  }
}

function renderQnAQuestionsList() {
  const container = document.getElementById('qna-questions-list');
  if (!container) return;

  // Update counter badges
  const cPending = qnaState.questions.filter(q => q.status === 'pending').length;
  const cApproved = qnaState.questions.filter(q => q.status === 'approved' || q.status === 'on_air').length;
  const cAnswered = qnaState.questions.filter(q => q.status === 'answered').length;
  const cRejected = qnaState.questions.filter(q => q.status === 'rejected').length;
  const cAll = qnaState.questions.length;

  const elPending = document.getElementById('count-qna-pending');
  const elApproved = document.getElementById('count-qna-approved');
  const elAnswered = document.getElementById('count-qna-answered');
  const elRejected = document.getElementById('count-qna-rejected');
  const elAll = document.getElementById('count-qna-all');

  if (elPending) elPending.textContent = String(cPending);
  if (elApproved) elApproved.textContent = String(cApproved);
  if (elAnswered) elAnswered.textContent = String(cAnswered);
  if (elRejected) elRejected.textContent = String(cRejected);
  if (elAll) elAll.textContent = String(cAll);

  // Filter list
  let filtered = qnaState.questions;
  if (qnaState.currentFilter !== 'all') {
    if (qnaState.currentFilter === 'approved') {
      filtered = filtered.filter(q => q.status === 'approved' || q.status === 'on_air');
    } else {
      filtered = filtered.filter(q => q.status === qnaState.currentFilter);
    }
  }

  // Search filter
  if (qnaState.searchQuery) {
    filtered = filtered.filter(q => {
      const qText = (q.question || '').toLowerCase();
      const uName = (q.displayName || q.login || '').toLowerCase();
      return qText.includes(qnaState.searchQuery) || uName.includes(qnaState.searchQuery);
    });
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="qna-list-empty">
        <span class="empty-icon">💬</span>
        <p>Keine Fragen in dieser Ansicht vorhanden.</p>
        <span class="empty-hint">Zuschauer können im Chat <code>!frage Deine Frage hier</code> schreiben!</span>
      </div>
    `;
    return;
  }

  container.innerHTML = '';
  filtered.forEach(q => {
    const card = document.createElement('div');
    card.className = `qna-question-card status-${q.status}`;

    const userColor = q.userColor || '#00f0ff';
    const timeStr = q.timestamp ? formatTimeAgo(q.timestamp) : '';
    const dupeUsers = q.duplicateUsers || [];
    const uniqueCount = dupeUsers.length > 1 ? dupeUsers.length : 1;
    const isDupe = (uniqueCount > 1);
    const dupeUsersStr = dupeUsers.join(', ');

    // Card top row
    let topHtml = `
      <div class="qna-card-top">
        <div class="qna-user-pill">
          <span class="qna-user-dot" style="background:${userColor};"></span>
          <strong style="color:${userColor};">@${escapeHtml(q.displayName || q.login)}</strong>
          ${q.isSub ? '<span style="background:#a855f7; color:#fff; font-size:0.65rem; padding:1px 5px; border-radius:4px;">SUB</span>' : ''}
          ${q.isMod ? '<span style="background:#10b981; color:#fff; font-size:0.65rem; padding:1px 5px; border-radius:4px;">MOD</span>' : ''}
          ${q.isManual ? '<span style="background:rgba(255,255,255,0.1); color:var(--text-secondary); font-size:0.65rem; padding:1px 5px; border-radius:4px;">MANUELL</span>' : ''}
          ${q.answeredBy ? `<span style="background:rgba(16,185,129,0.15); color:#10b981; border:1px solid rgba(16,185,129,0.3); font-size:0.65rem; padding:1px 6px; border-radius:4px; font-weight:700;">👤 ${escapeHtml(q.answeredBy)}</span>` : ''}
        </div>
        <div style="display:flex; align-items:center; gap:6px;">
          ${isDupe ? `<span class="qna-dupe-tag" title="Gefragt von: ${escapeHtml(dupeUsersStr)}">🔥 von ${uniqueCount} Zuschauern gefragt</span>` : ''}
          <span class="qna-spotlight-time">${timeStr}</span>
        </div>
      </div>
    `;

    // Question body
    let bodyHtml = `<div class="qna-card-text">„${escapeHtml(q.question)}“</div>`;

    // Action buttons based on status for Mod Tool
    let actionsHtml = `<div class="qna-card-bottom"><div class="qna-card-actions">`;
    if (q.status === 'pending') {
      actionsHtml += `
        <button class="btn btn-xs btn-primary btn-act-approve" data-id="${q.id}">✅ Freigeben</button>
        <button class="btn btn-xs btn-secondary btn-act-reject" data-id="${q.id}">❌ Ablehnen</button>
      `;
    } else if (q.status === 'approved') {
      actionsHtml += `
        <span style="font-size:0.75rem; color:#10b981; font-weight:600; display:inline-flex; align-items:center; gap:4px; padding:2px 0;">
          <span>✅</span> <span>Im Streamer-Pool</span>
        </span>
        <button class="btn btn-xs btn-secondary btn-act-reject" data-id="${q.id}" title="Aus Pool entfernen & ablehnen">❌ Ablehnen</button>
      `;
    } else if (q.status === 'on_air') {
      actionsHtml += `
        <span class="badge" style="background:rgba(0,240,255,0.15); color:#00f0ff; border:1px solid rgba(0,240,255,0.3); font-size:0.72rem; padding:2px 8px; border-radius:10px; font-weight:700;">
          📺 Live auf Screen
        </span>
      `;
    } else if (q.status === 'answered') {
      actionsHtml += `
        <span style="font-size:0.75rem; color:#a855f7; font-weight:600; display:inline-flex; align-items:center; gap:4px; padding:2px 0;">
          <span>✔️</span> <span>Beantwortet</span>
        </span>
        <button class="btn btn-xs btn-secondary btn-act-approve" data-id="${q.id}">↩️ Wieder freigeben</button>
      `;
    } else if (q.status === 'rejected') {
      actionsHtml += `
        <span style="font-size:0.75rem; color:#ef4444; font-weight:600; display:inline-flex; align-items:center; gap:4px; padding:2px 0;">
          <span>❌</span> <span>Abgelehnt</span>
        </span>
        <button class="btn btn-xs btn-secondary btn-act-approve" data-id="${q.id}">↩️ Wieder freigeben</button>
      `;
    }
    actionsHtml += `
      </div>
      <button class="btn btn-xs btn-secondary btn-act-delete" data-id="${q.id}" title="Frage endgültig löschen">🗑️</button>
    </div>`;

    card.innerHTML = topHtml + bodyHtml + actionsHtml;

    // Attach event listeners to card buttons
    const btnApprove = card.querySelector('.btn-act-approve');
    const btnReject = card.querySelector('.btn-act-reject');
    const btnDel = card.querySelector('.btn-act-delete');

    if (btnApprove) btnApprove.addEventListener('click', () => setQuestionStatus(q.id, 'approved'));
    if (btnReject) btnReject.addEventListener('click', () => setQuestionStatus(q.id, 'rejected'));
    if (btnDel) btnDel.addEventListener('click', () => deleteQuestion(q.id));

    container.appendChild(card);
  });

  renderQnAQuickLeaderboard();
}

function renderQnAQuickLeaderboard() {
  const container = document.getElementById('qna-quick-leaderboard-container');
  if (!container) return;
  const questions = qnaState.questions || [];
  const bestrafungen = bestrafungenList || [];
  const personsSet = new Set(qnaPersons);
  questions.forEach(q => { if (q.answeredBy) personsSet.add(q.answeredBy); });
  bestrafungen.forEach(b => { if (b.executedBy) personsSet.add(b.executedBy); });
  const allPersons = Array.from(personsSet).filter(Boolean);

  if (allPersons.length === 0) {
    container.innerHTML = `<div style="color:var(--text-secondary); font-size:0.8rem; text-align:center; padding:8px;">Noch keine Streamer angelegt.</div>`;
    return;
  }

  container.innerHTML = allPersons.map(p => {
    const pAnswered = questions.filter(q => q.status === 'answered' && q.answeredBy === p).length;
    const pSkipped = questions.filter(q => q.status === 'rejected' && q.answeredBy === p).length;
    const pBestrafungen = bestrafungen.filter(b => b.status === 'erledigt' && b.executedBy === p).length;
    return `
      <div style="display:flex; align-items:center; justify-content:space-between; padding:6px 10px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:8px; margin-bottom:6px; font-size:0.82rem;">
        <strong style="color:#38bdf8;">👤 ${escapeHtml(p)}</strong>
        <div style="display:flex; gap:10px; font-size:0.75rem;">
          <span style="color:#10b981; font-weight:700;" title="Beantwortet">✅ ${pAnswered}</span>
          <span style="color:#ef4444; font-weight:700;" title="Übersprungen">⏭️ ${pSkipped}</span>
          <span style="color:#f59e0b; font-weight:700;" title="Bestrafungen">🎡 ${pBestrafungen}</span>
        </div>
      </div>
    `;
  }).join('');
}

function formatTimeAgo(timestamp) {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return 'gerade eben';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `vor ${diffMin} Min.`;
  const diffHrs = Math.floor(diffMin / 60);
  return `vor ${diffHrs} Std.`;
}

let statsPersonFilter = 'all';
let statsTypeFilter = 'all';
let statsSearchQuery = '';

function renderQnAStatsModal() {
  const cardsGrid = document.getElementById('qna-stats-cards-grid');
  const elTotalQ = document.getElementById('stat-total-questions');
  const elTotalAns = document.getElementById('stat-total-answered');
  const elTotalSkip = document.getElementById('stat-total-skipped');
  const elTotalBest = document.getElementById('stat-total-bestrafungen');

  const questions = qnaState.questions || [];
  const bestrafungen = bestrafungenList || [];

  const totalQuestions = questions.length;
  const totalAnswered = questions.filter(q => q.status === 'answered').length;
  const totalSkipped = questions.filter(q => q.status === 'rejected').length;
  const totalBestrafungen = bestrafungen.filter(b => b.status === 'erledigt').length;

  if (elTotalQ) elTotalQ.textContent = String(totalQuestions);
  if (elTotalAns) elTotalAns.textContent = String(totalAnswered);
  if (elTotalSkip) elTotalSkip.textContent = String(totalSkipped);
  if (elTotalBest) elTotalBest.textContent = String(totalBestrafungen);

  // Collect all unique persons
  const personsSet = new Set(qnaPersons);
  questions.forEach(q => { if (q.answeredBy) personsSet.add(q.answeredBy); });
  bestrafungen.forEach(b => { if (b.executedBy) personsSet.add(b.executedBy); });
  const allPersons = Array.from(personsSet).filter(Boolean);

  if (cardsGrid) {
    if (allPersons.length === 0) {
      cardsGrid.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:var(--text-secondary); padding:16px;">Keine Streamer oder Personen angelegt.</div>`;
    } else {
      const streamerColors = {
        'marved': { bg: 'rgba(59, 130, 246, 0.12)', border: 'rgba(59, 130, 246, 0.35)', dot: '#38bdf8' },
        'hasty': { bg: 'rgba(34, 197, 94, 0.12)', border: 'rgba(34, 197, 94, 0.35)', dot: '#4ade80' },
        'kai': { bg: 'rgba(249, 115, 22, 0.12)', border: 'rgba(249, 115, 22, 0.35)', dot: '#fb923c' }
      };

      cardsGrid.innerHTML = allPersons.map(p => {
        const pLower = p.toLowerCase();
        const col = streamerColors[pLower] || { bg: 'rgba(139, 92, 246, 0.12)', border: 'rgba(139, 92, 246, 0.35)', dot: '#a78bfa' };

        const pAnswered = questions.filter(q => q.status === 'answered' && q.answeredBy === p).length;
        const pSkipped = questions.filter(q => q.status === 'rejected' && q.answeredBy === p).length;
        const pBestrafungen = bestrafungen.filter(b => b.status === 'erledigt' && b.executedBy === p).length;
        const pTotal = pAnswered + pSkipped;
        const quote = pTotal > 0 ? Math.round((pAnswered / pTotal) * 100) : 0;

        return `
          <div style="background:${col.bg}; border:1px solid ${col.border}; border-radius:12px; padding:14px; position:relative; overflow:hidden;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
              <span style="width:10px; height:10px; border-radius:50%; background:${col.dot}; box-shadow:0 0 8px ${col.dot};"></span>
              <strong style="font-size:1rem; color:#fff;">${escapeHtml(p)}</strong>
              ${pTotal > 0 ? `<span style="margin-left:auto; font-size:0.7rem; color:${col.dot}; font-weight:700;">${quote}% Quote</span>` : ''}
            </div>
            <div style="display:flex; flex-direction:column; gap:4px; font-size:0.8rem; color:#cbd5e1;">
              <div style="display:flex; justify-content:space-between;">
                <span>✅ Beantwortet:</span> <strong style="color:#10b981;">${pAnswered}</strong>
              </div>
              <div style="display:flex; justify-content:space-between;">
                <span>⏭️ Übersprungen:</span> <strong style="color:#ef4444;">${pSkipped}</strong>
              </div>
              <div style="display:flex; justify-content:space-between;">
                <span>🎡 Bestrafungen:</span> <strong style="color:#f59e0b;">${pBestrafungen}</strong>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // Render Person Filter Buttons in Timeline Bar
  const personFilterContainer = document.getElementById('qna-stats-filter-persons');
  if (personFilterContainer) {
    let pillsHtml = `
      <button class="btn btn-xs ${statsPersonFilter === 'all' ? 'btn-primary' : 'btn-secondary'} btn-stats-person-filter" data-person="all">
        Alle Personen
      </button>
    `;
    allPersons.forEach(p => {
      const isSel = (statsPersonFilter === p);
      pillsHtml += `
        <button class="btn btn-xs ${isSel ? 'btn-primary' : 'btn-secondary'} btn-stats-person-filter" data-person="${escapeHtml(p)}">
          ${escapeHtml(p)}
        </button>
      `;
    });
    personFilterContainer.innerHTML = pillsHtml;

    personFilterContainer.querySelectorAll('.btn-stats-person-filter').forEach(btn => {
      btn.addEventListener('click', (e) => {
        statsPersonFilter = e.currentTarget.getAttribute('data-person');
        renderQnAStatsModal();
      });
    });
  }

  // Bind Type Filter & Search listeners once
  const selType = document.getElementById('sel-stats-filter-type');
  if (selType && !selType.dataset.bound) {
    selType.dataset.bound = 'true';
    selType.addEventListener('change', (e) => {
      statsTypeFilter = e.target.value;
      renderQnAStatsTimelineOnly();
    });
  }

  const inputSearch = document.getElementById('input-stats-search');
  if (inputSearch && !inputSearch.dataset.bound) {
    inputSearch.dataset.bound = 'true';
    inputSearch.addEventListener('input', (e) => {
      statsSearchQuery = (e.target.value || '').toLowerCase().trim();
      renderQnAStatsTimelineOnly();
    });
  }

  renderQnAStatsTimelineOnly();
}

function renderQnAStatsTimelineOnly() {
  const timelineEl = document.getElementById('qna-stats-timeline');
  if (!timelineEl) return;

  const questions = qnaState.questions || [];
  const bestrafungen = bestrafungenList || [];

  const events = [];

  // Questions events
  questions.forEach(q => {
    if (q.status === 'answered' || q.status === 'rejected') {
      const time = q.updatedAt || q.timestamp || Date.now();
      const isAns = (q.status === 'answered');
      events.push({
        type: isAns ? 'answered' : 'rejected',
        time,
        icon: isAns ? '✅' : '⏭️',
        person: q.answeredBy || 'Unbekannt',
        title: isAns ? `hat Frage beantwortet` : `hat Frage übersprungen`,
        detail: `„${q.question}“ (von @${q.displayName || q.login})`,
        badgeColor: isAns ? '#10b981' : '#ef4444'
      });
    }
  });

  // Bestrafungen events
  bestrafungen.forEach(b => {
    if (b.status === 'erledigt') {
      const time = b.timestamp || Date.now();
      events.push({
        type: 'bestrafung',
        time,
        icon: '🎡',
        person: b.executedBy || 'Unbekannt',
        title: `hat Bestrafungsrad-Challenge absolviert`,
        detail: `„${b.name}“`,
        badgeColor: '#f59e0b'
      });
    }
  });

  events.sort((a, b) => b.time - a.time);

  // Apply filters
  let filtered = events;
  if (statsPersonFilter !== 'all') {
    filtered = filtered.filter(ev => ev.person.toLowerCase() === statsPersonFilter.toLowerCase());
  }
  if (statsTypeFilter !== 'all') {
    filtered = filtered.filter(ev => ev.type === statsTypeFilter);
  }
  if (statsSearchQuery) {
    filtered = filtered.filter(ev => {
      const p = ev.person.toLowerCase();
      const d = ev.detail.toLowerCase();
      const t = ev.title.toLowerCase();
      return p.includes(statsSearchQuery) || d.includes(statsSearchQuery) || t.includes(statsSearchQuery);
    });
  }

  if (filtered.length === 0) {
    timelineEl.innerHTML = `<div style="text-align:center; color:var(--text-secondary); padding:20px; font-size:0.85rem;">Keine Aktivitäten für die ausgewählten Filterkriterien gefunden.</div>`;
  } else {
    timelineEl.innerHTML = filtered.map(ev => {
      const timeStr = new Date(ev.time).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
      return `
        <div style="display:flex; align-items:flex-start; gap:10px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:8px; padding:8px 12px; font-size:0.82rem;">
          <span style="font-size:1.1rem; line-height:1.2;">${ev.icon}</span>
          <div style="flex:1;">
            <div style="display:flex; align-items:center; gap:6px; margin-bottom:2px;">
              <span style="color:#38bdf8; font-weight:700;">${escapeHtml(ev.person)}</span>
              <span style="color:var(--text-secondary);">${ev.title}</span>
              <span style="margin-left:auto; font-size:0.75rem; color:rgba(255,255,255,0.4);">${timeStr}</span>
            </div>
            <div style="color:#e2e8f0; font-size:0.8rem; word-break:break-word;">${escapeHtml(ev.detail)}</div>
          </div>
        </div>
      `;
    }).join('');
  }
}

function copyStatsSummaryToClipboard() {
  const questions = qnaState.questions || [];
  const bestrafungen = bestrafungenList || [];

  const totalQuestions = questions.length;
  const totalAnswered = questions.filter(q => q.status === 'answered').length;
  const totalSkipped = questions.filter(q => q.status === 'rejected').length;
  const totalBestrafungen = bestrafungen.filter(b => b.status === 'erledigt').length;

  const personsSet = new Set(qnaPersons);
  questions.forEach(q => { if (q.answeredBy) personsSet.add(q.answeredBy); });
  bestrafungen.forEach(b => { if (b.executedBy) personsSet.add(b.executedBy); });
  const allPersons = Array.from(personsSet).filter(Boolean);

  let text = `📊 ShishaWG Fragerunden-Statistik:\n`;
  text += `Gesamt: ${totalQuestions} Fragen | ${totalAnswered} beantwortet | ${totalSkipped} übersprungen | ${totalBestrafungen} Bestrafungen erfüllt\n\n`;
  text += `👑 Streamer Leaderboard:\n`;

  allPersons.forEach(p => {
    const pAnswered = questions.filter(q => q.status === 'answered' && q.answeredBy === p).length;
    const pSkipped = questions.filter(q => q.status === 'rejected' && q.answeredBy === p).length;
    const pBestrafungen = bestrafungen.filter(b => b.status === 'erledigt' && b.executedBy === p).length;
    text += `• ${p}: ${pAnswered} beantwortet, ${pSkipped} übersprungen, ${pBestrafungen} Bestrafung(en)\n`;
  });

  navigator.clipboard.writeText(text);
  showToast('Statistik-Zusammenfassung in die Zwischenablage kopiert! 📋', 'success');
}

// Render Active Twitch Poll Monitor
function renderPollActiveSection(poll) {
  const container = document.getElementById('poll-live-content');
  const indicator = document.getElementById('poll-live-indicator');
  if (!container) return;

  if (!poll || (poll.status !== 'ACTIVE' && poll.status !== 'active')) {
    if (indicator) {
      indicator.className = 'qna-status-badge offline';
      indicator.innerHTML = '<span class="status-dot"></span> <span class="status-text">Keine aktiv</span>';
    }
    container.innerHTML = `
      <div class="poll-empty-state">
        <span class="empty-icon">🗳️</span>
        <p>Aktuell läuft keine Umfrage im Twitch-Kanal.</p>
        <span class="empty-hint">Wähle eine Schnell-Vorlage unten oder erstelle eine neue Abstimmung.</span>
      </div>
    `;
    return;
  }

  if (indicator) {
    indicator.className = 'qna-status-badge live';
    indicator.innerHTML = '<span class="status-dot red pulse"></span> <span class="status-text">LIVE AUF TWITCH</span>';
  }

  const choices = poll.choices || [];
  let totalVotes = poll.total_votes || 0;
  if (!totalVotes) {
    totalVotes = choices.reduce((acc, c) => acc + (c.votes || 0), 0);
  }

  let choicesHtml = '<div class="poll-choice-bars">';
  choices.forEach(c => {
    const votes = c.votes || 0;
    const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
    choicesHtml += `
      <div class="poll-choice-bar-item">
        <div class="poll-choice-bar-label">
          <strong>${escapeHtml(c.title)}</strong>
          <span>${votes} Stimmen (${pct}%)</span>
        </div>
        <div class="poll-choice-bar-track">
          <div class="poll-choice-bar-fill" style="width:${pct}%;"></div>
        </div>
      </div>
    `;
  });
  choicesHtml += '</div>';

  container.innerHTML = `
    <div class="poll-active-box">
      <div class="poll-active-header">
        <div class="poll-active-title">„${escapeHtml(poll.title)}“</div>
      </div>

      ${choicesHtml}

      <div class="poll-active-footer">
        <span class="poll-total-votes">Gesamt: ${totalVotes} Stimmen</span>
        <div style="display:flex; gap:6px;">
          <button id="btn-end-active-poll" class="btn btn-xs btn-secondary" title="Poll vorzeitig beenden">
            ⏹️ Beenden
          </button>
          <button id="btn-share-poll-result" class="btn btn-xs btn-primary" title="Ergebnis im Twitch-Chat teilen">
            📢 Im Chat teilen
          </button>
        </div>
      </div>
    </div>
  `;

  const btnEndPoll = document.getElementById('btn-end-active-poll');
  const btnShareResult = document.getElementById('btn-share-poll-result');

  if (btnEndPoll) {
    btnEndPoll.addEventListener('click', async () => {
      const chan = (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved';
      try {
        await ipcRenderer.invoke('polls:end', { pollId: poll.id, status: 'TERMINATED', channel: chan });
        showToast('Twitch Poll wurde vorzeitig beendet.', 'success');
        pollsState.activePoll = null;
        renderPollActiveSection(null);
      } catch(e) {
        showToast(`Fehler beim Beenden: ${e.message}`, 'error');
      }
    });
  }

  if (btnShareResult) {
    btnShareResult.addEventListener('click', async () => {
      const chan = (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved';
      let resultText = `📊 Umfrage-Ergebnis: „${poll.title}“ » `;
      const parts = choices.map(c => {
        const pct = totalVotes > 0 ? Math.round(((c.votes || 0) / totalVotes) * 100) : 0;
        return `${c.title}: ${pct}% (${c.votes || 0})`;
      });
      resultText += parts.join(' | ');

      try {
        await ipcRenderer.invoke('twitch:send-chat-message', { message: resultText, channel: chan });
        showToast('Umfrage-Ergebnis in den Chat gepostet! 📢', 'success');
      } catch(e) {
        showToast(`Fehler beim Senden: ${e.message}`, 'error');
      }
    });
  }
}

async function startTwitchPollFromForm() {
  const inputTitle = document.getElementById('input-poll-title');
  const selectDuration = document.getElementById('select-poll-duration');
  const selectPoints = document.getElementById('select-poll-channel-points');
  const pollChoicesContainer = document.getElementById('poll-choices-container');

  if (!inputTitle || !pollChoicesContainer) return;

  const title = (inputTitle.value || '').trim();
  if (!title) {
    showToast('Bitte gib einen Umfrage-Titel ein.', 'error');
    return;
  }

  const choiceInputs = pollChoicesContainer.querySelectorAll('.input-poll-choice');
  const choices = [];
  choiceInputs.forEach(inp => {
    const val = (inp.value || '').trim();
    if (val) choices.push(val);
  });

  if (choices.length < 2) {
    showToast('Eine Umfrage benötigt mindestens 2 Optionen.', 'error');
    return;
  }

  const duration = selectDuration ? (parseInt(selectDuration.value, 10) || 60) : 60;
  const channelPointsCost = selectPoints ? (parseInt(selectPoints.value, 10) || 0) : 0;
  const channelPointsVoting = channelPointsCost > 0;

  const chan = (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved';

  showToast('Starte Twitch-Poll...', 'info');

  try {
    const res = await ipcRenderer.invoke('polls:create', {
      title,
      choices,
      duration,
      channelPointsVoting,
      channelPointsPerVote: channelPointsCost,
      channel: chan
    });

    if (res && res.success) {
      pollsState.activePoll = res.poll;
      renderPollActiveSection(res.poll);
      showToast('🚀 Twitch-Umfrage erfolgreich gestartet!', 'success');
    } else {
      const err = res && res.error ? res.error : 'Poll konnte nicht gestartet werden';
      if (err.includes('Missing scope') || err.includes('channel:manage:polls')) {
        showToast('⚠️ Berechtigung fehlt: Bitte oben rechts auf dein Twitch-Profil klicken und kurz neu verbinden!', 'error');
      } else {
        showToast(`Fehler: ${err}`, 'error');
      }
    }
  } catch(e) {
    if (e.message.includes('Missing scope') || e.message.includes('channel:manage:polls')) {
      showToast('⚠️ Berechtigung fehlt: Bitte oben rechts auf dein Twitch-Profil klicken und kurz neu verbinden!', 'error');
    } else {
      showToast(`Fehler beim Starten: ${e.message}`, 'error');
    }
  }
}

async function saveCustomPollTemplateFromForm() {
  const inputTitle = document.getElementById('input-poll-title');
  const selectDuration = document.getElementById('select-poll-duration');
  const pollChoicesContainer = document.getElementById('poll-choices-container');

  if (!inputTitle || !pollChoicesContainer) return;

  const title = (inputTitle.value || '').trim();
  if (!title) {
    showToast('Bitte erst einen Titel eingeben.', 'error');
    return;
  }

  const choiceInputs = pollChoicesContainer.querySelectorAll('.input-poll-choice');
  const choices = [];
  choiceInputs.forEach(inp => {
    const val = (inp.value || '').trim();
    if (val) choices.push(val);
  });

  if (choices.length < 2) {
    showToast('Mindestens 2 Optionen für Vorlage erforderlich.', 'error');
    return;
  }

  const duration = selectDuration ? (parseInt(selectDuration.value, 10) || 60) : 60;

  const newTmpl = {
    id: 'tmpl_' + Date.now(),
    title,
    choices,
    duration,
    isPreset: false
  };

  pollsState.templates.push(newTmpl);
  await ipcRenderer.invoke('polls:save-templates', pollsState.templates);
  renderSavedPollTemplates();
  showToast(`Vorlage „${title}“ gespeichert! 💾`, 'success');
}

function renderSavedPollTemplates() {
  const container = document.getElementById('poll-saved-templates-list');
  if (!container) return;

  const customTemplates = pollsState.templates.filter(t => !t.isPreset);
  if (customTemplates.length === 0) {
    container.innerHTML = `
      <div style="color:var(--text-muted); font-size:0.8rem; text-align:center; padding:10px;">
        Noch keine eigenen Vorlagen gespeichert.
      </div>
    `;
    return;
  }

  container.innerHTML = '';
  customTemplates.forEach(t => {
    const item = document.createElement('div');
    item.className = 'poll-saved-item';
    item.innerHTML = `
      <div style="flex:1; min-width:0; padding-right:8px;">
        <strong style="display:block; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(t.title)}</strong>
        <span style="color:var(--text-muted); font-size:0.72rem;">${t.choices.length} Optionen • ${t.duration}s</span>
      </div>
      <div style="display:flex; gap:6px;">
        <button class="btn btn-xs btn-primary btn-load-tmpl" title="Vorlage in Ersteller laden">Laden ➔</button>
        <button class="btn btn-xs btn-secondary btn-del-tmpl" title="Vorlage löschen">🗑️</button>
      </div>
    `;

    item.querySelector('.btn-load-tmpl').addEventListener('click', () => {
      const inputTitle = document.getElementById('input-poll-title');
      const lblPollTitleCount = document.getElementById('lbl-poll-title-count');
      const selectDuration = document.getElementById('select-poll-duration');
      const pollChoicesContainer = document.getElementById('poll-choices-container');

      if (inputTitle) inputTitle.value = t.title;
      if (lblPollTitleCount) lblPollTitleCount.textContent = `${t.title.length}/60`;
      if (selectDuration) selectDuration.value = String(t.duration || 60);

      if (pollChoicesContainer) {
        pollChoicesContainer.innerHTML = '';
        t.choices.forEach((c, idx) => {
          const row = document.createElement('div');
          row.className = 'poll-choice-row';
          const canRemove = idx >= 2;
          row.innerHTML = `
            <span class="choice-num">${idx + 1}</span>
            <input type="text" class="input-poll-choice" placeholder="Option ${idx + 1}" maxlength="25" value="${escapeHtml(c)}">
            ${canRemove ? '<button class="btn-remove-choice" title="Option entfernen">✕</button>' : ''}
          `;
          if (canRemove) {
            row.querySelector('.btn-remove-choice').addEventListener('click', () => {
              row.remove();
              updatePollChoiceNumbers();
            });
          }
          pollChoicesContainer.appendChild(row);
        });
      }
      showToast(`Vorlage „${t.title}“ geladen!`, 'info');
    });

    item.querySelector('.btn-del-tmpl').addEventListener('click', async () => {
      pollsState.templates = pollsState.templates.filter(x => x.id !== t.id);
      await ipcRenderer.invoke('polls:save-templates', pollsState.templates);
      renderSavedPollTemplates();
      showToast('Vorlage gelöscht.', 'info');
    });

    container.appendChild(item);
  });
}

// =========================================================
// TWITCH PREDICTIONS (VORHERSAGEN) LOGIC
// =========================================================

function setupPollsAndPredictionsListeners() {
  // Tab Switcher between Polls and Predictions
  const tabPolls = document.getElementById('tab-nav-polls');
  const tabPredictions = document.getElementById('tab-nav-predictions');
  const panelPolls = document.getElementById('panel-mode-polls');
  const panelPredictions = document.getElementById('panel-mode-predictions');

  if (tabPolls && tabPredictions && panelPolls && panelPredictions) {
    tabPolls.addEventListener('click', () => {
      tabPolls.classList.add('active');
      tabPredictions.classList.remove('active');
      panelPolls.classList.remove('hidden');
      panelPredictions.classList.add('hidden');
    });

    tabPredictions.addEventListener('click', () => {
      tabPredictions.classList.add('active');
      tabPolls.classList.remove('active');
      panelPredictions.classList.remove('hidden');
      panelPolls.classList.add('hidden');
    });
  }

  // Prediction Form Elements
  const inputPredTitle = document.getElementById('input-prediction-title');
  const lblPredTitleCount = document.getElementById('lbl-prediction-title-count');
  const predChoicesContainer = document.getElementById('prediction-choices-container');
  const btnAddPredChoice = document.getElementById('btn-add-prediction-choice');
  const btnStartPrediction = document.getElementById('btn-start-twitch-prediction');
  const btnSavePredTemplate = document.getElementById('btn-save-custom-prediction-template');

  if (inputPredTitle && lblPredTitleCount) {
    inputPredTitle.addEventListener('input', () => {
      lblPredTitleCount.textContent = `${inputPredTitle.value.length}/120`;
    });
  }

  if (btnAddPredChoice && predChoicesContainer) {
    btnAddPredChoice.addEventListener('click', () => {
      const currentChoices = predChoicesContainer.querySelectorAll('.poll-choice-row');
      if (currentChoices.length >= 4) {
        showToast('Maximal 4 Auswahlmöglichkeiten für Vorhersagen erlaubt.', 'info');
        return;
      }
      const nextNum = currentChoices.length + 1;
      const row = document.createElement('div');
      row.className = 'poll-choice-row';
      const badgeColor = nextNum === 3 ? '#10b981' : '#f59e0b';
      row.innerHTML = `
        <span class="choice-num" style="background:${badgeColor}; color:#fff; border-radius:4px; font-size:0.7rem; padding:2px 4px;">${nextNum}</span>
        <input type="text" class="input-prediction-choice" placeholder="Option ${nextNum} (max. 25 Z.)" maxlength="25">
        <button class="btn-remove-choice" title="Option entfernen">✕</button>
      `;
      row.querySelector('.btn-remove-choice').addEventListener('click', () => {
        row.remove();
        updatePredictionChoiceNumbers();
      });
      predChoicesContainer.appendChild(row);
      const inp = row.querySelector('.input-prediction-choice');
      if (inp) inp.focus();
    });
  }

  // Preset Buttons for Predictions
  const predPresetBtns = document.querySelectorAll('[data-prediction-preset]');
  predPresetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const pKey = btn.getAttribute('data-prediction-preset');
      applyPredictionPreset(pKey);
    });
  });

  if (btnStartPrediction) {
    btnStartPrediction.addEventListener('click', async () => {
      await startTwitchPredictionFromForm();
    });
  }

  if (btnSavePredTemplate) {
    btnSavePredTemplate.addEventListener('click', async () => {
      await saveCustomPredictionTemplateFromForm();
    });
  }
}

function updatePredictionChoiceNumbers() {
  const container = document.getElementById('prediction-choices-container');
  if (!container) return;
  const rows = container.querySelectorAll('.poll-choice-row');
  const colors = ['#3b82f6', '#ec4899', '#10b981', '#f59e0b'];
  rows.forEach((r, idx) => {
    const numSpan = r.querySelector('.choice-num');
    if (numSpan) {
      numSpan.textContent = String(idx + 1);
      numSpan.style.background = colors[idx % colors.length];
    }
  });
}

function applyPredictionPreset(presetKey) {
  const inputTitle = document.getElementById('input-prediction-title');
  const lblTitleCount = document.getElementById('lbl-prediction-title-count');
  const choicesContainer = document.getElementById('prediction-choices-container');
  const selectDuration = document.getElementById('select-prediction-duration');

  if (!inputTitle || !choicesContainer) return;

  let title = '';
  let choices = [];
  let duration = '120';

  if (presetKey === 'preset_prediction_drag') {
    title = 'Wird der Kopf beim ersten Zug drücken?';
    choices = ['Ja 🔥', 'Nein 💨'];
    duration = '120';
  } else if (presetKey === 'preset_prediction_taste') {
    title = 'Bewertung: Schmeckt der Tabak 10/10?';
    choices = ['Safe 10/10 🌟', 'Nope 🤢'];
    duration = '120';
  } else if (presetKey === 'preset_prediction_coal') {
    title = 'Fällt heute im Stream eine Kohle runter?';
    choices = ['Ja 💥', 'Nein 🪵'];
    duration = '300';
  } else if (presetKey === 'preset_prediction_speed') {
    title = 'Schafft Marvin das Setup in unter 5 Minuten?';
    choices = ['Ja ⚡', 'Nein 🐢'];
    duration = '180';
  }

  inputTitle.value = title;
  if (lblTitleCount) lblTitleCount.textContent = `${title.length}/120`;
  if (selectDuration) selectDuration.value = duration;

  choicesContainer.innerHTML = '';
  const colors = ['#3b82f6', '#ec4899', '#10b981', '#f59e0b'];
  choices.forEach((c, idx) => {
    const row = document.createElement('div');
    row.className = 'poll-choice-row';
    const canRemove = idx >= 2;
    row.innerHTML = `
      <span class="choice-num" style="background:${colors[idx]}; color:#fff; border-radius:4px; font-size:0.7rem; padding:2px 4px;">${idx + 1}</span>
      <input type="text" class="input-prediction-choice" placeholder="Option ${idx + 1}" maxlength="25" value="${c}">
      ${canRemove ? '<button class="btn-remove-choice" title="Option entfernen">✕</button>' : ''}
    `;
    if (canRemove) {
      row.querySelector('.btn-remove-choice').addEventListener('click', () => {
        row.remove();
        updatePredictionChoiceNumbers();
      });
    }
    choicesContainer.appendChild(row);
  });

  showToast(`Vorhersage-Vorlage „${title}“ geladen!`, 'info');
}

async function startTwitchPredictionFromForm() {
  const inputTitle = document.getElementById('input-prediction-title');
  const selectDuration = document.getElementById('select-prediction-duration');
  const choicesContainer = document.getElementById('prediction-choices-container');

  if (!inputTitle || !choicesContainer) return;

  const title = (inputTitle.value || '').trim();
  if (!title) {
    showToast('Bitte gib einen Vorhersage-Titel ein.', 'error');
    return;
  }

  const choiceInputs = choicesContainer.querySelectorAll('.input-prediction-choice');
  const outcomes = [];
  choiceInputs.forEach(inp => {
    const val = (inp.value || '').trim();
    if (val) outcomes.push(val);
  });

  if (outcomes.length < 2) {
    showToast('Eine Vorhersage benötigt mindestens 2 Optionen.', 'error');
    return;
  }

  const duration = selectDuration ? (parseInt(selectDuration.value, 10) || 120) : 120;
  const chan = (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved';

  showToast('Starte Twitch-Vorhersage...', 'info');

  try {
    const res = await ipcRenderer.invoke('predictions:create', {
      title,
      outcomes,
      duration,
      channel: chan
    });

    if (res && res.success) {
      predictionsState.activePrediction = res.prediction;
      renderPredictionActiveSection(res.prediction);
      showToast('🔮 Vorhersage auf Twitch gestartet!', 'success');
    } else {
      const err = res && res.error ? res.error : 'Vorhersage konnte nicht gestartet werden';
      showToast(`Fehler: ${err}`, 'error');
    }
  } catch(e) {
    showToast(`Fehler beim Starten: ${e.message}`, 'error');
  }
}

async function saveCustomPredictionTemplateFromForm() {
  const inputTitle = document.getElementById('input-prediction-title');
  const selectDuration = document.getElementById('select-prediction-duration');
  const choicesContainer = document.getElementById('prediction-choices-container');

  if (!inputTitle || !choicesContainer) return;

  const title = (inputTitle.value || '').trim();
  if (!title) {
    showToast('Bitte erst einen Titel eingeben.', 'error');
    return;
  }

  const choiceInputs = choicesContainer.querySelectorAll('.input-prediction-choice');
  const outcomes = [];
  choiceInputs.forEach(inp => {
    const val = (inp.value || '').trim();
    if (val) outcomes.push(val);
  });

  if (outcomes.length < 2) {
    showToast('Mindestens 2 Optionen für Vorhersage erforderlich.', 'error');
    return;
  }

  const duration = selectDuration ? (parseInt(selectDuration.value, 10) || 120) : 120;

  const newTmpl = {
    id: 'pred_tmpl_' + Date.now(),
    title,
    choices: outcomes,
    duration,
    isPreset: false
  };

  if (!predictionsState.templates) predictionsState.templates = [];
  predictionsState.templates.push(newTmpl);
  try {
    localStorage.setItem('swg_prediction_templates', JSON.stringify(predictionsState.templates));
  } catch(e) {}
  renderSavedPredictionTemplates();
  showToast(`Vorhersage-Vorlage „${title}“ gespeichert! 💾`, 'success');
}

function renderSavedPredictionTemplates() {
  const container = document.getElementById('prediction-saved-templates-list');
  if (!container) return;

  if (!predictionsState.templates || predictionsState.templates.length === 0) {
    try {
      const stored = localStorage.getItem('swg_prediction_templates');
      if (stored) predictionsState.templates = JSON.parse(stored);
    } catch(e) {}
  }

  const customTemplates = (predictionsState.templates || []).filter(t => !t.isPreset);
  if (customTemplates.length === 0) {
    container.innerHTML = `
      <div style="color:var(--text-muted); font-size:0.8rem; text-align:center; padding:10px;">
        Noch keine eigenen Vorhersagen gespeichert.
      </div>
    `;
    return;
  }

  container.innerHTML = '';
  customTemplates.forEach(t => {
    const item = document.createElement('div');
    item.className = 'poll-saved-item';
    item.innerHTML = `
      <div style="flex:1; min-width:0; padding-right:8px;">
        <strong style="display:block; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(t.title)}</strong>
        <span style="color:var(--text-muted); font-size:0.72rem;">${t.choices.length} Ausgänge • ${t.duration}s</span>
      </div>
      <div style="display:flex; gap:6px;">
        <button class="btn btn-xs btn-primary btn-load-tmpl" title="In Ersteller laden">Laden ➔</button>
        <button class="btn btn-xs btn-secondary btn-del-tmpl" title="Löschen">🗑️</button>
      </div>
    `;

    item.querySelector('.btn-load-tmpl').addEventListener('click', () => {
      const inputTitle = document.getElementById('input-prediction-title');
      const lblTitleCount = document.getElementById('lbl-prediction-title-count');
      const selectDuration = document.getElementById('select-prediction-duration');
      const choicesContainer = document.getElementById('prediction-choices-container');

      if (inputTitle) inputTitle.value = t.title;
      if (lblTitleCount) lblTitleCount.textContent = `${t.title.length}/120`;
      if (selectDuration) selectDuration.value = String(t.duration || 120);

      if (choicesContainer) {
        choicesContainer.innerHTML = '';
        const colors = ['#3b82f6', '#ec4899', '#10b981', '#f59e0b'];
        t.choices.forEach((c, idx) => {
          const row = document.createElement('div');
          row.className = 'poll-choice-row';
          const canRemove = idx >= 2;
          row.innerHTML = `
            <span class="choice-num" style="background:${colors[idx % colors.length]}; color:#fff; border-radius:4px; font-size:0.7rem; padding:2px 4px;">${idx + 1}</span>
            <input type="text" class="input-prediction-choice" placeholder="Option ${idx + 1}" maxlength="25" value="${escapeHtml(c)}">
            ${canRemove ? '<button class="btn-remove-choice" title="Option entfernen">✕</button>' : ''}
          `;
          if (canRemove) {
            row.querySelector('.btn-remove-choice').addEventListener('click', () => {
              row.remove();
              updatePredictionChoiceNumbers();
            });
          }
          choicesContainer.appendChild(row);
        });
      }
      showToast(`Vorhersage „${t.title}“ geladen!`, 'info');
    });

    item.querySelector('.btn-del-tmpl').addEventListener('click', () => {
      predictionsState.templates = predictionsState.templates.filter(x => x.id !== t.id);
      try {
        localStorage.setItem('swg_prediction_templates', JSON.stringify(predictionsState.templates));
      } catch(e) {}
      renderSavedPredictionTemplates();
      showToast('Vorlage gelöscht.', 'info');
    });

    container.appendChild(item);
  });
}

function renderPredictionActiveSection(pred) {
  const container = document.getElementById('prediction-live-content');
  const indicator = document.getElementById('prediction-live-indicator');
  if (!container || !indicator) return;

  if (!pred || pred.status === 'CANCELED' || pred.status === 'RESOLVED') {
    indicator.className = 'qna-status-badge offline';
    indicator.innerHTML = '<span class="status-dot"></span><span class="status-text">Keine aktiv</span>';
    container.innerHTML = `
      <div class="poll-empty-state">
        <span class="empty-icon">🔮</span>
        <p>Aktuell läuft keine Vorhersage im Twitch-Kanal.</p>
        <span class="empty-hint">Wähle eine Vorlage unten oder erstelle rechts eine neue Vorhersage.</span>
      </div>
    `;
    return;
  }

  const isLocked = (pred.status === 'LOCKED');
  const isActive = (pred.status === 'ACTIVE');

  indicator.className = `qna-status-badge ${isActive ? 'live' : 'closed'}`;
  indicator.innerHTML = `<span class="status-dot"></span><span class="status-text">${isActive ? 'Live (Einsätze offen)' : 'Gesperrt (Auswertung)'}</span>`;

  const outcomes = pred.outcomes || [];
  const totalPoints = outcomes.reduce((sum, o) => sum + (o.channel_points || 0), 0);
  const totalUsers = outcomes.reduce((sum, o) => sum + (o.users || 0), 0);

  let outcomesHtml = `<div class="prediction-live-outcomes-grid">`;
  outcomes.forEach((o, idx) => {
    const isWinner = (pred.winning_outcome_id === o.id);
    const colorClass = (idx === 0) ? 'blue' : (idx === 1 ? 'pink' : '');
    const pts = o.channel_points || 0;
    const pct = totalPoints > 0 ? Math.round((pts / totalPoints) * 100) : 0;
    outcomesHtml += `
      <div class="prediction-outcome-box ${colorClass} ${isWinner ? 'winner' : ''}">
        <div class="prediction-outcome-header ${colorClass}">
          <span>${escapeHtml(o.title)}</span>
          <span>${pct}%</span>
        </div>
        <div class="prediction-outcome-stats">
          <strong>${pts.toLocaleString()}</strong> Punkte • <strong>${o.users || 0}</strong> Einsätze
        </div>
      </div>
    `;
  });
  outcomesHtml += `</div>`;

  let actionButtonsHtml = `<div class="prediction-resolve-actions">`;
  if (isActive) {
    actionButtonsHtml += `
      <button id="btn-lock-prediction" class="btn btn-sm btn-secondary" title="Einsätze vorzeitig sperren">
        🔒 Einsätze sperren
      </button>
    `;
  }
  outcomes.forEach(o => {
    actionButtonsHtml += `
      <button class="btn btn-sm btn-primary btn-resolve-prediction" data-outcome-id="${o.id}">
        🏆 „${escapeHtml(o.title)}“ als Gewinner
      </button>
    `;
  });
  actionButtonsHtml += `
    <button id="btn-cancel-prediction" class="btn btn-sm btn-secondary" style="color:#ef4444; border-color:rgba(239,68,68,0.4);" title="Vorhersage abbrechen und alle Kanalpunkte zurückerstatten">
      ✕ Abbrechen (Refund)
    </button>
  </div>`;

  container.innerHTML = `
    <div style="margin-bottom:8px;">
      <h4 style="font-size:1.05rem; color:#fff; margin-bottom:4px;">„${escapeHtml(pred.title)}“</h4>
      <div style="font-size:0.75rem; color:var(--text-muted);">
        Gesamt: <strong>${totalPoints.toLocaleString()}</strong> Punkte von <strong>${totalUsers}</strong> Zuschauern
      </div>
    </div>
    ${outcomesHtml}
    ${actionButtonsHtml}
  `;

  // Attach button handlers
  const btnLock = container.querySelector('#btn-lock-prediction');
  if (btnLock) {
    btnLock.addEventListener('click', async () => {
      const chan = (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved';
      showToast('Sperre Einsätze...', 'info');
      await ipcRenderer.invoke('predictions:end', { predictionId: pred.id, status: 'LOCKED', channel: chan });
      const updated = await ipcRenderer.invoke('predictions:get-active', chan);
      if (updated && updated.prediction) renderPredictionActiveSection(updated.prediction);
      showToast('Einsätze für Vorhersage gesperrt! 🔒', 'success');
    });
  }

  const btnCancel = container.querySelector('#btn-cancel-prediction');
  if (btnCancel) {
    btnCancel.addEventListener('click', async () => {
      if (confirm('Möchtest du diese Vorhersage wirklich abbrechen? Alle gesetzten Punkte werden den Zuschauern erstattet.')) {
        const chan = (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved';
        await ipcRenderer.invoke('predictions:end', { predictionId: pred.id, status: 'CANCELED', channel: chan });
        predictionsState.activePrediction = null;
        renderPredictionActiveSection(null);
        showToast('Vorhersage abgebrochen & Punkte erstattet.', 'info');
      }
    });
  }

  container.querySelectorAll('.btn-resolve-prediction').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const winId = e.currentTarget.getAttribute('data-outcome-id');
      const winOutcome = outcomes.find(x => x.id === winId);
      const winTitle = winOutcome ? winOutcome.title : 'Option';
      if (confirm(`Möchtest du „${winTitle}“ als Gewinner-Ausgang auflösen und die Gewinne an die Zuschauer auszahlen?`)) {
        const chan = (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved';
        showToast('Zahle Gewinne aus...', 'info');
        await ipcRenderer.invoke('predictions:end', { predictionId: pred.id, status: 'RESOLVED', winningOutcomeId: winId, channel: chan });
        predictionsState.activePrediction = null;
        renderPredictionActiveSection(null);
        showToast(`🏆 Gewinne für „${winTitle}“ erfolgreich ausgezahlt!`, 'success');
      }
    });
  });
}

// =========================================================
// STATS & KOHLE-TIMER LOGIC (VIEW 6)
// =========================================================

let statsState = {
  isRunning: false,
  sessionStartTime: null,
  sessionElapsedSeconds: 0,
  coalStartTime: null,
  coalElapsedSeconds: 0,
  coalRotations: 0,
  headCountToday: 1,
  soundEnabled: true,
  sessions: [],
  intervalId: null,
  lastAlertPhase: null
};

function formatTimerClock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = Math.floor(s % 60);
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatCoalClock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const mins = Math.floor(s / 60);
  const secs = Math.floor(s % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function playCoalAlertSound() {
  if (!statsState.soundEnabled) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  } catch(e) {}
}

function updateStatsTimerTick() {
  if (!statsState.isRunning) return;

  const now = Date.now();
  if (statsState.sessionStartTime) {
    statsState.sessionElapsedSeconds = Math.floor((now - statsState.sessionStartTime) / 1000);
  }
  if (statsState.coalStartTime) {
    statsState.coalElapsedSeconds = Math.floor((now - statsState.coalStartTime) / 1000);
  }

  // Update digital displays
  const lblSession = document.getElementById('lbl-session-time');
  const lblCoal = document.getElementById('lbl-coal-time');
  if (lblSession) lblSession.textContent = formatTimerClock(statsState.sessionElapsedSeconds);
  if (lblCoal) lblCoal.textContent = formatCoalClock(statsState.coalElapsedSeconds);

  // Update Coal Phase & Progress Bar
  const coalSecs = statsState.coalElapsedSeconds;
  const progressBar = document.getElementById('bar-coal-progress');
  const lblPhaseText = document.getElementById('lbl-timer-phase-text');

  let pct = 0;
  if (coalSecs < 420) {
    // 0 - 7 Min: Anrauchen
    pct = (coalSecs / 1800) * 100;
    if (lblPhaseText) lblPhaseText.textContent = 'Phase 1: Anrauchen 🔥';
  } else if (coalSecs < 1800) {
    // 7 - 30 Min: Kohle brennt gut
    pct = (coalSecs / 1800) * 100;
    if (lblPhaseText) lblPhaseText.textContent = 'Phase 2: Kohle brennt optimal 💨';
  } else if (coalSecs < 3600) {
    // 30 - 60 Min: Kohle 2. Hälfte / Neue Kohlen
    pct = 50 + ((coalSecs - 1800) / 1800) * 50;
    if (lblPhaseText) lblPhaseText.textContent = 'Phase 3: Zeit zum Wenden / Neue Kohlen 🪵';
    if (coalSecs === 1800 && statsState.lastAlertPhase !== 'rotate') {
      statsState.lastAlertPhase = 'rotate';
      playCoalAlertSound();
      showToast('🪵 Kohle-Erinnerung: Zeit zum Wenden / Abaschen!', 'warning');
    }
  } else {
    // > 60 Min: Ende / Neuer Kopf
    pct = 100;
    if (lblPhaseText) lblPhaseText.textContent = 'Phase 4: Kopf ausrauchen oder neu bauen 🏁';
    if (coalSecs === 3600 && statsState.lastAlertPhase !== 'finish') {
      statsState.lastAlertPhase = 'finish';
      playCoalAlertSound();
      showToast('🔥 Kohle-Erinnerung: Kopf raucht seit 60 Min!', 'info');
    }
  }

  if (progressBar) progressBar.style.width = `${Math.min(100, Math.max(0, pct))}%`;
}

function extractCurrentSetupFromState() {
  const p = state.persons && state.persons[0];
  if (!p) return null;

  const tobaccos = [];
  const rawTobaccos = p.tobaccos || [];
  for (let t of rawTobaccos) {
    const clean = (t || '').trim();
    if (clean) tobaccos.push(clean);
  }
  let tobStr = tobaccos.join(' & ');
  if (!tobStr && p.tobacco) tobStr = (p.tobacco || '').trim();

  return {
    tobacco: tobStr,
    bowl: (p.bowl || '').trim(),
    pipe: (p.pipe || '').trim(),
    hmd: (p.hmd || '').trim(),
    person: (p.name || '').trim() || 'Marvin'
  };
}

let lastKnownSetupSignature = '';

function checkAndAutoStartHeadSession(force = false) {
  const currentSetup = extractCurrentSetupFromState();
  if (!currentSetup || !currentSetup.tobacco) return;

  const sig = `${currentSetup.tobacco}__${currentSetup.bowl}__${currentSetup.hmd}__${currentSetup.pipe}`.toLowerCase();
  if (!force && sig === lastKnownSetupSignature) {
    return;
  }

  // If there was an active session running for >= 2 minutes (120s), auto-archive it into history!
  if (statsState.isRunning && statsState.sessionElapsedSeconds >= 120 && statsState.activeSetup && statsState.activeSetup.tobacco && sig !== lastKnownSetupSignature) {
    autoArchiveFinishedSession(statsState.activeSetup, statsState.sessionElapsedSeconds, statsState.coalRotations, statsState.sessionStartTime);
  }

  lastKnownSetupSignature = sig;
  statsState.activeSetup = currentSetup;

  // Calculate today's finished heads
  const todayStr = new Date().toISOString().split('T')[0];
  const finishedToday = (statsState.sessions || []).filter(s => {
    const d = s.ended_at ? s.ended_at.split('T')[0] : (s.endedAt ? s.endedAt.split('T')[0] : '');
    return d === todayStr;
  }).length;
  statsState.headCountToday = finishedToday + 1;

  // Update Compact Bottom Bar Head Info
  const lblTitle = document.getElementById('lbl-active-session-title');
  const lblSub = document.getElementById('lbl-active-session-sub');
  if (lblTitle) lblTitle.textContent = `🥣 Kopf #${statsState.headCountToday}: ${currentSetup.tobacco}`;
  if (lblSub) {
    const hardware = [currentSetup.bowl, currentSetup.hmd, currentSetup.pipe].filter(Boolean).join(' • ');
    lblSub.textContent = hardware || 'Aktiv im Stream';
  }

  // Automatically start timer for this new head!
  const now = Date.now();
  statsState.isRunning = true;
  statsState.sessionStartTime = now;
  statsState.sessionElapsedSeconds = 0;
  statsState.coalStartTime = now;
  statsState.coalElapsedSeconds = 0;
  statsState.coalRotations = 0;
  statsState.lastAlertPhase = null;

  if (!statsState.intervalId) {
    statsState.intervalId = setInterval(updateStatsTimerTick, 1000);
  }

  updateStatsTimerTick();

  const badge = document.getElementById('timer-live-badge');
  const lblStatus = document.getElementById('lbl-timer-status');
  if (badge) badge.className = 'qna-status-badge live';
  if (lblStatus) lblStatus.textContent = 'Raucht live';

  saveActiveTimerStateToBackend();
}

async function autoArchiveFinishedSession(setup, durationSecs, coalRotations, startTime) {
  try {
    const chan = (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved';
    const durMins = Math.max(1, Math.round(durationSecs / 60));
    const sessionObj = {
      id: 'sess_' + Date.now(),
      channel: chan,
      headNum: statsState.headCountToday,
      tobacco: setup.tobacco || 'Unbekannter Tabak',
      bowl: setup.bowl || '',
      hmd: setup.hmd || '',
      pipe: setup.pipe || '',
      person: setup.person || 'Marvin',
      durationMinutes: durMins,
      coalRotations: coalRotations || 0,
      rating: 0,
      notes: 'Automatisch archiviert',
      startedAt: startTime ? new Date(startTime).toISOString() : new Date().toISOString(),
      endedAt: new Date().toISOString()
    };
    await ipcRenderer.invoke('stats:save-session', sessionObj);
    await loadStatsState();
  } catch(e) {}
}

function resetActiveTimer() {
  statsState.isRunning = false;
  if (statsState.intervalId) {
    clearInterval(statsState.intervalId);
    statsState.intervalId = null;
  }
  statsState.sessionStartTime = null;
  statsState.sessionElapsedSeconds = 0;
  statsState.coalStartTime = null;
  statsState.coalElapsedSeconds = 0;
  statsState.coalRotations = 0;
  statsState.lastAlertPhase = null;

  const lblSession = document.getElementById('lbl-session-time');
  const lblCoal = document.getElementById('lbl-coal-time');
  const progressBar = document.getElementById('bar-coal-progress');
  const lblPhaseText = document.getElementById('lbl-timer-phase-text');
  const badge = document.getElementById('timer-live-badge');
  const lblStatus = document.getElementById('lbl-timer-status');
  const lblTitle = document.getElementById('lbl-active-session-title');
  const lblSub = document.getElementById('lbl-active-session-sub');

  if (lblSession) lblSession.textContent = '00:00:00';
  if (lblCoal) lblCoal.textContent = '00:00';
  if (progressBar) progressBar.style.width = '0%';
  if (lblPhaseText) lblPhaseText.textContent = 'Phase: Bereit zum Anrauchen 🔥';
  if (badge) badge.className = 'qna-status-badge offline';
  if (lblStatus) lblStatus.textContent = 'Gestoppt';
  if (lblTitle) lblTitle.textContent = 'Kein aktiver Kopf';
  if (lblSub) lblSub.textContent = 'Warte auf Setup im Generator...';

  saveActiveTimerStateToBackend();
}

function importCurrentGeneratorSetup() {
  const currentSetup = extractCurrentSetupFromState();
  if (currentSetup) {
    if (currentSetup.tobacco) document.getElementById('input-session-tobacco').value = currentSetup.tobacco;
    if (currentSetup.bowl) document.getElementById('input-session-bowl').value = currentSetup.bowl;
    if (currentSetup.hmd) document.getElementById('input-session-hmd').value = currentSetup.hmd;
    if (currentSetup.pipe) document.getElementById('input-session-pipe').value = currentSetup.pipe;
    if (currentSetup.person) document.getElementById('input-session-person').value = currentSetup.person;
  }
}

async function saveActiveTimerStateToBackend() {
  try {
    const chan = (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved';
    const payload = {
      isRunning: statsState.isRunning,
      sessionStartTime: statsState.sessionStartTime,
      sessionElapsedSeconds: statsState.sessionElapsedSeconds,
      coalStartTime: statsState.coalStartTime,
      coalElapsedSeconds: statsState.coalElapsedSeconds,
      coalRotations: statsState.coalRotations,
      headCountToday: statsState.headCountToday,
      activeSetup: {
        tobacco: (document.getElementById('input-session-tobacco') ? document.getElementById('input-session-tobacco').value : ''),
        bowl: (document.getElementById('input-session-bowl') ? document.getElementById('input-session-bowl').value : ''),
        hmd: (document.getElementById('input-session-hmd') ? document.getElementById('input-session-hmd').value : ''),
        pipe: (document.getElementById('input-session-pipe') ? document.getElementById('input-session-pipe').value : ''),
        person: (document.getElementById('input-session-person') ? document.getElementById('input-session-person').value : 'Marvin'),
        notes: (document.getElementById('input-session-notes') ? document.getElementById('input-session-notes').value : '')
      },
      updatedAt: Date.now()
    };
    await ipcRenderer.invoke('stats:save-timer-state', { channel: chan, timerState: payload });
  } catch(e) {}
}

async function finishAndSaveHeadSession() {
  const chan = (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved';
  const inputTob = document.getElementById('input-session-tobacco');
  const inputBowl = document.getElementById('input-session-bowl');
  const inputHmd = document.getElementById('input-session-hmd');
  const inputPipe = document.getElementById('input-session-pipe');
  const inputPerson = document.getElementById('input-session-person');
  const selectRating = document.getElementById('select-modal-finish-rating');
  const inputFinishNotes = document.getElementById('input-modal-finish-notes');

  const durMins = Math.max(1, Math.round(statsState.sessionElapsedSeconds / 60));

  const sessionObj = {
    id: 'sess_' + Date.now(),
    channel: chan,
    headNum: statsState.headCountToday,
    tobacco: (inputTob ? inputTob.value.trim() : '') || 'Unbekannter Tabak',
    bowl: (inputBowl ? inputBowl.value.trim() : '') || '',
    hmd: (inputHmd ? inputHmd.value.trim() : '') || '',
    pipe: (inputPipe ? inputPipe.value.trim() : '') || '',
    person: (inputPerson ? inputPerson.value.trim() : '') || 'Marvin',
    durationMinutes: durMins,
    coalRotations: statsState.coalRotations,
    rating: selectRating ? (parseInt(selectRating.value, 10) || 0) : 0,
    notes: (inputFinishNotes ? inputFinishNotes.value.trim() : ''),
    startedAt: statsState.sessionStartTime ? new Date(statsState.sessionStartTime).toISOString() : new Date().toISOString(),
    endedAt: new Date().toISOString()
  };

  showToast('Speichere Session in Historie...', 'info');

  try {
    const res = await ipcRenderer.invoke('stats:save-session', sessionObj);
    if (res && res.success) {
      resetActiveTimer();

      // Clear setup inputs for next head
      if (inputTob) inputTob.value = '';
      if (inputFinishNotes) inputFinishNotes.value = '';
      const inputNotes = document.getElementById('input-session-notes');
      if (inputNotes) inputNotes.value = '';

      await loadStatsState();
      showToast(`🏁 Kopf #${sessionObj.headNum} (${sessionObj.tobacco}) erfolgreich gespeichert!`, 'success');
    }
  } catch(e) {
    showToast(`Fehler beim Speichern: ${e.message}`, 'error');
  }
}

function renderSessionsHistory(sessions) {
  const tbody = document.getElementById('sessions-history-tbody');
  if (!tbody) return;

  if (!sessions || sessions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-list-placeholder">Noch keine beendeten Köpfe in der Historie.</td></tr>';
    return;
  }

  // Group sessions by Day Date (YYYY-MM-DD)
  const groupsByDate = {};
  sessions.forEach(s => {
    const rawDate = s.ended_at || s.endedAt || s.started_at || s.startedAt || s.created_at || new Date().toISOString();
    const dateKey = rawDate.split('T')[0];
    if (!groupsByDate[dateKey]) groupsByDate[dateKey] = [];
    groupsByDate[dateKey].push(s);
  });

  const todayStr = new Date().toISOString().split('T')[0];
  const yesterdayDate = new Date(Date.now() - 86400000);
  const yesterdayStr = yesterdayDate.toISOString().split('T')[0];

  let html = '';
  const sortedDates = Object.keys(groupsByDate).sort((a, b) => b.localeCompare(a));

  sortedDates.forEach(dateKey => {
    const daySessions = groupsByDate[dateKey];
    let dayLabel = dateKey;
    if (dateKey === todayStr) {
      dayLabel = `📅 Heute (${new Date(dateKey + 'T12:00:00').toLocaleDateString('de-DE')})`;
    } else if (dateKey === yesterdayStr) {
      dayLabel = `📅 Gestern (${new Date(dateKey + 'T12:00:00').toLocaleDateString('de-DE')})`;
    } else {
      dayLabel = `📅 ${new Date(dateKey + 'T12:00:00').toLocaleDateString('de-DE')}`;
    }

    const totalDayMins = daySessions.reduce((sum, s) => sum + (s.duration_minutes || s.durationMinutes || 0), 0);
    const dayHours = Math.floor(totalDayMins / 60);
    const dayMins = totalDayMins % 60;
    const timeDisplay = dayHours > 0 ? `${dayHours}h ${dayMins}m` : `${dayMins} Min`;

    html += `
      <tr class="history-day-header-row" style="background: rgba(124, 58, 237, 0.15); border-top: 1px solid rgba(124, 58, 237, 0.35);">
        <td colspan="8" style="padding: 8px 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <strong style="color: #c4b5fd; font-size: 0.88rem;">${dayLabel}</strong>
            <span style="font-size: 0.76rem; color: #a78bfa; font-weight: 700;">${daySessions.length} ${daySessions.length === 1 ? 'Kopf' : 'Köpfe'} • Gesamt ${timeDisplay}</span>
          </div>
        </td>
      </tr>
    `;

    daySessions.forEach(s => {
      const timeStr = s.ended_at ? new Date(s.ended_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (s.endedAt ? new Date(s.endedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-');
      const tobacco = s.tobacco || '-';
      const bowlHmd = [s.bowl, s.hmd].filter(Boolean).join(' • ') || '-';
      const dur = s.duration_minutes || s.durationMinutes || 0;
      const coals = s.coal_rotations || s.coalRotations || 0;
      const rating = s.rating ? `🌟 ${s.rating}/10` : '-';
      const headNum = s.head_num || s.headNum || 1;

      html += `
        <tr>
          <td><strong style="color:var(--accent-cyan);">#${headNum}</strong></td>
          <td style="color:var(--text-muted); font-size:0.8rem;">${timeStr}</td>
          <td><strong style="color:#fff;">${escapeHtml(tobacco)}</strong></td>
          <td style="color:var(--text-secondary); font-size:0.82rem;">${escapeHtml(bowlHmd)}</td>
          <td><span style="background:rgba(0,240,255,0.1); color:var(--accent-cyan); padding:2px 6px; border-radius:4px; font-size:0.78rem; font-weight:700;">⏱️ ${dur} Min</span></td>
          <td style="font-size:0.8rem; color:var(--text-muted);">🪵 ${coals}x</td>
          <td><strong style="color:#fbbf24; font-size:0.82rem;">${rating}</strong></td>
          <td style="text-align:right;">
            <button class="btn btn-xs btn-secondary btn-del-session" data-id="${s.id}" title="Session löschen">🗑️</button>
          </td>
        </tr>
      `;
    });
  });

  tbody.innerHTML = html;

  tbody.querySelectorAll('.btn-del-session').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      if (confirm('Möchtest du diese gerauchte Session wirklich aus der Historie löschen?')) {
        await ipcRenderer.invoke('stats:delete-session', id);
        await loadStatsState();
        showToast('Session gelöscht.', 'info');
      }
    });
  });
}

function renderStatsAnalytics(sessions) {
  if (!sessions) sessions = [];

  const kpiTotalHeads = document.getElementById('kpi-total-heads');
  const kpiAvgDuration = document.getElementById('kpi-avg-duration');
  const kpiAvgRating = document.getElementById('kpi-avg-rating');
  const kpiTotalCoals = document.getElementById('kpi-total-coals');

  const containerTobacco = document.getElementById('analytics-top-tobacco');
  const containerHardware = document.getElementById('analytics-top-hardware');

  const totalCount = sessions.length;
  if (kpiTotalHeads) kpiTotalHeads.textContent = String(totalCount);

  let sumDuration = 0;
  let sumCoals = 0;
  let ratingCount = 0;
  let sumRating = 0;

  const tobaccoCounts = {};
  const hardwareCounts = {};

  sessions.forEach(s => {
    const dur = s.duration_minutes || s.durationMinutes || 0;
    const coals = s.coal_rotations || s.coalRotations || 0;
    const r = s.rating || 0;
    const tob = (s.tobacco || '').trim();
    const bowl = (s.bowl || '').trim();
    const hmd = (s.hmd || '').trim();

    sumDuration += dur;
    sumCoals += coals;
    if (r > 0) {
      sumRating += r;
      ratingCount++;
    }

    if (tob && tob !== 'Unbekannter Tabak') {
      tobaccoCounts[tob] = (tobaccoCounts[tob] || 0) + 1;
    }

    if (bowl) {
      hardwareCounts[bowl] = (hardwareCounts[bowl] || 0) + 1;
    }
    if (hmd) {
      hardwareCounts[hmd] = (hardwareCounts[hmd] || 0) + 1;
    }
  });

  const avgDur = totalCount > 0 ? Math.round(sumDuration / totalCount) : 0;
  if (kpiAvgDuration) kpiAvgDuration.textContent = `${avgDur} Min`;

  const avgRat = ratingCount > 0 ? (sumRating / ratingCount).toFixed(1) : '-';
  if (kpiAvgRating) kpiAvgRating.textContent = avgRat !== '-' ? `🌟 ${avgRat} / 10` : '- / 10';

  if (kpiTotalCoals) kpiTotalCoals.textContent = String(sumCoals);

  // Top 5 Tobacco
  if (containerTobacco) {
    const sortedTob = Object.entries(tobaccoCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (sortedTob.length === 0) {
      containerTobacco.innerHTML = '<div style="color:var(--text-muted); font-size:0.8rem; text-align:center; padding:12px;">Noch keine Tabakdaten erfasst.</div>';
    } else {
      const maxCount = sortedTob[0][1] || 1;
      let html = '';
      sortedTob.forEach(([name, count], idx) => {
        const pct = Math.round((count / maxCount) * 100);
        const rankClass = idx === 0 ? 'rank-1' : (idx === 1 ? 'rank-2' : (idx === 2 ? 'rank-3' : 'rank-other'));
        html += `
          <div class="ranking-item">
            <div class="ranking-badge ${rankClass}">#${idx + 1}</div>
            <div class="ranking-info">
              <div class="ranking-title">${escapeHtml(name)}</div>
              <div class="ranking-bar-track">
                <div class="ranking-bar-fill" style="width: ${pct}%;"></div>
              </div>
            </div>
            <div class="ranking-count">${count}x geraucht</div>
          </div>
        `;
      });
      containerTobacco.innerHTML = html;
    }
  }

  // Top 5 Hardware
  if (containerHardware) {
    const sortedHw = Object.entries(hardwareCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (sortedHw.length === 0) {
      containerHardware.innerHTML = '<div style="color:var(--text-muted); font-size:0.8rem; text-align:center; padding:12px;">Noch keine Hardware-Daten erfasst.</div>';
    } else {
      const maxCount = sortedHw[0][1] || 1;
      let html = '';
      sortedHw.forEach(([name, count], idx) => {
        const pct = Math.round((count / maxCount) * 100);
        const rankClass = idx === 0 ? 'rank-1' : (idx === 1 ? 'rank-2' : (idx === 2 ? 'rank-3' : 'rank-other'));
        html += `
          <div class="ranking-item">
            <div class="ranking-badge ${rankClass}">#${idx + 1}</div>
            <div class="ranking-info">
              <div class="ranking-title">${escapeHtml(name)}</div>
              <div class="ranking-bar-track">
                <div class="ranking-bar-fill" style="width: ${pct}%;"></div>
              </div>
            </div>
            <div class="ranking-count">${count}x genutzt</div>
          </div>
        `;
      });
      containerHardware.innerHTML = html;
    }
  }
}

function copyStreamSummaryToChat() {
  const sessions = statsState.sessions || [];
  if (sessions.length === 0) {
    showToast('Noch keine Köpfe in der heutigen Historie.', 'info');
    return;
  }

  const lines = [`💨 ShishaWG Stream-Köpfe heute (${sessions.length} Gesamt):`];
  sessions.slice(0, 6).forEach(s => {
    const headNum = s.head_num || s.headNum || 1;
    const tob = s.tobacco || 'Tabak';
    const dur = s.duration_minutes || s.durationMinutes || 0;
    const rating = s.rating ? `[${s.rating}/10]` : '';
    lines.push(`• Kopf #${headNum}: ${tob} (${dur} Min) ${rating}`);
  });

  const text = lines.join(' ');
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('📋 Stream-Zusammenfassung in die Zwischenablage kopiert!', 'success');
    });
  }

  // Send directly to chat if twitchService is connected
  if (btnSendChat) {
    const inputGlobalExtra = document.getElementById('input-global-extra');
    if (inputGlobalExtra) inputGlobalExtra.value = text;
  }
}

async function loadStatsState() {
  try {
    const chan = (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved';
    
    // Load Sessions
    const res = await ipcRenderer.invoke('stats:get-sessions', chan);
    if (res && res.success && Array.isArray(res.sessions)) {
      statsState.sessions = res.sessions;
      renderSessionsHistory(res.sessions);
      renderStatsAnalytics(res.sessions);
    }

    // Load Timer State
    const timerRes = await ipcRenderer.invoke('stats:get-timer-state', chan);
    if (timerRes && timerRes.success && timerRes.timerState) {
      const ts = timerRes.timerState;
      if (typeof ts.headCountToday === 'number') {
        statsState.headCountToday = ts.headCountToday;
        updateHeadCounterUI();
      }
      if (ts.activeSetup) {
        if (ts.activeSetup.tobacco) {
          const inp = document.getElementById('input-session-tobacco');
          if (inp && !inp.value) inp.value = ts.activeSetup.tobacco;
        }
        if (ts.activeSetup.bowl) {
          const inp = document.getElementById('input-session-bowl');
          if (inp && !inp.value) inp.value = ts.activeSetup.bowl;
        }
        if (ts.activeSetup.hmd) {
          const inp = document.getElementById('input-session-hmd');
          if (inp && !inp.value) inp.value = ts.activeSetup.hmd;
        }
        if (ts.activeSetup.pipe) {
          const inp = document.getElementById('input-session-pipe');
          if (inp && !inp.value) inp.value = ts.activeSetup.pipe;
        }
        if (ts.activeSetup.person) {
          const inp = document.getElementById('input-session-person');
          if (inp && !inp.value) inp.value = ts.activeSetup.person;
        }
      }
    }
  } catch(e) {
    console.error('Error loading stats state:', e);
  }
}

function setupStatsListeners() {
  const btnFinishHead = document.getElementById('btn-timer-finish-head');
  const btnCopyObs = document.getElementById('btn-copy-timer-obs-link');
  const btnRefreshStats = document.getElementById('btn-refresh-stats');
  const btnCopySummary = document.getElementById('btn-copy-stream-summary');

  const tabHistory = document.getElementById('tab-stats-history');
  const tabAnalytics = document.getElementById('tab-stats-analytics');
  const panelHistory = document.getElementById('panel-stats-history');
  const panelAnalytics = document.getElementById('panel-stats-analytics');

  // Modal Finish Head Elements
  const modalFinish = document.getElementById('modal-finish-head');
  const btnCloseFinishModal = document.getElementById('btn-close-finish-modal');
  const btnCancelFinishModal = document.getElementById('btn-cancel-finish-modal');
  const btnConfirmFinish = document.getElementById('btn-confirm-finish-session');

  // OBS Link copy
  if (btnCopyObs) {
    btnCopyObs.addEventListener('click', () => {
      const url = `https://bazzteedj.github.io/shishawg-mod-setup-tool/qna.html?mode=timer`;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(() => {
          showToast('📺 OBS-Timer Overlay URL in die Zwischenablage kopiert!', 'success');
        });
      }
    });
  }

  // Refresh Stats
  if (btnRefreshStats) {
    btnRefreshStats.addEventListener('click', async () => {
      showToast('Aktualisiere Statistiken...', 'info');
      await loadStatsState();
      showToast('Statistiken synchronisiert! 🔄', 'success');
    });
  }

  // Copy Stream Summary
  if (btnCopySummary) {
    btnCopySummary.addEventListener('click', () => {
      copyStreamSummaryToChat();
    });
  }

  // Sub-tabs switching
  if (tabHistory && tabAnalytics && panelHistory && panelAnalytics) {
    tabHistory.addEventListener('click', () => {
      tabHistory.classList.add('active');
      tabAnalytics.classList.remove('active');
      panelHistory.classList.remove('hidden');
      panelAnalytics.classList.add('hidden');
    });

    tabAnalytics.addEventListener('click', () => {
      tabAnalytics.classList.add('active');
      tabHistory.classList.remove('active');
      panelAnalytics.classList.remove('hidden');
      panelHistory.classList.add('hidden');
      renderStatsAnalytics(statsState.sessions);
    });
  }

  // Finish Head Modal
  if (btnFinishHead && modalFinish) {
    btnFinishHead.addEventListener('click', () => {
      if (!statsState.isRunning || !statsState.activeSetup || !statsState.activeSetup.tobacco) {
        showToast('Aktuell läuft kein aktiver Kopf.', 'info');
        return;
      }
      const lblTob = document.getElementById('lbl-modal-finish-tobacco');
      const lblDur = document.getElementById('lbl-modal-finish-duration');
      const lblCoals = document.getElementById('lbl-modal-finish-coals');

      const tobName = statsState.activeSetup.tobacco || 'Aktueller Kopf';
      const durMins = Math.max(1, Math.round(statsState.sessionElapsedSeconds / 60));

      if (lblTob) lblTob.textContent = tobName;
      if (lblDur) lblDur.textContent = `${durMins} Minuten`;
      if (lblCoals) lblCoals.textContent = `${statsState.coalRotations || 0}x`;

      modalFinish.classList.remove('hidden');
    });
  }

  if (btnCloseFinishModal && modalFinish) {
    btnCloseFinishModal.addEventListener('click', () => modalFinish.classList.add('hidden'));
  }
  if (btnCancelFinishModal && modalFinish) {
    btnCancelFinishModal.addEventListener('click', () => modalFinish.classList.add('hidden'));
  }

  if (btnConfirmFinish && modalFinish) {
    btnConfirmFinish.addEventListener('click', async () => {
      await finishAndSaveHeadSession();
      modalFinish.classList.add('hidden');
    });
  }
}

