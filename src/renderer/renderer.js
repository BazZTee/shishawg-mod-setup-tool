const { ipcRenderer } = require('electron');

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
  clientId: ''
};

// DOM Elements
const personsContainer = document.getElementById('persons-container');
const personCountSelect = document.getElementById('person-count-select');
const btnIncPersons = document.getElementById('btn-inc-persons');
const btnDecPersons = document.getElementById('btn-dec-persons');
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
document.addEventListener('DOMContentLoaded', async () => {
  await loadCatalog();
  await checkTwitchAuth();
  initDefaultPersons();
  renderPersonsGrid();
  setupEventListeners();
  setupUpdaterEvents();
  generateCommandString();

  // Auto-sync community catalog from GitHub on startup
  setTimeout(async () => {
    try {
      const res = await ipcRenderer.invoke('db:sync-github');
      if (res && res.addedCount > 0) {
        state.catalog = res.catalog;
        updateDatalists();
        showToast(`${res.addedCount} neue Katalog-Einträge von GitHub geladen!`, 'success');
      }
    } catch(e) {}
  }, 2000);
});

// Load Database Catalog
async function loadCatalog() {
  state.catalog = await ipcRenderer.invoke('db:get-catalog');
  updateDatalists();
}

function updateDatalists() {
  populateDatalist('list-pipes', state.catalog.pipes || []);
  populateDatalist('list-bowls', state.catalog.bowls || []);
  populateDatalist('list-vases', state.catalog.vases || []);
  populateDatalist('list-hmds', state.catalog.hmds || []);
  populateDatalist('list-tobacco', state.catalog.tobacco || []);
  populateDatalist('list-charcoal', state.catalog.charcoal || []);
  populateDatalist('list-tastings', state.catalog.tastings || []);
  populateDatalist('list-promos', state.catalog.promos || []);
}

function populateDatalist(elementId, items) {
  const datalist = document.getElementById(elementId);
  if (!datalist) return;
  datalist.innerHTML = items.map(item => `<option value="${escapeHtml(item)}"></option>`).join('');
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
}

