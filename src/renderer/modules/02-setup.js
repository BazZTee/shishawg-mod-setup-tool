// Load Database Catalog
async function loadCatalog() {
  state.catalog = await ipcRenderer.invoke('db:get-catalog');
  updateDatalists();
}

// Update person count label text
function updatePersonCountLabel() {
  if (personCountLabel) {
    personCountLabel.textContent = state.personCount === 1
      ? '1 Person'
      : `${state.personCount} Personen`;
  }
}


function updateDatalists() {
  populateDatalist('list-pipes', state.catalog.pipes || []);

  const allBowls = state.catalog.bowls || [];
  const normalBowls = allBowls.filter(b => {
    if (typeof b === 'object') return !b.isElectric;
    return !b.toLowerCase().includes('xkah');
  });
  const electricBowls = allBowls.filter(b => {
    if (typeof b === 'object') return !!b.isElectric;
    return b.toLowerCase().includes('xkah');
  });

  populateDatalist('list-bowls', normalBowls);
  populateDatalist('list-electric-bowls', electricBowls);

  populateDatalist('list-vases', state.catalog.vases || []);
  populateDatalist('list-hmds', state.catalog.hmds || []);
  populateDatalist('list-tobacco', state.catalog.tobacco || []);
  populateDatalist('list-charcoal', state.catalog.charcoal || []);
  populateDatalist('list-persons', state.catalog.persons || []);
  populateDatalist('list-tastings', state.catalog.tastings || []);
  populateDatalist('list-promos', state.catalog.promos || []);
}

function populateDatalist(elementId, items) {
  const datalist = document.getElementById(elementId);
  if (!datalist) return;
  datalist.innerHTML = items.map(item => {
    const val = typeof item === 'string' ? item : item.name;
    return `<option value="${escapeHtml(val)}"></option>`;
  }).join('');
}

// Check Twitch Authentication
async function checkTwitchAuth() {
  try {
    const authData = await ipcRenderer.invoke('twitch:check-auth');
    if (authData && authData.user) {
      state.twitchUser = authData.user;
      if (authData.targetChannel) {
        state.targetChannel = authData.targetChannel;
        if (targetChannelInput) targetChannelInput.value = state.targetChannel;
      }
      if (authData.clientId) {
        state.clientId = authData.clientId;
        if (inputClientId) inputClientId.value = state.clientId;
      }
    } else {
      state.twitchUser = null;
      const cfg = await ipcRenderer.invoke('twitch:get-config');
      if (cfg && cfg.clientId) {
        state.clientId = cfg.clientId;
        if (inputClientId) inputClientId.value = state.clientId;
      }
    }
  } catch (err) {
    console.error('Error during checkTwitchAuth:', err);
    state.twitchUser = null;
  }
  updateTwitchUI();
  updateChannelBotTooltips();
}

function updateChannelBotTooltips() {
  if (targetChannelInput) {
    const val = targetChannelInput.value.trim() || 'marved';
    targetChannelInput.title = `Ziel-Kanal: #${val}`;
  }
  if (targetBotInput) {
    const val = targetBotInput.value.trim() || 'marvedbot';
    targetBotInput.title = `Bot-Name: @${val}`;
  }
}

function updateTwitchUI() {
  const previewModName = document.getElementById('preview-mod-name');
  const userColorPicker = document.getElementById('user-color-picker');
  const savedColor = localStorage.getItem('swg_user_color') || state.twitchUser?.color || '#FF7F00';
  const hubTiles = document.querySelectorAll('.hub-tile-card');
  const landingSubtitle = document.querySelector('.landing-subtitle');
  const landingTwitchBanner = document.getElementById('landing-twitch-banner');
  const bannerTokenExpired = document.getElementById('banner-token-expired');

  const activeProf = getActiveStreamerProfile();
  const hasTelegram = !!(activeProf?.telegram?.botToken && activeProf?.telegram?.chatId);
  const isAuthorizedMod = isCurrentUserModerator();

  if (state.twitchUser) {
    if (bannerTokenExpired) bannerTokenExpired.classList.add('hidden');
    btnTwitchLogin.classList.add('hidden');
    twitchUserBadge.classList.remove('hidden');
    const name = state.twitchUser?.display_name || state.twitchUser?.login || '';
    userDisplayName.textContent = name;
    userAvatar.src = state.twitchUser?.profile_image_url || 'https://static-cdn.jtvnw.net/user-default-pictures-uv/75305db0-3a59-4d70-9050-0b42c497426a-profile_image-70x70.png';

    if (!isAuthorizedMod) {
      if (previewModName) {
        previewModName.textContent = `${name} (Kein Mod):`;
        previewModName.style.color = '#ef4444';
      }
      if (landingTwitchBanner) landingTwitchBanner.classList.remove('hidden');
      if (landingSubtitle) {
        landingSubtitle.innerHTML = `<span style="color:#ef4444; font-weight:700;">⛔ Zugriff verweigert:</span> Dein Twitch-Account <strong>@${escapeHtml(name)}</strong> ist kein Moderator auf <em>twitch.tv/${escapeHtml(state.targetChannel || 'marved')}</em>.`;
      }

      // Lock all tiles (grey out & non-clickable)
      hubTiles.forEach(tile => {
        tile.classList.add('locked');
        tile.setAttribute('aria-disabled', 'true');
        const badge = tile.querySelector('.tile-badge');
        if (badge && !badge.classList.contains('planned')) {
          badge.className = 'tile-badge locked';
          badge.textContent = '⛔ Kein Mod';
        }
        const actionSpan = tile.querySelector('.tile-action span');
        if (actionSpan) {
          actionSpan.textContent = '⛔ Kein Zugriff';
        }
      });

      renderCustomDashboardTile();
      window.dispatchEvent(new CustomEvent('swg:auth-changed', { detail: { connected: false, isModerator: false } }));
      return;
    }

    if (previewModName) {
      previewModName.textContent = `${name}:`;
      previewModName.style.color = savedColor;
    }
    if (userColorPicker) {
      userColorPicker.value = savedColor.startsWith('#') ? savedColor : '#FF7F00';
    }

    if (landingTwitchBanner) landingTwitchBanner.classList.add('hidden');
    if (landingSubtitle) landingSubtitle.textContent = 'Wähle ein Modul aus, um zu starten:';

    // Unlock all tiles
    hubTiles.forEach(tile => {
      tile.classList.remove('locked');
      tile.removeAttribute('aria-disabled');
      const badge = tile.querySelector('.tile-badge');
      const target = tile.getAttribute('data-target');

      if (badge && !badge.classList.contains('planned')) {
        if (target === 'view-giveaways') {
          if (hasTelegram) {
            badge.className = 'tile-badge ready';
            badge.textContent = 'Bereit';
          } else {
            badge.className = 'tile-badge warning';
            badge.textContent = 'Kein Telegram';
          }
        } else if (target === 'view-qna' || target === 'view-polls') {
          if (state.twitchUser) {
            badge.className = 'tile-badge ready';
            badge.textContent = 'Bereit';
          } else {
            badge.className = 'tile-badge warning';
            badge.textContent = 'Twitch fehlt';
          }
        } else {
          badge.className = 'tile-badge ready';
          badge.textContent = 'Bereit';
        }
      }
      const actionSpan = tile.querySelector('.tile-action span');
      if (actionSpan) {
        actionSpan.textContent = 'Tool öffnen ➔';
      }
    });
  } else {
    if (bannerTokenExpired) bannerTokenExpired.classList.remove('hidden');
    btnTwitchLogin.classList.remove('hidden');
    twitchUserBadge.classList.add('hidden');
    if (previewModName) {
      previewModName.textContent = 'Mod:';
      previewModName.style.color = savedColor;
    }

    if (landingTwitchBanner) landingTwitchBanner.classList.remove('hidden');
    if (landingSubtitle) landingSubtitle.textContent = 'Bitte verbinde dich zuerst mit Twitch, um auf die Module zuzugreifen:';

    // Lock all tiles (grey out & non-clickable)
    hubTiles.forEach(tile => {
      tile.classList.add('locked');
      tile.setAttribute('aria-disabled', 'true');
      const badge = tile.querySelector('.tile-badge');
      const target = tile.getAttribute('data-target');

      if (badge && !badge.classList.contains('planned')) {
        if (target === 'view-giveaways' && !hasTelegram) {
          badge.className = 'tile-badge warning';
          badge.textContent = 'Kein Telegram';
        } else if (target === 'view-qna' || target === 'view-polls') {
          badge.className = 'tile-badge warning';
          badge.textContent = 'Twitch fehlt';
        } else {
          badge.className = 'tile-badge locked';
          badge.textContent = '🔒 Login erforderlich';
        }
      }
      const actionSpan = tile.querySelector('.tile-action span');
      if (actionSpan) {
        actionSpan.textContent = '🔒 Twitch verbinden';
      }
    });
  }

  // Always update the 8th tile state (Spec #3)
  renderCustomDashboardTile();
  window.dispatchEvent(new CustomEvent('swg:auth-changed', { detail: { connected: !!state.twitchUser } }));
}

// Default Initial Persons Setup (Default: 1 Person, Empty Fields)
function initDefaultPersons() {
  state.persons = [
    {
      name: '',
      pipe: '',
      bowl: '',
      hmd: '',
      tobaccos: [''],
      tobaccoAmounts: [''],
      tobaccoUnit: 'g',
      showTobaccoAmounts: false
    }
  ];
}

// Render Person Cards Grid
function renderPersonsGrid() {
  personsContainer.innerHTML = '';

  for (let i = 0; i < state.personCount; i++) {
    let p = state.persons[i];
    if (!p) {
      p = {
        name: '',
        pipe: '',
        bowl: '',
        hmd: '',
        tobaccos: [''],
        tobaccoAmounts: [''],
        tobaccoUnit: 'g',
        showTobaccoAmounts: false
      };
      state.persons[i] = p;
    }

    if (!p.tobaccos || p.tobaccos.length === 0) {
      p.tobaccos = [''];
    }
    if (!p.tobaccoAmounts) {
      p.tobaccoAmounts = p.tobaccos.map(() => '');
    }
    if (!p.tobaccoUnit) {
      p.tobaccoUnit = 'g';
    }

    const card = document.createElement('div');
    card.className = 'person-card';
    card.setAttribute('data-index', i);

    // Build Tobacco Slot HTML
    const tobaccoSlotsHtml = (p.tobaccos || ['']).map((tVal, tIdx) => {
      const amtVal = (p.tobaccoAmounts && p.tobaccoAmounts[tIdx] !== undefined) ? p.tobaccoAmounts[tIdx] : '';
      const unit = p.tobaccoUnit || 'g';
      return `
      <div class="tobacco-slot-row">
        <div class="clearable-input-wrapper" style="flex:1;">
          <input type="text" class="input-p-tob" data-pindex="${i}" data-tindex="${tIdx}" list="list-tobacco" value="${escapeHtml(tVal)}" placeholder="Tabak ${tIdx + 1}">
          <button class="btn-clear-field ${tVal ? '' : 'hidden'}" tabindex="-1" title="Feld leeren">✕</button>
        </div>
        ${p.showTobaccoAmounts ? `
        <div class="tobacco-amount-input-wrapper">
          <input type="text" class="input-p-tob-amount" data-pindex="${i}" data-tindex="${tIdx}" value="${escapeHtml(amtVal)}" placeholder="${unit === '%' ? '50%' : '12g'}">
        </div>
        ` : ''}
        ${tIdx > 0 ? `<button class="btn-icon btn-remove-tobacco-slot" data-pindex="${i}" data-tindex="${tIdx}" title="Tabaksortenslot entfernen">✕</button>` : ''}
      </div>
    `;
    }).join('');

    const isElectric = !!p.isElectric;
    const isOptionalOpen = state.expandedOptionalCards.has(i) || !!(p.vessel || p.vesselColor);
    const optTabIndex = isOptionalOpen ? '0' : '-1';

    card.innerHTML = `
      <div class="person-card-header">
        <div class="person-title">
          <span class="person-number-badge">Person ${i + 1}</span>
          <span class="person-name-display">${escapeHtml(p.name || `Person ${i + 1}`)}</span>
        </div>
        <div class="person-header-actions" style="display:flex; align-items:center; gap:12px;">
          <label class="toggle-switch checkbox-label" style="font-size: 0.78rem;" title="Kennzeichnet diese Person als E-Gerät Nutzer (z. B. XKAH Lite / Pro)">
            <input type="checkbox" class="chk-p-electric" tabindex="-1" data-index="${i}" ${isElectric ? 'checked' : ''}>
            <span class="toggle-slider"></span>
            <span class="toggle-text">⚡ E-Gerät</span>
          </label>
          <button class="btn-icon btn-clear-person" tabindex="-1" data-index="${i}" title="Person entfernen">✕</button>
        </div>
      </div>

      <div class="input-row">
        <div class="input-group">
          <label>Name:</label>
          <div class="clearable-input-wrapper">
            <input type="text" class="input-p-name" data-index="${i}" value="${escapeHtml(p.name)}" placeholder="z. B. Marvin">
            <button class="btn-clear-field ${p.name ? '' : 'hidden'}" tabindex="-1" title="Feld leeren">✕</button>
          </div>
        </div>
        <div class="input-group">
          <label>Pfeife:</label>
          <div class="clearable-input-wrapper">
            <input type="text" class="input-p-pipe" data-index="${i}" list="list-pipes" value="${escapeHtml(p.pipe)}" placeholder="z. B. Amotion Futr">
            <button class="btn-clear-field ${p.pipe ? '' : 'hidden'}" tabindex="-1" title="Feld leeren">✕</button>
          </div>
        </div>
      </div>

      <button class="optional-fields-toggle" tabindex="-1" aria-expanded="${isOptionalOpen ? 'true' : 'false'}" data-card-index="${i}">
        <svg class="toggle-chevron" viewBox="0 0 24 24" width="12" height="12"><path fill="currentColor" d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>
        Glas / Bowl ${(p.vessel || p.vesselColor) ? '✓' : '(optional)'}
      </button>
      <div class="optional-fields-collapsible ${isOptionalOpen ? '' : 'collapsed'}">
        <div class="optional-fields-box">
          <div class="input-row">
            <div class="input-group">
              <label class="label-optional">Bowl / Glas (optional):</label>
              <div class="clearable-input-wrapper">
                <input type="text" class="input-p-vessel" tabindex="${optTabIndex}" data-index="${i}" list="list-vases" value="${escapeHtml(p.vessel || '')}" placeholder="z. B. Caesar Crystal">
                <button class="btn-clear-field ${p.vessel ? '' : 'hidden'}" tabindex="-1" title="Feld leeren">✕</button>
              </div>
            </div>
            <div class="input-group">
              <label class="label-optional">Bowl-Farbe (optional):</label>
              <div class="clearable-input-wrapper">
                <input type="text" class="input-p-vessel-color" tabindex="${optTabIndex}" data-index="${i}" value="${escapeHtml(p.vesselColor || '')}" placeholder="z. B. Clear, Amber">
                <button class="btn-clear-field ${p.vesselColor ? '' : 'hidden'}" tabindex="-1" title="Feld leeren">✕</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="input-row">
        <div class="input-group" style="${isElectric ? 'grid-column: 1 / -1;' : ''}">
          <label>${isElectric ? '⚡ E-Gerät:' : 'Kopf:'}</label>
          <div class="clearable-input-wrapper">
            <input type="text" class="input-p-bowl" data-index="${i}" list="${isElectric ? 'list-electric-bowls' : 'list-bowls'}" value="${escapeHtml(p.bowl)}" placeholder="${isElectric ? 'z. B. XKAH Lite oder Pro' : 'z. B. Cosmo Bowl'}">
            <button class="btn-clear-field ${p.bowl ? '' : 'hidden'}" tabindex="-1" title="Feld leeren">✕</button>
          </div>
        </div>
        ${!isElectric ? `
        <div class="input-group">
          <label>HMD:</label>
          <div class="clearable-input-wrapper">
            <input type="text" class="input-p-hmd" data-index="${i}" list="list-hmds" value="${escapeHtml(p.hmd)}" placeholder="z. B. ONMO HMD">
            <button class="btn-clear-field ${p.hmd ? '' : 'hidden'}" tabindex="-1" title="Feld leeren">✕</button>
          </div>
        </div>
        ` : ''}
      </div>

      <div class="input-group full-width tobacco-mix-wrapper">
        <div class="tobacco-header-bar">
          <label style="margin-bottom:0;">Tabaksorte(n):</label>
          <div class="tobacco-amount-toggle-group">
            ${p.showTobaccoAmounts ? `
              <div class="unit-selector-pills">
                <button type="button" class="btn-unit-pill ${p.tobaccoUnit === 'g' ? 'active' : ''}" data-pindex="${i}" data-unit="g">g</button>
                <button type="button" class="btn-unit-pill ${p.tobaccoUnit === '%' ? 'active' : ''}" data-pindex="${i}" data-unit="%">%</button>
              </div>
            ` : ''}
            <label class="toggle-switch tobacco-amount-switch-label" title="Mischverhältnis oder Mengenangaben (% oder g) aktivieren">
              <input type="checkbox" class="chk-p-tob-amount" data-pindex="${i}" ${p.showTobaccoAmounts ? 'checked' : ''}>
              <span class="toggle-slider"></span>
              <span class="toggle-text">⚖️ Mengen</span>
            </label>
          </div>
        </div>
        <div class="tobacco-mix-inputs">
          ${tobaccoSlotsHtml}
        </div>
      </div>
    `;

    personsContainer.appendChild(card);
  }

  attachCardInputListeners();
}

