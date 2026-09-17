const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('Mod-HQ provides equal chat columns, a shared pinboard and public Twitch composer', () => {
  const workspace = read('src/renderer/mod-hq-workspace.js');
  const styles = read('src/renderer/mod-hq-workspace.css');

  assert.match(workspace, /layout\.replaceChildren\(teamChat, publicCard, agreements, toolsGrid\)/);
  assert.match(workspace, /ipcRenderer\.invoke\('twitch:send-chat', \{ message: text, channel: channel\(\) \}\)/);
  assert.match(styles, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\) !important/);
  assert.match(styles, /#view-modchat \.hq-agreements \{[\s\S]*?grid-column: 1 \/ -1/);
});

test('both Mod-HQ chat composers grow to multiple lines and keep Enter-to-send', () => {
  const html = read('src/renderer/index.html');
  const modChat = read('src/renderer/modules/05-mod-hq.js');
  const workspace = read('src/renderer/mod-hq-workspace.js');
  const baseStyles = read('src/renderer/styles.css');
  const workspaceStyles = read('src/renderer/mod-hq-workspace.css');

  assert.match(html, /<textarea id="input-mod-chat"[\s\S]*?rows="1"><\/textarea>/);
  assert.match(modChat, /lineHeight \* 4/);
  assert.match(modChat, /Math\.max\(minHeight, Math\.min\(input\.scrollHeight, maxHeight\)\)/);
  assert.match(modChat, /e\.key === 'Enter' && !e\.shiftKey/);
  assert.match(workspace, /event\.key === 'Enter' && !event\.shiftKey/);
  assert.match(baseStyles, /\.chat-input-row textarea \{[\s\S]*?min-height: 58px;[\s\S]*?max-height: 104px;/);
  assert.match(workspaceStyles, /#view-modchat \.hq-public-input \{[\s\S]*?min-height: 58px;[\s\S]*?max-height: 104px;/);
  assert.match(workspaceStyles, /#view-modchat \.mod-chat-messages \{[\s\S]*?max-height: none;/);
});

test('dashboard Mod-HQ composer grows to multiple lines and keeps Shift+Enter', () => {
  const dashboard = read('src/renderer/modules/11-dashboard.js');
  const baseStyles = read('src/renderer/styles.css');

  assert.match(dashboard, /<textarea id="cw-modchat-input"[\s\S]*?rows="1"><\/textarea>/);
  assert.match(dashboard, /input\.addEventListener\('input', \(\) => resizeChatComposer\(input\)\)/);
  assert.match(dashboard, /e\.key === 'Enter' && !e\.shiftKey/);
  assert.match(dashboard, /resizeChatComposer\(inputEl\)/);
  assert.match(baseStyles, /\.cw-chat-input \{[\s\S]*?min-height: 36px;[\s\S]*?max-height: 104px;[\s\S]*?resize: none;/);
});

test('public Twitch users receive their Twitch color or a stable fallback color', () => {
  const workspace = read('src/renderer/mod-hq-workspace.js');

  assert.match(workspace, /nameText\.style\.color = getChatterColor\(m\)/);
  assert.match(workspace, /color: tags\.color \|\| ''/);
  assert.match(workspace, /const palette = \[/);
});

test('Mod Team chat offers a hovering quote reply control and renders replies', () => {
  const modChat = read('src/renderer/modules/05-mod-hq.js');
  const dashboard = read('src/renderer/modules/11-dashboard.js');
  const styles = read('src/renderer/styles.css');

  assert.match(modChat, /function startModChatReply\(message\)/);
  assert.match(modChat, /class="mod-chat-reply-btn"/);
  assert.match(modChat, /data-reply-index="\$\{messageIndex\}"/);
  assert.match(modChat, /\^\\\[Antwort auf @\?/);
  assert.match(modChat, /class="mod-reply-preview"/);
  assert.match(dashboard, /cw-mod-reply-preview/);
  assert.match(styles, /\.mod-chat-reply-btn \{[\s\S]*?top: -13px;[\s\S]*?opacity: 0;/);
  assert.match(styles, /\.mod-chat-msg-row:hover \.mod-chat-reply-btn/);
  assert.match(styles, /\.mod-reply-preview,[\s\S]*?background: #566170;[\s\S]*?text-overflow: ellipsis;/);
});
