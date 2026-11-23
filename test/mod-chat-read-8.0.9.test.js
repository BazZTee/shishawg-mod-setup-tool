const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('read receipts are stored per mod in mod_presence via the edge function', () => {
  const sql = read('scripts/supabase_mod_chat_read_8_0_9.sql');
  assert.match(sql, /add column if not exists chat_read_at timestamptz/i);

  const edge = read('supabase/functions/channel-api/index.ts');
  assert.match(edge, /presence\.read/);
  assert.match(edge, /chat_read_at\.lt\./);
  assert.match(edge, /last_seen_at,chat_read_at/);

  assert.match(read('src/main/main.js'), /'modchat:mark-read'/);
  assert.match(read('src/main/preload.js'), /"modchat:mark-read"/);
});

test('mod chat opens at the newest message and renders read avatars', () => {
  const renderer = read('src/renderer/modules/05-mod-hq.js');
  assert.match(renderer, /openModChatAtLatestMessage\(\)/);
  assert.match(renderer, /renderModChatReadRow\(readMarkers\.get\(messageIndex\), isOwn\)/);
  assert.match(renderer, /isCurrentModPresenceUser\(user\)/);
  assert.match(read('src/renderer/styles.css'), /\.mod-chat-read-avatar/);
});
