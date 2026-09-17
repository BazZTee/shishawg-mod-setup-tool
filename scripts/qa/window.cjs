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
  await check('Renderer runs without Node privileges', 'typeof require === "undefined" && typeof process === "undefined" && !!window.swgBridge');
  await check('Original controls remain present', `(${JSON.stringify(contract.elementIds)}).every(id=>document.getElementById(id))`);
  await check('Unknown IPC channels are denied', 'window.swgBridge.ipcRenderer.invoke("untrusted:execute").then(()=>false,()=>true)');
  await screenshot('01-overview-logged-out');
  await evaluate('document.querySelector("[data-ws-route=view-setup]").click()');
  await pause(150);
  await check('Navigation preserves the Twitch login requirement', 'currentActiveView === "view-landing" && !state.twitchUser');
  assert.ok(calls.some(call=>call.channel==='twitch:login'), 'Login action reaches the offline auth fixture');
  await evaluate(`document.getElementById('btn-close-twitch-modal').click(); state.twitchUser = ${JSON.stringify({id:'offline-fixture',login:'preview_mod',display_name:'Vorschau',profile_image_url:'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22/%3E'})}; updateTwitchUI();`);
  await screenshot('02-overview-connected');
  for (const [index,id] of contract.views.filter(id=>id!=='view-landing').entries()) {
    await evaluate(`document.querySelector('[data-ws-route="${id}"]').click()`);
    await pause(250);
    await check('Navigation opens ' + id, `currentActiveView === '${id}' && !document.getElementById('${id}').classList.contains('hidden')`);
    await check('Visible page does not overflow horizontally: ' + id, `document.getElementById('${id}').scrollWidth <= document.getElementById('${id}').clientWidth + 1`);
    await screenshot(`${String(index+3).padStart(2,'0')}-${id}`);
  }
  await evaluate(`showView('view-custom-dashboard');
    for (const [id,value] of [['cw-setup-name','Marvin'],['cw-setup-pipe','Amotion Futr'],['cw-setup-bowl','Cosmo Bowl'],['cw-setup-hmd','ONMO'],['cw-setup-charcoal','Magic Cubes']]) { const input=document.getElementById(id); input.value=value; input.dispatchEvent(new Event('input',{bubbles:true})); }
    const tobacco=document.querySelector('.cw-tob-input'); tobacco.value='MustH - Pynkman'; tobacco.dispatchEvent(new Event('input',{bubbles:true}));`);
  await check('Dashboard generates a real command without starting the timer', 'generateCommandString().includes("MustH - Pynkman") && !statsState.isRunning && document.getElementById("cw-setup-cmd-preview").textContent===commandOutput.value');
  await evaluate('document.getElementById("cw-setup-btn-copy").click();');
  await pause(60);
  assert.ok(copiedText.includes('MustH - Pynkman'),'Dashboard copies the canonical setup'); checks.push('Dashboard copy preserves the setup command');
  await screenshot('15-dashboard-populated');
  await evaluate('document.getElementById("cw-setup-btn-full").click();');
  await check('Dashboard changes are visible in all main-editor fields', 'document.querySelector(".input-p-pipe").value==="Amotion Futr" && [...document.querySelectorAll("#persons-container input")].some(input=>input.value==="MustH - Pynkman")');
  await screenshot('16-setup-populated');
  await evaluate('showView("view-custom-dashboard"); document.getElementById("cw-setup-btn-send").click();');
  await pause(150);
  assert.ok(calls.some(call=>call.channel==='twitch:send-chat' && call.args[0].message.includes('MustH - Pynkman')),'Send reaches the offline Twitch fixture');
  assert.ok(calls.some(call=>call.channel==='obs:publish-setup'),'Confirmed send publishes to the offline OBS fixture');
  checks.push('Dashboard send uses the existing Twitch, timer and OBS workflow (fixtures)');
  await check('Confirmed send starts the session', 'statsState.isRunning && statsState.activeSetup.tobacco.includes("Pynkman")');
  await evaluate('showView("view-custom-dashboard"); window.__sessionBeforeRotation=statsState.sessionStartTime; document.getElementById("custom-widget-btn-rotate-coals").click();');
  await check('Dashboard coal rotation preserves total smoking time', 'statsState.coalRotations===1 && statsState.sessionStartTime===window.__sessionBeforeRotation && statsState.coalElapsedSeconds===0');
  await evaluate('document.getElementById("custom-widget-btn-finish-head").click();');
  await check('Dashboard finish opens the existing rating dialog', '!document.getElementById("modal-finish-head").classList.contains("hidden")');
  await evaluate('document.getElementById("btn-cancel-finish-modal").click(); resetActiveTimer(false); saveCustomDashboardConfig(CUSTOM_DASHBOARD_CATALOG.map(item=>({id:item.id,colSpan:6,collapsed:false}))); renderCustomDashboard();');
  await pause(200);
  await check('All seven dashboard widget types render', 'document.querySelectorAll(".custom-widget-card").length===7');
  await evaluate('document.getElementById("btn-custom-dashboard-lock").click();');
  await check('Dashboard lock prevents dragging', 'document.getElementById("custom-dashboard-grid").classList.contains("is-locked") && [...document.querySelectorAll(".custom-widget-card")].every(card=>card.getAttribute("draggable")==="false")');
  await evaluate('setCustomDashboardLocked(false); saveCustomDashboardConfig(DEFAULT_DASHBOARD_WIDGETS); renderCustomDashboard();');
  await evaluate('document.getElementById("ws-search").click(); document.getElementById("ws-query").value="Vorhersagen"; document.getElementById("ws-query").dispatchEvent(new Event("input",{bubbles:true}));');
  await check('Module search returns predictions', 'document.querySelectorAll(".ws-command").length === 1 && document.querySelector(".ws-command").textContent.includes("Vorhersagen")');
  await screenshot('11-command-search');
  await evaluate('document.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true}));');
  await check('Keyboard activates search results', 'currentActiveView === "view-polls" && document.getElementById("ws-palette").classList.contains("hidden")');
  await evaluate('document.querySelector("[data-ws-action=preferences]").click(); document.getElementById("ws-start-view").value="view-stats"; document.getElementById("ws-start-view").dispatchEvent(new Event("change",{bubbles:true}));');
  await check('Start preference is saved', 'localStorage.getItem("swg_workspace_start")==="view-stats"');
  await screenshot('12-preferences');
  await evaluate('document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true})); document.getElementById("ws-collapse").click();');
  await check('Sidebar collapse persists', 'document.body.classList.contains("ws-collapsed") && localStorage.getItem("swg_workspace_collapsed")==="true"');
  await evaluate('document.getElementById("ws-collapse").click(); showView("view-setup");');
  await evaluate(`document.querySelector('.input-p-name').value='Marvin'; document.querySelector('.input-p-name').dispatchEvent(new Event('input',{bubbles:true}));`);
  await check('Typing does not start a smoking session', '!statsState.isRunning');
  await evaluate(`for(let i=0;i<9;i++) document.getElementById('btn-inc-persons').click();`);
  await check('All ten persons remain supported', 'state.persons.length===10');
  await evaluate('document.getElementById("btn-inc-persons").click();');
  await check('Person limit remains ten', 'state.persons.length===10');
  win.setSize(960, 700);
  await evaluate('showView("view-landing")');
  await screenshot('13-overview-960');
  await check('Minimum window size stays within viewport', 'document.documentElement.scrollWidth <= innerWidth');
  await evaluate('showView("view-setup")');
  await screenshot('14-setup-960');
  await check('Setup remains usable at minimum width', 'document.getElementById("view-setup").scrollWidth <= document.getElementById("view-setup").clientWidth+1');
  if (fs.existsSync(path.join(root,'src/renderer/glass.js'))) {
    await require('./glass-checks.cjs')({win,evaluate,check,screenshot,views:contract.views});
  }
  if (fs.existsSync(path.join(root,'src/renderer/liquid-motion.js'))) {
    await require('./liquid-checks.cjs')({win,evaluate,check,screenshot,output});
  }
  fs.writeFileSync(path.join(output,'qa-report.json'), JSON.stringify({checks,errors,ipcCalls:calls.map(c=>c.channel),network:'All HTTP/HTTPS/WebSocket requests blocked; all IPC uses fixtures.'},null,2));
  assert.deepEqual(errors, [], 'No renderer errors');
  win.destroy(); app.quit();
}
run().catch(error => {
  fs.writeFileSync(path.join(output,'qa-failure.json'),JSON.stringify({error:error.stack,checks,errors},null,2));
  app.exit(1);
});
