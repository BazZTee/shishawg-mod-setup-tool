// Additional integration checks for the presentation rework. All service calls
// are still handled by the parent harness's offline fixtures.
module.exports = async ({ win, evaluate, check, screenshot, views }) => {
  const reachable = id => `(() => { const el=document.getElementById(${JSON.stringify(id)}); el.scrollIntoView({block:'center'}); const r=el.getBoundingClientRect(); const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2); return r.width>0 && r.height>0 && (el===hit || el.contains(hit)); })()`;
  await evaluate('showView("view-setup"); window.__glassPersonsBefore=JSON.stringify(state.persons);');
  await check('Moved notes control is reachable', reachable('btn-toggle-notes'));
  await evaluate('document.getElementById("btn-toggle-notes").click()');
  await check('Notes still hide using the original handler', 'document.getElementById("notes-card").classList.contains("hidden")');
  await evaluate('document.getElementById("btn-toggle-notes").click()');
  await check('Notes reopen without modifying the setup', '!document.getElementById("notes-card").classList.contains("hidden") && JSON.stringify(state.persons)===window.__glassPersonsBefore');
  await check('Preview send action can be reached at 960 by 700', reachable('btn-send-chat'));
  await check('Last of ten person forms can be scrolled into view', `(() => { const el=document.querySelectorAll('.input-p-name')[9]; el.scrollIntoView({block:'center'}); const r=el.getBoundingClientRect(); return r.top>=0 && r.bottom<=innerHeight && document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===el; })()`);
  await evaluate('document.getElementById("btn-import-menu").scrollIntoView({block:"center"}); document.getElementById("btn-import-menu").click();');
  await check('Import menu remains openable and unobscured', reachable('btn-open-paste-modal'));
  await screenshot('17-import-menu-960');
  await evaluate('document.getElementById("btn-import-menu").click(); document.getElementById("btn-toggle-promo").scrollIntoView({block:"center"}); document.getElementById("btn-toggle-promo").click();');
  await screenshot('23-promo-expanded-960');
  await check('Promo fields remain reachable in the flattened editor', reachable('input-global-promo'));
  await evaluate('document.getElementById("btn-toggle-promo").click();');

  for (const id of views) {
    await evaluate(`showView(${JSON.stringify(id)}); document.getElementById(${JSON.stringify(id)}).scrollTop=0;`);
    await check('All module content fits the minimum width: '+id, `document.getElementById(${JSON.stringify(id)}).scrollWidth<=document.getElementById(${JSON.stringify(id)}).clientWidth+1`);
  }
  await evaluate('showView("view-polls"); document.getElementById("tab-nav-predictions").click();');
  await check('Prediction switch retains its original panel behavior', '!document.getElementById("panel-mode-predictions").classList.contains("hidden") && document.getElementById("panel-mode-polls").classList.contains("hidden")');
  await screenshot('18-predictions-960');
  await evaluate('showView("view-stats"); document.getElementById("tab-stats-analytics").click();');
  await check('Analytics tab retains its original behavior and fits', '!document.getElementById("panel-stats-analytics").classList.contains("hidden") && document.getElementById("view-stats").scrollWidth<=document.getElementById("view-stats").clientWidth+1');
  await screenshot('19-analytics-960');

  await evaluate('document.querySelector("[data-ws-action=preferences]").click(); document.getElementById("ws-density").click(); document.getElementById("ws-motion").click();');
  await check('Compact and reduced-motion settings still work', 'document.body.classList.contains("ws-compact") && document.body.classList.contains("ws-reduced-motion")');
  await check('Reduced-motion setting overrides new transitions', 'parseFloat(getComputedStyle(document.querySelector(".hub-tile-card")).transitionDuration)<0.001');
  await evaluate('document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true})); showView("view-setup");');
  await check('Compact setup fits the viewport', 'document.getElementById("view-setup").scrollWidth<=document.getElementById("view-setup").clientWidth+1');
  await evaluate('document.querySelector("[data-ws-action=preferences]").click(); document.getElementById("ws-density").click(); document.getElementById("ws-motion").click(); document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}));');

  win.setSize(1440,960);
  await evaluate('document.querySelector("[data-ws-action=catalog]").click();');
  await check('Catalog remains accessible through the original action', '!!document.querySelector(".modal-overlay:not(.hidden)")');
  await screenshot('20-catalog');
  // Close fixture dialogs for the remaining visual snapshots only.
  await evaluate('document.querySelectorAll(".modal-overlay").forEach(el=>el.classList.add("hidden")); document.getElementById("btn-open-streamer-profiles").click();');
  await check('Profile management opens through its original action', '!!document.querySelector(".modal-overlay:not(.hidden)")');
  await screenshot('21-profiles');
  await evaluate('document.querySelectorAll(".modal-overlay").forEach(el=>el.classList.add("hidden")); showView("view-stats"); document.getElementById("tab-stats-analytics").click();');
  await screenshot('22-analytics');
};