function updateTwitchUI() {
  if (state.twitchUser) {
    btnTwitchLogin.classList.add('hidden');
    twitchUserBadge.classList.remove('hidden');
    userDisplayName.textContent = state.twitchUser.display_name || state.twitchUser.login;
    userAvatar.src = state.twitchUser.profile_image_url || 'https://static-cdn.jtvnw.net/user-default-pictures-uv/75305db0-3a59-4d70-9050-0b42c497426a-profile_image-70x70.png';
  } else {
    btnTwitchLogin.classList.remove('hidden');
    twitchUserBadge.classList.add('hidden');
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
    const tobaccoSlotsHtml = p.tobaccos.map((tVal, tIdx) => `
      <div class="tobacco-slot-row">
        <input type="text" class="input-p-tob" data-pindex="${i}" data-tindex="${tIdx}" list="list-tobacco" value="${escapeHtml(tVal)}" placeholder="Tabak ${tIdx + 1}">
        ${tIdx > 0 ? `<button class="btn-icon btn-remove-tobacco-slot" data-pindex="${i}" data-tindex="${tIdx}" title="Tabaksortenslot entfernen">✕</button>` : ''}
      </div>
    `).join('');

    card.innerHTML = `
      <div class="person-card-header">
        <div class="person-title">
          <span class="person-number-badge">Person ${i + 1}</span>
          <span class="person-name-display">${escapeHtml(p.name || `Person ${i + 1}`)}</span>
        </div>
        <button class="btn-icon btn-clear-person" data-index="${i}" title="Person entfernen">✕</button>
      </div>

      <div class="input-row">
        <div class="input-group">
          <label>Name:</label>
          <input type="text" class="input-p-name" data-index="${i}" value="${escapeHtml(p.name)}" placeholder="z. B. Marvin">
        </div>
        <div class="input-group">
          <label>Pfeife:</label>
          <input type="text" class="input-p-pipe" data-index="${i}" list="list-pipes" value="${escapeHtml(p.pipe)}" placeholder="z. B. Amotion Futr">
        </div>
      </div>

      <div class="optional-fields-box">
        <div class="input-row">
          <div class="input-group">
            <label class="label-optional">Bowl / Glas (optional):</label>
            <input type="text" class="input-p-vessel" data-index="${i}" list="list-vases" value="${escapeHtml(p.vessel || '')}" placeholder="z. B. Caesar Crystal">
          </div>
          <div class="input-group">
            <label class="label-optional">Bowl-Farbe (optional):</label>
            <input type="text" class="input-p-vessel-color" data-index="${i}" value="${escapeHtml(p.vesselColor || '')}" placeholder="z. B. Clear, Amber">
          </div>
        </div>
      </div>

      <div class="input-row">
        <div class="input-group">
          <label>Kopf:</label>
          <input type="text" class="input-p-bowl" data-index="${i}" list="list-bowls" value="${escapeHtml(p.bowl)}" placeholder="z. B. Cosmo Bowl">
        </div>
        <div class="input-group">
          <label>HMD:</label>
          <input type="text" class="input-p-hmd" data-index="${i}" list="list-hmds" value="${escapeHtml(p.hmd)}" placeholder="z. B. ONMO HMD">
        </div>
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
          personCountSelect.value = String(state.personCount);
        } else {
          // If only 1 person, clear fields of the remaining card
          state.persons[0] = { name: '', pipe: '', vessel: '', vesselColor: '', bowl: '', hmd: '', tobaccos: [''] };
        }
        renderPersonsGrid();
        generateCommandString();
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

    if (promoText) {
      if (promoTarget === 'pipe' && pipeVal) pipeVal = `${pipeVal} ${promoText}`;
      if (promoTarget === 'bowl' && bowlVal) bowlVal = `${bowlVal} ${promoText}`;
      if (promoTarget === 'hmd' && hmdVal) hmdVal = `${hmdVal} ${promoText}`;
    }

    if (pipeVal) personSegments.push(pipeVal);
    if (bowlVal) personSegments.push(bowlVal);
    if (hmdVal) personSegments.push(hmdVal);

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

  let kohle = (inputGlobalKohle ? inputGlobalKohle.value : '').trim();
  let extra = (inputGlobalExtra ? inputGlobalExtra.value : '').trim();

  if (promoText) {
    if (promoTarget === 'kohle') {
      kohle = kohle ? `${kohle} ${promoText}` : promoText;
    } else if (promoTarget === 'extra') {
      extra = extra ? `${extra} ${promoText}` : promoText;
    }
  }

  if (kohle || extra) {
    const globalParts = [];
    if (kohle) globalParts.push(kohle);
    if (extra) globalParts.push(extra);
    fullCommand += ` // ${globalParts.join(' // ')} //`;
  } else if (parts.length > 0) {
    fullCommand += ' //';
  }

  commandOutput.value = fullCommand;

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
    personCountSelect.value = state.personCount;

    state.persons = parsedPersons.map(p => ({
      ...p,
      bowl: p.bowl || sharedBowl,
      hmd: p.hmd || sharedHmd
    }));

    if (globalKohle) inputGlobalKohle.value = globalKohle;
    if (globalExtra) inputGlobalExtra.value = globalExtra;

    renderPersonsGrid();
    generateCommandString();
    triggerAutoLearn();
    return true;
  }

  return false;
}

