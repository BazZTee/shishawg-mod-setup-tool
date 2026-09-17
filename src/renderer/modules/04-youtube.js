// =========================================================================
// SHISHAWG YOUTUBE VIDEO-FINDER & QUICK-SHARE
// =========================================================================

const qaYtSearchInput = document.getElementById('qa-yt-search-input');
const btnQaClearYtSearch = document.getElementById('btn-qa-clear-yt-search');
const qaYtPinnedGrid = document.getElementById('qa-yt-pinned-grid');
const qaYtSuggestionsList = document.getElementById('qa-yt-suggestions-list');
const btnQaAddCustomVideo = document.getElementById('btn-qa-add-custom-video');
const qaCustomYtModal = document.getElementById('qa-custom-yt-modal');
const btnCloseQaYtModal = document.getElementById('btn-close-qa-yt-modal');
const btnCancelCustomYt = document.getElementById('btn-cancel-custom-yt');
const btnSaveCustomYt = document.getElementById('btn-save-custom-yt');
const inputCustomYtUrl = document.getElementById('input-custom-yt-url');
const inputCustomYtTitle = document.getElementById('input-custom-yt-title');
const inputCustomYtCategory = document.getElementById('input-custom-yt-category');

const DEFAULT_SHISHAWG_VIDEOS = [
  {
    id: 'yt-phunnel-guide',
    title: 'Der ultimative Phunnel Kopfbau Guide (Schritt für Schritt)',
    url: 'https://www.youtube.com/@shishawg',
    category: 'Kopfbau',
    desc: 'Perfekter Durchzug & Hitzeverteilung im Phunnel-Kopf. Tabak locker flockig verteilen & Alufolie / HMD.',
    pinned: true,
    isDefault: true
  },
  {
    id: 'yt-hmd-guide',
    title: 'HMD Guide: AO 912 vs ONMO vs Na Grani im Hitzetest',
    url: 'https://www.youtube.com/@shishawg',
    category: 'HMD',
    desc: 'Welcher HMD passt zu welchem Setup? Hitzeentwicklung, Aluguss vs. Edelstahl und Kohleverbrauch.',
    pinned: true,
    isDefault: true
  },
  {
    id: 'yt-kohle-guide',
    title: 'Kohle richtig anmachen & Hitze managen (Magic Charcoal)',
    url: 'https://www.youtube.com/@shishawg',
    category: 'Kohle',
    desc: 'Tipps zum schnellen & gleichmäßigen Durchglühen der Naturkohlen ohne Aschebildung oder Eigengeschmack.',
    pinned: true,
    isDefault: true
  },
  {
    id: 'yt-darkblend-tipps',
    title: 'Darkblend für Einsteiger: MustH & Blackburn rauchen ohne Kratzen',
    url: 'https://www.youtube.com/@shishawg',
    category: 'Tabak',
    desc: 'Bauweise, Hitzetoleranz und Tipps für starken Grundtabak. So schmeckt Darkblend intensiv & smooth.',
    pinned: true,
    isDefault: true
  },
  {
    id: 'yt-mehrloch-guide',
    title: 'Mehrlochkopf / Traditional Bowl richtig bauen & rauchen',
    url: 'https://www.youtube.com/@shishawg',
    category: 'Kopfbau',
    desc: 'Fluffig oder leicht angedrückt? Alles über Durchzug, Alufolie vs. Kamin und HMD auf Mehrlochköpfen.',
    pinned: false,
    isDefault: true
  },
  {
    id: 'yt-reinigung-guide',
    title: 'Shisha, Bowl & Schläuche richtig reinigen',
    url: 'https://www.youtube.com/@shishawg',
    category: 'Pflege',
    desc: 'Schmand und Ablagerungen sauber entfernen – für dauerhaft frischen Durchzug & puren Geschmack.',
    pinned: false,
    isDefault: true
  },
  {
    id: 'yt-fehler-guide',
    title: 'Die 5 häufigsten Fehler beim Shisha Kopfbau & wie man sie vermeidet',
    url: 'https://www.youtube.com/@shishawg',
    category: 'Tutorial',
    desc: 'Warum der Kopf kratzt, anbrennt oder zu wenig Rauch liefert – Fehleranalyse & Soforthilfe.',
    pinned: false,
    isDefault: true
  }
];

let youtubeVideos = [];