// Attach Live Input Event Listeners
function attachCardInputListeners() {
  document.querySelectorAll('.person-card input').forEach(input => {
    input.addEventListener('input', (e) => {
      const pIdx = parseInt(e.target.getAttribute('data-index'));
      
      if (e.target.classList.contains('input-p-tob')) {
        const personIdx = parseInt(e.target.getAttribute('data-pindex'));
        const tobIdx = parseInt(e.target.getAttribute('data-tindex'));
        if (!isNaN(personIdx) && state.persons[personIdx]) {
          state.persons[personIdx].tobaccos[tobIdx] = e.target.value;

          // Seamless Auto-expand: typing into the last slot automatically appends a new empty slot!
          if (tobIdx === state.persons[personIdx].tobaccos.length - 1 && e.target.value.trim() !== '') {
            state.persons[personIdx].tobaccos.push('');
            if (state.persons[personIdx].tobaccoAmounts) {
              state.persons[personIdx].tobaccoAmounts.push('');
            }
            renderPersonsGrid();
            const newInputs = document.querySelectorAll(`.input-p-tob[data-pindex="${personIdx}"]`);
            if (newInputs[tobIdx]) {
              newInputs[tobIdx].focus();
              newInputs[tobIdx].setSelectionRange(e.target.value.length, e.target.value.length);
            }
          }
        }
      } else if (e.target.classList.contains('input-p-tob-amount')) {
        const personIdx = parseInt(e.target.getAttribute('data-pindex'));
        const tobIdx = parseInt(e.target.getAttribute('data-tindex'));
        if (!isNaN(personIdx) && state.persons[personIdx]) {
          if (!state.persons[personIdx].tobaccoAmounts) {
            state.persons[personIdx].tobaccoAmounts = [];
          }
          state.persons[personIdx].tobaccoAmounts[tobIdx] = e.target.value;
        }
      } else if (!isNaN(pIdx) && state.persons[pIdx]) {
        const p = state.persons[pIdx];
        if (e.target.classList.contains('input-p-name')) {
          p.name = e.target.value;
          const card = e.target.closest('.person-card');
          if (card) {
            const nameDisplay = card.querySelector('.person-name-display');
            if (nameDisplay) nameDisplay.textContent = p.name || `Person ${pIdx + 1}`;
          }
        } else if (e.target.classList.contains('input-p-pipe')) {
          p.pipe = e.target.value;
        } else if (e.target.classList.contains('input-p-vessel')) {
          p.vessel = e.target.value;
        } else if (e.target.classList.contains('input-p-vessel-color')) {
          p.vesselColor = e.target.value;
        } else if (e.target.classList.contains('input-p-bowl')) {
          p.bowl = e.target.value;
        } else if (e.target.classList.contains('input-p-hmd')) {
          p.hmd = e.target.value;
        }
      }

      // Auto-fill Person 1 name with 'Marvin' if any field of Person 1 has content and name is empty/default
      const personIndexForCheck = !isNaN(pIdx) ? pIdx : (typeof personIdx !== 'undefined' ? personIdx : null);
      if (personIndexForCheck === 0 && !e.target.classList.contains('input-p-name')) {
        const p1 = state.persons[0];
        if (p1 && (!p1.name || p1.name.trim() === '' || p1.name === 'Person 1')) {
          const hasContent = !!(p1.pipe || p1.vessel || p1.vesselColor || p1.bowl || p1.hmd || (p1.tobaccos && p1.tobaccos.some(t => t && t.trim())));
          if (hasContent) {
            p1.name = 'Marvin';
            const nameInput = document.querySelector('.input-p-name[data-index="0"]');
            if (nameInput) {
              nameInput.value = 'Marvin';
              const clearBtn = nameInput.parentElement ? nameInput.parentElement.querySelector('.btn-clear-field') : null;
              if (clearBtn) clearBtn.classList.remove('hidden');
            }
            const nameDisplay = document.querySelector('.person-card[data-index="0"] .person-name-display');
            if (nameDisplay) nameDisplay.textContent = 'Marvin';
          }
        }
      }

      generateCommandString();
    });
  });

  // Tobacco Amount Checkbox Toggle Listener
  document.querySelectorAll('.chk-p-tob-amount').forEach(chk => {
    chk.addEventListener('change', (e) => {
      const pIdx = parseInt(e.currentTarget.getAttribute('data-pindex'));
      if (!isNaN(pIdx) && state.persons[pIdx]) {
        state.persons[pIdx].showTobaccoAmounts = e.currentTarget.checked;
        if (!state.persons[pIdx].tobaccoAmounts) {
          state.persons[pIdx].tobaccoAmounts = state.persons[pIdx].tobaccos.map(() => '');
        }
        if (!state.persons[pIdx].tobaccoUnit) {
          state.persons[pIdx].tobaccoUnit = 'g';
        }
        renderPersonsGrid();
        generateCommandString();
      }
    });
  });

  // Tobacco Amount Unit Toggle Pills (g / %)
  document.querySelectorAll('.btn-unit-pill').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const pIdx = parseInt(e.currentTarget.getAttribute('data-pindex'));
      const unit = e.currentTarget.getAttribute('data-unit');
      if (!isNaN(pIdx) && state.persons[pIdx]) {
        state.persons[pIdx].tobaccoUnit = unit;
        renderPersonsGrid();
        generateCommandString();
      }
    });
  });

  // Remove Tobacco Slot Button
  document.querySelectorAll('.btn-remove-tobacco-slot').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const pIdx = parseInt(e.currentTarget.getAttribute('data-pindex'));
      const tIdx = parseInt(e.currentTarget.getAttribute('data-tindex'));
      if (!isNaN(pIdx) && state.persons[pIdx] && state.persons[pIdx].tobaccos[tIdx] !== undefined) {
        state.persons[pIdx].tobaccos.splice(tIdx, 1);
        if (state.persons[pIdx].tobaccoAmounts && state.persons[pIdx].tobaccoAmounts[tIdx] !== undefined) {
          state.persons[pIdx].tobaccoAmounts.splice(tIdx, 1);
        }
        if (state.persons[pIdx].tobaccos.length === 0) {
          state.persons[pIdx].tobaccos = [''];
          if (state.persons[pIdx].tobaccoAmounts) state.persons[pIdx].tobaccoAmounts = [''];
        }
        renderPersonsGrid();
        generateCommandString();
      }
    });
  });

  // Remove Person Card Button
  document.querySelectorAll('.btn-clear-person').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.currentTarget.getAttribute('data-index'));
      if (!isNaN(idx) && state.persons[idx]) {
        if (state.personCount > 1) {
          state.persons.splice(idx, 1);
          state.personCount--;
          updatePersonCountLabel();
        } else {
          // If only 1 person, clear fields of the remaining card
          state.persons[0] = { name: '', pipe: '', vessel: '', vesselColor: '', bowl: '', hmd: '', tobaccos: [''], tobaccoAmounts: [''], tobaccoUnit: 'g', showTobaccoAmounts: false, isElectric: false };
        }
        renderPersonsGrid();
        generateCommandString();
      }
    });
  });

  // Electric E-Gerät Checkbox Listener
  document.querySelectorAll('.chk-p-electric').forEach(chk => {
    chk.addEventListener('change', (e) => {
      const idx = parseInt(e.currentTarget.getAttribute('data-index'));
      if (!isNaN(idx) && state.persons[idx]) {
        state.persons[idx].isElectric = e.currentTarget.checked;
        renderPersonsGrid();
        generateCommandString();
      }
    });
  });

  // Optional Fields Toggle Listener
  document.querySelectorAll('.optional-fields-toggle').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const cardIdx = parseInt(e.currentTarget.getAttribute('data-card-index'));
      const collapsible = e.currentTarget.nextElementSibling;
      const isExpanded = e.currentTarget.getAttribute('aria-expanded') === 'true';
      if (isExpanded) {
        e.currentTarget.setAttribute('aria-expanded', 'false');
        collapsible.classList.add('collapsed');
        state.expandedOptionalCards.delete(cardIdx);
        collapsible.querySelectorAll('input').forEach(el => {
          if (!el.classList.contains('btn-clear-field')) el.setAttribute('tabindex', '-1');
        });
      } else {
        e.currentTarget.setAttribute('aria-expanded', 'true');
        collapsible.classList.remove('collapsed');
        state.expandedOptionalCards.add(cardIdx);
        collapsible.querySelectorAll('input').forEach(el => {
          if (!el.classList.contains('btn-clear-field')) el.setAttribute('tabindex', '0');
        });
      }
    });
  });
}

const KNOWN_STREAM_FLAVORS = {
  'pynkman': 'Erdbeere, Himbeere, Grapefruit',
  'pinkman': 'Erdbeere, Himbeere, Grapefruit',
  'kwi smooth': 'Kiwi, Apfel',
  'green t': 'Grüner Tee, Zitrone',
  'space flvr': 'Maracuja',
  'space flavor': 'Maracuja',
  'falling star': 'Mango, Maracuja',
  'wild mango': 'Mango',
  'supernova': 'Extremes Ice',
  'cola': 'Cola',
  'ice granny': 'Grüner Apfel, Ice',
  'baerenstark': 'Schokolade, Kaffee',
  'baerenstark 42': 'Schokolade, Kaffee',
  'bärenstark 42': 'Schokolade, Kaffee',
  'bärenstark': 'Schokolade, Kaffee',
  'mi amor': 'Banane, Beeren, Minze',
  'african queen': 'Früchtemix',
  'hamburg': 'Beerenmix',
  'cucunber': 'Gurke, Minze',
  'love 66': 'Wassermelone, Honigmelone, Minze',
  'lady killer': 'Pfirsich, Mango, Beeren, Minze',
  'cold peach': 'Pfirsich, Ice',
  'cane mint': 'Pfefferminze',
  'pistachio': 'Pistazie'
};

function findTobaccoFlavor(tobaccoName) {
  if (!tobaccoName) return null;
  const clean = tobaccoName.toLowerCase().trim();
  if (!clean) return null;

  // Helper to extract brand and variety: "MustH - Pynkman" -> brand: "musth", variety: "pynkman"
  const parseTobaccoParts = (str) => {
    const s = String(str || '').toLowerCase().trim();
    const dashIdx = s.indexOf('-');
    if (dashIdx !== -1) {
      return {
        brand: s.substring(0, dashIdx).replace(/[^a-z0-9]/g, '').trim(),
        variety: s.substring(dashIdx + 1).replace(/[^a-z0-9\s]/g, '').trim()
      };
    }
    return {
      brand: '',
      variety: s.replace(/[^a-z0-9\s]/g, '').trim()
    };
  };

  const normalizeBrand = (b) => {
    if (!b) return '';
    if (['musth', 'musthave', 'musthavegermany'].some(x => b.includes(x))) return 'musthave';
    if (['blackburn', 'black burn', 'bb', 'burn'].some(x => b.includes(x))) return 'blackburn';
    if (['darkside', 'ds'].some(x => b.includes(x))) return 'darkside';
    if (['hookain', 'hh'].some(x => b.includes(x))) return 'hookain';
    if (['nameless', 'nh'].some(x => b.includes(x))) return 'nameless';
    if (['ostobacco', 'os'].some(x => b.includes(x))) return 'os';
    return b;
  };

  const qParts = parseTobaccoParts(clean);
  const qNormBrand = normalizeBrand(qParts.brand);

  // 1. Check curated popular stream flavors (variety match or full name match)
  if (qParts.variety && KNOWN_STREAM_FLAVORS[qParts.variety]) {
    return KNOWN_STREAM_FLAVORS[qParts.variety];
  }
  if (KNOWN_STREAM_FLAVORS[clean]) {
    return KNOWN_STREAM_FLAVORS[clean];
  }

  const catalog = state.catalog?.tobacco || [];

  // 2. Direct exact name match in catalog with non-empty flavor
  for (const t of catalog) {
    const tName = (typeof t === 'string' ? t : t.name || '').toLowerCase().trim();
    if (tName === clean && t.flavor && t.flavor.trim()) {
      return t.flavor.trim();
    }
  }

  // 3. Structured Match (Variety match + compatible brand)
  if (qParts.variety) {
    for (const t of catalog) {
      if (!t || !t.flavor || !t.flavor.trim()) continue;
      const tName = typeof t === 'string' ? t : t.name || '';
      const tParts = parseTobaccoParts(tName);
      const tNormBrand = normalizeBrand(tParts.brand);

      if (tParts.variety === qParts.variety) {
        if (!qNormBrand || !tNormBrand || qNormBrand === tNormBrand || qNormBrand.includes(tNormBrand) || tNormBrand.includes(qNormBrand)) {
          return t.flavor.trim();
        }
      }
    }
  }

  // 4. High-confidence variety token match (variety name must be >= 4 chars and distinct)
  if (qParts.variety && qParts.variety.length >= 4) {
    for (const t of catalog) {
      if (!t || !t.flavor || !t.flavor.trim()) continue;
      const tName = (typeof t === 'string' ? t : t.name || '').toLowerCase();
      const tParts = parseTobaccoParts(tName);
      if (tParts.variety) {
        const sim = typeof similarityScore === 'function' ? similarityScore(qParts.variety, tParts.variety) : 0;
        if (sim >= 0.82) {
          const tNormBrand = normalizeBrand(tParts.brand);
          if (!qNormBrand || !tNormBrand || qNormBrand === tNormBrand) {
            return t.flavor.trim();
          }
        }
      }
    }
  }

  return null;
}

