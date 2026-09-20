const { app, BrowserWindow, ipcMain, clipboard, shell, dialog, Notification } = require('electron');
const { startupOptions, revealWhenReady } = require('./startup-window');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const runtime = require('./runtime');
runtime.configure(app);
app.commandLine.appendSwitch('enable-features', 'OverlayScrollbar,FluentOverlayScrollbar');
const SimpleStore = require('./settings-store');
const { configureWindowSecurity, openWebLink } = require('./window-security');
const TwitchService = require('./twitchService');
const DatabaseService = require('./dbService');
const supabaseService = require('./supabaseService');
const trelloService = require('./trelloService');
const { resolveReleaseNotes } = require('./release-notes');
const releaseNotes = require('../shared/release-notes.json');

// State for Live OBS Overlay
let latestLiveSetup = {
  commandText: '!setup Aktuell wird kein Setup geraucht',
  persons: [],
  kohle: '',
  extra: '',
  updatedAt: new Date().toISOString()
};
let obsServer = null;

let mainWindow = null;
let store = null;
let twitchService = null;
let dbService = null;
const activeNativeNotifications = new Set();

function normalizeChannel(channel = 'marved') {
  return String(channel || 'marved').toLowerCase().replace('#', '').trim();
}

function requireAuthorizedActiveChannel(requestedChannel = null) {
  if (!twitchService || !twitchService.isUserAuthorizedMod()) {
    throw new Error('Zugriff verweigert: Keine Moderator-Berechtigung für den aktiven Kanal.');
  }
  const activeChannel = normalizeChannel(twitchService.targetChannel);
  if (requestedChannel && normalizeChannel(requestedChannel) !== activeChannel) {
    throw new Error('Zugriff verweigert: Daten dürfen nur für den aktiven Kanal abgerufen oder geändert werden.');
  }
  return activeChannel;
}

