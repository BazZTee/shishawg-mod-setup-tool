'use strict';
function isWebLink(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;
  } catch { return false; }
}
async function openWebLink(shell, value) {
  if (!isWebLink(value)) return { success: false, error: 'Nur gültige HTTP- und HTTPS-Links können geöffnet werden.' };
  try {
    await shell.openExternal(value);
    return { success: true };
  } catch (error) { return { success: false, error: error.message }; }
}
function configureWindowSecurity(win, shell) {
  win.webContents.setWindowOpenHandler(({ url }) => {
    void openWebLink(shell, url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (url === win.webContents.getURL()) return;
    event.preventDefault();
    if (isWebLink(url)) void openWebLink(shell, url);
  });
  win.webContents.on('will-attach-webview', event => event.preventDefault());
}
module.exports = { isWebLink, openWebLink, configureWindowSecurity };