// Command Generator Logic
function generateCommandString() {
  let promoText = (inputGlobalPromo ? inputGlobalPromo.value : '').trim();
  const promoTarget = (selectPromoTarget ? selectPromoTarget.value : 'kohle');
  const includeDesc = chkIncludePromoDesc ? chkIncludePromoDesc.checked : true;

  if (promoText) {
    const match = promoText.match(/^([^\s(]+)(?:\s*\((.+)\))?$/);
    if (match) {
      let code = match[1].trim();
      if (!code.startsWith('!')) code = `!${code}`;
      const desc = match[2] ? match[2].trim() : '';

      if (desc && includeDesc) {
        promoText = `(${code} - ${desc})`;
      } else {
        promoText = code;
      }
    } else {
      if (!promoText.startsWith('!')) promoText = `!${promoText}`;
    }
  }

  const hasNonElectricPerson = state.persons.slice(0, state.personCount).some(p => {
    if (!p) return false;
    const bName = (p.bowl || '').toLowerCase();
    return !p.isElectric && !bName.includes('xkah') && !bName.includes('elektr') && !bName.includes('imoto') && !bName.includes('e-kopf');
  });

  const isMixedSetup = state.personCount > 1 && state.persons.slice(0, state.personCount).some(p => {
    if (!p) return false;
    const bName = (p.bowl || '').toLowerCase();
    return p.isElectric || bName.includes('xkah') || bName.includes('elektr') || bName.includes('imoto') || bName.includes('e-kopf');
  }) && hasNonElectricPerson;

  let kohle = hasNonElectricPerson ? (inputGlobalKohle ? inputGlobalKohle.value : '').trim() : '';
  let extra = (inputGlobalExtra ? inputGlobalExtra.value : '').trim();

  if (promoText) {
    if (promoTarget === 'kohle') {
      kohle = kohle ? `${kohle} ${promoText}` : promoText;
    } else if (promoTarget === 'extra') {
      extra = extra ? `${extra} ${promoText}` : promoText;
    }
  }

  const buildCandidateCommand = (withFlavors) => {
    const parts = [];

    for (let i = 0; i < state.personCount; i++) {
      const p = state.persons[i];
      if (!p) continue;

      const personSegments = [];
      const pName = (p.name || '').trim();

      let pipeVal = (p.pipe || '').trim();
      const vesselVal = (p.vessel || '').trim();
      const vesselColorVal = (p.vesselColor || '').trim();

      if (pipeVal) {
        if (vesselVal && vesselColorVal) {
          pipeVal = `${pipeVal} auf einer ${vesselVal} in ${vesselColorVal}`;
        } else if (vesselVal) {
          pipeVal = `${pipeVal} auf einer ${vesselVal}`;
        } else if (vesselColorVal) {
          pipeVal = `${pipeVal} in ${vesselColorVal}`;
        }
      }

      let bowlVal = (p.bowl || '').trim();
      let hmdVal = (p.hmd || '').trim();
      const isElec = !!p.isElectric || bowlVal.toLowerCase().includes('xkah') || bowlVal.toLowerCase().includes('elektr') || bowlVal.toLowerCase().includes('imoto') || bowlVal.toLowerCase().includes('e-kopf');

      if (promoText) {
        if (promoTarget === 'pipe' && pipeVal) pipeVal = `${pipeVal} ${promoText}`;
        if (promoTarget === 'bowl' && bowlVal) bowlVal = `${bowlVal} ${promoText}`;
        if (promoTarget === 'hmd' && hmdVal && !isElec) hmdVal = `${hmdVal} ${promoText}`;
      }

      if (pipeVal && bowlVal) {
        const pNorm = pipeVal.toLowerCase().replace(/[^a-z0-9]/g, '');
        const bNorm = bowlVal.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (pNorm === bNorm || (pNorm.includes('shii') && bNorm.includes('shii'))) {
          personSegments.push(bowlVal);
        } else {
          personSegments.push(pipeVal);
          personSegments.push(bowlVal);
        }
      } else if (pipeVal) {
        personSegments.push(pipeVal);
      } else if (bowlVal) {
        personSegments.push(bowlVal);
      }
      if (hmdVal && !isElec) personSegments.push(hmdVal);

      // Kohle (Magic Charcoal) placed directly behind HMD!
      if (!isElec && kohle) {
        personSegments.push(kohle);
      }

      const tobaccos = [];
      const rawTobaccos = p.tobaccos || [];
      const rawAmounts = p.tobaccoAmounts || [];
      const showAmt = !!p.showTobaccoAmounts;
      const unit = p.tobaccoUnit || 'g';

      for (let tIdx = 0; tIdx < rawTobaccos.length; tIdx++) {
        let tVal = (rawTobaccos[tIdx] || '').replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim();
        if (!tVal) continue;
        const amtVal = (rawAmounts[tIdx] || '').replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim();
        const flavor = withFlavors ? findTobaccoFlavor(tVal) : null;

        if (showAmt && amtVal && flavor) {
          const cleanAmt = amtVal.replace(/[^0-9.,]/g, '').trim();
          tVal = `${tVal} (${cleanAmt ? cleanAmt + unit : amtVal}, ${flavor})`;
        } else if (showAmt && amtVal) {
          const cleanAmt = amtVal.replace(/[^0-9.,]/g, '').trim();
          if (cleanAmt) {
            tVal = `${tVal} (${cleanAmt}${unit})`;
          } else {
            tVal = `${tVal} (${amtVal})`;
          }
        } else if (flavor) {
          tVal = `${tVal} (${flavor})`;
        }
        tobaccos.push(tVal);
      }

      if (tobaccos.length > 0) {
        let tobStr = '';
        if (tobaccos.length === 1) {
          tobStr = tobaccos[0];
        } else if (tobaccos.length === 2) {
          tobStr = `${tobaccos[0]} und ${tobaccos[1]}`;
        } else {
          const last = tobaccos.pop();
          tobStr = `${tobaccos.join(', ')} und ${last}`;
        }
        personSegments.push(tobStr);
      }

      if (personSegments.length > 0 || pName) {
        let personStr = '';
        if (state.personCount > 1 && pName) {
          personStr = `${pName}: ${personSegments.join(' // ')}`;
        } else {
          personStr = personSegments.join(' // ');
        }
        parts.push(personStr);
      }
    }

    let fullCommand = `!editsetup ${parts.join(' // ')}`;

    const globalParts = [];
    if (extra) globalParts.push(extra);

    if (globalParts.length > 0) {
      fullCommand += ` // ${globalParts.join(' // ')} //`;
    } else if (parts.length > 0) {
      fullCommand += ' //';
    }

    return (parts.length > 0 || globalParts.length > 0) ? fullCommand.trim() : '';
  };

  const commandWithoutFlavors = buildCandidateCommand(false);
  let generatedCommand = commandWithoutFlavors;

  const shouldIncludeFlavors = chkIncludeFlavors ? chkIncludeFlavors.checked : true;
  if (shouldIncludeFlavors) {
    const commandWithFlavors = buildCandidateCommand(true);
    if (commandWithFlavors && commandWithFlavors.length <= MAX_COMMAND_LEN_WITH_FLAVORS) {
      generatedCommand = commandWithFlavors;
    }
  }

  const isCommandValid = !!(generatedCommand && generatedCommand.length > 0 && generatedCommand !== '!editsetup');

  if (isCommandValid) {
    commandIsReady = true;
    if (commandOutput) commandOutput.value = generatedCommand;
    if (previewChatText) previewChatText.textContent = generatedCommand;
    const sendBtn = document.getElementById('btn-send-chat');
    if (sendBtn) sendBtn.removeAttribute('disabled');
  } else {
    commandIsReady = false;
    if (commandOutput) commandOutput.value = '';
    if (previewChatText) previewChatText.textContent = 'Noch kein Setup konfiguriert...';
    const sendBtn = document.getElementById('btn-send-chat');
    if (sendBtn) sendBtn.setAttribute('disabled', 'true');
  }

  // Update Authentic Twitch-Chat Primary Output Box
  const previewModName = document.getElementById('preview-mod-name');
  if (previewModName) {
    const name = state.twitchUser?.display_name || state.twitchUser?.login || 'Mod';
    previewModName.textContent = `${name}:`;
    const color = localStorage.getItem('swg_user_color') || (state.twitchUser?.color ?? '#FF7F00');
    if (previewModName.style) previewModName.style.color = color;
  }

  const len = isCommandValid ? generatedCommand.length : 0;
  if (commandLengthBadge) {
    if (len > 500) {
      commandLengthBadge.classList.add('warning');
      commandLengthBadge.textContent = `⚠️ ${len} / 500 (Zu lang!)`;
    } else {
      commandLengthBadge.classList.remove('warning');
      commandLengthBadge.textContent = `${len} / 500`;
    }
  }
  // Dashboard preview/copy/send consume the same canonical command as the editor.
  return isCommandValid ? generatedCommand : '';
}

// Smart Tobacco String Splitter (splits by comma, ' und ', ' & ', ' + ')
function splitTobaccoString(str) {
  if (!str) return [];
  const normalized = str
    .replace(/\s+und\s+/gi, ', ')
    .replace(/\s*&\s*/g, ', ')
    .replace(/\s*\+\s*/g, ', ');
  return normalized.split(',').map(s => s.trim()).filter(Boolean);
}

// Parse individual tobacco item for amount and unit e.g. "MustH - Pynkman (12g)", "Pinkman 12 Gramm", "50%"
function parseTobaccoItem(item) {
  let name = (item || '').replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim();
  let amount = '';
  let unit = 'g';
  let hasAmount = false;

  // Check for bracketed amount e.g. "(12g)", "(12 g)", "(50%)"
  const bracketMatch = name.match(/\(([^)]+)\)$/);
  if (bracketMatch) {
    const inner = bracketMatch[1].trim();
    const amtMatch = inner.match(/^(\d+(?:[.,]\d+)?)\s*(g|gramm|%|prozent)?$/i);
    if (amtMatch) {
      amount = amtMatch[1].replace(',', '.');
      unit = (amtMatch[2] && amtMatch[2].startsWith('%')) ? '%' : 'g';
      hasAmount = true;
      name = name.substring(0, bracketMatch.index).trim();
    }
  } else {
    // Check for trailing amount e.g. "12g", "12 Gramm", "12 g", "50%", "50 %"
    const trailingMatch = name.match(/\s+(\d+(?:[.,]\d+)?)\s*(g|gramm|%|prozent)?$/i);
    if (trailingMatch && trailingMatch[2]) {
      amount = trailingMatch[1].replace(',', '.');
      unit = trailingMatch[2].startsWith('%') ? '%' : 'g';
      hasAmount = true;
      name = name.substring(0, trailingMatch.index).trim();
    }
  }

  return { name, amount, unit, hasAmount };
}

