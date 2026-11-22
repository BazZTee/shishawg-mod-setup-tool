'use strict';
// Electron main-process API subset backed by the Android WebView.
const { EventEmitter } = require('events');
const host = require('./host');
const http = require('./http');
const { Clipboard } = require('@capacitor/clipboard');
const { LocalNotifications } = require('@capacitor/local-notifications');
const { Browser } = require('@capacitor/browser');
const { App } = require('@capacitor/app');

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

// Twitch login: Twitch blocks logins inside WebViews, so the login opens in a
// Chrome Custom Tab. Twitch redirects to a GitHub Pages page that forwards the
// token (URL fragment only) to this app via its own URL scheme. The token is
// then handed to the virtual http server that twitchService registered on
// localhost, so twitchService runs unchanged.
const AUTH_RETURN_URL = 'https://bazztee.github.io/shishawg-mod-setup-tool/android-auth.html';
const APP_AUTH_PREFIX = 'de.shishawg.modsetuptool://auth';
const LOGIN_TIMEOUT_MS = 15 * 60 * 1000;
let pendingLogin = null;
let authListener = false;

function randomState() {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function handleAuthReturn(value) {
  const target = String(value || '');
  if (!target.startsWith(APP_AUTH_PREFIX)) return;
  const login = pendingLogin;
  pendingLogin = null;
  Browser.close().catch(() => {});
  const params = parseFragment(target);
  if (!login || Date.now() - login.started > LOGIN_TIMEOUT_MS || params.get('state') !== login.state) {
    dialog.showErrorBox('Twitch-Anmeldung', 'Die Anmeldung ist abgelaufen oder gehört nicht zu dieser App. Bitte erneut verbinden.');
    return;
  }
  const token = params.get('access_token');
  if (token) {
    http.__dispatch(login.port, '/token?token=' + encodeURIComponent(token));
  } else {
    dialog.showErrorBox('Twitch-Anmeldung', params.get('error_description') || 'Anmeldung abgebrochen.');
  }
}

function openTwitchLogin(authUrl, redirect) {
  if (!host.isNative()) {
    window.open(authUrl, '_blank');
    return;
  }
  if (!authListener) {
    authListener = true;
    App.addListener('appUrlOpen', ({ url }) => handleAuthReturn(url));
    // Tab closed without a login result: offer the manual token dialog
    // (#twitch-modal from the desktop UI, otherwise unreachable).
    Browser.addListener('browserFinished', () => {
      setTimeout(() => {
        if (!pendingLogin) return;
        pendingLogin = null;
        const modal = document.getElementById('twitch-modal');
        if (modal) modal.classList.remove('hidden');
      }, 1000);
    });
  }
  const login = new URL(authUrl);
  const state = randomState();
  login.searchParams.set('redirect_uri', AUTH_RETURN_URL);
  login.searchParams.set('state', state);
  pendingLogin = { state, port: Number(redirect.port || 80), started: Date.now() };
  Browser.open({ url: login.toString() });
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
    if (host.isNative()) await Browser.open({ url: target });
    else window.open(target, '_blank');
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
