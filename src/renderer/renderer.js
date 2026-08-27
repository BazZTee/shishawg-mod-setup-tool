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
  targetChannel: 'marft',
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
const inputGlobalKohle = document.getElementById('input-global-kohle');
const inputGlobalExtra = document.getElementById('input-global-extra');
const btnResetAll = document.getElementById('btn-reset-all');
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

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
  await loadCatalog();
  await checkTwitchAuth();
  initDefaultPersons();
  renderPersonsGrid();
  setupEventListeners();
  generateCommandString();
});

// Load Database Catalog
async function loadCatalog() {
  state.catalog = await ipcRenderer.invoke('db:get-catalog');
  updateDatalists();
}

function updateDatalists() {
  populateDatalist('list-pipes', state.catalog.pipes || []);
  populateDatalist('list-bowls', state.catalog.bowls || []);
  populateDatalist('list-hmds', state.catalog.hmds || []);
  populateDatalist('list-tobacco', state.catalog.tobacco || []);
  populateDatalist('list-charcoal', state.catalog.charcoal || []);
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

// Default Initial Persons Setup (Default: 1 Person)
function initDefaultPersons() {
  state.persons = [
    {
      name: 'Marvin',
      pipe: 'Amotion Futr',
      bowl: 'Cosmo Bowl',
      hmd: 'ONMO HMD',
      tobacco1: 'Trofimoff Like Zaghoul',
      tobacco2: '',
      tobacco3: ''
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
        name: i === 0 ? 'Marvin' : i === 1 ? 'Yannick' : `Person ${i + 1}`,
        pipe: '',
        bowl: '',
        hmd: '',
        tobacco1: '',
        tobacco2: '',
        tobacco3: ''
      };
      state.persons[i] = p;
    }

    const card = document.createElement('div');
    card.className = 'person-card';
    card.setAttribute('data-index', i);

    card.innerHTML = `
      <div class="person-card-header">
        <div class="person-title">
          <span class="person-number-badge">Person ${i + 1}</span>
          <span class="person-name-display">${escapeHtml(p.name || `Person ${i + 1}`)}</span>
        </div>
        <button class="btn-icon btn-clear-person" data-index="${i}" title="Person leeren">✕</button>
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
        <label>Tabaksorte(n) [Bis zu 3 Sorten]:</label>
        <div class="tobacco-mix-inputs">
          <input type="text" class="input-p-tob1" data-index="${i}" list="list-tobacco" value="${escapeHtml(p.tobacco1)}" placeholder="Tabak 1 (z. B. Darkside Shot)">
          <input type="text" class="input-p-tob2" data-index="${i}" list="list-tobacco" value="${escapeHtml(p.tobacco2)}" placeholder="Tabak 2 (optional)">
          <input type="text" class="input-p-tob3" data-index="${i}" list="list-tobacco" value="${escapeHtml(p.tobacco3)}" placeholder="Tabak 3 (optional)">
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
      const idx = parseInt(e.target.getAttribute('data-index'));
      if (isNaN(idx) || !state.persons[idx]) return;

      const p = state.persons[idx];
      if (e.target.classList.contains('input-p-name')) {
        p.name = e.target.value;
        const card = e.target.closest('.person-card');
        if (card) {
          const nameDisplay = card.querySelector('.person-name-display');
          if (nameDisplay) nameDisplay.textContent = p.name || `Person ${idx + 1}`;
        }
      } else if (e.target.classList.contains('input-p-pipe')) {
        p.pipe = e.target.value;
      } else if (e.target.classList.contains('input-p-bowl')) {
        p.bowl = e.target.value;
      } else if (e.target.classList.contains('input-p-hmd')) {
        p.hmd = e.target.value;
      } else if (e.target.classList.contains('input-p-tob1')) {
        p.tobacco1 = e.target.value;
      } else if (e.target.classList.contains('input-p-tob2')) {
        p.tobacco2 = e.target.value;
      } else if (e.target.classList.contains('input-p-tob3')) {
        p.tobacco3 = e.target.value;
      }

      generateCommandString();
    });
  });

  document.querySelectorAll('.btn-clear-person').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.currentTarget.getAttribute('data-index'));
      if (!isNaN(idx) && state.persons[idx]) {
        state.persons[idx] = { name: '', pipe: '', bowl: '', hmd: '', tobacco1: '', tobacco2: '', tobacco3: '' };
        renderPersonsGrid();
        generateCommandString();
      }
    });
  });
}

// Command Generator Logic
function generateCommandString() {
  const parts = [];

  for (let i = 0; i < state.personCount; i++) {
    const p = state.persons[i];
    if (!p) continue;

    const personSegments = [];
    const pName = (p.name || '').trim();

    if (p.pipe) personSegments.push(p.pipe.trim());
    if (p.bowl) personSegments.push(p.bowl.trim());
    if (p.hmd) personSegments.push(p.hmd.trim());

    const tobaccos = [p.tobacco1, p.tobacco2, p.tobacco3]
      .map(t => (t || '').trim())
      .filter(Boolean);

    if (tobaccos.length > 0) {
      let tobStr = '';
      if (tobaccos.length === 1) {
        tobStr = tobaccos[0];
      } else if (tobaccos.length === 2) {
        tobStr = `${tobaccos[0]} und ${tobaccos[1]}`;
      } else {
        tobStr = `${tobaccos[0]}, ${tobaccos[1]} und ${tobaccos[2]}`;
      }
      personSegments.push(tobStr);
    }

    if (personSegments.length > 0 || pName) {
      const personStr = `${pName || `Person ${i+1}`}: ${personSegments.join(' // ')}`;
      parts.push(personStr);
    }
  }

  let fullCommand = `!editsetup ${parts.join(' // ')}`;

  const kohle = (inputGlobalKohle.value || '').trim();
  const extra = (inputGlobalExtra.value || '').trim();

  if (kohle || extra) {
    const globalParts = [];
    if (kohle) globalParts.push(kohle);
    if (extra) globalParts.push(extra);
    fullCommand += ` // ${globalParts.join(' // ')} //`;
  } else if (parts.length > 0) {
    fullCommand += ' //';
  }

  commandOutput.value = fullCommand;
}

