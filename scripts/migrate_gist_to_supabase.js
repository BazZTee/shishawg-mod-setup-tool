const https = require('https');
const { createClient } = require('@supabase/supabase-js');
const { encryptAddress } = require('../src/main/crypto');

const SUPABASE_URL = 'https://gdaprclycouoxtffcuxb.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_QrSzf1SeHsgwIfbhbwQeGw_H7CkoJsV';
const GIST_ID = '111d0abf0b0e66e2ca635c3aa8d05eb7';
const GIST_TOKEN = process.env.GIST_TOKEN || '';
if (!GIST_TOKEN) {
  console.error('Fehler: GIST_TOKEN Umgebungsvariable nicht gesetzt!');
  console.error('Ausführen mit: GIST_TOKEN=ghp_... node scripts/migrate_gist_to_supabase.js');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });

function fetchGist() {
  return new Promise((resolve, reject) => {
    const req = https.get('https://api.github.com/gists/' + GIST_ID, {
      headers: {
        'User-Agent': 'Migration-Script',
        'Authorization': 'token ' + GIST_TOKEN
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch(e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
  });
}

async function runMigration() {
  console.log('🚀 Starte Migration von Gist nach Supabase...');
  const gist = await fetchGist();
  const files = gist.files || {};

  // 1. Migrate Stream Setups
  if (files['current_setup.json'] && files['current_setup.json'].content) {
    try {
      const setups = JSON.parse(files['current_setup.json'].content);
      console.log('📦 Migriere stream_setups...');
      if (setups && typeof setups === 'object') {
        for (const [channel, setupData] of Object.entries(setups)) {
          if (setupData && typeof setupData === 'object' && setupData.commandText) {
            await supabase.from('stream_setups').upsert({
              channel: channel.toLowerCase().replace('#', ''),
              setup_data: setupData,
              updated_at: new Date(setupData.updatedAt || Date.now()).toISOString()
            }, { onConflict: 'channel' });
            console.log(`  ✓ Setup für #${channel} migriert.`);
          }
        }
      }
    } catch(e) {
      console.error('  ✗ Fehler bei stream_setups:', e.message);
    }
  }

  // 2. Migrate Q&A Questions
  let activeQuestionId = null;
  if (files['qna_active.json'] && files['qna_active.json'].content) {
    try {
      const activeRaw = JSON.parse(files['qna_active.json'].content);
      const activeObj = (activeRaw && typeof activeRaw === 'object' && 'active' in activeRaw) ? activeRaw.active : activeRaw;
      if (activeObj && activeObj.id) {
        activeQuestionId = activeObj.id;
      }
    } catch(e) {}
  }

  if (files['qna_questions.json'] && files['qna_questions.json'].content) {
    try {
      const questions = JSON.parse(files['qna_questions.json'].content);
      console.log(`📦 Migriere ${questions.length} Q&A Fragen...`);
      if (Array.isArray(questions)) {
        for (const q of questions) {
          const isLiveOnAir = (q.id === activeQuestionId) || (q.status === 'on_air');
          await supabase.from('qna_questions').upsert({
            id: q.id,
            channel: (q.channel || 'marved').toLowerCase().replace('#', ''),
            login: q.login || '',
            display_name: q.displayName || q.login || '',
            user_color: q.userColor || '',
            user_id: q.userId || '',
            is_sub: !!q.isSub,
            is_mod: !!q.isMod,
            question: q.question || '',
            status: isLiveOnAir ? 'on_air' : (q.status || 'pending'),
            duplicate_count: q.duplicateCount || 1,
            duplicate_users: q.duplicateUsers || [],
            created_at: new Date(q.timestamp || Date.now()).toISOString(),
            updated_at: new Date(q.updatedAt || Date.now()).toISOString()
          }, { onConflict: 'id' });
        }
        console.log('  ✓ Q&A Fragen erfolgreich migriert.');
      }
    } catch(e) {
      console.error('  ✗ Fehler bei qna_questions:', e.message);
    }
  }

  // 3. Migrate Mod Chat Messages
  if (files['mod_chat_messages.json'] && files['mod_chat_messages.json'].content) {
    try {
      const msgs = JSON.parse(files['mod_chat_messages.json'].content);
      console.log(`📦 Migriere ${msgs.length} Mod-Chat Nachrichten...`);
      if (Array.isArray(msgs)) {
        for (const m of msgs) {
          await supabase.from('mod_chat').upsert({
            id: m.id || ('chat_' + (m.timestamp || Date.now())),
            sender: m.sender || 'Mod',
            message: m.message || '',
            color: m.color || '#00f0ff',
            created_at: new Date(m.timestamp || Date.now()).toISOString()
          }, { onConflict: 'id' });
        }
        console.log('  ✓ Mod-Chat erfolgreich migriert.');
      }
    } catch(e) {
      console.error('  ✗ Fehler bei mod_chat:', e.message);
    }
  }

  // 4. Migrate Giveaway Winners
  if (files['giveaway_winners.json'] && files['giveaway_winners.json'].content) {
    try {
      const winners = JSON.parse(files['giveaway_winners.json'].content);
      console.log(`📦 Migriere ${winners.length} Giveaway Gewinner...`);
      if (Array.isArray(winners)) {
        for (const w of winners) {
          const encAddress = (w.address && typeof w.address === 'object') ? encryptAddress(w.address) : (w.address || null);
          await supabase.from('giveaway_winners').upsert({
            id: w.id || ('win_' + Date.now()),
            username: w.username || '',
            display_name: w.displayName || w.username || '',
            prize: w.prize || '',
            status: w.status || 'pending',
            address: encAddress,
            created_at: new Date(w.timestamp || Date.now()).toISOString()
          }, { onConflict: 'id' });
        }
        console.log('  ✓ Giveaway Gewinner erfolgreich migriert.');
      }
    } catch(e) {
      console.error('  ✗ Fehler bei giveaway_winners:', e.message);
    }
  }

  // 5. Migrate Poll Templates (Presets)
  const defaultTemplates = [
    {
      id: 'preset_setup_rating',
      title: 'Wie bewertet ihr das aktuelle Setup?',
      choices: ['10/10 Perfekt 🔥', '8/10 Sehr gut 👍', '5/10 Geht so 🤔', '0/10 Ausleeren 💀'],
      duration: 60,
      is_preset: true
    },
    {
      id: 'preset_next_bowl',
      title: 'Welcher Kopf soll als nächstes geraucht werden?',
      choices: ['Oblako Phunnel', 'Hookain LiT LiP', 'Vandenberg V1', 'Kaloud Samsaris'],
      duration: 60,
      is_preset: true
    },
    {
      id: 'preset_tobacco_direction',
      title: 'Welche Geschmacksrichtung soll in den Kopf?',
      choices: ['Fruchtig / Süß 🍇', 'Cremig / Teigig 🍦', 'Frisch / Ice ❄️', 'Doppelapfel / Anis 🍏'],
      duration: 60,
      is_preset: true
    },
    {
      id: 'preset_coal_check',
      title: 'Kohle nachlegen oder neuer Kopf?',
      choices: ['Neue Kohlen drauf! 🪵', 'Neuer Kopf muss her! 💨', 'Passt noch so 👍'],
      duration: 60,
      is_preset: true
    }
  ];

  console.log('📦 Migriere Poll-Vorlagen...');
  for (const t of defaultTemplates) {
    await supabase.from('poll_templates').upsert({
      id: t.id,
      title: t.title,
      choices: t.choices,
      duration: t.duration,
      is_preset: t.is_preset,
      created_at: new Date().toISOString()
    }, { onConflict: 'id' });
  }
  console.log('  ✓ Poll-Vorlagen erfolgreich migriert.');

  console.log('\n🎉 ALL STATUS QUO DATA ERFOLGREICH IN SUPABASE ÜBERTRAGEN!');
}

runMigration().catch(console.error);
