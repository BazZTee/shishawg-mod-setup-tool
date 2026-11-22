'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const commands = require('../src/renderer/chatgames-commands.js');
const root = path.resolve(__dirname, '..');

test('ChatGames guide commands are available for all 21 games', () => {
  assert.equal(commands.games.length, 21);
  const actual = new Set([
    ...commands.games.flatMap(game => [game.open, ...(game.aliases || []), ...game.settings.map(item => item.command)]),
    ...commands.controls.map(item => item.command),
    ...commands.general.map(item => item.command),
    ...commands.viewer.map(item => item.command)
  ]);
  const guideCommands = [
    '!hangman', '!trivia', '!minigolf', '!golf', '!chess', '!chatships', '!memory', '!chatdle', '!marbles', '!backseat', '!car', '!sizeup', '!tierlist', '!tiers',
    '!home', '!dashboard', '!en', '!de', '!subonly', '!chatgameshelp', '!rank', '!top',
    '!start', '!cancel', '!skip', '!kick', '!unkick', '!next', '!restart', '!pause', '!resume', '!timer',
    '!vote', '!lobby', '!instantwin', '!category', '!poll', '!rounds', '!autojump',
    '!mode', '!course', '!courses', '!holes', '!playalong', '!theme', '!grace', '!maxplayers',
    '!latejoin', '!wind', '!collide', '!prediction', '!facecam',
    '!color', '!easymode', '!allowresign', '!showhistory', '!showcaptured',
    '!first', '!showvotes', '!track', '!tracks', '!size', '!words', '!pack', '!items',
    '!join', '!me', '!reset', '!marble', '!skin', '!skins', '!rate', '!stats', '!record', '!guess',
    '!wordrush', '!feud', '!brawl', '!hotseat', '!bossraid', '!pixel', '!mapguess', '!map',
    '!higherlower', '!hol', '!price', '!yearguess', '!again', '!daily', '!pro', '!pictures',
    '!intl', '!double', '!streaks', '!triviapack', '!endless', '!endless reset', '!cup', '!cup last',
    '!cap', '!tutorial', '!scoring', '!puzzle', '!hearts', '!handicap', '!fen', '!addtime',
    '!teams', '!team', '!median', '!bust', '!padlock', '!survey', '!contestant', '!boss',
    '!deck', '!currency', '!nogoingover', '!es', '!pt', '!fr', '!session', '!session reset',
    '!tonight', '!finale', '!chatgames'
  ];
  for (const command of guideCommands) assert.ok(actual.has(command), `${command} fehlt`);
});

test('ChatGames commands validate values before sending', () => {
  const trivia = commands.games.find(game => game.id === 'trivia');
  const golf = commands.games.find(game => game.id === 'golf');
  assert.equal(commands.build(trivia.settings.find(item => item.command === '!category'), 'Science & Nature'), '!category Science & Nature');
  assert.equal(commands.build(trivia.settings.find(item => item.command === '!rounds'), '5'), '!rounds 5');
  assert.equal(commands.build(golf.settings.find(item => item.command === '!holes'), 'all'), '!holes all');
  assert.equal(commands.build(golf.settings.find(item => item.command === '!courses'), 'pro'), '!courses pro');
  assert.equal(commands.build(golf.settings.find(item => item.command === '!theme'), 'paper'), '!theme paper');
  assert.equal(commands.build(commands.games.find(game => game.id === 'marbles').settings.find(item => item.command === '!tracks'), 'clear'), '!tracks clear');
  assert.equal(commands.build(commands.viewer.find(item => item.command === '!stats'), ''), '!stats');
  assert.equal(commands.build(commands.general.find(item => item.command === '!rank'), ''), '!rank');
  assert.equal(commands.build(commands.general.find(item => item.command === '!top'), 'trivia'), '!top trivia');
  assert.equal(commands.build(commands.controls.find(item => item.command === '!kick'), 'sir_bogey'), '!kick sir_bogey');
  assert.equal(commands.build(trivia.settings.find(item => item.command === '!rounds'), '100'), '!rounds 100');
  assert.throws(() => commands.build(trivia.settings.find(item => item.command === '!rounds'), '101'));
  assert.equal(commands.build(golf.settings.find(item => item.command === '!mode'), 'versus'), '!mode versus');
  assert.throws(() => commands.build(golf.settings.find(item => item.command === '!timer'), '9'));
  assert.throws(() => commands.build(commands.games.find(game => game.id === 'chatdle').settings.find(item => item.command === '!rounds'), '2'));
  assert.throws(() => commands.build(trivia.settings.find(item => item.command === '!category'), 'Flags\n!cancel'));
});

