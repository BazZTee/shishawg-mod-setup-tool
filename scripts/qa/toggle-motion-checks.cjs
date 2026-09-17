module.exports=async ({evaluate,check})=>{
  await evaluate('showView("view-setup");__motionPause(350);');
  for(const selector of ['.chk-p-electric','.chk-p-tob-amount']) {
    for(const direction of ['first','return']) {
      await check(`Rebuilt ${selector} switch animates (${direction}) and retains its new state`, `(async()=>{
        const selector=${JSON.stringify(selector)};
        const input=document.querySelector(selector),before=input.checked;
        const position=()=>new DOMMatrixReadOnly(getComputedStyle(document.querySelector(selector).parentElement.querySelector('.toggle-slider'),'::before').transform).m41;
        const start=position();input.click();
        await __motionPause(75);const middle=position();
        await __motionPause(240);const end=position();
        return !input.isConnected && document.querySelector(selector).checked===!before && Math.abs(end-start)>10 && Math.abs(middle-start)>.1 && Math.abs(end-middle)>.1;
      })()`);
    }
  }
  await check('Reduced motion switches immediately without losing state', `(async()=>{
    document.body.classList.add('ws-reduced-motion');
    const input=document.querySelector('.chk-p-electric'),before=input.checked;input.click();
    await __motionPause(50);
    const replacement=document.querySelector('.chk-p-electric');
    const okay=replacement.checked===!before && !document.querySelector('.liquid-toggle-resume');
    replacement.click();document.body.classList.remove('ws-reduced-motion');return okay;
  })()`);
  await evaluate('showView("view-landing");');
};
