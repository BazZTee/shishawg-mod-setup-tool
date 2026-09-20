// Spec #1: Change Request / Feedback issue builder & modal listeners
function getCurrentViewDisplayName(viewId) {
  const map = {
    'view-landing': 'Hauptmenü / Hub',
    'view-setup': 'Setup Generator & Befehl',
    'view-quickactions': 'Quick Actions & Chat-Befehle',
    'view-modchat': 'Mod HQ & Team-Chat',
    'view-giveaways': 'Giveaway Manager',
    'view-qna': 'Community Q&A',
    'view-polls': 'Abstimmungen / Polls',
    'view-stats': 'Analytics & Statistiken'
  };
  return map[viewId] || viewId || 'Hauptmenü';
}

function buildChangeRequestContextTable(category) {
  const modName = state.twitchUser?.display_name 
    ? `${state.twitchUser.display_name} (@${state.twitchUser.login})` 
    : '(nicht angemeldet)';
  const appVersion = document.getElementById('app-version-tag')?.textContent || 'v7.2.0';
  const dateStr = new Date().toLocaleString('de-DE');
  const viewId = typeof currentActiveView !== 'undefined' ? currentActiveView : 'view-landing';
  const viewName = getCurrentViewDisplayName(viewId);

  const selectProfile = document.getElementById('select-active-streamer-profile');
  const profileName = selectProfile ? (selectProfile.options[selectProfile.selectedIndex]?.text || 'ShishaWG (Marvin)') : 'ShishaWG';
  const channelName = state.config?.twitch_channel || '#marved';

  let sessionContext = 'Keine aktive Kopf-Session';
  if (typeof statsState !== 'undefined' && statsState.sessionStartTime && statsState.activeSetup) {
    const elapsedMins = Math.max(1, Math.round((statsState.sessionElapsedSeconds || 0) / 60));
    const setupName = statsState.activeSetup.tobacco || 'Setup';
    sessionContext = `Kopf #${statsState.activeHeadCount || 1} (${elapsedMins} Min) – ${setupName}`;
  }

  const osPlatform = typeof process !== 'undefined' ? `${process.platform} ${process.arch}` : 'Windows';

  return [
    '### 📋 System- & Kontext-Informationen',
    '| Kontext-Feld | Wert |',
    '| :--- | :--- |',
    `| **Kategorie** | ${category || 'Wunsch'} |`,
    `| **Aktuelle Ansicht / Feature** | ${viewName} (\`${viewId}\`) |`,
    `| **Tool-Version** | ${appVersion} |`,
    `| **Mod-Benutzer** | ${modName} |`,
    `| **Streamer-Profil / Kanal** | ${profileName} (\`${channelName}\`) |`,
    `| **Aktive Session** | ${sessionContext} |`,
    `| **Betriebssystem** | ${osPlatform} |`,
    `| **Zeitstempel** | ${dateStr} |`
  ].join('\n');
}

function buildChangeRequestIssueUrl(category, title, details) {
  const repoUrl = 'https://github.com/BazZTee/shishawg-mod-setup-tool/issues/new';
  const titleParam = `[CR]: ${String(title || '').trim()}`;
  const contextTable = buildChangeRequestContextTable(category);

  const bodyContent = [
    contextTable,
    '',
    '---',
    '',
    '### 📝 Beschreibung & Feedback',
    String(details || '').trim()
  ].join('\n');

  return `${repoUrl}?title=${encodeURIComponent(titleParam)}&body=${encodeURIComponent(bodyContent)}`;
}

