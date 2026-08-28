const { app, BrowserWindow, ipcMain, clipboard, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const http = require('http');
const TwitchService = require('./twitchService');
const DatabaseService = require('./dbService');

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

  twitchService = new TwitchService(mainWindow, store);

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

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
    if (mainWindow) {
      mainWindow.webContents.send('updater:error', err ? err.message : 'Fehler beim Update-Prüfen');
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

ipcMain.handle('twitch:send-chat', async (event, { message, channel }) => {
  try {
    const res = await twitchService.sendChatMessage(message, channel);
    return { success: true, res };
  } catch (err) {
    return { success: false, error: err.message };
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

// IPC Handlers for Auto-Updater
ipcMain.handle('updater:check', async () => {
  try {
    const result = await autoUpdater.checkForUpdates();
    return { success: true, result };
  } catch (err) {
    return { success: false, error: err.message };
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

