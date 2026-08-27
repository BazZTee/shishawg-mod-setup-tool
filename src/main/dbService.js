const fs = require('fs');
const path = require('path');
const { app } = require('electron');

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
      presets: [
        {
          name: "Standard Stream Setup",
          persons: [
            {
              name: "Marvin",
              pipe: "Amotion Futr",
              bowl: "Cosmo Bowl",
              hmd: "ONMO HMD",
              tobacco: ["Trofimoff Like Zaghoul"]
            },
            {
              name: "Yannick",
              pipe: "Amotion Pedal",
              bowl: "Hookain LitBowl",
              hmd: "Na Grani",
              tobacco: ["Trofimoff Anejo", "Darkside Shot"]
            }
          ],
          charcoal: "Magic Cubes (Zauberwürfel) !kohle",
          extra: "Trofimoffs No Aroma Tasting"
        }
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
}

module.exports = DatabaseService;
