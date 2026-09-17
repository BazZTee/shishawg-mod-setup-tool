// =========================================================
// TWITCH PREDICTIONS (VORHERSAGEN) LOGIC
// =========================================================

function setupPollsAndPredictionsListeners() {
  // Tab Switcher between Polls and Predictions
  const tabPolls = document.getElementById('tab-nav-polls');
  const tabPredictions = document.getElementById('tab-nav-predictions');
  const panelPolls = document.getElementById('panel-mode-polls');
  const panelPredictions = document.getElementById('panel-mode-predictions');

  if (tabPolls && tabPredictions && panelPolls && panelPredictions) {
    tabPolls.addEventListener('click', () => {
      tabPolls.classList.add('active');
      tabPredictions.classList.remove('active');
      panelPolls.classList.remove('hidden');
      panelPredictions.classList.add('hidden');
    });

    tabPredictions.addEventListener('click', () => {
      tabPredictions.classList.add('active');
      tabPolls.classList.remove('active');
      panelPredictions.classList.remove('hidden');
      panelPolls.classList.add('hidden');
    });
  }

  // Prediction Form Elements
  const inputPredTitle = document.getElementById('input-prediction-title');
  const lblPredTitleCount = document.getElementById('lbl-prediction-title-count');
  const predChoicesContainer = document.getElementById('prediction-choices-container');
  const btnAddPredChoice = document.getElementById('btn-add-prediction-choice');
  const btnStartPrediction = document.getElementById('btn-start-twitch-prediction');
  const btnSavePredTemplate = document.getElementById('btn-save-custom-prediction-template');

  if (inputPredTitle && lblPredTitleCount) {
    inputPredTitle.addEventListener('input', () => {
      lblPredTitleCount.textContent = `${inputPredTitle.value.length}/120`;
    });
  }

  if (btnAddPredChoice && predChoicesContainer) {
    btnAddPredChoice.addEventListener('click', () => {
      const currentChoices = predChoicesContainer.querySelectorAll('.poll-choice-row');
      if (currentChoices.length >= 4) {
        showToast('Maximal 4 Auswahlmöglichkeiten für Vorhersagen erlaubt.', 'info');
        return;
      }
      const nextNum = currentChoices.length + 1;
      const row = document.createElement('div');
      row.className = 'poll-choice-row';
      const badgeColor = nextNum === 3 ? '#10b981' : '#f59e0b';
      row.innerHTML = `
        <span class="choice-num" style="background:${badgeColor}; color:#fff; border-radius:4px; font-size:0.7rem; padding:2px 4px;">${nextNum}</span>
        <input type="text" class="input-prediction-choice" placeholder="Option ${nextNum} (max. 25 Z.)" maxlength="25">
        <button class="btn-remove-choice" title="Option entfernen">✕</button>
      `;
      row.querySelector('.btn-remove-choice').addEventListener('click', () => {
        row.remove();
        updatePredictionChoiceNumbers();
      });
      predChoicesContainer.appendChild(row);
      const inp = row.querySelector('.input-prediction-choice');
      if (inp) inp.focus();
    });
  }

  // Preset Buttons for Predictions
  const predPresetBtns = document.querySelectorAll('[data-prediction-preset]');
  predPresetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const pKey = btn.getAttribute('data-prediction-preset');
      applyPredictionPreset(pKey);
    });
  });

  if (btnStartPrediction) {
    btnStartPrediction.addEventListener('click', async () => {
      await startTwitchPredictionFromForm();
    });
  }

  if (btnSavePredTemplate) {
    btnSavePredTemplate.addEventListener('click', async () => {
      await saveCustomPredictionTemplateFromForm();
    });
  }
}

