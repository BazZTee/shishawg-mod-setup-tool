const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DatabaseService = require('../src/main/dbService');
const { applyCatalogChange } = require('../src/shared/catalogChange');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

// Fake cloud that applies single changes like the channel-api catalog.change action.
function createCloud(initial = {}) {
  const rows = JSON.parse(JSON.stringify(initial));
  return {
    rows,
    online: true,
    allowed: true,
    async getCatalog() {
      if (!this.online) throw new Error('offline');
      return JSON.parse(JSON.stringify(rows));
    },
    async changeCatalog({ category, op, item, newItem }) {
      if (!this.online) throw new Error('offline');
      if (!this.allowed) throw Object.assign(new Error('Den Katalog darf nur das ShishaWG-Core-Team ändern.'), { status: 403 });
      rows[category] = applyCatalogChange(rows[category] || [], op, item, newItem);
      return { category, items: JSON.parse(JSON.stringify(rows[category])) };
    }
  };
}

// Mirrors the flush/refresh flow of the db:* handlers in main.js.
function createMod(t, cloud) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'swg-catalog-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const db = new DatabaseService();
  db.dataPath = dir;
  db.dbPath = path.join(dir, 'setup_database.json');
  db.getHookahToolsCacheData = () => ({ flavors: [] });

  async function refresh() {
    let rejected = null;
    for (;;) {
      const [op, ...rest] = db.getPendingCatalogOps();
      if (!op) break;
      try {
        const row = await cloud.changeCatalog(op);
        db.savePendingCatalogOps(rest);
        db.applyRemoteCatalog({ [row.category]: row.items });
      } catch (e) {
        if (e.status === 403) { rejected = e.message; db.savePendingCatalogOps(rest); continue; }
        break;
      }
    }
    try { db.applyRemoteCatalog(await cloud.getCatalog()); } catch (e) {}
    return rejected;
  }

  return {
    db,
    open: refresh,
    async add(category, item) { db.addItem(category, item); db.queueCatalogOp({ category, op: 'add', item }); return refresh(); },
    async remove(category, item) { db.removeItem(category, item); db.queueCatalogOp({ category, op: 'remove', item }); return refresh(); },
    async rename(category, oldItem, newItem) { db.editItem(category, oldItem, newItem); db.queueCatalogOp({ category, op: 'rename', item: oldItem, newItem }); return refresh(); },
    list(category) { return db.getCatalogCategory(category).map(i => (typeof i === 'string' ? i : i.name)); }
  };
}

test('deleted entry stays deleted although another mod still had it locally', async (t) => {
  const cloud = createCloud({ pipes: ['P1', 'P2'] });
  const a = createMod(t, cloud);
  const b = createMod(t, cloud);
  await a.open();
  await b.open();
  await a.remove('pipes', 'P2');
  await b.add('pipes', 'P3');
  assert.deepEqual(cloud.rows.pipes, ['P1', 'P3']);
  assert.deepEqual(b.list('pipes'), ['P1', 'P3']);
});

test('entries added by two mods one after another are both kept', async (t) => {
  const cloud = createCloud({ bowls: ['K1'] });
  const c = createMod(t, cloud);
  const e = createMod(t, cloud);
  await c.open();
  await e.open();
  await c.add('bowls', 'K2');
  await e.add('bowls', { name: 'K3', isElectric: true });
  assert.deepEqual(cloud.rows.bowls, ['K1', 'K2', { name: 'K3', isElectric: true }]);
});

test('rename replaces the old name for every mod', async (t) => {
  const cloud = createCloud({ hmds: ['Kaloud'] });
  const f = createMod(t, cloud);
  const g = createMod(t, cloud);
  await f.open();
  await g.open();
  await f.rename('hmds', 'Kaloud', 'Kaloud Lotus');
  await g.open();
  assert.deepEqual(g.list('hmds'), ['Kaloud Lotus']);
});