// Clean & Robust Parser for Chat Setup Messages
function parseChatSetupMessage(rawText) {
  if (!rawText) return false;

  // Clean non-printable CTCP control characters and ACTION prefix
  let text = rawText.replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim();
  text = text.replace(/^ACTION\s+/i, '').trim();

  // Strip bot user prefix e.g. "marvedbot: Marvin: ..." or custom bot prefix
  const botName = (state.targetBot || 'marvedbot').trim().toLowerCase();
  const botReg = new RegExp(`^${botName}:\\s*`, 'i');
  text = text.replace(botReg, '');
  text = text.replace(/^([a-zA-Z0-9_]+):\s*(?=[a-zA-Z0-9_]+\s*:)/, '');
  text = text.replace(/^!editsetup\s+/i, '').replace(/^!setup\s+/i, '').trim();

  const segments = text.split('//').map(s => s.replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim()).filter(Boolean);
  if (segments.length === 0) return false;

  const parsedPersons = [];
  let globalKohle = '';
  let globalExtra = '';
  let sharedBowl = '';
  let sharedHmd = '';

  const isCharcoalSegment = (seg) => {
    const s = seg.toLowerCase();
    return s.includes('!kohle') || s.includes('kohle') || s.includes('cubes') || s.includes('zauberwürfel') || s.includes('charcoal') || /^\d{2}er(\b|\s|$)/i.test(s);
  };

  const isExtraSegment = (seg) => {
    const s = seg.toLowerCase();
    return s.includes('tasting') || s.includes('no aroma') || s.includes('extra') || s.includes('ice bazooka');
  };

  const isHmdSegment = (seg) => {
    const s = seg.toLowerCase();
    return s.includes('hmd') || s.includes('grani') || s.includes('lotus') || s.includes('onmo') || s.includes('ao 912') || s.includes('alufolie') || s.includes('panzer');
  };

  const isBowlSegment = (seg) => {
    const s = seg.toLowerCase();
    return s.includes('bowl') || s.includes('phunnel') || s.includes('shot') || s.includes('mehrloch') || s.includes('cosmo') || s.includes('xkah') || s.includes('e-kopf') || s.includes('imoto');
  };

  const createDefaultPerson = (name = 'Marvin') => ({
    name: name,
    pipe: '',
    bowl: '',
    hmd: '',
    tobaccos: [],
    tobaccoAmounts: [],
    tobaccoUnit: 'g',
    showTobaccoAmounts: false
  });

  const addTobaccoToPerson = (person, rawItem) => {
    const parsedItem = parseTobaccoItem(rawItem);
    if (!parsedItem.name) return;

    if (person.tobaccos.length === 1 && !person.tobaccos[0]) {
      person.tobaccos[0] = parsedItem.name;
      person.tobaccoAmounts[0] = parsedItem.amount || '';
    } else {
      person.tobaccos.push(parsedItem.name);
      person.tobaccoAmounts.push(parsedItem.amount || '');
    }

    if (parsedItem.hasAmount) {
      person.showTobaccoAmounts = true;
      person.tobaccoUnit = parsedItem.unit;
    }
  };

  for (const seg of segments) {
    // Check if segment contains person name pattern "Name: Setup..."
    if (seg.includes(':')) {
      const colonIdx = seg.indexOf(':');
      let pName = seg.substring(0, colonIdx).replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim();
      let pSetup = seg.substring(colonIdx + 1).replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim();

      // Clean bot prefixes or ACTION from name
      pName = pName.replace(/^(action|marvedbot|marved|bot)\s*/i, '').replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim();

      const newPerson = createDefaultPerson(pName || 'Marvin');

      if (isBowlSegment(pSetup)) {
        newPerson.bowl = pSetup;
      } else if (isHmdSegment(pSetup)) {
        newPerson.hmd = pSetup;
      } else if (isCharcoalSegment(pSetup)) {
        globalKohle = pSetup;
      } else if (isExtraSegment(pSetup)) {
        globalExtra = pSetup;
      } else if (pSetup.includes('&') || pSetup.includes(',') || pSetup.includes(' und ')) {
        const rawTobs = splitTobaccoString(pSetup);
        if (!rawTobs[0].includes('-') && !/\d+\s*(g|%)/i.test(rawTobs[0])) {
          newPerson.pipe = rawTobs.shift() || '';
        }
        rawTobs.forEach(tRaw => addTobaccoToPerson(newPerson, tRaw));
      } else {
        if (pSetup.includes('-') || /\d+\s*(g|%)/i.test(pSetup)) {
          addTobaccoToPerson(newPerson, pSetup);
        } else {
          newPerson.pipe = pSetup;
        }
      }

      parsedPersons.push(newPerson);
      continue;
    }

    // Segments without colon:
    if (isCharcoalSegment(seg)) {
      globalKohle = seg;
      continue;
    }
    if (isExtraSegment(seg)) {
      globalExtra = seg;
      continue;
    }

    const currentPerson = parsedPersons.length > 0 ? parsedPersons[parsedPersons.length - 1] : null;

    if (isBowlSegment(seg)) {
      if (currentPerson && !currentPerson.bowl) {
        currentPerson.bowl = seg;
      } else {
        sharedBowl = seg;
      }
      continue;
    }

    if (isHmdSegment(seg)) {
      if (currentPerson && !currentPerson.hmd) {
        currentPerson.hmd = seg;
      } else {
        sharedHmd = seg;
      }
      continue;
    }

    // Segment is Pipe or Tobacco
    const rawTobs = splitTobaccoString(seg);

    if (!currentPerson) {
      const defaultName = (state.persons && state.persons[0]?.name) ? state.persons[0].name : 'Marvin';
      const newPerson = createDefaultPerson(defaultName);

      if (rawTobs.length === 1 && !rawTobs[0].includes('-') && !/\d+\s*(g|%)/i.test(rawTobs[0])) {
        newPerson.pipe = seg;
      } else {
        rawTobs.forEach(tRaw => addTobaccoToPerson(newPerson, tRaw));
      }
      parsedPersons.push(newPerson);
    } else {
      if (!currentPerson.pipe && rawTobs.length === 1 && !rawTobs[0].includes('-') && !/\d+\s*(g|%)/i.test(rawTobs[0])) {
        currentPerson.pipe = seg;
      } else {
        rawTobs.forEach(tRaw => addTobaccoToPerson(currentPerson, tRaw));
      }
    }
  }

  // Fallback: if segments were found but no person matched, create default Person 1 (Marvin)
  if (parsedPersons.length === 0 && segments.length > 0) {
    const fallbackPerson = createDefaultPerson('Marvin');
    fallbackPerson.pipe = segments[0] || '';
    fallbackPerson.bowl = sharedBowl;
    fallbackPerson.hmd = sharedHmd;
    if (segments.length > 1) {
      addTobaccoToPerson(fallbackPerson, segments[1]);
    }
    parsedPersons.push(fallbackPerson);
  }

  if (parsedPersons.length > 0) {
    state.personCount = parsedPersons.length;
    updatePersonCountLabel();

    const catalog = state.catalog || {};
    state.persons = parsedPersons.map(p => {
      let finalPipe = p.pipe;
      let finalBowl = p.bowl || sharedBowl;
      let finalHmd = p.hmd || sharedHmd;
      let isElec = !!p.isElectric;

      if (finalPipe && catalog.pipes) {
        const match = findBestFuzzyMatch(finalPipe, catalog.pipes, 0.65);
        if (match) finalPipe = match.name;
      }
      if (finalBowl && catalog.bowls) {
        const match = findBestFuzzyMatch(finalBowl, catalog.bowls, 0.65);
        if (match) {
          finalBowl = match.name;
          if (match.item && match.item.isElectric) isElec = true;
        }
      }
      if (finalHmd && catalog.hmds) {
        const match = findBestFuzzyMatch(finalHmd, catalog.hmds, 0.65);
        if (match) finalHmd = match.name;
      }

      const mappedTobaccos = (p.tobaccos && p.tobaccos.length > 0 ? p.tobaccos : ['']).map(tob => {
        if (!tob || !catalog.tobacco) return tob;
        const match = findBestFuzzyMatch(tob, catalog.tobacco, 0.68);
        return match ? match.name : tob;
      });

      const finalTobaccos = mappedTobaccos.length > 0 ? mappedTobaccos : [''];
      const finalAmounts = (p.tobaccoAmounts && p.tobaccoAmounts.length > 0) ? [...p.tobaccoAmounts] : [''];
      while (finalAmounts.length < finalTobaccos.length) {
        finalAmounts.push('');
      }

      return {
        ...p,
        pipe: finalPipe,
        bowl: finalBowl,
        hmd: isElec ? '' : finalHmd,
        tobaccos: finalTobaccos,
        tobaccoAmounts: finalAmounts,
        isElectric: isElec
      };
    });

    if (globalKohle) {
      if (catalog.charcoal) {
        const match = findBestFuzzyMatch(globalKohle, catalog.charcoal, 0.65);
        if (match) globalKohle = match.name;
      }
      inputGlobalKohle.value = globalKohle;
    }
    if (globalExtra) inputGlobalExtra.value = globalExtra;

    renderPersonsGrid();
    generateCommandString();
    triggerAutoLearn();
    return true;
  }

  return false;
}

async function triggerAutoLearn() {
  try {
    const res = await ipcRenderer.invoke('db:auto-learn', {
      persons: state.persons,
      kohle: inputGlobalKohle ? inputGlobalKohle.value : '',
      extra: inputGlobalExtra ? inputGlobalExtra.value : ''
    });
    if (res && res.addedCount > 0) {
      state.catalog = res.catalog;
      updateDatalists();
      showToast(`${res.addedCount} neue(s) Element(e) automatisch in die Datenbank aufgenommen!`, 'success');
    }
  } catch(e) {}
}

const COMMON_PERSON_NAMES = [
  'marvin', 'marv', 'basti', 'gary', 'janni', 'yanni', 'dennis', 'daniel',
  'niklas', 'tim', 'alex', 'chris', 'jan', 'max', 'sven', 'leon', 'robin',
  'nils', 'lukas', 'jonas', 'paul', 'finn', 'elias', 'noah', 'luis', 'david', 'simon',
  'hannes', 'erik', 'marc', 'lars', 'julian', 'flo', 'stefan', 'micha', 'christian',
  'hasty', 'hastydj', 'bazztee',
  'person 1', 'person 2', 'person 3', 'person 4', 'person 5', 'person 6'
];

const KNOWN_TOBACCO_TERMS = [
  'darkside', 'musthave', 'musth', 'pinkman', 'pynkman', 'black burn', 'burn', 'haribo',
  'holster', 'kaktuz', 'ice kaktuz', 'trofimoff', 'trofimoffs', 'zaghoul', 'anejo',
  'nameless', 'black nana', 'al massiva', 'massiva', 'handgemacht', 'tangiers',
  'fumari', 'social smoke', 'adalya', 'love 66', 'african queen', 'os tobacco',
  'fog your life', 'hookain', 'blaze', 'maridan', 'tingle tangle', 'revoshi', 'chaos',
  'superberry', 'intro', 'shot', 'falling star', 'wild forest', 'bounty hunter', 'space flavour'
];

