const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const root = path.resolve(__dirname, '..');
const localElectron = path.join(root, 'node_modules/electron/dist');
const args = [require.resolve('electron-builder/cli.js'), '--win', 'portable', '--x64', '--publish', 'never'];
if (fs.existsSync(path.join(localElectron, 'electron.exe'))) args.push(`--config.electronDist=${localElectron}`);
const result = spawnSync(process.execPath, args, {
  cwd: root,
  stdio: 'inherit',
  windowsHide: true,
  env: { ...process.env, ELECTRON_BUILDER_CACHE: path.join(root, '.electron-builder-cache'), ELECTRON_CACHE: path.join(root, '.electron-cache'), CSC_IDENTITY_AUTO_DISCOVERY: 'false' }
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