function createWindow() {
  store = new SimpleStore(path.join(app.getPath('userData'), 'app_settings.json'));
  dbService = new DatabaseService();

  const iconPath = path.join(__dirname, '../../build/icon.ico');
  const iconExists = fs.existsSync(iconPath);

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 960,
    minHeight: 700,
    title: 'ShishaWG Mod Setup Tool',
    icon: iconExists ? iconPath : undefined,
    ...startupOptions,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    },
    autoHideMenuBar: true
  });

  configureWindowSecurity(mainWindow, shell);
  twitchService = new TwitchService(mainWindow, store);
  supabaseService.setMainWindow(mainWindow);
  supabaseService.setTwitchTokenProvider(() => twitchService?.accessToken || store?.get('twitch_access_token', '') || '');
  supabaseService.setActiveChannel(twitchService.targetChannel);
  supabaseService.initRealtimeListeners();

  const openingWindow=mainWindow;
  revealWhenReady(openingWindow).catch(error=>{
    if(openingWindow.isDestroyed())return;
    dialog.showErrorBox('Start des ShishaWG Mod Setup Tools fehlgeschlagen', error.message);
    openingWindow.close();
  });
  openingWindow.loadFile(path.join(__dirname, '../renderer/index.html')).catch(()=>{});

  mainWindow.on('focus', () => {
    if (mainWindow) mainWindow.flashFrame(false);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  setupAutoUpdater();
}

function setupAutoUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    if (mainWindow) {
      mainWindow.webContents.send('updater:available', info);
    }
  });

  autoUpdater.on('update-not-available', () => {
    if (mainWindow) {
      mainWindow.webContents.send('updater:not-available');
    }
  });

  autoUpdater.on('download-progress', (progressObj) => {
    if (mainWindow) {
      mainWindow.webContents.send('updater:progress', progressObj);
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    if (mainWindow) {
      mainWindow.webContents.send('updater:downloaded', info);
    }
  });

  autoUpdater.on('error', (err) => {
    const errMsg = err ? (err.message || String(err)) : '';
    // Silently ignore missing app-update.yml in portable/test/dev builds
    if (errMsg.includes('app-update.yml') || errMsg.includes('ENOENT') || errMsg.includes('dev-app-update.yml')) {
      console.warn('AutoUpdater: update config not found (portable/test build mode).');
      return;
    }
    if (mainWindow) {
      mainWindow.webContents.send('updater:error', errMsg || 'Fehler beim Update-Prüfen');
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  startObsServer();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC Handlers for Twitch
ipcMain.handle('twitch:check-auth', async () => {
  const token = store.get('twitch_access_token', '');
  if (!token) return null;
  const user = await twitchService.validateToken(token);
  return user ? { user, token, targetChannel: twitchService.targetChannel, clientId: twitchService.clientId } : null;
});

ipcMain.handle('twitch:get-config', async () => {
  return {
    clientId: twitchService.clientId,
    hasToken: !!twitchService.accessToken,
    targetChannel: twitchService.targetChannel
  };
});

ipcMain.handle('twitch:login', async (event, customClientId) => {
  try {
    if (customClientId) {
      twitchService.setClientId(customClientId);
    }
    await twitchService.startAuthServer(customClientId);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('twitch:save-token', async (event, rawToken) => {
  if (!rawToken) return { success: false, error: 'Kein Token eingegeben' };
  const user = await twitchService.validateToken(rawToken);
  if (user) {
    return { success: true, user, token: twitchService.accessToken };
  } else {
    return { success: false, error: 'Ungültiger Twitch OAuth-Token' };
  }
});

ipcMain.handle('twitch:save-client-id', async (event, clientId) => {
  twitchService.setClientId(clientId);
  return { success: true, clientId: twitchService.clientId };
});

ipcMain.handle('twitch:logout', async () => {
  twitchService.logout();
  return { success: true };
});

ipcMain.handle('twitch:set-channel', async (event, channel) => {
  twitchService.setTargetChannel(channel);
  supabaseService.setActiveChannel(twitchService.targetChannel);
  return { success: true, channel: twitchService.targetChannel };
});

ipcMain.handle('twitch:send-chat', async (event, payload) => {
  try {
    if (payload && typeof payload === 'object' && payload.action) {
      if (payload.action === 'delete') {
        const res = await twitchService.deleteChatMessage(payload.messageId, payload.channel);
        return { success: true, res };
      }
      if (payload.action === 'timeout') {
        const res = await twitchService.timeoutUser(payload.userId, payload.duration, payload.reason, payload.channel);
        return { success: true, res };
      }
      if (payload.action === 'ban') {
        const res = await twitchService.banUser(payload.userId, payload.reason, payload.channel);
        return { success: true, res };
      }
    }
    const message = typeof payload === 'string' ? payload : (payload && payload.message);
    const channel = typeof payload === 'object' ? payload.channel : undefined;
    const res = await twitchService.sendChatMessage(message, channel);
    return { success: true, res };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('twitch:send-chat-message', async (event, payload) => {
  try {
    if (payload && typeof payload === 'object' && payload.action) {
      if (payload.action === 'delete') {
        const res = await twitchService.deleteChatMessage(payload.messageId, payload.channel);
        return { success: true, res };
      }
      if (payload.action === 'timeout') {
        const res = await twitchService.timeoutUser(payload.userId, payload.duration, payload.reason, payload.channel);
        return { success: true, res };
      }
      if (payload.action === 'ban') {
        const res = await twitchService.banUser(payload.userId, payload.reason, payload.channel);
        return { success: true, res };
      }
    }
    const message = typeof payload === 'string' ? payload : (payload && payload.message);
    const channel = typeof payload === 'object' ? payload.channel : undefined;
    const res = await twitchService.sendChatMessage(message, channel);
    return { success: true, res };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('twitch:get-user-info', async (event, login) => {
  try {
    const user = await twitchService.getUserInfo(login);
    return { success: !!user, user };
  } catch(e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('twitch:fetch-setup', async (event, channel) => {
  try {
    const res = await twitchService.fetchSetupFromChat(channel);
    return { success: true, res };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('twitch:get-color', async () => {
  const customColor = store.get('twitch_user_color');
  const isCustom = store.get('twitch_custom_color_set');
  if (isCustom && customColor) return customColor;
  return await twitchService.fetchUserChatColor();
});

ipcMain.handle('twitch:set-color', async (event, color) => {
  if (color) {
    if (twitchService.user) {
      twitchService.user.color = color;
      store.set('twitch_user', twitchService.user);
    }
    store.set('twitch_user_color', color);
    store.set('twitch_custom_color_set', true);
  }
  return true;
});

ipcMain.handle('twitch:check-stream-status', async (event, channel) => {
  return await twitchService.checkStreamStatus(channel);
});

ipcMain.handle('twitch:get-channel-info', async (event, channel) => {
  return await twitchService.getChannelInformation(channel);
});

ipcMain.handle('twitch:search-categories', async (event, query) => {
  return await twitchService.searchCategories(query);
});

ipcMain.handle('twitch:search-channels', async (event, query) => {
  return await twitchService.searchChannels(query);
});

ipcMain.handle('twitch:set-title', async (event, { title, channel }) => {
  try {
    return await twitchService.setStreamTitle(title, channel);
  } catch(err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('twitch:set-game', async (event, { game, channel }) => {
  try {
    return await twitchService.setStreamGame(game, channel);
  } catch(err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('twitch:create-clip', async (event, channel) => {
  try {
    return await twitchService.createClip(channel);
  } catch(err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('twitch:start-raid', async (event, { target, channel }) => {
  try {
    return await twitchService.startRaid(target, channel);
  } catch(err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('twitch:cancel-raid', async (event, channel) => {
  try {
    return await twitchService.cancelRaid(channel);
  } catch(err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('twitch:create-stream-marker', async (event, { description, channel }) => {
  try {
    return await twitchService.createStreamMarker(description, channel);
  } catch(err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('twitch:get-chatters', async (event, channel) => {
  return await twitchService.getChatters(channel);
});

// =========================================================================
// MULTI-STREAMER PROFILES & SETTINGS
// =========================================================================
const DEFAULT_STREAMER_PROFILES = [
  {
    id: 'prof_shishawg',
    name: 'ShishaWG (Marvin)',
    targetChannel: 'marved',
    botName: 'marvedbot',
    defaultPersons: ['Marvin', 'Hasty', 'Kai'],
    youtubeChannels: ['@shishawg', '@marvocado'],
    promoCodes: [
      { shop: 'Holy', code: 'SWG10', desc: '10% Rabatt auf Deine Holy-Bestellung.' },
      { shop: 'Moze', code: 'SWG', desc: 'Zusätzliches Zubehör!' }
    ],
    telegram: {
      botToken: '',
      chatId: '',
      claimUrl: 'https://bazztee.github.io/shishawg-mod-setup-tool/claim.html'
    },
    isDefault: true
  }
];

function migrateLegacyMarvinPromoCodes(profiles) {
  let changed = false;
  for (const profile of profiles) {
    if (profile.id !== 'prof_shishawg' || !Array.isArray(profile.promoCodes) || profile.promoCodes.length !== 2) continue;
    const [first, second] = profile.promoCodes;
    const isOriginalLegacyDefault = first?.shop === 'HookahFloW'
      && first?.code === 'SHISHAWG10'
      && first?.desc === '10% Rabatt'
      && second?.shop === 'Moze'
      && second?.code === 'SHISHAWG'
      && second?.desc === 'Rabattcode';
    const isPreviousDefault = first?.shop === ''
      && first?.code === 'SWG10'
      && first?.desc === '10% Rabatt'
      && second?.shop === ''
      && second?.code === 'SWG'
      && second?.desc === 'SWG5';
    const isLegacyDefault = isOriginalLegacyDefault || isPreviousDefault;
    if (!isLegacyDefault) continue;
    profile.promoCodes = [
      { shop: 'Holy', code: 'SWG10', desc: '10% Rabatt auf Deine Holy-Bestellung.' },
      { shop: 'Moze', code: 'SWG', desc: 'Zusätzliches Zubehör!' }
    ];
    changed = true;
  }
  return changed;
}

ipcMain.handle('profiles:get-all', async () => {
  try {
    let profiles = store.get('streamer_profiles', DEFAULT_STREAMER_PROFILES);
    if (migrateLegacyMarvinPromoCodes(profiles)) {
      store.set('streamer_profiles', profiles);
    }
    const activeId = store.get('active_profile_id', profiles[0]?.id || 'prof_shishawg');

    // Auto-fetch Telegram config from Supabase / Store if empty
    for (const prof of profiles) {
      if (!prof.telegram || !prof.telegram.botToken || !prof.telegram.chatId) {
        try {
          const chan = prof.targetChannel || 'marved';
          let remoteCfg = null;
          if (supabaseService) {
            remoteCfg = await supabaseService.getTelegramConfig(chan);
          }
          if (!remoteCfg && dbService) {
            remoteCfg = await dbService.getTelegramConfig();
          }
          const localToken = store.get('telegram_bot_token', '');
          const localChat = store.get('telegram_chat_id', '');
          const localClaim = store.get('giveaway_claim_url', 'https://bazztee.github.io/shishawg-mod-setup-tool/claim.html');

          prof.telegram = {
            botToken: prof.telegram?.botToken || remoteCfg?.botToken || localToken || '',
            chatId: prof.telegram?.chatId || remoteCfg?.chatId || localChat || '',
            claimUrl: prof.telegram?.claimUrl || remoteCfg?.claimUrl || localClaim || 'https://bazztee.github.io/shishawg-mod-setup-tool/claim.html'
          };
        } catch(e) {}
      }
    }

    return { success: true, profiles, activeProfileId: activeId };
  } catch(e) {
    return { success: false, profiles: DEFAULT_STREAMER_PROFILES, activeProfileId: 'prof_shishawg', error: e.message };
  }
});

ipcMain.handle('profiles:save-all', async (event, { profiles, activeProfileId }) => {
  try {
    if (Array.isArray(profiles) && profiles.length > 0) {
      store.set('streamer_profiles', profiles);

      // Save and sync Telegram config to Supabase for all profiles
      for (const p of profiles) {
        if (p.telegram && (p.telegram.botToken || p.telegram.chatId)) {
          if (supabaseService) {
            await supabaseService.saveTelegramConfig(p.telegram, p.targetChannel || 'marved');
          }
          if (dbService) {
            await dbService.saveTelegramConfig(p.telegram);
          }
        }
      }
    }
    if (activeProfileId) {
      store.set('active_profile_id', activeProfileId);
      const activeProf = (profiles || store.get('streamer_profiles', [])).find(p => p.id === activeProfileId);
      if (activeProf) {
        if (activeProf.targetChannel && twitchService) {
          twitchService.setTargetChannel(activeProf.targetChannel);
          supabaseService.setActiveChannel(twitchService.targetChannel);
        }
        if (activeProf.botName) {
          store.set('target_bot', activeProf.botName);
        }
        if (activeProf.telegram) {
          store.set('telegram_bot_token', activeProf.telegram.botToken || '');
          store.set('telegram_chat_id', activeProf.telegram.chatId || '');
          store.set('giveaway_claim_url', activeProf.telegram.claimUrl || '');
        }
      }
    }
    return { success: true };
  } catch(e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('profiles:set-active', async (event, profileId) => {
  try {
    const profiles = store.get('streamer_profiles', DEFAULT_STREAMER_PROFILES);
    const activeProf = profiles.find(p => p.id === profileId);
    if (!activeProf) return { success: false, error: 'Profil nicht gefunden' };

    store.set('active_profile_id', profileId);
    if (activeProf.targetChannel && twitchService) {
      twitchService.setTargetChannel(activeProf.targetChannel);
      supabaseService.setActiveChannel(twitchService.targetChannel);
    }
    if (activeProf.botName) {
      store.set('target_bot', activeProf.botName);
    }
    if (activeProf.telegram) {
      store.set('telegram_bot_token', activeProf.telegram.botToken || '');
      store.set('telegram_chat_id', activeProf.telegram.chatId || '');
      store.set('giveaway_claim_url', activeProf.telegram.claimUrl || '');
    }
    return { success: true, activeProfile: activeProf };
  } catch(e) {
    return { success: false, error: e.message };
  }
});

// YouTube Live Search IPC Handler supporting multiple channel handles / queries
ipcMain.handle('youtube:search', async (event, payload) => {
  let query = '';
  let channelHandles = ['shishawg'];

  if (typeof payload === 'string') {
    query = payload.trim();
  } else if (payload && typeof payload === 'object') {
    query = (payload.query || '').trim();
    if (Array.isArray(payload.channels) && payload.channels.length > 0) {
      channelHandles = payload.channels.map(c => c.replace('@', '').trim()).filter(Boolean);
    }
  }

  if (!query || query.length < 2) return [];

  // Helper function to search for a specific term/channel on YouTube
  const searchSingle = (term, channelBadge) => {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(term)}`;
    return new Promise((resolve) => {
      const req = https.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7'
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const match = data.match(/var ytInitialData = ({.*?});<\/script>/s) || data.match(/ytInitialData\s*=\s*({.*?});/s);
            if (!match) return resolve([]);
            const json = JSON.parse(match[1]);
            const contents = json.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;
            const items = [];
            if (contents) {
              for (const section of contents) {
                const itemSection = section.itemSectionRenderer?.contents;
                if (itemSection) {
                  for (const item of itemSection) {
                    if (item.videoRenderer) {
                      const vr = item.videoRenderer;
                      const canonicalUrl = vr.ownerText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl
                        || vr.longBylineText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl
                        || vr.shortBylineText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl
                        || '';
                      const extractedHandle = canonicalUrl.replace(/^(\/)?@/, '').toLowerCase().trim();
                      const rawOwner = (vr.ownerText?.runs?.[0]?.text || vr.longBylineText?.runs?.[0]?.text || vr.shortBylineText?.runs?.[0]?.text || '').trim();
                      const normalizedOwner = rawOwner.toLowerCase().replace(/[^a-z0-9]/g, '');

                      const isAllowed = channelHandles.length === 0 || channelHandles.some(handle => {
                        const cleanHandle = handle.toLowerCase().replace(/^@/, '').replace(/[^a-z0-9]/g, '').trim();
                        if (!cleanHandle) return false;
                        return (
                          extractedHandle === cleanHandle ||
                          normalizedOwner === cleanHandle ||
                          extractedHandle.includes(cleanHandle) ||
                          normalizedOwner.includes(cleanHandle)
                        );
                      });

                      if (!isAllowed) continue;

                      const videoId = vr.videoId;
                      const title = vr.title?.runs?.[0]?.text || '';
                      const desc = vr.detailedMetadataSnippets?.[0]?.snippetText?.runs?.map(r => r.text).join('') || vr.descriptionSnippet?.runs?.map(r => r.text).join('') || '';
                      const channelName = rawOwner
                        || channelBadge
                        || 'YouTube';
                      const lengthText = vr.lengthText?.simpleText || '';
                      const thumb = vr.thumbnail?.thumbnails?.[0]?.url || `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;

                      items.push({
                        id: videoId,
                        videoId: videoId,
                        title: title,
                        url: `https://youtu.be/${videoId}`,
                        desc: desc,
                        channel: channelName,
                        duration: lengthText,
                        thumb: thumb,
                        category: channelName,
                        isLiveResult: true
                      });
                      if (items.length >= 8) break;
                    }
                  }
                }
                if (items.length >= 8) break;
              }
            }
            resolve(items);
          } catch(err) {
            resolve([]);
          }
        });
      });

      req.on('error', () => resolve([]));
      req.setTimeout(5000, () => {
        req.destroy();
        resolve([]);
      });
    });
  };

  try {
    // Search across all channels in parallel
    const searchPromises = channelHandles.map(ch => searchSingle(`${ch} ${query}`, ch));
    const resultsArrays = await Promise.all(searchPromises);
    const seenIds = new Set();
    const merged = [];

    // Interleave/merge results avoiding duplicates
    for (const arr of resultsArrays) {
      for (const item of arr) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          merged.push(item);
        }
      }
    }
    return merged.slice(0, 15);
  } catch(e) {
    return [];
  }
});

// Mod-Chat IPC Handlers
ipcMain.handle('modchat:get-messages', async () => {
  try {
    const chan = requireAuthorizedActiveChannel();
    if (supabaseService) {
      const msgs = await supabaseService.getModChat(chan);
      return { success: true, messages: msgs || [] };
    }
    const msgs = await dbService.getModChatMessages(chan);
    return { success: true, messages: msgs || [] };
  } catch(e) {
    return { success: false, messages: [], error: e.message };
  }
});

ipcMain.handle('modchat:send-message', async (event, messageObj) => {
  try {
    const chan = requireAuthorizedActiveChannel(messageObj && messageObj.channel);
    const scopedMessage = { ...messageObj, channel: chan };
    if (supabaseService) {
      const msgs = await supabaseService.sendModChatMessage(scopedMessage, chan);
      return { success: true, messages: msgs || [] };
    }
    const msgs = await dbService.sendModChatMessage(scopedMessage, chan);
    return { success: true, messages: msgs || [] };
  } catch(e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('modchat:clear-messages', async () => {
  try {
    const chan = requireAuthorizedActiveChannel();
    if (supabaseService) {
      await supabaseService.clearModChat(chan);
    }
    await dbService.clearModChatMessages(chan);
    return { success: true, messages: [] };
  } catch(e) {
    return { success: false, error: e.message };
  }
});

// 7TV Emotes Cache & IPC Handler
let sevenTvCache = {
  timestamp: 0,
  channel: '',
  emotes: []
};

ipcMain.handle('seventv:get-emotes', async (event, channelLogin = '') => {
  const cleanChan = (channelLogin || '').trim().toLowerCase();
  const now = Date.now();
  if (sevenTvCache.emotes.length > 0 && sevenTvCache.channel === cleanChan && (now - sevenTvCache.timestamp < 30 * 60 * 1000)) {
    return { success: true, emotes: sevenTvCache.emotes, cached: true };
  }

  const emoteMap = new Map();

  const addEmote = (raw) => {
    if (!raw || !raw.name || !raw.id) return;
    const name = raw.name.trim();
    const url = `https://cdn.7tv.app/emote/${raw.id}/1x.webp`;
    emoteMap.set(name, { id: raw.id, name, url });
  };

  try {
    // 1. Fetch Global 7TV Emotes
    try {
      const gRes = await fetch('https://7tv.io/v3/emote-sets/global', {
        headers: { 'User-Agent': 'ShishaWG-Mod-Tool' },
        signal: AbortSignal.timeout(6000)
      });
      if (gRes.ok) {
        const gData = await gRes.json();
        if (Array.isArray(gData?.emotes)) {
          gData.emotes.forEach(addEmote);
        }
      }
    } catch(e) {
      console.warn('[7TV] Global emotes fetch failed:', e.message);
    }

    // 2. Fetch Channel 7TV Emotes
    if (cleanChan) {
      try {
        let twitchUserId = null;
        if (twitchService && typeof twitchService.getUserInfo === 'function') {
          const uInfo = await twitchService.getUserInfo(cleanChan);
          twitchUserId = uInfo?.user?.id || uInfo?.id;
        }

        if (twitchUserId) {
          const cRes = await fetch(`https://7tv.io/v3/users/twitch/${twitchUserId}`, {
            headers: { 'User-Agent': 'ShishaWG-Mod-Tool' },
            signal: AbortSignal.timeout(6000)
          });
          if (cRes.ok) {
            const cData = await cRes.json();
            const setEmotes = cData?.emote_set?.emotes;
            if (Array.isArray(setEmotes)) {
              setEmotes.forEach(addEmote);
            }
          }
        }
      } catch(e) {
        console.warn(`[7TV] Channel emotes fetch for ${cleanChan} failed:`, e.message);
      }
    }

    const emoteList = Array.from(emoteMap.values());
    if (emoteList.length > 0) {
      sevenTvCache = {
        timestamp: now,
        channel: cleanChan,
        emotes: emoteList
      };
      return { success: true, emotes: emoteList };
    } else if (sevenTvCache.emotes.length > 0) {
      return { success: true, emotes: sevenTvCache.emotes, fallback: true };
    }
    return { success: false, emotes: [], error: 'Keine 7TV Emotes geladen' };
  } catch(err) {
    if (sevenTvCache.emotes.length > 0) {
      return { success: true, emotes: sevenTvCache.emotes, fallback: true };
    }
    return { success: false, emotes: [], error: err.message };
  }
});

ipcMain.handle('app:notify-background', async (event, payload = {}) => {
  if (!mainWindow || mainWindow.isDestroyed()) return { success: false };
  if (!mainWindow.isFocused()) mainWindow.flashFrame(true);

  const message = payload && payload.kind === 'modchat' && payload.message
    ? {
        id: String(payload.message.id || '').slice(0, 160),
        senderName: String(payload.message.senderName || 'Mod').replace(/[\r\n]/g, ' ').slice(0, 80),
        text: String(payload.message.text || '').slice(0, 1000),
        timestamp: Number(payload.message.timestamp) || Date.now()
      }
    : null;

  if (message && Notification.isSupported()) {
    const notification = new Notification({
      title: `Neue Mod-Chat-Nachricht von ${message.senderName}`,
      body: message.text,
      silent: true
    });
    activeNativeNotifications.add(notification);
    notification.on('click', () => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send('modchat:notification-clicked', message);
    });
    notification.on('close', () => activeNativeNotifications.delete(notification));
    notification.show();
  }
  return { success: true };
});

// Watchlist IPC Handlers
ipcMain.handle('watchlist:get', async () => {
  try {
    const chan = requireAuthorizedActiveChannel();
    if (supabaseService) {
      const list = await supabaseService.getWatchlist(chan);
      return { success: true, list: list || [] };
    }
    const list = await dbService.getWatchlist(chan);
    return { success: true, list: list || [] };
  } catch(e) {
    return { success: false, list: [] };
  }
});

ipcMain.handle('watchlist:save', async (event, list) => {
  try {
    const chan = requireAuthorizedActiveChannel();
    if (supabaseService && Array.isArray(list)) {
      for (const item of list) {
        await supabaseService.addToWatchlist(item, chan);
      }
    }
    await dbService.saveWatchlist(list, chan);
    return { success: true };
  } catch(e) {
    return { success: false, error: e.message };
  }
});

// Stream Markers (Session Cache)
ipcMain.handle('markers:get', async () => {
  return { success: true, markers: dbService.getStreamMarkers() };
});

ipcMain.handle('markers:save', async (event, markers) => {
  dbService.saveStreamMarkers(markers);
  return { success: true };
});

// Giveaway IPC Handlers
ipcMain.handle('giveaway:start-listener', async (event, { keyword, channel }) => {
  return twitchService.startGiveawayListener(keyword, channel);
});

ipcMain.handle('giveaway:stop-listener', async () => {
  return twitchService.stopGiveawayListener();
});

ipcMain.handle('giveaway:get-winners', async () => {
  try {
    const chan = requireAuthorizedActiveChannel();
    let winners = [];
    if (supabaseService) {
      const sbWinners = await supabaseService.getGiveaways(chan);
      if (Array.isArray(sbWinners) && sbWinners.length > 0) {
        winners = sbWinners;
      }
    }
    if (winners.length === 0) {
      winners = await dbService.getGiveawayWinners(chan);
    }
    return { success: true, winners };
  } catch(e) {
    // Never fall back to local address data when the authorization check failed.
    return { success: false, winners: [], error: e.message };
  }
});

ipcMain.handle('giveaway:save-winner', async (event, winnerObj) => {
  try {
    const chan = requireAuthorizedActiveChannel(winnerObj && winnerObj.channel);
    const scopedWinner = { ...winnerObj, channel: chan };
    if (supabaseService) {
      await supabaseService.saveGiveawayWinner(scopedWinner, chan);
    }
    const winners = await dbService.saveGiveawayWinner(scopedWinner, chan);
    return { success: true, winners };
  } catch(e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('giveaway:update-winner', async (event, { id, updates }) => {
  try {
    const chan = requireAuthorizedActiveChannel(updates && updates.channel);
    const winners = await dbService.updateGiveawayWinner(id, { ...updates, channel: chan }, chan);
    if (supabaseService) {
      const updatedItem = (winners || []).find(w => w.id === id);
      if (updatedItem) {
        await supabaseService.saveGiveawayWinner(updatedItem, chan);
      }
    }
    return { success: true, winners };
  } catch(e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('giveaway:delete-winner', async (event, id) => {
  try {
    const chan = requireAuthorizedActiveChannel();
    if (supabaseService) {
      await supabaseService.deleteGiveawayWinner(id, chan);
    }
    const winners = await dbService.deleteGiveawayWinner(id, chan);
    return { success: true, winners };
  } catch(e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('giveaway:send-telegram', async (event, { text, botToken, chatId }) => {
  try {
    const chan = requireAuthorizedActiveChannel();
    const activeProfileId = store.get('active_profile_id', 'prof_shishawg');
    const profiles = store.get('streamer_profiles', DEFAULT_STREAMER_PROFILES);
    const activeProf = profiles.find(p => p.id === activeProfileId) || profiles[0];

    let remoteCfg = null;
    if (supabaseService) {
      try { remoteCfg = await supabaseService.getTelegramConfig(chan); } catch(e) {}
    }
    if (!remoteCfg && dbService && chan === 'marved') {
      try { remoteCfg = await dbService.getTelegramConfig(); } catch(e) {}
    }

    const profileMatchesChannel = normalizeChannel(activeProf?.targetChannel) === chan;
    const profTg = profileMatchesChannel ? (activeProf?.telegram || {}) : {};
    const legacyToken = chan === 'marved' ? store.get('telegram_bot_token', '') : '';
    const legacyChat = chan === 'marved' ? store.get('telegram_chat_id', '') : '';
    const token = botToken || profTg.botToken || remoteCfg?.botToken || legacyToken;
    const chat = chatId || profTg.chatId || remoteCfg?.chatId || legacyChat;

    if (!token || !chat) {
      return { success: false, error: 'Telegram Bot Token oder Chat-ID fehlt. Bitte im Streamer-Profil hinterlegen.' };
    }
    return await dbService.sendTelegramMessage(text, token, chat);
  } catch(e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('giveaway:get-telegram-config', async () => {
  let chan;
  try {
    chan = requireAuthorizedActiveChannel();
  } catch (e) {
    return { botToken: '', chatId: '', claimUrl: '', success: false, error: e.message };
  }
  const activeProfileId = store.get('active_profile_id', 'prof_shishawg');
  const profiles = store.get('streamer_profiles', DEFAULT_STREAMER_PROFILES);
  const activeProf = profiles.find(p => p.id === activeProfileId) || profiles[0];

  let remoteCfg = null;
  if (supabaseService) {
    try { remoteCfg = await supabaseService.getTelegramConfig(chan); } catch(e) {}
  }
  if (!remoteCfg && dbService && chan === 'marved') {
    try { remoteCfg = await dbService.getTelegramConfig(); } catch(e) {}
  }

  const profileMatchesChannel = normalizeChannel(activeProf?.targetChannel) === chan;
  const profTg = profileMatchesChannel ? (activeProf?.telegram || {}) : {};
  const botToken = profTg.botToken || remoteCfg?.botToken || (chan === 'marved' ? store.get('telegram_bot_token', '') : '');
  const chatId = profTg.chatId || remoteCfg?.chatId || (chan === 'marved' ? store.get('telegram_chat_id', '') : '');
  const claimUrl = profTg.claimUrl || remoteCfg?.claimUrl || 'https://bazztee.github.io/shishawg-mod-setup-tool/claim.html';

  return { botToken, chatId, claimUrl };
});

// Channel Points (Kohle-Stücke) IPC Handlers
ipcMain.handle('channelpoints:start-listener', async (event, { channel, autoChat } = {}) => {
  try {
    const chan = requireAuthorizedActiveChannel(channel);
    return twitchService.startChannelPointsListener(chan, autoChat !== false);
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('channelpoints:stop-listener', async () => {
  return twitchService.stopChannelPointsListener();
});

ipcMain.handle('channelpoints:create-manual-link', async (event, { user, prize, type, channel, postToChat }) => {
  try {
    const chan = requireAuthorizedActiveChannel(channel);
    return twitchService.createManualClaimLink(user, prize, chan, postToChat, type);
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Q&A Fragensammler IPC Handlers
ipcMain.handle('qna:start-listener', async (event, channel) => {
  try {
    const chan = requireAuthorizedActiveChannel(channel);
    return twitchService.startQnAListener(chan);
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('qna:stop-listener', async () => {
  return twitchService.stopQnAListener();
});

ipcMain.handle('qna:get-questions', async (event, channel) => {
  try {
    const chan = requireAuthorizedActiveChannel(channel);
    let questions = await supabaseService.getQnAQuestions(chan);
    if (!questions || questions.length === 0) {
      questions = await dbService.getQnAQuestions(chan);
    }
    return { success: true, questions };
  } catch(e) {
    return { success: false, error: e.message, questions: [] };
  }
});

ipcMain.handle('qna:save-questions', async (event, questions, channel) => {
  try {
    const chan = requireAuthorizedActiveChannel(channel);
    const scopedQuestions = (Array.isArray(questions) ? questions : []).map(q => ({ ...q, channel: chan }));
    await supabaseService.saveAllQnAQuestions(scopedQuestions);
    const saved = await dbService.saveQnAQuestions(scopedQuestions, chan);
    return { success: true, questions: saved };
  } catch(e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('qna:upsert-question', async (event, question) => {
  try {
    const chan = requireAuthorizedActiveChannel(question && question.channel);
    await supabaseService.upsertQnAQuestion({ ...question, channel: chan });
    return { success: true };
  } catch(e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('qna:delete-question', async (event, questionId) => {
  try {
    const chan = requireAuthorizedActiveChannel();
    await supabaseService.deleteQnAQuestion(questionId, chan);
    await dbService.deleteQnAQuestion(questionId, chan);
    return { success: true };
  } catch(e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('qna:delete-all-questions', async (event, channel) => {
  try {
    const chan = requireAuthorizedActiveChannel(channel);
    await supabaseService.deleteAllQnAQuestions(chan);
    await dbService.deleteAllQnAQuestions(chan);
    return { success: true };
  } catch(e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('qna:clear-answered-questions', async (event, channel) => {
  try {
    const chan = requireAuthorizedActiveChannel(channel);
    await supabaseService.deleteAnsweredQnAQuestions(chan);
    await dbService.deleteAnsweredQnAQuestions(chan);
    return { success: true };
  } catch(e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('qna:get-active', async (event, channel) => {
  try {
    const chan = requireAuthorizedActiveChannel(channel);
    let active = await supabaseService.getActiveQnAQuestion(chan);
    if (!active) {
      active = await dbService.getActiveQnAQuestion(chan);
    }
    return { success: true, active };
  } catch(e) {
    return { success: false, error: e.message, active: null };
  }
});

ipcMain.handle('qna:set-active', async (event, activeObj, channel) => {
  try {
    const chan = requireAuthorizedActiveChannel(channel);
    await supabaseService.setActiveQnAQuestion(chan, activeObj);
    const active = await dbService.setActiveQnAQuestion(activeObj, chan);
    return { success: true, active };
  } catch(e) {
    return { success: false, error: e.message };
  }
});

// Q&A Settings (Persons list, Wheel toggle)
ipcMain.handle('qna:get-settings', async (event, channel) => {
  try {
    const chan = requireAuthorizedActiveChannel(channel);
    const settings = await supabaseService.getQnASettings(chan);
    return { success: true, settings };
  } catch(e) {
    return { success: false, error: e.message, settings: null };
  }
});

ipcMain.handle('qna:save-settings', async (event, channel, settings) => {
  try {
    const chan = requireAuthorizedActiveChannel(channel);
    const saved = await supabaseService.saveQnASettings(chan, settings);
    return { success: true, settings: saved };
  } catch(e) {
    return { success: false, error: e.message };
  }
});

// Bestrafungen (Punishments / Challenges)
ipcMain.handle('bestrafungen:get', async () => {
  try {
    const chan = requireAuthorizedActiveChannel();
    const list = await supabaseService.getBestrafungen(chan);
    return { success: true, bestrafungen: list };
  } catch(e) {
    return { success: false, error: e.message, bestrafungen: [] };
  }
});

ipcMain.handle('bestrafungen:save', async (event, bestrafung) => {
  try {
    const chan = requireAuthorizedActiveChannel(bestrafung && bestrafung.channel);
    const saved = await supabaseService.saveBestrafung({ ...bestrafung, channel: chan }, chan);
    return { success: true, bestrafung: saved };
  } catch(e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('bestrafungen:update-status', async (event, id, status) => {
  try {
    const chan = requireAuthorizedActiveChannel();
    const updated = await supabaseService.updateBestrafungStatus(id, status, null, chan);
    return { success: true, updated };
  } catch(e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('bestrafungen:delete', async (event, id) => {
  try {
    const chan = requireAuthorizedActiveChannel();
    const deleted = await supabaseService.deleteBestrafung(id, chan);
    return { success: true, deleted };
  } catch(e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('qna:delete-all', async (event, channel) => {
  try {
    const chan = requireAuthorizedActiveChannel(channel);
    const questions = await supabaseService.getQnAQuestions(chan);
    for (const q of questions) {
      await supabaseService.deleteQnAQuestion(q.id, chan);
    }
    await dbService.saveQnAQuestions([], chan);
    await dbService.setActiveQnAQuestion(null, chan);
    return { success: true };
  } catch(e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('qna:delete-duplicates', async (event, channel) => {
  try {
    const chan = requireAuthorizedActiveChannel(channel);
    const questions = await supabaseService.getQnAQuestions(chan);
    const seen = new Set();
    let deletedCount = 0;
    for (const q of questions) {
      const key = `${(q.login || '').toLowerCase()}:${(q.question || '').trim().toLowerCase()}`;
      if (seen.has(key)) {
        await supabaseService.deleteQnAQuestion(q.id, chan);
        deletedCount++;
      } else {
        seen.add(key);
      }
    }
    return { success: true, deletedCount };
  } catch(e) {
    return { success: false, error: e.message };
  }
});

// Twitch Polls & Vorlagen IPC Handlers
ipcMain.handle('polls:create', async (event, { title, choices, duration, channelPointsVoting, channelPointsPerVote, channel }) => {
  try {
    const chan = requireAuthorizedActiveChannel(channel);
    const res = await twitchService.createPoll(title, choices, duration, channelPointsVoting, channelPointsPerVote, chan);
    return { success: true, poll: res.poll };
  } catch(e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('polls:get-active', async (event, channel) => {
  try {
    const chan = requireAuthorizedActiveChannel(channel);
    const poll = await twitchService.getActivePoll(chan);
    return { success: true, poll };
  } catch(e) {
    return { success: false, error: e.message, poll: null };
  }
});

ipcMain.handle('polls:end', async (event, { pollId, status, channel }) => {
  try {
    const chan = requireAuthorizedActiveChannel(channel);
    const res = await twitchService.endPoll(pollId, status, chan);
    return { success: true, poll: res.poll };
  } catch(e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('polls:get-templates', async () => {
  try {
    const templates = await dbService.getPollTemplates();
    return { success: true, templates };
  } catch(e) {
    return { success: false, error: e.message, templates: [] };
  }
});

ipcMain.handle('polls:save-templates', async (event, templates) => {
  try {
    const saved = await dbService.savePollTemplates(templates);
    return { success: true, templates: saved };
  } catch(e) {
    return { success: false, error: e.message };
  }
});

// Twitch Predictions IPC Handlers
ipcMain.handle('predictions:create', async (event, { title, outcomes, duration, channel }) => {
  try {
    const chan = requireAuthorizedActiveChannel(channel);
    const res = await twitchService.createTwitchPrediction({ title, outcomes, duration, channel: chan });
    return { success: true, prediction: res.prediction };
  } catch(e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('predictions:get-active', async (event, channel) => {
  try {
    const chan = requireAuthorizedActiveChannel(channel);
    const prediction = await twitchService.getActivePrediction(chan);
    return { success: true, prediction };
  } catch(e) {
    return { success: false, error: e.message, prediction: null };
  }
});

ipcMain.handle('predictions:end', async (event, { predictionId, status, winningOutcomeId, channel }) => {
  try {
    const chan = requireAuthorizedActiveChannel(channel);
    const res = await twitchService.endPrediction(predictionId, status, winningOutcomeId, chan);
    return { success: true, prediction: res.prediction };
  } catch(e) {
    return { success: false, error: e.message };
  }
});

// Stats & Kohle-Timer IPC Handlers
ipcMain.handle('stats:get-sessions', async (event, channel) => {
  try {
    const chan = requireAuthorizedActiveChannel(channel);
    let sessions = await supabaseService.getShishaSessions(chan);
    if (!sessions || sessions.length === 0) {
      sessions = await dbService.getShishaSessions(chan);
    }
    return { success: true, sessions: sessions || [] };
  } catch(e) {
    return { success: false, error: e.message, sessions: [] };
  }
});

ipcMain.handle('stats:save-session', async (event, session) => {
  try {
    const chan = requireAuthorizedActiveChannel(session && session.channel);
    const scopedSession = { ...session, channel: chan };
    const cloudResult = await supabaseService.saveShishaSession(scopedSession);
    const localSessions = await dbService.getShishaSessions(chan);
    const idx = localSessions.findIndex(s => s.id === scopedSession.id);
    if (idx >= 0) {
      localSessions[idx] = scopedSession;
    } else {
      localSessions.unshift(scopedSession);
    }
    await dbService.saveShishaSessions(localSessions, chan);
    if (!cloudResult || !cloudResult.success) {
      return {
        success: false,
        localSaved: true,
        cloudSynced: false,
        error: `Online-Datenbank konnte nicht aktualisiert werden: ${cloudResult?.error || 'Unbekannter Fehler'}`
      };
    }
    return { success: true, session: cloudResult.session, localSaved: true, cloudSynced: true };
  } catch(e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('stats:delete-session', async (event, id) => {
  try {
    const chan = requireAuthorizedActiveChannel();
    await supabaseService.deleteShishaSession(id, chan);
    const localSessions = await dbService.getShishaSessions(chan);
    const filtered = localSessions.filter(s => s.id !== id);
    await dbService.saveShishaSessions(filtered, chan);
    return { success: true };
  } catch(e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('stats:get-timer-state', async (event, channel) => {
  try {
    const chan = requireAuthorizedActiveChannel(channel);
    let timerState = await supabaseService.getActiveTimerState(chan);
    if (!timerState) {
      timerState = await dbService.getActiveTimerState(chan);
    }
    return { success: true, timerState };
  } catch(e) {
    return { success: false, error: e.message, timerState: null };
  }
});

ipcMain.handle('stats:save-timer-state', async (event, { channel, timerState }) => {
  try {
    const chan = requireAuthorizedActiveChannel(channel);
    await supabaseService.saveActiveTimerState(chan, timerState);
    await dbService.saveActiveTimerState(timerState, chan);
    return { success: true };
  } catch(e) {
    return { success: false, error: e.message };
  }
});

// IPC Handlers for Database
ipcMain.handle('db:get-catalog', async () => {
  if (supabaseService) {
    try {
      const remote = await supabaseService.getCatalog();
      if (remote && Object.keys(remote).length > 0) {
        dbService.mergeRemoteCatalog(remote);
      }
    } catch(e) {
      console.warn('Failed to fetch remote catalog on db:get-catalog:', e.message);
    }
  }
  return dbService.getCatalog();
});

ipcMain.handle('db:add-item', async (event, { category, item }) => {
  const res = dbService.addItem(category, item);
  const updatedCatalog = dbService.getCatalog();

  if (res && supabaseService) {
    try {
      const catKey = (category === 'customTobacco') ? 'tobacco' : category;
      const itemsToSync = (catKey === 'tobacco')
        ? (updatedCatalog.customTobacco || [])
        : (updatedCatalog[catKey] || []);
      await supabaseService.saveCatalogCategory(catKey, itemsToSync);
    } catch(e) {
      console.warn('Failed to sync added item to Supabase:', e.message);
    }
  }

  return { success: res, catalog: updatedCatalog };
});

ipcMain.handle('db:remove-item', async (event, { category, item }) => {
  const res = dbService.removeItem(category, item);
  const updatedCatalog = dbService.getCatalog();

  if (res && supabaseService) {
    try {
      const catKey = (category === 'customTobacco') ? 'tobacco' : category;
      const itemsToSync = (catKey === 'tobacco')
        ? (updatedCatalog.customTobacco || [])
        : (updatedCatalog[catKey] || []);
      await supabaseService.saveCatalogCategory(catKey, itemsToSync);
    } catch(e) {
      console.warn('Failed to sync removed item to Supabase:', e.message);
    }
  }

  return { success: res, catalog: updatedCatalog };
});

ipcMain.handle('db:edit-item', async (event, { category, oldItem, newItem }) => {
  const res = dbService.editItem(category, oldItem, newItem);
  const updatedCatalog = dbService.getCatalog();

  if (res && supabaseService) {
    try {
      const catKey = (category === 'customTobacco') ? 'tobacco' : category;
      const itemsToSync = (catKey === 'tobacco')
        ? (updatedCatalog.customTobacco || [])
        : (updatedCatalog[catKey] || []);
      await supabaseService.saveCatalogCategory(catKey, itemsToSync);
    } catch(e) {
      console.warn('Failed to sync edited item to Supabase:', e.message);
    }
  }

  return { success: res, catalog: updatedCatalog };
});

ipcMain.handle('db:auto-learn', async (event, setupData) => {
  const res = dbService.autoLearnSetup(setupData);
  if (res && res.addedCount > 0 && supabaseService) {
    try {
      const catalog = dbService.getCatalog();
      for (const cat of ['pipes', 'bowls', 'vases', 'hmds', 'charcoal', 'persons']) {
        if (catalog[cat]) {
          await supabaseService.saveCatalogCategory(cat, catalog[cat]);
        }
      }
      if (catalog.customTobacco) {
        await supabaseService.saveCatalogCategory('tobacco', catalog.customTobacco);
      }
    } catch(e) {
      console.warn('Failed to sync auto-learned items to Supabase:', e.message);
    }
  }
  return { success: true, ...res };
});

ipcMain.handle('db:sync-cloud', async () => {
  try {
    let hookahTobacco = [];
    if (dbService) {
      hookahTobacco = await dbService.fetchHookahToolsTobacco(true);
    }
    if (supabaseService) {
      const remoteCatalog = await supabaseService.getCatalog();
      if (remoteCatalog && Object.keys(remoteCatalog).length > 0) {
        dbService.mergeRemoteCatalog(remoteCatalog);
      }
    }
    const fullCatalog = dbService.getCatalog();
    return {
      success: true,
      hookahTobaccoCount: fullCatalog.hookahTobacco?.length || 0,
      catalog: fullCatalog
    };
  } catch(e) {
    return { success: false, error: e.message };
  }
});

// IPC Handlers for Auto-Updater
ipcMain.handle('updater:check', async () => {
  try {
    const result = await autoUpdater.checkForUpdates();
    return { success: true, result };
  } catch (err) {
    const errMsg = err ? (err.message || String(err)) : '';
    if (errMsg.includes('app-update.yml') || errMsg.includes('ENOENT')) {
      return { success: false, error: 'Keine Update-Konfiguration verfügbar' };
    }
    return { success: false, error: errMsg };
  }
});

ipcMain.handle('updater:download', async () => {
  try {
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('updater:install', async () => {
  autoUpdater.quitAndInstall(false, true);
  return { success: true };
});

ipcMain.handle('app:get-version', () => {
  return app.getVersion();
});

ipcMain.handle('app:get-release-notes', () => {
  const version = app.getVersion();
  const lastSeenVersion = store ? store.get('last_seen_release_notes_version', '') : '';
  return resolveReleaseNotes(version, releaseNotes, lastSeenVersion);
});

ipcMain.handle('app:mark-release-notes-seen', (event, version) => {
  const currentVersion = app.getVersion();
  if (!store || version !== currentVersion) {
    return { success: false, error: 'Ungültige Versionsangabe.' };
  }
  try {
    store.set('last_seen_release_notes_version', currentVersion);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('app:copy-clipboard', async (event, text) => {
  clipboard.writeText(text);
  return { success: true };
});

ipcMain.handle('app:open-external', async (event, url) => {
  return openWebLink(shell, url);
});

ipcMain.handle('app:send-trello-card', async (event, payload) => {
  try {
    return await trelloService.createChangeRequestCard(payload);
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// OBS Overlay Server & Export
function startObsServer() {
  if (obsServer) return;
  const PORT = runtime.obsPort;

  obsServer = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    const url = req.url.split('?')[0];

    if (url === '/setup.json' || url === '/api/setup') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(latestLiveSetup));
      return;
    }

    if (url === '/current_setup.txt' || url === '/text') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(latestLiveSetup.commandText || '');
      return;
    }

    if (url === '/api/qna/active') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      const localFile = path.join(app.getPath('userData'), 'qna_active.json');
      let active = null;
      try {
        if (fs.existsSync(localFile)) {
          const raw = JSON.parse(fs.readFileSync(localFile, 'utf-8'));
          active = (raw && typeof raw === 'object' && 'active' in raw) ? raw.active : raw;
        }
      } catch(e) {}
      res.end(JSON.stringify({ active, updatedAt: Date.now() }));
      return;
    }

    if (url === '/api/qna/questions') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      const localFile = path.join(app.getPath('userData'), 'qna_questions.json');
      let questions = [];
      try {
        if (fs.existsSync(localFile)) {
          questions = JSON.parse(fs.readFileSync(localFile, 'utf-8'));
        }
      } catch(e) {}
      res.end(JSON.stringify(questions));
      return;
    }

    if (url === '/qna' || url === '/qna.html' || url === '/prompter') {
      const qnaPath = path.join(__dirname, '../../docs/qna.html');
      if (fs.existsSync(qnaPath)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(fs.readFileSync(qnaPath, 'utf-8'));
        return;
      }
    }

    // Default: Return the HUD Overlay HTML
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(getOverlayHtml());
  });

  obsServer.listen(PORT, '127.0.0.1', () => {
    console.log(`OBS Overlay Server running at http://127.0.0.1:${PORT}/overlay`);
  });

  obsServer.on('error', (err) => {
    console.log('OBS Server error (port likely in use):', err.message);
    const sendNotify = () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('app:notify', {
          type: 'error',
          message: '⚠️ OBS-Server konnte Port ' + runtime.obsPort + ' nicht belegen. ' +
                   'Läuft das Tool bereits? OBS-Overlay nicht verfügbar.'
        });
      }
    };
    if (mainWindow && mainWindow.webContents.isLoading()) {
      mainWindow.webContents.once('did-finish-load', sendNotify);
    } else {
      sendNotify();
    }
  });
}

function getOverlayHtml() {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>ShishaWG Stream Overlay</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: transparent;
      font-family: 'Outfit', -apple-system, sans-serif;
      overflow: hidden;
      padding: 16px;
    }
    .hud-card {
      display: inline-flex;
      flex-direction: column;
      background: rgba(10, 15, 29, 0.88);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(0, 240, 255, 0.25);
      border-left: 4px solid #00f0ff;
      border-radius: 12px;
      padding: 12px 18px;
      color: #ffffff;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6), 0 0 20px rgba(0, 240, 255, 0.15);
      max-width: 650px;
      transition: all 0.3s ease;
    }
    .hud-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
    }
    .hud-badge {
      background: linear-gradient(135deg, #00f0ff, #7928ca);
      color: #ffffff;
      font-size: 11px;
      font-weight: 800;
      padding: 2px 7px;
      border-radius: 4px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .hud-title {
      font-size: 13px;
      font-weight: 700;
      color: #94a3b8;
      letter-spacing: 0.5px;
    }
    .hud-content {
      font-size: 15px;
      font-weight: 600;
      line-height: 1.4;
      color: #f8fafc;
    }
    .hud-highlight {
      color: #00f0ff;
      font-weight: 700;
    }
    .hud-kohle {
      color: #a855f7;
      font-weight: 700;
    }
  </style>
</head>
<body>
  <div class="hud-card" id="hud-card">
    <div class="hud-header">
      <span class="hud-badge">💨 STREAM SETUP</span>
      <span class="hud-title">ShishaWG Live</span>
    </div>
    <div class="hud-content" id="hud-text">Lade Setup...</div>
  </div>

  <script>
    let lastText = '';
    async function fetchSetup() {
      try {
        const res = await fetch('/setup.json?' + Date.now());
        if (res.ok) {
          const data = await res.json();
          let raw = (data.commandText || '').replace(/^!setup\\s+/i, '').replace(/^!editsetup\\s+/i, '');
          if (raw !== lastText) {
            lastText = raw;
            const el = document.getElementById('hud-text');
            // Highlight names and keywords
            let formatted = raw
              .replace(/(\\b[A-Za-z0-9äöüÄÖÜß-]+:)/g, '<span class="hud-highlight">$1</span>')
              .replace(/(\\!(?:kohle|xkah|hookain|almassiva|shaman|blackcoco)[a-zA-Z0-9_-]*)/g, '<span class="hud-kohle">$1</span>');
            el.innerHTML = formatted;
          }
        }
      } catch(e) {}
    }
    fetchSetup();
    setInterval(fetchSetup, 2500);
  </script>
</body>
</html>`;
}


ipcMain.handle('obs:publish-setup', async (event, setupPayload) => {
  latestLiveSetup = {
    updatedAt: new Date().toISOString(),
    ...setupPayload
  };

  // Write local current_setup.txt file
  const textFilePath = path.join(app.getPath('userData'), 'current_setup.txt');
  try {
    fs.writeFileSync(textFilePath, setupPayload.commandText || '', 'utf-8');
  } catch(e) {}

  return {
    success: true,
    localUrl: `http://localhost:${runtime.obsPort}/overlay`,
    textFilePath
  };
});

ipcMain.handle('obs:get-info', async () => {
  const textFilePath = path.join(app.getPath('userData'), 'current_setup.txt');
  return {
    localUrl: `http://localhost:${runtime.obsPort}/overlay`,
    textFilePath
  };
});
