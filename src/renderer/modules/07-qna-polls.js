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
  const btnOpenBestrafungen = document.getElementById('btn-open-qna-bestrafungen');
  const btnCloseBestrafungen = document.getElementById('btn-close-qna-bestrafungen');
  const bestrafungenModal = document.getElementById('modal-qna-bestrafungen');
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

  // Punishments & Challenges Modal
  if (btnOpenBestrafungen && bestrafungenModal) {
    btnOpenBestrafungen.addEventListener('click', () => {
      renderBestrafungen();
      bestrafungenModal.classList.remove('hidden');
      const input = document.getElementById('input-new-bestrafung');
      if (input) input.focus();
    });
  }
  if (btnCloseBestrafungen && bestrafungenModal) {
    btnCloseBestrafungen.addEventListener('click', () => bestrafungenModal.classList.add('hidden'));
  }

  // Copy OBS Overlay Link
  if (btnCopyObs) {
    btnCopyObs.addEventListener('click', async () => {
      const chan = (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved';
      const input = document.getElementById('obs-qna-cloud-url');
      const obsUrl = input && input.value ? input.value : `https://bazztee.github.io/shishawg-mod-setup-tool/qna.html?channel=${encodeURIComponent(chan)}&mode=overlay`;
      await ipcRenderer.invoke('app:copy-clipboard', obsUrl);
      if (qnaDropdownMenu) qnaDropdownMenu.classList.add('hidden');
      showToast('OBS-Overlay Link in die Zwischenablage kopiert! 📺', 'success');
    });
  }

  // Copy Prompter Link (Marvin Screen)
  if (btnCopyPrompter) {
    btnCopyPrompter.addEventListener('click', async () => {
      const chan = (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved';
      const input = document.getElementById('obs-qna-prompter-url');
      const prompterUrl = input && input.value ? input.value : `https://bazztee.github.io/shishawg-mod-setup-tool/qna.html?channel=${encodeURIComponent(chan)}&mode=screen`;
      await ipcRenderer.invoke('app:copy-clipboard', prompterUrl);
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
      if (!confirm('Alle beantworteten Fragen löschen?')) return;
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
      if (!confirm('Alle Fragen unwiderruflich löschen?')) return;
      const chan = (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved';
      qnaState.questions = [];
      qnaState.activeQuestion = null;
      await ipcRenderer.invoke('qna:delete-all-questions', chan);
      await ipcRenderer.invoke('qna:set-active', null, chan);
      renderQnASpotlight();
      renderQnAQuestionsList();
      showToast('Alle Fragen wurden gelöscht. 🗑️', 'info');
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
    if (typeof refreshDashboardWidgets === 'function') {
      refreshDashboardWidgets(['widget-qna', 'widget-polls']);
    }
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
  loadStatsState();
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
  if (typeof refreshDashboardWidgets === 'function') refreshDashboardWidgets('widget-qna');
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
  if (typeof refreshDashboardWidgets === 'function') refreshDashboardWidgets('widget-qna');
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
        <button id="btn-spotlight-answered" class="btn btn-sm btn-primary">✓ Als beantwortet markieren</button>
        <button id="btn-spotlight-next-random" class="btn btn-sm btn-secondary">🎲 Nächste zufällig</button>
        <button id="btn-spotlight-offair" class="btn btn-sm btn-secondary">↩️ Zurück in den Pool</button>
      </div>
    </div>
  `;

  const btnOffAir = document.getElementById('btn-spotlight-offair');
  const btnAnswered = document.getElementById('btn-spotlight-answered');
  const btnNextRandom = document.getElementById('btn-spotlight-next-random');
  if (btnOffAir) {
    btnOffAir.addEventListener('click', () => setQuestionStatus(active.id, 'approved'));
  }
  if (btnAnswered) {
    btnAnswered.addEventListener('click', () => setQuestionStatus(active.id, 'answered'));
  }
  if (btnNextRandom) {
    btnNextRandom.addEventListener('click', () => {
      const pool = qnaState.questions.filter(question => question.status === 'approved' && question.id !== active.id);
      if (pool.length === 0) {
        showToast('Keine weitere freigegebene Frage im Pool.', 'info');
        return;
      }
      const next = pool[Math.floor(Math.random() * pool.length)];
      setQuestionStatus(next.id, 'on_air');
    });
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
        <button class="btn btn-xs btn-primary btn-act-live" data-id="${q.id}">📺 Live schalten</button>
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
    const btnLive = card.querySelector('.btn-act-live');
    const btnDel = card.querySelector('.btn-act-delete');

    if (btnApprove) btnApprove.addEventListener('click', () => setQuestionStatus(q.id, 'approved'));
    if (btnReject) btnReject.addEventListener('click', () => setQuestionStatus(q.id, 'rejected'));
    if (btnLive) btnLive.addEventListener('click', () => setQuestionStatus(q.id, 'on_air'));
    if (btnDel) btnDel.addEventListener('click', () => deleteQuestion(q.id));

    container.appendChild(card);
  });

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
