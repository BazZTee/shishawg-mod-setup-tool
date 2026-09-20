const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('switching streamer profiles clears giveaway addresses before the backend channel changes', () => {
  const workspace = read('src/renderer/modules/01-workspace.js');
  const begin = workspace.indexOf('beginGiveawayChannelTransition(prof.targetChannel)');
  const persist = workspace.indexOf("ipcRenderer.invoke('profiles:set-active', activeProfileId)");
  const complete = workspace.indexOf('completeGiveawayChannelTransition(prof.targetChannel)');

  assert.ok(begin >= 0, 'channel transition must clear the renderer state');
  assert.ok(persist > begin, 'the UI must be cleared before the backend channel switch');
  assert.ok(complete > persist, 'channel data may only reload after the backend switch');
});

test('giveaway history rejects stale channel responses and clears an orphaned detail view', () => {
  const giveaways = read('src/renderer/modules/06-giveaways.js');

  assert.match(giveaways, /channelTransitioning:\s*false/);
  assert.match(giveaways, /historyRequestId:\s*0/);
  assert.match(giveaways, /requestId !== giveawayState\.historyRequestId/);
  assert.match(giveaways, /channelKey !== giveawayState\.channelKey/);
  assert.match(
    giveaways,
    /else \{\s*\/\/ The selected entry does not belong to the active channel anymore\.[\s\S]*?giveawayState\.currentWinner = null;[\s\S]*?renderAddressReview\(null\);/
  );
});