function extractYouTubeVideoId(url) {
  if (!url) return '';
  const clean = url.trim();
  const match = clean.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|(?:embed|v|shorts)\/))([\w-]{11})/i);
  if (match) return match[1];
  if (/^[\w-]{11}$/.test(clean)) return clean;
  return '';
}

function saveYouTubeVideos() {
  try {
    localStorage.setItem('swg_youtube_videos', JSON.stringify(youtubeVideos));
  } catch(e) {}
}

function loadYouTubeVideos() {
  try {
    const saved = localStorage.getItem('swg_youtube_videos');
    if (saved) {
      youtubeVideos = JSON.parse(saved);
    } else {
      youtubeVideos = [...DEFAULT_SHISHAWG_VIDEOS];
    }
  } catch(e) {
    youtubeVideos = [...DEFAULT_SHISHAWG_VIDEOS];
  }
  renderYouTubeBoard();
}

let ytSearchDebounce = null;
let lastLiveQuery = '';
let liveSearchResults = [];

function renderYouTubeBoard(isLiveSearch = false) {
  if (!qaYtPinnedGrid) return;

  const rawQuery = (qaYtSearchInput ? qaYtSearchInput.value : '');
  const searchQuery = rawQuery.toLowerCase().trim();

  // 1. Render Pinned Videos Bar
  qaYtPinnedGrid.innerHTML = '';
  const pinnedVideos = youtubeVideos.filter(v => v.pinned);
  if (pinnedVideos.length === 0) {
    qaYtPinnedGrid.innerHTML = '<span style="font-size:0.75rem; color:var(--text-muted);">Keine Favoriten angeheftet. Klicke in der Suche bei einem Video auf "📌".</span>';
  } else {
    pinnedVideos.forEach(v => {
      const chip = document.createElement('div');
      chip.className = 'qa-yt-pinned-chip';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-yt-pinned';
      btn.title = `Klicken zum Posten im Chat:\n"${v.title}"\n(${v.url})`;
      btn.innerHTML = `💬 ${escapeHtml(v.title.length > 34 ? v.title.substring(0, 34) + '...' : v.title)}`;
      btn.addEventListener('click', () => postYouTubeVideoToChat(v));

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'qa-yt-pinned-del';
      delBtn.title = 'Aus Schnellzugriff entfernen';
      delBtn.setAttribute('aria-label', 'Aus Schnellzugriff entfernen');
      delBtn.textContent = '✕';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        v.pinned = false;
        saveYouTubeVideos();
        renderYouTubeBoard();
        showToast('Aus Schnellzugriff entfernt', 'info');
      });

      chip.appendChild(btn);
      chip.appendChild(delBtn);
      qaYtPinnedGrid.appendChild(chip);
    });
  }

  // 2. Suggestions List
  if (!qaYtSuggestionsList) return;

  if (!searchQuery) {
    qaYtSuggestionsList.classList.add('hidden');
    qaYtSuggestionsList.innerHTML = '';
    liveSearchResults = [];
    lastLiveQuery = '';
    return;
  }

  // Combine local videos and live results (deduplicating by videoId / URL)
  const localFiltered = youtubeVideos.filter(v => {
    const titleMatch = (v.title || '').toLowerCase().includes(searchQuery);
    const catMatch = (v.category || '').toLowerCase().includes(searchQuery);
    const descMatch = (v.desc || '').toLowerCase().includes(searchQuery);
    return titleMatch || catMatch || descMatch;
  });

  const combined = [...localFiltered];
  const seenUrls = new Set(localFiltered.map(v => v.url.toLowerCase()));

  const prof = getActiveStreamerProfile();
  const allowedChannels = (prof && Array.isArray(prof.youtubeChannels) && prof.youtubeChannels.length > 0)
    ? prof.youtubeChannels.map(c => c.toLowerCase().replace(/^@/, '').replace(/[^a-z0-9]/g, ''))
    : ['shishawg', 'marvocado'];

  liveSearchResults.forEach(liveVid => {
    if (allowedChannels.length > 0 && liveVid.channel) {
      const vidCh = (liveVid.channel || '').toLowerCase().replace(/^@/, '').replace(/[^a-z0-9]/g, '');
      const isAllowed = allowedChannels.some(a => vidCh === a || vidCh.includes(a) || a.includes(vidCh));
      if (!isAllowed) return;
    }
    if (!seenUrls.has(liveVid.url.toLowerCase())) {
      seenUrls.add(liveVid.url.toLowerCase());
      combined.push(liveVid);
    }
  });

  qaYtSuggestionsList.innerHTML = '';
  qaYtSuggestionsList.classList.remove('hidden');

  if (combined.length === 0) {
    if (!isLiveSearch) {
      qaYtSuggestionsList.innerHTML = `
        <div style="text-align:center; padding: 14px; color: var(--text-muted); font-size: 0.85rem;">
          ⏳ Suche auf ShishaWG YouTube-Kanal nach "<strong>${escapeHtml(searchQuery)}</strong>"...
        </div>
      `;
    } else {
      qaYtSuggestionsList.innerHTML = `
        <div style="text-align:center; padding: 16px; color: var(--text-muted); font-size: 0.85rem;">
          🔍 Kein YouTube-Video zu "<strong>${escapeHtml(searchQuery)}</strong>" gefunden.
          <br><button id="btn-qa-yt-add-from-search" class="btn btn-secondary btn-sm" style="margin-top:8px;">➕ Video-Link manuell hinzufügen</button>
        </div>
      `;
      const btnAddSearch = document.getElementById('btn-qa-yt-add-from-search');
      if (btnAddSearch) {
        btnAddSearch.addEventListener('click', () => {
          if (qaCustomYtModal) qaCustomYtModal.classList.remove('hidden');
          if (inputCustomYtTitle) inputCustomYtTitle.value = rawQuery;
          if (inputCustomYtCategory) inputCustomYtCategory.value = 'Tutorial';
        });
      }
    }
    return;
  }

  // Multi-Channel Tag Color resolver (Red for 1st / ShishaWG, Blue for 2nd / Marvocado, Purple for 3rd, Green for 4th, Amber for 5th)
  function getYtChannelTagStyle(catOrChannel) {
    const defaultRed = 'background: linear-gradient(135deg, rgba(239, 68, 68, 0.25), rgba(220, 38, 38, 0.35)); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.4);';
    if (!catOrChannel) return defaultRed;
    const name = catOrChannel.toLowerCase().replace('@', '').trim();
    const prof = getActiveStreamerProfile();
    const channels = (prof && Array.isArray(prof.youtubeChannels)) ? prof.youtubeChannels.map(c => c.toLowerCase().replace('@', '').trim()) : [];

    let idx = channels.findIndex(c => name.includes(c) || c.includes(name));
    if (idx === -1) {
      if (name.includes('shisha') || name.includes('wg')) idx = 0;
      else if (name.includes('marvocado') || name.includes('vlog') || name.includes('food')) idx = 1;
      else idx = 2;
    }

    const colorStyles = [
      'background: linear-gradient(135deg, rgba(239, 68, 68, 0.25), rgba(220, 38, 38, 0.35)); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.4);', // 1: Red (ShishaWG)
      'background: linear-gradient(135deg, rgba(59, 130, 246, 0.25), rgba(37, 99, 235, 0.35)); color: #93c5fd; border: 1px solid rgba(59, 130, 246, 0.4);', // 2: Blue (Marvocado)
      'background: linear-gradient(135deg, rgba(168, 85, 247, 0.25), rgba(124, 58, 237, 0.35)); color: #d8b4fe; border: 1px solid rgba(168, 85, 247, 0.4);', // 3: Purple
      'background: linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(5, 150, 105, 0.35)); color: #6ee7b7; border: 1px solid rgba(16, 185, 129, 0.4);', // 4: Emerald
      'background: linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(217, 119, 6, 0.35)); color: #fcd34d; border: 1px solid rgba(245, 158, 11, 0.4);'   // 5: Amber
    ];

    return colorStyles[idx % colorStyles.length];
  }

  combined.forEach(video => {
    const item = document.createElement('div');
    item.className = 'qa-yt-suggestion-item';

    const videoId = video.videoId || extractYouTubeVideoId(video.url);
    const thumbUrl = video.thumb || (videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : '');
    const isPinned = youtubeVideos.some(v => v.url === video.url && v.pinned);
    const tagText = video.channel || video.category || 'ShishaWG';
    const tagStyle = getYtChannelTagStyle(tagText);

    item.innerHTML = `
      <div class="qa-yt-sugg-left">
        ${thumbUrl ? `<img src="${escapeHtml(thumbUrl)}" class="qa-yt-thumb-mini" alt="Thumb" onerror="this.style.display='none'">` : '<div class="qa-yt-icon-badge">▶</div>'}
        <div class="qa-yt-sugg-content">
          <div class="qa-yt-sugg-title-row">
            <span class="qa-yt-category-tag" style="${tagStyle}">${escapeHtml(tagText)}</span>
            <span class="qa-yt-sugg-title" title="${escapeHtml(video.title)}">${escapeHtml(video.title)}</span>
          </div>
          <div class="qa-yt-sugg-desc" title="${escapeHtml(video.desc || video.url)}">${escapeHtml(video.desc || video.url)}</div>
        </div>
      </div>
      <div class="qa-yt-sugg-actions">
        <button class="btn-yt-share" title="Diesen Video-Link direkt im Twitch-Chat posten">
          💬 In Chat
        </button>
        <button class="btn-icon btn-yt-pin-toggle ${isPinned ? 'pinned' : ''}" title="${isPinned ? 'Von Favoriten lösen' : 'Oben als Favorit anheften'}">
          ${isPinned ? '📌' : '☆'}
        </button>
        <button class="btn-icon btn-yt-copy" title="Link kopieren" style="padding:6px 8px; font-size:0.8rem; background:rgba(255,255,255,0.06); border-radius:6px;">
          📋
        </button>
        <button class="btn-icon btn-yt-open" title="Auf YouTube ansehen" style="padding:6px 8px; font-size:0.8rem; background:rgba(255,255,255,0.06); border-radius:6px;">
          🔗
        </button>
        ${!video.isDefault && !video.isLiveResult ? `
          <button class="btn-icon btn-yt-delete" title="Video löschen" style="padding:6px 8px; font-size:0.8rem; color:#ef4444; background:rgba(239,68,68,0.1); border-radius:6px;">
            ✕
          </button>
        ` : ''}
      </div>
    `;

    // Share button listener
    const btnShare = item.querySelector('.btn-yt-share');
    if (btnShare) {
      btnShare.addEventListener('click', () => postYouTubeVideoToChat(video));
    }

    // Pin toggle listener
    const btnPin = item.querySelector('.btn-yt-pin-toggle');
    if (btnPin) {
      btnPin.addEventListener('click', () => {
        let existing = youtubeVideos.find(v => v.url === video.url);
        if (existing) {
          existing.pinned = !existing.pinned;
        } else {
          youtubeVideos.push({
            id: 'yt-' + (video.videoId || Date.now()),
            title: video.title,
            url: video.url,
            videoId: video.videoId || '',
            category: video.category || 'ShishaWG',
            desc: video.desc || '',
            pinned: true,
            isDefault: false
          });
        }
        saveYouTubeVideos();
        renderYouTubeBoard(true);
        showToast('Favorit aktualisiert', 'info');
      });
    }

    // Copy link listener
    const btnCopy = item.querySelector('.btn-yt-copy');
    if (btnCopy) {
      btnCopy.addEventListener('click', () => {
        navigator.clipboard.writeText(video.url);
        showToast('Video-Link in Zwischenablage kopiert!', 'info');
      });
    }

    // Open link listener
    const btnOpen = item.querySelector('.btn-yt-open');
    if (btnOpen) {
      btnOpen.addEventListener('click', () => {
        ipcRenderer.invoke('app:open-external', video.url);
      });
    }

    // Delete custom video
    const btnDel = item.querySelector('.btn-yt-delete');
    if (btnDel) {
      btnDel.addEventListener('click', () => {
        youtubeVideos = youtubeVideos.filter(v => v.id !== video.id && v.url !== video.url);
        saveYouTubeVideos();
        renderYouTubeBoard(true);
        showToast('Video gelöscht', 'info');
      });
    }

    qaYtSuggestionsList.appendChild(item);
  });
}

