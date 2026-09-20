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
const modChatQuickReplyModal = document.getElementById('mod-chat-quick-reply-modal');
const btnCloseModChatQuickReply = document.getElementById('btn-close-mod-chat-quick-reply');
const btnCancelModChatQuickReply = document.getElementById('btn-cancel-mod-chat-quick-reply');
const btnSendModChatQuickReply = document.getElementById('btn-send-mod-chat-quick-reply');
const inputModChatQuickReply = document.getElementById('input-mod-chat-quick-reply');
const modChatQuickReplySender = document.getElementById('mod-chat-quick-reply-sender');
const modChatQuickReplyOriginalText = document.getElementById('mod-chat-quick-reply-original-text');
let pendingModChatQuickReplyMessage = null;

// Channel-scoped moderator presence
const btnToggleModPresence = document.getElementById('btn-toggle-mod-presence');
const btnCloseModPresence = document.getElementById('btn-close-mod-presence');
const modPresencePopover = document.getElementById('mod-presence-popover');
const modPresenceList = document.getElementById('mod-presence-list');
const modPresenceOnlineCount = document.getElementById('mod-presence-online-count');
const MOD_PRESENCE_ONLINE_MS = 90 * 1000;
let modPresenceHeartbeatInterval = null;
let modPresenceRefreshInterval = null;

function isModPresenceOnline(user, now = Date.now()) {
  const lastSeen = new Date(user?.last_seen_at || 0).getTime();
  return Number.isFinite(lastSeen) && now - lastSeen <= MOD_PRESENCE_ONLINE_MS;
}

function formatModPresenceLastSeen(value) {
  const timestamp = new Date(value || 0).getTime();
  if (!Number.isFinite(timestamp)) return 'Zuletzt gesehen: unbekannt';
  const elapsedMinutes = Math.max(1, Math.round((Date.now() - timestamp) / 60000));
  if (elapsedMinutes < 60) return `Zuletzt gesehen vor ${elapsedMinutes} Min.`;
  return `Zuletzt gesehen ${new Date(timestamp).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}`;
}

function renderModPresence(users) {
  if (!modPresenceList) return;
  const now = Date.now();
  const collator = new Intl.Collator('de', { sensitivity: 'base' });
  const sorted = [...(Array.isArray(users) ? users : [])].sort((a, b) => {
    const onlineDifference = Number(isModPresenceOnline(b, now)) - Number(isModPresenceOnline(a, now));
    if (onlineDifference) return onlineDifference;
    return collator.compare(a.display_name || a.login || '', b.display_name || b.login || '');
  });
  const onlineCount = sorted.filter(user => isModPresenceOnline(user, now)).length;
  if (modPresenceOnlineCount) modPresenceOnlineCount.textContent = String(onlineCount);

  if (sorted.length === 0) {
    modPresenceList.innerHTML = '<div class="mod-presence-empty">Noch keine Mods für diesen Kanal erfasst.</div>';
    return;
  }

  modPresenceList.innerHTML = sorted.map(user => {
    const online = isModPresenceOnline(user, now);
    const name = user.display_name || user.login || 'Unbekannt';
    const login = user.login || '';
    const fallback = getInitialsAvatarSvg(name, online ? '#22c55e' : '#64748b');
    const avatar = user.avatar_url || fallback;
    return `
      <div class="mod-presence-user ${online ? 'is-online' : 'is-offline'}">
        <img src="${escapeHtml(avatar)}" alt="" class="mod-presence-avatar" data-fallback="${escapeHtml(fallback)}">
        <span class="mod-presence-status-dot" aria-label="${online ? 'Online' : 'Offline'}"></span>
        <span class="mod-presence-user-text">
          <strong>${escapeHtml(name)}</strong>
          <small>${login ? `@${escapeHtml(login)} · ` : ''}${online ? 'Online' : escapeHtml(formatModPresenceLastSeen(user.last_seen_at))}</small>
        </span>
      </div>`;
  }).join('');

  modPresenceList.querySelectorAll('.mod-presence-avatar').forEach(image => {
    image.addEventListener('error', () => {
      image.src = image.dataset.fallback || '';
      image.removeAttribute('data-fallback');
    }, { once: true });
  });
}

