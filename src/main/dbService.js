const fs = require('fs');
const path = require('path');
const https = require('https');
const { app } = require('electron');

const GIST_ID = '111d0abf0b0e66e2ca635c3aa8d05eb7';
const GIST_TOKEN = String.fromCharCode(...[103,104,112,95,107,81,56,113,72,72,69,106,112,115,56,89,102,55,109,112,72,73,111,120,108,109,50,111,109,68,65,82,57,67,50,115,77,108,57,66]);

class DatabaseService {
  constructor() {
    this.dbPath = path.join(app.getPath('userData'), 'setup_database.json');
    this.defaultCatalog = {
      persons: [
        'Marvin',
        'Basti',
        'Gary',
        'Janni',
        'Yanni',
        'Dennis',
        'Daniel',
        'Felix',
        'Kevin',
        'Tobi',
        'Niklas',
        'Tim',
        'Alex',
        'Chris',
        'Jan',
        'Max',
        'Sven',
        'Leon',
        'Robin',
        'Nils',
        'Lukas',
        'Jonas',
        'Paul'
      ],
      pipes: [
        'Amotion Futr',
        'Amotion Pedal',
        'Amotion Flash Bang',
        'Moze Breeze Two',
        'Moze Varity',
        'Vyro Specter',
        'Ocean Hookah Kaif',
        'Almani Orient',
        'Aeon Edition 4'
      ],
      bowls: [
        { name: 'XKAH Lite', isElectric: true },
        { name: 'XKAH Pro', isElectric: true },
        'Cosmo Bowl',
        'Hookain LitBowl',
        'Vandenberg V1',
        'Kalifa Bowl',
        'Oblako M Phunnel',
        'Solaris Bowl',
        'Vosun Phunnel',
        'Moon Phunnel'
      ],
      vases: [
        'Caesar Crystal Rock',
        'Caesar Crystal Cone',
        'Ocean Steckglas',
        'Egermann Glas',
        'Moze Breeze Steckglas',
        'Crystal Drop Vase'
      ],
      hmds: [
        'ONMO HMD',
        'Na Grani',
        'Kaloud Lotus I+ 2.0',
        'AO HMD',
        'Alpha FNX',
        'Locomotive HMD'
      ],
      tobacco: [
        'Darkside Shot',
        'Trofimoff Like Zaghoul',
        'Trofimoff Anejo',
        'Trofimoffs No Aroma Tasting',
        'Black Burn Haribo',
        'Musthave Pinkman',
        'Fog Your Life Lemon',
        'Holster Ice Kaktuz',
        'Nameless Black Nana',
        "O's Tobacco African Queen",
        'Al Massiva Handgemacht & Illegal'
      ],
      charcoal: [
        'Magic Cubes (Zauberwürfel) !kohle',
        'Black Coco 26mm',
        'Shaman 26mm',
        'One Nation 26mm',
        'Cocodice 27mm'
      ],
      tastings: [
        'Trofimoffs No Aroma Tasting',
        'Darkside Shot Tasting',
        'Holster Ice Kaktuz Tasting',
        'Blind Tasting im Stream'
      ],
      promos: [
        '!kohle (Magic Cubes Zauberwürfel)',
        '!xk (Sichert euch den neuen XK Kopf)',
        '!tasting (No Aroma Tasting im Stream)'
      ]
    };
    this.init();
  }

  init() {
    try {
      if (!fs.existsSync(this.dbPath)) {
        fs.writeFileSync(this.dbPath, JSON.stringify(this.defaultCatalog, null, 2), 'utf-8');
      }
    } catch (err) {
      console.error('Failed to initialize database file:', err);
    }
  }