function updatePredictionChoiceNumbers() {
  const container = document.getElementById('prediction-choices-container');
  if (!container) return;
  const rows = container.querySelectorAll('.poll-choice-row');
  const colors = ['#3b82f6', '#ec4899', '#10b981', '#f59e0b'];
  rows.forEach((r, idx) => {
    const numSpan = r.querySelector('.choice-num');
    if (numSpan) {
      numSpan.textContent = String(idx + 1);
      numSpan.style.background = colors[idx % colors.length];
    }
  });
}

function applyPredictionPreset(presetKey) {
  const inputTitle = document.getElementById('input-prediction-title');
  const lblTitleCount = document.getElementById('lbl-prediction-title-count');
  const choicesContainer = document.getElementById('prediction-choices-container');
  const selectDuration = document.getElementById('select-prediction-duration');

  if (!inputTitle || !choicesContainer) return;

  let title = '';
  let choices = [];
  let duration = '120';

  if (presetKey === 'preset_prediction_drag') {
    title = 'Wird der Kopf beim ersten Zug drücken?';
    choices = ['Ja 🔥', 'Nein 💨'];
    duration = '120';
  } else if (presetKey === 'preset_prediction_taste') {
    title = 'Bewertung: Schmeckt der Tabak 10/10?';
    choices = ['Safe 10/10 🌟', 'Nope 🤢'];
    duration = '120';
  } else if (presetKey === 'preset_prediction_coal') {
    title = 'Fällt heute im Stream eine Kohle runter?';
    choices = ['Ja 💥', 'Nein 🪵'];
    duration = '300';
  } else if (presetKey === 'preset_prediction_speed') {
    title = 'Schafft Marvin das Setup in unter 5 Minuten?';
    choices = ['Ja ⚡', 'Nein 🐢'];
    duration = '180';
  }

  inputTitle.value = title;
  if (lblTitleCount) lblTitleCount.textContent = `${title.length}/120`;
  if (selectDuration) selectDuration.value = duration;

  choicesContainer.innerHTML = '';
  const colors = ['#3b82f6', '#ec4899', '#10b981', '#f59e0b'];
  choices.forEach((c, idx) => {
    const row = document.createElement('div');
    row.className = 'poll-choice-row';
    const canRemove = idx >= 2;
    row.innerHTML = `
      <span class="choice-num" style="background:${colors[idx]}; color:#fff; border-radius:4px; font-size:0.7rem; padding:2px 4px;">${idx + 1}</span>
      <input type="text" class="input-prediction-choice" placeholder="Option ${idx + 1}" maxlength="25" value="${c}">
      ${canRemove ? '<button class="btn-remove-choice" title="Option entfernen">✕</button>' : ''}
    `;
    if (canRemove) {
      row.querySelector('.btn-remove-choice').addEventListener('click', () => {
        row.remove();
        updatePredictionChoiceNumbers();
      });
    }
    choicesContainer.appendChild(row);
  });

  showToast(`Vorhersage-Vorlage „${title}“ geladen!`, 'info');
}

