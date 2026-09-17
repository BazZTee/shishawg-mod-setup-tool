/* Preserve the native glass-thumb transition across existing DOM re-renders.
 * Controllers still own every checkbox state and every change event.
 */
(() => {
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const motionOff=()=>reduced.matches || document.body.classList.contains('ws-reduced-motion');
  function selector(input) {
    if(input.id)return '#'+CSS.escape(input.id);
    if(input.matches('.chk-p-electric[data-index]'))return `.chk-p-electric[data-index="${CSS.escape(input.dataset.index)}"]`;
    if(input.matches('.chk-p-tob-amount[data-pindex]'))return `.chk-p-tob-amount[data-pindex="${CSS.escape(input.dataset.pindex)}"]`;
    return null;
  }
  const slider=input=>input?.parentElement.querySelector('.toggle-slider');
  document.addEventListener('change',event=>{
    if(event.target.type!=='checkbox' || motionOff())return;
    // Snapshot all identifiable thumbs: one controller may rebuild an entire
    // grid, including another switch that is still moving from a previous click.
    const records=[...document.querySelectorAll('input[type=checkbox]')].flatMap(input=>{
      const key=selector(input),track=slider(input);
      return key && track ? [{input,key,transform:getComputedStyle(track,'::before').transform}] : [];
    });
    requestAnimationFrame(()=>{
      if(motionOff())return;
      const staged=[];
      for(const record of records) {
        if(record.input.isConnected)continue; // Existing nodes already animate normally.
        const replacement=document.querySelector(record.key),track=slider(replacement);
        if(!track || !track.getClientRects().length)continue;
        track.style.setProperty('--liquid-toggle-from',record.transform);
        track.classList.add('liquid-toggle-resume');
        getComputedStyle(track,'::before').transform;
        staged.push(track);
      }
      requestAnimationFrame(()=>{
        for(const track of staged) {
          track.classList.remove('liquid-toggle-resume');
          track.style.removeProperty('--liquid-toggle-from');
        }
      });
    });
  },true);
})();
