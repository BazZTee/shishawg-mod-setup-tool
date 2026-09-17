// =========================================================
// STATS & KOHLE-TIMER LOGIC (VIEW 6)
// =========================================================

let statsSyncInterval = null;
let statsState = {
  isRunning: false,
  sessionStartTime: null,
  sessionElapsedSeconds: 0,
  coalStartTime: null,
  coalElapsedSeconds: 0,
  coalRotations: 0,
  headCountToday: 1,
  soundEnabled: true,
  sessions: [],
  intervalId: null,
  lastAlertPhase: null
};

const ELECTRIC_PREHEAT_SECONDS = 8 * 60;

function isElectricSetup(setup) {
  if (!setup) return false;
  if (setup.isElectric === true || setup.is_electric === true) return true;
  const haystack = [setup.electricDevice, setup.electric_device, setup.bowl, setup.hmd, setup.pipe]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return ['xkah', 'elektr', 'e-kopf', 'e–kopf', 'imoto'].some(marker => haystack.includes(marker));
}

function splitTobaccoItems(session) {
  const explicitItems = session && (session.tobaccoItems || session.tobacco_items);
  if (Array.isArray(explicitItems) && explicitItems.length > 0) {
    return explicitItems.map(item => String(item || '').trim()).filter(Boolean);
  }
  return String(session?.tobacco || '')
    .split(/\s+(?:&|\/\/)\s+/)
    .map(item => item.trim())
    .filter(item => item && item !== 'Unbekannter Tabak');
}

function getEffectiveSessionSeconds(setup, totalSeconds) {
  return isElectricSetup(setup)
    ? Math.max(0, (totalSeconds || 0) - ELECTRIC_PREHEAT_SECONDS)
    : Math.max(0, totalSeconds || 0);
}

function formatTimerClock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = Math.floor(s % 60);
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatCoalClock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const mins = Math.floor(s / 60);
  const secs = Math.floor(s % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function playCoalAlertSound() {
  if (!statsState.soundEnabled) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  } catch(e) {}
}

function updateStatsTimerTick() {
  if (!statsState.isRunning) return;

  const now = Date.now();
  if (statsState.sessionStartTime) {
    statsState.sessionElapsedSeconds = Math.floor((now - statsState.sessionStartTime) / 1000);
  }
  if (statsState.coalStartTime) {
    statsState.coalElapsedSeconds = Math.floor((now - statsState.coalStartTime) / 1000);
  }

  // Update digital displays
  const lblSession = document.getElementById('lbl-session-time');
  const lblCoal = document.getElementById('lbl-coal-time');
  const lblPrimaryTimer = document.getElementById('lbl-primary-timer-label');
  const lblSecondaryTimer = document.getElementById('lbl-secondary-timer-label');
  const electric = isElectricSetup(statsState.activeSetup);

  if (electric) {
    const preheatRemaining = Math.max(0, ELECTRIC_PREHEAT_SECONDS - statsState.sessionElapsedSeconds);
    const runtimeSeconds = getEffectiveSessionSeconds(statsState.activeSetup, statsState.sessionElapsedSeconds);
    if (lblPrimaryTimer) lblPrimaryTimer.textContent = 'Laufzeit:';
    if (lblSecondaryTimer) lblSecondaryTimer.textContent = 'Preheat:';
    if (lblSession) lblSession.textContent = formatTimerClock(runtimeSeconds);
    if (lblCoal) lblCoal.textContent = formatCoalClock(preheatRemaining);
  } else {
    if (lblPrimaryTimer) lblPrimaryTimer.textContent = 'Rauchdauer:';
    if (lblSecondaryTimer) lblSecondaryTimer.textContent = 'Kohle:';
    if (lblSession) lblSession.textContent = formatTimerClock(statsState.sessionElapsedSeconds);
    if (lblCoal) lblCoal.textContent = formatCoalClock(statsState.coalElapsedSeconds);
  }

  // Update Coal Phase & Progress Bar
  const coalSecs = statsState.coalElapsedSeconds;
  const progressBar = document.getElementById('bar-coal-progress');
  const lblPhaseText = document.getElementById('lbl-timer-phase-text');

  let pct = 0;
  if (electric) {
    pct = Math.min(100, (statsState.sessionElapsedSeconds / ELECTRIC_PREHEAT_SECONDS) * 100);
    const remaining = Math.max(0, ELECTRIC_PREHEAT_SECONDS - statsState.sessionElapsedSeconds);
    if (remaining > 0) {
      if (lblPhaseText) lblPhaseText.textContent = `Preheat läuft – noch ${formatCoalClock(remaining)} ⚡`;
    } else {
      if (lblPhaseText) lblPhaseText.textContent = 'Preheat abgeschlossen – Elektrogerät läuft ⚡';
      if (statsState.lastAlertPhase !== 'preheat-complete') {
        statsState.lastAlertPhase = 'preheat-complete';
        playCoalAlertSound();
        showToast('⚡ 8 Minuten Preheat abgeschlossen – Elektrogerät ist bereit!', 'success');
      }
    }
  } else if (coalSecs < 420) {
    // 0 - 7 Min: Anrauchen
    pct = (coalSecs / 1800) * 100;
    if (lblPhaseText) lblPhaseText.textContent = 'Phase 1: Anrauchen 🔥';
  } else if (coalSecs < 1800) {
    // 7 - 30 Min: Kohle brennt gut
    pct = (coalSecs / 1800) * 100;
    if (lblPhaseText) lblPhaseText.textContent = 'Phase 2: Kohle brennt optimal 💨';
  } else if (coalSecs < 3600) {
    // 30 - 60 Min: Kohle 2. Hälfte / Neue Kohlen
    pct = 50 + ((coalSecs - 1800) / 1800) * 50;
    if (lblPhaseText) lblPhaseText.textContent = 'Phase 3: Zeit zum Wenden / Neue Kohlen 🪵';
    if (coalSecs === 1800 && statsState.lastAlertPhase !== 'rotate') {
      statsState.lastAlertPhase = 'rotate';
      playCoalAlertSound();
      showToast('🪵 Kohle-Erinnerung: Zeit zum Wenden / Abaschen!', 'warning');
    }
  } else {
    // > 60 Min: Ende / Neuer Kopf
    pct = 100;
    if (lblPhaseText) lblPhaseText.textContent = 'Phase 4: Kopf ausrauchen oder neu bauen 🏁';
    if (coalSecs === 3600 && statsState.lastAlertPhase !== 'finish') {
      statsState.lastAlertPhase = 'finish';
      playCoalAlertSound();
      showToast('🔥 Kohle-Erinnerung: Kopf raucht seit 60 Min!', 'info');
    }
  }

  if (progressBar) progressBar.style.width = `${Math.min(100, Math.max(0, pct))}%`;

  // Synchronize with Custom Dashboard Timer Widget
  const customDurationEl = document.getElementById('custom-timer-duration-display');
  const customCoalEl = document.getElementById('custom-timer-coals-display');
  const customBar = document.getElementById('custom-timer-progress-bar');
  const customPhase = document.getElementById('custom-timer-phase-label');

  if (customDurationEl) {
    const runtime = electric
      ? getEffectiveSessionSeconds(statsState.activeSetup, statsState.sessionElapsedSeconds)
      : statsState.sessionElapsedSeconds;
    customDurationEl.textContent = formatTimerClock(runtime);
  }
  if (customCoalEl) {
    customCoalEl.textContent = electric ? 'E-Kopf' : `${statsState.coalRotations || 0}x`;
  }
  if (customBar) {
    customBar.style.width = `${Math.min(100, Math.max(0, pct))}%`;
  }
  if (customPhase && lblPhaseText) {
    customPhase.textContent = lblPhaseText.textContent;
  }
}

