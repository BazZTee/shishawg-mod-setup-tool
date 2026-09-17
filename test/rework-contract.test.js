const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const contract = require('./fixtures/feature-contract.json');
const read = name => fs.readFileSync(path.join(root,name),'utf8');
const unique = values => [...new Set(values)].sort();
const matches = (code,re) => unique([...code.matchAll(re)].map(m=>m[1]));

test('all 419 original UI identifiers and nine views survive the rework', () => {
  const ids = new Set(matches(read('src/renderer/index.html'), /\bid="([^"]+)"/g));
  for (const id of contract.elementIds) assert.ok(ids.has(id), `Missing control: ${id}`);
  for (const id of contract.views) assert.ok(ids.has(id), `Missing view: ${id}`);
});
test('all 157 original renderer functions remain available', () => {
  const functions = new Set(matches(read('src/renderer/renderer.js'), /^(?:async )?function (\w+)\(/gm));
  for (const name of contract.rendererFunctions) assert.ok(functions.has(name), `Missing behavior: ${name}`);
});
test('all 94 original main-process operations and all event subscriptions survive', () => {
  const mainChannels = matches(read('src/main/main.js'), /ipcMain\.handle\(['"]([^'"]+)['"]/g);
  assert.deepEqual(mainChannels,contract.mainChannels);
  const bridge = require('../src/shared/ipc-contract.json');
  const renderer = read('src/renderer/renderer.js');
  for (const channel of matches(renderer,/ipcRenderer\.invoke\(['"]([^'"]+)['"]/g)) assert.ok(bridge.invoke.includes(channel),channel);
  assert.deepEqual(matches(renderer,/ipcRenderer\.on\(['"]([^'"]+)['"]/g),contract.eventChannels);
});
test('runtime dependencies are unchanged and installer uses the established production identity', () => {
  const pkg = require('../package.json');
  assert.deepEqual(pkg.dependencies,contract.dependencyVersions);
  assert.equal(pkg.build.appId,'de.shishawg.modsetuptool');
  assert.equal(pkg.build.productName,'ShishaWG Mod Setup Tool');
  assert.equal(pkg.build.nsis.guid,'de-shishawg-modsetuptool-nsis-guid');
  assert.doesNotMatch(pkg.build.portable.artifactName,/test-chat-gpt/);
  assert.ok(pkg.build.files.includes('docs/**/*'));
  assert.ok(pkg.build.files.includes('build/icon.png'));
});
test('assembled renderer exactly reflects the eleven source modules', () => {
  const modules = require('../src/renderer/modules/manifest.json');
  const assembled = modules.map(file=>read('src/renderer/modules/'+file)).join('');
  assert.equal(read('src/renderer/renderer.js').split('\n').slice(1).join('\n'),assembled);
});
test('production runtime reuses original data, OBS port and update installation', () => {
  const runtime = require('../src/main/runtime');
  assert.equal(runtime.isTestBuild,false);
  assert.equal(runtime.obsPort,18942);
  const main = read('src/main/main.js');
  assert.match(main,/contextIsolation: true/);
  assert.match(main,/nodeIntegration: false/);
  assert.match(main,/sandbox: true/);
  assert.match(main,/autoInstallOnAppQuit = true/);
  assert.doesNotMatch(main,/updater:install[\s\S]*?if \(runtime.isTestBuild\) return/);
});
