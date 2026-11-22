(() => {
  'use strict';
  const root = document.getElementById('view-chatgames');
  if (!root || typeof ChatGamesCommands === 'undefined') return;

  const $ = id => document.getElementById(id);
  const status = $('cg-status');
  const picker = $('cg-picker');
  const lobby = $('cg-lobby');
  const games = $('cg-games');
  const controls = $('cg-controls');
  const general = $('cg-general');
  const settings = $('cg-settings');
  const lobbyTitle = $('cg-lobby-title');
  const lobbyHelp = $('cg-lobby-help');
  const backGames = $('cg-back-games');
  const viewerPanel = $('cg-viewer-panel');
  const viewer = $('cg-viewer');
  const chatToggle = $('cg-send-chat');
  let sending = false;
  let lastSentAt = 0;

  function setStatus(message, error = false) {
    status.textContent = message;
    status.classList.toggle('cg-status-error', error);
  }

  function setButtonsDisabled(disabled) {
    root.querySelectorAll('.cg-game, .cg-send').forEach(button => { button.disabled = disabled; });
  }

  function showPicker() {
    lobby.classList.add('hidden');
    picker.classList.remove('hidden');
    backGames.blur();
  }

  async function send(command) {
    if (!chatToggle.checked) {
      setStatus(`Vorschau: ${command} wurde nicht an den Chat gesendet.`);
      return true;
    }
    if (!state.twitchUser || !isCurrentUserModerator()) {
      setStatus('Bitte zuerst mit einem Mod-Konto bei Twitch anmelden.', true);
      return false;
    }
    if (sending || Date.now() - lastSentAt < 1100) {
      setStatus('ChatGames braucht mindestens eine Sekunde Abstand zwischen Befehlen.', true);
      return false;
    }
    if (['!cancel', '!home', '!dashboard', '!session reset'].includes(command)) {
      const consequence = command === '!session reset' ? 'setzt die aktuelle Session zurück' : 'beendet das aktuelle Spiel';
      if (!window.confirm(`${command} ${consequence}. Befehl senden?`)) return false;
    }
    sending = true;
    setButtonsDisabled(true);
    try {
      const result = await ipcRenderer.invoke('twitch:send-chat', {
        message: command,
        channel: state.targetChannel
      });
      if (!result?.success) throw new Error(result?.error || 'Twitch-Chat hat den Befehl nicht angenommen.');
      lastSentAt = Date.now();
      setStatus(`${command} an #${state.targetChannel} gesendet. Prüfe die Wirkung im ChatGames-Fenster.`);
      return true;
    } catch (error) {
      setStatus(error.message || 'Befehl konnte nicht gesendet werden.', true);
      return false;
    } finally {
      const remaining = Math.max(0, 1100 - (Date.now() - lastSentAt));
      window.setTimeout(() => {
        sending = false;
        setButtonsDisabled(false);
      }, remaining);
    }
  }

  function makeCommandRow(definition) {
    const row = document.createElement('div');
    row.className = 'cg-command';
    const info = document.createElement('div');
    info.className = 'cg-command-info';
    const label = document.createElement('strong');
    label.textContent = definition.label;
    const syntax = document.createElement('code');
    syntax.textContent = definition.command + (definition.type === 'button' ? '' : ' …');
    info.append(label, syntax);
    if (definition.hint) {
      const hint = document.createElement('small');
      hint.textContent = definition.hint;
      info.append(hint);
    }
    row.append(info);

    const action = document.createElement('div');
    action.className = 'cg-command-action';
    let input = null;
    if (definition.type === 'choice') {
      input = document.createElement('select');
      input.setAttribute('aria-label', definition.label);
      definition.values.forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        input.append(option);
      });
    } else if (definition.type !== 'button') {
      input = document.createElement('input');
      input.type = definition.type === 'number' ? 'number' : 'text';
      input.setAttribute('aria-label', definition.label);
      input.placeholder = definition.hint || 'Wert eingeben';
      if (definition.type === 'number') {
        input.min = String(definition.min);
        if (definition.max !== null) input.max = String(definition.max);
        input.step = '1';
      }
    }
    if (input) action.append(input);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'cg-send';
    button.dataset.label = definition.label;
    button.textContent = chatToggle.checked ? 'Senden' : 'Testen';
    button.setAttribute('aria-label', `${definition.label} ${chatToggle.checked ? 'senden' : 'testen'}`);
    button.addEventListener('click', async () => {
      try {
        const command = ChatGamesCommands.build(definition, input?.value);
        if (await send(command) && (command === '!home' || command === '!dashboard')) showPicker();
      } catch (error) {
        setStatus(error.message, true);
        input?.focus();
      }
    });
    if (input && input.tagName === 'INPUT') {
      input.addEventListener('keydown', event => {
        if (event.key === 'Enter') button.click();
      });
    }
    action.append(button);
    row.append(action);
    return row;
  }

  function renderList(container, definitions) {
    container.replaceChildren(...definitions.map(makeCommandRow));
  }

  function renderGames() {
    games.replaceChildren();
    const chatExamples = {
      hangman: 'a', trivia: '1 2 3 4', golf: '45 7', chess: 'e2e4',
      chatships: 'F7', memory: 'B4', chatdle: 'Wort', marbles: 'L / R',
      backseat: 'w a s d', sizeup: '2,5', tierlist: 'S', wordrush: 'Wort',
      feud: 'Antwort', brawl: 'B3', hotseat: '1 2 3 4', bossraid: 'zap',
      pixel: 'giraffe', mapguess: 'Japan', higherlower: 'h / l',
      price: '2,49', yearguess: '1969'
    };
    ChatGamesCommands.games.forEach(game => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'cg-game';
      card.dataset.game = game.id;
      const preview = document.createElement('span');
      preview.className = 'cg-game-preview';
      const icon = document.createElement('span');
      icon.className = 'cg-game-icon';
      icon.textContent = game.icon;
      const cta = document.createElement('span');
      cta.className = 'cg-game-cta';
      cta.textContent = 'Spiel-Lobby öffnen →';
      preview.append(icon, cta);
      const name = document.createElement('strong');
      name.textContent = game.label;
      const hint = document.createElement('span');
      hint.className = 'cg-game-hint';
      const hintLabel = document.createElement('span');
      hintLabel.textContent = 'Chat tippt ';
      hint.append(hintLabel);
      const example = document.createElement('code');
      example.textContent = chatExamples[game.id] || game.open;
      hint.append(example);
      card.append(preview, name, hint);
      card.addEventListener('click', () => openGame(game));
      games.append(card);
    });
  }

  async function openGame(game) {
    const preview = !chatToggle.checked;
    if (!(await send(game.open))) return;
    picker.classList.add('hidden');
    lobby.classList.remove('hidden');
    lobbyTitle.textContent = `${game.icon} ${game.label}`;
    lobbyHelp.textContent = preview
      ? `Vorschau für ${game.label}. Befehle werden nicht an den Chat gesendet.`
      : `${game.open} wurde gesendet. Stelle das Spiel ein und starte es mit !start.`;
    settings.replaceChildren();
    const aliases = (game.aliases || []).map(command => ({ command, label: 'Lobby erneut öffnen (Alias)', type: 'button' }));
    if (game.settings.length || aliases.length) renderList(settings, [...game.settings, ...aliases]);
    else {
      const hint = document.createElement('p');
      hint.className = 'cg-hint';
      hint.textContent = 'Für dieses Spiel listet der Modguide keine eigenen Einstellungen. Mit !start beginnt die Runde.';
      settings.append(hint);
    }
    const pausable = ['golf', 'chatships', 'memory', 'chatdle', 'sizeup', 'tierlist', 'brawl', 'hotseat', 'bossraid'];
    const relevantControls = ChatGamesCommands.controls.filter(item =>
      (item.command !== '!next' || game.id === 'trivia') &&
      (!['!pause', '!resume'].includes(item.command) || pausable.includes(game.id)) &&
      (!['!kick', '!unkick'].includes(item.command) || ['golf', 'marbles', 'hangman', 'brawl'].includes(game.id)) &&
      (item.command !== '!addtime' || game.id === 'chess')
    );
    renderList(controls, relevantControls);
    const relevantViewer = ChatGamesCommands.viewer.filter(item =>
      game.id === 'marbles' ? item.command !== '!guess' :
      game.id === 'hangman' ? item.command === '!guess' : false
    );
    viewerPanel.classList.toggle('hidden', !relevantViewer.length);
    viewerPanel.open = false;
    renderList(viewer, relevantViewer);
    setButtonsDisabled(sending);
    lobby.scrollIntoView({ block: 'start' });
  }

  backGames.addEventListener('click', () => {
    showPicker();
    setStatus('Spieleübersicht geöffnet.');
  });
  chatToggle.addEventListener('change', () => {
    root.querySelectorAll('.cg-send').forEach(button => {
      button.textContent = chatToggle.checked ? 'Senden' : 'Testen';
      button.setAttribute('aria-label', `${button.dataset.label} ${chatToggle.checked ? 'senden' : 'testen'}`);
    });
    setStatus(chatToggle.checked
      ? 'Chat-Versand aktiv. Klicks senden Befehle an Twitch.'
      : 'Vorschau aktiv. Klicks senden keine Chat-Nachrichten.');
  });
  renderGames();
  renderList(general, ChatGamesCommands.general);
})();
