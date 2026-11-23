const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('private messages are fetched for the signed-in recipient only', () => {
  const edge = read('supabase/functions/channel-api/index.ts');
  assert.match(edge, /direct\.inbox/);
  assert.match(edge, /\.eq\('recipient_user_id', recipientId\)/);
  assert.match(read('src/main/main.js'), /'modchat:get-direct-inbox'/);
  assert.match(read('src/main/preload.js'), /"modchat:get-direct-inbox"/);
});

test('private messages notify like the team chat', () => {
  const renderer = read('src/renderer/modules/05-mod-hq.js');
  assert.match(renderer, /function checkDirectInbox/);
  assert.match(renderer, /playNotificationSound\(\);\s*const latest = toDirectNotificationMessage/);
  assert.match(renderer, /kind: 'direct'/);
  assert.match(renderer, /original\.direct/);
  assert.match(read('src/renderer/modules/01-workspace.js'), /startDirectInboxWatcher\(\)/);
  assert.match(read('src/main/main.js'), /Neue private Nachricht von/);
  assert.match(read('src/renderer/mod-direct-chat.js'), /window\.swgDirectChat/);
});
