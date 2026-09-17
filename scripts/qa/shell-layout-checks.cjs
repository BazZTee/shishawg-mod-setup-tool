module.exports=async({win,evaluate,check,screenshot})=>{
  await evaluate('showView("view-landing");');
  for(const width of [1440,1200]) {
    win.setSize(width,960);await evaluate('__motionPause(350)');
    await check('All sidebar icons stay fixed through collapse and expansion at '+width, `(async()=>{
      const nodes=[...document.querySelectorAll('.workspace-sidebar .ws-icon,.workspace-sidebar .app-logo')];
      const rects=()=>nodes.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};});
      const initial=rects();let stable=true;const sample=()=>{const current=rects();stable=stable && current.every((r,i)=>['x','y','width','height'].every(k=>Math.abs(r[k]-initial[i][k])<.8));};
      document.getElementById('ws-collapse').click();await __motionPause(65);sample();await __motionPause(300);sample();
      document.getElementById('ws-collapse').click();await __motionPause(65);sample();await __motionPause(300);sample();return stable;
    })()`);
  }
  win.setSize(1440,960);await evaluate('__motionPause(350)');
  await evaluate('document.getElementById("ws-collapse").click();');
  await screenshot('31-stationary-collapsed-sidebar');
  await check('Collapsed group labels become dividers without losing their height', `(()=>{const label=document.querySelector('.ws-tools-label');return label.getBoundingClientRect().height>10 && getComputedStyle(label,'::after').opacity==='1';})()`);
  await evaluate('document.getElementById("ws-collapse").click();');
  await evaluate('__motionPause(350)');
  await check('Overview has no duplicate status strip and begins near the header', `(()=>{
    const hero=document.querySelector('.landing-hero').getBoundingClientRect(),header=document.querySelector('.app-header').getBoundingClientRect();
    return getComputedStyle(document.querySelector('.ws-status-strip')).display==='none' && hero.top-header.bottom<24;
  })()`);
  await check('All eight modules are visible together at 1440 by 960 when connected', `[...document.querySelectorAll('.hub-tile-card')].every(el=>el.getBoundingClientRect().bottom<=innerHeight-12)`);
  await screenshot('32-compact-overview');
  for(const width of [1440,960]) {
    win.setSize(width,960);await evaluate('__motionPause(350)');
    await check('Search, profile and Twitch account have equal heights at '+width, `(()=>{
      const sizes=['.ws-search-trigger','.header-profile-widget','.user-badge'].map(s=>document.querySelector(s).getBoundingClientRect().height);
      return sizes.every(h=>Math.abs(h-38)<1) && document.documentElement.scrollWidth<=innerWidth;
    })()`);
    await check('Header controls remain visible and do not overlap at '+width, `(()=>{
      const selectors=['.ws-breadcrumb','.ws-search-trigger','.header-profile-widget','.user-badge'];
      const boxes=selectors.map(s=>document.querySelector(s).getBoundingClientRect());
      return boxes.every((r,i)=>r.width>0 && r.right<=innerWidth && (!i || r.left>=boxes[i-1].right));
    })()`);
  }
  await evaluate('showView("view-setup");');
  await check('Setup starts with its controls instead of a redundant masthead', `getComputedStyle(document.querySelector('#view-setup .glass-masthead')).display==='none' && document.getElementById('btn-toggle-notes').getBoundingClientRect().height>0`);
  await screenshot('33-setup-without-double-title-960');
  await evaluate('showView("view-qna");');
  await check('Q&A actions survive the removal of the redundant heading', `getComputedStyle(document.querySelector('#view-qna .ws-module-heading')).display==='none' && document.getElementById('btn-toggle-qna-listener').getBoundingClientRect().height>0 && document.getElementById('btn-qna-menu').getBoundingClientRect().height>0`);
  await evaluate('showView("view-custom-dashboard");');
  await check('All three dashboard management actions remain visible', `['btn-custom-dashboard-lock','btn-custom-dashboard-add-widget','btn-custom-dashboard-reset-layout'].every(id=>document.getElementById(id).getBoundingClientRect().height>0)`);
  await evaluate('document.getElementById("btn-open-streamer-profiles").click();');
  await check('Restyled profile button still opens the existing profile manager', `!!document.querySelector('.modal-overlay:not(.hidden)') && !!document.querySelector('#btn-open-streamer-profiles svg')`);
  await evaluate('document.querySelectorAll(".modal-overlay").forEach(el=>el.classList.add("hidden"));');
  win.setSize(960,700);await evaluate('__motionPause(350)');
  await check('All module breadcrumbs and header actions fit at minimum window size', `(async()=>{
    let fits=true;
    for(const button of document.querySelectorAll('[data-ws-route]')) {
      showView(button.dataset.wsRoute);await __motionPause(30);
      const boxes=['.ws-breadcrumb','.ws-search-trigger','.header-profile-widget','.user-badge'].map(s=>document.querySelector(s).getBoundingClientRect());
      fits=fits && boxes.every((r,i)=>r.width>0 && r.right<=innerWidth && (!i || r.left>=boxes[i-1].right));
    }
    return fits;
  })()`);
  await check('Logged-out Twitch button matches the header and remains reachable', `(()=>{
    const user=state.twitchUser;state.twitchUser=null;updateTwitchUI();
    const login=document.getElementById('btn-twitch-login').getBoundingClientRect();
    const profile=document.querySelector('.header-profile-widget').getBoundingClientRect();
    const okay=Math.abs(login.height-38)<1 && login.left>=profile.right && login.right<=innerWidth;
    state.twitchUser=user;updateTwitchUI();return okay;
  })()`);
  win.setSize(1440,960);
  await evaluate('showView("view-setup");document.getElementById("view-setup").scrollTop=0;const toggle=document.querySelector(".chk-p-electric");if(!toggle.checked)toggle.click();');
  await screenshot('34-green-active-toggle');
  await evaluate('showView("view-landing");document.getElementById("view-landing").scrollTop=0;__motionPause(350);');
};
