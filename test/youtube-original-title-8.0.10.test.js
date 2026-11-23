const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');

const main = fs.readFileSync(path.join(__dirname, '../src/main/main.js'), 'utf8');

// Load fetchYouTubeOriginalTitle with a fake https module (no network in tests).
function loadLookup(responder) {
  const code = main.match(/const youtubeOriginalTitleCache[\s\S]*?\n}\n/)[0];
  const calls = [];
  const https = {
    get(url, options, callback) {
      calls.push(url);
      const req = new EventEmitter();
      req.setTimeout = () => {};
      req.destroy = () => {};
      const { status, body } = responder(url);
      const res = new EventEmitter();
      res.statusCode = status;
      process.nextTick(() => {
        callback(res);
        res.emit('data', body);
        res.emit('end');
      });
      return req;
    }
  };
  const fn = new Function('https', `${code}\nreturn fetchYouTubeOriginalTitle;`)(https);
  return { fn, calls };
}

test('chat uses the original (German) video title instead of the auto-translated search title', async () => {
  const { fn, calls } = loadLookup(() => ({ status: 200, body: JSON.stringify({ title: 'Shisha Raucht und Schmeckt Nicht! Troubleshooting Guide!' }) }));
  assert.equal(await fn('r4GaDCi8ks0'), 'Shisha Raucht und Schmeckt Nicht! Troubleshooting Guide!');
  assert.match(calls[0], /youtube\.com\/oembed\?format=json&url=/);
  await fn('r4GaDCi8ks0');
  assert.equal(calls.length, 1, 'title is cached per video');
});

test('failed lookup keeps the search title', async () => {
  const { fn } = loadLookup(() => ({ status: 404, body: 'Not Found' }));
  assert.equal(await fn('missing'), '');
  assert.match(main, /if \(originalTitle\) item\.title = originalTitle;/);
  assert.match(main, /search_query=\$\{encodeURIComponent\(term\)\}&hl=de&gl=DE/);
});