function extractCurrentSetupFromState() {
  const tobaccos = [];
  const bowls = [];
  const pipes = [];
  const hmds = [];
  const persons = [];
  const electricDevices = [];
  let hasElectricSetup = false;

  const count = state.personCount || (state.persons ? state.persons.length : 1);
  for (let i = 0; i < count; i++) {
    const p = state.persons && state.persons[i];
    if (!p) continue;
    let pName = (p.name || '').trim();
    let pPipe = (p.pipe || '').trim();
    let pBowl = (p.bowl || '').trim();
    let pHmd = (p.hmd || '').trim();

    const personIsElectric = !!p.isElectric || ['xkah', 'elektr', 'e-kopf', 'imoto'].some(marker => pBowl.toLowerCase().includes(marker));
    if (personIsElectric) {
      hasElectricSetup = true;
      if (pBowl) electricDevices.push(pBowl);
    }

    // All-In-One (AIO) Smart-Handling (e.g. XKAH Shii):
    // If bowl contains 'shii', 'aio', 'all-in-one' or is electric and pipe is empty, attribute bowl as pipe for stats/history!
    const bLower = pBowl.toLowerCase();
    const isAio = !personIsElectric && (bLower.includes('shii') || bLower.includes('all-in-one') || bLower.includes('aio'));
    if (isAio && !pPipe) {
      pPipe = pBowl;
    }

    if (pName) persons.push(pName);
    if (pPipe && !personIsElectric) pipes.push(pPipe);
    if (pBowl && !personIsElectric) bowls.push(pBowl);
    if (pHmd && !personIsElectric) hmds.push(pHmd);

    const rawTobaccos = p.tobaccos || [];
    for (let t of rawTobaccos) {
      const clean = (t || '').trim();
      if (clean) tobaccos.push(clean);
    }
    if (p.tobacco && !rawTobaccos.length) {
      const clean = p.tobacco.trim();
      if (clean) tobaccos.push(clean);
    }
  }

  // Fallback: Read directly from Generator DOM input fields if state.persons is empty
  if (tobaccos.length === 0) {
    document.querySelectorAll('.input-p-tobacco').forEach(inp => {
      const val = (inp.value || '').trim();
      if (val) tobaccos.push(val);
    });
  }
  if (pipes.length === 0) {
    document.querySelectorAll('.input-p-pipe').forEach(inp => {
      const val = (inp.value || '').trim();
      if (val) pipes.push(val);
    });
  }
  if (bowls.length === 0) {
    document.querySelectorAll('.input-p-bowl').forEach(inp => {
      const val = (inp.value || '').trim();
      if (val) bowls.push(val);
    });
  }
  if (hmds.length === 0) {
    document.querySelectorAll('.input-p-hmd').forEach(inp => {
      const val = (inp.value || '').trim();
      if (val) hmds.push(val);
    });
  }
  if (persons.length === 0) {
    document.querySelectorAll('.input-p-name').forEach(inp => {
      const val = (inp.value || '').trim();
      if (val) persons.push(val);
    });
  }

  // DOM Fallback AIO handling
  if (pipes.length === 0 && bowls.length > 0) {
    bowls.forEach(b => {
      const bLower = b.toLowerCase();
      if (bLower.includes('shii') || bLower.includes('all-in-one') || bLower.includes('aio')) {
        pipes.push(b);
      }
    });
  }

  const tobStr = tobaccos.join(' & ');
  if (!tobStr && !pipes.length && !bowls.length && !hmds.length) return null;

  return {
    tobacco: tobStr || 'Unbekannter Tabak',
    tobaccoItems: [...new Set(tobaccos)],
    bowl: bowls.join(' // '),
    pipe: pipes.join(' // '),
    hmd: hmds.join(' // '),
    electricDevice: electricDevices.join(' // '),
    isElectric: hasElectricSetup,
    person: persons.join(' & ') || 'Marvin'
  };
}

let lastKnownSetupSignature = '';

function checkAndAutoStartHeadSession(force = false) {
  if (!force) return;

  const currentSetup = extractCurrentSetupFromState();
  if (!currentSetup || !currentSetup.tobacco) return;

  const sig = `${currentSetup.tobacco}__${currentSetup.bowl}__${currentSetup.hmd}__${currentSetup.pipe}__${currentSetup.electricDevice || ''}`.toLowerCase();

  const chkUpdateOnly = document.getElementById('chk-update-active-session-only');
  const isUpdateOnly = statsState.isRunning && chkUpdateOnly && chkUpdateOnly.checked;

  if (isUpdateOnly) {
    statsState.activeSetup = currentSetup;
    lastKnownSetupSignature = sig;

    const lblTitle = document.getElementById('lbl-active-session-title');
    const lblSub = document.getElementById('lbl-active-session-sub');
    if (lblTitle) lblTitle.textContent = `🥣 Kopf #${statsState.headCountToday || 1}: ${currentSetup.tobacco}`;
    if (lblSub) {
      const hardware = isElectricSetup(currentSetup)
        ? [`⚡ ${currentSetup.electricDevice || currentSetup.bowl || 'Elektrogerät'}`, '8 Min Preheat'].join(' • ')
        : [currentSetup.bowl, currentSetup.hmd, currentSetup.pipe].filter(Boolean).join(' • ');
      lblSub.textContent = hardware || 'Aktiv im Stream';
    }

    saveActiveTimerStateToBackend();
    chkUpdateOnly.checked = false;
    showToast(`🔄 Kopf #${statsState.headCountToday || 1} aktualisiert! Timer läuft nahtlos weiter.`, 'success');
    return;
  }

  // If there was an active session running for >= 2 minutes (120s), auto-archive it into history!
  if (statsState.isRunning && statsState.sessionElapsedSeconds >= 120 && statsState.activeSetup && statsState.activeSetup.tobacco && sig !== lastKnownSetupSignature) {
    autoArchiveFinishedSession(statsState.activeSetup, statsState.sessionElapsedSeconds, statsState.coalRotations, statsState.sessionStartTime);
  }

  lastKnownSetupSignature = sig;
  statsState.activeSetup = currentSetup;

  // Calculate today's finished heads
  const todayStr = new Date().toISOString().split('T')[0];
  const finishedToday = (statsState.sessions || []).filter(s => {
    const d = s.ended_at ? s.ended_at.split('T')[0] : (s.endedAt ? s.endedAt.split('T')[0] : '');
    return d === todayStr;
  }).length;
  statsState.headCountToday = finishedToday + 1;

  // Update Compact Bottom Bar Head Info
  const lblTitle = document.getElementById('lbl-active-session-title');
  const lblSub = document.getElementById('lbl-active-session-sub');
  if (lblTitle) lblTitle.textContent = `🥣 Kopf #${statsState.headCountToday}: ${currentSetup.tobacco}`;
  if (lblSub) {
    const hardware = isElectricSetup(currentSetup)
      ? [`⚡ ${currentSetup.electricDevice || currentSetup.bowl || 'Elektrogerät'}`, '8 Min Preheat'].join(' • ')
      : [currentSetup.bowl, currentSetup.hmd, currentSetup.pipe].filter(Boolean).join(' • ');
    lblSub.textContent = hardware || 'Aktiv im Stream';
  }

  // Automatically start timer for this new head!
  const now = Date.now();
  statsState.isRunning = true;
  statsState.sessionStartTime = now;
  statsState.sessionElapsedSeconds = 0;
  statsState.coalStartTime = now;
  statsState.coalElapsedSeconds = 0;
  statsState.coalRotations = 0;
  statsState.lastAlertPhase = null;

  if (statsState.intervalId) clearInterval(statsState.intervalId);
  statsState.intervalId = setInterval(updateStatsTimerTick, 1000);

  updateStatsTimerTick();

  const badge = document.getElementById('timer-live-badge');
  const lblStatus = document.getElementById('lbl-timer-status');
  if (badge) badge.className = 'qna-status-badge live';
  if (lblStatus) lblStatus.textContent = 'Raucht live';
  const btnStartHead = document.getElementById('btn-timer-start-head');
  const btnFinishHead = document.getElementById('btn-timer-finish-head');
  if (btnStartHead) btnStartHead.classList.add('hidden');
  if (btnFinishHead) btnFinishHead.classList.remove('hidden');

  const chkUpdate = document.getElementById('chk-update-active-session-only');
  if (chkUpdate) {
    chkUpdate.disabled = false;
    if (chkUpdate.parentElement) chkUpdate.parentElement.style.opacity = '1';
  }

  saveActiveTimerStateToBackend();
}