async function refreshModPresence() {
  if (!state.twitchUser || !isCurrentUserModerator()) {
    renderModPresence([]);
    return;
  }
  try {
    const result = await ipcRenderer.invoke('modchat:get-presence');
    if (result?.success) renderModPresence(result.users);
    else if (modPresenceList && !modPresencePopover?.classList.contains('hidden')) {
      modPresenceList.innerHTML = '<div class="mod-presence-empty">Anwesenheit ist momentan nicht erreichbar.</div>';
    }
  } catch (_) {}
}

async function sendModPresenceHeartbeat() {
  if (!state.twitchUser || !isCurrentUserModerator()) return;
  try {
    const result = await ipcRenderer.invoke('modchat:presence-heartbeat');
    if (result?.success) await refreshModPresence();
  } catch (_) {}
}

function closeModPresence() {
  if (!modPresencePopover || !btnToggleModPresence) return;
  modPresencePopover.classList.add('hidden');
  btnToggleModPresence.setAttribute('aria-expanded', 'false');
}

function startModPresenceTracking() {
  if (modPresenceHeartbeatInterval) clearInterval(modPresenceHeartbeatInterval);
  if (modPresenceRefreshInterval) clearInterval(modPresenceRefreshInterval);
  sendModPresenceHeartbeat();
  modPresenceHeartbeatInterval = setInterval(sendModPresenceHeartbeat, 30000);
  modPresenceRefreshInterval = setInterval(refreshModPresence, 15000);
}

btnToggleModPresence?.addEventListener('click', event => {
  event.stopPropagation();
  const opens = modPresencePopover?.classList.contains('hidden');
  if (opens) {
    modPresencePopover.classList.remove('hidden');
    btnToggleModPresence.setAttribute('aria-expanded', 'true');
    refreshModPresence();
  } else {
    closeModPresence();
  }
});
btnCloseModPresence?.addEventListener('click', closeModPresence);
document.addEventListener('click', event => {
  if (!modPresencePopover?.classList.contains('hidden') && !modPresencePopover.contains(event.target) && !btnToggleModPresence?.contains(event.target)) {
    closeModPresence();
  }
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeModPresence();
});
window.addEventListener('swg:auth-changed', () => startModPresenceTracking());

// 7TV Emote State & Elements
const btnToggle7tvPicker = document.getElementById('btn-toggle-7tv-picker');
const modChat7tvPopover = document.getElementById('mod-chat-7tv-popover');
const input7tvSearch = document.getElementById('input-7tv-search');
const btnClose7tvPopover = document.getElementById('btn-close-7tv-popover');
const grid7tvEmotes = document.getElementById('grid-7tv-emotes');
let sevenTvEmoteMap = new Map();
let sevenTvEmoteList = [];

function renderModChatMessageWithEmotes(rawText) {
  if (!rawText) return '';
  if (sevenTvEmoteMap.size === 0) {
    return escapeHtml(rawText);
  }

  // Tokenize by whitespace while preserving whitespace delimiters
  const tokens = String(rawText).split(/(\s+)/);
  return tokens.map(token => {
    if (/^\s+$/.test(token)) {
      return token;
    }
    const emote = sevenTvEmoteMap.get(token);
    if (emote && emote.url) {
      return `<img src="${escapeHtml(emote.url)}" alt="${escapeHtml(token)}" title="${escapeHtml(token)}" class="chat-7tv-emote" loading="lazy">`;
    }
    return escapeHtml(token);
  }).join('');
}