function matchNotesToForm(text) {
  if (!text || text.trim().length < 2) {
    if (state.persons[0]) {
      const pName = state.persons[0].name || 'Marvin';
      state.persons[0] = { name: pName, pipe: '', vessel: '', vesselColor: '', bowl: '', hmd: '', tobaccos: [''], isElectric: false };
    }
    if (inputGlobalKohle) inputGlobalKohle.value = '';
    renderPersonsGrid();
    generateCommandString();
    return;
  }

  const catalog = state.catalog || {};
  const origText = text.trim();
  const lowerText = origText.toLowerCase();
  const capitalize = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : '';

  // 1. Gather all catalog gear for structure lookahead
  const dbPersons = (catalog.persons || []).map(p => getItemName(p).toLowerCase());
  const allKnownPersons = Array.from(new Set([...COMMON_PERSON_NAMES, ...dbPersons]));

  const pipesList = (catalog.pipes || []).map(p => getItemName(p).toLowerCase());
  const bowlsList = (catalog.bowls || []).map(b => getItemName(b).toLowerCase());
  const hmdsList = (catalog.hmds || []).map(h => getItemName(h).toLowerCase());
  const charcoalList = (catalog.charcoal || []).map(c => getItemName(c).toLowerCase());
  const tobaccoList = (catalog.tobacco || []).map(t => getItemName(t).toLowerCase());

  function isKnownGearToken(tok) {
    if (!tok || tok.length < 2) return false;
    if (SHISHA_SYNONYMS[tok]) return true;
    const allGear = [...pipesList, ...bowlsList, ...hmdsList, ...charcoalList, ...tobaccoList, ...KNOWN_TOBACCO_TERMS];
    return allGear.some(item => {
      const parts = item.split(/[\s-]+/);
      return parts.some(p => p === tok || similarityScore(p, tok) >= 0.82);
    });
  }

  function isKnownPipeOrBowl(tok, nextTok = '') {
    const combined = nextTok ? `${tok} ${nextTok}` : tok;
    if (pipesList.some(p => p.includes(tok) || p.includes(combined)) || bowlsList.some(b => b.includes(tok) || b.includes(combined))) return true;
    if (SHISHA_SYNONYMS[tok] || (nextTok && SHISHA_SYNONYMS[combined])) return true;
    return false;
  }

  // 2. Multi-Person Delimiter Detection (//, \n, ;, or strict known person names / Name: prefix)
  let rawSegments = [];

  if (origText.includes('//')) {
    rawSegments = origText.split(/\/{2,}/);
  } else if (origText.includes('\n')) {
    rawSegments = origText.split(/\n+/);
  } else if (origText.includes(';')) {
    rawSegments = origText.split(/;+/);
  } else {
    // Continuous text: Scan strictly for KNOWN person names or explicit "Name:" pattern
    const words = lowerText.split(/\s+/).filter(Boolean);
    const origWords = origText.split(/\s+/).filter(Boolean);
    const foundIndices = [];

    for (let i = 0; i < words.length; i++) {
      const cleanW = words[i].replace(/[:;,]/g, '');
      const isColonName = words[i].endsWith(':') && cleanW.length >= 2;
      const isKnownPerson = allKnownPersons.includes(cleanW);

      if (isColonName || (isKnownPerson && (i === 0 || isKnownPipeOrBowl(words[i - 1])))) {
        foundIndices.push({ index: i, name: cleanW });
      }
    }

    if (foundIndices.length > 0) {
      // If there is text before the first person name, that's Person 1
      if (foundIndices[0].index > 0) {
        rawSegments.push(origWords.slice(0, foundIndices[0].index).join(' '));
      }

      for (let k = 0; k < foundIndices.length; k++) {
        const startIdx = foundIndices[k].index;
        const endIdx = (k + 1 < foundIndices.length) ? foundIndices[k + 1].index : origWords.length;
        rawSegments.push(origWords.slice(startIdx, endIdx).join(' '));
      }
    } else {
      rawSegments = [origText];
    }
  }

  rawSegments = rawSegments.map(s => s.trim()).filter(Boolean);

  // Global Charcoal Scanner
  let globalCharcoal = '';
  const isCharcoalWord = lowerText.includes('zauber') || lowerText.includes('cubes') || lowerText.includes('magic') || lowerText.includes('blackcoco') || lowerText.includes('kohle');
  if (isCharcoalWord) {
    const charcoalList = catalog.charcoal || [];
    for (const c of charcoalList) {
      const cName = getItemName(c);
      const cLower = cName.toLowerCase();
      if (lowerText.includes('zauber') && (cLower.includes('zauber') || cLower.includes('magic'))) { globalCharcoal = cName; break; }
      if (lowerText.includes('magic') && cLower.includes('magic')) { globalCharcoal = cName; break; }
      if (lowerText.includes('cubes') && cLower.includes('cubes')) { globalCharcoal = cName; break; }
      if (lowerText.includes('blackcoco') && cLower.includes('black')) { globalCharcoal = cName; break; }
    }
    if (!globalCharcoal) {
      const cMatch = findBestFuzzyMatch(lowerText, charcoalList, 0.65);
      globalCharcoal = cMatch ? cMatch.name : (charcoalList[0] ? getItemName(charcoalList[0]) : 'Magic Charcoal (4x 26er - ehem. Zauberwürfel)');
    }
  }

  // Global Tasting Scanner
  let globalExtra = '';
  const isTastingWord = lowerText.includes('no aroma') || lowerText.includes('blind') || lowerText.includes('tasting');
  if (isTastingWord) {
    const tastingList = catalog.tastings || [];
    if (lowerText.includes('no aroma')) {
      const match = tastingList.find(t => getItemName(t).toLowerCase().includes('no aroma'));
      globalExtra = match ? getItemName(match) : 'Trofimoffs No Aroma Tasting';
    } else if (lowerText.includes('blind')) {
      const match = tastingList.find(t => getItemName(t).toLowerCase().includes('blind'));
      globalExtra = match ? getItemName(match) : 'Blind Tasting im Stream';
    } else {
      const tMatch = findBestFuzzyMatch(lowerText, tastingList, 0.65);
      if (tMatch) globalExtra = tMatch.name;
    }
  }

  // Filter out pure charcoal or tasting segments if delimited
  const candidateSegments = [];
  for (const seg of rawSegments) {
    const sLower = seg.toLowerCase();
    const isPureCharcoal = (sLower.includes('zauber') || sLower.includes('cubes') || sLower.includes('magic') || sLower.includes('blackcoco')) && !Object.values(catalog).flat().some(item => {
      const iName = getItemName(item).toLowerCase();
      if ((catalog.charcoal || []).some(c => getItemName(c).toLowerCase() === iName)) return false;
      return sLower.includes(iName.split(' ')[0]);
    }) && !allKnownPersons.some(n => sLower.includes(n));

    const isPureTasting = (sLower.includes('no aroma') || sLower.includes('blind') || sLower === 'tasting') && !allKnownPersons.some(n => sLower.includes(n));

    if (!isPureCharcoal && !isPureTasting) {
      candidateSegments.push(seg);
    }
  }

  const segmentsToProcess = candidateSegments.length > 0 ? candidateSegments : [origText];
  const newPersons = [];

  for (let idx = 0; idx < segmentsToProcess.length; idx++) {
    const seg = segmentsToProcess[idx];
    const sLower = seg.toLowerCase();
    const tokens = sLower.split(/[\s,./\\;:+&|]+/).filter(t => t.length > 0);
    const usedIndices = new Set();

    // 1. Name Scanner
    let matchedName = `Person ${idx + 1}`;
    if (seg.includes(':')) {
      const colonPrefix = seg.split(':')[0].trim();
      if (colonPrefix.length > 0) {
        matchedName = capitalize(colonPrefix);
        const prefixTokens = colonPrefix.toLowerCase().split(/[\s,./\\;:+&|]+/).filter(Boolean);
        for (let i = 0; i < prefixTokens.length && i < tokens.length; i++) {
          usedIndices.add(i);
        }
      }
    } else if (tokens[0] && allKnownPersons.includes(tokens[0])) {
      matchedName = capitalize(tokens[0]);
      usedIndices.add(0);
    }

    // Auto-fill Person 1 name with 'Marvin' if not explicitly given another name
    if (idx === 0 && (!matchedName || matchedName === 'Person 1')) {
      matchedName = 'Marvin';
    }

    // Step 1: Hardware Gear Scanners (Highest score selection & unambiguous brand tokens)
    function scanCategory(catList) {
      if (!catList || catList.length === 0) return null;
      let best = null;
      let highestScore = 0;

      function findFromSynonym(syn) {
        if (!syn) return null;
        const s = syn.toLowerCase().trim();
        let m = catList.find(item => getItemName(item).toLowerCase().trim() === s);
        if (m) return m;
        m = catList.find(item => getItemName(item).toLowerCase().trim().includes(s));
        if (m) return m;
        m = catList.find(item => s.includes(getItemName(item).toLowerCase().trim()));
        if (m) return m;
        return null;
      }

      // 1. Three-word windows (e.g. 'aeon edition 6', 'moze breeze pro', 'cosmo bowl shot')
      for (let i = 0; i <= tokens.length - 3; i++) {
        if (usedIndices.has(i) || usedIndices.has(i + 1) || usedIndices.has(i + 2)) continue;
        const window3 = `${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`;
        const syn = SHISHA_SYNONYMS[window3];
        if (syn) {
          const match = findFromSynonym(syn);
          if (match) {
            const score = 1.0;
            if (score > highestScore) {
              highestScore = score;
              best = { name: getItemName(match), item: match, indices: [i, i + 1, i + 2] };
            }
          }
        }
        const m3 = findBestFuzzyMatch(window3, catList, 0.70);
        if (m3 && m3.score > highestScore) {
          highestScore = m3.score;
          best = { name: m3.name, item: m3.item, indices: [i, i + 1, i + 2] };
        }
      }

      // 2. Two-word windows
      for (let i = 0; i < tokens.length - 1; i++) {
        if (usedIndices.has(i) || usedIndices.has(i + 1)) continue;
        const window2 = `${tokens[i]} ${tokens[i + 1]}`;
        const syn = SHISHA_SYNONYMS[window2];
        if (syn) {
          const match = findFromSynonym(syn);
          if (match) {
            const score = 1.0;
            if (score > highestScore) {
              highestScore = score;
              best = { name: getItemName(match), item: match, indices: [i, i + 1] };
            }
          }
        }
        const m2 = findBestFuzzyMatch(window2, catList, 0.70);
        if (m2 && m2.score > highestScore) {
          highestScore = m2.score;
          best = { name: m2.name, item: m2.item, indices: [i, i + 1] };
        }
      }

      // 3. Single tokens
      for (let i = 0; i < tokens.length; i++) {
        if (usedIndices.has(i)) continue;
        const tok = tokens[i];
        if (tok.length < 2) continue;
        if (tok === 'dark' || tok === 'darkside') continue;

        const syn = SHISHA_SYNONYMS[tok];
        if (syn) {
          const match = findFromSynonym(syn);
          if (match) {
            const score = 0.95;
            if (score > highestScore) {
              highestScore = score;
              best = { name: getItemName(match), item: match, indices: [i] };
            }
          }
        }
        const m1 = findBestFuzzyMatch(tok, catList, 0.70);
        if (m1 && m1.score > highestScore) {
          highestScore = m1.score;
          best = { name: m1.name, item: m1.item, indices: [i] };
        }
      }

      if (best && best.indices) {
        best.indices.forEach(idx => usedIndices.add(idx));
      }
      return best;
    }

    const pipeMatch = scanCategory(catalog.pipes || []);
    const pipe = pipeMatch ? pipeMatch.name : '';

    let bowl = '';
    let isElectric = false;
    if (sLower.includes('xkah') || sLower.includes('xk-ah') || sLower.includes('xk ah') || sLower.includes('xklite') || sLower.includes('xkpro')) {
      bowl = (sLower.includes('pro') || sLower.includes('xkpro')) ? (catalog.bowls && catalog.bowls.some(b => getItemName(b).includes('Pro')) ? 'XKAH Pro E-Kopf & E-HMD' : 'XKAH Pro') : (catalog.bowls && catalog.bowls.some(b => getItemName(b).includes('LITE')) ? 'XKAH LITE E-Kopf & E-HMD' : 'XKAH Lite');
      isElectric = true;
    } else {
      const bowlMatch = scanCategory(catalog.bowls || []);
      if (bowlMatch) {
        bowl = bowlMatch.name;
        if (bowlMatch.item && bowlMatch.item.isElectric) isElectric = true;
      }
    }

    let hmd = '';
    if (!isElectric) {
      const hmdMatch = scanCategory(catalog.hmds || []);
      if (hmdMatch) hmd = hmdMatch.name;
    }

    const vesselMatch = scanCategory(catalog.vases || []);
    const vessel = vesselMatch ? vesselMatch.name : '';

    // Pre-reserve charcoal tokens in usedIndices so they are NEVER matched as tobacco
    for (let i = 0; i <= tokens.length - 2; i++) {
      if (usedIndices.has(i) || usedIndices.has(i + 1)) continue;
      const w2 = `${tokens[i]} ${tokens[i + 1]}`;
      if (w2 === 'magic charcoal' || w2 === 'magic cubes' || w2 === 'black coco' || w2 === 'black coco26' || w2 === 'black coco27' || w2 === 'zauber würfel' || w2 === 'zauber wuerfel' || w2 === 'one nation' || w2 === 'cocodice 27mm' || w2 === 'shaman 26mm') {
        usedIndices.add(i);
        usedIndices.add(i + 1);
      }
    }

    const CHARCOAL_SINGLE_TOKENS = new Set(['zauber', 'zauberwürfel', 'zauberwuerfel', 'cubes', 'blackcoco', 'charcoal', 'kohle', 'shaman', 'cocodice']);
    for (let i = 0; i < tokens.length; i++) {
      if (CHARCOAL_SINGLE_TOKENS.has(tokens[i])) {
        usedIndices.add(i);
      }
    }

    const isPersonTok = (tok) => allKnownPersons.includes(tok) || (matchedName && matchedName.toLowerCase() === tok);

    // Step 2 & 3: Multi-Word and Single-Token Tobacco Scanning with Amount Detection
    let detectedUnit = 'g';
    const tobaccoMatchesWithAmounts = [];

    function extractAmountFollowing(lastIdx) {
      const nextIdx = lastIdx + 1;
      if (nextIdx >= tokens.length) return '';
      const nextTok = tokens[nextIdx];
      if (usedIndices.has(nextIdx)) return '';

      // Check format like '13g', '3g', '50%', '13.5g'
      const mInline = nextTok.match(/^(\d+(?:[.,]\d+)?)(g|gramm|%|prozent)?$/i);
      if (mInline) {
        const num = mInline[1].replace(',', '.');
        const unit = mInline[2] ? mInline[2].toLowerCase() : '';
        if (unit.includes('%') || unit.includes('prozent')) {
          detectedUnit = '%';
        } else if (unit) {
          detectedUnit = 'g';
        }
        usedIndices.add(nextIdx);

        // Check if next token is unit (e.g. '13' followed by 'g' / 'gramm' / '%')
        if (!unit && nextIdx + 1 < tokens.length && !usedIndices.has(nextIdx + 1)) {
          const uTok = tokens[nextIdx + 1];
          if (/^(g|gramm|%|prozent)$/i.test(uTok)) {
            if (/^(%|prozent)$/i.test(uTok)) detectedUnit = '%';
            else detectedUnit = 'g';
            usedIndices.add(nextIdx + 1);
          }
        }
        return num;
      }
      return '';
    }

    // 2. Multi-word phrase scanning (3-word & 2-word)
    for (let i = 0; i <= tokens.length - 3; i++) {
      if (usedIndices.has(i) || usedIndices.has(i + 1) || usedIndices.has(i + 2)) continue;
      if (isPersonTok(tokens[i]) || isPersonTok(tokens[i + 1]) || isPersonTok(tokens[i + 2])) continue;
      const w3 = `${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`;
      const syn = SHISHA_SYNONYMS[w3];
      if (syn && (catalog.tobacco || []).some(t => getItemName(t) === syn)) {
        usedIndices.add(i); usedIndices.add(i + 1); usedIndices.add(i + 2);
        const amt = extractAmountFollowing(i + 2);
        tobaccoMatchesWithAmounts.push({ firstIdx: i, name: syn, amount: amt });
        continue;
      }
      const m = findBestFuzzyMatch(w3, catalog.tobacco || [], 0.75);
      if (m) {
        usedIndices.add(i); usedIndices.add(i + 1); usedIndices.add(i + 2);
        const amt = extractAmountFollowing(i + 2);
        tobaccoMatchesWithAmounts.push({ firstIdx: i, name: m.name, amount: amt });
      }
    }

    for (let i = 0; i <= tokens.length - 2; i++) {
      if (usedIndices.has(i) || usedIndices.has(i + 1)) continue;
      if (isPersonTok(tokens[i]) || isPersonTok(tokens[i + 1])) continue;
      const w2 = `${tokens[i]} ${tokens[i + 1]}`;
      const syn = SHISHA_SYNONYMS[w2];
      if (syn && (catalog.tobacco || []).some(t => getItemName(t) === syn)) {
        usedIndices.add(i); usedIndices.add(i + 1);
        const amt = extractAmountFollowing(i + 1);
        tobaccoMatchesWithAmounts.push({ firstIdx: i, name: syn, amount: amt });
        continue;
      }
      const m = findBestFuzzyMatch(w2, catalog.tobacco || [], 0.75);
      if (m) {
        usedIndices.add(i); usedIndices.add(i + 1);
        const amt = extractAmountFollowing(i + 1);
        tobaccoMatchesWithAmounts.push({ firstIdx: i, name: m.name, amount: amt });
      }
    }

    // Step 3: Single-Token Tobacco Scanning for remaining unreserved tokens
    const HARDWARE_ONLY_TOKENS = new Set([
      'dark', 'shot', 'intro', 'aeon', 'edition', 'breeze', 'varity', 'futr', 'pedal',
      'flashbang', 'flash', 'bang', 'specter', 'fibonacci', 'cosmo', 'mumiya', 'mumia', 'vosku', 'litbowl',
      'onmo', 'nagrani', 'kaloud', 'lotus', 'cubes', 'magic', 'zauber', 'zauberwürfel', 'zauberwuerfel', 'xkah', 'smart', 'stratos',
      'ocean', 'kaif', 'solaris', 'vandenberg', 'oblako', 'moon', 'alpha',
      'charcoal', 'kohle', 'blackcoco', 'shaman', 'cocodice', 'würfel', 'wuerfel', '26er', '27er',
      ...allKnownPersons
    ]);

    for (let i = 0; i < tokens.length; i++) {
      if (usedIndices.has(i)) continue;
      const tok = tokens[i];
      if (tok.length < 3) continue;
      if (HARDWARE_ONLY_TOKENS.has(tok)) continue;
      if (isPersonTok(tok)) continue;

      const syn = SHISHA_SYNONYMS[tok];
      if (syn && (catalog.tobacco || []).some(t => getItemName(t) === syn)) {
        usedIndices.add(i);
        const amt = extractAmountFollowing(i);
        if (!tobaccoMatchesWithAmounts.some(t => t.name === syn)) {
          tobaccoMatchesWithAmounts.push({ firstIdx: i, name: syn, amount: amt });
        }
        continue;
      }
      const m = findBestFuzzyMatch(tok, catalog.tobacco || [], 0.70);
      if (m && !tobaccoMatchesWithAmounts.some(t => t.name === m.name)) {
        usedIndices.add(i);
        const amt = extractAmountFollowing(i);
        tobaccoMatchesWithAmounts.push({ firstIdx: i, name: m.name, amount: amt });
      }
    }

    // Sort tobaccos by position in text
    tobaccoMatchesWithAmounts.sort((a, b) => a.firstIdx - b.firstIdx);

    const matchedTobaccos = tobaccoMatchesWithAmounts.map(t => t.name);
    const matchedAmounts = tobaccoMatchesWithAmounts.map(t => t.amount || '');
    const hasAmounts = matchedAmounts.some(a => a && a.trim() !== '');

    newPersons.push({
      name: matchedName,
      pipe,
      bowl,
      hmd,
      vessel,
      vesselColor: '',
      tobaccos: matchedTobaccos.length > 0 ? [...matchedTobaccos, ''] : [''],
      showTobaccoAmounts: hasAmounts,
      tobaccoAmounts: hasAmounts ? [...matchedAmounts, ''] : [],
      tobaccoUnit: detectedUnit || 'g',
      isElectric
    });
  }

  state.personCount = Math.min(10, Math.max(1, newPersons.length));
  updatePersonCountLabel();
  state.persons = newPersons;

  if (inputGlobalKohle) {
    inputGlobalKohle.value = globalCharcoal;
    const btn = inputGlobalKohle.parentElement ? inputGlobalKohle.parentElement.querySelector('.btn-clear-field') : null;
    if (btn) btn.classList.toggle('hidden', !globalCharcoal);
  }

  if (inputGlobalExtra) {
    inputGlobalExtra.value = globalExtra;
    const btn = inputGlobalExtra.parentElement ? inputGlobalExtra.parentElement.querySelector('.btn-clear-field') : null;
    if (btn) btn.classList.toggle('hidden', !globalExtra);
  }

  renderPersonsGrid();
  generateCommandString();
}