async function autoArchiveFinishedSession(setup, durationSecs, coalRotations, startTime) {
  try {
    const chan = (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved';
    const sessionObj = {
      id: 'sess_' + Date.now(),
      channel: chan,
      headNum: statsState.headCountToday,
      tobacco: setup.tobacco || 'Unbekannter Tabak',
      tobaccoItems: splitTobaccoItems(setup),
      bowl: setup.bowl || '',
      hmd: setup.hmd || '',
      pipe: setup.pipe || '',
      electricDevice: setup.electricDevice || '',
      isElectric: isElectricSetup(setup),
      person: setup.person || 'Marvin',
      durationMinutes: Math.max(1, Math.round(getEffectiveSessionSeconds(setup, durationSecs) / 60)),
      coalRotations: coalRotations || 0,
      rating: 0,
      notes: 'Automatisch archiviert',
      startedAt: startTime ? new Date(startTime).toISOString() : new Date().toISOString(),
      endedAt: new Date().toISOString()
    };
    const result = await ipcRenderer.invoke('stats:save-session', sessionObj);
    if (result && !result.success) {
      const detail = result.localSaved ? 'Lokal gespeichert, Online-Synchronisierung fehlgeschlagen' : 'Speichern fehlgeschlagen';
      showToast(`⚠️ ${detail}: ${result.error || 'Unbekannter Fehler'}`, 'error');
    }
    await loadStatsState();
  } catch(e) {}
}

function resetActiveTimer(persistState = true) {
  statsState.isRunning = false;
  if (statsState.intervalId) {
    clearInterval(statsState.intervalId);
    statsState.intervalId = null;
  }
  statsState.sessionStartTime = null;
  statsState.sessionElapsedSeconds = 0;
  statsState.coalStartTime = null;
  statsState.coalElapsedSeconds = 0;
  statsState.coalRotations = 0;
  statsState.lastAlertPhase = null;

  const lblSession = document.getElementById('lbl-session-time');
  const lblCoal = document.getElementById('lbl-coal-time');
  const progressBar = document.getElementById('bar-coal-progress');
  const lblPhaseText = document.getElementById('lbl-timer-phase-text');
  const badge = document.getElementById('timer-live-badge');
  const lblStatus = document.getElementById('lbl-timer-status');
  const lblTitle = document.getElementById('lbl-active-session-title');
  const lblSub = document.getElementById('lbl-active-session-sub');

  if (lblSession) lblSession.textContent = '00:00:00';
  if (lblCoal) lblCoal.textContent = '00:00';
  if (progressBar) progressBar.style.width = '0%';
  if (lblPhaseText) lblPhaseText.textContent = 'Phase: Bereit zum Anrauchen 🔥';
  if (badge) badge.className = 'qna-status-badge offline';
  if (lblStatus) lblStatus.textContent = 'Gestoppt';
  if (lblTitle) lblTitle.textContent = 'Kein aktiver Kopf';
  if (lblSub) lblSub.textContent = 'Warte auf Setup im Generator...';
  const lblPrimaryTimer = document.getElementById('lbl-primary-timer-label');
  const lblSecondaryTimer = document.getElementById('lbl-secondary-timer-label');
  if (lblPrimaryTimer) lblPrimaryTimer.textContent = 'Rauchdauer:';
  if (lblSecondaryTimer) lblSecondaryTimer.textContent = 'Kohle:';
  const btnStartHead = document.getElementById('btn-timer-start-head');
  const btnFinishHead = document.getElementById('btn-timer-finish-head');
  if (btnStartHead) btnStartHead.classList.remove('hidden');
  if (btnFinishHead) btnFinishHead.classList.add('hidden');

  const chkUpdate = document.getElementById('chk-update-active-session-only');
  if (chkUpdate) {
    chkUpdate.checked = false;
    chkUpdate.disabled = true;
    if (chkUpdate.parentElement) chkUpdate.parentElement.style.opacity = '0.5';
  }

  if (persistState) saveActiveTimerStateToBackend();
}

function importCurrentGeneratorSetup() {
  const currentSetup = extractCurrentSetupFromState();
  if (currentSetup) {
    statsState.activeSetup = currentSetup;
  }
}

async function saveActiveTimerStateToBackend() {
  try {
    const chan = (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved';
    const active = statsState.activeSetup || extractCurrentSetupFromState() || {};
    const payload = {
      isRunning: statsState.isRunning,
      sessionStartTime: statsState.sessionStartTime,
      sessionElapsedSeconds: statsState.sessionElapsedSeconds,
      coalStartTime: statsState.coalStartTime,
      coalElapsedSeconds: statsState.coalElapsedSeconds,
      coalRotations: statsState.coalRotations,
      headCountToday: statsState.headCountToday,
      activeSetup: {
        tobacco: active.tobacco || '',
        tobaccoItems: splitTobaccoItems(active),
        bowl: active.bowl || '',
        hmd: active.hmd || '',
        pipe: active.pipe || '',
        electricDevice: active.electricDevice || '',
        isElectric: isElectricSetup(active),
        person: active.person || 'Marvin',
        notes: (document.getElementById('input-session-notes') ? document.getElementById('input-session-notes').value : '')
      },
      updatedAt: Date.now()
    };
    await ipcRenderer.invoke('stats:save-timer-state', { channel: chan, timerState: payload });
  } catch(e) {}
}

async function finishAndSaveHeadSession() {
  const chan = (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved';
  const active = statsState.activeSetup || extractCurrentSetupFromState() || {};
  const selectRating = document.getElementById('select-modal-finish-rating');
  const inputFinishNotes = document.getElementById('input-modal-finish-notes');

  const durMins = Math.max(1, Math.round(getEffectiveSessionSeconds(active, statsState.sessionElapsedSeconds) / 60));
  const finalTobacco = (active.tobacco && active.tobacco !== 'Unbekannter Tabak')
    ? active.tobacco.trim()
    : (extractCurrentSetupFromState()?.tobacco || 'Unbekannter Tabak');

  const sessionObj = {
    id: 'sess_' + Date.now(),
    channel: chan,
    headNum: statsState.headCountToday || 1,
    tobacco: finalTobacco,
    tobaccoItems: splitTobaccoItems(active.tobaccoItems?.length ? active : { tobacco: finalTobacco }),
    bowl: (active.bowl || '').trim() || (extractCurrentSetupFromState()?.bowl || ''),
    hmd: (active.hmd || '').trim() || (extractCurrentSetupFromState()?.hmd || ''),
    pipe: (active.pipe || '').trim() || (extractCurrentSetupFromState()?.pipe || ''),
    electricDevice: (active.electricDevice || '').trim() || (extractCurrentSetupFromState()?.electricDevice || ''),
    isElectric: isElectricSetup(active) || isElectricSetup(extractCurrentSetupFromState()),
    person: (active.person || '').trim() || (extractCurrentSetupFromState()?.person || 'Marvin'),
    durationMinutes: durMins,
    coalRotations: statsState.coalRotations || 0,
    rating: selectRating ? (parseInt(selectRating.value, 10) || 0) : 0,
    notes: (inputFinishNotes ? inputFinishNotes.value.trim() : ''),
    startedAt: statsState.sessionStartTime ? new Date(statsState.sessionStartTime).toISOString() : new Date().toISOString(),
    endedAt: new Date().toISOString()
  };

  showToast('Speichere Session in Historie...', 'info');

  try {
    const res = await ipcRenderer.invoke('stats:save-session', sessionObj);
    if (res && res.success) {
      resetActiveTimer();

      if (inputFinishNotes) inputFinishNotes.value = '';
      const inputNotes = document.getElementById('input-session-notes');
      if (inputNotes) inputNotes.value = '';

      await loadStatsState();
      showToast(`🏁 Kopf #${sessionObj.headNum} (${sessionObj.tobacco}) erfolgreich gespeichert!`, 'success');
    } else if (res && res.localSaved) {
      showToast(`⚠️ Kopf lokal gespeichert, aber die Online-Datenbank wurde nicht aktualisiert: ${res.error}`, 'error');
    } else {
      showToast(`Fehler beim Speichern: ${res?.error || 'Unbekannter Fehler'}`, 'error');
    }
  } catch(e) {
    showToast(`Fehler beim Speichern: ${e.message}`, 'error');
  }
}

function renderSessionsHistory(sessions) {
  const tbody = document.getElementById('sessions-history-tbody');
  if (!tbody) return;

  if (!sessions || sessions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-list-placeholder">Noch keine beendeten Köpfe in der Historie.</td></tr>';
    return;
  }

  // Group sessions by Day Date (YYYY-MM-DD)
  const groupsByDate = {};
  sessions.forEach(s => {
    const rawDate = s.ended_at || s.endedAt || s.started_at || s.startedAt || s.created_at || new Date().toISOString();
    const dateKey = rawDate.split('T')[0];
    if (!groupsByDate[dateKey]) groupsByDate[dateKey] = [];
    groupsByDate[dateKey].push(s);
  });

  const todayStr = new Date().toISOString().split('T')[0];
  const yesterdayDate = new Date(Date.now() - 86400000);
  const yesterdayStr = yesterdayDate.toISOString().split('T')[0];

  let html = '';
  const sortedDates = Object.keys(groupsByDate).sort((a, b) => b.localeCompare(a));

  sortedDates.forEach(dateKey => {
    const daySessions = groupsByDate[dateKey];
    let dayLabel = dateKey;
    if (dateKey === todayStr) {
      dayLabel = `📅 Heute (${new Date(dateKey + 'T12:00:00').toLocaleDateString('de-DE')})`;
    } else if (dateKey === yesterdayStr) {
      dayLabel = `📅 Gestern (${new Date(dateKey + 'T12:00:00').toLocaleDateString('de-DE')})`;
    } else {
      dayLabel = `📅 ${new Date(dateKey + 'T12:00:00').toLocaleDateString('de-DE')}`;
    }

    const totalDayMins = daySessions.reduce((sum, s) => sum + (s.duration_minutes || s.durationMinutes || 0), 0);
    const dayHours = Math.floor(totalDayMins / 60);
    const dayMins = totalDayMins % 60;
    const timeDisplay = dayHours > 0 ? `${dayHours}h ${dayMins}m` : `${dayMins} Min`;

    html += `
      <tr class="history-day-header-row" style="background: rgba(124, 58, 237, 0.15); border-top: 1px solid rgba(124, 58, 237, 0.35);">
        <td colspan="8" style="padding: 8px 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <strong style="color: #c4b5fd; font-size: 0.88rem;">${dayLabel}</strong>
            <span style="font-size: 0.76rem; color: #a78bfa; font-weight: 700;">${daySessions.length} ${daySessions.length === 1 ? 'Kopf' : 'Köpfe'} • Gesamt ${timeDisplay}</span>
          </div>
        </td>
      </tr>
    `;

    daySessions.forEach(s => {
      const timeStr = s.ended_at ? new Date(s.ended_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (s.endedAt ? new Date(s.endedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-');
      const tobacco = s.tobacco || '-';
      const rawParts = [s.pipe, s.bowl, s.hmd].filter(Boolean);
      const bowlHmd = [...new Set(rawParts)].join(' • ') || '-';
      const dur = s.duration_minutes || s.durationMinutes || 0;
      const coals = s.coal_rotations || s.coalRotations || 0;
      const electric = isElectricSetup(s);
      const rating = s.rating ? `🌟 ${s.rating}/10` : '-';
      const headNum = s.head_num || s.headNum || 1;

      html += `
        <tr>
          <td><strong style="color:var(--accent-cyan);">#${headNum}</strong></td>
          <td style="color:var(--text-muted); font-size:0.8rem;">${timeStr}</td>
          <td><strong style="color:#fff;">${escapeHtml(tobacco)}</strong></td>
          <td style="color:var(--text-secondary); font-size:0.82rem;">${escapeHtml(bowlHmd)}</td>
          <td><span style="background:rgba(0,240,255,0.1); color:var(--accent-cyan); padding:2px 6px; border-radius:4px; font-size:0.78rem; font-weight:700;">⏱️ ${dur} Min</span></td>
          <td style="font-size:0.8rem; color:var(--text-muted);">${electric ? '⚡ 8 Min Preheat' : `🪵 ${coals}x`}</td>
          <td><strong style="color:#fbbf24; font-size:0.82rem;">${rating}</strong></td>
          <td style="text-align:right; white-space:nowrap;">
            <button class="btn btn-xs btn-secondary btn-edit-session" data-id="${s.id}" title="Protokolleintrag bearbeiten" style="margin-right:4px;">✏️</button>
            <button class="btn btn-xs btn-primary btn-resume-session" data-id="${s.id}" title="Diesen Kopf wiederaufnehmen &amp; Timer fortsetzen" style="margin-right: 4px;">🔄 Fortsetzen</button>
            <button class="btn btn-xs btn-secondary btn-del-session" data-id="${s.id}" title="Session löschen">🗑️</button>
          </td>
        </tr>
      `;
    });
  });

  tbody.innerHTML = html;

  tbody.querySelectorAll('.btn-edit-session').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      const session = (statsState.sessions || []).find(s => String(s.id) === String(id));
      if (session) openStatsSessionEditModal(session);
    });
  });

  tbody.querySelectorAll('.btn-resume-session').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      const session = (statsState.sessions || []).find(s => String(s.id) === String(id));
      if (!session) return;

      const tobName = session.tobacco || 'Aktueller Kopf';
      const headNum = session.head_num || session.headNum || 1;
      if (!confirm(`Möchtest du Kopf #${headNum} (${tobName}) wirklich wiederaufnehmen und den Timer fortsetzen?`)) {
        return;
      }

      const startTime = session.started_at ? new Date(session.started_at).getTime() : (session.startedAt ? new Date(session.startedAt).getTime() : Date.now());
      const activeSetup = {
        tobacco: session.tobacco || '',
        tobaccoItems: splitTobaccoItems(session),
        bowl: session.bowl || '',
        hmd: session.hmd || '',
        pipe: session.pipe || '',
        electricDevice: session.electric_device || session.electricDevice || '',
        isElectric: isElectricSetup(session),
        person: session.person || 'Marvin',
        notes: session.notes || ''
      };

      const payload = {
        isRunning: true,
        sessionStartTime: startTime,
        sessionElapsedSeconds: Math.max(0, Math.floor((Date.now() - startTime) / 1000)),
        coalStartTime: startTime,
        coalElapsedSeconds: Math.max(0, Math.floor((Date.now() - startTime) / 1000)),
        coalRotations: session.coal_rotations || session.coalRotations || 0,
        headCountToday: headNum,
        activeSetup: activeSetup,
        updatedAt: Date.now()
      };

      await ipcRenderer.invoke('stats:delete-session', id);
      const chan = (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved';
      await ipcRenderer.invoke('stats:save-timer-state', { channel: chan, timerState: payload });

      restoreActiveTimerState(payload);
      await loadStatsState();
      showToast(`🔄 Kopf #${headNum} (${tobName}) wieder aufgenommen! Timer läuft weiter.`, 'success');
    });
  });

  tbody.querySelectorAll('.btn-del-session').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      if (confirm('Möchtest du diese gerauchte Session wirklich aus der Historie löschen?')) {
        await ipcRenderer.invoke('stats:delete-session', id);
        await loadStatsState();
        showToast('Session gelöscht.', 'info');
      }
    });
  });
}

