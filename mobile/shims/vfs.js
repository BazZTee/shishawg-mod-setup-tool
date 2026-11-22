'use strict';
// In-memory file system with IndexedDB persistence. The desktop code uses the
// synchronous fs API, so all files are loaded before the app starts and every
// write is kept in memory first and stored in IndexedDB shortly after.
const files = new Map();
const readOnly = new Set();
const dirty = new Set();
const removed = new Set();
const DB_NAME = 'swg-mod-tool';
const STORE = 'files';
let db = null;
let flushTimer = null;

function normalize(p) {
  const parts = [];
  for (const part of String(p).replace(/\\/g, '/').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop(); else parts.push(part);
  }
  return '/' + parts.join('/');
}

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return resolve(null);
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function load(seed = {}) {
  for (const [p, content] of Object.entries(seed)) {
    files.set(normalize(p), content);
    readOnly.add(normalize(p));
  }
  try { db = await openDb(); } catch (error) { console.warn('Speicher konnte nicht geöffnet werden:', error); }
  if (!db) return;
  await new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return resolve();
      if (!readOnly.has(cursor.key)) files.set(cursor.key, cursor.value);
      cursor.continue();
    };
    req.onerror = () => resolve();
  });
}

function flush() {
  flushTimer = null;
  if (!db || (!dirty.size && !removed.size)) return;
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);
  for (const p of dirty) if (files.has(p)) store.put(files.get(p), p);
  for (const p of removed) store.delete(p);
  dirty.clear();
  removed.clear();
}

function schedule() {
  if (!flushTimer) flushTimer = setTimeout(flush, 250);
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
}

module.exports = {
  normalize,
  load,
  flush,
  has: p => files.has(normalize(p)),
  isDir: p => { const n = normalize(p) + '/'; for (const key of files.keys()) if (key.startsWith(n)) return true; return false; },
  read: p => files.get(normalize(p)),
  write(p, content) {
    const n = normalize(p);
    if (readOnly.has(n)) throw new Error('EROFS: read-only file ' + n);
    files.set(n, content);
    removed.delete(n);
    dirty.add(n);
    schedule();
  },
  remove(p) {
    const n = normalize(p);
    files.delete(n);
    dirty.delete(n);
    removed.add(n);
    schedule();
  }
};