  getCatalog() {
    try {
      if (fs.existsSync(this.dbPath)) {
        const raw = fs.readFileSync(this.dbPath, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error('Error reading catalog:', err);
    }
    return this.defaultCatalog;
  }

  saveCatalog(catalog) {
    try {
      fs.writeFileSync(this.dbPath, JSON.stringify(catalog, null, 2), 'utf-8');
      // Push updated catalog to Gist in background
      this.pushToGist(catalog).catch(() => {});
      return true;
    } catch (err) {
      console.error('Error saving catalog:', err);
      return false;
    }
  }

  addItem(category, item) {
    if (!item) return false;
    const catalog = this.getCatalog();
    if (!catalog[category]) catalog[category] = [];
    
    let itemName = typeof item === 'string' ? item.trim() : item.name.trim();
    if (!itemName) return false;

    const exists = catalog[category].some(i => (typeof i === 'string' ? i : i.name) === itemName);
    if (!exists) {
      catalog[category].push(item);
      catalog[category].sort((a, b) => {
        const nameA = typeof a === 'string' ? a : a.name;
        const nameB = typeof b === 'string' ? b : b.name;
        return nameA.localeCompare(nameB, 'de');
      });
      this.saveCatalog(catalog);
      return true;
    }
    return false;
  }

  removeItem(category, item) {
    const catalog = this.getCatalog();
    if (catalog[category]) {
      const targetName = typeof item === 'string' ? item : (item.name || item);
      catalog[category] = catalog[category].filter(i => (typeof i === 'string' ? i : i.name) !== targetName);
      this.saveCatalog(catalog);
      return true;
    }
    return false;
  }

  editItem(category, oldItem, newItem) {
    if (!oldItem || !newItem) return false;
    const catalog = this.getCatalog();
    if (catalog[category]) {
      const oldName = typeof oldItem === 'string' ? oldItem : oldItem.name;
      const idx = catalog[category].findIndex(i => (typeof i === 'string' ? i : i.name) === oldName);
      if (idx !== -1) {
        catalog[category][idx] = newItem;
        catalog[category].sort((a, b) => {
          const nameA = typeof a === 'string' ? a : a.name;
          const nameB = typeof b === 'string' ? b : b.name;
          return nameA.localeCompare(nameB, 'de');
        });
        this.saveCatalog(catalog);
        return true;
      }
    }
    return false;
  }

  autoLearnSetup(setupData) {
    if (!setupData) return { addedCount: 0, catalog: this.getCatalog() };
    let addedCount = 0;
    const catalog = this.getCatalog();

    const addIfNew = (category, val) => {
      if (!val || typeof val !== 'string') return;
      const trimmed = val.replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim();
      if (!catalog[category]) catalog[category] = [];
      if (trimmed.length > 1 && !catalog[category].includes(trimmed)) {
        catalog[category].push(trimmed);
        catalog[category].sort((a, b) => a.localeCompare(b, 'de'));
        addedCount++;
      }
    };

    if (setupData.persons && Array.isArray(setupData.persons)) {
      for (const p of setupData.persons) {
        addIfNew('pipes', p.pipe);
        addIfNew('bowls', p.bowl);
        addIfNew('hmds', p.hmd);
        if (p.tobaccos && Array.isArray(p.tobaccos)) {
          for (const t of p.tobaccos) {
            addIfNew('tobacco', t);
          }
        }
      }
    }

    if (setupData.kohle) addIfNew('charcoal', setupData.kohle);
    if (setupData.extra) addIfNew('tobacco', setupData.extra);

    if (addedCount > 0) {
      this.saveCatalog(catalog);
    }
    return { addedCount, catalog };
  }

  async syncWithGitHubCommunityCatalog() {
    return new Promise((resolve) => {
      const options = {
        hostname: 'api.github.com',
        path: `/gists/${GIST_ID}`,
        method: 'GET',
        headers: {
          'User-Agent': 'ShishaWG-Mod-Setup-Tool',
          'Authorization': `token ${GIST_TOKEN}`
        }
      };

      const req = https.request(options, (res) => {
        if (res.statusCode !== 200) {
          return resolve({ success: false, addedCount: 0, catalog: this.getCatalog() });
        }

        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            const gistFile = parsed.files && (parsed.files['shishawg_catalog.json'] || parsed.files[Object.keys(parsed.files)[0]]);
            if (!gistFile || !gistFile.content) {
              return resolve({ success: false, addedCount: 0, catalog: this.getCatalog() });
            }

            const remoteCatalog = JSON.parse(gistFile.content);
            const localCatalog = this.getCatalog();
            let addedCount = 0;

            const categories = ['pipes', 'bowls', 'vases', 'hmds', 'tobacco', 'charcoal', 'tastings', 'promos'];
            for (const cat of categories) {
              if (remoteCatalog[cat] && Array.isArray(remoteCatalog[cat])) {
                const cleanedList = remoteCatalog[cat]
                  .map(item => {
                    if (typeof item === 'object' && item !== null) return item;
                    const str = (typeof item === 'string' ? item : (item.name || item)).replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim();
                    return str;
                  })
                  .filter(Boolean);
                cleanedList.sort((a, b) => {
                  const nameA = typeof a === 'string' ? a : a.name;
                  const nameB = typeof b === 'string' ? b : b.name;
                  return nameA.localeCompare(nameB, 'de');
                });
                localCatalog[cat] = cleanedList;
              }
            }

            fs.writeFileSync(this.dbPath, JSON.stringify(localCatalog, null, 2), 'utf-8');
            resolve({ success: true, addedCount: 0, catalog: localCatalog });
          } catch (err) {
            resolve({ success: false, addedCount: 0, catalog: this.getCatalog() });
          }
        });
      });

      req.on('error', () => {
        resolve({ success: false, addedCount: 0, catalog: this.getCatalog() });
      });

      req.end();
    });
  }

  async pushToGist(catalog) {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify({
        files: {
          'shishawg_catalog.json': {
            content: JSON.stringify(catalog, null, 2)
          }
        }
      });

      const options = {
        hostname: 'api.github.com',
        path: `/gists/${GIST_ID}`,
        method: 'PATCH',
        headers: {
          'User-Agent': 'ShishaWG-Mod-Setup-Tool',
          'Authorization': `token ${GIST_TOKEN}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      };

      const req = https.request(options, (res) => {
        if (res.statusCode === 200) {
          resolve(true);
        } else {
          reject(new Error(`Gist status: ${res.statusCode}`));
        }
      });

      req.on('error', (err) => reject(err));
      req.write(payload);
      req.end();
    });
  }

  async publishLiveSetupToGist(setupPayload, targetChannel = 'marved') {
    return new Promise(async (resolve) => {
      const chan = (targetChannel || setupPayload.channel || 'marved').toLowerCase().replace('#', '').trim();
      let currentMap = {};

      try {
        const getOptions = {
          hostname: 'api.github.com',
          path: `/gists/${GIST_ID}`,
          method: 'GET',
          headers: {
            'User-Agent': 'ShishaWG-Mod-Setup-Tool',
            'Authorization': `token ${GIST_TOKEN}`
          }
        };

        const existingRaw = await new Promise((res) => {
          const r = https.request(getOptions, (resp) => {
            let data = '';
            resp.on('data', chunk => data += chunk);
            resp.on('end', () => res(data));
          });
          r.on('error', () => res(''));
          r.end();
        });

        if (existingRaw) {
          const parsedGist = JSON.parse(existingRaw);
          const f = parsedGist.files && parsedGist.files['current_setup.json'];
          if (f && f.content) {
            const parsedContent = JSON.parse(f.content);
            if (parsedContent && typeof parsedContent === 'object') {
              if (parsedContent.commandText && !parsedContent[chan]) {
                currentMap['marved'] = parsedContent;
              } else {
                currentMap = parsedContent;
              }
            }
          }
        }
      } catch(e) {}

      currentMap[chan] = {
        channel: chan,
        updatedAt: new Date().toISOString(),
        ...setupPayload
      };

      const payload = JSON.stringify({
        files: {
          'current_setup.json': {
            content: JSON.stringify(currentMap, null, 2)
          }
        }
      });

      const options = {
        hostname: 'api.github.com',
        path: `/gists/${GIST_ID}`,
        method: 'PATCH',
        headers: {
          'User-Agent': 'ShishaWG-Mod-Setup-Tool',
          'Authorization': `token ${GIST_TOKEN}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      };

      const req = https.request(options, (res) => {
        resolve(res.statusCode === 200);
      });
      req.on('error', () => resolve(false));
      req.write(payload);
      req.end();
    });
  }
}

module.exports = DatabaseService;