// Global Event Listeners
function setupEventListeners() {
  // Person Count — only + button, count shown as label
  btnIncPersons.addEventListener('click', () => {
    if (state.personCount < 10) {
      state.personCount++;
      updatePersonCountLabel();
      renderPersonsGrid();
      generateCommandString();
    }
  });

  // Import Setup Dropdown Menu Toggle
  if (btnImportMenu && importDropdownMenu) {
    btnImportMenu.addEventListener('click', (e) => {
      e.stopPropagation();
      importDropdownMenu.classList.toggle('hidden');
    });

    document.addEventListener('click', () => {
      importDropdownMenu.classList.add('hidden');
    });

    importDropdownMenu.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  // Open Manual Paste Setup Modal
  if (btnOpenPasteModal) {
    btnOpenPasteModal.addEventListener('click', async () => {
      importDropdownMenu.classList.add('hidden');
      pasteModal.classList.remove('hidden');
      try {
        const text = await navigator.clipboard.readText();
        if (text && (text.includes('//') || text.includes(':'))) {
          inputPasteText.value = text;
        }
      } catch(e) {}
    });
  }

  if (btnClosePasteModal) {
    btnClosePasteModal.addEventListener('click', () => {
      pasteModal.classList.add('hidden');
    });
  }

  if (btnPasteFromClipboard) {
    btnPasteFromClipboard.addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          inputPasteText.value = text;
          showToast('Text aus Zwischenablage eingefügt', 'info');
        }
      } catch(e) {
        showToast('Konnte Zwischenablage nicht lesen', 'error');
      }
    });
  }

  if (btnApplyPasteSetup) {
    btnApplyPasteSetup.addEventListener('click', () => {
      const raw = inputPasteText.value.trim();
      if (!raw) {
        showToast('Bitte gib einen Setup-Text ein', 'error');
        return;
      }
      const success = parseChatSetupMessage(raw);
      if (success) {
        pasteModal.classList.add('hidden');
        inputPasteText.value = '';
        showToast('Setup erfolgreich übernommen!', 'success');
      } else {
        showToast('Konnte den Setup-Text nicht parsen. Bitte Format prüfen.', 'error');
      }
    });
  }

  // Extras & Promo input listeners
  if (inputGlobalKohle) inputGlobalKohle.addEventListener('input', generateCommandString);
  if (inputGlobalExtra) inputGlobalExtra.addEventListener('input', generateCommandString);
  if (inputGlobalPromo) inputGlobalPromo.addEventListener('input', generateCommandString);
  if (selectPromoTarget) selectPromoTarget.addEventListener('change', generateCommandString);

  // Hamburger Menu Profile Manager Button
  const btnHamburgerOpenProfiles = document.getElementById('btn-hamburger-open-profiles');
  if (btnHamburgerOpenProfiles) {
    btnHamburgerOpenProfiles.addEventListener('click', () => {
      if (hamburgerDropdownMenu) hamburgerDropdownMenu.classList.add('hidden');
      openStreamerProfilesModal();
    });
  }

  // Twitch Auth Listeners - 1-Click Seamless Browser Login
  btnTwitchLogin.addEventListener('click', async () => {
    showToast('Öffne Twitch-Login im Browser...', 'info');
    await ipcRenderer.invoke('twitch:login');
  });

  const btnBannerGotoLogin = document.getElementById('btn-banner-goto-login');
  if (btnBannerGotoLogin) {
    btnBannerGotoLogin.addEventListener('click', () => {
      btnTwitchLogin.click();
    });
  }

  btnCloseTwitchModal.addEventListener('click', () => {
    twitchModal.classList.add('hidden');
  });

  // Direct Token link
  btnGetTmiToken.addEventListener('click', () => {
    ipcRenderer.invoke('app:open-external', 'https://twitchapps.com/tmi/');
  });

  if (linkTwitchDev) {
    linkTwitchDev.addEventListener('click', (e) => {
      e.preventDefault();
      ipcRenderer.invoke('app:open-external', 'https://dev.twitch.tv/console/apps');
    });
  }

  // Save Direct Token
  btnSaveToken.addEventListener('click', async () => {
    const rawToken = inputOauthToken.value.trim();
    if (!rawToken) {
      showToast('Bitte gib einen Token ein', 'error');
      return;
    }

    btnSaveToken.disabled = true;
    btnSaveToken.textContent = 'Prüfe...';

    const res = await ipcRenderer.invoke('twitch:save-token', rawToken);
    btnSaveToken.disabled = false;
    btnSaveToken.textContent = 'Verbinden';

    if (res.success) {
      state.twitchUser = res.user;
      updateTwitchUI();
      twitchModal.classList.add('hidden');
      inputOauthToken.value = '';
      checkLiveStreamStatus();
      showToast(`Erfolgreich eingeloggt als ${res.user.display_name || res.user.login}!`, 'success');
    } else {
      showToast(res.error || 'Ungültiger Twitch Token', 'error');
    }
  });

  // Browser OAuth with Client ID
  btnStartBrowserOauth.addEventListener('click', async () => {
    const customCid = inputClientId.value.trim();
    showToast('Öffne Twitch Login im Browser...', 'info');
    await ipcRenderer.invoke('twitch:login', customCid);
  });

  btnTwitchLogout.addEventListener('click', async () => {
    await ipcRenderer.invoke('twitch:logout');
    state.twitchUser = null;
    updateTwitchUI();
    showView('view-landing');
    checkLiveStreamStatus();
    showToast('Erfolgreich von Twitch abgemeldet', 'info');
  });

  ipcRenderer.on('twitch:authenticated', (event, { user }) => {
    state.twitchUser = user;
    updateTwitchUI();
    twitchModal.classList.add('hidden');
    checkLiveStreamStatus();
    if (isCurrentUserModerator()) {
      showToast(`Erfolgreich als Moderator @${user.display_name || user.login} eingeloggt!`, 'success');
    } else {
      showToast(`⛔ Zugriff verweigert: @${user.display_name || user.login} ist kein Moderator auf diesem Kanal.`, 'error');
    }
  });

  // User Chat Color Customization & Sync
  const previewModName = document.getElementById('preview-mod-name');
  const userColorPicker = document.getElementById('user-color-picker');

  if (previewModName && userColorPicker) {
    previewModName.style.cursor = 'pointer';
    previewModName.addEventListener('click', () => {
      userColorPicker.click();
    });

    const onColorSelected = (newColor) => {
      if (!newColor) return;
      if (previewModName) previewModName.style.color = newColor;
      localStorage.setItem('swg_user_color', newColor);
      localStorage.setItem('swg_user_color_custom', 'true');
      if (state.twitchUser) state.twitchUser.color = newColor;
      ipcRenderer.invoke('twitch:set-color', newColor).catch(() => {});
      updateTwitchUI();
      updateModHQUserInfo();
    };

    userColorPicker.addEventListener('input', (e) => onColorSelected(e.target.value));
    userColorPicker.addEventListener('change', (e) => onColorSelected(e.target.value));
  }

  ipcRenderer.on('twitch:color-updated', (event, { color }) => {
    const hasCustomColor = localStorage.getItem('swg_user_color_custom') === 'true' || localStorage.getItem('swg_user_color');
    if (color && !hasCustomColor) {
      localStorage.setItem('swg_user_color', color);
      if (state.twitchUser) state.twitchUser.color = color;
      if (previewModName) previewModName.style.color = color;
      if (userColorPicker) userColorPicker.value = color;
      updateModHQUserInfo();
    }
  });

  // Query color from Twitch on startup (only fallback if user hasn't chosen one)
  ipcRenderer.invoke('twitch:get-color').then(c => {
    const hasCustomColor = localStorage.getItem('swg_user_color_custom') === 'true' || localStorage.getItem('swg_user_color');
    if (c && !hasCustomColor) {
      localStorage.setItem('swg_user_color', c);
      if (state.twitchUser) state.twitchUser.color = c;
      if (previewModName) previewModName.style.color = c;
      if (userColorPicker) userColorPicker.value = c;
      updateModHQUserInfo();
    }
  }).catch(() => {});

  // Fetch Setup from Twitch Chat
  btnFetchChatSetup.addEventListener('click', async () => {
    importDropdownMenu.classList.add('hidden');
    if (!state.twitchUser) {
      showToast('Bitte verbinde dich zuerst mit Twitch', 'error');
      return;
    }

    btnFetchChatSetup.disabled = true;
    showToast('Sende !setup und warte auf Antwort aus dem Chat...', 'info');

    const res = await ipcRenderer.invoke('twitch:fetch-setup', state.targetChannel);

    btnFetchChatSetup.disabled = false;

    if (res.success && res.res && res.res.text) {
      const parsed = parseChatSetupMessage(res.res.text);
      if (parsed) {
        showToast(`Setup erfolgreich aus dem Chat geladen (von ${res.res.author})!`, 'success');
      } else {
        showToast(`Antwort von ${res.res.author} erhalten, konnte aber nicht geparst werden.`, 'error');
      }
    } else {
      showToast(res.error || 'Fehler beim Laden des Setups aus dem Chat', 'error');
    }
  });

  // Copy to Clipboard
  btnCopy.addEventListener('click', async () => {
    const text = commandOutput.value;
    if (text) {
      await ipcRenderer.invoke('app:copy-clipboard', text);
      btnCopy.classList.add('copied');
      btnCopy.innerHTML = `✓ Kopiert!`;
      showToast('Befehl in Zwischenablage kopiert!', 'success');
      triggerAutoLearn();
      setTimeout(() => {
        btnCopy.classList.remove('copied');
        btnCopy.innerHTML = `<svg class="icon" viewBox="0 0 24 24"><path fill="currentColor" d="M19 21H8V7h11m0-2H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2m-3-4H4a2 2 0 0 0-2 2v14h2V3h12V1z"/></svg> Kopieren`;
      }, 1500);
    }
  });

  // Send to Twitch Chat
  btnSendChat.addEventListener('click', async () => {
    if (!commandIsReady || !commandOutput.value.trim()) {
      showToast('Kein Befehl zum Senden vorhanden. Bitte zuerst ein Setup konfigurieren.', 'warning');
      return;
    }

    const message = commandOutput.value.trim();
    if (!message || message === '!editsetup') {
      showToast('Kein Befehl zum Senden vorhanden', 'error');
      return;
    }

    if (message.length > 500) {
      showToast(`⚠️ Befehl ist zu lang (${message.length} / 500 Zeichen)! Er muss unter 500 Zeichen gekürzt werden.`, 'error');
      return;
    }

    if (!state.twitchUser) {
      showToast('Bitte verbinde dich zuerst mit Twitch', 'error');
      return;
    }

    btnSendChat.disabled = true;
    btnSendChat.innerHTML = '<span class="status-dot green"></span> Sende an Twitch Chat...';

    const res = await ipcRenderer.invoke('twitch:send-chat', {
      message,
      channel: state.targetChannel
    });

    btnSendChat.disabled = false;
    btnSendChat.innerHTML = `<svg class="icon-lg" viewBox="0 0 24 24"><path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg> In Twitch-Chat Senden (!editsetup)`;

    if (res.success) {
      showToast(`!editsetup Befehl in #${state.targetChannel} gesendet!`, 'success');
      triggerAutoLearn();

      // Auto start / sync head session and timer
      if (typeof checkAndAutoStartHeadSession === 'function') {
        checkAndAutoStartHeadSession(true);
      }

      // Publish confirmed setup to OBS Overlay Server & Cloud
      const kohleVal = (inputGlobalKohle ? inputGlobalKohle.value : '').trim();
      const extraVal = (inputGlobalExtra ? inputGlobalExtra.value : '').trim();
      ipcRenderer.invoke('obs:publish-setup', {
        commandText: message,
        persons: state.persons,
        kohle: kohleVal,
        extra: extraVal
      }).catch(() => {});
    } else {
      showToast(`Fehler beim Senden: ${res.error}`, 'error');
    }
  });

  // Clearable Input Field Listeners (1-Click Clear Button ✕)
  document.addEventListener('input', (e) => {
    if (e.target && e.target.matches('.clearable-input-wrapper input')) {
      const btn = e.target.parentElement ? e.target.parentElement.querySelector('.btn-clear-field') : null;
      if (btn) {
        if (e.target.value.trim() !== '') btn.classList.remove('hidden');
        else btn.classList.add('hidden');
      }
    }
  });

  document.addEventListener('click', (e) => {
    if (e.target && e.target.matches('.btn-clear-field')) {
      e.preventDefault();
      const input = e.target.parentElement ? e.target.parentElement.querySelector('input') : null;
      if (input) {
        input.value = '';
        e.target.classList.add('hidden');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.focus();
      }
    }
  });

  // Hamburger Secondary Menu Toggle
  const btnHamburgerMenu = document.getElementById('btn-hamburger-menu');
  const hamburgerDropdownMenu = document.getElementById('hamburger-dropdown-menu');
  if (btnHamburgerMenu && hamburgerDropdownMenu) {
    btnHamburgerMenu.addEventListener('click', (e) => {
      e.stopPropagation();
      hamburgerDropdownMenu.classList.toggle('hidden');
      if (importDropdownMenu) importDropdownMenu.classList.add('hidden');
    });
  }

  // Promo Block Toggle
  const btnTogglePromo = document.getElementById('btn-toggle-promo');
  const promoBlock = document.getElementById('promo-block');
  if (btnTogglePromo && promoBlock) {
    btnTogglePromo.addEventListener('click', () => {
      const isExpanded = btnTogglePromo.getAttribute('aria-expanded') === 'true';
      btnTogglePromo.setAttribute('aria-expanded', isExpanded ? 'false' : 'true');
      promoBlock.classList.toggle('collapsed', isExpanded);
      promoBlock.querySelectorAll('input, select').forEach(el => {
        if (!el.classList.contains('btn-clear-field')) {
          el.setAttribute('tabindex', isExpanded ? '-1' : '0');
        }
      });
    });
  }

  // Power-User Hotkeys (Ctrl+N, Ctrl+L, Ctrl+Enter, Ctrl+Shift+C)
  document.addEventListener('keydown', (e) => {
    // Ctrl+N -> Focus notes textarea
    if ((e.ctrlKey || e.metaKey) && (e.key === 'n' || e.key === 'N') && !e.shiftKey) {
      e.preventDefault();
      if (notesCard && notesCard.classList.contains('hidden') && btnToggleNotes) {
        btnToggleNotes.click();
      }
      if (notesTextarea) {
        notesTextarea.focus();
        notesTextarea.select();
      }
    }
    // Ctrl+L -> Reset all
    if ((e.ctrlKey || e.metaKey) && (e.key === 'l' || e.key === 'L') && !e.shiftKey) {
      e.preventDefault();
      if (btnResetAll) btnResetAll.click();
    }
    // Ctrl+Shift+C -> Copy command
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'c' || e.key === 'C')) {
      e.preventDefault();
      if (btnCopy) btnCopy.click();
    }
    // Ctrl+Enter -> Send to chat
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (btnSendChat && !btnSendChat.disabled && commandIsReady) {
        btnSendChat.click();
      } else {
        showToast('Kein Befehl zum Senden bereit. Bitte zuerst ein Setup konfigurieren.', 'warning');
      }
    }
  });

  // OBS Stream Overlay Modal Elements
  const btnOpenObs = document.getElementById('btn-open-obs');
  const obsModal = document.getElementById('obs-modal');
  const btnCloseObsModal = document.getElementById('btn-close-obs-modal');
  const btnCloseObs = document.getElementById('btn-close-obs');
  const btnCopyObsCloud = document.getElementById('btn-copy-obs-cloud');
  const btnCopyObsLocal = document.getElementById('btn-copy-obs-local');
  const btnTestOverlayBrowser = document.getElementById('btn-test-overlay-browser');

  async function updateObsUrls() {
    const chan = (state.targetChannel || 'marved').toLowerCase().replace('#', '').trim();
    const encodedChannel = encodeURIComponent(chan);
    let localBase = 'http://127.0.0.1:18942';
    try {
      const info = await ipcRenderer.invoke('obs:get-info');
      if (info && info.localUrl) localBase = info.localUrl.replace(/\/overlay\/?$/, '');
    } catch (_) {}

    const urls = {
      'obs-cloud-url': `https://bazztee.github.io/shishawg-mod-setup-tool/overlay.html?channel=${encodedChannel}`,
      'obs-local-url': `${localBase}/overlay?channel=${encodedChannel}`,
      'obs-qna-cloud-url': `https://bazztee.github.io/shishawg-mod-setup-tool/qna.html?channel=${encodedChannel}&mode=overlay`,
      'obs-qna-local-url': `${localBase}/qna.html?channel=${encodedChannel}&mode=overlay`,
      'obs-timer-cloud-url': `https://bazztee.github.io/shishawg-mod-setup-tool/qna.html?channel=${encodedChannel}&mode=timer`,
      'obs-timer-local-url': `${localBase}/qna.html?channel=${encodedChannel}&mode=timer`,
      'obs-qna-prompter-url': `https://bazztee.github.io/shishawg-mod-setup-tool/qna.html?channel=${encodedChannel}&mode=screen`
    };
    Object.entries(urls).forEach(([id, value]) => {
      const input = document.getElementById(id);
      if (input) input.value = value;
    });
  }

  function focusOverlayCard(section) {
    if (!section || !obsModal) return;
    const card = obsModal.querySelector(`[data-overlay-card="${section}"]`);
    if (!card) return;
    obsModal.querySelectorAll('.obs-center-card.is-focused').forEach(item => item.classList.remove('is-focused'));
    card.classList.add('is-focused');
    requestAnimationFrame(() => card.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    setTimeout(() => card.classList.remove('is-focused'), 1800);
  }

  async function openOverlayCenter(section = '') {
    if (!obsModal) return;
    await updateObsUrls();
    obsModal.classList.remove('hidden');
    if (hamburgerDropdownMenu) hamburgerDropdownMenu.classList.add('hidden');
    focusOverlayCard(section);
  }

  if (btnOpenObs && obsModal) {
    btnOpenObs.addEventListener('click', () => openOverlayCenter());
  }
  document.querySelectorAll('[data-open-overlay-center]').forEach(button => {
    button.addEventListener('click', () => openOverlayCenter(button.dataset.openOverlayCenter || ''));
  });
  if (btnCloseObsModal && obsModal) {
    btnCloseObsModal.addEventListener('click', () => obsModal.classList.add('hidden'));
  }
  if (btnCloseObs && obsModal) {
    btnCloseObs.addEventListener('click', () => obsModal.classList.add('hidden'));
  }
  if (btnCopyObsCloud) {
    btnCopyObsCloud.addEventListener('click', async () => {
      const url = document.getElementById('obs-cloud-url').value;
      await ipcRenderer.invoke('app:copy-clipboard', url);
      showToast('Cloud OBS-URL in Zwischenablage kopiert!', 'success');
    });
  }
  if (btnCopyObsLocal) {
    btnCopyObsLocal.addEventListener('click', async () => {
      const url = document.getElementById('obs-local-url').value;
      await ipcRenderer.invoke('app:copy-clipboard', url);
      showToast('Lokale OBS-URL in Zwischenablage kopiert!', 'success');
    });
  }
  if (btnTestOverlayBrowser) {
    btnTestOverlayBrowser.addEventListener('click', () => {
      const url = document.getElementById('obs-cloud-url').value;
      ipcRenderer.invoke('app:open-external', url);
    });
  }

  const overlayActions = [
    ['btn-copy-qna-local', 'obs-qna-local-url', 'Lokale Q&A-Overlay-URL kopiert!', 'copy'],
    ['btn-copy-timer-local', 'obs-timer-local-url', 'Lokale Timer-Overlay-URL kopiert!', 'copy'],
    ['btn-test-qna-overlay', 'obs-qna-cloud-url', '', 'open'],
    ['btn-test-timer-overlay', 'obs-timer-cloud-url', '', 'open'],
    ['btn-test-qna-prompter', 'obs-qna-prompter-url', '', 'open']
  ];
  overlayActions.forEach(([buttonId, inputId, message, action]) => {
    const button = document.getElementById(buttonId);
    if (!button) return;
    button.addEventListener('click', async () => {
      const input = document.getElementById(inputId);
      if (!input || !input.value) return;
      if (action === 'open') {
        await ipcRenderer.invoke('app:open-external', input.value);
      } else {
        await ipcRenderer.invoke('app:copy-clipboard', input.value);
        showToast(message, 'success');
      }
    });
  });

  // Onboarding Hint — show once on first ever launch or on Help button click
  const onboardingHint = document.getElementById('onboarding-hint');
  const btnDismissOnboarding = document.getElementById('btn-dismiss-onboarding');
  const btnShowOnboarding = document.getElementById('btn-show-onboarding');
  let onboardingTimer = null;

  if (onboardingHint && !localStorage.getItem('swg_onboarding_done')) {
    onboardingHint.classList.remove('hidden');
    onboardingTimer = setTimeout(() => {
      onboardingHint.classList.add('hidden');
      localStorage.setItem('swg_onboarding_done', '1');
    }, 8000);
  }

  if (btnDismissOnboarding && onboardingHint) {
    btnDismissOnboarding.addEventListener('click', () => {
      if (onboardingTimer) clearTimeout(onboardingTimer);
      onboardingHint.classList.add('hidden');
      localStorage.setItem('swg_onboarding_done', '1');
    });
  }

  if (btnShowOnboarding && onboardingHint) {
    btnShowOnboarding.addEventListener('click', () => {
      if (onboardingTimer) clearTimeout(onboardingTimer);
      localStorage.removeItem('swg_onboarding_done');
      onboardingHint.classList.remove('hidden');
      showToast('Onboarding-Hilfe eingeblendet ℹ️', 'info');
    });
  }

  // Close all dropdowns when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.dropdown-wrapper')) {
      if (hamburgerDropdownMenu) hamburgerDropdownMenu.classList.add('hidden');
      if (importDropdownMenu) importDropdownMenu.classList.add('hidden');
    }
  });

  // Reset Form
  btnResetAll.addEventListener('click', () => {
    state.personCount = 1;
    updatePersonCountLabel();
    state.persons = [];
    if (notesTextarea) notesTextarea.value = '';
    if (inputGlobalKohle) inputGlobalKohle.value = '';
    if (inputGlobalExtra) inputGlobalExtra.value = '';
    if (inputGlobalPromo) inputGlobalPromo.value = '';
    if (selectPromoTarget) selectPromoTarget.value = 'kohle';
    if (chkIncludePromoDesc) chkIncludePromoDesc.checked = true;
    if (chkIncludeFlavors) chkIncludeFlavors.checked = true;
    renderPersonsGrid();
    generateCommandString();
    showToast('Gesamtes Formular & Extras vollständig geleert', 'info');
  });

  // Notes Listeners
  if (btnToggleNotes && notesCard) {
    btnToggleNotes.addEventListener('click', () => {
      notesCard.classList.toggle('hidden');
      btnToggleNotes.classList.toggle('active', !notesCard.classList.contains('hidden'));
      if (!notesCard.classList.contains('hidden') && notesTextarea) {
        notesTextarea.focus();
      }
    });
  }

  if (btnClearNotes && notesTextarea) {
    btnClearNotes.addEventListener('click', () => {
      notesTextarea.value = '';
      if (state.persons[0]) {
        const pName = state.persons[0].name || 'Marvin';
        state.persons[0] = { name: pName, pipe: '', vessel: '', vesselColor: '', bowl: '', hmd: '', tobaccos: [''] };
      }
      if (inputGlobalKohle) inputGlobalKohle.value = '';
      renderPersonsGrid();
      generateCommandString();
      showToast('Notizen & Formular geleert', 'info');
    });
  }

  let notesDebounceTimer = null;
  if (notesTextarea) {
    notesTextarea.addEventListener('input', () => {
      if (notesDebounceTimer) clearTimeout(notesDebounceTimer);
      notesDebounceTimer = setTimeout(() => {
        matchNotesToForm(notesTextarea.value);
      }, 500);
    });

    notesTextarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        if (notesDebounceTimer) clearTimeout(notesDebounceTimer);
        matchNotesToForm(notesTextarea.value);
      }
    });

    notesTextarea.addEventListener('blur', () => {
      if (notesDebounceTimer) clearTimeout(notesDebounceTimer);
      matchNotesToForm(notesTextarea.value);
    });
  }

  // Target Bot Listener
  if (targetBotInput) {
    targetBotInput.addEventListener('input', () => {
      targetBotInput.title = `Bot-Name: @${targetBotInput.value.trim() || 'marvedbot'}`;
    });
    targetBotInput.addEventListener('change', () => {
      state.targetBot = targetBotInput.value.trim().toLowerCase() || 'marvedbot';
      updateChannelBotTooltips();
      generateCommandString();
      showToast(`Bot-Name zum Auslesen auf @${state.targetBot} gesetzt`, 'success');
    });
  }

  // Promo & Flavor Checkbox Listeners
  if (chkIncludePromoDesc) {
    chkIncludePromoDesc.addEventListener('change', generateCommandString);
  }
  if (chkIncludeFlavors) {
    chkIncludeFlavors.addEventListener('change', generateCommandString);
  }

  // Database Modal Listeners
  btnOpenDb.addEventListener('click', () => {
    dbModal.classList.remove('hidden');
    renderCatalogList();
  });

  const btnSyncCloudDb = document.getElementById('btn-sync-cloud-db') || document.getElementById('btn-sync-github-db');
  if (btnSyncCloudDb) {
    btnSyncCloudDb.addEventListener('click', async () => {
      btnSyncCloudDb.disabled = true;
      btnSyncCloudDb.textContent = '🔄 Abgleich läuft...';
      const res = await ipcRenderer.invoke('db:sync-cloud');
      btnSyncCloudDb.disabled = false;
      btnSyncCloudDb.textContent = '🔄 Sync (HookahTools + Cloud)';
      if (res && res.success) {
        if (res.catalog) state.catalog = res.catalog;
        updateDatalists();
        renderCatalogList();
        const tobaccoMsg = res.hookahTobaccoCount ? `${res.hookahTobaccoCount} Tabaksorten von HookahTools` : 'Tabak';
        showToast(`Katalog synchronisiert (${tobaccoMsg} & Hardware)!`, 'success');
      } else {
        showToast('Konnte Katalog nicht abgleichen', 'error');
      }
    });
  }

  btnCloseDbModal.addEventListener('click', () => {
    dbModal.classList.add('hidden');
  });

  const lblIsElectric = document.getElementById('lbl-is-electric');
  const chkIsElectric = document.getElementById('chk-is-electric');

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      state.currentDbTab = e.target.getAttribute('data-tab');

      if (lblIsElectric) {
        if (state.currentDbTab === 'tab-bowls') {
          lblIsElectric.classList.remove('hidden');
        } else {
          lblIsElectric.classList.add('hidden');
        }
      }

      if (state.currentDbTab === 'tab-promos') {
        if (newItemInput) newItemInput.placeholder = 'Promo-Command (z. B. !xkah)...';
        if (newItemDescInput) newItemDescInput.classList.remove('hidden');
      } else {
        if (newItemInput) newItemInput.placeholder = 'Neues Element hinzufügen...';
        if (newItemDescInput) newItemDescInput.classList.add('hidden');
      }
      renderCatalogList();
    });
  });

  btnAddDbItem.addEventListener('click', async () => {
    const code = newItemInput.value.trim();
    if (!code) return;

    let itemVal = code;
    if (state.currentDbTab === 'tab-bowls' && chkIsElectric && chkIsElectric.checked) {
      itemVal = { name: code, isElectric: true };
    } else if (state.currentDbTab === 'tab-promos') {
      const desc = newItemDescInput ? newItemDescInput.value.trim() : '';
      if (desc) {
        itemVal = `${code} (${desc})`;
      }
    }

    const catKey = getCategoryKeyForTab(state.currentDbTab);
    const existingList = state.catalog[catKey] || [];
    const checkName = typeof itemVal === 'string' ? itemVal : itemVal.name;
    const dupCheck = checkDuplicateFuzzy(checkName, existingList);

    if (dupCheck.isExact) {
      showToast(`⚠️ "${dupCheck.matchName}" existiert bereits in dieser Kategorie!`, 'warning');
      return;
    }
    if (dupCheck.isNearDuplicate) {
      const pct = Math.round(dupCheck.similarity * 100);
      showToast(`⚠️ Ähnlicher Eintrag existiert bereits: "${dupCheck.matchName}" (${pct}% Ähnlichkeit)`, 'info');
    }

    const res = await ipcRenderer.invoke('db:add-item', { category: catKey, item: itemVal });
    if (res.success) {
      state.catalog = res.catalog;
      updateDatalists();
      newItemInput.value = '';
      if (newItemDescInput) newItemDescInput.value = '';
      if (chkIsElectric) chkIsElectric.checked = false;
      renderCatalogList();
      const addedName = typeof itemVal === 'string' ? itemVal : itemVal.name;
      showToast(`"${addedName}" zur Datenbank hinzugefügt`, 'success');
    } else {
      showToast(`Eintrag existiert bereits!`, 'warning');
    }
  });

  const dbSearchInput = document.getElementById('db-search-input');
  if (dbSearchInput) {
    dbSearchInput.addEventListener('input', renderCatalogList);
  }
}

