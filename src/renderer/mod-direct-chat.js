(() => {
  'use strict';
  const panel = document.querySelector('#view-modchat .modhq-chat-panel');
  const teamMessages = document.getElementById('mod-chat-messages');
  const teamComposer = panel?.querySelector('.mod-chat-input-area');
  const clearTeam = document.getElementById('btn-clear-mod-chat');
  if (!panel || !teamMessages || !teamComposer) return;

  const make = (tag, className, text) => {
    const element = document.createElement(tag);
    element.className = className;
    if (text) element.textContent = text;
    return element;
  };
  const tabs = make('div', 'mod-direct-tabs');
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'Mod-HQ-Chats');
  const teamButton = make('button', 'active', 'Team-Chat');
  const directButton = make('button', '', 'Direktnachrichten');
  for (const button of [teamButton, directButton]) {
    button.type = 'button';
    button.setAttribute('role', 'tab');
    tabs.append(button);
  }
  panel.querySelector('.modhq-panel-header').after(tabs);

  const directPane = make('section', 'mod-direct-pane');
  directPane.setAttribute('role', 'tabpanel');
  directPane.hidden = true;
  const recipientRow = make('div', 'mod-direct-recipient');
  const recipientLabel = make('label', '', 'Nachricht an');
  recipientLabel.htmlFor = 'mod-direct-recipient';
  const recipient = make('select', 'input-field');
  recipient.id = 'mod-direct-recipient';
  recipientRow.append(recipientLabel, recipient);
  const status = make('p', 'mod-direct-status', 'Wähle einen Mod aus.');
  status.setAttribute('role', 'status');
  // Same look as the team chat: message stream, bubbles, avatars and composer reuse the Mod-Chat classes.
  const messages = make('div', 'mod-chat-messages mod-direct-messages');
  messages.setAttribute('aria-live', 'polite');
  const composer = make('div', 'mod-chat-input-area mod-direct-composer');
  const emojiRow = make('div', 'chat-quick-emojis');
  for (const emoji of ['🔥', '😂', '💨', '👀', '✅', '⚠️']) {
    const emojiButton = make('button', 'btn-chat-emoji', emoji);
    emojiButton.type = 'button';
    emojiButton.dataset.directEmoji = emoji;
    emojiRow.append(emojiButton);
  }
  const inputRow = make('div', 'chat-input-row');
  const input = document.createElement('textarea');
  input.rows = 1;
  input.maxLength = 1000;
  input.autocomplete = 'off';
  input.placeholder = 'Private Nachricht schreiben (Enter zum Senden, Umschalt+Enter für neue Zeile)...';
  input.setAttribute('aria-label', 'Private Nachricht');
  const send = make('button', 'btn btn-primary btn-chat-send');
  send.type = 'button';
  send.title = 'Private Nachricht senden';
  send.setAttribute('aria-label', 'Private Nachricht senden');
  const svgNs = 'http://www.w3.org/2000/svg';
  const sendIcon = document.createElementNS(svgNs, 'svg');
  sendIcon.setAttribute('class', 'icon-sm');
  sendIcon.setAttribute('viewBox', '0 0 24 24');
  const sendPath = document.createElementNS(svgNs, 'path');
  sendPath.setAttribute('fill', 'currentColor');
  sendPath.setAttribute('d', 'M2.01 21L23 12 2.01 3 2 10l15 2-15 2z');
  sendIcon.append(sendPath);
  send.append(sendIcon);
  inputRow.append(input, send);
  composer.append(emojiRow, inputRow);
  directPane.append(recipientRow, status, messages, composer);
  panel.append(directPane);

  let active = false;
  let generation = 0;
  let lastChannel = '';
  let loadingPeer = '';
  let sending = false;
  let unread = 0;
  let peers = new Map();
  let pendingPeer = '';

  const resize = () => { if (typeof resizeChatComposer === 'function') resizeChatComposer(input); };
  // Message text is only ever inserted as text nodes; 7TV emote names become <img> elements like in the team chat.
  function appendMessageText(target, text) {
    const emotes = typeof sevenTvEmoteMap !== 'undefined' ? sevenTvEmoteMap : null;
    for (const token of String(text).split(/(\s+)/)) {
      const emote = emotes && !/^\s*$/.test(token) ? emotes.get(token) : null;
      if (emote && emote.url) {
        const image = document.createElement('img');
        image.className = 'chat-7tv-emote';
        image.src = emote.url;
        image.alt = token;
        image.title = token;
        image.loading = 'lazy';
        target.append(image);
      } else if (token) {
        target.append(document.createTextNode(token));
      }
    }
  }

  function avatarFor(name, url, color) {
    const fallback = getInitialsAvatarSvg(name, color);
    const image = document.createElement('img');
    image.className = 'chat-msg-avatar';
    image.alt = name;
    image.src = url || fallback;
    image.addEventListener('error', () => { image.src = fallback; }, { once: true });
    return image;
  }

  function messageRow(item, ownId) {
    const outgoing = String(item.sender_user_id) === ownId;
    const own = typeof getActiveModInfo === 'function' ? getActiveModInfo() : { name: 'Du', color: '#FF7F00', avatar: '' };
    const peer = peers.get(String(item.sender_user_id)) || {};
    const name = outgoing ? own.name : (peer.display_name || item.sender_login || 'Mod');
    const color = outgoing ? (own.color || '#FF7F00') : '#00f0ff';
    const avatarUrl = outgoing ? own.avatar : peer.avatar_url;

    const row = make('div', `mod-chat-msg-row ${outgoing ? 'outgoing' : 'incoming'}`);
    const bubble = make('div', 'chat-bubble');
    const header = make('div', 'chat-bubble-header');
    const sender = make('span', 'chat-sender-name', name);
    sender.style.color = color;
    const created = new Date(item.created_at);
    const time = make('span', 'chat-time', created.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    time.title = created.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
    header.append(sender, time);
    const text = make('div', 'chat-text');
    appendMessageText(text, item.message || '');
    bubble.append(header, text);
    row.append(avatarFor(name, avatarUrl, color), bubble);
    return row;
  }

  function notice(text) {
    const box = make('div', 'chat-welcome-notice');
    box.append(make('span', '', text));
    return box;
  }

  function renderUnread() {
    directButton.textContent = unread > 0 ? `Direktnachrichten (${unread})` : 'Direktnachrichten';
    directButton.classList.toggle('has-unread', unread > 0);
  }
  const channel = () => String(state.targetChannel || '').toLowerCase().replace(/^#/, '');
  lastChannel = channel();

  function selectTab(direct) {
    active = direct;
    generation++;
    teamButton.classList.toggle('active', !direct);
    directButton.classList.toggle('active', direct);
    teamButton.setAttribute('aria-selected', String(!direct));
    directButton.setAttribute('aria-selected', String(direct));
    directPane.hidden = !direct;
    if (direct) { unread = 0; renderUnread(); }
    teamMessages.hidden = direct;
    teamComposer.hidden = direct;
    if (clearTeam) clearTeam.hidden = direct;
    if (direct) refreshRecipients();
  }

  async function refreshRecipients() {
    if (!active || !state.twitchUser || !isCurrentUserModerator()) return;
    const requested = generation;
    const previous = recipient.value;
    try {
      const result = await ipcRenderer.invoke('modchat:get-presence');
      if (requested !== generation) return;
      if (!result?.success) throw new Error(result?.error || 'Mod-Liste nicht verfügbar.');
      recipient.replaceChildren(new Option('Mod auswählen …', ''));
      const ownId = String(state.twitchUser.id || '');
      peers = new Map((result.users || []).map(user => [String(user.twitch_user_id || ''), user]));
      for (const user of result.users || []) {
        const id = String(user.twitch_user_id || '');
        if (id && id !== ownId) recipient.add(new Option(user.display_name || user.login || id, id));
      }
      recipient.value = pendingPeer || previous;
      if (pendingPeer && recipient.value === pendingPeer) messages.replaceChildren();
      pendingPeer = '';
      if (!recipient.value && previous) {
        messages.replaceChildren();
        status.textContent = 'Der ausgewählte Mod ist nicht mehr verfügbar.';
      } else if (!recipient.value) {
        status.textContent = recipient.options.length > 1 ? 'Wähle einen Mod aus.' : 'Noch keine anderen Mods für diesen Kanal registriert.';
      } else {
        await refreshMessages();
      }
    } catch (error) {
      if (requested === generation) status.textContent = error.message;
    }
  }

  async function refreshMessages() {
    if (!active || !recipient.value || loadingPeer === recipient.value) return;
    const requested = generation;
    const peer = recipient.value;
    loadingPeer = peer;
    try {
      const result = await ipcRenderer.invoke('modchat:get-direct-messages', peer);
      if (requested !== generation || recipient.value !== peer) return;
      if (!result?.success) throw new Error(result?.error || 'Nachrichten nicht verfügbar.');
      const wasAtBottom = messages.scrollHeight - messages.scrollTop - messages.clientHeight < 50;
      const peerName = recipient.selectedOptions[0]?.textContent || 'Mod';
      messages.replaceChildren(notice(`🔒 Privater Chat mit ${peerName} – nur ihr beide seht diese Nachrichten.`));
      const ownId = String(state.twitchUser?.id || '');
      for (const item of result.messages || []) messages.append(messageRow(item, ownId));
      if (messages.childElementCount === 1) messages.append(make('p', 'mod-direct-empty', 'Noch keine privaten Nachrichten mit diesem Mod.'));
      status.textContent = `Privat mit ${recipient.selectedOptions[0]?.textContent || 'Mod'}`;
      if (wasAtBottom) messages.scrollTop = messages.scrollHeight;
    } catch (error) {
      if (requested === generation) status.textContent = error.message;
    } finally {
      if (loadingPeer === peer) loadingPeer = '';
    }
  }

  async function sendMessage() {
    const peer = recipient.value;
    const message = input.value.trim();
    if (!peer || !message || sending) return;
    sending = true;
    send.disabled = true;
    try {
      const result = await ipcRenderer.invoke('modchat:send-direct-message', { recipientId: peer, message });
      if (!result?.success) throw new Error(result?.error || 'Nachricht konnte nicht gesendet werden.');
      input.value = '';
      resize();
      await refreshMessages();
      messages.scrollTop = messages.scrollHeight;
    } catch (error) {
      status.textContent = error.message;
    } finally {
      sending = false;
      send.disabled = false;
    }
  }

  teamButton.addEventListener('click', () => selectTab(false));
  directButton.addEventListener('click', () => selectTab(true));
  recipient.addEventListener('change', () => {
    generation++;
    messages.replaceChildren();
    status.textContent = recipient.value ? 'Lade private Nachrichten …' : 'Wähle einen Mod aus.';
    refreshMessages();
  });
  send.addEventListener('click', sendMessage);
  input.addEventListener('input', resize);
  emojiRow.addEventListener('click', event => {
    const emoji = event.target.closest('[data-direct-emoji]')?.dataset.directEmoji;
    if (!emoji) return;
    const separator = input.value && !input.value.endsWith(' ') ? ' ' : '';
    input.value = `${input.value}${separator}${emoji} `;
    resize();
    input.focus();
  });
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });
  window.addEventListener('swg:auth-changed', () => {
    generation++;
    recipient.replaceChildren();
    messages.replaceChildren();
    if (active) refreshRecipients();
  });
  // Used by the global inbox watcher (05-mod-hq.js) for notifications and quick replies.
  window.swgDirectChat = {
    isViewingPeer: peerId => active && panel.getClientRects().length > 0 && recipient.value === String(peerId || ''),
    addUnread(count) {
      if (active && panel.getClientRects().length > 0) return;
      unread += Number(count) || 0;
      renderUnread();
    },
    refresh() { if (active) refreshMessages(); },
    // Opens the private chat with one mod (e.g. after tapping a push notification).
    openPeer(peerId) {
      pendingPeer = String(peerId || '');
      selectTab(true);
    }
  };

  setInterval(() => {
    if (channel() !== lastChannel) {
      lastChannel = channel();
      generation++;
      recipient.replaceChildren();
      messages.replaceChildren();
      if (active) refreshRecipients();
    } else if (active && panel.getClientRects().length > 0) {
      refreshMessages();
    }
  }, 5000);
  selectTab(false);
})();