function toStatsDateTimeLocalValue(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  const localTime = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
  return localTime.toISOString().slice(0, 16);
}

let statsEditPickerDate = new Date();
let statsEditPickerView = new Date(statsEditPickerDate.getFullYear(), statsEditPickerDate.getMonth(), 1);

function statsPickerDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
}

function syncStatsEditDateTimeValue() {
  const hiddenInput = document.getElementById('input-edit-session-ended-at');
  const display = document.getElementById('lbl-edit-session-datetime');
  const hourInput = document.getElementById('input-edit-date-hour');
  const minuteInput = document.getElementById('input-edit-date-minute');
  if (hiddenInput) hiddenInput.value = toStatsDateTimeLocalValue(statsEditPickerDate);
  if (display) {
    const dateText = statsEditPickerDate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeText = statsEditPickerDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    display.textContent = `${dateText} · ${timeText} Uhr`;
  }
  if (hourInput) hourInput.value = String(statsEditPickerDate.getHours()).padStart(2, '0');
  if (minuteInput) minuteInput.value = String(statsEditPickerDate.getMinutes()).padStart(2, '0');
}

function renderStatsEditDateTimePicker() {
  const grid = document.getElementById('edit-session-calendar-grid');
  const monthLabel = document.getElementById('lbl-edit-date-month');
  if (!grid || !monthLabel) return;

  const year = statsEditPickerView.getFullYear();
  const month = statsEditPickerView.getMonth();
  monthLabel.textContent = statsEditPickerView.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  const mondayOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  const firstCell = new Date(year, month, 1 - mondayOffset);
  const selectedKey = statsPickerDateKey(statsEditPickerDate);
  const todayKey = statsPickerDateKey(new Date());

  grid.innerHTML = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(firstCell.getFullYear(), firstCell.getMonth(), firstCell.getDate() + index);
    const key = statsPickerDateKey(day);
    const classes = ['stats-picker-day'];
    if (day.getMonth() !== month) classes.push('outside-month');
    if (key === todayKey) classes.push('today');
    if (key === selectedKey) classes.push('selected');
    return `<button type="button" class="${classes.join(' ')}" data-picker-date="${key}" aria-label="${day.toLocaleDateString('de-DE')}">${day.getDate()}</button>`;
  }).join('');
}

