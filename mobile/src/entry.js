'use strict';
// Android entry: exposes the same window.swgBridge as the Electron preload and
// runs the desktop main-process code (src/main) inside the WebView.
const { Buffer } = require('buffer');
const host = require('../shims/host');
const vfs = require('../shims/vfs');
const contract = require('../../src/shared/ipc-contract.json');
const seedFiles = require('./generated-assets.js');

globalThis.Buffer = globalThis.Buffer || Buffer;
globalThis.global = globalThis;

const allowedInvocations = new Set(contract.invoke);
const allowedEvents = new Set(contract.events);

window.swgBridge = Object.freeze({
  platform: 'android',
  ipcRenderer: Object.freeze({
    invoke(channel, ...args) {
      if (!allowedInvocations.has(channel)) return Promise.reject(new Error('Unbekannte App-Funktion: ' + channel));
      return host.invoke(channel, args);
    },
    on(channel, callback) {
      if (!allowedEvents.has(channel) || typeof callback !== 'function') throw new Error('Unbekanntes App-Ereignis');
      return host.addRendererListener(channel, (_event, ...args) => callback(null, ...args));
    }
  })
});
document.documentElement.classList.add('swg-android');
// The phone layout shows the Twitch login button as icon only.
document.addEventListener('DOMContentLoaded', () => {
  const twitchButton = document.getElementById('btn-twitch-login');
  if (twitchButton) twitchButton.setAttribute('aria-label', 'Mit Twitch verbinden');
  require('./phone-nav').buildPhoneNav();
});

// Android back button: close the top-most sheet/dialog first.
function closeTopLayer() {
  const dialog = [...document.querySelectorAll('dialog[open]')].pop();
  if (dialog) { dialog.close(); return true; }
  const overlay = [...document.querySelectorAll('.modal-overlay:not(.hidden)')].pop();
  if (overlay) {
    const close = overlay.querySelector('[id^="btn-close"], .modal-header .btn-icon, [data-close]');
    if (close) close.click(); else overlay.classList.add('hidden');
    return true;
  }
  const open = document.querySelector('.modal.active, .modal.show');
  if (open) { open.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return true; }
  return false;
}

async function start() {
  await vfs.load(seedFiles);
  // Load the desktop main process only after the stored files are available.
  require('../../src/main/main.js');
  host.markAppReady();
  // main.js registered app.whenReady().then(createWindow) first, so this
  // continuation runs after the window and services were created.
  await host.ready;
  host.markBridgeReady();
  const { App } = require('@capacitor/app');
  if (host.isNative()) {
    const push = require('./push');
    push.initPush();
    push.markAppReady();
    App.addListener('pause', () => vfs.flush());
    App.addListener('backButton', ({ canGoBack }) => {
      if (closeTopLayer()) return;
      const home = document.querySelector('.workspace-sidebar [data-ws-route="view-landing"]');
      const onHome = !document.getElementById('view-landing') || !document.getElementById('view-landing').classList.contains('hidden');
      if (!onHome && home) home.click();
      else if (canGoBack) history.back();
      else App.minimizeApp();
    });
  }
}

start().catch((error) => {
  console.error(error);
  document.documentElement.classList.remove('swg-starting');
  window.alert('Start des ShishaWG Mod Setup Tools fehlgeschlagen\n\n' + (error && error.message || error));
});
