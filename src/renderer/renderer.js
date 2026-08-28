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

// Initialize App
async function initApp() {
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
    setupUpdaterEvents();
  } catch (e) {
    console.error('Error setting up updater:', e);
  }
  try {
    generateCommandString();
  } catch (e) {
    console.error('Error generating command:', e);
  }

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
    showToast('Erfolgreich von Twitch abgemeldet', 'info');
  });

  ipcRenderer.on('twitch:authenticated', (event, { user }) => {
    state.twitchUser = user;
    updateTwitchUI();
    twitchModal.classList.add('hidden');
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
function showToast(msg, type = 'info') {
  toastMessage.textContent = msg;
  toastBanner.className = `toast ${type}`;
  toastBanner.classList.remove('hidden');

  setTimeout(() => {
    toastBanner.classList.add('hidden');
  }, 4000);
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
