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
  const messages = make('div', 'mod-direct-messages');
  messages.setAttribute('aria-live', 'polite');
  const composer = make('div', 'mod-direct-composer');
  const input = make('textarea', 'input-field');
  input.rows = 2;
  input.maxLength = 1000;
  input.placeholder = 'Private Nachricht schreiben (Enter zum Senden)';
  input.setAttribute('aria-label', 'Private Nachricht');
  const send = make('button', 'btn btn-primary', 'Senden');
  send.type = 'button';
  composer.append(input, send);
  directPane.append(recipientRow, status, messages, composer);
  panel.append(directPane);

  let active = false;
  let generation = 0;
  let lastChannel = '';
  let loadingPeer = '';
  let sending = false;
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
      for (const user of result.users || []) {
        const id = String(user.twitch_user_id || '');
        if (id && id !== ownId) recipient.add(new Option(user.display_name || user.login || id, id));
      }
      recipient.value = previous;
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
      messages.replaceChildren();
      const ownId = String(state.twitchUser?.id || '');
      for (const item of result.messages || []) {
        const outgoing = String(item.sender_user_id) === ownId;
        const row = make('article', `mod-direct-message ${outgoing ? 'outgoing' : 'incoming'}`);
        const name = make('strong', '', outgoing ? 'Du' : `@${item.sender_login || 'Mod'}`);
        const body = make('span', '', item.message || '');
        const time = make('small', '', new Date(item.created_at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }));
        row.append(name, body, time);
        messages.append(row);
      }
      if (!messages.childElementCount) messages.append(make('p', 'mod-direct-empty', 'Noch keine privaten Nachrichten mit diesem Mod.'));
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
      await refreshMessages();
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
