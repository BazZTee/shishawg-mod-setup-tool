const { app, BrowserWindow, ipcMain, clipboard, shell } = require('electron');
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
    width: 1100,
    height: 850,
    minWidth: 900,
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

// IPC Handlers
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

ipcMain.handle('app:copy-clipboard', async (event, text) => {
  clipboard.writeText(text);
  return { success: true };
});

ipcMain.handle('app:open-external', async (event, url) => {
  shell.openExternal(url);
  return { success: true };
});
