module.exports=async({win,evaluate,check})=>{
  await evaluate('showView("view-landing");');
  await evaluate('new Promise(r=>setTimeout(r,350))');
  const p=await evaluate(`(()=>{const r=document.querySelector('[data-ws-route="view-polls"]').getBoundingClientRect();return {x:Math.round(r.x+25),y:Math.round(r.y+r.height/2)};})()`);
  win.webContents.sendInputEvent({type:'mouseMove',...p});
  await evaluate('new Promise(r=>setTimeout(r,200))');
  await check('Hover never starts selection travel', 'document.querySelector(".liquid-selection-lens").hidden && currentActiveView==="view-landing"');
  win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...p});
  win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...p});
  await evaluate('new Promise(r=>setTimeout(r,65))');
  await check('Actual menu click moves glass between previous and selected entries', `(()=>{
    const lens=document.querySelector('.liquid-selection-lens'),r=lens.getBoundingClientRect();
    const a=document.querySelector('[data-ws-route="view-landing"]').getBoundingClientRect(),b=document.querySelector('[data-ws-route="view-polls"]').getBoundingClientRect();
    return currentActiveView==='view-polls' && !lens.hidden && r.y>a.y+2 && r.y<b.y-2 && getComputedStyle(document.querySelector('.ws-nav-item.is-active'),'::before').opacity==='0';
  })()`);
  await evaluate('new Promise(r=>setTimeout(r,350))');
  await check('Arriving glass becomes the persistent fitted selection', 'document.querySelector(".liquid-selection-lens").hidden && getComputedStyle(document.querySelector(".ws-nav-item.is-active"),"::before").opacity==="1"');
  await check('Fast successive selections redirect from the visible position', `(async()=>{
    const lens=document.querySelector('.liquid-selection-lens');
    document.querySelector('[data-ws-route="view-setup"]').click();await __motionPause(65);
    const before=lens.getBoundingClientRect().y;
    document.querySelector('[data-ws-route="view-stats"]').click();await Promise.resolve();
    const after=lens.getBoundingClientRect().y;await __motionPause(350);
    return Math.abs(before-after)<2 && currentActiveView==='view-stats' && lens.hidden;
  })()`);
  await check('Clicking the current page leaves the glass stationary', `(async()=>{
    document.querySelector('[data-ws-route="view-stats"]').click();await Promise.resolve();return document.querySelector('.liquid-selection-lens').hidden;
  })()`);
  await check('Tool dialogs do not move the selected module glass', `(async()=>{
    document.querySelector('[data-ws-action="preferences"]').click();await Promise.resolve();
    const stationary=document.querySelector('.liquid-selection-lens').hidden && currentActiveView==='view-stats';
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));return stationary;
  })()`);
  await check('Reduced motion changes selection without flying glass', `(async()=>{
    document.body.classList.add('ws-reduced-motion');document.querySelector('[data-ws-route="view-landing"]').click();await Promise.resolve();
    const okay=document.querySelector('.liquid-selection-lens').hidden && currentActiveView==='view-landing';document.body.classList.remove('ws-reduced-motion');return okay;
  })()`);
};
