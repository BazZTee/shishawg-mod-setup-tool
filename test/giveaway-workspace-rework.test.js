'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('Giveaways are separated into live and address workspaces without removing core actions', () => {
  const index = read('src/renderer/index.html');

  assert.match(index, /data-gw-workspace="live"/);
  assert.match(index, /data-gw-workspace="addresses"/);
  assert.match(index, /id="giveaway-workspace-live"/);
  assert.match(index, /id="giveaway-workspace-addresses"/);
  for (const id of [
    'btn-start-giveaway',
    'btn-stop-giveaway',
    'btn-draw-winner',
    'btn-reroll-winner',
    'btn-open-manual-reward-modal',
    'btn-send-winner-telegram',
    'btn-copy-winner-telegram-text',
    'btn-save-winner-address',
    'btn-discard-winner-address',
    'btn-finish-giveaway'
  ]) {
    assert.match(index, new RegExp(`id="${id}"`), `${id} must remain available`);
  }
});

test('stored personal data is blurred by default and supports hover and click reveal', () => {
  const index = read('src/renderer/index.html');
  const styles = read('src/renderer/styles.css');
  const renderer = read('src/renderer/renderer.js');

  assert.match(index, /id="winner-address-privacy"/);
  assert.match(index, /id="btn-toggle-address-privacy"[^>]*aria-pressed="false"/);
  assert.match(styles, /\.gw-address-privacy\.is-protected:not\(\.is-revealed\) \.gw-address-sensitive-content\s*\{[^}]*filter:\s*blur\(/s);
  assert.match(styles, /\.gw-address-privacy\.is-protected:not\(\.is-revealed\):hover \.gw-address-sensitive-content\s*\{[^}]*filter:\s*none/s);
  assert.match(styles, /\.gw-private-inline span\s*\{[^}]*filter:\s*blur\(/s);
  assert.match(renderer, /addressPrivacyRevealed:\s*false/);
  assert.match(renderer, /btnToggleAddressPrivacy\.addEventListener\(['"]click['"]/);
  assert.match(renderer, /giveawayState\.addressPrivacyRevealed\s*=\s*false;\s*renderAddressReview\(giveawayState\.currentWinner\)/s);
});

test('live workspace keeps participants below the winner and uses equal header actions', () => {
  const index = read('src/renderer/index.html');
  const liveWorkspace = index.slice(
    index.indexOf('id="giveaway-workspace-live"'),
    index.indexOf('id="giveaway-workspace-addresses"')
  );

  assert.ok(liveWorkspace.indexOf('id="winner-display-container"') < liveWorkspace.indexOf('id="giveaway-participants-grid"'));
  assert.doesNotMatch(liveWorkspace, /NÄCHSTER SCHRITT/);
  assert.match(index, /id="btn-open-manual-reward-modal" class="[^"]*gw-header-action/);
  assert.match(index, /id="btn-reset-giveaway" class="[^"]*gw-header-action/);
  assert.doesNotMatch(index, /gw-more-menu/);
});

test('Telegram handoff uses the Magic Charcoal pattern and keeps the former Giveaway format', () => {
  const renderer = read('src/renderer/renderer.js');
  const start = renderer.indexOf('function getFormattedTelegramMessage');
  const end = renderer.indexOf('function setupGiveawaysListeners', start);
  const formatter = renderer.slice(start, end);

  assert.match(formatter, /Hallo, wir hatten wieder eine Einlösung für das kostenlose Kilo Magic Charcoal! 🙂\\n\\n/);
  assert.match(formatter, /Hier die Adresse:\\n\\n/);
  assert.match(formatter, /`\$\{addr\.fullName \|\| '—'\}\\n`/);
  assert.match(formatter, /Kohlegröße:/);
  assert.doesNotMatch(formatter, /&#x20;/);
  assert.match(formatter, /🎁 <b>NEUER GEWINNER/);
  assert.match(formatter, /🏆 <b>Twitch-User:<\/b>/);
});