async function postYouTubeVideoToChat(video) {
  if (!video || !video.url) return;
  try {
    const activeProf = getActiveStreamerProfile();
    const channel = (targetChannelInput ? targetChannelInput.value.trim() : state.targetChannel) || activeProf.targetChannel || 'marved';
    const streamerName = (activeProf.name || 'Streamer').split(' ')[0] || 'Streamer';
    const message = `🎥 Video-Tipp von ${streamerName}: "${video.title}" 👉 ${video.url}`;
    const res = await ipcRenderer.invoke('twitch:send-chat', { message, channel });
    if (res && res.success) {
      showToast(`Video im Chat gepostet: ${video.title}`, 'success');
    } else {
      showToast(res.error || 'Fehler beim Senden', 'error');
    }
  } catch(err) {
    showToast(err.message || 'Fehler beim Senden in Chat', 'error');
  }
}

function setupYouTubeVideoFinder() {
  loadYouTubeVideos();

  // Live Search input listener with Debounce & YouTube Live API
  if (qaYtSearchInput) {
    qaYtSearchInput.addEventListener('input', () => {
      const q = qaYtSearchInput.value.trim();
      if (btnQaClearYtSearch) {
        btnQaClearYtSearch.classList.toggle('hidden', !q);
      }

      renderYouTubeBoard(false);

      if (ytSearchDebounce) clearTimeout(ytSearchDebounce);
      if (q.length >= 2) {
        ytSearchDebounce = setTimeout(async () => {
          try {
            const activeProf = getActiveStreamerProfile();
            const channels = (activeProf && Array.isArray(activeProf.youtubeChannels) && activeProf.youtubeChannels.length > 0)
              ? activeProf.youtubeChannels
              : ['@shishawg', '@marvocado'];
            const liveRes = await ipcRenderer.invoke('youtube:search', { query: q, channels });
            if (Array.isArray(liveRes) && qaYtSearchInput.value.trim() === q) {
              liveSearchResults = liveRes;
              lastLiveQuery = q;
              renderYouTubeBoard(true);
            }
          } catch(err) {
            console.error('YouTube live search error:', err);
          }
        }, 250);
      }
    });

    qaYtSearchInput.addEventListener('focus', () => {
      if (qaYtSearchInput.value.trim()) {
        renderYouTubeBoard(true);
      }
    });
  }

  // Close suggestions on click outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.qa-yt-search-wrapper')) {
      if (qaYtSuggestionsList) {
        qaYtSuggestionsList.classList.add('hidden');
      }
    }
  });

  // Clear search button
  if (btnQaClearYtSearch) {
    btnQaClearYtSearch.addEventListener('click', () => {
      if (qaYtSearchInput) qaYtSearchInput.value = '';
      btnQaClearYtSearch.classList.add('hidden');
      renderYouTubeBoard(false);
      if (qaYtSearchInput) qaYtSearchInput.focus();
    });
  }

  // Open custom video modal
  if (btnQaAddCustomVideo && qaCustomYtModal) {
    btnQaAddCustomVideo.addEventListener('click', () => {
      qaCustomYtModal.classList.remove('hidden');
      if (inputCustomYtUrl) inputCustomYtUrl.value = '';
      if (inputCustomYtTitle) inputCustomYtTitle.value = '';
      if (inputCustomYtCategory) inputCustomYtCategory.value = '';
      if (inputCustomYtUrl) inputCustomYtUrl.focus();
    });
  }

  if (btnCloseQaYtModal && qaCustomYtModal) {
    btnCloseQaYtModal.addEventListener('click', () => {
      qaCustomYtModal.classList.add('hidden');
    });
  }

  if (btnCancelCustomYt && qaCustomYtModal) {
    btnCancelCustomYt.addEventListener('click', () => {
      qaCustomYtModal.classList.add('hidden');
    });
  }

  // Save custom video
  if (btnSaveCustomYt) {
    btnSaveCustomYt.addEventListener('click', () => {
      const url = inputCustomYtUrl ? inputCustomYtUrl.value.trim() : '';
      const title = inputCustomYtTitle ? inputCustomYtTitle.value.trim() : '';
      const category = inputCustomYtCategory ? inputCustomYtCategory.value.trim() : 'Video';

      if (!url || !title) {
        showToast('Bitte gib mindestens einen YouTube-Link und Titel ein.', 'error');
        return;
      }

      const videoId = extractYouTubeVideoId(url);
      const newVideo = {
        id: 'yt-' + Date.now(),
        title: title,
        url: url,
        videoId: videoId || 'custom',
        category: category || 'Video',
        desc: `YouTube Video: ${title}`,
        pinned: true,
        isDefault: false
      };

      youtubeVideos.unshift(newVideo);
      saveYouTubeVideos();
      renderYouTubeBoard();
      if (qaCustomYtModal) qaCustomYtModal.classList.add('hidden');
      showToast(`Video "${title}" erfolgreich hinzugefügt!`, 'success');
    });
  }
}

