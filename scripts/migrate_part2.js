const https = require('https');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://gdaprclycouoxtffcuxb.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_QrSzf1SeHsgwIfbhbwQeGw_H7CkoJsV';
const GIST_ID = '111d0abf0b0e66e2ca635c3aa8d05eb7';
const GIST_TOKEN = process.env.GIST_TOKEN || '';
if (!GIST_TOKEN) {
  console.error('Fehler: GIST_TOKEN Umgebungsvariable nicht gesetzt!');
  console.error('Ausführen mit: GIST_TOKEN=ghp_... node scripts/migrate_part2.js');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });

function fetchGist() {
  return new Promise((resolve, reject) => {
    const req = https.get('https://api.github.com/gists/' + GIST_ID, {
      headers: {
        'User-Agent': 'Migration-Part2',
        'Authorization': 'token ' + GIST_TOKEN
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
  });
}

async function migrateCatalogAndTelegram() {
  const gist = await fetchGist();
  const files = gist.files || {};

  // 1. Catalog
  if (files['shishawg_catalog.json'] && files['shishawg_catalog.json'].content) {
    try {
      const catalog = JSON.parse(files['shishawg_catalog.json'].content);
      console.log('📦 Migriere shishawg_catalog...');
      for (const [category, items] of Object.entries(catalog)) {
        const { error } = await supabase.from('shishawg_catalog').upsert({
          category,
          items: Array.isArray(items) ? items : [],
          updated_at: new Date().toISOString()
        }, { onConflict: 'category' });
        if (error) throw error;
        console.log(`  ✓ Kategorie ${category} (${items.length} Einträge) migriert.`);
      }
    } catch(e) {
      console.log('  ✗ Catalog-Tabelle noch nicht bereit:', e.message);
    }
  }

  // 2. Telegram Config
  if (files['telegram_config.json'] && files['telegram_config.json'].content) {
    try {
      const cfg = JSON.parse(files['telegram_config.json'].content);
      console.log('📦 Migriere telegram_config...');
      const { error } = await supabase.from('telegram_config').upsert({
        id: 'default',
        bot_token: cfg.botToken || '',
        chat_id: cfg.chatId || '',
        claim_url: cfg.claimUrl || '',
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
      if (error) throw error;
      console.log('  ✓ Telegram Config migriert.');
    } catch(e) {
      console.log('  ✗ Telegram-Tabelle noch nicht bereit:', e.message);
    }
  }
}

migrateCatalogAndTelegram().catch(console.error);
