const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { resolveReleaseNotes } = require('../src/main/release-notes');

const root = path.join(__dirname, '..');
const notes = JSON.parse(fs.readFileSync(path.join(root, 'src/shared/release-notes.json'), 'utf8'));
const indexHtml = fs.readFileSync(path.join(root, 'src/renderer/index.html'), 'utf8');
const renderer = fs.readFileSync(path.join(root, 'src/renderer/renderer.js'), 'utf8');
const main = fs.readFileSync(path.join(root, 'src/main/main.js'), 'utf8');
const contract = JSON.parse(fs.readFileSync(path.join(root, 'src/shared/ipc-contract.json'), 'utf8'));

test('release notes appear once for the matching unseen version', () => {
  const firstLaunch = resolveReleaseNotes('8.0.1', notes, '');
  assert.equal(firstLaunch.shouldShow, true);
  assert.equal(firstLaunch.release.version, '8.0.1');
  assert.ok(firstLaunch.release.items.length > 0);

  const alreadySeen = resolveReleaseNotes('8.0.1', notes, '8.0.1');
  assert.equal(alreadySeen.shouldShow, false);

  const anotherVersion = resolveReleaseNotes('8.0.0', notes, '');
  assert.equal(anotherVersion.shouldShow, false, 'notes must be maintained for the exact release version');
});

test('release notes popup is closed only with its top-right X and persists the seen version', () => {
  const modal = indexHtml.match(/<div id="release-notes-modal"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/)?.[0] || '';
  assert.match(modal, /id="btn-close-release-notes"/);
  assert.doesNotMatch(modal, /modal-footer|Bestätigen|Weiter/);
  assert.match(renderer, /ipcRenderer\.invoke\('app:get-release-notes'\)/);
  assert.match(renderer, /ipcRenderer\.invoke\('app:mark-release-notes-seen', pendingReleaseNotesVersion\)/);
  assert.match(main, /last_seen_release_notes_version/);
  assert.ok(contract.invoke.includes('app:get-release-notes'));
  assert.ok(contract.invoke.includes('app:mark-release-notes-seen'));
});