// Global Event Listeners
function setupEventListeners() {
  // Person Count Stepper
  personCountSelect.addEventListener('change', (e) => {
    state.personCount = parseInt(e.target.value) || 1;
    renderPersonsGrid();
    generateCommandString();
  });

  btnIncPersons.addEventListener('click', () => {
    if (state.personCount < 10) {
      state.personCount++;
      personCountSelect.value = state.personCount;
      renderPersonsGrid();
      generateCommandString();
    }
  });

  btnDecPersons.addEventListener('click', () => {
    if (state.personCount > 1) {
      state.personCount--;
      personCountSelect.value = state.personCount;
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
  targetChannelInput.addEventListener('change', async () => {
    state.targetChannel = targetChannelInput.value.trim().toLowerCase() || 'marved';
    await ipcRenderer.invoke('twitch:set-channel', state.targetChannel);
    showToast(`Ziel-Kanal auf #${state.targetChannel} gesetzt`, 'success');
  });

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
      showToast('Befehl in Zwischenablage kopiert!', 'success');
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
    } else {
      showToast(`Fehler beim Senden: ${res.error}`, 'error');
    }
  });

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

function matchNotesToForm(text) {
  if (!text || text.trim().length < 2) {
    if (state.persons[0]) {
      const pName = state.persons[0].name || 'Marvin';
      state.persons[0] = { name: pName, pipe: '', vessel: '', vesselColor: '', bowl: '', hmd: '', tobaccos: [''] };
    }
    if (inputGlobalKohle) inputGlobalKohle.value = '';
    renderPersonsGrid();
    generateCommandString();
    return;
  }

  const catalog = state.catalog || {};
  let updated = false;

  if (!state.persons[0]) {
    state.persons[0] = { name: 'Marvin', pipe: '', vessel: '', vesselColor: '', bowl: '', hmd: '', tobaccos: [''] };
  }
  const p = state.persons[0];
  const origText = text.trim();
  const lowerText = origText.toLowerCase();

  const capitalize = (str) => {
    if (!str) return '';
    return str.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  // 1. Pipe Scanner with Token Scoring (Model > Brand)
  let matchedPipe = '';
  if (catalog.pipes) {
    let maxScore = 0;
    for (const pipe of catalog.pipes) {
      const pName = (typeof pipe === 'string' ? pipe : pipe.name).trim();
      const pLower = pName.toLowerCase();
      let score = 0;

      if (lowerText.includes(pLower)) {
        score += 100;
      } else {
        const tokens = pLower.split(/\s+/).filter(w => w.length > 1);
        for (const t of tokens) {
          if (['amotion', 'moze', 'vyro', 'ocean', 'aeon', 'almani', 'hookah', 'edition'].includes(t)) {
            if (lowerText.includes(t)) score += 10;
          } else {
            if (lowerText.includes(t)) score += 50;
          }
        }
      }

      if (score > maxScore && score >= 25) {
        maxScore = score;
        matchedPipe = pName;
      }
    }
  }
  if (!matchedPipe) {
    if (lowerText.includes('futr') || lowerText.includes('emotion')) matchedPipe = 'Amotion Futr';
    else if (lowerText.includes('breeze')) matchedPipe = 'Moze Breeze Two';
    else if (lowerText.includes('varity')) matchedPipe = 'Moze Varity';
    else if (lowerText.includes('flash bang')) matchedPipe = 'Amotion Flash Bang';
    else if (lowerText.includes('specter')) matchedPipe = 'Vyro Specter';
  }
  if (p.pipe !== matchedPipe) {
    p.pipe = matchedPipe;
    updated = true;
  }

  // 2. Bowl/Glas Scanner ("auf einer ...", "auf ...")
  let matchedVessel = '';
  const vesselMatch = origText.match(/\bauf\s+(?:einer\s+)?([a-zäöüß0-9-]+(?:\s+[a-zäöüß0-9-]+){0,2})/i);
  if (vesselMatch && vesselMatch[1]) {
    matchedVessel = capitalize(vesselMatch[1].trim());
    if (catalog.vases) {
      const known = catalog.vases.find(k => k.toLowerCase().includes(vesselMatch[1].toLowerCase()) || vesselMatch[1].toLowerCase().includes(k.toLowerCase()));
      if (known) matchedVessel = known;
    }
  }
  if (p.vessel !== matchedVessel) {
    p.vessel = matchedVessel;
    updated = true;
  }

  // 3. Bowl-Farbe Scanner ("in <color>")
  let matchedColor = '';
  const colorMatch = origText.match(/\bin\s+([a-zäöüß0-9-]+)(?=\s+|$|\b)/i);
  if (colorMatch && colorMatch[1]) {
    const rawColor = colorMatch[1].toLowerCase();
    if (!['einer', 'dem', 'der', 'die', 'das', 'den', 'mit', 'auf'].includes(rawColor)) {
      matchedColor = capitalize(colorMatch[1].trim());
    }
  }
  if (p.vesselColor !== matchedColor) {
    p.vesselColor = matchedColor;
    updated = true;
  }

  // 4. Kopf Scanner ("von <head>" or known bowls like voskurymsia, mumia, cosmo, litbowl)
  let matchedBowl = '';
  const headMatch = origText.match(/\bvon\s+([a-zäöüß0-9\s-]+?)(?=\s+(?:mit|im|in|auf|und|magic|musth|\!|$))/i);
  if (headMatch && headMatch[1]) {
    matchedBowl = capitalize(headMatch[1].trim());
  } else if (catalog.bowls) {
    for (const bowl of catalog.bowls) {
      const bName = (typeof bowl === 'string' ? bowl : bowl.name).trim();
      const bLower = bName.toLowerCase();
      const tokens = bLower.split(/\s+/).filter(w => w.length > 2);
      if (lowerText.includes(bLower) || tokens.some(t => lowerText.includes(t))) {
        matchedBowl = bName;
        break;
      }
    }
  }
  if (!matchedBowl) {
    if (lowerText.includes('voskurymsia') || lowerText.includes('mumia')) matchedBowl = 'Voskurymsia Mumia';
    else if (lowerText.includes('cosmo')) matchedBowl = 'Cosmo Bowl';
    else if (lowerText.includes('litbowl')) matchedBowl = 'Hookain LitBowl';
  }
  if (p.bowl !== matchedBowl) {
    p.bowl = matchedBowl;
    updated = true;
  }

  // 5. HMD Scanner (ONMO, Na Grani, Kaloud, AO)
  let matchedHmd = '';
  if (catalog.hmds) {
    for (const hmd of catalog.hmds) {
      const hName = (typeof hmd === 'string' ? hmd : hmd.name).trim();
      const hLower = hName.toLowerCase();
      if (lowerText.includes(hLower) || (hLower.includes('onmo') && lowerText.includes('onmo'))) {
        matchedHmd = hName;
        break;
      }
    }
  }
  if (!matchedHmd && lowerText.includes('onmo')) matchedHmd = 'ONMO HMD';
  if (p.hmd !== matchedHmd) {
    p.hmd = matchedHmd;
    updated = true;
  }

  // 6. Tobacco Scanner (Scan all catalog tobaccos + handle multi-musthave / abbreviations)
  const matchedTobaccos = [];
  const expandedText = lowerText
    .replace(/\bmusth\b/g, 'musthave')
    .replace(/\bkwi\b/g, 'kiwi')
    .replace(/\bleime\b/g, 'lime');

  if (catalog.tobacco) {
    for (const tob of catalog.tobacco) {
      const tName = (typeof tob === 'string' ? tob : tob.name).trim();
      const tLower = tName.toLowerCase();
      const tWords = tLower.split(/\s+/).filter(w => w.length > 2 && w !== 'tobacco');

      let isMatch = expandedText.includes(tLower);
      if (!isMatch) {
        let count = 0;
        for (const tw of tWords) {
          if (expandedText.includes(tw)) count++;
        }
        if (count >= 2 || (count >= 1 && tWords.length === 1)) isMatch = true;
      }
      if (isMatch && !matchedTobaccos.includes(tName)) {
        matchedTobaccos.push(tName);
      }
    }
  }

  const musthaveRegex = /musthave\s+([a-z0-9\s-]+?)(?=\s+(?:musthave|magic|charcoal|kohle|\!|$))/gi;
  let mMatch;
  while ((mMatch = musthaveRegex.exec(expandedText)) !== null) {
    const rawFlavor = mMatch[1].trim();
    if (rawFlavor) {
      let fullCandidate = `Musthave ${capitalize(rawFlavor)}`;
      if (rawFlavor.includes('kiwi') || rawFlavor.includes('smooth')) fullCandidate = 'Musthave Kiwi Smooth';
      if (rawFlavor.includes('lime') || rawFlavor.includes('leime')) fullCandidate = 'Musthave Lime';

      if (!matchedTobaccos.includes(fullCandidate)) {
        matchedTobaccos.push(fullCandidate);
      }
    }
  }

  const formattedTobaccos = matchedTobaccos.length > 0 ? [...matchedTobaccos, ''] : [''];
  if (JSON.stringify(p.tobaccos) !== JSON.stringify(formattedTobaccos)) {
    p.tobaccos = formattedTobaccos;
    updated = true;
  }

  // 7. Charcoal Scanner (Magic Cubes, Black Coco, Shaman)
  let matchedCharcoal = '';
  if (lowerText.includes('magic') || lowerText.includes('cubes') || lowerText.includes('zauberwürfel')) {
    matchedCharcoal = 'Magic Cubes (Zauberwürfel) !kohle';
  } else if (catalog.charcoal) {
    for (const c of catalog.charcoal) {
      const cName = (typeof c === 'string' ? c : c.name).trim();
      if (lowerText.includes(cName.toLowerCase())) {
        matchedCharcoal = cName;
        break;
      }
    }
  }
  if (inputGlobalKohle && inputGlobalKohle.value !== matchedCharcoal) {
    inputGlobalKohle.value = matchedCharcoal;
    updated = true;
  }

  if (updated) {
    renderPersonsGrid();
    generateCommandString();
  }
}

  // Reset Form
  btnResetAll.addEventListener('click', () => {
    state.personCount = 1;
    personCountSelect.value = "1";
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

  if (notesTextarea) {
    notesTextarea.addEventListener('input', () => {
      matchNotesToForm(notesTextarea.value);
    });
  }

  // Target Bot Listener
  if (targetBotInput) {
    targetBotInput.addEventListener('change', () => {
      state.targetBot = targetBotInput.value.trim().toLowerCase() || 'marvedbot';
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
      btnSyncGithubDb.textContent = '🔄 GitHub Sync';
      if (res && res.success) {
        state.catalog = res.catalog;
        updateDatalists();
        renderCatalogList();
        if (res.addedCount > 0) {
          showToast(`${res.addedCount} neue Katalog-Einträge geladen!`, 'success');
        } else {
          showToast('Katalog ist bereits auf dem neuesten Stand!', 'info');
        }
      } else {
        showToast('Konnte Community-Katalog nicht abgleichen', 'error');
      }
    });
  }

  btnCloseDbModal.addEventListener('click', () => {
    dbModal.classList.add('hidden');
  });

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      state.currentDbTab = e.target.getAttribute('data-tab');

      if (state.currentDbTab === 'tab-promos') {
        if (newItemInput) newItemInput.placeholder = 'Promo-Command (z. B. !xk)...';
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
    if (state.currentDbTab === 'tab-promos') {
      const desc = newItemDescInput ? newItemDescInput.value.trim() : '';
      if (desc) {
        itemVal = `${code} (${desc})`;
      }
    }

    const catKey = getCategoryKeyForTab(state.currentDbTab);
    const res = await ipcRenderer.invoke('db:add-item', { category: catKey, item: itemVal });
    if (res.success) {
      state.catalog = res.catalog;
      updateDatalists();
      newItemInput.value = '';
      if (newItemDescInput) newItemDescInput.value = '';
      renderCatalogList();
      showToast(`"${itemVal}" zur Datenbank hinzugefügt`, 'success');
    }
  });
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
    case 'tab-tastings': return 'tastings';
    case 'tab-promos': return 'promos';
    default: return 'tobacco';
  }
}

function renderCatalogList() {
  const catKey = getCategoryKeyForTab(state.currentDbTab);
  const items = state.catalog[catKey] || [];

  if (items.length === 0) {
    catalogListItems.innerHTML = '<p class="subtitle" style="text-align:center; padding: 12px;">Keine Einträge vorhanden</p>';
    return;
  }

  catalogListItems.innerHTML = items.map((item, idx) => {
    let displayHtml = `<span>${escapeHtml(item)}</span>`;
    if (catKey === 'promos') {
      const match = item.match(/^([^\(]+?)(?:\s*\((.+)\))?$/);
      if (match) {
        const code = match[1].trim();
        const desc = match[2] ? match[2].trim() : '';
        displayHtml = `<span><strong class="promo-code">${escapeHtml(code)}</strong>${desc ? `<span class="promo-desc">(${escapeHtml(desc)})</span>` : ''}</span>`;
      }
    }
    return `
      <div class="catalog-item" id="catalog-item-${idx}">
        <div class="item-view" style="display:flex; justify-content:space-between; align-items:center; width:100%;">
          ${displayHtml}
          <div class="catalog-actions">
            <button class="btn-icon btn-edit-item" data-idx="${idx}" data-item="${escapeHtml(item)}" title="Bearbeiten">✏️</button>
            <button class="btn-icon btn-delete-item" data-item="${escapeHtml(item)}" title="Löschen">🗑️</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Attach Inline Edit Listener for ✏️
  catalogListItems.querySelectorAll('.btn-edit-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = e.currentTarget.getAttribute('data-idx');
      const oldItem = e.currentTarget.getAttribute('data-item');
      const itemContainer = document.getElementById(`catalog-item-${idx}`);
      if (!itemContainer) return;

      if (catKey === 'promos') {
        let codeVal = oldItem;
        let descVal = '';
        const match = oldItem.match(/^([^\(]+?)(?:\s*\((.+)\))?$/);
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
            <input type="text" id="inline-input-${idx}" value="${escapeHtml(oldItem)}" maxlength="60">
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
          newItem = document.getElementById(`inline-input-${idx}`).value.trim();
        }

        if (newItem && newItem !== oldItem) {
          const res = await ipcRenderer.invoke('db:edit-item', { category: catKey, oldItem, newItem });
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
      const itemToDelete = e.currentTarget.getAttribute('data-item');
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
