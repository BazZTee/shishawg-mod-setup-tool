const fs = require('fs');
const path = require('path');
module.exports = async ({ win,evaluate,check,screenshot,output }) => {
  const pause = ms => new Promise(resolve=>setTimeout(resolve,ms));
  const center = selector => evaluate(`(() => { const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
  const move = p => win.webContents.sendInputEvent({type:'mouseMove',x:Math.round(p.x),y:Math.round(p.y)});
  await evaluate('showView("view-landing"); document.getElementById("view-landing").scrollTop=0; document.getElementById("toast-banner").classList.add("hidden");');
  await pause(150);
  const first=await center('[data-ws-route="view-setup"]');
  const second=await center('[data-ws-route="view-qna"]');
  move(first); await pause(750);
  await check('Hover glass appears locally while selection stays strong', `Number(getComputedStyle(document.querySelector('[data-ws-route="view-setup"]'),'::before').opacity)>.4 && getComputedStyle(document.querySelector('.ws-nav-item.is-active'),'::before').opacity==='1'`);
  move(second); await pause(65);
  await check('Previous hover fades out without moving a glass capsule', `(() => { const opacity=Number(getComputedStyle(document.querySelector('[data-ws-route="view-setup"]'),'::before').opacity); return opacity>0 && opacity<.42 && !document.querySelector('.liquid-nav-lens'); })()`);
  await pause(350);
  await check('Local hover settles and the previous item clears', `Number(getComputedStyle(document.querySelector('[data-ws-route="view-qna"]'),'::before').opacity)>.4 && getComputedStyle(document.querySelector('[data-ws-route="view-setup"]'),'::before').opacity==='0'`);
  await check('Hover never switches modules or changes the setup', 'currentActiveView==="view-landing" && state.persons.length===10');
  await screenshot('24-liquid-navigation');
  const tileSelector='.hub-tile-card[data-target="view-setup"]';
  const tile=await center(tileSelector);
  move({x:tile.x-100,y:tile.y-12}); await pause(650);
  const before=await evaluate(`document.querySelector('${tileSelector} .liquid-card-optics').style.getPropertyValue('--liquid-x')`);
  move({x:tile.x+100,y:tile.y+15}); await pause(650);
  await check('Card reflections follow the pointer position', `parseFloat(document.querySelector('${tileSelector} .liquid-card-optics').style.getPropertyValue('--liquid-x'))>parseFloat(${JSON.stringify(before)})+15`);
  await check('Decorative glass does not intercept card clicks', `(() => { const el=document.elementFromPoint(${tile.x},${tile.y}); return !el.classList.contains('liquid-card-optics') && el.closest('.hub-tile-card').dataset.target==='view-setup'; })()`);
  await screenshot('25-liquid-module');
  move({x:600,y:70}); await pause(900);
  await check('Reflections fade after leaving a card', `Number(document.querySelector('${tileSelector} .liquid-card-optics').style.opacity)<.01`);
  await check('Selected menu glass remains visible after pointer leave', `getComputedStyle(document.querySelector('.ws-nav-item.is-active'),'::before').opacity==='1'`);

  // Exercise the real pointer click through the effect, preserving the normal auth flow.
  move(first);
  win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,x:Math.round(first.x),y:Math.round(first.y)});
  win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,x:Math.round(first.x),y:Math.round(first.y)});
  await pause(200);
  await check('Real navigation clicks pass through the decorative lens', 'currentActiveView==="view-setup"');
  await evaluate('document.body.classList.add("ws-reduced-motion"); showView("view-landing");');
  move(tile); await pause(100);
  await check('Reduced motion disables pointer-driven card optics', `getComputedStyle(document.querySelector('${tileSelector} .liquid-card-optics')).display==='none'`);
  await evaluate('document.body.classList.remove("ws-reduced-motion"); document.getElementById("ws-collapse").click();');
  await pause(800);
  await check('Glass fits the collapsed navigation', `(() => { const a=document.querySelector('.ws-nav-item.is-active'); return Math.abs(a.getBoundingClientRect().width-parseFloat(getComputedStyle(a,'::before').width))<3; })()`);
  await evaluate('document.getElementById("ws-collapse").click();');
  move({x:600,y:70});
  await pause(1200);
  await evaluate(`window.__liquidRafCount=0; window.__liquidOriginalRaf=requestAnimationFrame; window.requestAnimationFrame=callback=>{ if(callback.name==='tick') window.__liquidRafCount++; return window.__liquidOriginalRaf(callback); }; void 0;`);
  await pause(250);
  await check('Liquid animation loop stops while the pointer is idle', 'window.__liquidRafCount===0');
  await evaluate('window.requestAnimationFrame=window.__liquidOriginalRaf; void 0;');

  await require('./liquid-refinement-checks.cjs')({win,evaluate,check,screenshot});
  await require('./disclosure-checks.cjs')({win,evaluate,check,screenshot});
  await require('./selection-checks.cjs')({win,evaluate,check});
  await require('./shell-layout-checks.cjs')({win,evaluate,check,screenshot});
  await require('./toggle-motion-checks.cjs')({evaluate,check});
  if (process.env.SWG_QA_MOTION_VIDEO === '1') {
    const frames=path.join(output,'motion-frames'); fs.mkdirSync(frames,{recursive:true});
    // The cursor is a QA-only visual marker; every glass effect is the actual app.
    await evaluate(`(() => { const cursor=document.createElement('div'); cursor.id='qa-demo-cursor'; cursor.style.cssText='position:fixed;width:16px;height:22px;pointer-events:none;z-index:99999;filter:drop-shadow(0 1px 2px #0008)'; cursor.innerHTML='<svg viewBox="0 0 16 22" fill="white" stroke="#183050" stroke-width="1"><path d="M2 1v17l4-4 4 7 3-1-4-7h6z"/></svg>'; document.body.append(cursor); document.getElementById('toast-banner').classList.add('hidden'); })()`);
    const navPoints=await Promise.all(['view-landing','view-setup','view-modchat','view-qna','view-polls','view-quickactions','view-landing'].map(id=>center(`[data-ws-route="${id}"]`)));
    const tileA=await center('.hub-tile-card[data-target="view-setup"]');
    const tileB=await center('.hub-tile-card[data-target="view-quickactions"]');
    const tileC=await center('.hub-tile-card[data-target="view-giveaways"]');
    const points=[...navPoints,{x:tileA.x-150,y:tileA.y-20},{x:tileA.x+150,y:tileA.y+20},{x:tileB.x-150,y:tileB.y-20},{x:tileB.x+150,y:tileB.y+20},tileC,{x:600,y:70}];
    let count=0;
    for(let segment=0;segment<points.length-1;segment++) {
      for(let index=0;index<15;index++) {
        const start=Date.now(); const fraction=index/14; const t=fraction*fraction*(3-2*fraction);
        const p={x:points[segment].x+(points[segment+1].x-points[segment].x)*t,y:points[segment].y+(points[segment+1].y-points[segment].y)*t};
        move(p);
        await evaluate(`document.getElementById('qa-demo-cursor').style.left='${p.x}px'; document.getElementById('qa-demo-cursor').style.top='${p.y}px';`);
        await pause(22);
        fs.writeFileSync(path.join(frames,`${String(count++).padStart(4,'0')}.png`),(await win.webContents.capturePage()).toPNG());
        await pause(Math.max(1,50-(Date.now()-start)));
      }
    }
    await evaluate('showView("view-polls");document.getElementById("tab-nav-polls").click();');
    await pause(250);
    for(const id of ['tab-nav-predictions','tab-nav-polls']) {
      const p=await center('#'+id); move(p);
      await evaluate(`document.getElementById('qa-demo-cursor').style.left='${p.x}px';document.getElementById('qa-demo-cursor').style.top='${p.y}px';document.getElementById('${id}').click();`);
      for(let i=0;i<20;i++) {
        await pause(35);
        fs.writeFileSync(path.join(frames,`${String(count++).padStart(4,'0')}.png`),(await win.webContents.capturePage()).toPNG());
      }
    }
    await evaluate('showView("view-landing");');await pause(350);
    for(const route of ['view-setup','view-qna','view-polls','view-landing']) {
      const p=await center('[data-ws-route="'+route+'"]');move(p);
      await evaluate(`document.getElementById('qa-demo-cursor').style.left='${p.x}px';document.getElementById('qa-demo-cursor').style.top='${p.y}px';`);
      win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,x:Math.round(p.x),y:Math.round(p.y)});
      win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,x:Math.round(p.x),y:Math.round(p.y)});
      for(let i=0;i<14;i++) {
        await pause(35);
        fs.writeFileSync(path.join(frames,`${String(count++).padStart(4,'0')}.png`),(await win.webContents.capturePage()).toPNG());
      }
    }
    await evaluate('document.getElementById("qa-demo-cursor").remove();showView("view-landing");');
    for(const expression of ['document.getElementById("ws-collapse").click()','document.getElementById("ws-collapse").click()','showView("view-setup");document.getElementById("btn-toggle-notes").click()','document.getElementById("btn-toggle-notes").click()']) {
      await evaluate(expression);
      for(let i=0;i<14;i++) {
        await pause(35);
        fs.writeFileSync(path.join(frames,`${String(count++).padStart(4,'0')}.png`),(await win.webContents.capturePage()).toPNG());
      }
    }
  }
};