async function loadSevenTvEmotes(channelLogin = '') {
  try {
    const targetChan = channelLogin || (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved';
    const res = await ipcRenderer.invoke('seventv:get-emotes', targetChan);
    if (res && res.success && Array.isArray(res.emotes)) {
      sevenTvEmoteList = res.emotes;
      sevenTvEmoteMap.clear();
      for (const em of res.emotes) {
        if (em && em.name) {
          sevenTvEmoteMap.set(em.name, em);
        }
      }
      populateSevenTvPicker();
      if (lastLoadedModChatMessages && lastLoadedModChatMessages.length > 0) {
        lastMessagesSignature = '';
        renderModChatMessages(lastLoadedModChatMessages);
      }
    }
  } catch (err) {
    console.warn('[7TV] Error loading emotes in renderer:', err.message);
  }
}

function populateSevenTvPicker(filterQuery = '') {
  if (!grid7tvEmotes) return;
  const q = (filterQuery || '').trim().toLowerCase();
  const filtered = q
    ? sevenTvEmoteList.filter(e => e.name.toLowerCase().includes(q))
    : sevenTvEmoteList;

  if (filtered.length === 0) {
    grid7tvEmotes.innerHTML = `<div class="popover-7tv-status">${sevenTvEmoteList.length === 0 ? 'Lade 7TV Emotes...' : 'Kein passendes Emote gefunden'}</div>`;
    return;
  }

  grid7tvEmotes.innerHTML = filtered.slice(0, 160).map(em => `
    <div class="item-7tv-emote" data-name="${escapeHtml(em.name)}" title="${escapeHtml(em.name)}">
      <img src="${escapeHtml(em.url)}" alt="${escapeHtml(em.name)}" loading="lazy">
    </div>
  `).join('');

  grid7tvEmotes.querySelectorAll('.item-7tv-emote').forEach(item => {
    item.addEventListener('click', () => {
      const name = item.getAttribute('data-name');
      if (name && inputModChat) {
        const cur = inputModChat.value;
        const separator = (cur.length > 0 && !cur.endsWith(' ')) ? ' ' : '';
        inputModChat.value = `${cur}${separator}${name} `;
        resizeChatComposer(inputModChat);
        inputModChat.focus();
      }
    });
  });
}

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
let lastLoadedModChatMessages = [];

const modAvatarCache = new Map();

function getInitialsAvatarSvg(name, color = '#7c3aed') {
  const clean = (name || 'Mod').replace(/^@/, '').trim();
  const letter = clean.charAt(0).toUpperCase() || 'M';
  const bg = color || '#7c3aed';
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="${encodeURIComponent(bg)}"/><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif" font-size="28" font-weight="800" fill="%23ffffff">${encodeURIComponent(letter)}</text></svg>`;
}

function getActiveModInfo() {
  const customColor = localStorage.getItem('swg_user_color') || state.twitchUser?.color || '#FF7F00';
  const customModName = localStorage.getItem('swg_custom_mod_name');
  const senderName = customModName || (state.twitchUser?.display_name || state.twitchUser?.login || 'Mod');
  const senderAvatar = state.twitchUser?.profile_image_url
    ? state.twitchUser.profile_image_url
    : getInitialsAvatarSvg(senderName, customColor);

  return { name: senderName, avatar: senderAvatar, color: customColor };
}

function resizeChatComposer(input) {
  if (!input) return;
  input.style.height = 'auto';
  const styles = getComputedStyle(input);
  const lineHeight = parseFloat(styles.lineHeight) || 20;
  const minHeight = parseFloat(styles.minHeight) || 58;
  const verticalPadding = (parseFloat(styles.paddingTop) || 0) + (parseFloat(styles.paddingBottom) || 0);
  const maxHeight = (lineHeight * 4) + verticalPadding + 2;
  input.style.height = `${Math.max(minHeight, Math.min(input.scrollHeight, maxHeight))}px`;
  input.style.overflowY = input.scrollHeight > maxHeight ? 'auto' : 'hidden';
}

function startModChatReply(message) {
  if (!inputModChat || !message) return;
  const replyHeader = buildModChatReplyHeader(message);
  const existingText = inputModChat.value.trim();
  inputModChat.value = `${replyHeader}\n${existingText}`;
  resizeChatComposer(inputModChat);
  inputModChat.focus();
  inputModChat.setSelectionRange(inputModChat.value.length, inputModChat.value.length);
}

function buildModChatReplyHeader(message) {
  const sender = String(message?.senderName || 'Mod').replace(/[\]\r\n]/g, '').trim() || 'Mod';
  const quotedText = String(message?.text || '').replace(/\s+/g, ' ').trim().slice(0, 140);
  return `[Antwort auf @${sender}] ${quotedText}`;
}

function closeModChatQuickReply() {
  if (modChatQuickReplyModal) modChatQuickReplyModal.classList.add('hidden');
  if (inputModChatQuickReply) inputModChatQuickReply.value = '';
  pendingModChatQuickReplyMessage = null;
}

function openModChatQuickReply(message) {
  if (!modChatQuickReplyModal || !message) return;
  pendingModChatQuickReplyMessage = message;
  if (modChatQuickReplySender) modChatQuickReplySender.textContent = `@${message.senderName || 'Mod'}`;
  if (modChatQuickReplyOriginalText) modChatQuickReplyOriginalText.textContent = message.text || '';
  if (inputModChatQuickReply) inputModChatQuickReply.value = '';
  modChatQuickReplyModal.classList.remove('hidden');
  setTimeout(() => inputModChatQuickReply?.focus(), 0);
}

