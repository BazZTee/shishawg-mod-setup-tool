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
let editingCmdId = null;

function openEditCommandModal(id) {
  const cmd = quickCommands.find(c => c.id === id);
  if (!cmd || !qaCustomCmdModal) return;
  editingCmdId = cmd.id;
  const modalTitle = qaCustomCmdModal.querySelector('h3');
  if (modalTitle) modalTitle.textContent = '✏️ Befehl bearbeiten';
  if (btnSaveCustomCmd) btnSaveCustomCmd.textContent = 'Speichern';
  if (inputCustomCmdLabel) inputCustomCmdLabel.value = cmd.label || '';
  if (inputCustomCmdText) inputCustomCmdText.value = cmd.command || '';
  qaCustomCmdModal.classList.remove('hidden');
  if (inputCustomCmdLabel) inputCustomCmdLabel.focus();
}

function openAddCommandModal() {
  editingCmdId = null;
  const modalTitle = qaCustomCmdModal ? qaCustomCmdModal.querySelector('h3') : null;
  if (modalTitle) modalTitle.textContent = '⚡ Quick-Command hinzufügen';
  if (btnSaveCustomCmd) btnSaveCustomCmd.textContent = 'Hinzufügen';
  if (inputCustomCmdLabel) inputCustomCmdLabel.value = '';
  if (inputCustomCmdText) inputCustomCmdText.value = '';
  if (qaCustomCmdModal) qaCustomCmdModal.classList.remove('hidden');
  if (inputCustomCmdLabel) inputCustomCmdLabel.focus();
}

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
  window.dispatchEvent(new CustomEvent('swg:quick-commands-changed'));
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
        <button class="btn-edit-cmd" data-id="${cmd.id}" title="Bearbeiten" aria-label="Befehl bearbeiten">✏️</button>
        <button class="btn-delete-cmd" data-id="${cmd.id}" title="Löschen" aria-label="Befehl löschen">✕</button>
      </div>
    `;

    // Click to send command
    card.addEventListener('click', async (e) => {
      if (e.target.closest('.btn-delete-cmd') || e.target.closest('.btn-edit-cmd') || e.target.closest('.sa-pin')) return;
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

    // Edit button
    const btnEdit = card.querySelector('.btn-edit-cmd');
    if (btnEdit) {
      btnEdit.addEventListener('click', (e) => {
        e.stopPropagation();
        openEditCommandModal(cmd.id);
      });
    }

    // Delete button
    const btnDel = card.querySelector('.btn-delete-cmd');
    if (btnDel) {
      btnDel.addEventListener('click', (e) => {
        e.stopPropagation();
        quickCommands = quickCommands.filter(c => c.id !== cmd.id);
        saveQuickCommands();
        renderQuickCommands();
        showToast('Befehl entfernt', 'info');
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
      openAddCommandModal();
    });
  }

  if (btnCloseQaCustomModal && qaCustomCmdModal) {
    btnCloseQaCustomModal.addEventListener('click', () => {
      editingCmdId = null;
      qaCustomCmdModal.classList.add('hidden');
    });
  }

  if (btnCancelCustomCmd && qaCustomCmdModal) {
    btnCancelCustomCmd.addEventListener('click', () => {
      editingCmdId = null;
      qaCustomCmdModal.classList.add('hidden');
    });
  }

  if (qaCustomCmdModal) {
    qaCustomCmdModal.addEventListener('click', (e) => {
      if (e.target === qaCustomCmdModal) {
        editingCmdId = null;
        qaCustomCmdModal.classList.add('hidden');
      }
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

      if (editingCmdId) {
        const idx = quickCommands.findIndex(c => c.id === editingCmdId);
        if (idx !== -1) {
          quickCommands[idx] = {
            ...quickCommands[idx],
            label: label,
            command: command
          };
          saveQuickCommands();
          renderQuickCommands();
          showToast(`Befehl '${label}' aktualisiert!`, 'success');
        }
        editingCmdId = null;
      } else {
        quickCommands.push({
          id: 'cmd-' + Date.now(),
          label: label,
          command: command,
          isDefault: false
        });
        saveQuickCommands();
        renderQuickCommands();
        showToast(`Quick-Command '${label}' hinzugefügt!`, 'success');
      }

      if (qaCustomCmdModal) qaCustomCmdModal.classList.add('hidden');
    });
  }

  [inputCustomCmdLabel, inputCustomCmdText].forEach(inp => {
    if (inp) {
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (btnSaveCustomCmd) btnSaveCustomCmd.click();
        }
      });
    }
  });

  // Initialize YouTube Video Finder
  setupYouTubeVideoFinder();
}
