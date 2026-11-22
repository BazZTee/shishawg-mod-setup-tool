'use strict';
// Connects the in-page "main process" with the renderer bridge.
const handlers = new Map();
const rendererListeners = new Map();
let resolveAppReady;
let resolveBridgeReady;
// appReady: app.whenReady() of the main code. bridgeReady: main window and
// services exist, renderer calls may run.
const appReady = new Promise((resolve) => { resolveAppReady = resolve; });
const bridgeReady = new Promise((resolve) => { resolveBridgeReady = resolve; });

function isNative() {
  return !!(globalThis.Capacitor && typeof globalThis.Capacitor.isNativePlatform === 'function' && globalThis.Capacitor.isNativePlatform());
}

module.exports = {
  handlers,
  ready: appReady,
  bridgeReady,
  markAppReady: () => resolveAppReady(),
  markBridgeReady: () => resolveBridgeReady(),
  isNative,
  async invoke(channel, args) {
    await bridgeReady;
    const handler = handlers.get(channel);
    if (!handler) throw new Error('Diese Funktion ist in der Android-App nicht verfügbar: ' + channel);
    return handler({ sender: null, senderFrame: null }, ...args);
  },
  emitToRenderer(channel, args) {
    for (const listener of rendererListeners.get(channel) || []) {
      try { listener({}, ...args); } catch (error) { console.error('Fehler im Ereignis', channel, error); }
    }
  },
  addRendererListener(channel, listener) {
    if (!rendererListeners.has(channel)) rendererListeners.set(channel, new Set());
    rendererListeners.get(channel).add(listener);
    return () => rendererListeners.get(channel).delete(listener);
  }
};
