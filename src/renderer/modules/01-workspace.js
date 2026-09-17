const { ipcRenderer } = window.swgBridge;

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

let commandIsReady = false;
let liveStreamCheckInterval = null;

// DOM Elements
const personsContainer = document.getElementById('persons-container');
const personCountLabel = document.getElementById('person-count-label');
const btnIncPersons = document.getElementById('btn-inc-persons');
const commandOutput = document.getElementById('command-output');
const previewChatText = document.getElementById('preview-chat-text');
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
const chkIncludeFlavors = document.getElementById('chk-include-tobacco-flavors');
const MAX_COMMAND_LEN_WITH_FLAVORS = 300;
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
const releaseNotesModal = document.getElementById('release-notes-modal');
const releaseNotesTitle = document.getElementById('release-notes-title');
const releaseNotesIntro = document.getElementById('release-notes-intro');
const releaseNotesList = document.getElementById('release-notes-list');
const btnCloseReleaseNotes = document.getElementById('btn-close-release-notes');
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
let pendingReleaseNotesVersion = '';

function setupReleaseNotes() {
  if (!btnCloseReleaseNotes || btnCloseReleaseNotes.dataset.releaseNotesReady) return;
  btnCloseReleaseNotes.dataset.releaseNotesReady = 'true';
  btnCloseReleaseNotes.addEventListener('click', async () => {
    if (releaseNotesModal) releaseNotesModal.classList.add('hidden');
    if (!pendingReleaseNotesVersion) return;
    const result = await ipcRenderer.invoke('app:mark-release-notes-seen', pendingReleaseNotesVersion);
    if (!result?.success) {
      showToast(result?.error || 'Versionshinweis konnte nicht als gelesen gespeichert werden.', 'error');
    }
    pendingReleaseNotesVersion = '';
  });
}

async function showReleaseNotesOnce() {
  if (!releaseNotesModal || !releaseNotesList) return;
  try {
    const result = await ipcRenderer.invoke('app:get-release-notes');
    if (!result?.success || !result.shouldShow || !result.release) return;
    const release = result.release;
    pendingReleaseNotesVersion = release.version;
    if (releaseNotesTitle) releaseNotesTitle.textContent = release.title || `Neu in Version ${release.version}`;
    if (releaseNotesIntro) {
      releaseNotesIntro.textContent = release.intro || '';
      releaseNotesIntro.classList.toggle('hidden', !release.intro);
    }
    releaseNotesList.innerHTML = release.items.map(item => `
      <article class="release-note-item">
        <span class="release-note-icon">${escapeHtml(item.icon || '✨')}</span>
        <div>
          <strong>${escapeHtml(item.title)}</strong>
          <p>${escapeHtml(item.description)}</p>
        </div>
      </article>
    `).join('');
    releaseNotesModal.classList.remove('hidden');
    btnCloseReleaseNotes?.focus();
  } catch (error) {
    console.error('Error loading release notes:', error);
  }
}

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
      { shop: 'Holy', code: 'SWG10', desc: '10% Rabatt auf Deine Holy-Bestellung.' },
      { shop: 'Moze', code: 'SWG', desc: 'Zusätzliches Zubehör!' }
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
  updateTwitchUI();
}