// Smart Parser for Chat Setup Messages
function parseChatSetupMessage(rawText) {
  if (!rawText) return false;

  // Clean prefix if exists (!editsetup / !setup)
  let text = rawText.replace(/^!editsetup\s+/i, '').replace(/^!setup\s+/i, '').trim();

  const segments = text.split('//').map(s => s.trim()).filter(Boolean);
  if (segments.length === 0) return false;

  const parsedPersons = [];
  let globalKohle = '';
  let globalExtra = '';
  let sharedBowl = '';
  let sharedHmd = '';

  for (const seg of segments) {
    // Check if segment has person name pattern "Name: ..."
    if (seg.includes(':')) {
      const colonIdx = seg.indexOf(':');
      const pName = seg.substring(0, colonIdx).trim();
      const pSetup = seg.substring(colonIdx + 1).trim();

      let pipe = '';
      let tobaccos = [];

      if (pSetup.includes('&')) {
        const parts = pSetup.split('&').map(x => x.trim());
        pipe = parts[0];
        tobaccos.push(parts[1]);
      } else {
        pipe = pSetup;
      }

      parsedPersons.push({
        name: pName,
        pipe: pipe,
        bowl: '',
        hmd: '',
        tobacco1: tobaccos[0] || '',
        tobacco2: tobaccos[1] || '',
        tobacco3: tobaccos[2] || ''
      });
    } else if (seg.toLowerCase().includes('!kohle') || seg.toLowerCase().includes('kohle') || seg.toLowerCase().includes('cubes')) {
      globalKohle = seg;
    } else if (seg.toLowerCase().includes('tasting') || seg.toLowerCase().includes('no aroma')) {
      globalExtra = seg;
    } else if (seg.toLowerCase().includes('hmd') || seg.toLowerCase().includes('grani') || seg.toLowerCase().includes('lotus')) {
      sharedHmd = seg;
    } else if (seg.toLowerCase().includes('bowl') || seg.toLowerCase().includes('phunnel') || seg.toLowerCase().includes('shot')) {
      // Shared bowl or bowl/tobacco combo e.g. "Darkside Shot und Cosmo Bowl"
      if (seg.includes('und') && (seg.toLowerCase().includes('shot') || seg.toLowerCase().includes('darkside'))) {
        const parts = seg.split('und').map(x => x.trim());
        if (parsedPersons.length > 0) {
          if (!parsedPersons[0].tobacco2 && parts[0]) parsedPersons[0].tobacco2 = parts[0];
          if (parts[1]) sharedBowl = parts[1];
        }
      } else {
        sharedBowl = seg;
      }
    } else {
      // General item or tobacco
      if (parsedPersons.length > 0 && !parsedPersons[0].tobacco1) {
        parsedPersons[0].tobacco1 = seg;
      } else if (parsedPersons.length > 1 && !parsedPersons[1].tobacco1) {
        parsedPersons[1].tobacco1 = seg;
      } else {
        globalExtra = globalExtra ? `${globalExtra} // ${seg}` : seg;
      }
    }
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

  // Extras input listeners
  inputGlobalKohle.addEventListener('input', generateCommandString);
  inputGlobalExtra.addEventListener('input', generateCommandString);

  // Target Channel Listener
  targetChannelInput.addEventListener('change', async () => {
    state.targetChannel = targetChannelInput.value.trim().toLowerCase() || 'marft';
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
    if (!state.twitchUser) {
      showToast('Bitte verbinde dich zuerst mit Twitch', 'error');
      return;
    }

    btnFetchChatSetup.disabled = true;
    btnFetchChatSetup.innerHTML = '<span class="status-dot green"></span> Schreibe !setup in Chat...';
    showToast('Sende !setup und warte auf Antwort aus dem Chat...', 'info');

    const res = await ipcRenderer.invoke('twitch:fetch-setup', state.targetChannel);

    btnFetchChatSetup.disabled = false;
    btnFetchChatSetup.innerHTML = `<svg class="icon-sm" viewBox="0 0 24 24"><path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg> Setup aus Chat ziehen`;

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
    } else {
      showToast(`Fehler beim Senden: ${res.error}`, 'error');
    }
  });

  // Reset Form
  btnResetAll.addEventListener('click', () => {
    state.personCount = 1;
    personCountSelect.value = "1";
    state.persons = [];
    renderPersonsGrid();
    generateCommandString();
    showToast('Formular zurückgesetzt', 'info');
  });

  // Database Modal Listeners
  btnOpenDb.addEventListener('click', () => {
    dbModal.classList.remove('hidden');
    renderCatalogList();
  });

  btnCloseDbModal.addEventListener('click', () => {
    dbModal.classList.add('hidden');
  });

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      state.currentDbTab = e.target.getAttribute('data-tab');
      renderCatalogList();
    });
  });

  btnAddDbItem.addEventListener('click', async () => {
    const val = newItemInput.value.trim();
    if (!val) return;

    const catKey = getCategoryKeyForTab(state.currentDbTab);
    const res = await ipcRenderer.invoke('db:add-item', { category: catKey, item: val });
    if (res.success) {
      state.catalog = res.catalog;
      updateDatalists();
      newItemInput.value = '';
      renderCatalogList();
      showToast(`"${val}" zur Datenbank hinzugefügt`, 'success');
    }
  });
}

function getCategoryKeyForTab(tabId) {
  switch (tabId) {
    case 'tab-pipes': return 'pipes';
    case 'tab-bowls': return 'bowls';
    case 'tab-hmds': return 'hmds';
    case 'tab-charcoal': return 'charcoal';
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

  catalogListItems.innerHTML = items.map(item => `
    <div class="catalog-item">
      <span>${escapeHtml(item)}</span>
      <button class="btn-icon btn-delete-item" data-item="${escapeHtml(item)}" title="Löschen">🗑️</button>
    </div>
  `).join('');

  catalogListItems.querySelectorAll('.btn-delete-item').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const itemToDelete = e.currentTarget.getAttribute('data-item');
      const catKey = getCategoryKeyForTab(state.currentDbTab);
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
