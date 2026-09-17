const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const asar = require('@electron/asar');
const root = path.resolve(__dirname,'..');
const archive = path.join(root,'dist/win-unpacked/resources/app.asar');
const required = ['src/main/main.js','src/main/preload.js','src/main/runtime.js','src/main/settings-store.js','src/main/window-security.js','src/renderer/index.html','src/renderer/renderer.js','src/renderer/workspace.js','src/renderer/workspace.css','src/renderer/styles.css','build/icon.png','build/icon.ico','docs/qna.html','docs/claim.html','docs/overlay.html'];
required.push('src/renderer/glass.js','src/renderer/glass.css');
required.push('src/renderer/liquid-motion.js','src/renderer/liquid-motion.css');
required.push('src/renderer/liquid-controls.js','src/renderer/disclosure-motion.js','src/renderer/disclosure-motion.css');
required.push('src/renderer/liquid-selection.js');
required.push('src/renderer/shell-layout.css');
required.push('src/main/startup-window.js');
required.push('src/renderer/startup-presentation.js');
required.push('src/renderer/toggle-motion.js');
for (const file of required) {
  const localPath = path.join(...file.split('/'));
  assert.deepEqual(asar.extractFile(archive,localPath),fs.readFileSync(path.join(root,localPath)),`Packaged file differs: ${file}`);
}
const pkg = JSON.parse(asar.extractFile(archive,'package.json'));
assert.equal(pkg.name,'shishawg-mod-setup-tool-chat-gpt');
assert.equal(pkg.swgTestBuild,true);
const files = asar.listPackage(archive);
assert.equal(files.some(file=>file.split(path.sep).includes('test')),false);
console.log(JSON.stringify({verifiedFiles:required.length,packagedEntries:files.length,identity:pkg.name,testFixturesIncluded:false}));
