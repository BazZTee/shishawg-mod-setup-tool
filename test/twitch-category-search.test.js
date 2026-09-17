const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { prioritizeExactCategory } = require('../src/shared/categorySearch');

const root = path.resolve(__dirname, '..');

test('exact Twitch category is shown before fuzzy matches', () => {
  const categories = [
    { id: '1', name: 'Bodycam: The Game' },
    { id: '2', name: 'BODYCAM' },
    { id: '3', name: 'Bodycam Horror' }
  ];

  const result = prioritizeExactCategory(categories, ' bodycam ');

  assert.deepEqual(result.map(category => category.id), ['2', '1', '3']);
});

test('Twitch category search considers up to 100 matches and keeps !setgame', () => {
  const serviceCode = fs.readFileSync(path.join(root, 'src/main/twitchService.js'), 'utf8');

  assert.match(serviceCode, /search\/categories\?query=\$\{encodeURIComponent\(query\.trim\(\)\)\}&first=100/);
  assert.match(serviceCode, /prioritizeExactCategory\(categories, query\)/);
  assert.match(serviceCode, /sendChatMessage\(`!setgame \$\{cleanGame\}`/);
});
