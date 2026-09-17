// =========================================================================
// GIVEAWAYS & 2-STUFEN DSGVO-ADRESSVERSAND LOGIC
// =========================================================================

let giveawaySyncInterval = null;
const notifiedTodayWinners = new Set();

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function announceWinnerWithCountdown(winnerObj) {
  const sendChat = chkGwSendChat ? chkGwSendChat.checked : true;
  if (!sendChat || !state.twitchUser || !winnerObj) return;

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
    await ipcRenderer.invoke('twitch:send-chat', { message: 'Der Gewinner wird gewählt... 🎰', channel });
    await sleep(1000);
    await ipcRenderer.invoke('twitch:send-chat', { message: '3...', channel });
    await sleep(1000);
    await ipcRenderer.invoke('twitch:send-chat', { message: '2...', channel });
    await sleep(1000);
    await ipcRenderer.invoke('twitch:send-chat', { message: '1...', channel });
    await sleep(1000);
    await ipcRenderer.invoke('twitch:send-chat', { message: winChatMsg, channel });
    showToast(`🎉 Gewinner ausgelost & live im Twitch-Chat verkündet: @${winnerObj.displayName}!`, 'success');
  } catch(e) {
    showToast(`🎉 Gewinner ausgelost: ${winnerObj.displayName}!`, 'success');
  }
}

