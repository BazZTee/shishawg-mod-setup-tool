'use strict';
// Electron main-process API subset backed by the Android WebView.
const { EventEmitter } = require('events');
const host = require('./host');
const http = require('./http');
const { Clipboard } = require('@capacitor/clipboard');
const { LocalNotifications } = require('@capacitor/local-notifications');

/* global __APP_VERSION__ */
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';

const app = new EventEmitter();
Object.assign(app, {
  isPackaged: true,
  commandLine: { appendSwitch() {} },
  whenReady: () => host.ready,
  getVersion: () => APP_VERSION,
  getName: () => 'ShishaWG Mod Setup Tool',
  getPath: (name) => '/userData' + (name === 'userData' ? '' : '/' + name),
  quit() {},
  exit() {},
  setAppUserModelId() {},
  requestSingleInstanceLock: () => true
});

const ipcMain = {
  handle(channel, handler) { host.handlers.set(channel, handler); },
  removeHandler(channel) { host.handlers.delete(channel); },
  on() {},
  once() {}
};

let windows = [];

class WebContents extends EventEmitter {
  send(channel, ...args) { host.emitToRenderer(channel, args); }
  isLoading() { return document.readyState === 'loading'; }
  getURL() { return location.href; }
  setWindowOpenHandler() {}
  async executeJavaScript(code) { return (0, eval)(code); }
  openDevTools() {}
}

class BrowserWindow extends EventEmitter {
  constructor() {
    super();
    this.webContents = new WebContents();
    this._destroyed = false;
    windows.push(this);
  }
  static getAllWindows() { return windows.filter(w => !w._destroyed); }
  async loadFile() {
    const fire = () => setTimeout(() => this.webContents.emit('did-finish-load'), 0);
    if (document.readyState === 'complete') fire();
    else window.addEventListener('load', fire, { once: true });
  }
  async loadURL() { return this.loadFile(); }
  isDestroyed() { return this._destroyed; }
  isFocused() { return !document.hidden; }
  isMinimized() { return document.hidden; }
  isVisible() { return !document.hidden; }
  show() {}
  hide() {}
  focus() {}
  restore() {}
  close() {}
  flashFrame() {}
  setTitle(title) { document.title = title; }
}

const clipboard = {
  writeText(text) {
    const value = String(text ?? '');
    if (host.isNative()) return Clipboard.write({ string: value });
    if (navigator.clipboard) return navigator.clipboard.writeText(value).catch(() => {});
    return undefined;
  },
  readText: () => ''
};

function parseFragment(value) {
  const index = value.indexOf('#');
  return new URLSearchParams(index >= 0 ? value.slice(index + 1) : '');
}

// Twitch login: the desktop app listens on http://localhost:<port>/auth. Here
// an in-app browser opens the login, the redirect is caught and its token is
// handed to the registered virtual server, so twitchService runs unchanged.
function openTwitchLogin(authUrl, redirect) {
  const iab = globalThis.cordova?.InAppBrowser;
  if (!iab) {
    window.open(authUrl, '_blank');
    return;
  }
  const port = Number(redirect.port || 80);
  const ref = iab.open(authUrl, '_blank', 'location=yes,clearcache=no,clearsessioncache=no,zoom=no');
  let handled = false;
  const onUrl = (event) => {
    const target = String(event && event.url || '');
    if (handled || !target.startsWith(redirect.origin + redirect.pathname)) return;
    handled = true;
    try { ref.close(); } catch (_error) {}
    const params = parseFragment(target);
    const query = new URL(target).searchParams;
    const token = params.get('access_token');
    if (token) {
      http.__dispatch(port, '/token?token=' + encodeURIComponent(token));
    } else {
      const reason = params.get('error_description') || query.get('error_description') || 'Anmeldung abgebrochen.';
      dialog.showErrorBox('Twitch-Anmeldung', reason);
    }
  };
  ref.addEventListener('loadstart', onUrl);
  ref.addEventListener('loaderror', onUrl);
}

const shell = {
  async openExternal(value) {
    const target = String(value);
    try {
      const u = new URL(target);
      if (u.hostname === 'id.twitch.tv' && u.pathname === '/oauth2/authorize') {
        const redirectUri = u.searchParams.get('redirect_uri') || '';
        const redirect = new URL(redirectUri);
        if (['localhost', '127.0.0.1'].includes(redirect.hostname)) {
          openTwitchLogin(target, redirect);
          return;
        }
      }
    } catch (_error) {}
    window.open(target, host.isNative() ? '_system' : '_blank');
  },
  openPath: async () => 'Nicht verfügbar',
  showItemInFolder() {}
};

const dialog = {
  showErrorBox(title, content) { window.alert(`${title}\n\n${content}`); },
  showMessageBox: async () => ({ response: 0 }),
  showOpenDialog: async () => ({ canceled: true, filePaths: [] }),
  showSaveDialog: async () => ({ canceled: true })
};

let notificationId = 1;
const notificationsById = new Map();
let notificationListener = false;

class Notification extends EventEmitter {
  static isSupported() { return host.isNative(); }
  constructor(options = {}) {
    super();
    this.options = options;
    this.id = notificationId++;
  }
  async show() {
    const plugin = LocalNotifications;
    try {
      const permission = await plugin.checkPermissions();
      if (permission.display !== 'granted') {
        const asked = await plugin.requestPermissions();
        if (asked.display !== 'granted') return;
      }
      if (!notificationListener) {
        notificationListener = true;
        plugin.addListener('localNotificationActionPerformed', (event) => {
          const item = notificationsById.get(event.notification && event.notification.id);
          if (item) { item.emit('click'); item.emit('close'); notificationsById.delete(item.id); }
        });
      }
      notificationsById.set(this.id, this);
      await plugin.schedule({ notifications: [{ id: this.id, title: this.options.title || '', body: this.options.body || '' }] });
    } catch (error) { console.warn('Benachrichtigung fehlgeschlagen:', error); }
  }
  close() { this.emit('close'); }
}

module.exports = {
  app,
  ipcMain,
  BrowserWindow,
  clipboard,
  shell,
  dialog,
  Notification,
  contextBridge: { exposeInMainWorld() {} },
  ipcRenderer: { invoke() {}, on() {} }
};
