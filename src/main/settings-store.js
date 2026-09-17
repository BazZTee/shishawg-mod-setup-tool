'use strict';
const fs = require('fs');
const path = require('path');

// Write to a sibling file first; never truncate the last valid settings file.
class SettingsStore {
  constructor(filePath) {
    this.path = filePath;
    this.data = {};
    this.load();
  }
  load() {
    for (const file of [this.path, this.path + '.backup']) {
      if (!fs.existsSync(file)) continue;
      try {
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid settings format');
        this.data = data;
        return;
      } catch (error) {
        console.warn('Settings could not be loaded; trying backup:', error.message);
      }
    }
  }
  save() {
    fs.mkdirSync(path.dirname(this.path), { recursive: true });
    const pending = this.path + '.pending';
    fs.writeFileSync(pending, JSON.stringify(this.data, null, 2), { encoding: 'utf8', mode: 0o600 });
    // Keep only valid backups, including after recovery from damaged JSON.
    if (fs.existsSync(this.path)) {
      try {
        const previous = JSON.parse(fs.readFileSync(this.path, 'utf8'));
        if (previous && typeof previous === 'object' && !Array.isArray(previous)) fs.copyFileSync(this.path, this.path + '.backup');
      } catch (error) { console.warn('Keeping previous settings backup:', error.message); }
    }
    fs.renameSync(pending, this.path);
  }
  get(key, fallback) { return Object.hasOwn(this.data, key) ? this.data[key] : fallback; }
  set(key, value) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Invalid settings key');
    const previous = { ...this.data };
    this.data[key] = value;
    try { this.save(); } catch (error) { this.data = previous; throw error; }
  }
  delete(key) {
    const previous = { ...this.data };
    delete this.data[key];
    try { this.save(); } catch (error) { this.data = previous; throw error; }
  }
}
module.exports = SettingsStore;