const giveawayState = {
  isActive: false,
  prize: '',
  mode: 'keyword',
  keyword: '!join',
  participants: new Map(),
  currentWinner: null,
  winnersHistory: [],
  addressDraftDirty: false,
  addressDraftWinnerId: null,
  latestAddressWinner: null,
  addressPrivacyRevealed: false,
  revealedHistoryAddresses: new Set()
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
const btnDiscardWinnerAddress = document.getElementById('btn-discard-winner-address');
const btnFinishGiveaway = document.getElementById('btn-finish-giveaway');

// Winner queue / history
const winnersHistoryList = document.getElementById('winners-history-list');
const btnRefreshWinnersHistory = document.getElementById('btn-refresh-winners-history');

const KNOWN_BOTS = ['nightbot', 'streamelements', 'moobot', 'wizebot', 'fossabot', 'marvedbot', 'bot', 'soundbot', 'chatterino', 'streamlabs'];

function isWinnerFromToday(winner) {
  if (!winner) return false;
  const rawDate = winner.created_at || winner.timestamp || winner.ended_at || winner.started_at || winner.won_at;
  if (!rawDate) return false;

  const d = new Date(rawDate);
  if (isNaN(d.getTime())) return false;

  const today = new Date().toLocaleDateString('de-DE');
  const wonAt = d.toLocaleDateString('de-DE');
  return today === wonAt;
}

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

  // Previous winners check (only exclude winners from today)
  if (chkGwExcludePrevWinners && chkGwExcludePrevWinners.checked) {
    if (giveawayState.winnersHistory) {
      const todayWinners = giveawayState.winnersHistory.filter(isWinnerFromToday);
      if (todayWinners.some(w => (w.username || w.user_login || w.user_name || '').toLowerCase() === login)) {
        return true;
      }
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
    if (typeof updateDashboardGiveawayWidget === 'function') updateDashboardGiveawayWidget();
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
  if (typeof updateDashboardGiveawayWidget === 'function') updateDashboardGiveawayWidget();
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
  if (typeof updateDashboardGiveawayWidget === 'function') updateDashboardGiveawayWidget();
}

async function startGiveawayRegistration() {
  notifiedTodayWinners.clear();
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

      // Announce winner in Twitch chat with countdown (if enabled)
      const sendChat = chkGwSendChat ? chkGwSendChat.checked : true;
      if (sendChat && state.twitchUser) {
        announceWinnerWithCountdown(winnerObj);
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

  const rawTime = winner.timestamp || winner.created_at || Date.now();
  const timeStr = new Date(rawTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const uname = winner.displayName || winner.display_name || winner.username || winner.user_name || winner.user_login || 'Gewinner';
  const cleanLogin = (winner.username || winner.user_login || winner.user_name || uname).toLowerCase().replace(/^@/, '').trim();
  
  const fallbackSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="%237c3aed"/><text x="50" y="65" font-size="42" font-weight="bold" fill="%23ffffff" text-anchor="middle" font-family="sans-serif">${cleanLogin.substring(0, 2).toUpperCase()}</text></svg>`;
  
  let avatarSrc = winner.avatar || winner.avatar_url;
  if (!avatarSrc || avatarSrc.includes('undefined') || avatarSrc.includes('user-default-pictures')) {
    avatarSrc = `https://unavatar.io/twitch/${cleanLogin}`;
  }

  winnerDisplayContainer.className = 'winner-hero-box celebrate';
  winnerDisplayContainer.innerHTML = `
    <div class="winner-card-inner">
      <img id="img-winner-avatar-hero" src="${escapeHtml(avatarSrc)}" alt="${escapeHtml(uname)}" class="winner-avatar-lg" onerror="this.onerror=null; this.src='${escapeHtml(fallbackSvg)}';">
      <div class="winner-details-col">
        <span class="winner-username-hero">${escapeHtml(uname)}</span>
        <span class="winner-time-badge">🏆 Gewonnen um ${escapeHtml(timeStr)} Uhr</span>
      </div>
    </div>
  `;

  if (winnerQuickActions) winnerQuickActions.classList.remove('hidden');

  // Asynchronously fetch high-res avatar from Twitch Helix if not available
  if (cleanLogin && (!winner.avatar || winner.avatar.includes('unavatar') || winner.avatar.includes('user-default'))) {
    ipcRenderer.invoke('twitch:get-user-info', cleanLogin).then(uRes => {
      if (uRes && uRes.user && uRes.user.profile_image_url) {
        winner.avatar = uRes.user.profile_image_url;
        const imgEl = document.getElementById('img-winner-avatar-hero');
        if (imgEl) imgEl.src = uRes.user.profile_image_url;
      }
    }).catch(() => {});
  }
}

function setGiveawayWorkspace(workspace) {
  const target = workspace === 'addresses' ? 'addresses' : 'live';
  if (target === 'live') {
    giveawayState.addressPrivacyRevealed = false;
    giveawayState.revealedHistoryAddresses.clear();
    document.querySelectorAll('.gw-private-inline.is-revealed').forEach(el => {
      el.classList.remove('is-revealed');
      el.setAttribute('aria-pressed', 'false');
    });
    updateAddressPrivacy(giveawayState.currentWinner);
  }
  document.querySelectorAll('[data-gw-workspace]').forEach(btn => {
    const active = btn.getAttribute('data-gw-workspace') === target;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', String(active));
  });
  document.querySelectorAll('[data-gw-panel]').forEach(panel => {
    const active = panel.getAttribute('data-gw-panel') === target;
    panel.classList.toggle('active', active);
    panel.hidden = !active;
  });
}

function updateGiveawayRulesCount() {
  const count = [chkGwExcludeBots, chkGwExcludeMods, chkGwExcludeWatchlist, chkGwExcludePrevWinners]
    .filter(input => input && input.checked).length;
  const badge = document.getElementById('gw-active-rules-count');
  if (badge) badge.textContent = `${count} aktiv`;
}

function updateAddressPrivacy(winner, forceProtected = false) {
  const privacyPanel = document.getElementById('winner-address-privacy');
  const privacyButton = document.getElementById('btn-toggle-address-privacy');
  if (!privacyPanel) return;

  const addr = winner?.address || {};
  const hasStoredAddress = Boolean(addr.fullName || addr.street || addr.zip || addr.city);
  const shouldProtect = hasStoredAddress || forceProtected;
  privacyPanel.classList.toggle('is-empty', !shouldProtect);
  privacyPanel.classList.toggle('is-protected', shouldProtect);
  privacyPanel.classList.toggle('is-revealed', shouldProtect && giveawayState.addressPrivacyRevealed);
  if (privacyButton) {
    privacyButton.setAttribute('aria-pressed', String(shouldProtect && giveawayState.addressPrivacyRevealed));
    privacyButton.title = giveawayState.addressPrivacyRevealed
      ? 'Persönliche Daten wieder ausblenden'
      : 'Persönliche Daten dauerhaft anzeigen';
  }
}

function renderAddressReview(winner) {
  if (!displayWinnerPrize) return;

  const groupCoalSize = document.getElementById('group-winner-coal-size');
  const selectCoalSize = document.getElementById('select-winner-coal-size');

  if (!winner) {
    giveawayState.addressPrivacyRevealed = false;
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
    if (groupCoalSize) groupCoalSize.classList.add('hidden');
    updateAddressPrivacy(null);
    return;
  }

  const isChannelPoints = winner.type === 'channel_points' || winner.prize?.toLowerCase().includes('kohle') || winner.prize?.toLowerCase().includes('zauber') || winner.prize?.toLowerCase().includes('würfel');
  displayWinnerPrize.textContent = isChannelPoints ? `⬛ ${winner.prize || '1KG Zauberwürfel FREE!'}` : `🎁 ${winner.prize || 'Shisha-Paket'}`;

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

  if (groupCoalSize) {
    if (isChannelPoints) {
      groupCoalSize.classList.remove('hidden');
      const coalVal = addr.coalSize || addr.coal_size || '26er';
      if (selectCoalSize) {
        selectCoalSize.value = coalVal.includes('27') ? '27er' : '26er';
      }
    } else {
      groupCoalSize.classList.add('hidden');
    }
  }

  updateAddressPrivacy(winner);
}

function getWinnerIdentity(winner) {
  if (!winner) return null;
  return winner.id || (winner.username || winner.user_name || winner.user_login || '').toLowerCase() || null;
}

function setAddressDraftDirty(isDirty) {
  giveawayState.addressDraftDirty = Boolean(isDirty);
  giveawayState.addressDraftWinnerId = isDirty ? getWinnerIdentity(giveawayState.currentWinner) : null;
  if (!isDirty) giveawayState.latestAddressWinner = null;
  if (btnSaveWinnerAddress) btnSaveWinnerAddress.textContent = isDirty ? '💾 Speichern *' : '💾 Speichern';
  if (btnDiscardWinnerAddress) btnDiscardWinnerAddress.disabled = !isDirty;
}

function isAddressDraftProtected() {
  return giveawayState.addressDraftDirty &&
    giveawayState.addressDraftWinnerId === getWinnerIdentity(giveawayState.currentWinner);
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
          
          if (isAddressDraftProtected()) {
            // Preserve the local address draft while live metadata and history keep syncing.
            giveawayState.latestAddressWinner = updated;
            giveawayState.currentWinner = { ...updated, address: giveawayState.currentWinner.address };
          } else {
            giveawayState.currentWinner = updated;
            renderAddressReview(updated);
          }

          if (hadNoAddress && nowHasAddress && !isAddressDraftProtected()) {
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
  if (!winnersHistoryList) return;
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
  const pendingCount = list.filter(w => w.status !== 'sent_to_telegram' && w.status !== 'shipped').length;
  const workCount = document.getElementById('gw-address-work-count');
  if (workCount) workCount.textContent = pendingCount;

  // Filter list
  let filtered = list;
  if (currentGiveawayTabFilter === 'giveaway') {
    filtered = list.filter(w => !isCpCheck(w));
  } else if (currentGiveawayTabFilter === 'channel_points') {
    filtered = list.filter(w => isCpCheck(w));
  }

  if (filtered.length === 0) {
    winnersHistoryList.innerHTML = '<div class="empty-list-placeholder">Keine Einträge für diesen Filter.</div>';
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
    const identity = String(w.id || w.username || w.user_name || w.user_login || '');
    const safeIdentity = escapeHtml(identity);
    const isSelected = getWinnerIdentity(w) === getWinnerIdentity(giveawayState.currentWinner);
    const isRevealed = giveawayState.revealedHistoryAddresses.has(identity);

    let statusHtml = '<span class="address-status-pill waiting">Wartend</span>';
    if (w.status === 'sent_to_telegram') statusHtml = '<span class="address-status-pill sent">✅ Telegram</span>';
    if (w.status === 'address_received' || w.status === 'address_submitted') statusHtml = '<span class="address-status-pill received">📥 Prüfen</span>';
    if (w.status === 'shipped') statusHtml = '<span class="address-status-pill shipped">📦 Verschickt</span>';

    const typeBadge = isChannelPoints
      ? '<span style="display:inline-block; font-size:0.65rem; font-weight:800; padding:2px 6px; border-radius:4px; background:rgba(124,58,237,0.25); color:#c4b5fd; border:1px solid rgba(124,58,237,0.4); margin-right:4px;">⬛ 1KG KOHLE</span>'
      : '<span style="display:inline-block; font-size:0.65rem; font-weight:800; padding:2px 6px; border-radius:4px; background:rgba(16,185,129,0.25); color:#6ee7b7; border:1px solid rgba(16,185,129,0.4); margin-right:4px;">🎁 GIVEAWAY</span>';

    const coalTag = (isChannelPoints && (addr.coalSize || addr.coal_size))
      ? `<span style="display:inline-block; font-size:0.65rem; font-weight:800; padding:1px 5px; border-radius:4px; background:#7c3aed; color:#fff; margin-left:4px;">${escapeHtml(addr.coalSize || addr.coal_size)}</span>`
      : '';

    html += `
      <article class="winner-history-item${isSelected ? ' is-selected' : ''}" data-id="${safeIdentity}" tabindex="0" role="button" aria-label="@${escapeHtml(w.username || w.user_name || w.user_login)} bearbeiten">
        <div class="gw-history-item-top">
          <span class="gw-history-user">@${escapeHtml(w.username || w.user_name || w.user_login)}</span>
          <span class="gw-history-time">${dateStr} ${timeStr}</span>
        </div>
        <div class="gw-history-prize">${typeBadge}${escapeHtml(w.prize || '1KG Zauberwürfel FREE!')}${coalTag}</div>
        <div class="gw-history-item-bottom">${statusHtml}</div>
        <div class="gw-history-private-row">
          <button class="gw-private-inline${isRevealed ? ' is-revealed' : ''}" type="button" data-private-id="${safeIdentity}" aria-pressed="${isRevealed}" title="Zum dauerhaften Ein- oder Ausblenden klicken"><span>👤 ${escapeHtml(recipient)}</span></button>
          <button class="gw-private-inline${isRevealed ? ' is-revealed' : ''}" type="button" data-private-id="${safeIdentity}" aria-pressed="${isRevealed}" title="Zum dauerhaften Ein- oder Ausblenden klicken"><span>🏠 ${escapeHtml(addrPreview)}</span></button>
        </div>
        <div class="gw-history-actions">
          <button class="btn btn-secondary btn-xs btn-load-winner" data-id="${safeIdentity}" title="In Adressmaske laden">Bearbeiten</button>
          <button class="btn-delete-cmd btn-delete-winner" data-id="${safeIdentity}" title="Löschen">✕</button>
        </div>
      </article>
    `;
  });

  winnersHistoryList.innerHTML = html;

  const loadWinner = (id) => {
    const found = giveawayState.winnersHistory.find(w => String(w.id || w.username || w.user_name || w.user_login || '') === id);
    if (!found) return;
    setAddressDraftDirty(false);
    giveawayState.addressPrivacyRevealed = false;
    giveawayState.currentWinner = found;
    renderWinnerHero(found);
    renderAddressReview(found);
    renderWinnersHistory(giveawayState.winnersHistory);
    showToast(`Eintrag @${found.username || found.user_name} in Adressprüfung geladen.`, 'info');
  };

  winnersHistoryList.querySelectorAll('.winner-history-item').forEach(item => {
    item.addEventListener('click', (event) => {
      if (event.target.closest('button')) return;
      loadWinner(event.currentTarget.getAttribute('data-id'));
    });
    item.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      loadWinner(event.currentTarget.getAttribute('data-id'));
    });
  });

  winnersHistoryList.querySelectorAll('.gw-private-inline').forEach(btn => {
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      const id = event.currentTarget.getAttribute('data-private-id');
      if (giveawayState.revealedHistoryAddresses.has(id)) giveawayState.revealedHistoryAddresses.delete(id);
      else giveawayState.revealedHistoryAddresses.add(id);
      winnersHistoryList.querySelectorAll('.gw-private-inline').forEach(privateBtn => {
        if (privateBtn.getAttribute('data-private-id') !== id) return;
        const revealed = giveawayState.revealedHistoryAddresses.has(id);
        privateBtn.classList.toggle('is-revealed', revealed);
        privateBtn.setAttribute('aria-pressed', String(revealed));
      });
    });
  });

  winnersHistoryList.querySelectorAll('.btn-load-winner').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      loadWinner(e.currentTarget.getAttribute('data-id'));
    });
  });

  winnersHistoryList.querySelectorAll('.btn-delete-winner').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = e.currentTarget.getAttribute('data-id');
      giveawayState.winnersHistory = giveawayState.winnersHistory.filter(w => String(w.id || w.username || w.user_name || w.user_login || '') !== id);
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