// Auto-Updater Event Handlers
function setupUpdaterEvents() {
  if (btnCheckUpdates) {
    btnCheckUpdates.addEventListener('click', async () => {
      await showReleaseNotes(true);
    });
  }

  if (btnCloseUpdaterModal) {
    btnCloseUpdaterModal.addEventListener('click', () => {
      updaterModal.classList.add('hidden');
    });
  }

  if (btnUpdaterSkip) {
    btnUpdaterSkip.addEventListener('click', () => {
      updaterModal.classList.add('hidden');
    });
  }

  if (btnUpdaterAction) {
    btnUpdaterAction.addEventListener('click', async () => {
      if (updateState === 'available') {
        updateState = 'downloading';
        btnUpdaterAction.disabled = true;
        btnUpdaterAction.textContent = 'Lade herunter...';
        updaterProgressContainer.classList.remove('hidden');
        await ipcRenderer.invoke('updater:download');
      } else if (updateState === 'downloaded') {
        btnUpdaterAction.textContent = 'Starte Installation...';
        await ipcRenderer.invoke('updater:install');
      }
    });
  }

  ipcRenderer.on('updater:available', (event, info) => {
    updateState = 'available';
    updaterText.innerHTML = `Eine neue Version (<strong>v${escapeHtml(info.version)}</strong>) ist auf GitHub verfügbar!<br>Möchtest du sie jetzt herunterladen und installieren?`;
    btnUpdaterAction.disabled = false;
    btnUpdaterAction.textContent = 'Jetzt Updaten & Drüberinstallieren';
    updaterProgressContainer.classList.add('hidden');
    updaterModal.classList.remove('hidden');
  });

  ipcRenderer.on('updater:not-available', () => {
    showToast('Du verwendest bereits die neueste Version!', 'success');
  });

  ipcRenderer.on('updater:progress', (event, progressObj) => {
    const percent = Math.round(progressObj.percent || 0);
    updaterPercent.textContent = `${percent}%`;
    updaterProgressBar.style.width = `${percent}%`;
  });

  ipcRenderer.on('updater:downloaded', (event, info) => {
    updateState = 'downloaded';
    updaterStatusText.textContent = 'Download abgeschlossen!';
    updaterPercent.textContent = '100%';
    updaterProgressBar.style.width = '100%';
    btnUpdaterAction.disabled = false;
    btnUpdaterAction.textContent = 'Jetzt Neu Starten & Installieren';
  });

  ipcRenderer.on('updater:error', (event, errMessage) => {
    if (!errMessage) return;
    if (errMessage.includes('app-update.yml') || errMessage.includes('ENOENT') || errMessage.includes('dev-app-update.yml')) {
      return; // Silently ignore in portable test build
    }
    updaterStatusText.textContent = `Fehler: ${errMessage || 'Asset-Name auf GitHub weicht ab'}`;
    btnUpdaterAction.disabled = false;
    btnUpdaterAction.textContent = '🌐 Im Browser öffnen & Herunterladen';
    btnUpdaterAction.onclick = () => {
      ipcRenderer.invoke('app:open-external', 'https://github.com/BazZTee/shishawg-mod-setup-tool/releases/latest');
    };
    showToast(`Update-Fehler: ${errMessage}`, 'error');
  });

  // Display version tag
  ipcRenderer.invoke('app:get-version').then(ver => {
    const tag = document.getElementById('app-version-tag');
    if (tag) tag.textContent = `v${ver}`;
  }).catch(() => {});

  // Setup Change Request modal listeners (Spec #1)
  setupChangeRequestListeners();

  // Setup Custom Mod Dashboard listeners (Spec #3)
  setupCustomDashboardListeners();

  // Automatically check updates 3s after startup
  setTimeout(() => {
    ipcRenderer.invoke('updater:check').catch(() => {});
  }, 3000);
}

