const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('presence storage is channel scoped and locked behind the edge function', () => {
  const sql = read('scripts/supabase_mod_presence_8_0_2.sql');
  assert.match(sql, /primary key \(channel, twitch_user_id\)/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /revoke all on table public\.mod_presence from anon, authenticated/i);

  const edge = read('supabase/functions/channel-api/index.ts');
  assert.match(edge, /presence\.heartbeat/);
  assert.match(edge, /presence\.list/);
  assert.match(edge, /twitch_user_id: twitchUserId/);
});

test('mod chat shows online-first presence without exposing tokens', () => {
  const renderer = read('src/renderer/modules/05-mod-hq.js');
  assert.match(renderer, /MOD_PRESENCE_ONLINE_MS = 90 \* 1000/);
  assert.match(renderer, /onlineDifference/);
  assert.match(renderer, /setInterval\(sendModPresenceHeartbeat, 30000\)/);
  assert.doesNotMatch(renderer, /accessToken|twitchToken/);

  const html = read('src/renderer/index.html');
  assert.match(html, /id="btn-toggle-mod-presence"/);
  assert.match(html, /id="mod-presence-list"/);
});
