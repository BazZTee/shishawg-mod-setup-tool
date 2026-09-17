const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

test('twitchService exposes deleteChatMessage, timeoutUser, and banUser with proper moderation scopes', () => {
  const serviceCode = fs.readFileSync(path.join(root, 'src/main/twitchService.js'), 'utf8');
  assert.ok(serviceCode.includes('deleteChatMessage('), 'deleteChatMessage must be defined');
  assert.ok(serviceCode.includes('timeoutUser('), 'timeoutUser must be defined');
  assert.ok(serviceCode.includes('banUser('), 'banUser must be defined');
  assert.ok(serviceCode.includes('moderator:manage:chat_messages'), 'moderator:manage:chat_messages scope must be present');
  assert.ok(serviceCode.includes('moderator:manage:banned_users'), 'moderator:manage:banned_users scope must be present');
});

test('main.js handles moderation actions via twitch:send-chat', () => {
  const mainCode = fs.readFileSync(path.join(root, 'src/main/main.js'), 'utf8');
  assert.ok(mainCode.includes("payload.action === 'delete'"), 'delete action must be handled');
  assert.ok(mainCode.includes("payload.action === 'timeout'"), 'timeout action must be handled');
  assert.ok(mainCode.includes("payload.action === 'ban'"), 'ban action must be handled');
});

test('mod-hq-workspace.js contains Pinnwand and Mod Popover logic', () => {
  const wsCode = fs.readFileSync(path.join(root, 'src/renderer/mod-hq-workspace.js'), 'utf8');
  assert.ok(wsCode.includes('Angeheftete Pinnwand'), 'Pinnwand title must be present');
  assert.ok(wsCode.includes('openModPopover'), 'openModPopover must be present');
  assert.ok(wsCode.includes('hq-mod-popover'), 'hq-mod-popover class must be used');
  assert.ok(wsCode.includes('hq-chatter-clickable'), 'hq-chatter-clickable class must be used');
  assert.ok(wsCode.includes("userId: tags['user-id']"), 'tags user-id must be parsed');
});

test('renderer.js renders pinnwand-bubble and twitch-quote-bubble for special messages', () => {
  const rendererCode = fs.readFileSync(path.join(root, 'src/renderer/renderer.js'), 'utf8');
  assert.ok(rendererCode.includes('pinnwand-bubble'), 'pinnwand-bubble styling must be rendered in renderer.js');
  assert.ok(rendererCode.includes('twitch-quote-bubble'), 'twitch-quote-bubble styling must be rendered in renderer.js');
});
