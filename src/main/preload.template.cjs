// Sandboxed preload: do not expose Node, filesystem access or Electron events.
const { contextBridge, ipcRenderer } = require('electron');
const allowedInvocations = new Set(__INVOKE_CHANNELS__);
const allowedEvents = new Set(__EVENT_CHANNELS__);
contextBridge.exposeInMainWorld('swgBridge', {
  ipcRenderer: {
    invoke(channel, ...args) {
      if (!allowedInvocations.has(channel)) return Promise.reject(new Error('Unbekannte App-Funktion: ' + channel));
      return ipcRenderer.invoke(channel, ...args);
    },
    on(channel, callback) {
      if (!allowedEvents.has(channel) || typeof callback !== 'function') throw new Error('Unbekanntes App-Ereignis');
      const listener = (_event, ...args) => callback(null, ...args);
      ipcRenderer.on(channel, listener);
      return () => ipcRenderer.removeListener(channel, listener);
    }
  }
});
