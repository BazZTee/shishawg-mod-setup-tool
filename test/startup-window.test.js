const {test}=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {startupOptions,revealWhenReady}=require('../src/main/startup-window');
function windowFixture(){
  const win=new EventEmitter();win.webContents=new EventEmitter();win.isDestroyed=()=>false;
  let finish,fail;win.webContents.executeJavaScript=()=>new Promise((resolve,reject)=>{finish=resolve;fail=reject;});
  win.shown=0;win.show=()=>win.shown++;
  return {win,finish:()=>finish(true),fail:()=>fail(new Error('script failed'))};
}
test('window remains hidden until presentation completes, then shows once',async()=>{
  assert.equal(startupOptions.show,false);
  const {win,finish}=windowFixture();const ready=revealWhenReady(win);
  win.emit('ready-to-show');assert.equal(win.shown,0);
  win.webContents.emit('did-finish-load');assert.equal(win.shown,0);
  finish();assert.equal(await ready,true);assert.equal(win.shown,1);
  win.webContents.emit('did-finish-load');assert.equal(win.shown,1);
});
test('closing during composition never reveals the window later',async()=>{
  const {win,finish}=windowFixture();const ready=revealWhenReady(win);
  win.webContents.emit('did-finish-load');win.emit('closed');finish();
  assert.equal(await ready,false);assert.equal(win.shown,0);
});
test('main-document load failure is reported without showing partial UI',async()=>{
  const {win}=windowFixture();const ready=revealWhenReady(win);
  win.webContents.emit('did-fail-load',{},-6,'File missing','file:///missing',true);
  await assert.rejects(ready,/File missing/);assert.equal(win.shown,0);
});
test('presentation failure is reported instead of exposing old layout',async()=>{
  const {win,fail}=windowFixture();const ready=revealWhenReady(win);
  win.webContents.emit('did-finish-load');fail();
  await assert.rejects(ready,/script failed/);assert.equal(win.shown,0);
});
