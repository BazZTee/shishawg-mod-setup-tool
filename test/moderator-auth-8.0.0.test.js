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

  const gawoCheck = await service.checkUserIsModerator({ login: 'Ga_Wo', id: '321' }, 'fake_token');
  assert.equal(gawoCheck.isModerator, true);

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

  service.user = { login: 'Ga_Wo', isModerator: false }; // known mod override
  assert.equal(service.isUserAuthorizedMod(), true);
});

test('IRC moderator verification is bound to the exact channel', () => {
  const fakeStore = {
    get(key, fallback) {
      if (key === 'target_channel') return 'marved';
      return fallback;
    },
    set() {},
    delete() {}
  };
  const service = new TwitchService(null, fakeStore);
  service.user = { login: 'verifiedmod', isModerator: true, isBroadcaster: false };
  service._ircVerifiedMod = true;
  service._ircVerifiedUser = 'verifiedmod';
  service._ircVerifiedChannel = 'marved';

  assert.equal(service.isUserAuthorizedMod(), true);
  service.setTargetChannel('another_channel');
  assert.equal(service._ircVerifiedMod, false);
  assert.equal(service.user.isModerator, false);
  assert.equal(service.isUserAuthorizedMod(), false);
});

test('IRC parser distinguishes GLOBALUSERSTATE from channel USERSTATE', () => {
  const fakeStore = { get(_key, fallback) { return fallback; }, set() {}, delete() {} };
  const service = new TwitchService(null, fakeStore);

  const globalState = service._parseIrcCommand('@badges=;mod=0 :tmi.twitch.tv GLOBALUSERSTATE');
  assert.equal(globalState.command, 'GLOBALUSERSTATE');
  assert.equal(globalState.channel, '');

  const channelState = service._parseIrcCommand('@badges=moderator/1;mod=1 :tmi.twitch.tv USERSTATE #Marved');
  assert.equal(channelState.command, 'USERSTATE');
  assert.equal(channelState.channel, 'marved');
});

test('moderated-channel lookup follows Twitch pagination until the target channel is found', async () => {
  const fakeStore = {
    get(key, fallback) {
      if (key === 'target_channel') return 'marved';
      return fallback;
    },
    set() {},
    delete() {}
  };
  const service = new TwitchService(null, fakeStore);
  service.probeIrcModeratorStatus = async () => false;
  const originalFetch = global.fetch;
  const requestedUrls = [];

  global.fetch = async (requestUrl) => {
    const request = String(requestUrl);
    requestedUrls.push(request);
    if (request.includes('/helix/users?login=')) {
      return { ok: true, json: async () => ({ data: [{ id: 'channel-1' }] }) };
    }
    if (request.includes('/helix/moderation/channels?') && !request.includes('after=')) {
      return { ok: true, json: async () => ({ data: [{ broadcaster_id: 'other' }], pagination: { cursor: 'next-page' } }) };
    }
    if (request.includes('after=next-page')) {
      return { ok: true, json: async () => ({ data: [{ broadcaster_id: 'channel-1', broadcaster_login: 'marved' }], pagination: {} }) };
    }
    throw new Error(`Unexpected request: ${request}`);
  };

  try {
    const result = await service.checkUserIsModerator({ login: 'some_mod', id: 'user-1' }, 'valid-token');
    assert.equal(result.isModerator, true);
    assert.equal(result.reason, 'helix_moderated_channels');
    assert.equal(requestedUrls.filter(url => url.includes('/helix/moderation/channels?')).length, 2);
    assert.match(requestedUrls[1], /first=100/);
    assert.match(requestedUrls[2], /after=next-page/);
  } finally {
    global.fetch = originalFetch;
  }
});

test('public Q&A settings reads do not return the broadcaster token', () => {
  const qnaSource = fs.readFileSync(path.join(__dirname, '../docs/qna.html'), 'utf8');

  assert.doesNotMatch(qnaSource, /qna_settings\?select=\*/);
  assert.match(qnaSource, /channel,persons,active_person,wheel_enabled,display_duration,timer_state,updated_at/);
});

test('broadcaster login requests scopes for both Polls and Predictions', () => {
  const twitchServiceSource = fs.readFileSync(path.join(__dirname, '../src/main/twitchService.js'), 'utf8');
  const qnaSource = fs.readFileSync(path.join(__dirname, '../docs/qna.html'), 'utf8');

  for (const source of [twitchServiceSource, qnaSource]) {
    assert.match(source, /channel:manage:polls/);
    assert.match(source, /channel:manage:predictions/);
  }
});

test('Q&A broadcaster login stores the token only through the protected channel API', () => {
  const qnaSource = fs.readFileSync(path.join(__dirname, '../docs/qna.html'), 'utf8');

  assert.match(qnaSource, /await secureDb\(['"]qna_settings['"], ['"]upsert['"]/);
  assert.match(qnaSource, /broadcaster_token:\s*token/);
  assert.match(qnaSource, /['"]x-twitch-token['"]:\s*twitchToken/);
  assert.doesNotMatch(qnaSource, /qna_settings\?on_conflict=channel/);
});

test('renderer defines isCurrentUserModerator and guards workspace access', () => {
  const renderer = fs.readFileSync(path.join(__dirname, '../src/renderer/renderer.js'), 'utf8');
  assert.match(renderer, /function isCurrentUserModerator\(\)/);
  assert.match(renderer, /isCurrentUserModerator\(\)/);
  assert.match(renderer, /Kein Mod/);
});