function setStatsEditPickerDate(value) {
  const parsed = value ? new Date(value) : new Date();
  statsEditPickerDate = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  statsEditPickerView = new Date(statsEditPickerDate.getFullYear(), statsEditPickerDate.getMonth(), 1);
  syncStatsEditDateTimeValue();
  renderStatsEditDateTimePicker();
}

function updateStatsEditPickerTime() {
  const rawHour = parseInt(document.getElementById('input-edit-date-hour')?.value, 10);
  const rawMinute = parseInt(document.getElementById('input-edit-date-minute')?.value, 10);
  statsEditPickerDate.setHours(
    Math.min(23, Math.max(0, Number.isFinite(rawHour) ? rawHour : 0)),
    Math.min(59, Math.max(0, Number.isFinite(rawMinute) ? rawMinute : 0)),
    0,
    0
  );
  syncStatsEditDateTimeValue();
}

function openStatsSessionEditModal(session) {
  const modal = document.getElementById('modal-edit-stats-session');
  if (!modal || !session) return;

  modal.dataset.sessionId = String(session.id);
  const setValue = (id, value) => {
    const input = document.getElementById(id);
    if (input) input.value = value == null ? '' : String(value);
  };

  setValue('input-edit-session-head-num', session.head_num || session.headNum || 1);
  setStatsEditPickerDate(session.ended_at || session.endedAt || session.started_at || session.startedAt);
  setValue('input-edit-session-person', session.person || 'Marvin');
  setValue('input-edit-session-tobacco', session.tobacco || '');
  setValue('input-edit-session-pipe', session.pipe || '');
  setValue('input-edit-session-bowl', session.bowl || '');
  setValue('input-edit-session-hmd', session.hmd || '');
  setValue('input-edit-session-duration', session.duration_minutes || session.durationMinutes || 1);
  setValue('select-edit-session-rating', session.rating || 0);
  setValue('input-edit-session-electric-device', session.electric_device || session.electricDevice || '');
  setValue('input-edit-session-notes', session.notes || '');

  const chkElectric = document.getElementById('chk-edit-session-electric');
  if (chkElectric) chkElectric.checked = isElectricSetup(session);
  document.getElementById('edit-session-datetime-popover')?.classList.add('hidden');
  document.getElementById('btn-edit-session-datetime')?.setAttribute('aria-expanded', 'false');
  modal.classList.remove('hidden');
  document.getElementById('input-edit-session-tobacco')?.focus();
}

