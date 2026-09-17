// Show only a fully composed presentation; never wait for remote service data.
const startupOptions={show:false,backgroundColor:'#080e1c'};
const preparePresentation=`(async()=>{
  await document.fonts.ready;
  if (!document.body.classList.contains('swg-glass') || !document.querySelector('.workspace-sidebar') || !document.querySelector('.glass-setup-layout')) {
    throw new Error('Die Oberfläche konnte nicht vollständig aufgebaut werden.');
  }
  document.documentElement.classList.remove('swg-starting');
  // Let layout and painting catch up with the synchronous presentation scripts.
  await new Promise(requestAnimationFrame);
  await new Promise(requestAnimationFrame);
  return true;
})()`;
function revealWhenReady(win,reveal=()=>win.show()) {
  return new Promise((resolve,reject)=>{
    let complete=false;
    const cleanup=()=>{
      win.webContents.removeListener('did-finish-load',loaded);
      win.webContents.removeListener('did-fail-load',failed);
      win.removeListener('closed',closed);
    };
    const finish=(error)=>{
      if(complete)return;complete=true;cleanup();
      if(error)reject(error);else resolve(false);
    };
    const closed=()=>finish();
    const failed=(_event,code,description,_url,isMainFrame)=>{
      if(isMainFrame && code!==-3)finish(new Error(description));
    };
    const loaded=async()=>{
      try {
        await win.webContents.executeJavaScript(preparePresentation);
        if(complete || win.isDestroyed())return;
        reveal();complete=true;cleanup();resolve(true);
      } catch(error) {finish(error);}
    };
    win.once('closed',closed);
    win.webContents.once('did-finish-load',loaded);
    win.webContents.on('did-fail-load',failed);
  });
}
module.exports={startupOptions,revealWhenReady};
