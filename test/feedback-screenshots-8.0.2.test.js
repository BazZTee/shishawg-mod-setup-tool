'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const { EventEmitter } = require('node:events');

const root = path.resolve(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(root, 'src/renderer/index.html'), 'utf8');
const feedbackCode = fs.readFileSync(path.join(root, 'src/renderer/modules/10-feedback.js'), 'utf8');
const trelloCode = fs.readFileSync(path.join(root, 'src/main/trelloService.js'), 'utf8');
const trelloService = require('../src/main/trelloService');

const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01, 0x02]);

test('feedback dialog accepts and lists up to four screenshot files', () => {
  assert.match(indexHtml, /id="cr-screenshots"[^>]*accept="image\/png,image\/jpeg,image\/webp"[^>]*multiple/);
  assert.match(indexHtml, /id="cr-screenshot-list"/);
  assert.match(feedbackCode, /MAX_CHANGE_REQUEST_SCREENSHOTS = 4/);
  assert.match(feedbackCode, /MAX_CHANGE_REQUEST_SCREENSHOT_BYTES = 8 \* 1024 \* 1024/);
  assert.match(feedbackCode, /selectedScreenshots\.splice/);
  assert.match(feedbackCode, /new Uint8Array\(await file\.arrayBuffer\(\)\)/);
  assert.match(feedbackCode, /screenshots\s*\n\s*\}\);/);
});

test('Trello screenshot validation allows real images and sanitizes filenames', () => {
  const attachments = trelloService.normalizeScreenshotAttachments([{
    name: '../screen\r\nshot.png',
    type: 'image/png',
    data: new Uint8Array(pngBytes)
  }]);

  assert.equal(attachments.length, 1);
  assert.equal(attachments[0].name, '.._screen__shot.png');
  assert.equal(attachments[0].mimeType, 'image/png');
  assert.deepEqual(attachments[0].buffer, pngBytes);
  assert.throws(() => trelloService.normalizeScreenshotAttachments([{
    name: 'fake.png',
    type: 'image/png',
    data: Buffer.from('not-an-image')
  }]), /Bildformat/);
  assert.throws(() => trelloService.normalizeScreenshotAttachments([{
    name: 'script.svg',
    type: 'image/svg+xml',
    data: Buffer.from('<svg/>')
  }]), /nicht unterstütztes Dateiformat/);
  assert.throws(() => trelloService.normalizeScreenshotAttachments(Array.from({ length: 5 }, (_, index) => ({
    name: `screen-${index}.png`,
    type: 'image/png',
    data: pngBytes
  }))), /höchstens 4 Screenshots/);
});

test('Trello attachment multipart body preserves the selected image bytes', () => {
  const attachment = trelloService.normalizeScreenshotAttachments([{
    name: 'bug.png',
    type: 'image/png',
    data: pngBytes
  }])[0];
  const { boundary, body } = trelloService.buildAttachmentMultipart(attachment, 'test-boundary');

  assert.equal(boundary, 'test-boundary');
  assert.match(body.toString('latin1'), /Content-Disposition: form-data; name="file"; filename="bug\.png"/);
  assert.match(body.toString('latin1'), /Content-Type: image\/png/);
  assert.notEqual(body.indexOf(pngBytes), -1);
  assert.match(trelloCode, /\/1\/cards\/\$\{encodeURIComponent\(cardId\)\}\/attachments/);
  assert.match(trelloCode, /attachmentErrors/);
  assert.match(trelloCode, /attachmentsUploaded/);
});

test('a failed screenshot upload does not turn the created Trello card into a total failure', async () => {
  const originalRequest = https.request;
  const requests = [];
  https.request = (options, callback) => {
    const index = requests.length;
    const record = { options, body: Buffer.alloc(0) };
    requests.push(record);
    const req = new EventEmitter();
    req.write = chunk => { record.body = Buffer.concat([record.body, Buffer.from(chunk)]); };
    req.end = () => {
      queueMicrotask(() => {
        const res = new EventEmitter();
        res.statusCode = index === 2 ? 500 : 200;
        callback(res);
        const response = index === 0
          ? JSON.stringify({ id: 'card-123', shortUrl: 'https://trello.test/c/card-123', name: 'Test' })
          : index === 2 ? 'upload failed' : JSON.stringify({ id: 'attachment-1' });
        res.emit('data', response);
        res.emit('end');
      });
    };
    return req;
  };

  try {
    const result = await trelloService.createChangeRequestCard({
      category: 'Fehler',
      title: 'Screenshot-Test',
      details: 'Zwei Anhänge',
      screenshots: [
        { name: 'one.png', type: 'image/png', data: pngBytes },
        { name: 'two.png', type: 'image/png', data: pngBytes }
      ]
    });

    assert.equal(result.success, true);
    assert.equal(result.id, 'card-123');
    assert.equal(result.attachmentsUploaded, 1);
    assert.equal(result.attachmentErrors.length, 1);
    assert.equal(result.attachmentErrors[0].name, 'two.png');
    assert.equal(requests.length, 3);
    assert.match(requests[1].options.path, /\/1\/cards\/card-123\/attachments\?/);
    assert.match(requests[1].options.headers['Content-Type'], /^multipart\/form-data; boundary=/);
  } finally {
    https.request = originalRequest;
  }
});