function getFormattedTelegramMessage(winner, isAddressUpdate = false) {
  if (!winner) return '';
  const addr = winner.address || {};
  const dateStr = new Date(winner.timestamp || Date.now()).toLocaleString('de-DE');
  const isChannelPoints = winner.type === 'channel_points' || winner.prize?.toLowerCase().includes('kohle') || winner.prize?.toLowerCase().includes('zauber');
  const activeProf = getActiveStreamerProfile();
  const streamerName = activeProf ? activeProf.name : 'Marvin';
  const twitchUser = winner.username || winner.user_name || winner.user_login || 'unbekannt';
  const updateNotice = isAddressUpdate
    ? 'ACHTUNG: ADRESSAKTUALISIERUNG\nBitte verwende ausschließlich diese neue Lieferadresse und nicht mehr die zuvor gesendeten Daten.\n\n'
    : '';

  const coalSize = addr.coalSize || addr.coal_size || '';

  if (isChannelPoints) {
    const coalDescription = coalSize
      ? (coalSize.includes('27') ? '27er Kohle (27 mm Big Cubes)' : '26er Kohle (26 mm Standard)')
      : 'noch nicht ausgewählt';
    return updateNotice +
      'Hallo, wir hatten wieder eine Einlösung für das kostenlose Kilo Magic Charcoal! 🙂\n\n' +
      'Hier die Adresse:\n\n' +
      `${addr.fullName || '—'}\n` +
      `${addr.street || '—'}\n` +
      `${addr.zip || '—'} ${addr.city || '—'}\n` +
      `${addr.country || 'Deutschland'}\n\n` +
      `Kohlegröße: ${coalDescription}`;
  }

  return updateNotice + `🎁 <b>NEUER GEWINNER - ${escapeHtml(streamerName)} Giveaway</b>\n` +
         `🏆 <b>Twitch-User:</b> @${escapeHtml(twitchUser)}\n` +
         `📦 <b>Gewinn:</b> ${escapeHtml(winner.prize || 'Shisha Paket')}\n` +
         `👤 <b>Empfänger:</b> ${escapeHtml(addr.fullName || '—')}\n` +
         `🏠 <b>Adresse:</b> ${escapeHtml(addr.street || '—')}, ${escapeHtml(addr.zip || '')} ${escapeHtml(addr.city || '')} (${escapeHtml(addr.country || 'Deutschland')})\n` +
         `📅 <b>Datum:</b> ${dateStr}\n` +
         `✅ <b>Status:</b> Adresse von Mod-Team geprüft & freigegeben`;
}

