const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TwitchService = require('../src/main/twitchService');
const supabaseService = require('../src/main/supabaseService');
const DatabaseService = require('../src/main/dbService');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

function createListener(t, botLogin = 'marvedbot') {
  const fakeStore = { get: (key, fallback) => fallback, set() {}, delete() {} };
  const service = new TwitchService(null, fakeStore);
  service.connectIRC = () => {};
  service.sendToRenderer = () => {};
  const saved = [];
  const originalSave = supabaseService.saveGiveawayWinner;
  const originalCfg = supabaseService.getTelegramConfig;
  supabaseService.saveGiveawayWinner = async (item, chan, options) => { saved.push({ item, chan, options }); return true; };
  supabaseService.getTelegramConfig = async () => null;
  t.after(() => {
    supabaseService.saveGiveawayWinner = originalSave;
    supabaseService.getTelegramConfig = originalCfg;
  });
  const result = service.startChannelPointsListener('marved', false, botLogin);
  return { service, saved, result, handler: service.messageHandlers.get('channelpoints') };
}

const announcement = 'audit_user hat 1KG Kohle für 70000 eingelöst!';

test('F13: redemption text from a normal viewer creates no prize', async (t) => {
  const { saved, handler } = createListener(t);
  await handler({ login: 'audit_user', text: announcement, tags: { id: 'aaaaaaaa-1111-2222-3333-444444444444' } });
  assert.equal(saved.length, 0);
});

test('F13/F14: bot announcement creates a create-only prize keyed by the IRC message id', async (t) => {
  const { saved, handler } = createListener(t);
  const msg = { login: 'marvedbot', text: announcement, tags: { id: 'bbbbbbbb-1111-2222-3333-444444444444' } };
  await handler(msg);
  await handler(msg);
  assert.equal(saved.length, 1, 'the same IRC message is processed once');
  assert.equal(saved[0].item.id, 'kp_marved_bbbbbbbb-1111-2222-3333-444444444444');
  assert.deepEqual(saved[0].options, { createOnly: true });
});

test('F13: listener refuses to start without a valid bot name and drops an old handler', (t) => {
  const { service } = createListener(t);
  const result = service.startChannelPointsListener('other', false, '');
  assert.equal(result.success, false);
  assert.equal(service.messageHandlers.has('channelpoints'), false);
});

test('F14: fallback ids differ per prize in the same minute', () => {
  const now = Date.UTC(2026, 10, 22, 20, 1);
  const coal = TwitchService.channelPointsWinnerId('marved', 'alice', '1KG Kohle', '', now);
  const cube = TwitchService.channelPointsWinnerId('marved', 'alice', '1KG Zauberwürfel', '', now);
  assert.notEqual(coal, cube);
  assert.match(coal, /^kp_marved_alice_\d+_[0-9a-f]{10}$/);
});

test('F14: edge function supports create-only giveaway writes', () => {
  const edge = read('supabase/functions/channel-api/index.ts');
  assert.match(edge, /ignoreDuplicates: true/);
  assert.match(edge, /upsertGiveaway\(channel, body\.winner \|\| \{\}, body\.createOnly === true\)/);
});

test('F16: local Telegram config is stored per channel without cross-channel fallback', async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'swg-telegram-'));
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));
  const db = new DatabaseService();
  db.dataPath = tempDir;
  db.dbPath = path.join(tempDir, 'setup_database.json');

  fs.writeFileSync(path.join(tempDir, 'telegram_config.json'), JSON.stringify({ botToken: 'legacy', chatId: '1' }));
  await db.saveTelegramConfig({ botToken: 'kai-token', chatId: '2' }, 'kai');

  assert.equal((await db.getTelegramConfig('marved')).botToken, 'legacy', 'legacy file stays with marved');
  assert.equal((await db.getTelegramConfig('kai')).botToken, 'kai-token');
  assert.equal((await db.getTelegramConfig('third')).botToken, '', 'unknown channel inherits nothing');
});

test('F16: profile loading uses global legacy Telegram values only for marved', () => {
  const main = read('src/main/main.js');
  assert.match(main, /const localToken = isLegacyChannel \? store\.get\('telegram_bot_token', ''\) : '';/);
  assert.doesNotMatch(main, /dbService\.getTelegramConfig\(\)/);
});

test('F02: claim page renders URL and OAuth values only as text', () => {
  const claim = read('docs/claim.html');
  assert.doesNotMatch(claim, /innerHTML/);
  assert.match(claim, /TWITCH_LOGIN_RE = \/\^\[a-z0-9_\]\{1,25\}\$\//);
});

test('F28: unknown stream status never ends the session; reset waits for archive', () => {
  const workspace = read('src/renderer/modules/01-workspace.js');
  assert.match(workspace, /if \(!res \|\| res\.success === false\) \{\s*showUnknownStreamStatus\(channel\);\s*return;/);
  assert.match(workspace, /consecutiveOfflineChecks >= STREAM_OFFLINE_CONFIRMATIONS/);
  assert.match(workspace, /const saved = await autoArchiveFinishedSession\([^)]*\);\s*if \(saved\) \{\s*resetActiveTimer\(\);/);
  const stats = read('src/renderer/modules/09-stats-timers.js');
  assert.match(stats, /return Boolean\(result && \(result\.success \|\| result\.localSaved\)\);/);
});
