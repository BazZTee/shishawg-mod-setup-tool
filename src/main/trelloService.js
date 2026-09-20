'use strict';

const https = require('https');
const crypto = require('crypto');

const MAX_SCREENSHOT_COUNT = 4;
const MAX_SCREENSHOT_BYTES = 8 * 1024 * 1024;
const MAX_SCREENSHOT_TOTAL_BYTES = 24 * 1024 * 1024;
const ALLOWED_SCREENSHOT_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

const TRELLO_CONFIG = {
  key: 'f67cb1a10543b628dc56c8ff9cd32642',
  token: 'ATTA6923fc8e51cee9b4d845a017355b02ae8f20ab4995b40de886c150f89084b0ec091E2000',
  boardId: '6a99eaeae136fce6c527f497',
  listIdEingang: '6a99eaeb827902c6a241403d',
  labels: {
    'Fehler': '6a99eb0949122316a03012e9',
    'Wunsch': '6a99eb09146d4db5ee3a62ad',
    'UI': '6a99eb0945baf71c1aa82b09',
    'Inhalt & Daten': '6a99eb0a16ff8b842d83e130',
    'Sonstiges': '6a99eb0aee2fdb83a12a879c'
  }
};

function getLabelIdForCategory(category) {
  if (!category) return TRELLO_CONFIG.labels['Wunsch'];
  if (category.includes('Fehler') || category.includes('Bug')) return TRELLO_CONFIG.labels['Fehler'];
  if (category.includes('UI') || category.includes('Design')) return TRELLO_CONFIG.labels['UI'];
  if (category.includes('Inhalt') || category.includes('Daten') || category.includes('Tabak')) return TRELLO_CONFIG.labels['Inhalt & Daten'];
  if (category.includes('Sonstiges')) return TRELLO_CONFIG.labels['Sonstiges'];
  return TRELLO_CONFIG.labels['Wunsch'];
}

function toAttachmentBuffer(data) {
  if (Buffer.isBuffer(data)) return Buffer.from(data);
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  if (ArrayBuffer.isView(data)) return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  if (Array.isArray(data)) return Buffer.from(data);
  if (data && data.type === 'Buffer' && Array.isArray(data.data)) return Buffer.from(data.data);
  return null;
}

function hasScreenshotSignature(buffer, mimeType) {
  if (mimeType === 'image/png') {
    return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (mimeType === 'image/jpeg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === 'image/webp') {
    return buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  }
  return false;
}

function normalizeScreenshotAttachments(screenshots) {
  if (!screenshots) return [];
  if (!Array.isArray(screenshots)) throw new Error('Ungültige Screenshot-Daten.');
  if (screenshots.length > MAX_SCREENSHOT_COUNT) throw new Error(`Es sind höchstens ${MAX_SCREENSHOT_COUNT} Screenshots erlaubt.`);

  let totalBytes = 0;
  return screenshots.map((item, index) => {
    const mimeType = String(item?.type || '').toLowerCase();
    if (!ALLOWED_SCREENSHOT_TYPES.has(mimeType)) throw new Error(`Screenshot ${index + 1} hat ein nicht unterstütztes Dateiformat.`);
    const buffer = toAttachmentBuffer(item?.data);
    if (!buffer || !buffer.length) throw new Error(`Screenshot ${index + 1} enthält keine Bilddaten.`);
    if (!hasScreenshotSignature(buffer, mimeType)) throw new Error(`Screenshot ${index + 1} stimmt nicht mit dem angegebenen Bildformat überein.`);
    if (buffer.length > MAX_SCREENSHOT_BYTES) throw new Error(`Screenshot ${index + 1} ist größer als 8 MB.`);
    totalBytes += buffer.length;
    if (totalBytes > MAX_SCREENSHOT_TOTAL_BYTES) throw new Error('Die Screenshots sind zusammen größer als 24 MB.');

    const fallbackExtension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
    const cleanName = String(item?.name || `screenshot-${index + 1}.${fallbackExtension}`)
      .replace(/[\\/\r\n"]/g, '_')
      .slice(0, 140);
    return { name: cleanName, mimeType, buffer };
  });
}

function requestTrello(options, body) {
  return new Promise((resolve) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = null;
        try { parsed = data ? JSON.parse(data) : null; } catch (_error) {}
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, data: parsed, raw: data });
        } else {
          resolve({ success: false, error: `Trello API HTTP ${res.statusCode}: ${data}` });
        }
      });
    });
    req.on('error', err => resolve({ success: false, error: err.message }));
    if (body) req.write(body);
    req.end();
  });
}

function buildAttachmentMultipart(attachment, boundary = `----SWGModTool${crypto.randomBytes(12).toString('hex')}`) {
  const header = Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${attachment.name}"\r\n` +
    `Content-Type: ${attachment.mimeType}\r\n\r\n`,
    'utf8'
  );
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
  return { boundary, body: Buffer.concat([header, attachment.buffer, footer]) };
}

async function uploadCardAttachment(cardId, attachment) {
  const { boundary, body } = buildAttachmentMultipart(attachment);
  const params = new URLSearchParams({
    key: TRELLO_CONFIG.key,
    token: TRELLO_CONFIG.token,
    name: attachment.name,
    mimeType: attachment.mimeType,
    setCover: 'false'
  });
  return requestTrello({
    hostname: 'api.trello.com',
    port: 443,
    path: `/1/cards/${encodeURIComponent(cardId)}/attachments?${params.toString()}`,
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Accept': 'application/json',
      'Content-Length': body.length
    }
  }, body);
}

async function createChangeRequestCard({ category, title, details, contextTable, modName, screenshots }) {
  try {
    const attachments = normalizeScreenshotAttachments(screenshots);
    const cleanTitle = String(title || '').trim();
    const cardName = `[${category || 'Wunsch'}] ${cleanTitle}`;
    const labelId = getLabelIdForCategory(category);

    let desc = '';
    if (contextTable) desc += `${contextTable}\n\n---\n\n`;
    desc += `### 📝 Beschreibung & Feedback\n${String(details || '').trim()}`;

    const bodyData = JSON.stringify({
      idList: TRELLO_CONFIG.listIdEingang,
      idLabels: labelId ? [labelId] : [],
      name: cardName,
      desc,
      pos: 'top'
    });
    const cardResult = await requestTrello({
      hostname: 'api.trello.com',
      port: 443,
      path: `/1/cards?key=${TRELLO_CONFIG.key}&token=${TRELLO_CONFIG.token}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Content-Length': Buffer.byteLength(bodyData)
      }
    }, bodyData);

    if (!cardResult.success) return cardResult;
    const card = cardResult.data || {};
    const result = { success: true, id: card.id, url: card.shortUrl || null, name: card.name || cardName, attachmentsUploaded: 0, attachmentErrors: [] };
    if (!attachments.length) return result;
    if (!card.id) {
      result.attachmentErrors.push({ name: 'Screenshots', error: 'Trello hat keine Karten-ID zurückgegeben.' });
      return result;
    }

    for (const attachment of attachments) {
      const upload = await uploadCardAttachment(card.id, attachment);
      if (upload.success) result.attachmentsUploaded += 1;
      else result.attachmentErrors.push({ name: attachment.name, error: upload.error || 'Upload fehlgeschlagen' });
    }
    return result;
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = {
  TRELLO_CONFIG,
  MAX_SCREENSHOT_COUNT,
  MAX_SCREENSHOT_BYTES,
  getLabelIdForCategory,
  normalizeScreenshotAttachments,
  hasScreenshotSignature,
  buildAttachmentMultipart,
  uploadCardAttachment,
  createChangeRequestCard
};