function setupChangeRequestListeners() {
  const MAX_CHANGE_REQUEST_SCREENSHOTS = 4;
  const MAX_CHANGE_REQUEST_SCREENSHOT_BYTES = 8 * 1024 * 1024;
  const CHANGE_REQUEST_SCREENSHOT_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
  const btnOpen = document.getElementById('btn-open-change-request');
  const modal = document.getElementById('change-request-modal');
  const btnClose = document.getElementById('btn-close-change-request-modal');
  const btnCancel = document.getElementById('btn-cancel-change-request');
  const btnSubmit = document.getElementById('btn-submit-change-request');
  const inputTitle = document.getElementById('cr-title');
  const inputDetails = document.getElementById('cr-details');
  const selectCategory = document.getElementById('cr-category');
  const inputScreenshots = document.getElementById('cr-screenshots');
  const screenshotList = document.getElementById('cr-screenshot-list');
  let selectedScreenshots = [];

  if (!btnOpen || !modal) return;

  const renderScreenshotList = () => {
    if (!screenshotList) return;
    if (!selectedScreenshots.length) {
      screenshotList.innerHTML = '';
      return;
    }
    screenshotList.innerHTML = selectedScreenshots.map((file, index) => `
      <div class="cr-screenshot-item">
        <span class="cr-screenshot-icon">🖼️</span>
        <span class="cr-screenshot-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
        <span class="cr-screenshot-size">${(file.size / (1024 * 1024)).toFixed(1)} MB</span>
        <button type="button" class="btn-icon cr-screenshot-remove" data-index="${index}" title="Screenshot entfernen">✕</button>
      </div>
    `).join('');
    screenshotList.querySelectorAll('.cr-screenshot-remove').forEach(button => {
      button.addEventListener('click', () => {
        selectedScreenshots.splice(Number(button.dataset.index), 1);
        if (inputScreenshots) inputScreenshots.value = '';
        renderScreenshotList();
      });
    });
  };

  const addScreenshots = files => {
    const incoming = Array.from(files || []);
    for (const file of incoming) {
      if (!CHANGE_REQUEST_SCREENSHOT_TYPES.has(file.type)) {
        showToast(`„${file.name}“ ist kein unterstütztes Bild.`, 'error');
        continue;
      }
      if (file.size > MAX_CHANGE_REQUEST_SCREENSHOT_BYTES) {
        showToast(`„${file.name}“ ist größer als 8 MB.`, 'error');
        continue;
      }
      if (selectedScreenshots.length >= MAX_CHANGE_REQUEST_SCREENSHOTS) {
        showToast('Du kannst höchstens 4 Screenshots anhängen.', 'error');
        break;
      }
      const duplicate = selectedScreenshots.some(existing =>
        existing.name === file.name && existing.size === file.size && existing.lastModified === file.lastModified
      );
      if (!duplicate) selectedScreenshots.push(file);
    }
    if (inputScreenshots) inputScreenshots.value = '';
    renderScreenshotList();
  };

  const openModal = () => {
    if (inputTitle) inputTitle.value = '';
    if (inputDetails) inputDetails.value = '';
    if (selectCategory) selectCategory.value = 'Wunsch';
    selectedScreenshots = [];
    if (inputScreenshots) inputScreenshots.value = '';
    renderScreenshotList();

    const prevView = document.getElementById('cr-preview-view');
    const prevUser = document.getElementById('cr-preview-user');
    const prevVer = document.getElementById('cr-preview-ver');
    const viewId = typeof currentActiveView !== 'undefined' ? currentActiveView : 'view-landing';
    if (prevView) prevView.textContent = getCurrentViewDisplayName(viewId);
    if (prevUser) prevUser.textContent = state.twitchUser?.display_name || state.twitchUser?.login || '(nicht angemeldet)';
    if (prevVer) prevVer.textContent = document.getElementById('app-version-tag')?.textContent || 'v7.2.0';

    modal.classList.remove('hidden');
    if (inputTitle) inputTitle.focus();
  };

  const closeModal = () => {
    modal.classList.add('hidden');
  };

  btnOpen.addEventListener('click', openModal);
  if (btnClose) btnClose.addEventListener('click', closeModal);
  if (btnCancel) btnCancel.addEventListener('click', closeModal);
  if (inputScreenshots) inputScreenshots.addEventListener('change', () => addScreenshots(inputScreenshots.files));

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  if (btnSubmit) {
    btnSubmit.addEventListener('click', async () => {
      const category = selectCategory ? selectCategory.value : 'Wunsch';
      const title = inputTitle ? inputTitle.value.trim() : '';
      const details = inputDetails ? inputDetails.value.trim() : '';

      if (!title) {
        showToast('Bitte gib einen kurzen Titel / Zusammenfassung ein', 'error');
        if (inputTitle) inputTitle.focus();
        return;
      }

      if (!details) {
        showToast('Bitte beschreibe kurz deinen Wunsch oder Fehler', 'error');
        if (inputDetails) inputDetails.focus();
        return;
      }

      btnSubmit.disabled = true;
      btnSubmit.textContent = selectedScreenshots.length ? '⏳ Screenshots werden vorbereitet...' : '⏳ Wird an Trello gesendet...';

      try {
        const screenshots = await Promise.all(selectedScreenshots.map(async file => ({
          name: file.name,
          type: file.type,
          size: file.size,
          data: new Uint8Array(await file.arrayBuffer())
        })));
        btnSubmit.textContent = '⏳ Wird an Trello gesendet...';
        const contextTable = buildChangeRequestContextTable(category);
        const res = await ipcRenderer.invoke('app:send-trello-card', {
          category,
          title,
          details,
          contextTable,
          modName: state.twitchUser?.display_name || state.twitchUser?.login || '(nicht angemeldet)',
          screenshots
        });

        if (res && res.success) {
          if (Array.isArray(res.attachmentErrors) && res.attachmentErrors.length) {
            showToast(`⚠️ Trello-Karte erstellt, aber ${res.attachmentErrors.length} Screenshot(s) konnten nicht angehängt werden.`, 'warning');
          } else if (res.attachmentsUploaded) {
            showToast(`🎉 Trello-Karte mit ${res.attachmentsUploaded} Screenshot(s) erstellt.`, 'success');
          } else {
            showToast('🎉 Vielen Dank! Dein Wunsch wurde direkt ins Trello-Board von Bastian übertragen.', 'success');
          }
          closeModal();
        } else {
          showToast(`Fehler beim Senden an Trello: ${res?.error || 'Unbekannter Fehler'}`, 'error');
        }
      } catch (err) {
        showToast(`Fehler beim Senden: ${err.message}`, 'error');
      } finally {
        btnSubmit.disabled = false;
        btnSubmit.textContent = '📤 Wunsch absenden';
      }
    });
  }
}
