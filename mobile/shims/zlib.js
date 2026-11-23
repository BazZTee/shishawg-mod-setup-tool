'use strict';
// The Stream Deck plugin package is desktop-only; Android never builds it.
function unavailable() {
  throw new Error('Stream Deck ist nur in der Desktop-App verfügbar.');
}
module.exports = { deflateRawSync: unavailable, inflateRawSync: unavailable };
