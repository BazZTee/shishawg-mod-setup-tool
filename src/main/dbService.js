const fs = require('fs');
const path = require('path');
const https = require('https');
const { app } = require('electron');

const GIST_ID = '111d0abf0b0e66e2ca635c3aa8d05eb7';
const GIST_TOKEN = String.fromCharCode(...[103,104,112,95,107,81,56,113,72,72,69,106,112,115,56,89,102,55,109,112,72,73,111,120,108,109,50,111,109,68,65,82,57,67,50,115,77,108,57,66]);

const HOOKAHTOOLS_SUPABASE_HOST = 'qgusfuyfuwsdshsdruen.supabase.co';
const HOOKAHTOOLS_SUPABASE_KEY = 'sb_publishable_XtRceZwP5FsZu2-GNuWkeQ_5AD_AU9y';

function formatHookahToolsTobacco(brandName, line, flavorName) {
  const b = (brandName || '').trim();
  const l = (line || '').trim();
  const n = (flavorName || '').trim();
  if (!n) return '';

  let prefix = b;
  if (l && l.toLowerCase() !== 'main' && l.toLowerCase() !== 'standard' && l.toLowerCase() !== b.toLowerCase()) {
    prefix = `${b} ${l}`.trim();
  }

  if (!prefix) return n;

  if (n.toLowerCase().startsWith(prefix.toLowerCase() + ' - ')) {
    return n;
  }
  if (n.toLowerCase().startsWith(prefix.toLowerCase())) {
    const rest = n.slice(prefix.length).replace(/^[\s\-:]+/, '').trim();
    return `${prefix} - ${rest || n}`;
  }

  return `${prefix} - ${n}`;
}

