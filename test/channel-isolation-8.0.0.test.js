const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DatabaseService = require('../src/main/dbService');

function createTempDatabase(t) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'swg-channel-isolation-'));
  const service = new DatabaseService();
  service.dataPath = tempDir;
  service.dbPath = path.join(tempDir, 'setup_database.json');
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));
  return service;
}

test('local giveaway addresses are isolated by channel for read, update and delete', async (t) => {
  const service = createTempDatabase(t);
  await service.saveGiveawayWinner({ id: 'marved-win', username: 'alice', address: { city: 'Berlin' } }, 'marved');
  await service.saveGiveawayWinner({ id: 'other-win', username: 'bob', address: { city: 'Hamburg' } }, 'other_channel');

  assert.deepEqual((await service.getGiveawayWinners('marved')).map(w => w.id), ['marved-win']);
  assert.deepEqual((await service.getGiveawayWinners('other_channel')).map(w => w.id), ['other-win']);

  await service.updateGiveawayWinner('marved-win', { status: 'changed' }, 'other_channel');
  assert.equal((await service.getGiveawayWinners('marved'))[0].status, undefined);

  await service.deleteGiveawayWinner('marved-win', 'other_channel');
  assert.deepEqual((await service.getGiveawayWinners('marved')).map(w => w.id), ['marved-win']);

  // Even an accidental duplicate id must not overwrite another channel's address.
  await service.saveGiveawayWinner({ id: 'shared-id', username: 'marved-user', address: { city: 'Köln' } }, 'marved');
  await service.saveGiveawayWinner({ id: 'shared-id', username: 'other-user', address: { city: 'Bonn' } }, 'other_channel');
  assert.equal((await service.getGiveawayWinners('marved')).find(w => w.id === 'shared-id').username, 'marved-user');
  assert.equal((await service.getGiveawayWinners('other_channel')).find(w => w.id === 'shared-id').username, 'other-user');
});

test('local mod chat and Q&A fallbacks never cross channel boundaries', async (t) => {
  const service = createTempDatabase(t);
  await service.sendModChatMessage({ id: 'm1', text: 'Marved intern' }, 'marved');
  await service.sendModChatMessage({ id: 'm2', text: 'Other intern' }, 'other_channel');
  await service.saveQnAQuestions([{ id: 'q1', question: 'Marved?' }], 'marved');
  await service.saveQnAQuestions([{ id: 'q2', question: 'Other?' }], 'other_channel');

  assert.deepEqual((await service.getModChatMessages('marved')).map(m => m.id), ['m1']);
  assert.deepEqual((await service.getModChatMessages('other_channel')).map(m => m.id), ['m2']);
  assert.deepEqual((await service.getQnAQuestions('marved')).map(q => q.id), ['q1']);
  assert.deepEqual((await service.getQnAQuestions('other_channel')).map(q => q.id), ['q2']);

  await service.clearModChatMessages('other_channel');
  assert.deepEqual((await service.getModChatMessages('marved')).map(m => m.id), ['m1']);
});

test('legacy local rows without channel remain in the original marved workspace only', async (t) => {
  const service = createTempDatabase(t);
  fs.writeFileSync(path.join(service.dataPath, 'giveaway_winners.json'), JSON.stringify([{ id: 'legacy', username: 'legacy-user' }]));

  assert.equal((await service.getGiveawayWinners('marved')).length, 1);
  assert.equal((await service.getGiveawayWinners('other_channel')).length, 0);
});

test('cloud, IPC and web access paths enforce the active channel', () => {
  const supabaseSource = fs.readFileSync(path.join(__dirname, '../src/main/supabaseService.js'), 'utf8');
  const mainSource = fs.readFileSync(path.join(__dirname, '../src/main/main.js'), 'utf8');
  const qnaSource = fs.readFileSync(path.join(__dirname, '../docs/qna.html'), 'utf8');
  const claimSource = fs.readFileSync(path.join(__dirname, '../docs/claim.html'), 'utf8');
  const edgeSource = fs.readFileSync(path.join(__dirname, '../supabase/functions/channel-api/index.ts'), 'utf8');
  const lockdown = fs.readFileSync(path.join(__dirname, '../scripts/supabase_lockdown_8_0_1.sql'), 'utf8');
  const migration = fs.readFileSync(path.join(__dirname, '../scripts/supabase_channel_isolation_8_0_1.sql'), 'utf8');

  assert.match(mainSource, /function requireAuthorizedActiveChannel/);
  assert.match(mainSource, /Daten dürfen nur für den aktiven Kanal/);
  assert.doesNotMatch(mainSource, /fallback = await dbService\.getGiveawayWinners/);
  for (const method of ['getWatchlist', 'getModChat', 'getGiveaways', 'getBestrafungen']) {
    assert.match(supabaseSource, new RegExp(`async ${method}\\(channel`));
  }
  assert.doesNotMatch(qnaSource, /filtered = qData/);
  assert.match(qnaSource, /qna_questions\?channel=eq\./);
  assert.match(qnaSource, /bestrafungen\?channel=eq\./);
  assert.match(claimSource, /action:\s*'claim\.submit'/);
  assert.match(edgeSource, /\.eq\('channel', channel\)/);
  assert.match(edgeSource, /Globale Daten dürfen nur vom ShishaWG-Core-Team geändert werden/);
  assert.match(edgeSource, /Eine Datensatz-ID gehört bereits zu einem anderen Kanal/);
  assert.match(lockdown, /revoke all on table public\.giveaway_winners from anon, authenticated/);
  assert.match(lockdown, /revoke all on table public\.telegram_config from anon, authenticated/);
  assert.match(lockdown, /grant select \(channel, persons, active_person, wheel_enabled, display_duration, timer_state, updated_at\)/);
  assert.doesNotMatch(claimSource, /\.from\(['"]giveaway_winners['"]\)/);
  for (const table of ['mod_chat', 'mod_watchlist', 'bestrafungen', 'giveaway_winners']) {
    assert.match(migration, new RegExp(`alter table public\\.${table} add column if not exists channel text`));
  }
});