async function startTwitchPredictionFromForm() {
  const inputTitle = document.getElementById('input-prediction-title');
  const selectDuration = document.getElementById('select-prediction-duration');
  const choicesContainer = document.getElementById('prediction-choices-container');

  if (!inputTitle || !choicesContainer) return;

  const title = (inputTitle.value || '').trim();
  if (!title) {
    showToast('Bitte gib einen Vorhersage-Titel ein.', 'error');
    return;
  }

  const choiceInputs = choicesContainer.querySelectorAll('.input-prediction-choice');
  const outcomes = [];
  choiceInputs.forEach(inp => {
    const val = (inp.value || '').trim();
    if (val) outcomes.push(val);
  });

  if (outcomes.length < 2) {
    showToast('Eine Vorhersage benötigt mindestens 2 Optionen.', 'error');
    return;
  }

  const duration = selectDuration ? (parseInt(selectDuration.value, 10) || 120) : 120;
  const chan = (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved';

  showToast('Starte Twitch-Vorhersage...', 'info');

  try {
    const res = await ipcRenderer.invoke('predictions:create', {
      title,
      outcomes,
      duration,
      channel: chan
    });

    if (res && res.success) {
      predictionsState.activePrediction = res.prediction;
      renderPredictionActiveSection(res.prediction);
      showToast('🔮 Vorhersage auf Twitch gestartet!', 'success');
    } else {
      const err = res && res.error ? res.error : 'Vorhersage konnte nicht gestartet werden';
      showToast(`Fehler: ${err}`, 'error');
    }
  } catch(e) {
    showToast(`Fehler beim Starten: ${e.message}`, 'error');
  }
}

async function saveCustomPredictionTemplateFromForm() {
  const inputTitle = document.getElementById('input-prediction-title');
  const selectDuration = document.getElementById('select-prediction-duration');
  const choicesContainer = document.getElementById('prediction-choices-container');

  if (!inputTitle || !choicesContainer) return;

  const title = (inputTitle.value || '').trim();
  if (!title) {
    showToast('Bitte erst einen Titel eingeben.', 'error');
    return;
  }

  const choiceInputs = choicesContainer.querySelectorAll('.input-prediction-choice');
  const outcomes = [];
  choiceInputs.forEach(inp => {
    const val = (inp.value || '').trim();
    if (val) outcomes.push(val);
  });

  if (outcomes.length < 2) {
    showToast('Mindestens 2 Optionen für Vorhersage erforderlich.', 'error');
    return;
  }

  const duration = selectDuration ? (parseInt(selectDuration.value, 10) || 120) : 120;

  const newTmpl = {
    id: 'pred_tmpl_' + Date.now(),
    title,
    choices: outcomes,
    duration,
    isPreset: false
  };

  if (!predictionsState.templates) predictionsState.templates = [];
  predictionsState.templates.push(newTmpl);
  try {
    localStorage.setItem('swg_prediction_templates', JSON.stringify(predictionsState.templates));
  } catch(e) {}
  renderSavedPredictionTemplates();
  showToast(`Vorhersage-Vorlage „${title}“ gespeichert! 💾`, 'success');
}

function renderSavedPredictionTemplates() {
  const container = document.getElementById('prediction-saved-templates-list');
  if (!container) return;

  if (!predictionsState.templates || predictionsState.templates.length === 0) {
    try {
      const stored = localStorage.getItem('swg_prediction_templates');
      if (stored) predictionsState.templates = JSON.parse(stored);
    } catch(e) {}
  }

  const customTemplates = (predictionsState.templates || []).filter(t => !t.isPreset);
  if (customTemplates.length === 0) {
    container.innerHTML = `
      <div style="color:var(--text-muted); font-size:0.8rem; text-align:center; padding:10px;">
        Noch keine eigenen Vorhersagen gespeichert.
      </div>
    `;
    return;
  }

  container.innerHTML = '';
  customTemplates.forEach(t => {
    const item = document.createElement('div');
    item.className = 'poll-saved-item';
    item.innerHTML = `
      <div style="flex:1; min-width:0; padding-right:8px;">
        <strong style="display:block; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(t.title)}</strong>
        <span style="color:var(--text-muted); font-size:0.72rem;">${t.choices.length} Ausgänge • ${t.duration}s</span>
      </div>
      <div style="display:flex; gap:6px;">
        <button class="btn btn-xs btn-primary btn-load-tmpl" title="In Ersteller laden">Laden ➔</button>
        <button class="btn btn-xs btn-secondary btn-del-tmpl" title="Löschen">🗑️</button>
      </div>
    `;

    item.querySelector('.btn-load-tmpl').addEventListener('click', () => {
      const inputTitle = document.getElementById('input-prediction-title');
      const lblTitleCount = document.getElementById('lbl-prediction-title-count');
      const selectDuration = document.getElementById('select-prediction-duration');
      const choicesContainer = document.getElementById('prediction-choices-container');

      if (inputTitle) inputTitle.value = t.title;
      if (lblTitleCount) lblTitleCount.textContent = `${t.title.length}/120`;
      if (selectDuration) selectDuration.value = String(t.duration || 120);

      if (choicesContainer) {
        choicesContainer.innerHTML = '';
        const colors = ['#3b82f6', '#ec4899', '#10b981', '#f59e0b'];
        t.choices.forEach((c, idx) => {
          const row = document.createElement('div');
          row.className = 'poll-choice-row';
          const canRemove = idx >= 2;
          row.innerHTML = `
            <span class="choice-num" style="background:${colors[idx % colors.length]}; color:#fff; border-radius:4px; font-size:0.7rem; padding:2px 4px;">${idx + 1}</span>
            <input type="text" class="input-prediction-choice" placeholder="Option ${idx + 1}" maxlength="25" value="${escapeHtml(c)}">
            ${canRemove ? '<button class="btn-remove-choice" title="Option entfernen">✕</button>' : ''}
          `;
          if (canRemove) {
            row.querySelector('.btn-remove-choice').addEventListener('click', () => {
              row.remove();
              updatePredictionChoiceNumbers();
            });
          }
          choicesContainer.appendChild(row);
        });
      }
      showToast(`Vorhersage „${t.title}“ geladen!`, 'info');
    });

    item.querySelector('.btn-del-tmpl').addEventListener('click', () => {
      predictionsState.templates = predictionsState.templates.filter(x => x.id !== t.id);
      try {
        localStorage.setItem('swg_prediction_templates', JSON.stringify(predictionsState.templates));
      } catch(e) {}
      renderSavedPredictionTemplates();
      showToast('Vorlage gelöscht.', 'info');
    });

    container.appendChild(item);
  });
}

function renderPredictionActiveSection(pred) {
  const container = document.getElementById('prediction-live-content');
  const indicator = document.getElementById('prediction-live-indicator');
  if (!container || !indicator) return;

  if (!pred || pred.status === 'CANCELED' || pred.status === 'RESOLVED') {
    indicator.className = 'qna-status-badge offline';
    indicator.innerHTML = '<span class="status-dot"></span><span class="status-text">Keine aktiv</span>';
    container.innerHTML = `
      <div class="poll-empty-state">
        <span class="empty-icon">🔮</span>
        <p>Aktuell läuft keine Vorhersage im Twitch-Kanal.</p>
        <span class="empty-hint">Wähle eine Vorlage unten oder erstelle rechts eine neue Vorhersage.</span>
      </div>
    `;
    return;
  }

  const isLocked = (pred.status === 'LOCKED');
  const isActive = (pred.status === 'ACTIVE');

  indicator.className = `qna-status-badge ${isActive ? 'live' : 'closed'}`;
  indicator.innerHTML = `<span class="status-dot"></span><span class="status-text">${isActive ? 'Live (Einsätze offen)' : 'Gesperrt (Auswertung)'}</span>`;

  const outcomes = pred.outcomes || [];
  const totalPoints = outcomes.reduce((sum, o) => sum + (o.channel_points || 0), 0);
  const totalUsers = outcomes.reduce((sum, o) => sum + (o.users || 0), 0);

  let outcomesHtml = `<div class="prediction-live-outcomes-grid">`;
  outcomes.forEach((o, idx) => {
    const isWinner = (pred.winning_outcome_id === o.id);
    const colorClass = (idx === 0) ? 'blue' : (idx === 1 ? 'pink' : '');
    const pts = o.channel_points || 0;
    const pct = totalPoints > 0 ? Math.round((pts / totalPoints) * 100) : 0;
    outcomesHtml += `
      <div class="prediction-outcome-box ${colorClass} ${isWinner ? 'winner' : ''}">
        <div class="prediction-outcome-header ${colorClass}">
          <span>${escapeHtml(o.title)}</span>
          <span>${pct}%</span>
        </div>
        <div class="prediction-outcome-stats">
          <strong>${pts.toLocaleString()}</strong> Punkte • <strong>${o.users || 0}</strong> Einsätze
        </div>
      </div>
    `;
  });
  outcomesHtml += `</div>`;

  let actionButtonsHtml = `<div class="prediction-resolve-actions">`;
  if (isActive) {
    actionButtonsHtml += `
      <button id="btn-lock-prediction" class="btn btn-sm btn-secondary" title="Einsätze vorzeitig sperren">
        🔒 Einsätze sperren
      </button>
    `;
  }
  outcomes.forEach(o => {
    actionButtonsHtml += `
      <button class="btn btn-sm btn-primary btn-resolve-prediction" data-outcome-id="${o.id}">
        🏆 „${escapeHtml(o.title)}“ als Gewinner
      </button>
    `;
  });
  actionButtonsHtml += `
    <button id="btn-cancel-prediction" class="btn btn-sm btn-secondary" style="color:#ef4444; border-color:rgba(239,68,68,0.4);" title="Vorhersage abbrechen und alle Kanalpunkte zurückerstatten">
      ✕ Abbrechen (Refund)
    </button>
  </div>`;

  container.innerHTML = `
    <div style="margin-bottom:8px;">
      <h4 style="font-size:1.05rem; color:#fff; margin-bottom:4px;">„${escapeHtml(pred.title)}“</h4>
      <div style="font-size:0.75rem; color:var(--text-muted);">
        Gesamt: <strong>${totalPoints.toLocaleString()}</strong> Punkte von <strong>${totalUsers}</strong> Zuschauern
      </div>
    </div>
    ${outcomesHtml}
    ${actionButtonsHtml}
  `;

  // Attach button handlers
  const btnLock = container.querySelector('#btn-lock-prediction');
  if (btnLock) {
    btnLock.addEventListener('click', async () => {
      const chan = (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved';
      showToast('Sperre Einsätze...', 'info');
      await ipcRenderer.invoke('predictions:end', { predictionId: pred.id, status: 'LOCKED', channel: chan });
      const updated = await ipcRenderer.invoke('predictions:get-active', chan);
      if (updated && updated.prediction) renderPredictionActiveSection(updated.prediction);
      showToast('Einsätze für Vorhersage gesperrt! 🔒', 'success');
    });
  }

  const btnCancel = container.querySelector('#btn-cancel-prediction');
  if (btnCancel) {
    btnCancel.addEventListener('click', async () => {
      if (confirm('Möchtest du diese Vorhersage wirklich abbrechen? Alle gesetzten Punkte werden den Zuschauern erstattet.')) {
        const chan = (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved';
        await ipcRenderer.invoke('predictions:end', { predictionId: pred.id, status: 'CANCELED', channel: chan });
        predictionsState.activePrediction = null;
        renderPredictionActiveSection(null);
        showToast('Vorhersage abgebrochen & Punkte erstattet.', 'info');
      }
    });
  }

  container.querySelectorAll('.btn-resolve-prediction').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const winId = e.currentTarget.getAttribute('data-outcome-id');
      const winOutcome = outcomes.find(x => x.id === winId);
      const winTitle = winOutcome ? winOutcome.title : 'Option';
      if (confirm(`Möchtest du „${winTitle}“ als Gewinner-Ausgang auflösen und die Gewinne an die Zuschauer auszahlen?`)) {
        const chan = (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || 'marved';
        showToast('Zahle Gewinne aus...', 'info');
        await ipcRenderer.invoke('predictions:end', { predictionId: pred.id, status: 'RESOLVED', winningOutcomeId: winId, channel: chan });
        predictionsState.activePrediction = null;
        renderPredictionActiveSection(null);
        showToast(`🏆 Gewinne für „${winTitle}“ erfolgreich ausgezahlt!`, 'success');
      }
    });
  });
}

