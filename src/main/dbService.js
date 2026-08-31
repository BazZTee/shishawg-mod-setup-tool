const fs = require('fs');
const path = require('path');
const https = require('https');
const { app } = require('electron');
const { decryptAddress, isEncrypted } = require('./crypto');

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
    const userDataDir = (app && typeof app.getPath === 'function') ? app.getPath('userData') : path.join(process.cwd(), '.temp_user_data');
    this.dbPath = path.join(userDataDir, 'setup_database.json');
    this.hookahToolsTobaccoCachePath = path.join(userDataDir, 'hookahtools_tobacco_cache.json');
    this.hookahToolsBrandsCachePath = path.join(userDataDir, 'hookahtools_brands_cache.json');
    this.hookahToolsSnapshotPath = path.join(__dirname, 'hookahtools_tobacco_snapshot.json');
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
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (!fs.existsSync(this.dbPath)) {
        fs.writeFileSync(this.dbPath, JSON.stringify(this.defaultCatalog, null, 2), 'utf-8');
      }
    } catch (err) {
      console.error('Failed to initialize database file:', err);
    }
  }

  getHookahToolsCacheData() {
    const result = {
      meta: {
        totalCount: 0,
        latestId: '',
        latestUpdatedAt: '',
        lastChecked: ''
      },
      flavors: []
    };

    // 1. Try local cache in userData
    try {
      if (fs.existsSync(this.hookahToolsTobaccoCachePath)) {
        const raw = fs.readFileSync(this.hookahToolsTobaccoCachePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          if (Array.isArray(parsed)) {
            result.flavors = parsed;
            result.meta.totalCount = parsed.length;
          } else if (Array.isArray(parsed.flavors)) {
            result.flavors = parsed.flavors;
            result.meta = parsed.meta || result.meta;
          }
        }
      }
    } catch(e) {}

    // 2. If userData cache is empty, fall back to bundled snapshot
    if (result.flavors.length === 0) {
      try {
        if (fs.existsSync(this.hookahToolsSnapshotPath)) {
          const raw = fs.readFileSync(this.hookahToolsSnapshotPath, 'utf-8');
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            if (Array.isArray(parsed)) {
              result.flavors = parsed;
              result.meta.totalCount = parsed.length;
            } else if (Array.isArray(parsed.flavors)) {
              result.flavors = parsed.flavors;
              result.meta = parsed.meta || result.meta;
            }
          }
        }
      } catch(e) {}
    }

    return result;
  }

  getCatalog() {
    let customTobacco = [];
    let base = { ...this.defaultCatalog };
    try {
      if (fs.existsSync(this.dbPath)) {
        const raw = fs.readFileSync(this.dbPath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          base = {
            pipes: Array.isArray(parsed.pipes) ? parsed.pipes : this.defaultCatalog.pipes,
            bowls: Array.isArray(parsed.bowls) ? parsed.bowls : this.defaultCatalog.bowls,
            vases: Array.isArray(parsed.vases) ? parsed.vases : this.defaultCatalog.vases,
            hmds: Array.isArray(parsed.hmds) ? parsed.hmds : this.defaultCatalog.hmds,
            charcoal: Array.isArray(parsed.charcoal) ? parsed.charcoal : this.defaultCatalog.charcoal,
            persons: Array.isArray(parsed.persons) && parsed.persons.length > 0 ? parsed.persons : this.defaultCatalog.persons,
            tastings: Array.isArray(parsed.tastings) ? parsed.tastings : this.defaultCatalog.tastings,
            promos: Array.isArray(parsed.promos) ? parsed.promos : this.defaultCatalog.promos
          };
          if (Array.isArray(parsed.customTobacco)) {
            customTobacco = parsed.customTobacco;
          } else if (Array.isArray(parsed.tobacco)) {
            customTobacco = parsed.tobacco;
          }
        }
      }
    } catch (err) {
      console.error('Error reading catalog:', err);
    }

    if (!Array.isArray(customTobacco) || customTobacco.length === 0) {
      customTobacco = this.defaultCatalog.customTobacco || [
        'MustH - Pynkman',
        'Blackburn - Haribo',
        'Holster - Ice Kaktuz',
        'Nameless - Black Nana',
        "Trofimoffs Terror - Dark Plum",
        'Trofimoffs Burley - Like Zaghoul',
        'Trofimoffs Burley - Anejo'
      ];
    }

    // Read HookahTools tobacco cache (smart local cache / bundled snapshot)
    const hookahData = this.getHookahToolsCacheData();
    const hookahTobacco = hookahData.flavors || [];

    // Build unified tobacco list
    // 1. Custom tobacco entries first (marked as source: 'custom', isCustom: true)
    const combinedTobacco = [];
    const seenNames = new Set();

    for (const item of customTobacco) {
      const name = (typeof item === 'string' ? item : item.name).trim();
      if (!name) continue;
      combinedTobacco.push({
        name,
        source: 'custom',
        isCustom: true
      });
      seenNames.add(name.toLowerCase());
    }

    // 2. HookahTools tobacco entries (marked as source: 'hookahtools', isCustom: false)
    for (const item of hookahTobacco) {
      const name = (typeof item === 'string' ? item : item.name).trim();
      if (!name || seenNames.has(name.toLowerCase())) continue;
      combinedTobacco.push({
        name,
        source: 'hookahtools',
        isCustom: false
      });
      seenNames.add(name.toLowerCase());
    }

    return {
      ...base,
      customTobacco,
      hookahTobacco,
      tobacco: combinedTobacco
    };
  }

  saveCustomTobacco(customTobacco) {
    try {
      let currentData = {};
      if (fs.existsSync(this.dbPath)) {
        currentData = JSON.parse(fs.readFileSync(this.dbPath, 'utf-8') || '{}');
      }
      currentData.customTobacco = customTobacco;
      currentData.tobacco = customTobacco;
      fs.writeFileSync(this.dbPath, JSON.stringify(currentData, null, 2), 'utf-8');
      return true;
    } catch(e) {
      return false;
    }
  }

  saveCatalog(catalog) {
    try {
      const customTobaccoList = Array.isArray(catalog.customTobacco)
        ? catalog.customTobacco
        : (Array.isArray(catalog.tobacco) ? catalog.tobacco.filter(t => typeof t === 'string' || t.isCustom).map(t => typeof t === 'string' ? t : t.name) : []);

      const toSave = {
        pipes: catalog.pipes,
        bowls: catalog.bowls,
        vases: catalog.vases,
        hmds: catalog.hmds,
        charcoal: catalog.charcoal,
        persons: catalog.persons,
        tastings: catalog.tastings,
        promos: catalog.promos,
        customTobacco: customTobaccoList,
        tobacco: customTobaccoList
      };

      fs.writeFileSync(this.dbPath, JSON.stringify(toSave, null, 2), 'utf-8');
      return true;
    } catch (err) {
      console.error('Error saving catalog:', err);
      return false;
    }
  }

  mergeRemoteCatalog(remoteCatalog) {
    if (!remoteCatalog || typeof remoteCatalog !== 'object') return this.getCatalog();
    try {
      const current = this.getCatalog();
      const updated = {
        pipes: Array.isArray(remoteCatalog.pipes) && remoteCatalog.pipes.length > 0 ? remoteCatalog.pipes : current.pipes,
        bowls: Array.isArray(remoteCatalog.bowls) && remoteCatalog.bowls.length > 0 ? remoteCatalog.bowls : current.bowls,
        vases: Array.isArray(remoteCatalog.vases) && remoteCatalog.vases.length > 0 ? remoteCatalog.vases : current.vases,
        hmds: Array.isArray(remoteCatalog.hmds) && remoteCatalog.hmds.length > 0 ? remoteCatalog.hmds : current.hmds,
        charcoal: Array.isArray(remoteCatalog.charcoal) && remoteCatalog.charcoal.length > 0 ? remoteCatalog.charcoal : current.charcoal,
        persons: Array.isArray(remoteCatalog.persons) && remoteCatalog.persons.length > 0 ? remoteCatalog.persons : current.persons,
        tastings: Array.isArray(remoteCatalog.tastings) && remoteCatalog.tastings.length > 0 ? remoteCatalog.tastings : current.tastings,
        promos: Array.isArray(remoteCatalog.promos) && remoteCatalog.promos.length > 0 ? remoteCatalog.promos : current.promos
      };

      if (Array.isArray(remoteCatalog.tobacco) && remoteCatalog.tobacco.length > 0) {
        updated.customTobacco = remoteCatalog.tobacco;
      } else if (Array.isArray(remoteCatalog.customTobacco) && remoteCatalog.customTobacco.length > 0) {
        updated.customTobacco = remoteCatalog.customTobacco;
      } else {
        updated.customTobacco = current.customTobacco;
      }

      this.saveCatalog(updated);
    } catch (err) {
      console.error('Error merging remote catalog:', err);
    }
    return this.getCatalog();
  }

  addItem(category, item) {
    if (!item) return false;
    let itemName = typeof item === 'string' ? item.trim() : item.name.trim();
    if (!itemName) return false;

    if (category === 'tobacco' || category === 'customTobacco') {
      const catalog = this.getCatalog();
      const customTobacco = Array.isArray(catalog.customTobacco) ? [...catalog.customTobacco] : [];
      const hookahTobacco = Array.isArray(catalog.hookahTobacco) ? catalog.hookahTobacco : [];

      // If already in HookahTools, no need to duplicate into Custom
      const existsInHT = hookahTobacco.some(i => (typeof i === 'string' ? i : i.name).toLowerCase() === itemName.toLowerCase());
      if (existsInHT) {
        return false;
      }

      const exists = customTobacco.some(i => (typeof i === 'string' ? i : i.name).toLowerCase() === itemName.toLowerCase());
      if (!exists) {
        customTobacco.push(itemName);
        customTobacco.sort((a, b) => a.localeCompare(b, 'de'));
        this.saveCustomTobacco(customTobacco);
        return true;
      }
      return false;
    }

    const catalog = this.getCatalog();
    if (!catalog[category]) catalog[category] = [];
    
    const exists = catalog[category].some(i => (typeof i === 'string' ? i : i.name).toLowerCase() === itemName.toLowerCase());
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
    const targetName = typeof item === 'string' ? item.trim() : (item.name || item).trim();
    if (!targetName) return false;

    if (category === 'tobacco' || category === 'customTobacco') {
      let customTobacco = [];
      try {
        if (fs.existsSync(this.dbPath)) {
          const raw = fs.readFileSync(this.dbPath, 'utf-8');
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed.customTobacco)) customTobacco = parsed.customTobacco;
          else if (Array.isArray(parsed.tobacco)) customTobacco = parsed.tobacco;
        }
      } catch (e) {}

      const filtered = customTobacco.filter(i => (typeof i === 'string' ? i : i.name).trim().toLowerCase() !== targetName.toLowerCase());
      if (filtered.length !== customTobacco.length) {
        this.saveCustomTobacco(filtered);
        return true;
      }
      return false;
    }

    const catalog = this.getCatalog();
    if (catalog[category]) {
      catalog[category] = catalog[category].filter(i => (typeof i === 'string' ? i : i.name).trim().toLowerCase() !== targetName.toLowerCase());
      this.saveCatalog(catalog);
      return true;
    }
    return false;
  }

  editItem(category, oldItem, newItem) {
    if (!oldItem || !newItem) return false;
    const oldName = typeof oldItem === 'string' ? oldItem.trim() : (oldItem.name || oldItem).trim();
    const newName = typeof newItem === 'string' ? newItem.trim() : (newItem.name || newItem).trim();
    if (!oldName || !newName) return false;

    if (category === 'tobacco' || category === 'customTobacco') {
      let customTobacco = [];
      try {
        if (fs.existsSync(this.dbPath)) {
          const raw = fs.readFileSync(this.dbPath, 'utf-8');
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed.customTobacco)) customTobacco = parsed.customTobacco;
          else if (Array.isArray(parsed.tobacco)) customTobacco = parsed.tobacco;
        }
      } catch (e) {}

      const idx = customTobacco.findIndex(i => (typeof i === 'string' ? i : i.name).trim().toLowerCase() === oldName.toLowerCase());
      if (idx !== -1) {
        customTobacco[idx] = newName;
        customTobacco.sort((a, b) => a.localeCompare(b, 'de'));
        this.saveCustomTobacco(customTobacco);
        return true;
      }
      return false;
    }

    const catalog = this.getCatalog();
    if (catalog[category]) {
      const idx = catalog[category].findIndex(i => (typeof i === 'string' ? i : i.name).trim().toLowerCase() === oldName.toLowerCase());
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
      if (trimmed.length < 2) return;
      if ((category === 'pipes' || category === 'bowls') && isTobaccoWord(trimmed)) return;

      const currentCatalog = this.getCatalog();
      if (category === 'tobacco') {
        // Only learn as custom if not already in HookahTools or Custom
        const existsInAny = (currentCatalog.tobacco || []).some(t => {
          const tName = (typeof t === 'string' ? t : t.name).toLowerCase().trim();
          return tName === trimmed.toLowerCase();
        });
        if (!existsInAny) {
          const added = this.addItem('tobacco', trimmed);
          if (added) addedCount++;
        }
        return;
      }

      if (!currentCatalog[category]) currentCatalog[category] = [];
      const exists = currentCatalog[category].some(i => (typeof i === 'string' ? i : i.name).toLowerCase().trim() === trimmed.toLowerCase());
      if (!exists) {
        const added = this.addItem(category, trimmed);
        if (added) addedCount++;
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

    return { addedCount, catalog: this.getCatalog() };
  }

  async fetchHookahToolsMetadata() {
    return new Promise((resolve) => {
      const options = {
        hostname: HOOKAHTOOLS_SUPABASE_HOST,
        path: '/rest/v1/flavors?select=id,updated_at&order=updated_at.desc&limit=1',
        method: 'GET',
        headers: {
          'apikey': HOOKAHTOOLS_SUPABASE_KEY,
          'Authorization': `Bearer ${HOOKAHTOOLS_SUPABASE_KEY}`,
          'Prefer': 'count=exact',
          'User-Agent': 'ShishaWG-Mod-Setup-Tool'
        }
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            let totalCount = 0;
            const range = res.headers['content-range'];
            if (range) {
              const match = range.match(/\/(\d+|\*)$/);
              if (match && match[1] !== '*') {
                totalCount = parseInt(match[1], 10);
              }
            }
            const parsed = JSON.parse(body || '[]');
            const latest = Array.isArray(parsed) && parsed.length > 0 ? parsed[0] : null;
            resolve({
              success: true,
              totalCount,
              latestId: latest ? latest.id : '',
              latestUpdatedAt: latest ? latest.updated_at : ''
            });
          } catch(e) {
            resolve({ success: false, totalCount: 0, latestId: '', latestUpdatedAt: '' });
          }
        });
      });

      req.on('error', () => {
        resolve({ success: false, totalCount: 0, latestId: '', latestUpdatedAt: '' });
      });

      req.end();
    });
  }

  async getBrandMap(forceRefresh = false) {
    let brandMap = {};
    if (!forceRefresh) {
      try {
        if (fs.existsSync(this.hookahToolsBrandsCachePath)) {
          const raw = fs.readFileSync(this.hookahToolsBrandsCachePath, 'utf-8');
          brandMap = JSON.parse(raw) || {};
        }
      } catch(e) {}
    }

    if (Object.keys(brandMap).length === 0 || forceRefresh) {
      try {
        const brands = await fetchSupabaseEndpoint('brands?select=id,name');
        if (Array.isArray(brands)) {
          brands.forEach(b => {
            if (b && b.id) brandMap[b.id] = (b.name || b.id).trim();
          });
          try {
            fs.writeFileSync(this.hookahToolsBrandsCachePath, JSON.stringify(brandMap, null, 2), 'utf-8');
          } catch(e) {}
        }
      } catch(e) {}
    }

    return brandMap;
  }

  async fetchHookahToolsTobacco(force = false) {
    const localCache = this.getHookahToolsCacheData();

    // 1. Smart Check & Delta-Sync
    if (!force && localCache.flavors && localCache.flavors.length > 0) {
      try {
        const meta = await this.fetchHookahToolsMetadata();
        if (meta.success) {
          const isSameCount = meta.totalCount > 0 && meta.totalCount === localCache.meta.totalCount;
          const isSameLatest = !meta.latestUpdatedAt || (meta.latestUpdatedAt === localCache.meta.latestUpdatedAt);

          // CASE 1: No changes at all -> 0 rows downloaded (~150 Bytes check)
          if (isSameCount && isSameLatest) {
            console.log(`[HookahTools SmartCache] Database is up to date (${meta.totalCount} flavors). Skipping download.`);
            try {
              const updatedCache = {
                meta: {
                  ...localCache.meta,
                  lastChecked: new Date().toISOString()
                },
                flavors: localCache.flavors
              };
              fs.writeFileSync(this.hookahToolsTobaccoCachePath, JSON.stringify(updatedCache, null, 2), 'utf-8');
            } catch(e) {}

            return localCache.flavors;
          }

          // CASE 2: New items added -> DELTA SYNC (Only download new/updated items where updated_at > cachedLatestUpdatedAt)
          const isAdditionsOnly = meta.totalCount >= localCache.meta.totalCount && localCache.meta.latestUpdatedAt;
          if (isAdditionsOnly) {
            console.log(`[HookahTools DeltaSync] Fetching only new flavors added since ${localCache.meta.latestUpdatedAt}...`);
            const deltaFlavors = await fetchSupabaseEndpoint(`flavors?select=id,name,brand_id,line,updated_at&updated_at=gt.${encodeURIComponent(localCache.meta.latestUpdatedAt)}&order=updated_at.asc`);

            if (Array.isArray(deltaFlavors) && deltaFlavors.length > 0) {
              const brandMap = await this.getBrandMap();
              const newFormatted = [];
              for (const f of deltaFlavors) {
                if (!f || !f.name) continue;
                let brand = (f.brand_id && brandMap[f.brand_id]) ? brandMap[f.brand_id] : (f.brand_id || '');
                if (!brand && f.brand_id) {
                  const refreshedBrands = await this.getBrandMap(true);
                  brand = (f.brand_id && refreshedBrands[f.brand_id]) ? refreshedBrands[f.brand_id] : f.brand_id;
                }
                const formatted = formatHookahToolsTobacco(brand, f.line, f.name);
                if (formatted) newFormatted.push(formatted);
              }

              const mergedSet = new Set([...localCache.flavors, ...newFormatted]);
              const mergedList = Array.from(mergedSet).sort((a, b) => a.localeCompare(b, 'de'));

              const updatedCache = {
                meta: {
                  totalCount: meta.totalCount || mergedList.length,
                  latestId: meta.latestId || localCache.meta.latestId,
                  latestUpdatedAt: meta.latestUpdatedAt || localCache.meta.latestUpdatedAt,
                  lastChecked: new Date().toISOString()
                },
                flavors: mergedList
              };

              try {
                fs.writeFileSync(this.hookahToolsTobaccoCachePath, JSON.stringify(updatedCache, null, 2), 'utf-8');
              } catch(e) {}

              console.log(`[HookahTools DeltaSync] Added ${newFormatted.length} new flavor(s). Total: ${mergedList.length}.`);
              return mergedList;
            }
          }

          // CASE 3: Items deleted (meta.totalCount < localCache.meta.totalCount) -> Prune & Full refresh
          console.log(`[HookahTools PruneSync] Remote count (${meta.totalCount}) is less than local (${localCache.meta.totalCount}). Performing prune sync...`);
        }
      } catch (err) {
        console.warn('[HookahTools SmartCache] Metadata/Delta check failed, using local cache:', err.message);
        return localCache.flavors;
      }
    }

    // Full catalog download fallback (Initial download, force sync, or pruning deleted items)
    try {
      console.log('[HookahTools] Performing full catalog download from Supabase...');
      const brandMap = await this.getBrandMap(true);

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
        const meta = await this.fetchHookahToolsMetadata();
        const cachePayload = {
          meta: {
            totalCount: meta.totalCount || allFlavors.length,
            latestId: meta.latestId || '',
            latestUpdatedAt: meta.latestUpdatedAt || '',
            lastChecked: new Date().toISOString()
          },
          flavors: uniqueTobacco
        };

        try {
          fs.writeFileSync(this.hookahToolsTobaccoCachePath, JSON.stringify(cachePayload, null, 2), 'utf-8');
        } catch (e) {}
        return uniqueTobacco;
      }
    } catch (err) {
      console.error('Error fetching tobacco from HookahTools Supabase:', err);
    }

    return localCache.flavors && localCache.flavors.length > 0 ? localCache.flavors : null;
  }

  // Mod-Chat Messages (Local Offline Fallback)
  async getModChatMessages() {
    const localFile = path.join(app.getPath('userData'), 'mod_chat_messages.json');
    try {
      if (fs.existsSync(localFile)) {
        return JSON.parse(fs.readFileSync(localFile, 'utf-8'));
      }
    } catch(e) {}
    return [];
  }

  async sendModChatMessage(msgObj) {
    const localFile = path.join(app.getPath('userData'), 'mod_chat_messages.json');
    let msgs = [];
    try {
      if (fs.existsSync(localFile)) {
        msgs = JSON.parse(fs.readFileSync(localFile, 'utf-8'));
      }
    } catch(e) {}

    msgs.push(msgObj);
    msgs = msgs.slice(-100);

    try {
      fs.writeFileSync(localFile, JSON.stringify(msgs, null, 2), 'utf-8');
    } catch(e) {}
    return msgs;
  }

  async clearModChatMessages() {
    const localFile = path.join(app.getPath('userData'), 'mod_chat_messages.json');
    try {
      fs.writeFileSync(localFile, JSON.stringify([], null, 2), 'utf-8');
    } catch(e) {}
    return [];
  }

  // Watchlist (Local Offline Fallback)
  async getWatchlist() {
    const localFile = path.join(app.getPath('userData'), 'mod_watchlist.json');
    try {
      if (fs.existsSync(localFile)) {
        return JSON.parse(fs.readFileSync(localFile, 'utf-8'));
      }
    } catch(e) {}
    return [];
  }

  async saveWatchlist(list) {
    const localFile = path.join(app.getPath('userData'), 'mod_watchlist.json');
    try {
      fs.writeFileSync(localFile, JSON.stringify(list, null, 2), 'utf-8');
    } catch(e) {}
    return list;
  }

  // Stream Markers (Session Cache)
  getStreamMarkers() {
    const localFile = path.join(app.getPath('userData'), 'stream_markers.json');
    try {
      if (fs.existsSync(localFile)) {
        return JSON.parse(fs.readFileSync(localFile, 'utf-8'));
      }
    } catch(e) {}
    return [];
  }

  saveStreamMarkers(markers) {
    const localFile = path.join(app.getPath('userData'), 'stream_markers.json');
    try {
      fs.writeFileSync(localFile, JSON.stringify(markers, null, 2), 'utf-8');
    } catch(e) {}
    return markers;
  }

  // Giveaway Winners & DSGVO Address Database (Local Offline Fallback)
  async getGiveawayWinners() {
    const localFile = path.join(app.getPath('userData'), 'giveaway_winners.json');
    const decryptList = (arr) => {
      if (!Array.isArray(arr)) return [];
      return arr.map(w => {
        if (w && w.address && typeof w.address === 'string' && isEncrypted(w.address)) {
          return { ...w, address: decryptAddress(w.address) };
        }
        return w;
      });
    };

    let localList = [];
    try {
      if (fs.existsSync(localFile)) {
        localList = JSON.parse(fs.readFileSync(localFile, 'utf-8'));
      }
    } catch(e) {}

    return decryptList(localList);
  }

  async saveGiveawayWinner(winnerObj) {
    const localFile = path.join(app.getPath('userData'), 'giveaway_winners.json');
    let list = [];
    try {
      if (fs.existsSync(localFile)) {
        list = JSON.parse(fs.readFileSync(localFile, 'utf-8'));
      }
    } catch(e) {}

    const idx = list.findIndex(w => w.id === winnerObj.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...winnerObj };
    } else {
      list.unshift(winnerObj);
    }

    try {
      fs.writeFileSync(localFile, JSON.stringify(list, null, 2), 'utf-8');
    } catch(e) {}
    return list;
  }

  async updateGiveawayWinner(id, updates) {
    const localFile = path.join(app.getPath('userData'), 'giveaway_winners.json');
    let list = [];
    try {
      if (fs.existsSync(localFile)) {
        list = JSON.parse(fs.readFileSync(localFile, 'utf-8'));
      }
    } catch(e) {}

    const idx = list.findIndex(w => w.id === id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...updates };
      try {
        fs.writeFileSync(localFile, JSON.stringify(list, null, 2), 'utf-8');
      } catch(e) {}
    }
    return list;
  }

  async deleteGiveawayWinner(id) {
    const localFile = path.join(app.getPath('userData'), 'giveaway_winners.json');
    let list = [];
    try {
      if (fs.existsSync(localFile)) {
        list = JSON.parse(fs.readFileSync(localFile, 'utf-8'));
      }
    } catch(e) {}

    list = list.filter(w => w.id !== id);
    try {
      fs.writeFileSync(localFile, JSON.stringify(list, null, 2), 'utf-8');
    } catch(e) {}
    return list;
  }

  // Telegram Bot Dispatch
  sendTelegramMessage(text, botToken, chatId) {
    return new Promise((resolve) => {
      if (!botToken || !chatId || !text) {
        resolve({ success: false, error: 'Telegram Bot Token oder Chat-ID fehlt' });
        return;
      }

      const payload = JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML'
      });

      const options = {
        hostname: 'api.telegram.org',
        path: `/bot${botToken}/sendMessage`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (data.ok) {
              resolve({ success: true, messageId: data.result ? data.result.message_id : null });
            } else {
              resolve({ success: false, error: data.description || 'Telegram API Fehler' });
            }
          } catch(e) {
            resolve({ success: res.statusCode === 200, error: body });
          }
        });
      });

      req.on('error', (err) => resolve({ success: false, error: err.message }));
      req.write(payload);
      req.end();
    });
  }

  // Telegram & Giveaway Portal Config (Local Offline Fallback)
  async getTelegramConfig() {
    const localFile = path.join(app.getPath('userData'), 'telegram_config.json');
    let cfg = { botToken: '', chatId: '', claimUrl: '' };
    try {
      if (fs.existsSync(localFile)) {
        cfg = JSON.parse(fs.readFileSync(localFile, 'utf-8'));
      }
    } catch(e) {}

    if (!cfg.claimUrl) {
      cfg.claimUrl = 'https://bazztee.github.io/shishawg-mod-setup-tool/claim.html';
    }

    return cfg;
  }

  async saveTelegramConfig(cfg) {
    const localFile = path.join(app.getPath('userData'), 'telegram_config.json');
    try {
      fs.writeFileSync(localFile, JSON.stringify(cfg, null, 2), 'utf-8');
    } catch(e) {}
    return cfg;
  }

  // --- Q&A Questions & Moderation (Local Offline Fallback) ---
  async getQnAQuestions() {
    const localFile = path.join(app.getPath('userData'), 'qna_questions.json');
    let questions = [];
    try {
      if (fs.existsSync(localFile)) {
        questions = JSON.parse(fs.readFileSync(localFile, 'utf-8'));
      }
    } catch(e) {}

    return Array.isArray(questions) ? questions : [];
  }

  async saveQnAQuestions(questions) {
    const localFile = path.join(app.getPath('userData'), 'qna_questions.json');
    const now = Date.now();
    const updatedQuestions = (questions || []).map(q => ({
      ...q,
      updatedAt: q.updatedAt || now
    }));
    try {
      fs.writeFileSync(localFile, JSON.stringify(updatedQuestions, null, 2), 'utf-8');
    } catch(e) {}
    return updatedQuestions;
  }

  async deleteQnAQuestion(questionId) {
    const localFile = path.join(app.getPath('userData'), 'qna_questions.json');
    try {
      let questions = await this.getQnAQuestions();
      questions = questions.filter(q => q.id !== questionId);
      fs.writeFileSync(localFile, JSON.stringify(questions, null, 2), 'utf-8');
      return true;
    } catch(e) {
      return false;
    }
  }

  async deleteAllQnAQuestions() {
    const localFile = path.join(app.getPath('userData'), 'qna_questions.json');
    try {
      fs.writeFileSync(localFile, JSON.stringify([], null, 2), 'utf-8');
      return true;
    } catch(e) {
      return false;
    }
  }

  async deleteAnsweredQnAQuestions() {
    const localFile = path.join(app.getPath('userData'), 'qna_questions.json');
    try {
      let questions = await this.getQnAQuestions();
      questions = questions.filter(q => q.status !== 'answered');
      fs.writeFileSync(localFile, JSON.stringify(questions, null, 2), 'utf-8');
      return true;
    } catch(e) {
      return false;
    }
  }

  async getActiveQnAQuestion() {
    const localFile = path.join(app.getPath('userData'), 'qna_active.json');
    let localData = { active: null, updatedAt: 0 };
    try {
      if (fs.existsSync(localFile)) {
        const raw = JSON.parse(fs.readFileSync(localFile, 'utf-8'));
        if (raw && typeof raw === 'object' && 'active' in raw) {
          localData = raw;
        } else {
          localData = { active: raw || null, updatedAt: (raw && (raw.updatedAt || raw.timestamp)) || 0 };
        }
      }
    } catch(e) {}

    return localData.active;
  }

  async setActiveQnAQuestion(activeObj) {
    const localFile = path.join(app.getPath('userData'), 'qna_active.json');
    const data = {
      active: activeObj,
      updatedAt: Date.now()
    };
    try {
      fs.writeFileSync(localFile, JSON.stringify(data, null, 2), 'utf-8');
    } catch(e) {}
    return activeObj;
  }

  // --- Poll Templates (Presets + Custom local fallback) ---
  getDefaultPollTemplates() {
    return [
      {
        id: 'preset_setup_rating',
        title: 'Wie bewertet ihr das aktuelle Setup?',
        choices: ['10/10 Perfekt 🔥', '8/10 Sehr gut 👍', '5/10 Geht so 🤔', '0/10 Ausleeren 💀'],
        duration: 60,
        isPreset: true
      },
      {
        id: 'preset_next_bowl',
        title: 'Welcher Kopf soll als nächstes geraucht werden?',
        choices: ['Oblako Phunnel', 'Hookain LiT LiP', 'Vandenberg V1', 'Kaloud Samsaris'],
        duration: 60,
        isPreset: true
      },
      {
        id: 'preset_tobacco_direction',
        title: 'Welche Geschmacksrichtung soll in den Kopf?',
        choices: ['Fruchtig / Süß 🍇', 'Cremig / Teigig 🍦', 'Frisch / Ice ❄️', 'Doppelapfel / Anis 🍏'],
        duration: 60,
        isPreset: true
      },
      {
        id: 'preset_coal_check',
        title: 'Kohle nachlegen oder neuer Kopf?',
        choices: ['Neue Kohlen drauf! 🪵', 'Neuer Kopf muss her! 💨', 'Passt noch so 👍'],
        duration: 60,
        isPreset: true
      }
    ];
  }

  async getPollTemplates() {
    const localFile = path.join(app.getPath('userData'), 'poll_templates.json');
    let templates = this.getDefaultPollTemplates();
    try {
      if (fs.existsSync(localFile)) {
        const loaded = JSON.parse(fs.readFileSync(localFile, 'utf-8'));
        if (Array.isArray(loaded) && loaded.length > 0) {
          templates = loaded;
        }
      }
    } catch(e) {}

    return templates;
  }

  async savePollTemplates(templates) {
    const localFile = path.join(app.getPath('userData'), 'poll_templates.json');
    try {
      fs.writeFileSync(localFile, JSON.stringify(templates, null, 2), 'utf-8');
    } catch(e) {}
    return templates;
  }

  // --- Shisha Sessions Local Persistence ---
  getShishaSessions() {
    const localFile = path.join(app.getPath('userData'), 'shisha_sessions.json');
    try {
      if (fs.existsSync(localFile)) {
        return JSON.parse(fs.readFileSync(localFile, 'utf-8')) || [];
      }
    } catch(e) {}
    return [];
  }

  saveShishaSessions(sessions) {
    const localFile = path.join(app.getPath('userData'), 'shisha_sessions.json');
    try {
      fs.writeFileSync(localFile, JSON.stringify(sessions, null, 2), 'utf-8');
    } catch(e) {}
    return sessions;
  }

  getActiveTimerState() {
    const localFile = path.join(app.getPath('userData'), 'shisha_timer.json');
    try {
      if (fs.existsSync(localFile)) {
        return JSON.parse(fs.readFileSync(localFile, 'utf-8')) || null;
      }
    } catch(e) {}
    return null;
  }

  saveActiveTimerState(timerState) {
    const localFile = path.join(app.getPath('userData'), 'shisha_timer.json');
    try {
      fs.writeFileSync(localFile, JSON.stringify(timerState, null, 2), 'utf-8');
    } catch(e) {}
    return timerState;
  }
}

module.exports = DatabaseService;
