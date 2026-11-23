'use strict';
// Push notifications via Firebase Cloud Messaging.
// The app registers its FCM token for the active channel; channel-api sends a push for new
// Mod-Chat and private messages while the app is closed. In the foreground Android does not
// show FCM notifications, so the renderer's own sound/toast notifications take over.
const { PushNotifications } = require('@capacitor/push-notifications');
const { App } = require('@capacitor/app');

let fcmToken = '';
let registeredKey = '';
let pendingTap = null;
let appReady = false;

function invoke(channel, ...args) {
  return window.swgBridge.ipcRenderer.invoke(channel, ...args);
}

function currentKey() {
  const user = typeof state !== 'undefined' ? state.twitchUser : null;
  const channel = typeof state !== 'undefined' ? String(state.targetChannel || '').toLowerCase().replace(/^#/, '') : '';
  return user && user.id && channel ? `${user.id}@${channel}` : '';
}

// Register (again) whenever the token, the account or the active channel changed.
async function syncRegistration() {
  const key = currentKey();
  if (!fcmToken || !key || key === registeredKey) return;
  try {
    const result = await invoke('push:register-device', fcmToken);
    if (result && result.success) registeredKey = key;
  } catch (_) { /* not a moderator yet or offline: retried on the next check */ }
}

function openFromTap(data) {
  if (!appReady) { pendingTap = data; return; }
  pendingTap = null;
  if (typeof showView === 'function') showView('view-modchat');
  if (data && data.kind === 'direct' && data.senderId && window.swgDirectChat) {
    window.swgDirectChat.openPeer(data.senderId);
  }
}

async function initPush() {
  try {
    await PushNotifications.createChannel({
      id: 'modchat',
      name: 'Mod-Chat & private Nachrichten',
      description: 'Neue Nachrichten im Mod-HQ',
      importance: 5,
      visibility: 1,
      vibration: true
    });

    await PushNotifications.addListener('registration', ({ value }) => {
      if (value && value !== fcmToken) { fcmToken = value; registeredKey = ''; }
      syncRegistration();
    });
    await PushNotifications.addListener('registrationError', (error) => {
      console.warn('Push-Registrierung fehlgeschlagen:', error);
    });
    await PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
      openFromTap(notification && notification.data);
    });

    let permission = await PushNotifications.checkPermissions();
    if (permission.receive === 'prompt' || permission.receive === 'prompt-with-rationale') {
      permission = await PushNotifications.requestPermissions();
    }
    if (permission.receive !== 'granted') return;
    await PushNotifications.register();

    window.addEventListener('swg:auth-changed', () => { registeredKey = ''; syncRegistration(); });
    App.addListener('resume', syncRegistration);
    setInterval(syncRegistration, 15000);
  } catch (error) {
    console.warn('Push nicht verfügbar:', error);
  }
}

function markAppReady() {
  appReady = true;
  syncRegistration();
  if (pendingTap) openFromTap(pendingTap);
}

module.exports = { initPush, markAppReady };