function setupProfileEventListeners() {
  const profileModalBody = document.querySelector('#modal-streamer-profiles .modal-body');
  if (profileModalBody && !profileModalBody.dataset.autoHideScrollbarReady) {
    let profileScrollIdleTimer = null;
    profileModalBody.dataset.autoHideScrollbarReady = 'true';
    profileModalBody.addEventListener('scroll', () => {
      profileModalBody.classList.add('is-scrolling');
      clearTimeout(profileScrollIdleTimer);
      profileScrollIdleTimer = setTimeout(() => {
        profileModalBody.classList.remove('is-scrolling');
      }, 700);
    }, { passive: true });
  }

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
        currentProf.hqChat = {
          twitch: document.getElementById('hq-profile-twitch').checked,
          youtube: document.getElementById('hq-profile-youtube').checked,
          defaultView: document.getElementById('hq-profile-default').value,
          youtubeLiveUrl: document.getElementById('hq-profile-live-url').value.trim()
        };
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
            collectedPromos.push({ shop: s || '', code: c || '', desc: d || '' });
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
  const modalBody = modal.querySelector('.modal-body');
  if (modalBody) modalBody.scrollTop = 0;
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

  const hqSettings = p.hqChat || { twitch: true, youtube: p.targetChannel === 'marved', defaultView: 'twitch', youtubeLiveUrl: '' };
  document.getElementById('hq-profile-twitch').checked = hqSettings.twitch !== false;
  document.getElementById('hq-profile-youtube').checked = !!hqSettings.youtube;
  document.getElementById('hq-profile-default').value = hqSettings.defaultView || 'twitch';
  document.getElementById('hq-profile-live-url').value = hqSettings.youtubeLiveUrl || '';
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
  setupReleaseNotes();

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
  await showReleaseNotesOnce();
  try {
    generateCommandString();
  } catch (e) {
    console.error('Error generating command:', e);
  }

  // Check live stream status immediately & every 60 seconds
  checkLiveStreamStatus();
  if (typeof liveStreamCheckInterval !== 'undefined' && liveStreamCheckInterval) {
    clearInterval(liveStreamCheckInterval);
  }
  liveStreamCheckInterval = setInterval(checkLiveStreamStatus, 60000);

  // Global App Notification IPC Handler
  ipcRenderer.on('app:notify', (event, payload) => {
    if (payload && payload.message) {
      showToast(payload.message, payload.type || 'info');
    }
  });

  // Start global background watcher for Mod-HQ Team-Chat notifications
  startGlobalModChatWatcher();

  // Auto-start Channel Points (Kohle Stücke) listener
  ipcRenderer.invoke('channelpoints:start-listener', { channel: state.targetChannel }).catch(() => {});
  ipcRenderer.on('channelpoints:new-redemption', (event, item) => {
    playNotificationSound();
    showToast(`⬛ Kanalpunkte eingelöst: @${item.user_name || item.user_login} hat Kohle Stücke eingelöst!`, 'success');
    if (typeof pollWinnersUpdates === 'function') pollWinnersUpdates();
  });

  window.dispatchEvent(new CustomEvent('swg:ready'));

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
  if (!document.getElementById(targetViewId)?.classList.contains('hub-view-pane')) return;
  currentActiveView = targetViewId;
  window.dispatchEvent(new CustomEvent('swg:view-changed', { detail: targetViewId }));
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
    // Dashboard widgets edit the shared model; refresh all tobacco and device fields.
    if (state.persons.length) renderPersonsGrid();
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
    if (giveawaySyncInterval) clearInterval(giveawaySyncInterval);
    giveawaySyncInterval = setInterval(loadGiveawayWinnersHistory, 2500);
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
    if (qnaSyncInterval) clearInterval(qnaSyncInterval);
    qnaSyncInterval = setInterval(loadQnAState, 2500);
  } else {
    if (qnaSyncInterval) {
      clearInterval(qnaSyncInterval);
      qnaSyncInterval = null;
    }
  }

  // If opening Stats & Kohletimer, load state & start live sync
  if (targetViewId === 'view-stats') {
    loadStatsState();
    if (statsSyncInterval) clearInterval(statsSyncInterval);
    statsSyncInterval = setInterval(loadStatsState, 4000);
  } else if (targetViewId !== 'view-custom-dashboard') {
    if (statsSyncInterval) {
      clearInterval(statsSyncInterval);
      statsSyncInterval = null;
    }
  }

  // If opening Custom Mod Dashboard, render the grid and start live sync
  if (targetViewId === 'view-custom-dashboard') {
    renderCustomDashboard();
    startModHQSync();
    loadGiveawayWinnersHistory().then(() => {
      if (typeof updateDashboardGiveawayWidget === 'function') updateDashboardGiveawayWidget();
    });
    if (giveawaySyncInterval) clearInterval(giveawaySyncInterval);
    giveawaySyncInterval = setInterval(async () => {
      await loadGiveawayWinnersHistory();
      if (typeof updateDashboardGiveawayWidget === 'function') updateDashboardGiveawayWidget();
    }, 2500);
    loadQnAState();
    if (qnaSyncInterval) clearInterval(qnaSyncInterval);
    qnaSyncInterval = setInterval(loadQnAState, 2500);
    loadStatsState();
    if (statsSyncInterval) clearInterval(statsSyncInterval);
    statsSyncInterval = setInterval(loadStatsState, 4000);
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

