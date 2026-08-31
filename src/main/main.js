const { app, BrowserWindow, ipcMain, clipboard, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const TwitchService = require('./twitchService');
const DatabaseService = require('./dbService');
const supabaseService = require('./supabaseService');

// State for Live OBS Overlay
let latestLiveSetup = {
  commandText: '!setup Aktuell wird kein Setup geraucht',
  persons: [],
  kohle: '',
  extra: '',
  updatedAt: new Date().toISOString()
};
let obsServer = null;

// Simple File Store fallback for settings
class SimpleStore {
  constructor() {
    this.path = path.join(app.getPath('userData'), 'app_settings.json');
    this.data = {};
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.path)) {
        this.data = JSON.parse(fs.readFileSync(this.path, 'utf-8'));
      }
    } catch(e) {
      this.data = {};
    }
  }

  save() {
    try {
      fs.writeFileSync(this.path, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch(e) {}
  }

  get(key, defaultValue) {
    return this.data[key] !== undefined ? this.data[key] : defaultValue;
  }

  set(key, value) {
    this.data[key] = value;
    this.save();
  }

  delete(key) {
    delete this.data[key];
    this.save();
  }
}

let mainWindow = null;
let store = null;
let twitchService = null;
let dbService = null;

function createWindow() {
  store = new SimpleStore();
  dbService = new DatabaseService();

  const savedGistToken = store.get('gist_pat', '');
  if (savedGistToken) DatabaseService.setGistToken(savedGistToken);

  const iconPath = path.join(__dirname, '../../build/icon.ico');
  const iconExists = fs.existsSync(iconPath);

  mainWindow = new BrowserWindow({
    width: 1240,
    height: 940,
    minWidth: 960,
    minHeight: 700,
    title: 'ShishaWG Mod Setup Tool',
    icon: iconExists ? iconPath : undefined,
    backgroundColor: '#0b0f17',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    autoHideMenuBar: true
  });

  supabaseService.setMainWindow(mainWindow);
  supabaseService.initRealtimeListeners();

  twitchService = new TwitchService(mainWindow, store);

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

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
  return { success: true, channel: twitchService.targetChannel };
});

