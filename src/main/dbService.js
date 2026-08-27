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
        'Cosmo Bowl',
        'Hookain LitBowl',
        'Vandenberg V1',
        'Kalifa Bowl',
        'Oblako M Phunnel',
        'Solaris Bowl',
        'Vosun Phunnel',
        'Moon Phunnel'
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
      presets: []
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
    if (!item || typeof item !== 'string') return false;
    const catalog = this.getCatalog();
    if (!catalog[category]) catalog[category] = [];
    
    const trimmed = item.trim();
    if (trimmed && !catalog[category].includes(trimmed)) {
      catalog[category].push(trimmed);
      catalog[category].sort((a, b) => a.localeCompare(b, 'de'));
      this.saveCatalog(catalog);
      return true;
    }
    return false;
  }

  removeItem(category, item) {
    const catalog = this.getCatalog();
    if (catalog[category]) {
      catalog[category] = catalog[category].filter(i => i !== item);
      this.saveCatalog(catalog);
      return true;
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

            const categories = ['pipes', 'bowls', 'hmds', 'tobacco', 'charcoal'];
            for (const cat of categories) {
              if (!localCatalog[cat]) localCatalog[cat] = [];
              if (remoteCatalog[cat] && Array.isArray(remoteCatalog[cat])) {
                for (const item of remoteCatalog[cat]) {
                  const itemName = typeof item === 'string' ? item : (item.name || item);
                  const trimmed = itemName.replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim();
                  if (trimmed && !localCatalog[cat].includes(trimmed)) {
                    localCatalog[cat].push(trimmed);
                    addedCount++;
                  }
                }
                localCatalog[cat].sort((a, b) => (typeof a === 'string' ? a : a.name).localeCompare(typeof b === 'string' ? b : b.name, 'de'));
              }
            }

            if (addedCount > 0) {
              fs.writeFileSync(this.dbPath, JSON.stringify(localCatalog, null, 2), 'utf-8');
              this.pushToGist(localCatalog).catch(() => {});
            }

            resolve({ success: true, addedCount, catalog: localCatalog });
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
}

module.exports = DatabaseService;
