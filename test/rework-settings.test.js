const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const SettingsStore = require('../src/main/settings-store');
const folder = fs.mkdtempSync(path.join(os.tmpdir(),'swg-rework-settings-'));
test('settings preserve false, zero, empty strings and nested values across restart', () => {
  const file = path.join(folder,'roundtrip.json');
  const store = new SettingsStore(file);
  store.set('enabled',false); store.set('count',0); store.set('name',''); store.set('profile',{targetChannel:'test',options:[1,2]});
  const restarted = new SettingsStore(file);
  assert.equal(restarted.get('enabled',true),false);
  assert.equal(restarted.get('count',99),0);
  assert.equal(restarted.get('name','fallback'),'');
  assert.deepEqual(restarted.get('profile'),{targetChannel:'test',options:[1,2]});
  restarted.delete('profile');
  assert.equal(new SettingsStore(file).get('profile','absent'),'absent');
});
test('a truncated settings file recovers the last valid backup', () => {
  const file = path.join(folder,'recover.json');
  const store = new SettingsStore(file);
  store.set('channel','saved'); store.set('channel','newest');
  fs.writeFileSync(file,'{"broken":');
  const recovered = new SettingsStore(file);
  assert.equal(recovered.get('channel'),'saved');
  recovered.set('channel','recovered');
  assert.equal(JSON.parse(fs.readFileSync(file+'.backup','utf8')).channel,'saved');
  assert.equal(new SettingsStore(file).get('channel'),'recovered');
});
test('a failed disk write rolls back the in-memory settings too', () => {
  const file = path.join(folder,'rollback.json');
  const store = new SettingsStore(file);
  store.set('channel','before');
  store.save = () => { throw new Error('Simulated disk failure'); };
  assert.throws(()=>store.set('channel','after'),/disk failure/);
  assert.equal(store.get('channel'),'before');
  assert.throws(()=>store.delete('channel'),/disk failure/);
  assert.equal(store.get('channel'),'before');
  assert.equal(new SettingsStore(file).get('channel'),'before');
});
test('settings reject prototype mutation keys',()=> {
  const store = new SettingsStore(path.join(folder,'keys.json'));
  assert.throws(()=>store.set('__proto__',{admin:true}),/Invalid settings key/);
  assert.equal({}.admin,undefined);
});
