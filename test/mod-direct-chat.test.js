const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('private messages cannot be read through public Supabase roles or generic channel access', () => {
  const sql = read('scripts/supabase_mod_direct_messages_8_0_2.sql');
  const edge = read('supabase/functions/channel-api/index.ts');
  assert.match(sql, /alter table public\.mod_direct_messages enable row level security/i);
  assert.match(sql, /revoke all on table public\.mod_direct_messages from public, anon, authenticated/i);
  assert.doesNotMatch(edge.match(/const channelTables = new Map\(\[([\s\S]*?)\]\)/)?.[1] || '', /mod_direct_messages/);
  assert.doesNotMatch(edge.match(/const globalTables = new Set\(\[([\s\S]*?)\]\)/)?.[1] || '', /mod_direct_messages/);
});

test('direct message actions derive sender from verified Twitch identity and restrict both participant IDs', () => {
  const edge = read('supabase/functions/channel-api/index.ts');
  assert.match(edge, /const twitchUser = await validateTwitchToken\(twitchToken\);[\s\S]*?await isModerator\(twitchToken, twitchUser, channel\)/);
  assert.match(edge, /direct\.list'[\s\S]*?listDirectMessages\(channel, twitchUser, body\.recipientId\)/);
  assert.match(edge, /direct\.send'[\s\S]*?sendDirectMessage\(channel, twitchUser, body\)/);
  assert.match(edge, /const senderId = twitchId\(user\.user_id\)/);
  assert.match(edge, /\.eq\('channel', channel\)[\s\S]*?\.or\(`and\(sender_user_id\.eq\.\$\{senderId\},recipient_user_id\.eq\.\$\{recipient\.twitch_user_id\}\),and\(sender_user_id\.eq\.\$\{recipient\.twitch_user_id\},recipient_user_id\.eq\.\$\{senderId\}\)`\)/);
  assert.doesNotMatch(edge.match(/async function sendDirectMessage[\s\S]*?\n}\n/)?.[0] || '', /body\.sender/);
});

test('private chat has dedicated IPC and escapes message text', () => {
  const contract = JSON.parse(read('src/shared/ipc-contract.json'));
  const main = read('src/main/main.js');
  const ui = read('src/renderer/mod-direct-chat.js');
  assert.ok(contract.invoke.includes('modchat:get-direct-messages'));
  assert.ok(contract.invoke.includes('modchat:send-direct-message'));
  assert.match(main, /modchat:get-direct-messages'[\s\S]*?requireAuthorizedActiveChannel\(\)/);
  assert.match(main, /modchat:send-direct-message'[\s\S]*?requireAuthorizedActiveChannel\(\)/);
  assert.match(ui, /make\('span', '', item\.message \|\| ''\)/);
  assert.doesNotMatch(ui, /innerHTML/);
});
