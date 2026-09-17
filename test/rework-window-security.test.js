const test = require('node:test');
const assert = require('node:assert/strict');
const {isWebLink,openWebLink,configureWindowSecurity} = require('../src/main/window-security');
test('external links preserve web and OBS links while rejecting executable schemes',()=> {
  for (const url of ['https://www.twitch.tv/marved','http://localhost:18943/overlay']) assert.equal(isWebLink(url),true);
  for (const url of ['file:///C:/Windows/system32/cmd.exe','javascript:alert(1)','data:text/html,x','https://user:pass@example.com','nonsense']) assert.equal(isWebLink(url),false);
});
test('invalid external links never reach the operating system',async()=> {
  let calls = 0;
  const shell = {openExternal:async()=>{calls++;}};
  assert.equal((await openWebLink(shell,'file:///C:/a.exe')).success,false);
  assert.equal(calls,0);
  assert.equal((await openWebLink(shell,'https://www.twitch.tv/')).success,true);
  assert.equal(calls,1);
});
test('a rejected OS link opening reports failure',async()=> {
  const result = await openWebLink({openExternal:async()=>{throw new Error('Browser unavailable');}},'https://www.twitch.tv/');
  assert.deepEqual(result,{success:false,error:'Browser unavailable'});
});
test('remote pages cannot navigate the privileged app window or attach webviews',()=> {
  const handlers = {};
  const webContents = {setWindowOpenHandler:fn=>handlers.open=fn,on:(name,fn)=>handlers[name]=fn,getURL:()=> 'file:///app/index.html'};
  configureWindowSecurity({webContents},{openExternal:async()=>{}});
  assert.deepEqual(handlers.open({url:'javascript:alert(1)'}),{action:'deny'});
  let prevented = false;
  handlers['will-navigate']({preventDefault:()=>prevented=true},'file:///elsewhere.html');
  assert.equal(prevented,true);
  prevented=false;
  handlers['will-attach-webview']({preventDefault:()=>prevented=true});
  assert.equal(prevented,true);
});
