// Offline integration harness: real Electron window, sandboxed preload and UI;
// every application IPC operation is handled by fixtures. No service is started.
const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const fs = require('fs');
const assert = require('assert/strict');
const output = process.argv[2];
const root = process.argv[3];
fs.mkdirSync(output, { recursive: true });
app.setPath('userData', path.join(output, 'profile'));
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('enable-features', 'OverlayScrollbar,FluentOverlayScrollbar');
const contract = require(path.join(__dirname, '../../test/fixtures/feature-contract.json'));
const errors = [], checks = [], calls = [];
const profile = {id:'prof_shishawg',name:'ShishaWG (Marvin)',targetChannel:'marved',botName:'marvedbot',defaultPersons:['Marvin','Hasty','Kai'],youtubeChannels:['@shishawg','@marvocado'],promoCodes:[],telegram:{},isDefault:true};
let db, copiedText = '';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const responses = {
  'app:get-version': () => '7.3.0',
  'twitch:check-auth': () => null,
  'twitch:get-config': () => ({clientId:'',hasToken:false,targetChannel:'marved'}),
  'twitch:check-stream-status': () => ({success:true,live:false}),
  'profiles:get-all': () => ({success:true,profiles:[profile],activeProfileId:profile.id}),
  'profiles:save-all': profiles => ({success:true,profiles}),
  'profiles:set-active': () => ({success:true,profile}),
  'db:get-catalog': () => db.getCatalog(),
  'db:sync-cloud': () => ({success:true,catalog:db.getCatalog()}),
  'modchat:get-messages': () => ({success:true,messages:[]}),
  'markers:get': () => ({success:true,markers:[]}),
  'watchlist:get': () => ({success:true,list:[]}),
  'giveaway:get-winners': () => ({success:true,winners:[]}),
  'giveaway:get-telegram-config': () => ({botToken:'',chatId:'',claimUrl:'https://example.invalid/claim'}),
  'qna:get-settings': () => ({success:true,settings:{persons:['Marvin','Hasty','Kai'],keywords:['!frage','!q','!question'],active:true}}),
  'qna:get-questions': () => ({success:true,questions:[]}),
  'bestrafungen:get': () => ({success:true,bestrafungen:[]}),
  'polls:get-active': () => ({success:true,poll:null}),
  'predictions:get-active': () => ({success:true,prediction:null}),
  'polls:get-templates': () => ({success:true,templates:[]}),
  'stats:get-sessions': () => ({success:true,sessions:[]}),
  'stats:get-timer-state': () => ({success:true,timerState:null}),
  'twitch:get-channel-info': () => ({success:true,title:'',game_name:'Just Chatting',game_id:'509658'}),
  'twitch:get-color': () => ({success:true,color:'#a3e0c2'}),
  'twitch:get-chatters': () => ({success:true,chatters:[]}),
  'seventv:get-emotes': () => ({success:true,emotes:[]}),
  'updater:check': () => ({success:true,testBuild:true}),
  'obs:get-info': () => ({localUrl:'http://localhost:18943/overlay'}),
  'app:copy-clipboard': text => { copiedText = text; return {success:true}; }
};
for (const channel of contract.mainChannels) ipcMain.handle(channel, (_event,...args) => { calls.push({channel,args}); return responses[channel]?.(...args) ?? {success:true}; });
async function run() {
  await app.whenReady();
  session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']}, (_details,callback)=>callback({cancel:true}));
  const DatabaseService = require(path.join(root,'src/main/dbService.js'));
  db = new DatabaseService();
  const {startupOptions,revealWhenReady}=require(path.join(root,'src/main/startup-window.js'));
  const win = new BrowserWindow({width:1440,height:960,...startupOptions,webPreferences:{preload:path.join(root,'src/main/preload.js'),nodeIntegration:false,contextIsolation:true,sandbox:true,offscreen:true}});
  assert.equal(win.isVisible(),false);checks.push('Startup window is hidden before loading begins');
  let reveals=0;
  const presentationReady=revealWhenReady(win,()=>{assert.equal(win.isVisible(),false);reveals++;});
  win.webContents.on('console-message', (_event,level,message,line,source)=> { if (level>=3 && !message.includes('ERR_BLOCKED_BY_CLIENT')) errors.push(`${source}:${line} ${message}`); });
  const evaluate = script => win.webContents.executeJavaScript(script, true);
  await win.loadFile(path.join(root, 'src/renderer/index.html'));
  await presentationReady;
  win.webContents.setBackgroundThrottling(false);
  assert.equal(reveals,1);checks.push('Production startup gate reveals only after presentation readiness');
  assert.equal(await evaluate(`document.body.classList.contains('swg-glass') && !!document.querySelector('.workspace-sidebar') && !document.documentElement.classList.contains('swg-starting') && getComputedStyle(document.body).visibility==='visible'`),true);
  checks.push('First reveal contains the finished glass workspace');
  fs.writeFileSync(path.join(output,'00-first-visible.png'),(await win.webContents.capturePage()).toPNG());
  const reloaded=new Promise(resolve=>win.webContents.once('did-finish-load',resolve));
  win.webContents.reload();await reloaded;
  assert.equal(await evaluate(`!document.documentElement.classList.contains('swg-starting') && document.body.classList.contains('swg-glass') && getComputedStyle(document.body).visibility==='visible'`),true);
  checks.push('Reload releases the loading guard without a second native reveal');
  await pause(700);
  fs.writeFileSync(path.join(output,'startup.json'), JSON.stringify(await evaluate('({sidebar:!!document.querySelector(".workspace-sidebar"),persons:state.persons.length,heading:document.querySelector(".landing-hero h2").textContent,auth:!!state.twitchUser,scripts:[...document.scripts].map(s=>s.src),ready:document.readyState})'),null,2));
  const check = async (name, script) => { const result = await evaluate(script); assert.ok(result, name); checks.push(name); };
  const screenshot = async name => { await pause(350); fs.writeFileSync(path.join(output,name+'.png'), (await win.webContents.capturePage()).toPNG()); };

  await evaluate('window.WebSocket=class {constructor(){window.__hqSocket=this;this.sent=[];}send(value){this.sent.push(value);}close(){}};state.twitchUser={login:"qa_mod",display_name:"QA Mod",id:"123"};showView("view-modchat");window.dispatchEvent(new Event("swg:view-changed"));');
  await check('Existing Mod-HQ controls are retained', '["input-mod-chat","btn-send-mod-chat","markers-stream-list","watchlist-items-list","btn-add-custom-marker","btn-add-watchlist-item"].every(id=>!!document.getElementById(id))');
  await check('Auxiliary cards start collapsed', 'document.querySelectorAll(".hq-fold-head[aria-expanded=false]").length===2');
  await check('Twitch message is readable and quote only drafts', '(()=>{__hqSocket.onopen();__hqSocket.onmessage({data:"@display-name=Viewer;id=test :viewer!viewer@viewer PRIVMSG #marved :Eine Frage?"});const message=document.querySelector(".hq-message");if(!message)return false;message.querySelector("button").click();return document.getElementById("input-mod-chat").value.includes("Eine Frage?");})()');
  assert.equal(calls.filter(c=>c.channel==='modchat:send-message'||c.channel==='twitch:send-chat').length,0);
  await check('Profile editor loads platform settings', '(async()=>{await loadProfileIntoEditor(activeProfileId);return document.getElementById("hq-profile-twitch").checked && document.getElementById("hq-profile-youtube").checked;})()');
  await check('Profile chat settings change the available tabs', '(async()=>{getActiveStreamerProfile().hqChat={twitch:false,youtube:true,defaultView:"youtube"};window.dispatchEvent(new Event("swg:view-changed"));return document.querySelector(".hq-twitch").hidden && !document.querySelector(".hq-youtube").hidden;})()');
  await check('Cutter controls can be expanded', '(()=>{const b=document.querySelectorAll(".hq-fold-head")[1];b.click();return b.getAttribute("aria-expanded")==="true";})()');
  await check('Shared channel-specific agreement is shown', '(()=>{lastLoadedModChatMessages=[{text:"[HQ-Absprache #marved] Keine Spoiler",senderName:"Mod",timestamp:Date.now()}];window.dispatchEvent(new Event("swg:view-changed"));return document.querySelector(".hq-agreements > p").textContent.includes("Keine Spoiler");})()');
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({checks,errors}));win.destroy();app.quit();
}
run().catch(error=>{fs.writeFileSync(path.join(output,'failure.txt'),error.stack+JSON.stringify({checks,errors}));app.exit(1);});