ipcMain.handle('twitch:send-chat', async (event, payload) => {
  try {
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
  return await twitchService.fetchUserChatColor();
});

ipcMain.handle('twitch:set-color', async (event, color) => {
  if (color && twitchService.user) {
    twitchService.user.color = color;
    store.set('twitch_user', twitchService.user);
    store.set('twitch_user_color', color);
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
      { shop: 'HookahFloW', code: 'SHISHAWG10', desc: '10% Rabatt' },
      { shop: 'Moze', code: 'SHISHAWG', desc: 'Rabattcode' }
    ],
    telegram: {
      botToken: '',
      chatId: '',
      claimUrl: 'https://bazztee.github.io/shishawg-mod-setup-tool/claim.html'
    },
    isDefault: true
  }
];

ipcMain.handle('profiles:get-all', async () => {
  try {
    let profiles = store.get('streamer_profiles', DEFAULT_STREAMER_PROFILES);
    const activeId = store.get('active_profile_id', profiles[0]?.id || 'prof_shishawg');

    // Auto-fetch Telegram config from Supabase / Gist / Store if empty
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
                      const videoId = vr.videoId;
                      const title = vr.title?.runs?.[0]?.text || '';
                      const desc = vr.detailedMetadataSnippets?.[0]?.snippetText?.runs?.map(r => r.text).join('') || vr.descriptionSnippet?.runs?.map(r => r.text).join('') || '';
                      const channelName = vr.ownerText?.runs?.[0]?.text || '';
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
                        category: channelBadge || channelName || 'YouTube',
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
    if (supabaseService) {
      const msgs = await supabaseService.getModChat();
      return { success: true, messages: msgs || [] };
    }
    const msgs = await dbService.getModChatMessages();
    return { success: true, messages: msgs || [] };
  } catch(e) {
    return { success: false, messages: [], error: e.message };
  }
});

ipcMain.handle('modchat:send-message', async (event, messageObj) => {
  try {
    if (supabaseService) {
      const msgs = await supabaseService.sendModChatMessage(messageObj);
      return { success: true, messages: msgs || [] };
    }
    const msgs = await dbService.sendModChatMessage(messageObj);
    return { success: true, messages: msgs || [] };
  } catch(e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('modchat:clear-messages', async () => {
  try {
    if (supabaseService) {
      await supabaseService.clearModChat();
    }
    await dbService.clearModChatMessages();
    return { success: true, messages: [] };
  } catch(e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('app:notify-background', async () => {
  if (mainWindow && !mainWindow.isFocused()) {
    mainWindow.flashFrame(true);
  }
  return true;
});

// Watchlist IPC Handlers
ipcMain.handle('watchlist:get', async () => {
  try {
    if (supabaseService) {
      const list = await supabaseService.getWatchlist();
      return { success: true, list: list || [] };
    }
    const list = await dbService.getWatchlist();
    return { success: true, list: list || [] };
  } catch(e) {
    return { success: false, list: [] };
  }
});

ipcMain.handle('watchlist:save', async (event, list) => {
  try {
    if (supabaseService && Array.isArray(list)) {
      for (const item of list) {
        await supabaseService.addToWatchlist(item);
      }
    }
    await dbService.saveWatchlist(list);
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
    const chan = (twitchService ? twitchService.targetChannel : 'marved') || 'marved';
    let winners = [];
    if (supabaseService) {
      const sbWinners = await supabaseService.getGiveaways(chan);
      if (Array.isArray(sbWinners) && sbWinners.length > 0) {
        winners = sbWinners;
      }
    }
    if (winners.length === 0) {
      winners = await dbService.getGiveawayWinners();
    }
    return { success: true, winners };
  } catch(e) {
    try {
      const fallback = await dbService.getGiveawayWinners();
      return { success: true, winners: fallback };
    } catch(err) {
      return { success: false, winners: [], error: e.message };
    }
  }
});

ipcMain.handle('giveaway:save-winner', async (event, winnerObj) => {
  try {
    const chan = (twitchService ? twitchService.targetChannel : 'marved') || 'marved';
    if (supabaseService) {
      await supabaseService.saveGiveawayWinner(winnerObj, winnerObj.channel || chan);
    }
    const winners = await dbService.saveGiveawayWinner(winnerObj);
    return { success: true, winners };
  } catch(e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('giveaway:update-winner', async (event, { id, updates }) => {
  try {
    const chan = (twitchService ? twitchService.targetChannel : 'marved') || 'marved';
    const winners = await dbService.updateGiveawayWinner(id, updates);
    if (supabaseService) {
      const updatedItem = (winners || []).find(w => w.id === id);
      if (updatedItem) {
        await supabaseService.saveGiveawayWinner(updatedItem, updatedItem.channel || chan);
      }
    }
    return { success: true, winners };
  } catch(e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('giveaway:delete-winner', async (event, id) => {
  try {
    if (supabaseService) {
      await supabaseService.deleteGiveawayWinner(id);
    }
    const winners = await dbService.deleteGiveawayWinner(id);
    return { success: true, winners };
  } catch(e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('giveaway:send-telegram', async (event, { text, botToken, chatId }) => {
  try {
    const cfg = await dbService.getTelegramConfig();
    const token = botToken || cfg.botToken || store.get('telegram_bot_token', '');
    const chat = chatId || cfg.chatId || store.get('telegram_chat_id', '');
    if (!token || !chat) {
      return { success: false, error: 'Telegram Bot Token oder Chat-ID nicht konfiguriert. Bitte in den Einstellungen hinterlegen.' };
    }
    return await dbService.sendTelegramMessage(text, token, chat);
  } catch(e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('giveaway:save-telegram-config', async (event, { botToken, chatId, claimUrl }) => {
  const cleanToken = (botToken || '').trim();
  const cleanChat = (chatId || '').trim();
  const cleanClaimUrl = (claimUrl || '').trim();
  store.set('telegram_bot_token', cleanToken);
  store.set('telegram_chat_id', cleanChat);
  store.set('giveaway_claim_url', cleanClaimUrl);
  await dbService.saveTelegramConfig({ botToken: cleanToken, chatId: cleanChat, claimUrl: cleanClaimUrl });
  return { success: true };
});

ipcMain.handle('giveaway:get-telegram-config', async () => {
  const cfg = await dbService.getTelegramConfig();
  const botToken = cfg.botToken || store.get('telegram_bot_token', '');
  const chatId = cfg.chatId || store.get('telegram_chat_id', '');
  const claimUrl = cfg.claimUrl || store.get('giveaway_claim_url', '');
  return { botToken, chatId, claimUrl };
});

// Channel Points (Kohle-Stücke) IPC Handlers
ipcMain.handle('channelpoints:start-listener', async (event, { channel, autoChat } = {}) => {
  const chan = channel || (twitchService ? twitchService.targetChannel : 'marved');
  return twitchService.startChannelPointsListener(chan, autoChat !== false);
});

ipcMain.handle('channelpoints:stop-listener', async () => {
  return twitchService.stopChannelPointsListener();
});

ipcMain.handle('channelpoints:create-manual-link', async (event, { user, prize, channel, postToChat }) => {
  const chan = channel || (twitchService ? twitchService.targetChannel : 'marved');
  return twitchService.createManualClaimLink(user, prize, chan, postToChat);
});

// Q&A Fragensammler IPC Handlers
ipcMain.handle('qna:start-listener', async (event, channel) => {
  return twitchService.startQnAListener(channel);
});

ipcMain.handle('qna:stop-listener', async () => {
  return twitchService.stopQnAListener();
});

ipcMain.handle('qna:get-questions', async (event, channel) => {
  try {
    const chan = channel || (twitchService ? twitchService.targetChannel : 'marved');
    let questions = await supabaseService.getQnAQuestions(chan);
    if (!questions || questions.length === 0) {
      questions = await dbService.getQnAQuestions();
    }
    return { success: true, questions };
  } catch(e) {
    return { success: false, error: e.message, questions: [] };
  }
});

ipcMain.handle('qna:save-questions', async (event, questions) => {
  try {
    await supabaseService.saveAllQnAQuestions(questions);
    const saved = await dbService.saveQnAQuestions(questions);
    return { success: true, questions: saved };
  } catch(e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('qna:upsert-question', async (event, question) => {
  try {
    await supabaseService.upsertQnAQuestion(question);
    return { success: true };
  } catch(e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('qna:delete-question', async (event, questionId) => {
  try {
    await supabaseService.deleteQnAQuestion(questionId);
    await dbService.deleteQnAQuestion(questionId);
    return { success: true };
  } catch(e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('qna:delete-all-questions', async (event, channel) => {
  try {
    const chan = channel || (twitchService ? twitchService.targetChannel : 'marved');
    await supabaseService.deleteAllQnAQuestions(chan);
    await dbService.deleteAllQnAQuestions(chan);
    return { success: true };
  } catch(e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('qna:clear-answered-questions', async (event, channel) => {
  try {
    const chan = channel || (twitchService ? twitchService.targetChannel : 'marved');
    await supabaseService.deleteAnsweredQnAQuestions(chan);
    await dbService.deleteAnsweredQnAQuestions(chan);
    return { success: true };
  } catch(e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('qna:get-active', async (event, channel) => {
  try {
    const chan = channel || (twitchService ? twitchService.targetChannel : 'marved');
    let active = await supabaseService.getActiveQnAQuestion(chan);
    if (!active) {
      active = await dbService.getActiveQnAQuestion();
    }
    return { success: true, active };
  } catch(e) {
    return { success: false, error: e.message, active: null };
  }
});

ipcMain.handle('qna:set-active', async (event, activeObj, channel) => {
  try {
    const chan = channel || (twitchService ? twitchService.targetChannel : 'marved');
    await supabaseService.setActiveQnAQuestion(chan, activeObj);
    const active = await dbService.setActiveQnAQuestion(activeObj);
    return { success: true, active };
  } catch(e) {
    return { success: false, error: e.message };
  }
});

// Q&A Settings (Persons list, Wheel toggle)
ipcMain.handle('qna:get-settings', async (event, channel) => {
  try {
    const chan = channel || (twitchService ? twitchService.targetChannel : 'marved');
    const settings = await supabaseService.getQnASettings(chan);
    return { success: true, settings };
  } catch(e) {
    return { success: false, error: e.message, settings: null };
  }
});

ipcMain.handle('qna:save-settings', async (event, channel, settings) => {
  try {
    const chan = channel || (twitchService ? twitchService.targetChannel : 'marved');
    const saved = await supabaseService.saveQnASettings(chan, settings);
    return { success: true, settings: saved };
  } catch(e) {
    return { success: false, error: e.message };
  }
});

// Bestrafungen (Punishments / Challenges)
ipcMain.handle('bestrafungen:get', async () => {
  try {
    const list = await supabaseService.getBestrafungen();
    return { success: true, bestrafungen: list };
  } catch(e) {
    return { success: false, error: e.message, bestrafungen: [] };
  }
});

ipcMain.handle('bestrafungen:save', async (event, bestrafung) => {
  try {
    const saved = await supabaseService.saveBestrafung(bestrafung);
    return { success: true, bestrafung: saved };
  } catch(e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('bestrafungen:update-status', async (event, id, status) => {
  try {
    const updated = await supabaseService.updateBestrafungStatus(id, status);
    return { success: true, updated };
  } catch(e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('bestrafungen:delete', async (event, id) => {
  try {
    const deleted = await supabaseService.deleteBestrafung(id);
    return { success: true, deleted };
  } catch(e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('qna:delete-all', async (event, channel) => {
  try {
    const chan = channel || (twitchService ? twitchService.targetChannel : 'marved');
    const questions = await supabaseService.getQnAQuestions(chan);
    for (const q of questions) {
      await supabaseService.deleteQnAQuestion(q.id);
    }
    await dbService.saveQnAQuestions([]);
    await dbService.setActiveQnAQuestion(null);
    return { success: true };
  } catch(e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('qna:delete-duplicates', async (event, channel) => {
  try {
    const chan = channel || (twitchService ? twitchService.targetChannel : 'marved');
    const questions = await supabaseService.getQnAQuestions(chan);
    const seen = new Set();
    let deletedCount = 0;
    for (const q of questions) {
      const key = `${(q.login || '').toLowerCase()}:${(q.question || '').trim().toLowerCase()}`;
      if (seen.has(key)) {
        await supabaseService.deleteQnAQuestion(q.id);
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
    const res = await twitchService.createPoll(title, choices, duration, channelPointsVoting, channelPointsPerVote, channel);
    return { success: true, poll: res.poll };
  } catch(e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('polls:get-active', async (event, channel) => {
  try {
    const poll = await twitchService.getActivePoll(channel);
    return { success: true, poll };
  } catch(e) {
    return { success: false, error: e.message, poll: null };
  }
});

ipcMain.handle('polls:end', async (event, { pollId, status, channel }) => {
  try {
    const res = await twitchService.endPoll(pollId, status, channel);
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
    const res = await twitchService.createTwitchPrediction({ title, outcomes, duration, channel });
    return { success: true, prediction: res.prediction };
  } catch(e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('predictions:get-active', async (event, channel) => {
  try {
    const prediction = await twitchService.getActivePrediction(channel);
    return { success: true, prediction };
  } catch(e) {
    return { success: false, error: e.message, prediction: null };
  }
});

ipcMain.handle('predictions:end', async (event, { predictionId, status, winningOutcomeId, channel }) => {
  try {
    const res = await twitchService.endPrediction(predictionId, status, winningOutcomeId, channel);
    return { success: true, prediction: res.prediction };
  } catch(e) {
    return { success: false, error: e.message };
  }
});

// Stats & Kohle-Timer IPC Handlers
ipcMain.handle('stats:get-sessions', async (event, channel) => {
  try {
    const chan = channel || (twitchService ? twitchService.targetChannel : 'marved');
    let sessions = await supabaseService.getShishaSessions(chan);
    if (!sessions || sessions.length === 0) {
      sessions = await dbService.getShishaSessions();
    }
    return { success: true, sessions: sessions || [] };
  } catch(e) {
    return { success: false, error: e.message, sessions: [] };
  }
});

ipcMain.handle('stats:save-session', async (event, session) => {
  try {
    const savedSupabase = await supabaseService.saveShishaSession(session);
    const localSessions = await dbService.getShishaSessions();
    const idx = localSessions.findIndex(s => s.id === session.id);
    if (idx >= 0) {
      localSessions[idx] = session;
    } else {
      localSessions.unshift(session);
    }
    await dbService.saveShishaSessions(localSessions);
    return { success: true, session: savedSupabase };
  } catch(e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('stats:delete-session', async (event, id) => {
  try {
    await supabaseService.deleteShishaSession(id);
    const localSessions = await dbService.getShishaSessions();
    const filtered = localSessions.filter(s => s.id !== id);
    await dbService.saveShishaSessions(filtered);
    return { success: true };
  } catch(e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('stats:get-timer-state', async (event, channel) => {
  try {
    const chan = channel || (twitchService ? twitchService.targetChannel : 'marved');
    let timerState = await supabaseService.getActiveTimerState(chan);
    if (!timerState) {
      timerState = await dbService.getActiveTimerState();
    }
    return { success: true, timerState };
  } catch(e) {
    return { success: false, error: e.message, timerState: null };
  }
});

ipcMain.handle('stats:save-timer-state', async (event, { channel, timerState }) => {
  try {
    const chan = channel || (twitchService ? twitchService.targetChannel : 'marved');
    await supabaseService.saveActiveTimerState(chan, timerState);
    await dbService.saveActiveTimerState(timerState);
    return { success: true };
  } catch(e) {
    return { success: false, error: e.message };
  }
});

// IPC Handlers for Database
ipcMain.handle('db:get-catalog', async () => {
  return dbService.getCatalog();
});

ipcMain.handle('db:add-item', async (event, { category, item }) => {
  const res = dbService.addItem(category, item);
  return { success: res, catalog: dbService.getCatalog() };
});

ipcMain.handle('db:remove-item', async (event, { category, item }) => {
  const res = dbService.removeItem(category, item);
  return { success: res, catalog: dbService.getCatalog() };
});

ipcMain.handle('db:edit-item', async (event, { category, oldItem, newItem }) => {
  const res = dbService.editItem(category, oldItem, newItem);
  return { success: res, catalog: dbService.getCatalog() };
});

ipcMain.handle('db:auto-learn', async (event, setupData) => {
  const res = dbService.autoLearnSetup(setupData);
  return { success: true, ...res };
});

ipcMain.handle('db:sync-github', async () => {
  const res = await dbService.syncWithGitHubCommunityCatalog();
  return res;
});

ipcMain.handle('settings:save-gist-token', async (event, token) => {
  const clean = (token || '').trim();
  store.set('gist_pat', clean);
  DatabaseService.setGistToken(clean);
  return { success: true };
});

ipcMain.handle('settings:get-gist-token', async () => {
  const token = store.get('gist_pat', '');
  return { hasToken: !!token, maskedToken: token ? token.slice(0, 8) + '...' : '' };
});

// IPC Handlers for Auto-Updater
ipcMain.handle('updater:check', async () => {
  try {
    const result = await autoUpdater.checkForUpdates();
    return { success: true, result };
  } catch (err) {
    const errMsg = err ? (err.message || String(err)) : '';
    if (errMsg.includes('app-update.yml') || errMsg.includes('ENOENT')) {
      return { success: false, error: 'Keine Update-Konfiguration im Test/Portable-Modus' };
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

ipcMain.handle('app:copy-clipboard', async (event, text) => {
  clipboard.writeText(text);
  return { success: true };
});

ipcMain.handle('app:open-external', async (event, url) => {
  shell.openExternal(url);
  return { success: true };
});

// OBS Overlay Server & Export
function startObsServer() {
  if (obsServer) return;
  const PORT = 18942;

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

// Start OBS Server on startup
app.whenReady().then(() => {
  startObsServer();
});

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

  // Publish to GitHub Gist for cloud access (channel-separated)
  const channel = setupPayload.channel || (twitchService ? twitchService.targetChannel : 'marved');
  dbService.publishLiveSetupToGist(setupPayload, channel).catch(() => {});

  return {
    success: true,
    localUrl: 'http://localhost:18942/overlay',
    textFilePath,
    gistUrl: 'https://gist.githubusercontent.com/raw/111d0abf0b0e66e2ca635c3aa8d05eb7/current_setup.json'
  };
});

ipcMain.handle('obs:get-info', async () => {
  const textFilePath = path.join(app.getPath('userData'), 'current_setup.txt');
  return {
    localUrl: 'http://localhost:18942/overlay',
    textFilePath,
    gistUrl: 'https://gist.github.com/111d0abf0b0e66e2ca635c3aa8d05eb7'
  };
});

