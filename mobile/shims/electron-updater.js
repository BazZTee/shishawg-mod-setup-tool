'use strict';
// Android updates: compare with the latest GitHub release, download its APK in the app and install it.
const { EventEmitter } = require('events');
const { app, shell } = require('./electron');
const { registerPlugin } = require('@capacitor/core');
const { App } = require('@capacitor/app');
const host = require('./host');

const ApkUpdater = registerPlugin('ApkUpdater');

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
  // Native: download inside the app with progress (ApkUpdaterPlugin.java). Browser preview: open the APK link.
  async downloadUpdate() {
    if (!this.latest) await this.checkForUpdates();
    if (!this.latest) return [];
    if (!host.isNative()) {
      await shell.openExternal(this.latest.url);
      return [];
    }
    const listener = await ApkUpdater.addListener('progress', progress => this.emit('download-progress', progress));
    try {
      await ApkUpdater.download({ url: this.latest.url });
    } catch (error) {
      this.emit('error', error);
      throw error;
    } finally {
      listener.remove();
    }
    this.emit('update-downloaded', { version: this.latest.version });
    return [];
  }
  async quitAndInstall() {
    if (!host.isNative()) {
      if (this.latest) shell.openExternal(this.latest.url);
      return;
    }
    try {
      const result = await ApkUpdater.install();
      if (result && result.needsPermission && !this.waitingForPermission) {
        // Android opened "Unbekannte Apps installieren"; continue automatically when the user comes back.
        this.waitingForPermission = true;
        const resume = await App.addListener('resume', async () => {
          resume.remove();
          this.waitingForPermission = false;
          try { await ApkUpdater.install(); } catch (error) { this.emit('error', error); }
        });
      }
    } catch (error) {
      this.emit('error', error);
    }
  }
}

module.exports = { autoUpdater: new AndroidUpdater(), compareVersions };
