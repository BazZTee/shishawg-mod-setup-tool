(() => {
  'use strict';
  const $ = id => document.getElementById(id), view = $('view-modchat');
  if (!view) return;
  const make = (tag, cls, text) => { const el = document.createElement(tag); el.className = cls; if (text) el.textContent = text; return el; };
  const btn = (text, fn) => { const b = make('button', 'btn btn-secondary', text); b.type = 'button'; b.addEventListener('click', fn); return b; };
  const profile = () => getActiveStreamerProfile();
  const settings = () => profile().hqChat || { twitch: true, youtube: profile().targetChannel === 'marved', defaultView: 'twitch', youtubeLiveUrl: '' };
  const channel = () => String(profile().targetChannel || '').replace(/^#/, '').toLowerCase();
  const sidebar = view.querySelector('.modhq-sidebar-panel');
  const layout = view.querySelector('.modhq-grid-container');
  const teamChat = view.querySelector('.modhq-chat-panel');

  // Fold accordion matching the sa-fold design in Stream Aktionen
  function fold(card, title, subtitle) {
    const wrap = make('section', 'hq-fold');
    const trigger = btn('', () => {
      const open = trigger.getAttribute('aria-expanded') !== 'true';
      trigger.setAttribute('aria-expanded', String(open));
      wrap.classList.toggle('is-open', open);
      panel.inert = !open;
    });
    trigger.className = 'hq-fold-trigger hq-fold-head';
    trigger.setAttribute('aria-expanded', 'false');

    const label = make('span', 'hq-fold-label');
    label.append(make('strong', '', title));
    if (subtitle) label.append(make('span', 'hq-fold-description', subtitle));

    trigger.append(label, make('span', 'hq-chevron', '⌄'));

    const panel = make('div', 'hq-fold-panel');
    panel.inert = true;
    const panelId = 'hq-panel-' + title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    trigger.setAttribute('aria-controls', panelId);
    panel.id = panelId;

    const inner = make('div', 'hq-fold-inner');
    inner.append(card);
    panel.append(inner);
    wrap.append(trigger, panel);
    return wrap;
  }

  const markers = $('markers-stream-list').closest('.modhq-card'), watch = $('watchlist-items-list').closest('.modhq-card');
  const publicCard = make('section', 'hq-public modhq-chat-panel');
  const heading = make('div', 'hq-heading modhq-panel-header');
  const publicHeadingInfo = make('div', 'chat-header-info');
  publicHeadingInfo.append(make('span', 'chat-header-avatar', '🌐'));
  const publicHeadingText = make('div', '');
  publicHeadingText.append(make('h3', '', 'Öffentlicher Chat'), make('span', 'chat-status-sub', 'Twitch & YouTube im Blick'));
  publicHeadingInfo.append(publicHeadingText);
  heading.append(publicHeadingInfo);

  const tabs = make('div', 'hq-chat-tabs');
  const twitch = btn('Twitch', () => choose('twitch')), youtube = btn('YouTube', () => choose('youtube'));
  tabs.append(twitch, youtube);

  const tw = make('div', 'hq-twitch'), yt = make('div', 'hq-youtube');
  const status = make('p', 'hq-status', 'Chat wird beim Öffnen verbunden.');
  status.setAttribute('role', 'status');

  const tools = make('div', 'hq-filter');
  const search = make('input', '');
  search.type = 'search';
  search.placeholder = 'Nutzer oder Nachricht filtern';
  search.setAttribute('aria-label', search.placeholder);

  const questions = btn('Nur Fragen', () => {
    onlyQuestions = !onlyQuestions;
    questions.setAttribute('aria-pressed', String(onlyQuestions));
    paint();
  });
  questions.setAttribute('aria-pressed', 'false');
  tools.append(search, questions);

  const log = make('div', 'hq-message-list');
  log.setAttribute('aria-label', 'Öffentliche Twitch-Nachrichten');
  const resume = btn('Zurück zu Live', () => { paused = false; pending = 0; paint(); });
  resume.hidden = true;

  const publicComposer = make('div', 'hq-public-composer');
  const publicInput = make('textarea', 'hq-public-input');
  publicInput.rows = 1;
  publicInput.maxLength = 500;
  publicInput.placeholder = 'In den Twitch-Chat schreiben (Enter zum Senden, Umschalt+Enter für neue Zeile)…';
  publicInput.setAttribute('aria-label', 'Nachricht in den öffentlichen Twitch-Chat');
  const publicSend = btn('Senden', () => sendPublicMessage());
  publicSend.className = 'btn btn-primary btn-chat-send hq-public-send';
  publicComposer.append(publicInput, publicSend);

  tw.append(status, tools, log, resume, publicComposer);

  const ytTip = make('div', 'hq-tip-box');
  ytTip.append(make('p', 'hq-help', 'Optional kannst du im Profil einen aktuellen YouTube-Livestream hinterlegen, um direkt dessen Chat zu öffnen.'));

  yt.append(
    make('h4', '', 'YouTube-Livechat'),
    make('p', 'hq-help', 'Der offizielle YouTube-Chat öffnet im Browser. Lesen und Antworten erfolgen dort mit deinem YouTube-Konto.'),
    btn('YouTube öffnen', () => openExternal(youtubeUrl())),
    ytTip
  );

  const empty = make('p', 'hq-help', 'Für dieses Profil sind keine öffentlichen Chats aktiviert. Aktiviere sie in den Profil-Einstellungen.');
  heading.append(tabs);
  publicCard.append(heading, tw, yt, empty);

  let activeTab = 'twitch', socket = null, identity = '', messages = [], paused = false, pending = 0, onlyQuestions = false, retryAt = 0, attempt = 0;

  async function openExternal(url) {
    try {
      await ipcRenderer.invoke('app:open-external', url);
    } catch {
      showToast('Chat konnte nicht geöffnet werden.', 'error');
    }
  }

  function youtubeUrl() {
    const value = settings().youtubeLiveUrl || '';
    try {
      const u = new URL(value);
      const host = u.hostname.replace(/^www\./, '');
      if (['youtube.com', 'youtu.be'].includes(host)) {
        const id = host === 'youtu.be' ? u.pathname.slice(1) : u.searchParams.get('v') || u.pathname.match(/^\/live\/([\w-]+)/)?.[1];
        if (id && /^[\w-]{11}$/.test(id)) return 'https://www.youtube.com/live_chat?v=' + id + '&is_popout=1';
      }
    } catch {}
    const handle = String(profile().youtubeChannels?.[0] || '').replace(/^https:\/\/(www\.)?youtube\.com\//, '').split('/')[0];
    return /^@[\w.\-]+$/.test(handle) ? 'https://www.youtube.com/' + handle + '/live' : /^UC[\w-]+$/.test(handle) ? 'https://www.youtube.com/channel/' + handle + '/live' : 'https://www.youtube.com/';
  }

  function choose(tab) {
    activeTab = tab;
    tw.hidden = tab !== 'twitch' || !settings().twitch;
    yt.hidden = tab !== 'youtube' || !settings().youtube;
    twitch.classList.toggle('active', tab === 'twitch');
    youtube.classList.toggle('active', tab === 'youtube');
    twitch.setAttribute('aria-pressed', String(tab === 'twitch'));
    youtube.setAttribute('aria-pressed', String(tab === 'youtube'));
  }

  const prefix = () => `[HQ-Absprache #${channel()}] `;
  const isPrefixMatch = t => typeof t === 'string' && (t.startsWith(`[HQ-Absprache #${channel()}] `) || t.startsWith(`[HQ-Pinnwand #${channel()}] `));
  const getNoteContent = t => {
    if (typeof t !== 'string') return '';
    const pref1 = `[HQ-Absprache #${channel()}] `;
    if (t.startsWith(pref1)) return t.slice(pref1.length).trim();
    const pref2 = `[HQ-Pinnwand #${channel()}] `;
    if (t.startsWith(pref2)) return t.slice(pref2.length).trim();
    return '';
  };
  const agreements = make('section', 'hq-agreements');

  const agHead = make('div', 'hq-agreements-header');
  agHead.append(
    make('h3', '', '📌 Angeheftete Pinnwand'),
    make('span', 'hq-agreements-desc', 'Aktuelle Infos, Stream-Motto & Notizen für das Mod-Team auf diesem Kanal. Für das Team synchronisiert.')
  );

  const agreementText = make('p', 'hq-help hq-agreement-text', 'Noch keine Notiz an der Pinnwand für diesen Kanal.');

  const deleteBtn = btn('Pinnwand leeren', async () => {
    if (!confirm('Möchtest du die angeheftete Pinnwand für diesen Kanal wirklich leeren?')) return;
    deleteBtn.disabled = true;
    try {
      const info = getActiveModInfo();
      const result = await ipcRenderer.invoke('modchat:send-message', {
        id: 'hq-' + Date.now() + '-' + Math.random().toString(36).slice(2),
        senderName: info.name,
        senderAvatar: info.avatar,
        senderColor: info.color,
        text: prefix() + '[gelöscht]',
        timestamp: Date.now()
      });
      if (!result?.success) throw Error(result?.error || 'Löschen fehlgeschlagen');
      editor.value = '';
      if (Array.isArray(result.messages)) {
        lastLoadedModChatMessages = result.messages;
        renderModChatMessages(result.messages);
      }
      syncAgreement();
      showToast('Pinnwand geleert.', 'info');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      deleteBtn.disabled = false;
    }
  });
  deleteBtn.className = 'btn btn-secondary btn-sm hq-btn-del-agreement';
  deleteBtn.hidden = true;

  const editor = make('textarea', 'hq-agreement-textarea');
  editor.rows = 2;
  editor.maxLength = 1000;
  editor.placeholder = 'Zum Beispiel: Marvin macht nach dem Köpfchen Schluss · Heute Chill-Stream · Max kommt ab 20:30';
  editor.setAttribute('aria-label', 'Neue Notiz für die Pinnwand');

  const publish = btn('An Pinnwand anheften', async () => {
    const text = editor.value.trim();
    if (!text) return;
    publish.disabled = true;
    try {
      const info = getActiveModInfo();
      const result = await ipcRenderer.invoke('modchat:send-message', {
        id: 'hq-' + Date.now() + '-' + Math.random().toString(36).slice(2),
        senderName: info.name,
        senderAvatar: info.avatar,
        senderColor: info.color,
        text: prefix() + text,
        timestamp: Date.now()
      });
      if (!result?.success) throw Error(result?.error || 'Speichern fehlgeschlagen');
      editor.value = '';
      if (Array.isArray(result.messages)) {
        lastLoadedModChatMessages = result.messages;
        renderModChatMessages(result.messages);
      }
      syncAgreement();
      showToast('Pinnwand aktualisiert!', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      publish.disabled = false;
    }
  });

  const editFold = make('details', 'hq-agreement-edit');
  editFold.append(make('summary', '', 'Pinnwand ändern'), editor, publish);

  agreements.append(agHead, agreementText, deleteBtn, editFold);
  const toolsGrid = make('div', 'hq-tools-grid');
  toolsGrid.append(
    fold(watch, 'Nutzervermerke & Chatter', 'Auffällige Chatter & Giveaway-Gewinner notieren'),
    fold(markers, 'Cutter-Marker', 'VOD-Zeitstempel für Video-Editor setzen & exportieren')
  );
  layout.replaceChildren(teamChat, publicCard, agreements, toolsGrid);
  sidebar.remove();

  function growComposer(input) {
    if (typeof resizeChatComposer === 'function') {
      resizeChatComposer(input);
      return;
    }
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 96)}px`;
  }

  async function sendPublicMessage() {
    const text = publicInput.value.trim();
    if (!text || publicSend.disabled) return;
    publicSend.disabled = true;
    try {
      const result = await ipcRenderer.invoke('twitch:send-chat', { message: text, channel: channel() });
      if (!result?.success) throw new Error(result?.error || 'Nachricht konnte nicht gesendet werden.');
      publicInput.value = '';
      growComposer(publicInput);
      showToast('Nachricht in den Twitch-Chat gesendet.', 'success');
    } catch (error) {
      showToast(error.message || 'Nachricht konnte nicht gesendet werden.', 'error');
    } finally {
      publicSend.disabled = false;
      publicInput.focus();
    }
  }

  publicInput.addEventListener('input', () => growComposer(publicInput));
  publicInput.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendPublicMessage();
    }
  });
  growComposer(publicInput);

  function syncAgreement() {
    const notes = lastLoadedModChatMessages.filter(m => isPrefixMatch(m.text));
    const latest = notes.reduce((best, item) => !best || Number(item.timestamp) > Number(best.timestamp) ? item : best, null);
    const rawContent = latest ? getNoteContent(latest.text) : '';
    const isDeleted = !rawContent || rawContent === '[gelöscht]' || rawContent === '[keine Absprache]' || rawContent === '[entfernt]';

    if (latest && !isDeleted) {
      const text = rawContent + ' — ' + (latest.senderName || 'Mod');
      if (agreementText.textContent !== text) agreementText.textContent = text;
      agreementText.classList.add('has-active-agreement');
      deleteBtn.hidden = false;
    } else {
      const text = 'Noch keine Notiz an der Pinnwand für diesen Kanal.';
      if (agreementText.textContent !== text) agreementText.textContent = text;
      agreementText.classList.remove('has-active-agreement');
      deleteBtn.hidden = true;
    }
  }

  let activePopover = null;
  function closeModPopover() {
    if (activePopover) {
      activePopover.remove();
      activePopover = null;
    }
  }
  document.addEventListener('click', (e) => {
    if (activePopover && !activePopover.contains(e.target) && !e.target.closest('.hq-chatter-clickable')) {
      closeModPopover();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && activePopover) {
      closeModPopover();
    }
  });

  function openModPopover(m, anchorEl) {
    closeModPopover();
    const pop = make('div', 'hq-mod-popover');

    const pHead = make('div', 'hq-pop-head');
    const pTitle = make('strong', 'hq-pop-title', '@' + m.name);
    const pClose = make('button', 'hq-pop-close-btn', '✕');
    pClose.type = 'button';
    pClose.title = 'Schließen';
    pClose.addEventListener('click', closeModPopover);
    pHead.append(pTitle, pClose);

    const pBody = make('div', 'hq-pop-body');

    const delMsgBtn = btn(m.deleted ? '🗑️ Bereits gelöscht' : '🗑️ Diese Nachricht löschen', async () => {
      closeModPopover();
      if (m.deleted) return;
      try {
        const res = await ipcRenderer.invoke('twitch:send-chat', {
          action: 'delete',
          messageId: m.id,
          channel: channel()
        });
        if (res && res.success === false) throw new Error(res.error || 'Fehler beim Löschen');
        m.deleted = true;
        paint();
        showToast('Nachricht gelöscht.', 'info');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
    delMsgBtn.className = 'btn btn-secondary btn-sm hq-pop-btn hq-pop-del-btn';
    if (m.deleted) {
      delMsgBtn.disabled = true;
      delMsgBtn.style.opacity = '0.5';
    }

    const toLabel = make('div', 'hq-pop-section-label', '⏱️ Timeout verpassen:');
    const toRow = make('div', 'hq-pop-timeout-row');
    const timeouts = [
      { label: '1m', sec: 60 },
      { label: '5m', sec: 300 },
      { label: '10m', sec: 600 },
      { label: '1h', sec: 3600 },
      { label: '24h', sec: 86400 }
    ];
    for (const t of timeouts) {
      const b = make('button', 'btn btn-secondary btn-sm hq-pop-chip', t.label);
      b.type = 'button';
      b.title = `${t.label} Timeout für @${m.name}`;
      b.addEventListener('click', async () => {
        closeModPopover();
        if (!m.userId) {
          showToast('Keine Twitch User-ID für diesen Chatter vorhanden.', 'warning');
          return;
        }
        try {
          const res = await ipcRenderer.invoke('twitch:send-chat', {
            action: 'timeout',
            userId: m.userId,
            duration: t.sec,
            channel: channel()
          });
          if (res && res.success === false) throw new Error(res.error || 'Timeout fehlgeschlagen');
          showToast(`Timeout (${t.label}) an @${m.name} erteilt.`, 'success');
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
      toRow.append(b);
    }

    const banBtn = btn('🔨 @' + m.name + ' dauerhaft bannen', async () => {
      if (!confirm(`Möchtest du @${m.name} wirklich dauerhaft auf diesem Kanal bannen?`)) return;
      closeModPopover();
      if (!m.userId) {
        showToast('Keine Twitch User-ID für diesen Chatter vorhanden.', 'warning');
        return;
      }
      try {
        const res = await ipcRenderer.invoke('twitch:send-chat', {
          action: 'ban',
          userId: m.userId,
          channel: channel()
        });
        if (res && res.success === false) throw new Error(res.error || 'Ban fehlgeschlagen');
        showToast(`@${m.name} wurde gebannt.`, 'warning');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
    banBtn.className = 'btn btn-secondary btn-sm hq-pop-btn hq-pop-ban-btn';

    const quoteBtn = btn('💬 Intern im Mod-Chat besprechen', () => {
      closeModPopover();
      const input = $('input-mod-chat');
      const quote = `[Twitch #${channel()} · ${m.name}] ${m.text}`;
      input.value += (input.value ? '\n' : '') + quote;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
    });
    quoteBtn.className = 'btn btn-secondary btn-sm hq-pop-btn';

    const watchBtn = btn('📋 Zu Nutzervermerke / Watchlist', () => {
      closeModPopover();
      const watchInput = $('watchlist-user-input');
      if (watchInput) {
        watchInput.value = m.name;
        watchInput.focus();
        showToast(`@${m.name} in Vermerke-Feld eingetragen.`, 'info');
      } else {
        showToast(`@${m.name} vorgemerkt.`, 'info');
      }
    });
    watchBtn.className = 'btn btn-secondary btn-sm hq-pop-btn';

    pBody.append(delMsgBtn, toLabel, toRow, banBtn, quoteBtn, watchBtn);
    pop.append(pHead, pBody);

    const rect = anchorEl.getBoundingClientRect();
    pop.style.top = (rect.bottom + window.scrollY + 4) + 'px';
    pop.style.left = Math.max(10, Math.min(window.innerWidth - 270, rect.left + window.scrollX)) + 'px';

    document.body.append(pop);
    activePopover = pop;
  }

  function paint() {
    const q = search.value.toLocaleLowerCase('de');
    log.replaceChildren();
    const shown = messages.filter(m => (!onlyQuestions || m.text.includes('?')) && (!q || (m.name + ' ' + m.text).toLocaleLowerCase('de').includes(q)));
    for (const m of shown) {
      const row = make('article', 'hq-message' + (m.deleted ? ' is-deleted' : ''));
      const headerRow = make('div', 'hq-msg-header');

      const chatterClickable = make('span', 'hq-chatter-clickable');
      chatterClickable.setAttribute('role', 'button');
      chatterClickable.setAttribute('tabindex', '0');
      chatterClickable.title = `Moderationsmenü für @${m.name} (Löschen, Timeout, Ban)`;
      const nameText = make('strong', 'hq-chatter-name-text', m.name);
      nameText.style.color = getChatterColor(m);
      const shieldIcon = make('span', 'hq-mod-shield-icon', '🛡️');
      chatterClickable.append(nameText, shieldIcon);
      chatterClickable.addEventListener('click', (e) => {
        e.stopPropagation();
        openModPopover(m, chatterClickable);
      });
      chatterClickable.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          openModPopover(m, chatterClickable);
        }
      });

      const headerActions = make('div', 'hq-msg-actions');
      if (m.deleted) {
        headerActions.append(make('span', 'hq-msg-deleted-badge', 'gelöscht'));
      }
      headerActions.append(btn('Intern besprechen', () => {
        const input = $('input-mod-chat');
        const quote = `[Twitch #${channel()} · ${m.name}] ${m.text}`;
        input.value += (input.value ? '\n' : '') + quote;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.focus();
      }));

      headerRow.append(chatterClickable, headerActions);
      row.append(headerRow, make('span', 'hq-msg-body' + (m.deleted ? ' is-deleted' : ''), m.text));
      log.append(row);
    }
    if (!shown.length) log.append(make('p', 'hq-help', messages.length ? 'Keine passenden Nachrichten.' : 'Neue Nachrichten erscheinen hier nach der Verbindung.'));
    resume.hidden = !paused;
    resume.textContent = pending ? `Zurück zu Live (${pending} neu)` : 'Zurück zu Live';
    if (!paused) log.scrollTop = log.scrollHeight;
  }

  function getChatterColor(message) {
    if (/^#[0-9a-f]{6}$/i.test(message.color || '')) return message.color;
    const palette = ['#ff8f8f', '#ffd166', '#8bd450', '#4dd6c8', '#67b7ff', '#b69cff', '#f58ad7', '#ffad66'];
    const name = String(message.name || 'user').toLocaleLowerCase('de');
    let hash = 0;
    for (let index = 0; index < name.length; index++) hash = ((hash << 5) - hash + name.charCodeAt(index)) | 0;
    return palette[Math.abs(hash) % palette.length];
  }

  search.addEventListener('input', paint);
  log.addEventListener('scroll', () => {
    paused = log.scrollHeight - log.scrollTop - log.clientHeight > 40;
    resume.hidden = !paused;
  }, { passive: true });

  function disconnect() {
    if (socket) {
      socket.onclose = null;
      socket.close();
      socket = null;
    }
  }

  function connect() {
    const chan = channel();
    if (!/^[a-z0-9_]{1,25}$/.test(chan)) {
      status.textContent = 'Bitte einen gültigen Twitch-Kanal im Profil hinterlegen.';
      return;
    }
    status.textContent = 'Verbinde mit #' + chan + ' …';
    const ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
    socket = ws;

    ws.onopen = () => {
      // Send IRC commands separately so Twitch IRC WebSocket parses each properly
      ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
      ws.send('NICK justinfan' + Math.floor(100000 + Math.random() * 900000));
      ws.send('JOIN #' + chan);
    };

    ws.onmessage = event => {
      if (socket !== ws) return;
      for (const line of String(event.data).split(/\r?\n/)) {
        if (!line) continue;
        if (line.startsWith('PING')) {
          ws.send('PONG :tmi.twitch.tv');
          continue;
        }
        if (line.includes(' 366 ') || line.includes('ROOMSTATE')) {
          attempt = 0;
          status.textContent = 'Verbunden mit #' + chan + ' · Live';
        }
        if (line.includes('RECONNECT')) {
          ws.close();
          continue;
        }
        const parsed = line.match(/^(?:@([^ ]+) )?:([^! ]+)[^ ]* PRIVMSG #[^ ]+ :(.*)$/);
        if (parsed) {
          const tags = Object.fromEntries((parsed[1] || '').split(';').map(t => {
            const i = t.indexOf('=');
            return [t.slice(0, i), t.slice(i + 1)];
          }));
          messages.push({
            id: tags.id || ('msg-' + Date.now() + '-' + Math.random()),
            userId: tags['user-id'] || '',
            name: (tags['display-name'] || parsed[2]).replace(/\\s/g, ' '),
            text: parsed[3],
            color: tags.color || ''
          });
          messages = messages.slice(-200);
          if (paused) {
            pending++;
            resume.hidden = false;
            resume.textContent = `Zurück zu Live (${pending} neu)`;
          } else {
            paint();
          }
        }
        if (line.includes(' CLEARMSG ')) {
          const id = line.match(/target-msg-id=([^; ]+)/)?.[1];
          if (id) {
            const target = messages.find(m => m.id === id);
            if (target) {
              target.deleted = true;
              paint();
            }
          }
        }
        if (line.includes(' CLEARCHAT ')) {
          const user = line.match(/ CLEARCHAT #[^ ]+ :(.+)$/)?.[1];
          if (user) {
            const cleanUser = user.trim().toLowerCase();
            messages.forEach(m => {
              if (m.name.toLowerCase() === cleanUser) m.deleted = true;
            });
          } else {
            messages.forEach(m => { m.deleted = true; });
          }
          paint();
        }
        if (line.includes(' NOTICE ')) {
          status.textContent = 'Twitch-Hinweis: ' + line.slice(line.indexOf(' :') + 2);
        }
      }
    };

    ws.onerror = () => {
      status.textContent = 'Twitch-Verbindung fehlgeschlagen. Neuer Versuch folgt.';
    };

    ws.onclose = () => {
      if (socket === ws) {
        socket = null;
        retryAt = Date.now() + Math.min(60000, 3000 * 2 ** attempt++);
        status.textContent = 'Verbindung unterbrochen. Neuer Versuch folgt.';
      }
    };
  }

  function refresh() {
    const s = settings(), id = profile().id + '|' + channel() + '|' + JSON.stringify(s);
    if (id !== identity) {
      identity = id;
      disconnect();
      messages = [];
      paused = false;
      pending = 0;
      retryAt = 0;
      attempt = 0;
      twitch.hidden = !s.twitch;
      youtube.hidden = !s.youtube;
      empty.hidden = !!(s.twitch || s.youtube);
      choose(s.defaultView === 'youtube' && s.youtube ? 'youtube' : s.twitch ? 'twitch' : 'youtube');
      paint();
    }
    const visible = !view.classList.contains('hidden');
    if (!visible || !s.twitch) {
      disconnect();
    } else if (!socket && Date.now() >= retryAt) {
      retryAt = Date.now() + 60000;
      connect();
    }
    if (visible) syncAgreement();
  }

  window.addEventListener('swg:view-changed', refresh);
  window.addEventListener('beforeunload', disconnect);
  setInterval(refresh, 1500);
  refresh();
})();

