const { app, BrowserWindow, ipcMain, clipboard, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const TwitchService = require('./twitchService');
const DatabaseService = require('./dbService');

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