test('ChatGames view is reachable and uses existing Twitch chat channel', () => {
  const html = fs.readFileSync(path.join(root, 'src/renderer/index.html'), 'utf8');
  const workspace = fs.readFileSync(path.join(root, 'src/renderer/workspace.js'), 'utf8');
  const controller = fs.readFileSync(path.join(root, 'src/renderer/chatgames.js'), 'utf8');
  assert.doesNotMatch(html, /data-target="view-chatgames"/);
  assert.match(html, /id="view-chatgames"/);
  assert.match(html, /id="cg-send-chat" checked/);
  assert.match(html, /id="cg-picker"[\s\S]*id="cg-general"[\s\S]*id="cg-lobby"/);
  assert.match(html, /src="chatgames-commands\.js"[\s\S]*src="chatgames\.js"/);
  assert.match(workspace, /id: 'view-chatgames'/);
  assert.match(workspace, /const menuRoutes = routes\.filter\(route => route\.id !== 'view-chatgames'\)/);
  assert.match(workspace, /const commands = \[\.\.\.routes\.map/);
  assert.match(controller, /ipcRenderer\.invoke\('twitch:send-chat', \{/);
  assert.match(controller, /channel: state\.targetChannel/);
});

test('Game cards open only their lobby and lobby buttons send matching commands', async () => {
  class Element {
    constructor(tag = 'div') {
      this.tagName = tag.toUpperCase();
      this.children = [];
      this.dataset = {};
      this.handlers = {};
      this.classes = new Set();
      this.classList = {
        add: name => this.classes.add(name),
        remove: name => this.classes.delete(name),
        contains: name => this.classes.has(name),
        toggle: (name, force) => {
          if (force === undefined ? !this.classes.has(name) : force) this.classes.add(name);
          else this.classes.delete(name);
        }
      };
    }
    set className(value) { this.classes = new Set(value.split(/\s+/).filter(Boolean)); }
    get className() { return [...this.classes].join(' '); }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    addEventListener(type, handler) { this.handlers[type] = handler; }
    click() { return this.handlers.click?.(); }
    setAttribute() {}
    blur() {}
    scrollIntoView() {}
    querySelectorAll(selector) {
      const classes = selector.split(',').map(value => value.trim().slice(1));
      const found = [];
      const visit = element => {
        for (const child of element.children) {
          if (classes.some(name => child.classes.has(name))) found.push(child);
          visit(child);
        }
      };
      visit(this);
      return found;
    }
  }
  const ids = new Map();
  for (const id of ['view-chatgames', 'cg-status', 'cg-picker', 'cg-lobby', 'cg-games',
    'cg-controls', 'cg-general', 'cg-settings', 'cg-lobby-title', 'cg-lobby-help',
    'cg-back-games', 'cg-viewer-panel', 'cg-viewer', 'cg-send-chat']) ids.set(id, new Element());
  const get = id => ids.get(id);
  get('cg-send-chat').checked = true;
  get('cg-lobby').classList.add('hidden');
  get('view-chatgames').append(get('cg-picker'), get('cg-lobby'));
  get('cg-picker').append(get('cg-games'), get('cg-general'));
  get('cg-lobby').append(get('cg-back-games'), get('cg-controls'), get('cg-settings'), get('cg-viewer'));
  const sent = [];
  let failChess = true;
  let now = 10000;
  const context = {
    document: { getElementById: get, createElement: tag => new Element(tag) },
    window: { confirm: () => true, setTimeout: callback => callback() },
    Date: { now: () => now },
    ChatGamesCommands: commands,
    state: { twitchUser: { login: 'mod' }, targetChannel: 'marved' },
    isCurrentUserModerator: () => true,
    ipcRenderer: { invoke: async (_channel, payload) => {
      sent.push(payload.message);
      return { success: !(failChess && payload.message === '!chess') };
    } }
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'src/renderer/chatgames.js'), 'utf8'), context);
  assert.equal(get('cg-games').children.length, 21);
  assert.equal(get('cg-controls').children.length, 0);
  assert.ok(get('cg-general').children.length > 0);
  assert.equal(get('cg-settings').children.length, 0);

  await get('cg-games').children[1].click(); // Trivia
  assert.deepEqual(sent, ['!trivia']);
  assert.equal(get('cg-picker').classList.contains('hidden'), true);
  assert.equal(get('cg-lobby').classList.contains('hidden'), false);
  const commandNames = container => container.children.map(row => row.children[0].children[1].textContent.replace(' …', ''));
  assert.ok(commandNames(get('cg-settings')).includes('!category'));
  assert.ok(commandNames(get('cg-controls')).includes('!start'));
  assert.ok(commandNames(get('cg-controls')).includes('!next'));
  assert.ok(!commandNames(get('cg-controls')).includes('!pause'));
  assert.ok(!commandNames(get('cg-controls')).includes('!kick'));
  assert.ok(commandNames(get('cg-general')).includes('!dashboard'));
  assert.ok(commandNames(get('cg-general')).includes('!rank'));

  now += 1200;
  const startRow = get('cg-controls').children.find(row => row.children[0].children[1].textContent === '!start');
  await startRow.children[1].children.at(-1).click();
  assert.deepEqual(sent, ['!trivia', '!start']);
  get('cg-back-games').click();
  assert.equal(get('cg-picker').classList.contains('hidden'), false);
  assert.equal(get('cg-lobby').classList.contains('hidden'), true);
  assert.equal(sent.length, 2, 'Local back action does not send a chat command');

  now += 1200;
  await get('cg-games').children[2].click(); // Mini Golf
  assert.equal(sent.at(-1), '!minigolf');
  assert.ok(commandNames(get('cg-controls')).includes('!pause'));
  assert.ok(commandNames(get('cg-controls')).includes('!kick'));
  assert.ok(!commandNames(get('cg-controls')).includes('!next'));
  get('cg-back-games').click();
  now += 1200;
  await get('cg-games').children[3].click(); // Failed Chess command
  assert.equal(get('cg-picker').classList.contains('hidden'), false);

  failChess = false;
  for (const [index, game] of commands.games.entries()) {
    now += 1200;
    await get('cg-games').children[index].click();
    assert.equal(sent.at(-1), game.open);
    assert.equal(get('cg-lobby').classList.contains('hidden'), false);
    assert.equal(get('cg-picker').classList.contains('hidden'), true);
    assert.ok(commandNames(get('cg-controls')).includes('!start'));
    assert.ok(commandNames(get('cg-general')).includes('!home'));
    for (const setting of game.settings) assert.ok(commandNames(get('cg-settings')).includes(setting.command), `${game.id}: ${setting.command}`);
    assert.equal(get('cg-viewer-panel').classList.contains('hidden'), !['marbles', 'hangman'].includes(game.id));
    if (game.id === 'marbles') assert.ok(commandNames(get('cg-viewer')).includes('!join'));
    if (game.id === 'hangman') assert.ok(commandNames(get('cg-viewer')).includes('!guess'));
    get('cg-back-games').click();
    assert.equal(get('cg-picker').classList.contains('hidden'), false);
  }

  get('cg-send-chat').checked = false;
  get('cg-send-chat').handlers.change();
  const beforePreview = sent.length;
  await get('cg-games').children[0].click();
  assert.equal(get('cg-lobby').classList.contains('hidden'), false);
  assert.match(get('cg-lobby-help').textContent, /Vorschau/);
  const previewStart = get('cg-controls').children.find(row => row.children[0].children[1].textContent === '!start');
  assert.equal(previewStart.children[1].children.at(-1).textContent, 'Testen');
  await previewStart.children[1].children.at(-1).click();
  get('cg-back-games').click();
  const previewHome = get('cg-general').children.find(row => row.children[0].children[1].textContent === '!home');
  await previewHome.children[1].children.at(-1).click();
  assert.equal(sent.length, beforePreview, 'Preview mode must never send chat commands');
  assert.equal(get('cg-picker').classList.contains('hidden'), false);

  get('cg-send-chat').checked = true;
  get('cg-send-chat').handlers.change();
  now += 1200;
  await get('cg-games').children[0].click();
  assert.equal(sent.at(-1), commands.games[0].open, 'Chat sending resumes after enabling toggle');
});
