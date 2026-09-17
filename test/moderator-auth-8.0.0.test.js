const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const TwitchService = require('../src/main/twitchService');

test('TwitchService recognizes core team members and channel broadcaster as authorized mods', async () => {
  const fakeStore = {
    get(key, fallback) {
      if (key === 'target_channel') return 'marved';
      return fallback;
    },
    set() {},
    delete() {}
  };

  const service = new TwitchService(null, fakeStore);

  // Broadcaster
  const marvedCheck = await service.checkUserIsModerator({ login: 'marved', id: '123' }, 'fake_token');
  assert.equal(marvedCheck.isModerator, true);
  assert.equal(marvedCheck.isBroadcaster, true);

  // Core mods
  const bazzteeCheck = await service.checkUserIsModerator({ login: 'bazzteedj', id: '456' }, 'fake_token');
  assert.equal(bazzteeCheck.isModerator, true);

  const flashmobCheck = await service.checkUserIsModerator({ login: 'flashmobnbg', id: '789' }, 'fake_token');
  assert.equal(flashmobCheck.isModerator, true);

  // Unknown user without valid token / Helix response
  const strangerCheck = await service.checkUserIsModerator({ login: 'randomviewer99', id: '999' }, '');
  assert.equal(strangerCheck.isModerator, false);
  assert.equal(strangerCheck.isBroadcaster, false);
});

test('isUserAuthorizedMod protects sensitive operations against non-mods', () => {
  const fakeStore = {
    get(key, fallback) {
      if (key === 'target_channel') return 'marved';
      return fallback;
    },
    set() {},
    delete() {}
  };

  const service = new TwitchService(null, fakeStore);

  service.user = null;
  assert.equal(service.isUserAuthorizedMod(), false);

  service.user = { login: 'randomviewer', isModerator: false, isBroadcaster: false };
  assert.equal(service.isUserAuthorizedMod(), false);

  service.user = { login: 'verifiedmod', isModerator: true, isBroadcaster: false };
  assert.equal(service.isUserAuthorizedMod(), true);

  service.user = { login: 'bazztee', isModerator: false }; // core team override
  assert.equal(service.isUserAuthorizedMod(), true);
});

test('renderer defines isCurrentUserModerator and guards workspace access', () => {
  const renderer = fs.readFileSync(path.join(__dirname, '../src/renderer/renderer.js'), 'utf8');
  assert.match(renderer, /function isCurrentUserModerator\(\)/);
  assert.match(renderer, /isCurrentUserModerator\(\)/);
  assert.match(renderer, /Kein Mod/);
});
