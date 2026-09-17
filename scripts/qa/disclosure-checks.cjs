module.exports=async({win,evaluate,check,screenshot})=>{
  await evaluate(`window.__motionPause=ms=>new Promise(r=>setTimeout(r,ms));window.__motionHeight=el=>el.getBoundingClientRect().height;void 0;`);
  await check('Sidebar width has an intermediate frame in both directions', `(async()=>{
    const rail=document.querySelector('.workspace-sidebar'), button=document.getElementById('ws-collapse');
    const wide=rail.getBoundingClientRect().width; button.click(); await __motionPause(65);
    const middle=rail.getBoundingClientRect().width; await __motionPause(300); const narrow=rail.getBoundingClientRect().width;
    button.click(); await __motionPause(65); const reverse=rail.getBoundingClientRect().width; await __motionPause(300);
    return wide>middle+2 && middle>narrow+2 && reverse>narrow+2 && reverse<wide-2 && Math.abs(rail.getBoundingClientRect().width-wide)<1;
  })()`);
  await evaluate('showView("view-setup");window.__motionPersonsBefore=JSON.stringify(state.persons);');
  for(const [name,buttonSelector,panelSelector,closedClass] of [
    ['Notes','#btn-toggle-notes','#notes-card','hidden'],
    ['Promo','#btn-toggle-promo','#promo-block','collapsed'],
    ['Optional fields','.optional-fields-toggle','.optional-fields-collapsible','collapsed']
  ]) {
    await evaluate(`window.__motionButton=document.querySelector(${JSON.stringify(buttonSelector)});window.__motionPanel=document.querySelector(${JSON.stringify(panelSelector)});if(__motionPanel.classList.contains('${closedClass}')) __motionButton.click();`);
    await evaluate('__motionPause(300)');
    await check(name+' closes gradually and retains the original closed state', `(async()=>{
      const full=__motionHeight(__motionPanel); __motionButton.click(); await __motionPause(60);
      const middle=__motionHeight(__motionPanel), logical=__motionPanel.classList.contains('${closedClass}');
      await __motionPause(300); const result=full>middle+1 && middle>1 && logical && __motionHeight(__motionPanel)===0 && !__motionPanel.classList.contains('disclosure-animating'); if(!result)throw new Error(JSON.stringify({full,middle,logical,end:__motionHeight(__motionPanel),classes:__motionPanel.className}));return result;
    })()`);
    await check(name+' opens gradually to the full content height', `(async()=>{
      __motionButton.click(); await __motionPause(60); const middle=__motionHeight(__motionPanel);
      await __motionPause(300); return middle>1 && __motionHeight(__motionPanel)>middle+1 && !__motionPanel.classList.contains('${closedClass}') && !__motionPanel.inert;
    })()`);
    await check(name+' reverses a running animation without a height jump', `(async()=>{
      __motionButton.click();await __motionPause(80);const before=__motionHeight(__motionPanel);
      __motionButton.click();await new Promise(requestAnimationFrame);const after=__motionHeight(__motionPanel);await __motionPause(300);
      return Math.abs(before-after)<2 && !__motionPanel.classList.contains('${closedClass}') && !__motionPanel.classList.contains('disclosure-animating') && !__motionPanel.inert;
    })()`);
  }
  await check('Disclosure animations preserve all ten person records', 'JSON.stringify(state.persons)===window.__motionPersonsBefore');
  await evaluate('showView("view-custom-dashboard");');
  await check('Dashboard collapse animates across its existing full re-render', `(async()=>{
    const card=document.querySelector('.custom-widget-card'),id=card.dataset.widgetId,full=__motionHeight(card);
    window.__motionWidgetId=id;card.querySelector('.btn-widget-collapse').click();await __motionPause(60);
    const current=[...document.querySelectorAll('.custom-widget-card')].find(c=>c.dataset.widgetId===id),middle=__motionHeight(current);
    await __motionPause(300);return current!==card && current.classList.contains('is-collapsed') && full>middle+1 && middle>__motionHeight(current)+1 && !current.querySelector('.custom-widget-body').inert;
  })()`);
  await check('Dashboard expand restores the body through its original control', `(async()=>{
    const find=()=>[...document.querySelectorAll('.custom-widget-card')].find(c=>c.dataset.widgetId===__motionWidgetId);
    const small=__motionHeight(find());find().querySelector('.btn-widget-collapse').click();await __motionPause(60);
    const middle=__motionHeight(find());await __motionPause(300);return middle>small+1 && __motionHeight(find())>middle+1 && !find().classList.contains('is-collapsed');
  })()`);
  await check('Dashboard collapse can reverse during a re-rendered animation', `(async()=>{
    const find=()=>[...document.querySelectorAll('.custom-widget-card')].find(c=>c.dataset.widgetId===__motionWidgetId);
    find().querySelector('.btn-widget-collapse').click();await __motionPause(80);const before=__motionHeight(find());
    find().querySelector('.btn-widget-collapse').click();await new Promise(requestAnimationFrame);const after=__motionHeight(find());
    await __motionPause(300);return Math.abs(before-after)<2 && !find().classList.contains('is-collapsed') && !find().classList.contains('disclosure-animating');
  })()`);
  await check('Reduced motion skips disclosures and clears running animations', `(async()=>{
    showView('view-setup');document.getElementById('btn-toggle-notes').click();await __motionPause(60);
    document.body.classList.add('ws-reduced-motion');await Promise.resolve();
    const closed=__motionHeight(document.getElementById('notes-card'))===0 && !document.querySelector('.disclosure-animating');
    document.getElementById('btn-toggle-notes').click();await Promise.resolve();
    const open=__motionHeight(document.getElementById('notes-card'))>0 && !document.querySelector('.disclosure-animating');
    document.body.classList.remove('ws-reduced-motion');return closed && open;
  })()`);
  const point=await evaluate(`(() => {
    const button=document.getElementById('btn-toggle-notes');button.scrollIntoView({block:'center'});
    window.__nativeNotesHeight=__motionHeight(document.getElementById('notes-card'));
    const r=button.getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};
  })()`);
  win.webContents.sendInputEvent({type:'mouseMove',...point});
  win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...point});
  win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...point});
  await evaluate('__motionPause(65)');
  await check('Native mouse click animates notes after the original event handler', `(() => {
    const el=document.getElementById('notes-card'),h=__motionHeight(el);
    return el.classList.contains('hidden') && h>1 && h<__nativeNotesHeight-1;
  })()`);
  await evaluate('__motionPause(300);');
  await evaluate('document.getElementById("btn-toggle-notes").focus();');
  win.webContents.sendInputEvent({type:'keyDown',keyCode:'Return'});
  win.webContents.sendInputEvent({type:'char',keyCode:'\r'});
  win.webContents.sendInputEvent({type:'keyUp',keyCode:'Return'});
  await evaluate('__motionPause(65)');
  await check('Native keyboard activation uses the same gradual expansion', `(() => {
    const el=document.getElementById('notes-card'),h=__motionHeight(el);
    return !el.classList.contains('hidden') && h>1 && h<__nativeNotesHeight-1;
  })()`);
  await evaluate('__motionPause(300);');
  await evaluate('showView("view-landing");document.getElementById("view-landing").scrollTop=0;');
  await screenshot('30-fixed-selection-navigation');
};