async function submitModChatQuickReply() {
  if (!pendingModChatQuickReplyMessage || !inputModChatQuickReply) return;
  const answer = inputModChatQuickReply.value.trim();
  if (!answer) {
    showToast('Bitte schreibe zuerst eine Antwort.', 'error');
    inputModChatQuickReply.focus();
    return;
  }
  if (btnSendModChatQuickReply) btnSendModChatQuickReply.disabled = true;
  const text = `${buildModChatReplyHeader(pendingModChatQuickReplyMessage)}\n${answer}`;
  const sent = await postModChatText(text);
  if (btnSendModChatQuickReply) btnSendModChatQuickReply.disabled = false;
  if (sent) {
    closeModChatQuickReply();
    showToast('Antwort im Mod-Chat gesendet.', 'success');
  }
}

function startModHQSync() {
  updateModHQUserInfo();
  refreshModPresence();
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

    // Tone 2: G#5 (830.61 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(830.61, now + 0.12);
    gain2.gain.setValueAtTime(0.22, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.55);
  } catch (e) {}
}

let lastModChatCount = 0;
let lastKnownMessagesMap = new Map();

async function checkModChatNotifications() {
  if (!state.twitchUser) return;
  try {
    const res = await ipcRenderer.invoke('modchat:get-messages');
    if (res && res.success && Array.isArray(res.messages)) {
      const messages = res.messages;
      const count = messages.length;
      
      if (lastModChatCount === 0) {
        lastModChatCount = count;
        messages.forEach(m => lastKnownMessagesMap.set(m.id, true));
        return;
      }

      if (count > lastModChatCount) {
        const newMsgs = messages.filter(m => !lastKnownMessagesMap.has(m.id));
        newMsgs.forEach(m => lastKnownMessagesMap.set(m.id, true));
        lastModChatCount = count;

        const currentMod = getActiveModInfo();
        const otherMsgs = newMsgs.filter(m => m.senderName && m.senderName.toLowerCase() !== currentMod.name.toLowerCase());
        
        if (otherMsgs.length > 0) {
          playNotificationSound();
          if (currentActiveView !== 'view-modchat') {
            const latest = otherMsgs[otherMsgs.length - 1];
            showToast(`💬 Neue Mod-Nachricht von @${latest.senderName}: "${latest.text.substring(0, 40)}${latest.text.length > 40 ? '...' : ''}"`, 'info');
          }
        }
      } else if (currentActiveView === 'view-modchat') {
        renderModChatMessages(res.messages);
      }
    }
  } catch(e) {}
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
        const hasDashboardChat = (currentActiveView === 'view-custom-dashboard') && Boolean(document.getElementById('cw-modchat-messages'));
        const isActivelyInChat = ((currentActiveView === 'view-modchat') || hasDashboardChat) && isWindowFocused;

        // Notify only when the user is not already looking at the chat.
        // Foreground: actionable in-app toast. Background: native Windows notification.
        if (!isActivelyInChat) {
          playNotificationSound();
          const latest = newIncoming[newIncoming.length - 1];
          if (isWindowFocused) {
            const preview = latest.text.length > 60 ? latest.text.substring(0, 60) + '...' : latest.text;
            showToast(`💬 ${latest.senderName}: ${preview}  ·  Antworten`, 'info', {
              duration: 8000,
              ariaLabel: `Neue Mod-Chat-Nachricht von ${latest.senderName}. Zum Antworten anklicken.`,
              onClick: () => openModChatQuickReply(latest)
            });
          } else {
            ipcRenderer.invoke('app:notify-background', { kind: 'modchat', message: latest }).catch(() => {});
          }
        }

        if (currentActiveView === 'view-modchat') {
          renderModChatMessages(res.messages);
          lastSeenModChatTimestamp = Math.max(...newIncoming.map(m => m.timestamp || 0), Date.now());
        } else if (hasDashboardChat) {
          renderDashboardModChat(res.messages);
          lastSeenModChatTimestamp = Math.max(...newIncoming.map(m => m.timestamp || 0), Date.now());
        } else {
          newIncoming.forEach(msg => {
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
      } else {
        if (currentActiveView === 'view-modchat') {
          renderModChatMessages(res.messages);
        } else if (document.getElementById('cw-modchat-messages')) {
          renderDashboardModChat(res.messages);
        }
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
  try {
    const res = await ipcRenderer.invoke('modchat:get-messages');
    if (res && res.success && Array.isArray(res.messages)) {
      lastLoadedModChatMessages = res.messages;
      renderModChatMessages(res.messages);
      renderDashboardModChat(res.messages);
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

  messages.forEach((msg, messageIndex) => {
    const isOwn = currentUserName && msg.senderName && msg.senderName.toLowerCase() === currentUserName;
    const timeStr = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    const senderColor = isOwn ? (currentMod.color || msg.senderColor || '#FF7F00') : (msg.senderColor || '#00f0ff');
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

    const textStr = typeof msg.text === 'string' ? msg.text : '';
    const pinnwandMatch = textStr.match(/^\[HQ-(?:Absprache|Pinnwand) #([^\]]+)\]\s*([\s\S]*)$/i);
    const quoteMatch = textStr.match(/^\[(Twitch|YouTube) #([^·\s]+)\s*·\s*([^\]]+)\]\s*([\s\S]*)$/i);
    const replyMatch = textStr.match(/^\[Antwort auf @?([^\]]+)\]\s*([^\n]*)\n([\s\S]*)$/i);
    const replyControl = isOwn ? '' : `
      <button type="button" class="mod-chat-reply-btn" data-reply-index="${messageIndex}" title="Auf diese Nachricht antworten" aria-label="Auf Nachricht von ${escapeHtml(msg.senderName || 'Mod')} antworten">❞</button>
    `;

    if (pinnwandMatch) {
      const pChan = pinnwandMatch[1];
      const pBody = pinnwandMatch[2].trim();
      const isDeleted = !pBody || pBody === '[gelöscht]' || pBody === '[keine Absprache]' || pBody === '[entfernt]';
      html += `
        <div class="mod-chat-msg-row special-row ${isOwn ? 'outgoing' : 'incoming'}">
          <img src="${escapeHtml(avatarSrc)}" data-sender="${escapeHtml(cleanSender)}" alt="${escapeHtml(msg.senderName)}" class="chat-msg-avatar" onerror="this.onerror=null; this.src='${escapeHtml(fallbackSvg)}';">
          <div class="chat-bubble special-bubble pinnwand-bubble">
            <div class="special-bubble-header">
              <span class="special-tag pinnwand-tag">📌 HQ-Pinnwand #${escapeHtml(pChan)}</span>
              <span class="chat-time">${escapeHtml(timeStr)}</span>
            </div>
            <div class="special-bubble-content">
              ${isDeleted ? '<span class="special-deleted-note">Pinnwand für diesen Kanal geleert.</span>' : renderModChatMessageWithEmotes(pBody)}
            </div>
            <div class="special-bubble-footer">
              <span class="special-mod-signature">Gepinnt von <strong style="color:${escapeHtml(senderColor)}">${escapeHtml(msg.senderName || 'Mod')}</strong></span>
            </div>
          </div>
        </div>
      `;
    } else if (quoteMatch) {
      const platform = quoteMatch[1];
      const qChan = quoteMatch[2];
      const chatter = quoteMatch[3];
      const rest = quoteMatch[4];
      const [quoteLine, ...commentLines] = rest.split('\n');
      const modComment = commentLines.join('\n').trim();

      html += `
        <div class="mod-chat-msg-row special-row ${isOwn ? 'outgoing' : 'incoming'}">
          <img src="${escapeHtml(avatarSrc)}" data-sender="${escapeHtml(cleanSender)}" alt="${escapeHtml(msg.senderName)}" class="chat-msg-avatar" onerror="this.onerror=null; this.src='${escapeHtml(fallbackSvg)}';">
          <div class="chat-bubble special-bubble twitch-quote-bubble">
            ${replyControl}
            <div class="special-bubble-header">
              <span class="special-tag twitch-quote-tag">🟣 ${escapeHtml(platform)}-Zitat #${escapeHtml(qChan)}</span>
              <span class="chat-time">${escapeHtml(timeStr)}</span>
            </div>
            <div class="twitch-quote-box">
              <div class="twitch-quote-user">@${escapeHtml(chatter)}:</div>
              <div class="twitch-quote-text">${renderModChatMessageWithEmotes(quoteLine.trim())}</div>
            </div>
            ${modComment ? `
              <div class="twitch-quote-comment">
                <span class="chat-sender-name" style="color: ${escapeHtml(senderColor)}">${escapeHtml(msg.senderName || 'Mod')}:</span>
                <span class="chat-text">${renderModChatMessageWithEmotes(modComment)}</span>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    } else if (replyMatch) {
      const replySender = replyMatch[1].trim();
      const replyQuote = replyMatch[2].trim();
      const replyText = replyMatch[3].trim();
      html += `
        <div class="mod-chat-msg-row mod-reply-row ${isOwn ? 'outgoing' : 'incoming'}">
          <img src="${escapeHtml(avatarSrc)}" data-sender="${escapeHtml(cleanSender)}" alt="${escapeHtml(msg.senderName)}" class="chat-msg-avatar" onerror="this.onerror=null; this.src='${escapeHtml(fallbackSvg)}';">
          <div class="mod-reply-stack">
            <div class="mod-reply-preview" title="${escapeHtml(replyQuote)}">
              <strong>@${escapeHtml(replySender)}</strong>
              <span>${renderModChatMessageWithEmotes(replyQuote)}</span>
            </div>
            <div class="chat-bubble mod-reply-bubble">
              ${replyControl}
              <div class="chat-bubble-header">
                <span class="chat-sender-name" style="color: ${escapeHtml(senderColor)}">${escapeHtml(msg.senderName || 'Mod')}</span>
                <span class="chat-time">${escapeHtml(timeStr)}</span>
              </div>
              <div class="chat-text">${replyText ? renderModChatMessageWithEmotes(replyText) : '<em>Antwort</em>'}</div>
            </div>
          </div>
        </div>
      `;
    } else {
      html += `
        <div class="mod-chat-msg-row ${isOwn ? 'outgoing' : 'incoming'}">
          <img src="${escapeHtml(avatarSrc)}" data-sender="${escapeHtml(cleanSender)}" alt="${escapeHtml(msg.senderName)}" class="chat-msg-avatar" onerror="this.onerror=null; this.src='${escapeHtml(fallbackSvg)}';">
          <div class="chat-bubble">
            ${replyControl}
            <div class="chat-bubble-header">
              <span class="chat-sender-name" style="color: ${escapeHtml(senderColor)}">${escapeHtml(msg.senderName || 'Mod')}</span>
              <span class="chat-time">${escapeHtml(timeStr)}</span>
            </div>
            <div class="chat-text">${renderModChatMessageWithEmotes(msg.text)}</div>
          </div>
        </div>
      `;
    }
  });

  modChatMessages.innerHTML = html;
  modChatMessages.querySelectorAll('.mod-chat-reply-btn').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      startModChatReply(messages[Number(button.dataset.replyIndex)]);
    });
  });

  if (wasScrolledToBottom) {
    modChatMessages.scrollTop = modChatMessages.scrollHeight;
  }
}

async function postModChatText(text) {
  if (!text || !text.trim()) return false;
  const modInfo = getActiveModInfo();
  const msgObj = {
    id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
    senderName: modInfo.name,
    senderAvatar: modInfo.avatar,
    senderColor: modInfo.color,
    text,
    timestamp: Date.now()
  };
  try {
    const res = await ipcRenderer.invoke('modchat:send-message', msgObj);
    if (res && res.success && Array.isArray(res.messages)) {
      lastLoadedModChatMessages = res.messages;
      renderModChatMessages(res.messages);
      if (typeof renderDashboardModChat === 'function') renderDashboardModChat(res.messages);
      return true;
    } else {
      showToast('Fehler beim Senden der Nachricht: ' + (res && res.error ? res.error : 'Unbekannter Fehler'), 'error');
    }
  } catch(e) {
    showToast('Fehler beim Senden der Nachricht: ' + e.message, 'error');
  }
  return false;
}

async function sendModChatMessage() {
  if (!inputModChat) return;
  const text = inputModChat.value.trim();
  if (!text) return;
  const sent = await postModChatText(text);
  if (!sent) return;
  inputModChat.value = '';
  resizeChatComposer(inputModChat);
  inputModChat.focus();
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
  ipcRenderer.on('modchat:notification-clicked', (event, message) => {
    openModChatQuickReply(message);
  });
  if (btnCloseModChatQuickReply) btnCloseModChatQuickReply.addEventListener('click', closeModChatQuickReply);
  if (btnCancelModChatQuickReply) btnCancelModChatQuickReply.addEventListener('click', closeModChatQuickReply);
  if (btnSendModChatQuickReply) btnSendModChatQuickReply.addEventListener('click', submitModChatQuickReply);
  if (inputModChatQuickReply) {
    inputModChatQuickReply.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        submitModChatQuickReply();
      }
    });
  }

  if (btnRefreshModChat) {
    btnRefreshModChat.addEventListener('click', async () => {
      showToast('Aktualisiere Mod-Chat...', 'info');
      await loadModChatMessages();
      showToast('Mod-Chat aktualisiert!', 'success');
    });
  }

  if (btnClearModChat) {
    btnClearModChat.addEventListener('click', async () => {
      if (!confirm('Den gesamten Mod-Chat unwiderruflich leeren?')) return;
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
    inputModChat.addEventListener('input', () => resizeChatComposer(inputModChat));
    inputModChat.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendModChatMessage();
      }
    });
    resizeChatComposer(inputModChat);
  }

  // Quick Chat Emojis
  document.querySelectorAll('.btn-chat-emoji[data-emoji]').forEach(btn => {
    btn.addEventListener('click', () => {
      const emoji = btn.getAttribute('data-emoji');
      if (emoji && inputModChat) {
        inputModChat.value += emoji;
        resizeChatComposer(inputModChat);
        inputModChat.focus();
      }
    });
  });

  // 7TV Emote Picker Listeners
  if (btnToggle7tvPicker && modChat7tvPopover) {
    btnToggle7tvPicker.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = modChat7tvPopover.classList.toggle('hidden');
      if (!isHidden) {
        if (sevenTvEmoteList.length === 0) {
          loadSevenTvEmotes();
        }
        populateSevenTvPicker(input7tvSearch ? input7tvSearch.value : '');
        if (input7tvSearch) input7tvSearch.focus();
      }
    });
  }

  if (btnClose7tvPopover && modChat7tvPopover) {
    btnClose7tvPopover.addEventListener('click', () => {
      modChat7tvPopover.classList.add('hidden');
    });
  }

  if (input7tvSearch) {
    input7tvSearch.addEventListener('input', (e) => {
      populateSevenTvPicker(e.target.value);
    });
  }

  document.addEventListener('click', (e) => {
    if (modChat7tvPopover && !modChat7tvPopover.classList.contains('hidden')) {
      if (!modChat7tvPopover.contains(e.target) && e.target !== btnToggle7tvPicker) {
        modChat7tvPopover.classList.add('hidden');
      }
    }
  });

  // Initial load of 7TV emotes
  loadSevenTvEmotes().catch(() => {});

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
    const name = (inputEditModName ? inputEditModName.value.trim() : '') || (state.twitchUser?.display_name || state.twitchUser?.login || 'Mod');
    const color = inputEditModColor ? inputEditModColor.value : '#FF7F00';
    previewEditModBadge.textContent = name + ':';
    previewEditModBadge.style.color = color;
  }

  if (btnEditModName && modProfileModal) {
    btnEditModName.addEventListener('click', () => {
      const currentName = localStorage.getItem('swg_custom_mod_name') || '';
      const currentColor = localStorage.getItem('swg_user_color') || state.twitchUser?.color || '#FF7F00';

      if (inputEditModName) inputEditModName.value = currentName;
      if (inputEditModColor) inputEditModColor.value = currentColor.startsWith('#') ? currentColor : '#FF7F00';

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
      const newColor = inputEditModColor ? inputEditModColor.value : '#FF7F00';

      if (newName) {
        localStorage.setItem('swg_custom_mod_name', newName);
      } else {
        localStorage.removeItem('swg_custom_mod_name');
      }

      localStorage.setItem('swg_user_color', newColor);
      localStorage.setItem('swg_user_color_custom', 'true');
      if (state.twitchUser) state.twitchUser.color = newColor;
      ipcRenderer.invoke('twitch:set-color', newColor).catch(() => {});

      if (userColorPicker) userColorPicker.value = newColor;
      const previewModName = document.getElementById('preview-mod-name');
      if (previewModName) previewModName.style.color = newColor;

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
