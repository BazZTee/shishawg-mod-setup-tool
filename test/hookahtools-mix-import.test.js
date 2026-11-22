const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const https = require('node:https');
const { EventEmitter } = require('node:events');
const DatabaseService = require('../src/main/dbService');

function mockHookahTools(overlay, details = []) {
  const original = https.request;
  const requests = [];
  https.request = (options, callback) => {
    const request = new EventEmitter();
    request.setTimeout = () => {};
    request.end = body => {
      requests.push({ options, params: body ? JSON.parse(body) : null });
      const response = new EventEmitter();
      response.statusCode = 200;
      process.nextTick(() => {
        callback(response);
        response.emit('data', JSON.stringify(options.path.startsWith('/rest/v1/flavors?') ? details : overlay));
        response.emit('end');
      });
    };
    return request;
  };
  return { requests, restore: () => { https.request = original; } };
}

const OVERLAY_LINK = 'https://hookahtools.de/stream/AbC123_xyz-9?format=wide';

test('HookahTools overlay link imports the selected mix with brand, line, tobacco and percentages', async () => {
  const mock = mockHookahTools({
    found: true,
    nickname: 'Marv',
    bowl_size: 20,
    mix: {
      id: 'marv-mix',
      name: 'Abendmix',
      flavors: [
        { id: 'aino-black', brand: 'Aino', name: 'Black', color: '#000', percentage: 58 },
        { id: 'blackburn-roze-t', brand: 'Blackburn', name: 'Roze T', color: '#f0f', percentage: 29 },
        { id: 'musth-early-gre', brand: 'MustH', name: 'Early Grey', color: '#0f0', percentage: 13 }
      ]
    }
  }, [
    { id: 'aino-black', line: 'Strong' },
    { id: 'blackburn-roze-t', line: 'main' },
    { id: 'musth-early-gre', line: null }
  ]);
  try {
    const mix = await new DatabaseService().fetchHookahToolsOverlayMix(OVERLAY_LINK);
    assert.equal(mix.mixId, 'marv-mix');
    assert.equal(mix.name, 'Abendmix');
    assert.deepEqual(mix.flavors, [
      { name: 'Aino Strong - Black', percentage: 58 },
      { name: 'Blackburn - Roze T', percentage: 29 },
      { name: 'MustH - Early Grey', percentage: 13 }
    ]);
    assert.equal(mock.requests[0].options.path, '/rest/v1/rpc/get_stream_overlay');
    assert.deepEqual(mock.requests[0].params, { p_token: 'AbC123_xyz-9' });
    assert.match(mock.requests[1].options.path, /flavors\?select=id,line&id=in/);
  } finally {
    mock.restore();
  }
});

test('HookahTools overlay without mix, unknown link or missing link changes nothing', async () => {
  let mock = mockHookahTools({ found: true, nickname: 'Marv', mix: null });
  try {
    assert.equal(await new DatabaseService().fetchHookahToolsOverlayMix(OVERLAY_LINK), null);
  } finally {
    mock.restore();
  }
  mock = mockHookahTools({ found: false });
  try {
    await assert.rejects(new DatabaseService().fetchHookahToolsOverlayMix(OVERLAY_LINK), /kennt diesen Overlay-Link nicht/);
  } finally {
    mock.restore();
  }
  await assert.rejects(new DatabaseService().fetchHookahToolsOverlayMix(''), /Kein gültiger HookahTools-Overlay-Link/);
  assert.equal(DatabaseService.parseHookahToolsOverlayToken('https://hookahtools.de/profile'), '');
});

test('HookahTools mix is applied to the setup without touching the hardware', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/renderer/modules/02-setup.js'), 'utf8');
  const apply = source.match(/function applyMarvHookahToolsMix\(mix\) \{[\s\S]*?^\}/m)?.[0];
  assert.ok(apply);
  const state = { personCount: 1, persons: [{ name: 'Marvin', pipe: 'Futr', bowl: 'Cosmo', hmd: 'ONMO', tobaccos: ['Alt'], tobaccoAmounts: [''], tobaccoUnit: 'g' }] };
  let renders = 0;
  const context = vm.createContext({ state, renderPersonsGrid: () => { renders++; }, generateCommandString: () => {}, updatePersonCountLabel: () => {} });
  vm.runInContext(apply, context);
  assert.equal(context.applyMarvHookahToolsMix({ flavors: [{ name: 'Aino - Black', percentage: 58 }, { name: 'Blackburn - Roze T', percentage: 42 }] }), true);
  assert.deepEqual(state.persons[0].tobaccos, ['Aino - Black', 'Blackburn - Roze T']);
  assert.deepEqual(state.persons[0].tobaccoAmounts, ['58', '42']);
  assert.equal(state.persons[0].tobaccoUnit, '%');
  assert.equal(state.persons[0].pipe, 'Futr');
  assert.equal(state.persons[0].bowl, 'Cosmo');
  assert.equal(state.persons[0].hmd, 'ONMO');
  assert.equal(renders, 1);
  assert.equal(context.applyMarvHookahToolsMix({ flavors: [] }), false);
  assert.equal(renders, 1);

  state.persons = [{ name: '', pipe: '', bowl: '', hmd: '', tobaccos: [''] }];
  assert.equal(context.applyMarvHookahToolsMix({ flavors: [{ name: 'Aino Strong - Black', percentage: 100 }] }), true);
  assert.equal(state.personCount, 1);
  assert.equal(state.persons[0].name, 'Marvin');
  assert.deepEqual(state.persons[0].tobaccos, ['Aino Strong - Black']);
});