async function saveStatsSessionEdits() {
  const modal = document.getElementById('modal-edit-stats-session');
  const id = modal?.dataset.sessionId;
  const existing = (statsState.sessions || []).find(s => String(s.id) === String(id));
  if (!modal || !existing) return;

  const readValue = id => (document.getElementById(id)?.value || '').trim();
  const readInt = (id, fallback = 0) => {
    const value = parseInt(document.getElementById(id)?.value, 10);
    return Number.isFinite(value) ? value : fallback;
  };
  const tobacco = readValue('input-edit-session-tobacco');
  if (!tobacco) {
    showToast('Bitte gib mindestens einen Tabak oder Mix an.', 'error');
    return;
  }

  const endedValue = readValue('input-edit-session-ended-at');
  const endedDate = endedValue ? new Date(endedValue) : null;
  if (!endedDate || Number.isNaN(endedDate.getTime())) {
    showToast('Bitte gib ein gültiges Datum mit Uhrzeit an.', 'error');
    return;
  }

  const isElectric = !!document.getElementById('chk-edit-session-electric')?.checked;
  const chan = existing.channel || (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved';
  const updatedSession = {
    id: existing.id,
    channel: chan,
    headNum: Math.max(1, readInt('input-edit-session-head-num', 1)),
    tobacco,
    tobaccoItems: splitTobaccoItems({ tobacco }),
    pipe: readValue('input-edit-session-pipe'),
    bowl: readValue('input-edit-session-bowl'),
    hmd: readValue('input-edit-session-hmd'),
    electricDevice: isElectric ? readValue('input-edit-session-electric-device') : '',
    isElectric,
    person: readValue('input-edit-session-person') || 'Marvin',
    durationMinutes: Math.max(1, readInt('input-edit-session-duration', 1)),
    coalRotations: isElectric ? 0 : (existing.coal_rotations || existing.coalRotations || 0),
    rating: Math.min(10, Math.max(0, readInt('select-edit-session-rating', 0))),
    notes: readValue('input-edit-session-notes'),
    startedAt: existing.started_at || existing.startedAt || endedDate.toISOString(),
    endedAt: endedDate.toISOString()
  };

  const saveButton = document.getElementById('btn-save-edit-stats-session');
  if (saveButton) saveButton.disabled = true;
  try {
    const result = await ipcRenderer.invoke('stats:save-session', updatedSession);
    if (!result || !result.success) {
      if (result?.localSaved) {
        showToast(`⚠️ Lokal gespeichert, aber nicht mit der Online-Datenbank synchronisiert: ${result.error}`, 'error');
        return;
      }
      throw new Error(result?.error || 'Speichern fehlgeschlagen');
    }
    modal.classList.add('hidden');
    await loadStatsState();
    showToast(`✏️ Kopf #${updatedSession.headNum} wurde aktualisiert.`, 'success');
  } catch (error) {
    showToast(`Änderung konnte nicht gespeichert werden: ${error.message}`, 'error');
  } finally {
    if (saveButton) saveButton.disabled = false;
  }
}

function renderStatsAnalytics(sessions) {
  if (!sessions) sessions = [];

  const kpiTotalHeads = document.getElementById('kpi-total-heads');
  const kpiAvgDurationCoal = document.getElementById('kpi-avg-duration-coal');
  const kpiAvgDurationElectric = document.getElementById('kpi-avg-duration-electric');
  const kpiCountCoal = document.getElementById('kpi-count-coal');
  const kpiCountElectric = document.getElementById('kpi-count-electric');
  const kpiAvgDuration = document.getElementById('kpi-avg-duration');
  const kpiAvgRating = document.getElementById('kpi-avg-rating');

  const containerTobacco = document.getElementById('analytics-top-tobacco');
  const containerMixes = document.getElementById('analytics-top-mixes');
  const containerPipes = document.getElementById('analytics-top-pipes');
  const containerBowls = document.getElementById('analytics-top-bowls');
  const containerHmds = document.getElementById('analytics-top-hmds');
  const containerElectric = document.getElementById('analytics-top-electric');

  const totalCount = sessions.length;
  if (kpiTotalHeads) kpiTotalHeads.textContent = String(totalCount);

  let sumDurationCoal = 0;
  let countCoal = 0;
  let sumDurationElectric = 0;
  let countElectric = 0;
  let sumDuration = 0;
  let ratingCount = 0;
  let sumRating = 0;

  const tobaccoCounts = {};
  const mixCounts = {};
  const pipeCounts = {};
  const bowlCounts = {};
  const hmdCounts = {};
  const electricCounts = {};

  const incrementItems = (counter, rawValue) => {
    String(rawValue || '').split(/\s+\/\/\s+/).map(value => value.trim()).filter(Boolean).forEach(value => {
      counter[value] = (counter[value] || 0) + 1;
    });
  };

  sessions.forEach(s => {
    const dur = s.duration_minutes || s.durationMinutes || 0;
    const r = s.rating || 0;
    const tob = (s.tobacco || '').trim();
    const pipe = (s.pipe || '').trim();
    const bowl = (s.bowl || '').trim();
    const hmd = (s.hmd || '').trim();

    const isElectricDeviceText = (text) => {
      if (!text) return false;
      const t = String(text).toLowerCase();
      return ['xkah', 'elektr', 'e-kopf', 'e–kopf', 'imoto', 'e-hmd', 'e–hmd'].some(m => t.includes(m));
    };

    const rawElectric = s.electric_device || s.electricDevice;
    const detectedElectric = isElectricDeviceText(bowl) ? bowl : (isElectricDeviceText(hmd) ? hmd : (isElectricDeviceText(pipe) ? pipe : ''));
    const electricDevice = rawElectric || detectedElectric;
    const isElectricSession = !!(s.is_electric || s.isElectric || electricDevice);

    sumDuration += dur;
    if (isElectricSession) {
      sumDurationElectric += dur;
      countElectric++;
    } else {
      sumDurationCoal += dur;
      countCoal++;
    }

    if (r > 0) {
      sumRating += r;
      ratingCount++;
    }

    const tobaccoItems = splitTobaccoItems(s);
    tobaccoItems.forEach(item => {
      tobaccoCounts[item] = (tobaccoCounts[item] || 0) + 1;
    });
    if (tobaccoItems.length > 1 && tob && tob !== 'Unbekannter Tabak') {
      mixCounts[tob] = (mixCounts[tob] || 0) + 1;
    }

    if (electricDevice) {
      incrementItems(electricCounts, electricDevice);
    }
    if (pipe && !isElectricDeviceText(pipe) && pipe !== electricDevice) {
      incrementItems(pipeCounts, pipe);
    }
    if (bowl && !isElectricDeviceText(bowl) && bowl !== electricDevice) {
      incrementItems(bowlCounts, bowl);
    }
    if (hmd && !isElectricDeviceText(hmd) && hmd !== electricDevice) {
      incrementItems(hmdCounts, hmd);
    }
  });

  const avgDurCoal = countCoal > 0 ? Math.round(sumDurationCoal / countCoal) : 0;
  if (kpiAvgDurationCoal) kpiAvgDurationCoal.textContent = `${avgDurCoal} Min`;
  if (kpiCountCoal) kpiCountCoal.textContent = `${countCoal} ${countCoal === 1 ? 'Kopf' : 'Köpfe'}`;

  const avgDurElectric = countElectric > 0 ? Math.round(sumDurationElectric / countElectric) : 0;
  if (kpiAvgDurationElectric) kpiAvgDurationElectric.textContent = `${avgDurElectric} Min`;
  if (kpiCountElectric) kpiCountElectric.textContent = `${countElectric} ${countElectric === 1 ? 'Kopf' : 'Köpfe'}`;

  const avgDur = totalCount > 0 ? Math.round(sumDuration / totalCount) : 0;
  if (kpiAvgDuration) kpiAvgDuration.textContent = `${avgDur} Min`;

  const avgRat = ratingCount > 0 ? (sumRating / ratingCount).toFixed(1) : '-';
  if (kpiAvgRating) kpiAvgRating.textContent = avgRat !== '-' ? `🌟 ${avgRat} / 10` : '- / 10';

  const renderRanking = (container, counts, limit, emptyText, countLabel) => {
    if (!container) return;
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'de')).slice(0, limit);
    if (sorted.length === 0) {
      container.innerHTML = `<div style="color:var(--text-muted); font-size:0.8rem; text-align:center; padding:12px;">${emptyText}</div>`;
      return;
    }
    const maxCount = sorted[0][1] || 1;
    container.innerHTML = sorted.map(([name, count], idx) => {
      const pct = Math.round((count / maxCount) * 100);
      const rankClass = idx === 0 ? 'rank-1' : (idx === 1 ? 'rank-2' : (idx === 2 ? 'rank-3' : 'rank-other'));
      return `<div class="ranking-item">
        <div class="ranking-badge ${rankClass}">#${idx + 1}</div>
        <div class="ranking-info">
          <div class="ranking-title">${escapeHtml(name)}</div>
          <div class="ranking-bar-track"><div class="ranking-bar-fill" style="width:${pct}%;"></div></div>
        </div>
        <div class="ranking-count">${count}x ${countLabel}</div>
      </div>`;
    }).join('');
  };

  renderRanking(containerTobacco, tobaccoCounts, 10, 'Noch keine einzelnen Tabaksorten erfasst.', 'geraucht');
  renderRanking(containerMixes, mixCounts, 10, 'Noch keine Tabak-Mixes erfasst.', 'gemischt');
  renderRanking(containerPipes, pipeCounts, 5, 'Noch keine Pfeifen erfasst.', 'genutzt');
  renderRanking(containerBowls, bowlCounts, 5, 'Noch keine Köpfe erfasst.', 'genutzt');
  renderRanking(containerHmds, hmdCounts, 5, 'Noch keine HMDs erfasst.', 'genutzt');
  renderRanking(containerElectric, electricCounts, 5, 'Noch keine Elektrogeräte erfasst.', 'genutzt');
}

