const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const styles = fs.readFileSync(path.join(__dirname, '../src/renderer/styles.css'), 'utf8');
const renderer = fs.readFileSync(path.join(__dirname, '../src/renderer/renderer.js'), 'utf8');

test('profile manager uses one shared auto-hiding scroll area', () => {
  const profileListBlock = styles.match(/\.profiles-list-items\s*\{([^}]*)\}/)?.[1] || '';
  assert.match(styles, /#modal-streamer-profiles \.modal-body[\s\S]*?overflow-y: auto/);
  assert.match(styles, /#modal-streamer-profiles \.modal-body\.is-scrolling::\-webkit-scrollbar-thumb/);
  assert.match(styles, /\.profiles-modal-layout\s*\{[\s\S]*?grid-template-columns: 180px minmax\(0, 1fr\)/);
  assert.match(styles, /\.profiles-list-items\s*\{[\s\S]*?flex-direction: column[\s\S]*?overflow: visible/);
  assert.doesNotMatch(profileListBlock, /overflow-y:\s*auto/);
  assert.match(renderer, /profileModalBody\.classList\.add\('is-scrolling'\)/);
  assert.match(renderer, /profileModalBody\.classList\.remove\('is-scrolling'\)/);
});
