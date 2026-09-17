const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'src/main/main.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'src/renderer/index.html'), 'utf8');
const renderer = fs.readFileSync(path.join(root, 'src/renderer/renderer.js'), 'utf8');
const contract = JSON.parse(fs.readFileSync(path.join(root, 'src/shared/ipc-contract.json'), 'utf8'));

test('native Mod-Chat notification shows sender and message and opens quick reply on click', () => {
  assert.match(main, /new Notification\(\{[\s\S]*?title: `Neue Mod-Chat-Nachricht von \$\{message\.senderName\}`[\s\S]*?body: message\.text/);
  assert.match(main, /notification\.on\('click',[\s\S]*?mainWindow\.webContents\.send\('modchat:notification-clicked', message\)/);
  assert.ok(contract.events.includes('modchat:notification-clicked'));
  assert.match(renderer, /ipcRenderer\.on\('modchat:notification-clicked'/);
  assert.match(indexHtml, /id="mod-chat-quick-reply-original-text"/);
  assert.match(indexHtml, /id="input-mod-chat-quick-reply"/);
});

test('quick reply uses the same quoted reply header and shared send path as Mod-HQ', () => {
  assert.match(renderer, /function buildModChatReplyHeader\(message\)/);
  assert.match(renderer, /return `\[Antwort auf @\$\{sender\}\] \$\{quotedText\}`/);
  assert.match(renderer, /const text = `\$\{buildModChatReplyHeader\(pendingModChatQuickReplyMessage\)\}\\n\$\{answer\}`/);
  assert.match(renderer, /const sent = await postModChatText\(text\)/);
  assert.match(renderer, /ipcRenderer\.invoke\('modchat:send-message', msgObj\)/);
});

test('foreground notifications open quick reply in-app while visible chat suppresses them', () => {
  assert.match(renderer, /const isActivelyInChat = \(\(currentActiveView === 'view-modchat'\) \|\| hasDashboardChat\) && isWindowFocused/);
  assert.match(renderer, /if \(isWindowFocused\) \{[\s\S]*?showToast\([\s\S]*?onClick: \(\) => openModChatQuickReply\(latest\)/);
  assert.match(renderer, /else \{[\s\S]*?ipcRenderer\.invoke\('app:notify-background', \{ kind: 'modchat', message: latest \}\)/);
  assert.match(renderer, /function showToast\(msg, type = 'info', options = \{\}\)/);
  assert.match(renderer, /toastBanner\.setAttribute\('role', 'button'\)/);
});