function getCategoryKeyForTab(tabId) {
  switch (tabId) {
    case 'tab-pipes': return 'pipes';
    case 'tab-bowls': return 'bowls';
    case 'tab-vases': return 'vases';
    case 'tab-hmds': return 'hmds';
    case 'tab-charcoal': return 'charcoal';
    case 'tab-persons': return 'persons';
    case 'tab-tastings': return 'tastings';
    case 'tab-promos': return 'promos';
    default: return 'tobacco';
  }
}

function renderCatalogList() {
  const catKey = getCategoryKeyForTab(state.currentDbTab);
  let items = state.catalog[catKey] || [];

  const dbSearchInput = document.getElementById('db-search-input');
  const searchVal = dbSearchInput ? dbSearchInput.value.trim() : '';
  if (searchVal) {
    items = fuzzyFilterList(searchVal, items, 0.40);
  }

  if (items.length === 0) {
    catalogListItems.innerHTML = `<p class="subtitle" style="text-align:center; padding: 12px;">${searchVal ? 'Keine Treffer gefunden' : 'Keine Einträge vorhanden'}</p>`;
    return;
  }

  catalogListItems.innerHTML = items.map((item, idx) => {
    const itemName = typeof item === 'string' ? item : item.name;
    const isElectricItem = typeof item === 'object' && item.isElectric;
    const isCustomTobacco = catKey === 'tobacco' && (typeof item === 'object' ? (item.source === 'custom' || item.isCustom) : true);
    const isHookahToolsTobacco = catKey === 'tobacco' && (typeof item === 'object' && item.source === 'hookahtools');

    let displayHtml = `<span>${escapeHtml(itemName)}${isElectricItem ? ' <span class="char-badge" style="color:var(--accent-cyan); margin-left:6px;">⚡ Elektro</span>' : ''}</span>`;
    
    if (catKey === 'tobacco') {
      if (isCustomTobacco) {
        displayHtml = `<span>${escapeHtml(itemName)} <span class="badge-source-custom" title="Eigene Custom-Sorte (bearbeitbar & löschbar)">🟢 Custom</span></span>`;
      } else if (isHookahToolsTobacco) {
        displayHtml = `<span>${escapeHtml(itemName)} <span class="badge-source-ht" title="Automatisch von HookahTools.de synchronisiert">🌐 HookahTools</span></span>`;
      }
    } else if (catKey === 'promos') {
      const match = itemName.match(/^([^\(]+?)(?:\s*\((.+)\))?$/);
      if (match) {
        const code = match[1].trim();
        const desc = match[2] ? match[2].trim() : '';
        displayHtml = `<span><strong class="promo-code">${escapeHtml(code)}</strong>${desc ? `<span class="promo-desc">(${escapeHtml(desc)})</span>` : ''}</span>`;
      }
    }

    const itemAttr = escapeHtml(typeof item === 'string' ? item : JSON.stringify(item));

    // Action buttons: HookahTools items have NEITHER trash nor edit button
    let actionsHtml = '';
    if (catKey === 'tobacco' && isHookahToolsTobacco) {
      actionsHtml = `<span class="ht-sync-info" title="Automatisch von HookahTools.de synchronisiert">🌐 Synchronisiert</span>`;
    } else {
      actionsHtml = `
        <div class="catalog-actions">
          <button class="btn-icon btn-edit-item" data-idx="${idx}" data-item="${itemAttr}" title="Bearbeiten">✏️</button>
          <button class="btn-icon btn-delete-item" data-item="${itemAttr}" title="Löschen">🗑️</button>
        </div>
      `;
    }

    const itemClass = (catKey === 'tobacco' && isCustomTobacco) ? 'catalog-item item-source-custom catalog-item-fade' : 'catalog-item catalog-item-fade';

    return `
      <div class="${itemClass}" id="catalog-item-${idx}">
        <div class="item-view" style="display:flex; justify-content:space-between; align-items:center; width:100%;">
          ${displayHtml}
          ${actionsHtml}
        </div>
      </div>
    `;
  }).join('');

  // Attach Inline Edit Listener for ✏️
  catalogListItems.querySelectorAll('.btn-edit-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = e.currentTarget.getAttribute('data-idx');
      const oldItemStr = e.currentTarget.getAttribute('data-item');
      const itemContainer = document.getElementById(`catalog-item-${idx}`);
      if (!itemContainer) return;

      let oldObj = oldItemStr;
      try {
        if (oldItemStr.startsWith('{')) oldObj = JSON.parse(oldItemStr);
      } catch (err) {}

      const oldName = typeof oldObj === 'string' ? oldObj : oldObj.name;
      const oldIsElec = typeof oldObj === 'object' && oldObj.isElectric;

      if (catKey === 'promos') {
        let codeVal = oldName;
        let descVal = '';
        const match = oldName.match(/^([^\(]+?)(?:\s*\((.+)\))?$/);
        if (match) {
          codeVal = match[1].trim();
          descVal = match[2] ? match[2].trim() : '';
        }

        itemContainer.innerHTML = `
          <div class="inline-edit-box">
            <input type="text" id="inline-code-${idx}" value="${escapeHtml(codeVal)}" placeholder="Command (max 30)" maxlength="30" style="flex:1;">
            <input type="text" id="inline-desc-${idx}" value="${escapeHtml(descVal)}" placeholder="Beschreibung (max 30)" maxlength="30" style="flex:1;">
            <button class="btn btn-primary btn-sm btn-save-inline">✓ Speichern</button>
            <button class="btn btn-secondary btn-sm btn-cancel-inline">✕ Abbrechen</button>
          </div>
        `;
      } else {
        itemContainer.innerHTML = `
          <div class="inline-edit-box">
            <input type="text" id="inline-input-${idx}" value="${escapeHtml(oldName)}" maxlength="60" style="flex:1;">
            ${catKey === 'bowls' ? `
            <label class="toggle-switch checkbox-label" title="Als Elektro-Gerät kennzeichnen"><input type="checkbox" id="inline-elec-${idx}" ${oldIsElec ? 'checked' : ''}><span class="toggle-slider"></span><span class="toggle-text">⚡ Elektro</span></label>
            ` : ''}
            <button class="btn btn-primary btn-sm btn-save-inline">✓ Speichern</button>
            <button class="btn btn-secondary btn-sm btn-cancel-inline">✕ Abbrechen</button>
          </div>
        `;
      }

      const firstInput = itemContainer.querySelector('input');
      if (firstInput) {
        firstInput.focus();
        firstInput.select();
      }

      itemContainer.querySelector('.btn-cancel-inline').addEventListener('click', () => {
        renderCatalogList();
      });

      itemContainer.querySelector('.btn-save-inline').addEventListener('click', async () => {
        let newItem = '';
        if (catKey === 'promos') {
          const c = document.getElementById(`inline-code-${idx}`).value.trim();
          const d = document.getElementById(`inline-desc-${idx}`).value.trim();
          if (!c) return renderCatalogList();
          newItem = d ? `${c} (${d})` : c;
        } else {
          const val = document.getElementById(`inline-input-${idx}`).value.trim();
          const isElecChecked = document.getElementById(`inline-elec-${idx}`) ? document.getElementById(`inline-elec-${idx}`).checked : false;
          if (catKey === 'bowls' && isElecChecked) {
            newItem = { name: val, isElectric: true };
          } else {
            newItem = val;
          }
        }

        if (newItem) {
          const res = await ipcRenderer.invoke('db:edit-item', { category: catKey, oldItem: oldObj, newItem });
          if (res.success) {
            state.catalog = res.catalog;
            updateDatalists();
            renderCatalogList();
            showToast(`Eintrag aktualisiert`, 'success');
          }
        } else {
          renderCatalogList();
        }
      });
    });
  });

  catalogListItems.querySelectorAll('.btn-delete-item').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const rawItem = e.currentTarget.getAttribute('data-item');
      let itemToDelete = rawItem;
      try {
        if (rawItem.startsWith('{')) itemToDelete = JSON.parse(rawItem);
      } catch (err) {}
      const res = await ipcRenderer.invoke('db:remove-item', { category: catKey, item: itemToDelete });
      if (res.success) {
        state.catalog = res.catalog;
        updateDatalists();
        renderCatalogList();
        showToast(`Eintrag gelöscht`, 'info');
      }
    });
  });
}

// Toast Helper
let toastTimer = null;
function showToast(msg, type = 'info', options = {}) {
  if (!toastMessage || !toastBanner) return;
  toastMessage.textContent = msg;
  toastBanner.className = `toast ${type}`;
  toastBanner.onclick = null;
  toastBanner.onkeydown = null;
  toastBanner.removeAttribute('role');
  toastBanner.removeAttribute('tabindex');
  toastBanner.removeAttribute('aria-label');

  if (typeof options.onClick === 'function') {
    toastBanner.classList.add('toast-actionable');
    toastBanner.setAttribute('role', 'button');
    toastBanner.setAttribute('tabindex', '0');
    toastBanner.setAttribute('aria-label', options.ariaLabel || `${msg} – zum Antworten anklicken`);
    const runAction = () => {
      toastBanner.classList.add('hidden');
      options.onClick();
    };
    toastBanner.onclick = runAction;
    toastBanner.onkeydown = (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        runAction();
      }
    };
  }
  toastBanner.classList.remove('hidden');

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastBanner.classList.add('hidden');
  }, Number(options.duration) > 0 ? Number(options.duration) : 4500);
}

// Utility HTML escape
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
