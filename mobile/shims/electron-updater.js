'use strict';
// Android updates: compare with the latest GitHub release and open its APK.
const { EventEmitter } = require('events');
const { app, shell } = require('./electron');

const RELEASES_URL = 'https://api.github.com/repos/BazZTee/shishawg-mod-setup-tool/releases/latest';

function compareVersions(a, b) {
  const pa = String(a).replace(/^v/, '').split(/[.-]/).map(n => parseInt(n, 10) || 0);
  const pb = String(b).replace(/^v/, '').split(/[.-]/).map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  }
  return 0;
}

class AndroidUpdater extends EventEmitter {
  constructor() {
    super();
    this.autoDownload = false;
    this.autoInstallOnAppQuit = false;
    this.latest = null;
  }
  async checkForUpdates() {
    try {
      const response = await fetch(RELEASES_URL, { headers: { Accept: 'application/vnd.github+json' } });
      if (!response.ok) throw new Error(`GitHub antwortet mit ${response.status}`);
      const release = await response.json();
      const apk = (release.assets || []).find(asset => /\.apk$/i.test(asset.name));
      const version = String(release.tag_name || '').replace(/^v/, '');
      if (apk && compareVersions(version, app.getVersion()) > 0) {
        this.latest = { version, url: apk.browser_download_url, page: release.html_url };
        this.emit('update-available', { version, releaseNotes: release.body || '', releaseName: release.name || '' });
      } else {
        this.latest = null;
        this.emit('update-not-available', { version: app.getVersion() });
      }
      return { updateInfo: { version } };
    } catch (error) {
      this.emit('error', error);
      return null;
    }
  }
  async downloadUpdate() {
    if (!this.latest) await this.checkForUpdates();
    if (this.latest) await shell.openExternal(this.latest.url);
    return [];
  }
  quitAndInstall() {
    if (this.latest) shell.openExternal(this.latest.url);
  }
}

module.exports = { autoUpdater: new AndroidUpdater(), compareVersions };