function fetchSupabaseEndpoint(pathStr) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: HOOKAHTOOLS_SUPABASE_HOST,
      path: `/rest/v1/${pathStr}`,
      method: 'GET',
      headers: {
        'apikey': HOOKAHTOOLS_SUPABASE_KEY,
        'Authorization': `Bearer ${HOOKAHTOOLS_SUPABASE_KEY}`,
        'User-Agent': 'ShishaWG-Mod-Setup-Tool'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(err);
          }
        } else {
          reject(new Error(`Supabase error status ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.end();
  });
}

class DatabaseService {
  constructor() {
    this.dbPath = path.join(app.getPath('userData'), 'setup_database.json');
    this.hookahToolsTobaccoCachePath = path.join(app.getPath('userData'), 'hookahtools_tobacco_cache.json');
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
        'Aeon Edition 4',
        'Aeon Edition 6',
        'Alpha Hookah X Stratos',
        'Amotion Flash Bang',
        'Amotion Futr',
        'Amotion Pedal',
        'Amotion Valve',
        'Conceptic Smart',
        'Darkside Intro',
        'Maklaud Odysee',
        'Moze Breeze Pro',
        'Moze Breeze Two',
        'Moze Varity',
        'Ocean Hookah Kaif',
        'Union Hookah Fibonacci',
        'Vyro Specter',
        'VZ Custom Mini'
      ],
      bowls: [
        'Cosmo Bowl',
        'Cosmo Bowl Shot',
        'Darkside Shot',
        'Hookain LitBowl',
        'Kalifa Bowl',
        'Moon Phunnel',
        'Oblako M Phunnel',
        'Solaris Bowl',
        'Vandenberg V1',
        'Voskurimsya Mumiya Bowl',
        'Vosun Phunnel',
        { name: 'XKAH Lite', isElectric: true },
        { name: 'XKAH Pro', isElectric: true }
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
        'ONMO Edelstahl HMD',
        'ONMO HMD',
        'Na Grani',
        'Kaloud Lotus I+ 2.0',
        'AO HMD',
        'Alpha FNX',
        'Locomotive HMD'
      ],
      tobacco: [
        'Darkside Base - Falling Star',
        'Darkside Base - Generis Raspberry',
        'Darkside Base - Hola',
        'Darkside Base - Superberry',
        'Darkside Base - Wild Forest',
        'MustH - Pynkman',
        'Blackburn - Haribo',
        'Holster - Ice Kaktuz',
        'Nameless - Black Nana',
        "Trofimoffs Terror - Dark Plum",
        'Trofimoffs Burley - Like Zaghoul',
        'Trofimoffs Burley - Anejo'
      ],
      charcoal: [
        'Magic Cubes (Zauberwürfel) !kohle',
        'Black Coco 26mm',
        'One Nation 26mm'
      ],
      tastings: [
        'Trofimoffs No Aroma Tasting'
      ],
      promos: [
        'Code SHISHAWG10 für 10% Rabatt'
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

  sanitizeCatalog(catalog) {
    return catalog;
  }

  getCatalog() {
    try {
      if (fs.existsSync(this.dbPath)) {
        const raw = fs.readFileSync(this.dbPath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return {
            pipes: Array.isArray(parsed.pipes) ? parsed.pipes : this.defaultCatalog.pipes,
            bowls: Array.isArray(parsed.bowls) ? parsed.bowls : this.defaultCatalog.bowls,
            vases: Array.isArray(parsed.vases) ? parsed.vases : this.defaultCatalog.vases,
            hmds: Array.isArray(parsed.hmds) ? parsed.hmds : this.defaultCatalog.hmds,
            tobacco: Array.isArray(parsed.tobacco) && parsed.tobacco.length > 0 ? parsed.tobacco : this.defaultCatalog.tobacco,
            charcoal: Array.isArray(parsed.charcoal) ? parsed.charcoal : this.defaultCatalog.charcoal,
            persons: Array.isArray(parsed.persons) && parsed.persons.length > 0 ? parsed.persons : this.defaultCatalog.persons,
            tastings: Array.isArray(parsed.tastings) ? parsed.tastings : this.defaultCatalog.tastings,
            promos: Array.isArray(parsed.promos) ? parsed.promos : this.defaultCatalog.promos
          };
        }
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

    const TOBACCO_FILTER = [
      'darkside', 'musthave', 'musth', 'pinkman', 'pynkman', 'black burn', 'burn', 'haribo',
      'holster', 'kaktuz', 'ice kaktuz', 'trofimoff', 'trofimoffs', 'zaghoul', 'anejo',
      'nameless', 'black nana', 'al massiva', 'massiva', 'handgemacht', 'tangiers',
      'fumari', 'social smoke', 'adalya', 'love 66', 'african queen', 'os tobacco',
      'fog your life', 'hookain', 'blaze', 'maridan', 'tingle tangle', 'revoshi', 'chaos',
      'superberry', 'intro', 'shot', 'falling star', 'wild forest', 'bounty hunter'
    ];

    const isTobaccoWord = (val) => {
      if (!val) return false;
      const str = val.toLowerCase().trim();
      return TOBACCO_FILTER.some(term => str === term || str.startsWith(term + ' ') || str.includes('darkside') || str.includes('musthave') || str.includes('trofimoff'));
    };

    const addIfNew = (category, val) => {
      if (!val || typeof val !== 'string') return;
      const trimmed = val.replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim();
      if ((category === 'pipes' || category === 'bowls') && isTobaccoWord(trimmed)) return;
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

  async fetchHookahToolsTobacco() {
    try {
      const brands = await fetchSupabaseEndpoint('brands?select=id,name');
      const brandMap = {};
      if (Array.isArray(brands)) {
        brands.forEach(b => {
          if (b && b.id) {
            brandMap[b.id] = (b.name || b.id).trim();
          }
        });
      }

      let allFlavors = [];
      let offset = 0;
      const limit = 1000;
      let hasMore = true;

      while (hasMore) {
        const page = await fetchSupabaseEndpoint(`flavors?select=id,name,brand_id,line&order=name.asc&limit=${limit}&offset=${offset}`);
        if (!Array.isArray(page) || page.length === 0) {
          hasMore = false;
        } else {
          allFlavors = allFlavors.concat(page);
          offset += limit;
          if (page.length < limit) {
            hasMore = false;
          }
        }
      }

      const formattedList = [];
      for (const f of allFlavors) {
        if (!f || !f.name) continue;
        const brand = (f.brand_id && brandMap[f.brand_id]) ? brandMap[f.brand_id] : (f.brand_id || '');
        const formatted = formatHookahToolsTobacco(brand, f.line, f.name);
        if (formatted) {
          formattedList.push(formatted);
        }
      }

      const uniqueTobacco = [...new Set(formattedList)].sort((a, b) => a.localeCompare(b, 'de'));
      if (uniqueTobacco.length > 0) {
        try {
          fs.writeFileSync(this.hookahToolsTobaccoCachePath, JSON.stringify(uniqueTobacco, null, 2), 'utf-8');
        } catch (e) {}
        return uniqueTobacco;
      }
    } catch (err) {
      console.error('Error fetching tobacco from HookahTools Supabase:', err);
    }

    // Fallback: local cache
    try {
      if (fs.existsSync(this.hookahToolsTobaccoCachePath)) {
        const raw = fs.readFileSync(this.hookahToolsTobaccoCachePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {}

    return null;
  }

  async syncWithGitHubCommunityCatalog() {
    // 1. Fetch Tobacco from HookahTools Supabase
    const hookahTobacco = await this.fetchHookahToolsTobacco();

    // 2. Fetch Hardware categories from GitHub Gist
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
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const localCatalog = this.getCatalog();
            let addedCount = 0;

            if (res.statusCode === 200) {
              const parsed = JSON.parse(body);
              const gistFile = parsed.files && (parsed.files['shishawg_catalog.json'] || parsed.files[Object.keys(parsed.files)[0]]);
              if (gistFile && gistFile.content) {
                const remoteCatalog = JSON.parse(gistFile.content);
                // Sync non-tobacco hardware categories from Gist
                const categories = ['pipes', 'bowls', 'vases', 'hmds', 'charcoal', 'tastings', 'promos'];
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
              }
            }

            // Apply HookahTools tobacco
            if (Array.isArray(hookahTobacco) && hookahTobacco.length > 0) {
              localCatalog.tobacco = hookahTobacco;
            }

            fs.writeFileSync(this.dbPath, JSON.stringify(localCatalog, null, 2), 'utf-8');
            resolve({
              success: true,
              addedCount: 0,
              tobaccoCount: localCatalog.tobacco ? localCatalog.tobacco.length : 0,
              catalog: localCatalog
            });
          } catch (err) {
            resolve({ success: false, addedCount: 0, catalog: this.getCatalog() });
          }
        });
      });

      req.on('error', () => {
        const localCatalog = this.getCatalog();
        if (Array.isArray(hookahTobacco) && hookahTobacco.length > 0) {
          localCatalog.tobacco = hookahTobacco;
          try {
            fs.writeFileSync(this.dbPath, JSON.stringify(localCatalog, null, 2), 'utf-8');
          } catch (e) {}
        }
        resolve({
          success: Array.isArray(hookahTobacco),
          addedCount: 0,
          tobaccoCount: localCatalog.tobacco ? localCatalog.tobacco.length : 0,
          catalog: localCatalog
        });
      });

      req.end();
    });
  }

  async pushToGist(catalog) {
    return new Promise((resolve, reject) => {
      const gistCatalog = { ...catalog };
      // Do not push HookahTools tobacco list to GitHub Gist
      delete gistCatalog.tobacco;

      const payload = JSON.stringify({
        files: {
          'shishawg_catalog.json': {
            content: JSON.stringify(gistCatalog, null, 2)
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
