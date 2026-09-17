'use strict';

const https = require('https');

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

function createChangeRequestCard({ category, title, details, contextTable, modName }) {
  return new Promise((resolve) => {
    try {
      const cleanTitle = String(title || '').trim();
      const cardName = `[${category || 'Wunsch'}] ${cleanTitle}`;
      const labelId = getLabelIdForCategory(category);

      let desc = '';
      if (contextTable) {
        desc += `${contextTable}\n\n---\n\n`;
      }
      desc += `### 📝 Beschreibung & Feedback\n${String(details || '').trim()}`;

      const bodyData = JSON.stringify({
        idList: TRELLO_CONFIG.listIdEingang,
        idLabels: labelId ? [labelId] : [],
        name: cardName,
        desc: desc,
        pos: 'top'
      });

      const options = {
        hostname: 'api.trello.com',
        port: 443,
        path: `/1/cards?key=${TRELLO_CONFIG.key}&token=${TRELLO_CONFIG.token}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Content-Length': Buffer.byteLength(bodyData)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsed = JSON.parse(data);
              resolve({ success: true, id: parsed.id, url: parsed.shortUrl, name: parsed.name });
            } catch (e) {
              resolve({ success: true, url: null });
            }
          } else {
            resolve({ success: false, error: `Trello API HTTP ${res.statusCode}: ${data}` });
          }
        });
      });

      req.on('error', (err) => {
        resolve({ success: false, error: err.message });
      });

      req.write(bodyData);
      req.end();
    } catch (err) {
      resolve({ success: false, error: err.message });
    }
  });
}

module.exports = {
  TRELLO_CONFIG,
  getLabelIdForCategory,
  createChangeRequestCard
};
