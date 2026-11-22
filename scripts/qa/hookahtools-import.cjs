const { app, BrowserWindow, ipcMain } = require('electron');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
app.setPath('userData', path.join(root, 'qa-output', 'hookahtools-import-profile'));
app.disableHardwareAcceleration();
ipcMain.handle('db:get-marv-hookahtools-mix', () => ({
  success: true,
  mix: {
    mixId: 'qa-mix', createdAt: new Date().toISOString(),
    flavors: [
      { name: 'Aino Strong - Black', percentage: 58 },
      { name: 'Blackburn - Roze T', percentage: 29 },
      { name: 'MustH - Early Grey', percentage: 13 }
    ]
  }
}));
ipcMain.handle('db:get-catalog', () => ({ pipes: [], bowls: [], hmds: [], tobacco: [], charcoal: [] }));

async function run() {
  await app.whenReady();
  const win = new BrowserWindow({
    show: false, width: 1200, height: 850,
    webPreferences: { preload: path.join(root, 'src/main/preload.js'), contextIsolation: true, sandbox: true, offscreen: true }
  });
  await win.loadFile(path.join(root, 'src/renderer/index.html'));
  const evaluate = code => win.webContents.executeJavaScript(code, true);
  await new Promise(resolve => setTimeout(resolve, 500));
  await evaluate(`(() => {
    document.documentElement.classList.remove('swg-starting');
    state.twitchUser = { login: 'marved', isModerator: true };
    showView('view-setup');
    state.personCount = 1;
    state.persons = [{ name: 'Marvin', pipe: 'Futr', bowl: 'Cosmo', hmd: 'ONMO', tobaccos: ['Alt'], tobaccoAmounts: [''], tobaccoUnit: 'g' }];
    renderPersonsGrid();
    document.getElementById('btn-import-hookahtools').click();
  })()`);
  await new Promise(resolve => setTimeout(resolve, 100));
  const fullView = await evaluate(`(() => ({
    tobaccos: [...document.querySelectorAll('#view-setup .input-p-tob')].map(input => input.value),
    amounts: [...document.querySelectorAll('#view-setup .input-p-tob-amount')].map(input => input.value),
    pipe: state.persons[0].pipe, bowl: state.persons[0].bowl, hmd: state.persons[0].hmd,
    command: document.getElementById('command-output').value,
  }))()`);
  assert.deepEqual(fullView.tobaccos, ['Aino Strong - Black', 'Blackburn - Roze T', 'MustH - Early Grey']);
  assert.deepEqual(fullView.amounts, ['58', '29', '13']);
  assert.equal(fullView.pipe, 'Futr');
  assert.equal(fullView.bowl, 'Cosmo');
  assert.equal(fullView.hmd, 'ONMO');
  assert.match(fullView.command, /58%/);

  await evaluate(`(() => {
    saveCustomDashboardLayout({
      version: CUSTOM_DASHBOARD_LAYOUT_VERSION,
      root: makeDashboardPanel({ id: 'widget-setup', features: ['setup'], collapsed: false })
    });
    showView('view-custom-dashboard');
    state.persons[0].tobaccos = ['Alt'];
    state.persons[0].tobaccoAmounts = [''];
    renderPersonsGrid();
    document.getElementById('btn-import-hookahtools').click();
  })()`);
  await new Promise(resolve => setTimeout(resolve, 100));
  const dashboard = await evaluate(`(() => ({
    mounted: !!document.querySelector('#view-custom-dashboard #view-setup #btn-import-hookahtools'),
    visible: document.getElementById('btn-import-menu').getBoundingClientRect().width > 0,
    tobaccos: [...document.querySelectorAll('#view-custom-dashboard #view-setup .input-p-tob')].map(input => input.value),
    amounts: [...document.querySelectorAll('#view-custom-dashboard #view-setup .input-p-tob-amount')].map(input => input.value)
  }))()`);
  assert.equal(dashboard.mounted, true);
  assert.equal(dashboard.visible, true);
  assert.deepEqual(dashboard.tobaccos, fullView.tobaccos);
  assert.deepEqual(dashboard.amounts, fullView.amounts);
  console.log('HookahTools import works in setup view and personal dashboard.');
  await win.close();
  app.quit();
}

run().catch(error => { console.error(error); app.exit(1); });
