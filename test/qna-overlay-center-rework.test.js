'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('Q&A workspace is arranged as a compact live control room', () => {
  const index = read('src/renderer/index.html');
  const qna = index.slice(index.indexOf('id="view-qna"'), index.indexOf('id="view-polls"'));

  assert.match(qna, /id="btn-toggle-qna-listener"/);
  assert.match(qna, /id="btn-open-manual-qna-modal"/);
  assert.doesNotMatch(qna, /data-open-overlay-center="qna"/);
  assert.match(qna, /class="qna-card qna-spotlight-card"/);
  assert.match(qna, /class="qna-card qna-round-card"/);
  assert.ok(qna.indexOf('qna-spotlight-card') < qna.indexOf('qna-inbox-card'));
  assert.doesNotMatch(qna, /bestrafungen-card/);
  assert.doesNotMatch(qna, /Streamer-Kurzübersicht/);
});

test('rare and destructive Q&A actions remain available in the options menu', () => {
  const index = read('src/renderer/index.html');
  const menu = index.slice(index.indexOf('id="qna-dropdown-menu"'), index.indexOf('<!-- Main Q&A Grid Layout -->'));

  for (const id of ['btn-open-qna-stats-modal', 'btn-open-qna-settings-modal', 'btn-open-qna-bestrafungen', 'btn-qna-delete-duplicates', 'btn-clear-answered-qna', 'btn-qna-delete-all']) {
    assert.match(menu, new RegExp(`id="${id}"`));
  }
  assert.match(menu, /qna-danger-action/);
});

test('punishments and challenges open from options in their own manager', () => {
  const index = read('src/renderer/index.html');
  const qna = read('src/renderer/modules/07-qna-polls.js');

  for (const id of ['modal-qna-bestrafungen', 'btn-close-qna-bestrafungen', 'input-new-bestrafung', 'btn-add-bestrafung', 'bestrafungen-list-container']) {
    assert.match(index, new RegExp(`id="${id}"`));
  }
  assert.match(qna, /btnOpenBestrafungen\.addEventListener\('click'/);
  assert.match(qna, /bestrafungenModal\.classList\.remove\('hidden'\)/);
});

test('questions can be placed on air and controlled directly from the spotlight', () => {
  const qna = read('src/renderer/modules/07-qna-polls.js');

  assert.match(qna, /class="btn btn-xs btn-primary btn-act-live"/);
  assert.match(qna, /setQuestionStatus\(q\.id, 'on_air'\)/);
  assert.match(qna, /id="btn-spotlight-answered"/);
  assert.match(qna, /setQuestionStatus\(active\.id, 'answered'\)/);
  assert.match(qna, /id="btn-spotlight-next-random"/);
  assert.match(qna, /Math\.floor\(Math\.random\(\) \* pool\.length\)/);
  assert.match(qna, /id="btn-spotlight-offair"/);
});

test('OBS center groups every overlay and separates the streamer prompter', () => {
  const index = read('src/renderer/index.html');
  const setup = read('src/renderer/modules/02-setup.js');

  for (const card of ['setup', 'qna', 'timer', 'prompter']) {
    assert.match(index, new RegExp(`data-overlay-card="${card}"`));
  }
  for (const id of [
    'obs-cloud-url', 'obs-local-url',
    'obs-qna-cloud-url', 'obs-qna-local-url',
    'obs-timer-cloud-url', 'obs-timer-local-url',
    'obs-qna-prompter-url',
    'btn-copy-qna-obs', 'btn-copy-qna-prompter', 'btn-copy-timer-obs-link'
  ]) {
    assert.match(index, new RegExp(`id="${id}"`));
  }
  assert.match(index, /STREAMER-ANSICHTEN/);
  assert.match(index, /Keine OBS-Quelle/);
  assert.match(setup, /ipcRenderer\.invoke\('obs:get-info'\)/);
  assert.match(setup, /data-open-overlay-center/);
  assert.match(setup, /\/qna\.html\?channel=\$\{encodedChannel\}&mode=timer/);
});