function updateHeadCounterUI() {
  const lblTitle = document.getElementById('lbl-active-session-title');
  if (lblTitle) {
    if (statsState.isRunning && statsState.activeSetup && statsState.activeSetup.tobacco) {
      lblTitle.textContent = `🥣 Kopf #${statsState.headCountToday || 1}: ${statsState.activeSetup.tobacco}`;
    } else if (!statsState.isRunning) {
      lblTitle.textContent = 'Kein aktiver Kopf';
    }
  }
  const badgeCount = document.getElementById('lbl-head-count-badge');
  if (badgeCount) {
    badgeCount.textContent = `#${statsState.headCountToday || 1}`;
  }
}

function copyStreamSummaryToChat() {
  const sessions = statsState.sessions || [];
  if (sessions.length === 0) {
    showToast('Noch keine Köpfe in der heutigen Historie.', 'info');
    return;
  }

  const lines = [`💨 ShishaWG Stream-Köpfe heute (${sessions.length} Gesamt):`];
  sessions.slice(0, 6).forEach(s => {
    const headNum = s.head_num || s.headNum || 1;
    const tob = s.tobacco || 'Tabak';
    const dur = s.duration_minutes || s.durationMinutes || 0;
    const rating = s.rating ? `[${s.rating}/10]` : '';
    lines.push(`• Kopf #${headNum}: ${tob} (${dur} Min) ${rating}`);
  });

  const text = lines.join(' ');
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('📋 Stream-Zusammenfassung in die Zwischenablage kopiert!', 'success');
    });
  }

  // Send directly to chat if twitchService is connected
  if (btnSendChat) {
    const inputGlobalExtra = document.getElementById('input-global-extra');
    if (inputGlobalExtra) inputGlobalExtra.value = text;
  }
}

function restoreActiveTimerState(timerState) {
  if (!timerState || !timerState.isRunning || !timerState.sessionStartTime || !timerState.activeSetup) return false;

  const normalizeTimestamp = value => {
    if (typeof value === 'number') return value;
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : null;
  };

  const sessionStartTime = normalizeTimestamp(timerState.sessionStartTime);
  if (!sessionStartTime) return false;

  const isNewSession = statsState.sessionStartTime !== sessionStartTime;
  statsState.isRunning = true;
  statsState.sessionStartTime = sessionStartTime;
  statsState.coalStartTime = normalizeTimestamp(timerState.coalStartTime) || sessionStartTime;
  statsState.sessionElapsedSeconds = Math.max(0, Math.floor((Date.now() - statsState.sessionStartTime) / 1000));
  statsState.coalElapsedSeconds = Math.max(0, Math.floor((Date.now() - statsState.coalStartTime) / 1000));
  statsState.coalRotations = Number(timerState.coalRotations) || 0;
  statsState.headCountToday = Number(timerState.headCountToday) || 1;
  statsState.activeSetup = timerState.activeSetup;
  if (isNewSession) {
    statsState.lastAlertPhase = null;
  }

  const active = statsState.activeSetup;
  lastKnownSetupSignature = `${active.tobacco || ''}__${active.bowl || ''}__${active.hmd || ''}__${active.pipe || ''}__${active.electricDevice || ''}`.toLowerCase();

  const lblTitle = document.getElementById('lbl-active-session-title');
  const lblSub = document.getElementById('lbl-active-session-sub');
  const badge = document.getElementById('timer-live-badge');
  const lblStatus = document.getElementById('lbl-timer-status');
  if (lblTitle) lblTitle.textContent = `🥣 Kopf #${statsState.headCountToday}: ${active.tobacco || 'Aktueller Kopf'}`;
  if (lblSub) {
    lblSub.textContent = isElectricSetup(active)
      ? `⚡ ${active.electricDevice || active.bowl || 'Elektrogerät'} • 8 Min Preheat`
      : [active.bowl, active.hmd, active.pipe].filter(Boolean).join(' • ') || 'Aktiv im Stream';
  }
  if (badge) badge.className = 'qna-status-badge live';
  if (lblStatus) lblStatus.textContent = 'Raucht live';
  const btnStartHead = document.getElementById('btn-timer-start-head');
  const btnFinishHead = document.getElementById('btn-timer-finish-head');
  if (btnStartHead) btnStartHead.classList.add('hidden');
  if (btnFinishHead) btnFinishHead.classList.remove('hidden');

  const chkUpdate = document.getElementById('chk-update-active-session-only');
  if (chkUpdate) {
    chkUpdate.disabled = false;
    if (chkUpdate.parentElement) chkUpdate.parentElement.style.opacity = '1';
  }

  if (statsState.intervalId) clearInterval(statsState.intervalId);
  statsState.intervalId = setInterval(updateStatsTimerTick, 1000);
  updateStatsTimerTick();
  updateHeadCounterUI();
  return true;
}

