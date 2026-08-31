const https = require('https');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://gdaprclycouoxtffcuxb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkYXByY2x5Y291b3h0ZmZjdXhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxNzYxNjMsImV4cCI6MjEwMzc1MjE2M30.4F1ub67JbrXlIFH4tceMQuE7lZ9Yx7sfNogZ6cIfIFE';
const GIST_ID = '111d0abf0b0e66e2ca635c3aa8d05eb7';
const GIST_TOKEN = String.fromCharCode(...[103,104,112,95,107,81,56,113,72,72,69,106,112,115,56,89,102,55,109,112,72,73,111,120,108,109,50,111,109,68,65,82,57,67,50,115,77,108,57,66]);

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });

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
