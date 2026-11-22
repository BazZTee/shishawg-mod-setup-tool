// Client copy of the catalog change rules in supabase/functions/channel-api/index.ts.
// Both sides apply the same single-item change, so a queued offline change produces
// the same list locally as it later does in the cloud.

const CATALOG_CATEGORIES = ['pipes', 'bowls', 'vases', 'hmds', 'charcoal', 'persons', 'tastings', 'promos', 'tobacco'];

function catalogItemName(item) {
  return String(typeof item === 'string' ? item : (item && item.name) || '').trim();
}

function cleanCatalogItem(item) {
  const name = catalogItemName(item).replace(/[\u0000-\u001F\u007F]/g, '').slice(0, 200);
  if (!name) throw new Error('Leerer Katalogeintrag.');
  if (typeof item !== 'object' || item === null) return name;
  const clean = { name };
  if (item.isElectric === true) clean.isElectric = true;
  if (item.flavor) clean.flavor = String(item.flavor).trim().slice(0, 200);
  return Object.keys(clean).length === 1 ? name : clean;
}

function applyCatalogChange(items, op, item, newItem) {
  const list = Array.isArray(items) ? [...items] : [];
  const key = catalogItemName(item).toLowerCase();
  let result;
  if (op === 'add') {
    result = list.some(entry => catalogItemName(entry).toLowerCase() === key) ? list : [...list, cleanCatalogItem(item)];
  } else if (op === 'remove') {
    return list.filter(entry => catalogItemName(entry).toLowerCase() !== key);
  } else if (op === 'rename') {
    const replacement = cleanCatalogItem(newItem);
    const newKey = catalogItemName(replacement).toLowerCase();
    result = list.filter(entry => {
      const k = catalogItemName(entry).toLowerCase();
      return k !== key && k !== newKey;
    });
    result.push(replacement);
  } else {
    throw new Error('Unbekannte Katalogänderung.');
  }
  return result.sort((a, b) => catalogItemName(a).localeCompare(catalogItemName(b), 'de'));
}

function catalogCloudKey(category) {
  return category === 'customTobacco' ? 'tobacco' : category;
}

module.exports = { CATALOG_CATEGORIES, catalogItemName, cleanCatalogItem, applyCatalogChange, catalogCloudKey };
