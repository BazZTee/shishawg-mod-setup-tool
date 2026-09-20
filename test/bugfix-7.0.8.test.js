'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('claim portal preserves channel and reward type through OAuth and submits both safely', () => {
  const claim = read('docs/claim.html');

  assert.match(claim, /let channel = .*params\.get\(['"]channel['"]\)/);
  assert.match(claim, /let rewardType = .*params\.get\(['"]type['"]\)/);
  assert.match(claim, /stateObj\.channel\).*channel = stateObj\.channel/);
  assert.match(claim, /stateObj\.type\).*rewardType = stateObj\.type/);
  assert.match(claim, /const stateObj = \{[^}]*channel:[^}]*type:/s);
  assert.doesNotMatch(claim, /decodeURIComponent\(stateParam\)/);
  assert.match(claim, /action:\s*['"]claim\.submit['"]/);
  assert.match(claim, /['"]x-twitch-token['"]:\s*verifiedAccessToken/);
  assert.match(claim, /username:\s*verifiedLogin/);
  assert.match(claim, /channel,/);
  assert.match(claim, /rewardType: rewardType/);
  assert.match(claim, /if \(!claimResponse\.ok\)/);

  const originalState = { id: 'winner-20-percent', user: 'testuser', prize: '20% Rabatt', channel: 'marved', type: 'giveaway' };
  const stateParam = new URLSearchParams(`state=${encodeURIComponent(JSON.stringify(originalState))}`).get('state');
  assert.deepEqual(JSON.parse(stateParam), originalState);
});

test('claim portal rejects a second submission after Telegram delivery', () => {
  const edge = read('supabase/functions/channel-api/index.ts');

  assert.match(edge, /select\(['"]id,status['"]\)/);
  assert.match(edge, /winner\.status === ['"]sent_to_telegram['"]/);
  assert.match(edge, /Die Daten wurden bereits abgesendet\./);
  assert.match(edge, /\.neq\(['"]status['"], ['"]sent_to_telegram['"]\)/);
});

test('manual reward modal exposes an explicit Giveaway/Freekohle selection and forwards it', () => {
  const index = read('src/renderer/index.html');
  const renderer = read('src/renderer/renderer.js');
  const main = read('src/main/main.js');
  const twitch = read('src/main/twitchService.js');

  assert.match(index, /name="manual_reward_type"[^>]*value="giveaway"/);
  assert.match(index, /name="manual_reward_type"[^>]*value="channel_points"/);
  assert.match(renderer, /input\[name="manual_reward_type"\]:checked/);
  assert.match(renderer, /type:\s*rewardType/);
  assert.match(main, /\{ user, prize, type, channel, postToChat \}/);
  assert.match(twitch, /createManualClaimLink\([^)]*rewardType/);
  assert.match(twitch, /[?&]type=\$\{encodeURIComponent\(normalizedType\)\}/);
});

test('manual reward modal is not nested inside another hidden modal', () => {
  const index = read('src/renderer/index.html');
  const divTags = /<\/?div\b[^>]*>/gi;
  const stack = [];
  let match;
  let ancestors = null;

  while ((match = divTags.exec(index))) {
    const tag = match[0];
    if (/^<\/div/i.test(tag)) {
      stack.pop();
      continue;
    }

    const id = (tag.match(/\bid="([^"]+)"/i) || [])[1] || null;
    if (id === 'modal-manual-reward') {
      ancestors = stack.map(item => item.id).filter(Boolean);
      break;
    }
    stack.push({ id });
  }

  assert.ok(ancestors, 'manual reward modal must exist');
  assert.equal(ancestors.includes('modal-streamer-profiles'), false);
});

test('manual links default to copy-only and refresh with the existing function', () => {
  const index = read('src/renderer/index.html');
  const renderer = read('src/renderer/renderer.js');
  const chatToggle = index.match(/<input type="checkbox" id="chk-manual-reward-post-chat"[^>]*>/)?.[0] || '';

  assert.ok(chatToggle, 'chat-post toggle must exist');
  assert.doesNotMatch(chatToggle, /\bchecked\b/);
  assert.match(index, /Link erstellen &amp; kopieren/);
  assert.match(renderer, /await ipcRenderer\.invoke\(['"]app:copy-clipboard['"], res\.claimUrl\)/);
  assert.match(renderer, /await loadGiveawayWinnersHistory\(\)/);
  assert.doesNotMatch(renderer, /await pollWinnersUpdates\(\)/);
});

test('Supabase winner persistence keeps channel and coal size without a nonexistent coal_size column', async () => {
  const service = require('../src/main/supabaseService');
  const { encryptAddress } = require('../src/main/crypto');

  let savedRow;
  const originalSecureRequest = service.secureRequest;
  service.secureRequest = async (action, payload) => {
    assert.equal(action, 'giveaways.upsert');
    savedRow = payload.winner;
    return savedRow;
  };

  await service.saveGiveawayWinner({
    id: 'winner-1',
    username: 'testuser',
    address: { fullName: 'Test User', coalSize: '27er', rewardType: 'channel_points' }
  }, '#Marved');

  assert.equal(savedRow.channel, 'marved');
  assert.equal(Object.hasOwn(savedRow, 'coal_size'), false);
  assert.equal(savedRow.address.coalSize, '27er');

  const encryptedAddress = encryptAddress({ coalSize: '26er', rewardType: 'channel_points' });
  service.secureRequest = async (action, payload) => {
    assert.equal(action, 'giveaways.list');
    assert.equal(payload.channel, 'marved');
    return [{
              id: 'winner-2',
              channel: 'marved',
              username: 'anotheruser',
              display_name: 'AnotherUser',
              prize: '1KG Zauberwürfel FREE!',
              status: 'address_received',
              address: encryptedAddress,
              created_at: '2026-09-01T12:00:00.000Z'
            }];
  };

  const [winner] = await service.getGiveaways('marved');
  assert.equal(winner.coalSize, '26er');
  assert.equal(winner.type, 'channel_points');
  assert.equal(winner.address.coalSize, '26er');
  service.secureRequest = originalSecureRequest;
});

test('Supabase save rejects returned database errors instead of reporting a false success', async () => {
  const service = require('../src/main/supabaseService');
  const originalSecureRequest = service.secureRequest;
  service.secureRequest = async () => { throw new Error('DB rejected'); };

  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    await assert.rejects(
      service.saveGiveawayWinner({ id: 'winner-error', username: 'testuser' }, 'marved'),
      /DB rejected/
    );
  } finally {
    console.error = originalConsoleError;
    service.secureRequest = originalSecureRequest;
  }
});

test('explicit reward type is persisted schema-compatibly for pending winners', async () => {
  const service = require('../src/main/supabaseService');
  let savedRow;
  const originalSecureRequest = service.secureRequest;
  service.secureRequest = async (_action, payload) => { savedRow = payload.winner; return savedRow; };

  await service.saveGiveawayWinner({
    id: 'winner-explicit-type',
    username: 'testuser',
    prize: '1KG Kohle als Giveaway',
    type: 'giveaway'
  }, 'marved');

  assert.equal(savedRow.address.rewardType, 'giveaway');
  assert.equal(Object.hasOwn(savedRow, 'type'), false);
  service.secureRequest = originalSecureRequest;
});

test('release metadata is bumped to 8.0.2', () => {
  const pkg = JSON.parse(read('package.json'));
  const index = read('src/renderer/index.html');

  assert.equal(pkg.version, '8.0.2');
  assert.match(index, /id="app-version-tag">v8\.0\.2</);
});
