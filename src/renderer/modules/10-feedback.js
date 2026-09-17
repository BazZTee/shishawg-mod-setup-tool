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
  const btnOpen = document.getElementById('btn-open-change-request');
  const modal = document.getElementById('change-request-modal');
  const btnClose = document.getElementById('btn-close-change-request-modal');
  const btnCancel = document.getElementById('btn-cancel-change-request');
  const btnSubmit = document.getElementById('btn-submit-change-request');
  const inputTitle = document.getElementById('cr-title');
  const inputDetails = document.getElementById('cr-details');
  const selectCategory = document.getElementById('cr-category');

  if (!btnOpen || !modal) return;

  const openModal = () => {
    if (inputTitle) inputTitle.value = '';
    if (inputDetails) inputDetails.value = '';
    if (selectCategory) selectCategory.value = 'Wunsch';

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
      btnSubmit.textContent = '⏳ Wird an Trello gesendet...';

      try {
        const contextTable = buildChangeRequestContextTable(category);
        const res = await ipcRenderer.invoke('app:send-trello-card', {
          category,
          title,
          details,
          contextTable,
          modName: state.twitchUser?.display_name || state.twitchUser?.login || '(nicht angemeldet)'
        });

        if (res && res.success) {
          showToast('🎉 Vielen Dank! Dein Wunsch wurde direkt ins Trello-Board von Bastian übertragen.', 'success');
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