async function loadStatsState() {
  try {
    const chan = (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved';
    
    // Load Sessions
    const res = await ipcRenderer.invoke('stats:get-sessions', chan);
    if (res && res.success && Array.isArray(res.sessions)) {
      statsState.sessions = res.sessions;
      renderSessionsHistory(res.sessions);
      renderStatsAnalytics(res.sessions);
    }

    // Load Timer State
    const timerRes = await ipcRenderer.invoke('stats:get-timer-state', chan);
    if (timerRes && timerRes.success && timerRes.timerState) {
      const ts = timerRes.timerState;
      if (typeof ts.headCountToday === 'number') {
        statsState.headCountToday = ts.headCountToday;
      }
      if (ts.activeSetup) {
        statsState.activeSetup = ts.activeSetup;
      }
      if (ts.isRunning) {
        restoreActiveTimerState(ts);
      } else {
        resetActiveTimer(false);
      }
      updateHeadCounterUI();
    }
    if (typeof refreshDashboardWidgets === 'function') {
      refreshDashboardWidgets(['widget-timer', 'widget-stats']);
      updateStatsTimerTick();
    }
  } catch(e) {
    console.error('Error loading stats state:', e);
  }
}

function rotateCoal() {
  if (!statsState.isRunning || isElectricSetup(statsState.activeSetup)) return false;
  statsState.coalRotations = (statsState.coalRotations || 0) + 1;
  statsState.coalStartTime = Date.now();
  statsState.coalElapsedSeconds = 0;
  statsState.lastAlertPhase = null;
  updateStatsTimerTick();
  saveActiveTimerStateToBackend();
  showToast('Kohle gewendet. Der Kohletimer beginnt neu.', 'success');
  return true;
}

function finishHeadSession() {
  // Reuse the existing rating/review step, including its persistence logic.
  document.getElementById('btn-timer-finish-head')?.click();
}

function setupStatsListeners() {
  const btnStartHead = document.getElementById('btn-timer-start-head');
  const btnFinishHead = document.getElementById('btn-timer-finish-head');
  const btnCopyObs = document.getElementById('btn-copy-timer-obs-link');
  const btnRefreshStats = document.getElementById('btn-refresh-stats');
  const btnCopySummary = document.getElementById('btn-copy-stream-summary');

  if (btnStartHead) {
    btnStartHead.addEventListener('click', () => {
      checkAndAutoStartHeadSession(true);
      showToast('⏱️ Kopf gestartet! Timer läuft.', 'success');
    });
  }

  const tabHistory = document.getElementById('tab-stats-history');
  const tabAnalytics = document.getElementById('tab-stats-analytics');
  const panelHistory = document.getElementById('panel-stats-history');
  const panelAnalytics = document.getElementById('panel-stats-analytics');

  // Keep the active timer visible above navigation and history.
  const statsView = document.getElementById('view-stats');
  const statsNav = statsView ? statsView.querySelector('.polls-segmented-nav') : null;
  const liveTimerBar = statsView ? statsView.querySelector('.live-session-bottom-bar') : null;
  if (statsNav && liveTimerBar && liveTimerBar.nextElementSibling !== statsNav) {
    statsNav.parentNode.insertBefore(liveTimerBar, statsNav);
  }

  // Modal Finish Head Elements
  const modalFinish = document.getElementById('modal-finish-head');
  const btnCloseFinishModal = document.getElementById('btn-close-finish-modal');
  const btnCancelFinishModal = document.getElementById('btn-cancel-finish-modal');
  const btnConfirmFinish = document.getElementById('btn-confirm-finish-session');
  const modalEditSession = document.getElementById('modal-edit-stats-session');
  const btnCloseEditSession = document.getElementById('btn-close-edit-stats-session');
  const btnCancelEditSession = document.getElementById('btn-cancel-edit-stats-session');
  const btnSaveEditSession = document.getElementById('btn-save-edit-stats-session');
  const btnEditSessionDateTime = document.getElementById('btn-edit-session-datetime');
  const editSessionDateTimePopover = document.getElementById('edit-session-datetime-popover');
  const editSessionCalendarGrid = document.getElementById('edit-session-calendar-grid');
  const btnEditDatePrevMonth = document.getElementById('btn-edit-date-prev-month');
  const btnEditDateNextMonth = document.getElementById('btn-edit-date-next-month');
  const btnEditDateToday = document.getElementById('btn-edit-date-today');
  const btnEditDateApply = document.getElementById('btn-edit-date-apply');
  const inputEditDateHour = document.getElementById('input-edit-date-hour');
  const inputEditDateMinute = document.getElementById('input-edit-date-minute');

  // OBS Link copy
  if (btnCopyObs) {
    btnCopyObs.addEventListener('click', async () => {
      const input = document.getElementById('obs-timer-cloud-url');
      const url = input && input.value ? input.value : 'https://bazztee.github.io/shishawg-mod-setup-tool/qna.html?mode=timer';
      await ipcRenderer.invoke('app:copy-clipboard', url);
      showToast('📺 OBS-Timer Overlay URL in die Zwischenablage kopiert!', 'success');
    });
  }

  // Refresh Stats
  if (btnRefreshStats) {
    btnRefreshStats.addEventListener('click', async () => {
      showToast('Aktualisiere Statistiken...', 'info');
      await loadStatsState();
      showToast('Statistiken synchronisiert! 🔄', 'success');
    });
  }

  // Copy Stream Summary
  if (btnCopySummary) {
    btnCopySummary.addEventListener('click', () => {
      copyStreamSummaryToChat();
    });
  }

  // Sub-tabs switching
  if (tabHistory && tabAnalytics && panelHistory && panelAnalytics) {
    tabHistory.addEventListener('click', () => {
      tabHistory.classList.add('active');
      tabAnalytics.classList.remove('active');
      panelHistory.classList.remove('hidden');
      panelAnalytics.classList.add('hidden');
    });

    tabAnalytics.addEventListener('click', () => {
      tabAnalytics.classList.add('active');
      tabHistory.classList.remove('active');
      panelAnalytics.classList.remove('hidden');
      panelHistory.classList.add('hidden');
      renderStatsAnalytics(statsState.sessions);
    });
  }

  // Finish Head Modal
  if (btnFinishHead && modalFinish) {
    btnFinishHead.addEventListener('click', () => {
      if (!statsState.isRunning || !statsState.activeSetup || !statsState.activeSetup.tobacco) {
        showToast('Aktuell läuft kein aktiver Kopf.', 'info');
        return;
      }
      const lblTob = document.getElementById('lbl-modal-finish-tobacco');
      const lblDur = document.getElementById('lbl-modal-finish-duration');
      const lblCoals = document.getElementById('lbl-modal-finish-coals');
      const lblCoalsLabel = document.getElementById('lbl-modal-finish-coals-label');

      const tobName = statsState.activeSetup.tobacco || 'Aktueller Kopf';
      const durMins = Math.max(1, Math.round(statsState.sessionElapsedSeconds / 60));

      if (lblTob) lblTob.textContent = tobName;
      if (lblDur) lblDur.textContent = `${durMins} Minuten`;
      if (isElectricSetup(statsState.activeSetup)) {
        if (lblCoalsLabel) lblCoalsLabel.textContent = 'Elektro-Preheat:';
        if (lblCoals) lblCoals.textContent = '8 Minuten';
      } else {
        if (lblCoalsLabel) lblCoalsLabel.textContent = 'Kohle gewendet:';
        if (lblCoals) lblCoals.textContent = `${statsState.coalRotations || 0}x`;
      }

      modalFinish.classList.remove('hidden');
    });
  }

  if (btnCloseFinishModal && modalFinish) {
    btnCloseFinishModal.addEventListener('click', () => modalFinish.classList.add('hidden'));
  }
  if (btnCancelFinishModal && modalFinish) {
    btnCancelFinishModal.addEventListener('click', () => modalFinish.classList.add('hidden'));
  }

  if (btnConfirmFinish && modalFinish) {
    btnConfirmFinish.addEventListener('click', async () => {
      await finishAndSaveHeadSession();
      modalFinish.classList.add('hidden');
    });
  }

  if (btnCloseEditSession && modalEditSession) {
    btnCloseEditSession.addEventListener('click', () => modalEditSession.classList.add('hidden'));
  }
  if (btnCancelEditSession && modalEditSession) {
    btnCancelEditSession.addEventListener('click', () => modalEditSession.classList.add('hidden'));
  }
  if (btnSaveEditSession && modalEditSession) {
    btnSaveEditSession.addEventListener('click', saveStatsSessionEdits);
  }

  if (btnEditSessionDateTime && editSessionDateTimePopover) {
    btnEditSessionDateTime.addEventListener('click', (event) => {
      event.stopPropagation();
      const willOpen = editSessionDateTimePopover.classList.contains('hidden');
      editSessionDateTimePopover.classList.toggle('hidden', !willOpen);
      btnEditSessionDateTime.setAttribute('aria-expanded', String(willOpen));
      if (willOpen) renderStatsEditDateTimePicker();
    });
    editSessionDateTimePopover.addEventListener('click', event => event.stopPropagation());
    document.addEventListener('click', () => {
      editSessionDateTimePopover.classList.add('hidden');
      btnEditSessionDateTime.setAttribute('aria-expanded', 'false');
    });
  }

  if (editSessionCalendarGrid) {
    editSessionCalendarGrid.addEventListener('click', (event) => {
      const dayButton = event.target.closest('[data-picker-date]');
      if (!dayButton) return;
      const [year, month, day] = dayButton.dataset.pickerDate.split('-').map(Number);
      statsEditPickerDate.setFullYear(year, month - 1, day);
      statsEditPickerView = new Date(year, month - 1, 1);
      syncStatsEditDateTimeValue();
      renderStatsEditDateTimePicker();
    });
  }

  if (btnEditDatePrevMonth) {
    btnEditDatePrevMonth.addEventListener('click', () => {
      statsEditPickerView = new Date(statsEditPickerView.getFullYear(), statsEditPickerView.getMonth() - 1, 1);
      renderStatsEditDateTimePicker();
    });
  }
  if (btnEditDateNextMonth) {
    btnEditDateNextMonth.addEventListener('click', () => {
      statsEditPickerView = new Date(statsEditPickerView.getFullYear(), statsEditPickerView.getMonth() + 1, 1);
      renderStatsEditDateTimePicker();
    });
  }
  if (btnEditDateToday) {
    btnEditDateToday.addEventListener('click', () => setStatsEditPickerDate(new Date()));
  }
  if (btnEditDateApply && editSessionDateTimePopover && btnEditSessionDateTime) {
    btnEditDateApply.addEventListener('click', () => {
      updateStatsEditPickerTime();
      editSessionDateTimePopover.classList.add('hidden');
      btnEditSessionDateTime.setAttribute('aria-expanded', 'false');
    });
  }
  [inputEditDateHour, inputEditDateMinute].forEach(input => {
    if (input) input.addEventListener('change', updateStatsEditPickerTime);
  });
}