test('built-in defaults of a new installation are not pushed into the cloud', async (t) => {
  const cloud = createCloud({ pipes: ['Only Cloud'], persons: ['Marv'], tobacco: ['A - B'] });
  const fresh = createMod(t, cloud);
  await fresh.open();
  assert.deepEqual(fresh.list('pipes'), ['Only Cloud']);
  assert.deepEqual(fresh.list('persons'), ['Marv']);
  await fresh.add('pipes', 'Neu');
  assert.deepEqual(cloud.rows.pipes, ['Neu', 'Only Cloud']);
});

test('an emptied custom tobacco or person list stays empty', async (t) => {
  const cloud = createCloud({ tobacco: ['Eigener - Tabak'], persons: ['Marv'] });
  const h = createMod(t, cloud);
  await h.open();
  await h.remove('tobacco', 'Eigener - Tabak');
  await h.remove('persons', 'Marv');
  assert.deepEqual(h.list('tobacco'), []);
  assert.deepEqual(h.list('persons'), []);
  assert.deepEqual(cloud.rows.tobacco, []);
});

test('offline changes wait in the queue and reach the cloud later in order', async (t) => {
  const cloud = createCloud({ charcoal: ['Kohle A'] });
  const mod = createMod(t, cloud);
  await mod.open();
  cloud.online = false;
  await mod.add('charcoal', 'Kohle B');
  await mod.remove('charcoal', 'Kohle A');
  await mod.open();
  assert.deepEqual(mod.list('charcoal'), ['Kohle B'], 'queued changes stay visible while offline');
  assert.equal(mod.db.getPendingCatalogOps().length, 2);
  cloud.online = true;
  await mod.open();
  assert.deepEqual(cloud.rows.charcoal, ['Kohle B']);
  assert.equal(mod.db.getPendingCatalogOps().length, 0);
});

test('a rejected change is reported and rolled back to the cloud list', async (t) => {
  const cloud = createCloud({ vases: ['V1'] });
  const mod = createMod(t, cloud);
  await mod.open();
  cloud.allowed = false;
  const rejected = await mod.add('vases', 'V2');
  assert.match(rejected, /Core-Team/);
  assert.deepEqual(mod.list('vases'), ['V1']);
  assert.equal(mod.db.getPendingCatalogOps().length, 0);
});

test('tobacco entries with flavor objects do not break adding', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'swg-catalog-'));
  try {
    const db = new DatabaseService();
    db.dataPath = dir;
    db.getHookahToolsCacheData = () => ({ flavors: [] });
    db.saveCustomTobacco([{ name: 'Z - Y', flavor: 'Mango' }, 'C - D']);
    assert.equal(db.addItem('tobacco', 'A - B'), true);
    assert.equal(db.editItem('tobacco', 'C - D', 'B - C'), true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('client and edge function share the same single-change rules', () => {
  const edge = read('supabase/functions/channel-api/index.ts');
  const shared = read('src/shared/catalogChange.js');
  for (const fragment of [
    "const catalogCategories = new Set(['pipes', 'bowls', 'vases', 'hmds', 'charcoal', 'persons', 'tastings', 'promos', 'tobacco']);",
    "if (item.isElectric === true) clean.isElectric = true;",
    "return list.filter(entry => catalogItemName(entry).toLowerCase() !== key);"
  ]) {
    const normalized = fragment.replace('const catalogCategories = new Set(', 'const CATALOG_CATEGORIES = ').replace("]);", '];');
    assert.ok(edge.includes(fragment.replace('item.isElectric', '(item as any).isElectric')), `edge: ${fragment}`);
    assert.ok(shared.includes(normalized) || shared.includes(fragment), `shared: ${fragment}`);
  }
  assert.match(edge, /body\.action === 'catalog\.change'[\s\S]*?CORE_MODS\.has/);
  assert.match(edge, /body\.table === 'shishawg_catalog' && body\.operation !== 'select'[\s\S]*?409/);
  assert.match(edge, /\.eq\('updated_at', row\.updated_at\)/);
});

test('main process sends single catalog changes instead of whole lists', () => {
  const main = read('src/main/main.js');
  assert.doesNotMatch(main, /saveCatalogCategory|mergeRemoteCatalog/);
  assert.match(main, /supabaseService\.changeCatalog\(op\)/);
  assert.match(main, /op: 'remove', item: catalogItemName\(item\)/);
});
