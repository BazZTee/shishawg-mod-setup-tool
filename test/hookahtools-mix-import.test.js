const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const https = require('node:https');
const { EventEmitter } = require('node:events');
const DatabaseService = require('../src/main/dbService');

function mockLiveMixPages(pages, details = []) {
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
        response.emit('data', JSON.stringify(options.path.startsWith('/rest/v1/flavors?') ? details : (pages.shift() || [])));
        response.emit('end');
      });
    };
    return request;
  };
  return { requests, restore: () => { https.request = original; } };
}

test('HookahTools live RPC finds recent Marv mix and keeps brand, tobacco, percentages', async () => {
  const recent = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const pages = [Array.from({ length: 50 }, (_, index) => ({
    mix_id: `other-${index}`, creator: { nickname: 'Other' }, created_at: recent, flavors: []
  })), [{
    mix_id: 'marv-mix', creator: { nickname: 'Marv' }, created_at: recent,
    flavors: [
      { flavor_id: 'aino-black', brand_name: 'Aino', name: 'Black', percentage: 58 },
      { flavor_id: 'blackburn-roze-t', brand_name: 'Blackburn', name: 'Roze T', percentage: 29 },
      { flavor_id: 'musth-early-gre', brand_name: 'MustH', name: 'Early Grey', percentage: 13 }
    ]
  }]];
  const mock = mockLiveMixPages(pages, [
    { id: 'aino-black', line: 'Strong' },
    { id: 'blackburn-roze-t', line: 'main' },
    { id: 'musth-early-gre', line: null }
  ]);
  try {
    const mix = await new DatabaseService().fetchCurrentMarvHookahToolsMix();
    assert.equal(mix.mixId, 'marv-mix');
    assert.deepEqual(mix.flavors, [
      { name: 'Aino Strong - Black', percentage: 58 },
      { name: 'Blackburn - Roze T', percentage: 29 },
      { name: 'MustH - Early Grey', percentage: 13 }
    ]);
    assert.equal(mock.requests[0].options.path, '/rest/v1/rpc/get_live_mixes');
    assert.deepEqual(mock.requests.filter(request => request.params).map(request => request.params.p_offset), [0, 50]);
    assert.match(mock.requests[2].options.path, /flavors\?select=id,line&id=in/);
  } finally {
    mock.restore();
  }
});

test('HookahTools import rejects stale and incomplete mixes without changing setup', async () => {
  const old = new Date(Date.now() - 31 * 60 * 1000).toISOString();
  const mock = mockLiveMixPages([[{
    mix_id: 'old', creator: { nickname: 'Marv' }, created_at: old,
    flavors: [{ brand_name: 'Aino', name: 'Black', percentage: 100 }]
  }]]);
  try {
    assert.equal(await new DatabaseService().fetchCurrentMarvHookahToolsMix(), null);
  } finally {
    mock.restore();
  }

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