function setupGiveawaysListeners() {
  document.querySelectorAll('[data-gw-workspace]').forEach(btn => {
    btn.addEventListener('click', () => setGiveawayWorkspace(btn.getAttribute('data-gw-workspace')));
  });
  setGiveawayWorkspace('live');
  updateGiveawayRulesCount();

  const btnOpenWinnerAddress = document.getElementById('btn-open-winner-address');
  if (btnOpenWinnerAddress) {
    btnOpenWinnerAddress.addEventListener('click', () => {
      giveawayState.addressPrivacyRevealed = false;
      renderAddressReview(giveawayState.currentWinner);
      setGiveawayWorkspace('addresses');
    });
  }

  const btnToggleAddressPrivacy = document.getElementById('btn-toggle-address-privacy');
  if (btnToggleAddressPrivacy) {
    btnToggleAddressPrivacy.addEventListener('click', () => {
      giveawayState.addressPrivacyRevealed = !giveawayState.addressPrivacyRevealed;
      updateAddressPrivacy(giveawayState.currentWinner);
      if (giveawayState.addressPrivacyRevealed && inputWinnerFullname) inputWinnerFullname.focus();
    });
  }

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
  const manualRewardTypeInputs = document.querySelectorAll('input[name="manual_reward_type"]');
  const syncManualRewardPrize = () => {
    const rewardType = document.querySelector('input[name="manual_reward_type"]:checked')?.value || 'giveaway';
    const prizeInput = document.getElementById('input-manual-reward-prize');
    if (prizeInput) {
      prizeInput.value = rewardType === 'channel_points' ? '1KG Zauberwürfel FREE!' : 'Giveaway Gewinn';
    }
  };

  manualRewardTypeInputs.forEach(input => input.addEventListener('change', syncManualRewardPrize));

  if (btnOpenManual && modalManual) {
    btnOpenManual.addEventListener('click', () => {
      modalManual.classList.remove('hidden');
      const inputUser = document.getElementById('input-manual-reward-user');
      const giveawayType = document.querySelector('input[name="manual_reward_type"][value="giveaway"]');
      const postChatToggle = document.getElementById('chk-manual-reward-post-chat');
      if (giveawayType) giveawayType.checked = true;
      if (postChatToggle) postChatToggle.checked = false;
      syncManualRewardPrize();
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
      const rewardType = document.querySelector('input[name="manual_reward_type"]:checked')?.value || 'giveaway';
      const prize = document.getElementById('input-manual-reward-prize')?.value.trim() || (rewardType === 'channel_points' ? '1KG Zauberwürfel FREE!' : 'Giveaway Gewinn');
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
          type: rewardType,
          channel: chan,
          postToChat: postChat
        });

        if (res && res.success) {
          modalManual.classList.add('hidden');
          // Always copy via Electron's native clipboard; chat posting is optional.
          const copyResult = await ipcRenderer.invoke('app:copy-clipboard', res.claimUrl);
          if (!copyResult || !copyResult.success) {
            throw new Error('Der Link wurde erstellt, konnte aber nicht kopiert werden.');
          }
          showToast(
            postChat
              ? `✨ Adresslink für @${user} kopiert und im Chat gepostet!`
              : `📋 Adresslink für @${user} kopiert – du kannst ihn jetzt manuell schicken!`,
            'success'
          );
          // Refresh list
          await loadGiveawayWinnersHistory();
        } else {
          showToast(res?.error || 'Fehler beim Erstellen des Links', 'error');
        }
      } catch(err) {
        showToast(err.message || 'Fehler', 'error');
      } finally {
        btnSubmitManual.disabled = false;
        btnSubmitManual.textContent = '✨ Link erstellen & kopieren';
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
  const addressDraftInputs = [
    inputWinnerFullname,
    inputWinnerStreet,
    inputWinnerZip,
    inputWinnerCity,
    inputWinnerCountry,
    document.getElementById('select-winner-coal-size')
  ].filter(Boolean);
  addressDraftInputs.forEach(input => {
    input.addEventListener(input.tagName === 'SELECT' ? 'change' : 'input', () => {
      if (giveawayState.currentWinner) setAddressDraftDirty(true);
    });
  });

  if (btnSaveWinnerAddress) {
    btnSaveWinnerAddress.addEventListener('click', async () => {
      if (!giveawayState.currentWinner) {
        showToast('Kein aktiver Gewinner ausgewählt', 'error');
        return;
      }

      const selectCoalSize = document.getElementById('select-winner-coal-size');
      const addr = {
        fullName: inputWinnerFullname ? inputWinnerFullname.value.trim() : '',
        street: inputWinnerStreet ? inputWinnerStreet.value.trim() : '',
        zip: inputWinnerZip ? inputWinnerZip.value.trim() : '',
        city: inputWinnerCity ? inputWinnerCity.value.trim() : '',
        country: inputWinnerCountry ? inputWinnerCountry.value.trim() : 'Deutschland',
        coalSize: selectCoalSize ? selectCoalSize.value : (giveawayState.currentWinner.address?.coalSize || '')
      };

      giveawayState.currentWinner.address = addr;
      if (giveawayState.currentWinner.status === 'waiting_address' && addr.street) {
        giveawayState.currentWinner.status = 'address_received';
      }

      const saveResult = await ipcRenderer.invoke('giveaway:save-winner', giveawayState.currentWinner);
      if (!saveResult || !saveResult.success) {
        showToast(`Adresse konnte nicht gespeichert werden: ${saveResult?.error || 'Unbekannter Fehler'}`, 'error');
        return;
      }
      setAddressDraftDirty(false);
      giveawayState.addressPrivacyRevealed = false;
      renderAddressReview(giveawayState.currentWinner);
      await loadGiveawayWinnersHistory();
      showToast('Adresse erfolgreich gespeichert!', 'success');
    });
  }

  if (btnDiscardWinnerAddress) {
    btnDiscardWinnerAddress.addEventListener('click', async () => {
      if (!giveawayState.currentWinner || !giveawayState.addressDraftDirty) return;
      const currentIdentity = getWinnerIdentity(giveawayState.currentWinner);
      const databaseWinner = giveawayState.latestAddressWinner ||
        giveawayState.winnersHistory.find(w => getWinnerIdentity(w) === currentIdentity);
      setAddressDraftDirty(false);
      if (databaseWinner) {
        giveawayState.addressPrivacyRevealed = false;
        giveawayState.currentWinner = databaseWinner;
        renderWinnerHero(databaseWinner);
        renderAddressReview(databaseWinner);
      } else {
        await loadGiveawayWinnersHistory();
      }
      showToast('Ungespeicherte Adressänderungen verworfen', 'info');
    });
  }

  // Send to Telegram Bot Button (Freigeben & an Marvin senden)
  if (btnSendWinnerTelegram) {
    btnSendWinnerTelegram.addEventListener('click', async () => {
      if (!giveawayState.currentWinner) {
        showToast('Kein aktiver Gewinner ausgewählt', 'error');
        return;
      }

      const selectCoalSize = document.getElementById('select-winner-coal-size');
      const w = giveawayState.currentWinner;
      const isAddressUpdate = w.status === 'sent_to_telegram';
      w.address = {
        fullName: inputWinnerFullname ? inputWinnerFullname.value.trim() : '',
        street: inputWinnerStreet ? inputWinnerStreet.value.trim() : '',
        zip: inputWinnerZip ? inputWinnerZip.value.trim() : '',
        city: inputWinnerCity ? inputWinnerCity.value.trim() : '',
        country: inputWinnerCountry ? inputWinnerCountry.value.trim() : 'Deutschland',
        coalSize: selectCoalSize ? selectCoalSize.value : (w.address?.coalSize || '')
      };

      const text = getFormattedTelegramMessage(w, isAddressUpdate);

      showToast('Sende Datensatz an Marvins Telegram-Bot...', 'info');
      try {
        const res = await ipcRenderer.invoke('giveaway:send-telegram', { text });
        if (res && res.success) {
          w.status = 'sent_to_telegram';
          await ipcRenderer.invoke('giveaway:save-winner', w);
          giveawayState.addressPrivacyRevealed = false;
          renderAddressReview(w);
          loadGiveawayWinnersHistory();
          showToast(
            isAddressUpdate
              ? '⚠️ Aktualisierte Adresse erneut an Marvin (Telegram) übermittelt!'
              : '🚀 Gewinner & Adresse erfolgreich an Marvin (Telegram) übermittelt!',
            'success'
          );
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
      giveawayState.addressPrivacyRevealed = false;
      setAddressDraftDirty(false);
      renderParticipantsPool();
      renderWinnerHero(null);
      renderAddressReview(null);
      updateGiveawayStatus('offline');
      setGiveawayWorkspace('live');
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
      giveawayState.addressPrivacyRevealed = false;
      setAddressDraftDirty(false);
      renderParticipantsPool();
      renderWinnerHero(null);
      renderAddressReview(null);
      updateGiveawayStatus('offline');
      await loadGiveawayWinnersHistory();
      setGiveawayWorkspace('live');
      showToast('✨ Giveaway erfolgreich archiviert! Bereit für die nächste Runde.', 'success');
    });
  }

  // Filter changes update pool immediately
  [chkGwExcludeBots, chkGwExcludeMods, chkGwExcludeWatchlist, chkGwExcludePrevWinners].forEach(chk => {
    if (chk) {
      chk.addEventListener('change', () => {
        updateGiveawayRulesCount();
        renderParticipantsPool();
      });
    }
  });

  // Incoming Participant from Twitch IRC Listener
  ipcRenderer.on('giveaway:new-participant', (event, participant) => {
    if (!giveawayState.isActive) return;
    if (!participant || !participant.login) return;

    const login = participant.login.toLowerCase();
    const displayName = participant.displayName || participant.login;

    // Check if participant won today and exclude filter is active
    if (chkGwExcludePrevWinners && chkGwExcludePrevWinners.checked && giveawayState.winnersHistory) {
      const todayWinners = giveawayState.winnersHistory.filter(isWinnerFromToday);
      const isAlreadyWonToday = todayWinners.some(w => (w.username || w.user_login || w.user_name || '').toLowerCase() === login);

      if (isAlreadyWonToday) {
        if (!notifiedTodayWinners.has(login)) {
          const sendChat = chkGwSendChat ? chkGwSendChat.checked : true;
          if (sendChat && state.twitchUser) {
            const channel = (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved';
            const friendlyMsg = `@${displayName} Du hast heute schon gewonnen – gönn dir das! 🎉 Beim Stream mit Giveaway bist Du wieder dabei 🙌`;

            // Priority Cascade Delay (Priority 1: BazZTeeDJ -> Priority 2: FlashmobNBG -> Priority 3: Mod-Pool)
            const myLogin = (state.twitchUser?.login || '').toLowerCase().trim();
            let pDelay = 0;
            if (myLogin === 'bazzteedj' || myLogin === 'bazztee') {
              pDelay = 0;
            } else if (myLogin === 'flashmobnbg' || myLogin.includes('flashmob')) {
              pDelay = 2500;
            } else {
              pDelay = 5000 + Math.floor(Math.random() * 800);
            }

            setTimeout(() => {
              if (notifiedTodayWinners.has(login)) return;
              notifiedTodayWinners.add(login);
              ipcRenderer.invoke('twitch:send-chat', { message: friendlyMsg, channel }).catch(() => {});
            }, pDelay);
          }
        }
      }
    }

    giveawayState.participants.set(login, participant);
    renderParticipantsPool();
  });
}
