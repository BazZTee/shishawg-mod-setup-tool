const WebSocket = require('ws');
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = WebSocket;
}
const { createClient } = require('@supabase/supabase-js');
const { encryptAddress, decryptAddress, isEncrypted } = require('./crypto');

const SUPABASE_URL = 'https://gdaprclycouoxtffcuxb.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_QrSzf1SeHsgwIfbhbwQeGw_H7CkoJsV';

class SupabaseService {
  constructor() {
    this.client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false },
      realtime: {
        websocket: WebSocket,
        params: { eventsPerSecond: 20 }
      }
    });
    this.supabase = this.client;
    this.mainWindow = null;
    this.channelSubscriptions = [];
    this.activeChannel = 'marved';
    this.twitchTokenProvider = () => '';
  }

  setMainWindow(win) {
    this.mainWindow = win;
  }

  setTwitchTokenProvider(provider) {
    this.twitchTokenProvider = typeof provider === 'function' ? provider : (() => '');
  }

  async secureRequest(action, payload = {}) {
    const twitchToken = String(this.twitchTokenProvider() || '').trim();
    if (!twitchToken) throw new Error('Twitch-Anmeldung für den geschützten Datenzugriff fehlt.');
    const response = await fetch(`${SUPABASE_URL}/functions/v1/channel-api`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_PUBLISHABLE_KEY,
        'x-twitch-token': twitchToken
      },
      body: JSON.stringify({ action, ...payload })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `Geschützter Datenzugriff fehlgeschlagen (${response.status}).`);
    return result.data;
  }

  secureDb(table, operation, channel, options = {}) {
    return this.secureRequest('db', {
      table,
      operation,
      channel: this.normalizeChannel(channel || this.activeChannel),
      ...options
    });
  }

  normalizeChannel(channel = 'marved') {
    return String(channel || 'marved').toLowerCase().replace('#', '').trim();
  }

  setActiveChannel(channel = 'marved') {
    this.activeChannel = this.normalizeChannel(channel);
  }

  isPayloadForActiveChannel(payload) {
    const row = (payload && (payload.new || payload.old)) || {};
    const rowChannel = this.normalizeChannel(row.channel || 'marved');
    return rowChannel === this.activeChannel;
  }

  // --- Realtime WebSocket Subscriptions for Electron ---
  initRealtimeListeners() {
    try {
      const qnaChannel = this.client
        .channel('db-qna-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'qna_questions' }, (payload) => {
          if (this.isPayloadForActiveChannel(payload) && this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('supabase:qna-changed', payload);
          }
        })
        .subscribe();

      const setupChannel = this.client
        .channel('db-setup-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'stream_setups' }, (payload) => {
          if (this.isPayloadForActiveChannel(payload) && this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('supabase:setup-changed', payload);
          }
        })
        .subscribe();

      const chatChannel = this.client
        .channel('db-chat-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'mod_chat' }, (payload) => {
          if (this.isPayloadForActiveChannel(payload) && this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('supabase:chat-changed', payload);
          }
        })
        .subscribe();

      const bestrafungenChannel = this.client
        .channel('db-bestrafungen-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bestrafungen' }, (payload) => {
          if (this.isPayloadForActiveChannel(payload) && this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('supabase:bestrafungen-changed', payload);
          }
        })
        .subscribe();

      const settingsChannel = this.client
        .channel('db-settings-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'qna_settings' }, (payload) => {
          if (this.isPayloadForActiveChannel(payload) && this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('supabase:settings-changed', payload);
          }
        })
        .subscribe();

      const giveawayChannel = this.client
        .channel('db-giveaway-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'giveaway_winners' }, (payload) => {
          if (this.isPayloadForActiveChannel(payload) && this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('supabase:giveaway-changed', payload);
          }
        })
        .subscribe();

      const catalogChannel = this.client
        .channel('db-catalog-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'shishawg_catalog' }, (payload) => {
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('supabase:catalog-changed', payload);
          }
        })
        .subscribe();

      this.channelSubscriptions.push(qnaChannel, setupChannel, chatChannel, bestrafungenChannel, settingsChannel, giveawayChannel, catalogChannel);
      console.log('✅ Supabase Realtime WebSockets initialized in Electron.');
    } catch(e) {
      console.error('Failed to init Supabase realtime in Electron:', e);
    }
  }

  // --- Q&A Questions CRUD ---
  async getQnAQuestions(channel = 'marved') {
    try {
      const { data, error } = await this.client
        .from('qna_questions')
        .select('*')
        .eq('channel', channel.toLowerCase().replace('#', ''))
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []).map(r => ({
        id: r.id,
        channel: r.channel,
        login: r.login,
        displayName: r.display_name,
        userColor: r.user_color,
        userId: r.user_id,
        isSub: r.is_sub,
        isMod: r.is_mod,
        question: r.question,
        status: r.status,
        answeredBy: r.answered_by || null,
        duplicateCount: r.duplicate_count || 1,
        duplicateUsers: r.duplicate_users || [],
        timestamp: new Date(r.created_at).getTime(),
        updatedAt: new Date(r.updated_at).getTime()
      }));
    } catch(err) {
      console.error('Supabase getQnAQuestions error:', err.message);
      return [];
    }
  }

  async upsertQnAQuestion(q) {
    try {
      const row = {
        id: q.id,
        channel: (q.channel || 'marved').toLowerCase().replace('#', ''),
        login: q.login || '',
        display_name: q.displayName || q.login || '',
        user_color: q.userColor || '',
        user_id: q.userId || '',
        is_sub: !!q.isSub,
        is_mod: !!q.isMod,
        question: q.question || '',
        status: q.status || 'pending',
        answered_by: q.answeredBy || null,
        duplicate_count: q.duplicateCount || 1,
        duplicate_users: q.duplicateUsers || [],
        updated_at: new Date(q.updatedAt || Date.now()).toISOString()
      };
      if (q.timestamp) {
        row.created_at = new Date(q.timestamp).toISOString();
      }

      const data = await this.secureDb('qna_questions', 'upsert', row.channel, { values: row, onConflict: 'id' });
      return data;
    } catch(err) {
      console.error('Supabase upsertQnAQuestion error:', err.message);
      return null;
    }
  }

  async saveAllQnAQuestions(questions) {
    if (!Array.isArray(questions) || questions.length === 0) return [];
    try {
      const rows = questions.map(q => ({
        id: q.id,
        channel: (q.channel || 'marved').toLowerCase().replace('#', ''),
        login: q.login || '',
        display_name: q.displayName || q.login || '',
        user_color: q.userColor || '',
        user_id: q.userId || '',
        is_sub: !!q.isSub,
        is_mod: !!q.isMod,
        question: q.question || '',
        status: q.status || 'pending',
        answered_by: q.answeredBy || null,
        duplicate_count: q.duplicateCount || 1,
        duplicate_users: q.duplicateUsers || [],
        created_at: new Date(q.timestamp || Date.now()).toISOString(),
        updated_at: new Date(q.updatedAt || Date.now()).toISOString()
      }));

      const data = await this.secureDb('qna_questions', 'upsert', rows[0].channel, { values: rows, onConflict: 'id' });
      return data;
    } catch(err) {
      console.error('Supabase saveAllQnAQuestions error:', err.message);
      return [];
    }
  }

  async setQnAStatus(questionId, status, channel = 'marved') {
    try {
      const data = await this.secureDb('qna_questions', 'update', channel, {
        values: {
          status: status,
          updated_at: new Date().toISOString()
        },
        filters: { id: questionId }
      });
      return data;
    } catch(err) {
      console.error('Supabase setQnAStatus error:', err.message);
      return null;
    }
  }

  async getActiveQnAQuestion(channel = 'marved') {
    try {
      const { data, error } = await this.client
        .from('qna_questions')
        .select('*')
        .eq('channel', channel.toLowerCase().replace('#', ''))
        .eq('status', 'on_air')
        .order('updated_at', { ascending: false })
        .limit(1);

      if (error) throw error;
      if (data && data.length > 0) {
        const r = data[0];
        return {
          id: r.id,
          channel: r.channel,
          login: r.login,
          displayName: r.display_name,
          userColor: r.user_color,
          userId: r.user_id,
          isSub: r.is_sub,
          isMod: r.is_mod,
          question: r.question,
          status: r.status,
          duplicateCount: r.duplicate_count || 1,
          duplicateUsers: r.duplicate_users || [],
          timestamp: new Date(r.created_at).getTime(),
          updatedAt: new Date(r.updated_at).getTime()
        };
      }
      return null;
    } catch(err) {
      console.error('Supabase getActiveQnAQuestion error:', err.message);
      return null;
    }
  }

  async setActiveQnAQuestion(channel = 'marved', questionObj) {
    try {
      const cleanChan = channel.toLowerCase().replace('#', '');
      
      // 1. Reset all other questions on this channel that are currently on_air to approved
      await this.secureDb('qna_questions', 'update', cleanChan, {
        values: { status: 'approved', updated_at: new Date().toISOString() },
        filters: { status: 'on_air' }
      });

      // 2. If a new question is to be set on_air
      if (questionObj && questionObj.id) {
        await this.secureDb('qna_questions', 'update', cleanChan, {
          values: { status: 'on_air', updated_at: new Date().toISOString() },
          filters: { id: questionObj.id }
        });
      }
      return questionObj;
    } catch(err) {
      console.error('Supabase setActiveQnAQuestion error:', err.message);
      return questionObj;
    }
  }

  async deleteQnAQuestion(questionId, channel = 'marved') {
    try {
      await this.secureDb('qna_questions', 'delete', channel, { filters: { id: questionId } });
      return true;
    } catch(err) {
      console.error('Supabase deleteQnAQuestion error:', err.message);
      return false;
    }
  }

  async deleteAllQnAQuestions(channel = 'marved') {
    try {
      const cleanChan = channel.toLowerCase().replace('#', '');
      await this.secureDb('qna_questions', 'delete', cleanChan);
      return true;
    } catch(err) {
      console.error('Supabase deleteAllQnAQuestions error:', err.message);
      return false;
    }
  }

  async deleteAnsweredQnAQuestions(channel = 'marved') {
    try {
      const cleanChan = channel.toLowerCase().replace('#', '');
      await this.secureDb('qna_questions', 'delete', cleanChan, { filters: { status: 'answered' } });
      return true;
    } catch(err) {
      console.error('Supabase deleteAnsweredQnAQuestions error:', err.message);
      return false;
    }
  }

  // --- Stream Setups CRUD ---
  async getStreamSetup(channel = 'marved') {
    try {
      const { data, error } = await this.client
        .from('stream_setups')
        .select('*')
        .eq('channel', channel.toLowerCase().replace('#', ''))
        .maybeSingle();

      if (error) throw error;
      return data ? data.setup_data : null;
    } catch(err) {
      console.error('Supabase getStreamSetup error:', err.message);
      return null;
    }
  }

  async saveStreamSetup(channel = 'marved', setupData) {
    try {
      const cleanChan = channel.toLowerCase().replace('#', '');
      await this.secureDb('stream_setups', 'upsert', cleanChan, { values: {
          channel: cleanChan,
          setup_data: setupData,
          updated_at: new Date().toISOString()
        }, onConflict: 'channel' });
      return setupData;
    } catch(err) {
      console.error('Supabase saveStreamSetup error:', err.message);
      return setupData;
    }
  }

  // --- Catalog CRUD ---
  async getCatalog() {
    try {
      const { data, error } = await this.client
        .from('shishawg_catalog')
        .select('*');
      if (error) throw error;
      const catalog = {};
      (data || []).forEach(row => {
        catalog[row.category] = row.items;
      });
      return catalog;
    } catch(err) {
      console.error('Supabase getCatalog error:', err.message);
      return null;
    }
  }

  async saveCatalogCategory(category, items) {
    try {
      await this.secureDb('shishawg_catalog', 'upsert', this.activeChannel, { values: {
          category,
          items: Array.isArray(items) ? items : [],
          updated_at: new Date().toISOString()
        }, onConflict: 'category' });
      return true;
    } catch(err) {
      console.error('Supabase saveCatalogCategory error:', err.message);
      return false;
    }
  }

  // --- Mod Watchlist CRUD ---
  async getWatchlist(channel = 'marved') {
    try {
      const cleanChan = (channel || 'marved').toLowerCase().replace('#', '');
      const data = await this.secureDb('mod_watchlist', 'select', cleanChan, {
        order: { column: 'created_at', ascending: false }
      });
      return (data || []).map(r => ({
        id: r.id,
        channel: r.channel || cleanChan,
        username: r.username,
        addedBy: r.added_by,
        note: r.reason || r.note || '',
        reason: r.reason || r.note || '',
        completed: !!r.completed,
        timestamp: new Date(r.created_at).getTime()
      }));
    } catch(err) {
      console.error('Supabase getWatchlist error:', err.message);
      return [];
    }
  }

  async addToWatchlist(item, channel = 'marved') {
    try {
      const row = {
        id: item.id || ('wl_' + Date.now()),
        channel: this.normalizeChannel(channel),
        username: item.username,
        added_by: item.addedBy || 'Mod',
        reason: item.note || item.reason || '',
        created_at: new Date(item.timestamp || Date.now()).toISOString()
      };
      await this.secureDb('mod_watchlist', 'upsert', channel, { values: row, onConflict: 'id' });
    } catch(err) {
      console.error('Supabase addToWatchlist error:', err.message);
    }
  }

  async removeFromWatchlist(id, channel = 'marved') {
    try {
      await this.secureDb('mod_watchlist', 'delete', channel, { filters: { id } });
    } catch(err) {
      console.error('Supabase removeFromWatchlist error:', err.message);
    }
  }

  // --- Telegram Config CRUD ---
  async getTelegramConfig(channel = 'marved') {
    try {
      const cleanChan = (channel || 'marved').toLowerCase().replace('#', '');
      const data = await this.secureDb('telegram_config', 'select', cleanChan, { maybeSingle: true });
      return data ? { botToken: data.bot_token, chatId: data.chat_id, claimUrl: data.claim_url } : null;
    } catch(err) {
      console.error('Supabase getTelegramConfig error:', err.message);
      return null;
    }
  }

  async saveTelegramConfig(config, channel = 'marved') {
    try {
      const cleanChan = (channel || config.channel || 'marved').toLowerCase().replace('#', '');
      await this.secureDb('telegram_config', 'upsert', cleanChan, { values: {
          id: cleanChan,
          bot_token: config.botToken || '',
          chat_id: config.chatId || '',
          claim_url: config.claimUrl || '',
          updated_at: new Date().toISOString()
        }, onConflict: 'id' });
    } catch(err) {
      console.error('Supabase saveTelegramConfig error:', err.message);
    }
  }

  // --- Mod Chat CRUD ---
  async getModChat(channel = 'marved') {
    try {
      const cleanChan = (channel || 'marved').toLowerCase().replace('#', '');
      const data = await this.secureDb('mod_chat', 'select', cleanChan, {
        order: { column: 'created_at', ascending: true },
        limit: 100
      });
      return (data || []).map(r => ({
        id: r.id,
        channel: r.channel || cleanChan,
        senderName: r.sender || 'Mod',
        senderColor: r.color || '#00f0ff',
        senderAvatar: '',
        text: r.message || '',
        timestamp: new Date(r.created_at).getTime()
      }));
    } catch(err) {
      console.error('Supabase getModChat error:', err.message);
      return [];
    }
  }

  async sendModChatMessage(msg, channel = 'marved') {
    try {
      const row = {
        id: msg.id || ('chat_' + Date.now()),
        channel: this.normalizeChannel(channel),
        sender: msg.senderName || msg.sender || 'Mod',
        message: msg.text || msg.message || '',
        color: msg.senderColor || msg.color || '#00f0ff',
        created_at: new Date(msg.timestamp || Date.now()).toISOString()
      };
      await this.secureDb('mod_chat', 'upsert', channel, { values: row, onConflict: 'id' });
      return await this.getModChat(channel);
    } catch(err) {
      console.error('Supabase sendModChatMessage error:', err.message);
      return [];
    }
  }

  async clearModChat(channel = 'marved') {
    try {
      await this.secureDb('mod_chat', 'delete', channel);
      return [];
    } catch(err) {
      console.error('Supabase clearModChat error:', err.message);
      return [];
    }
  }

  async heartbeatModPresence(user, channel = 'marved') {
    const cleanChan = this.normalizeChannel(channel);
    return this.secureRequest('presence.heartbeat', {
      channel: cleanChan,
      displayName: String(user?.display_name || user?.login || '').trim(),
      avatarUrl: String(user?.profile_image_url || '').trim()
    });
  }

  async getModPresence(channel = 'marved') {
    const cleanChan = this.normalizeChannel(channel);
    const data = await this.secureRequest('presence.list', { channel: cleanChan });
    return Array.isArray(data) ? data : [];
  }

  // --- Giveaway Winners CRUD ---
  async getGiveaways(channel = 'marved') {
    try {
      const cleanChan = (channel || 'marved').toLowerCase().replace('#', '');
      const data = await this.secureRequest('giveaways.list', { channel: cleanChan });
      return (data || []).map(r => {
        let decryptedAddr = null;

        if (r.address) {
          if (typeof r.address === 'string') {
            if (isEncrypted(r.address)) {
              decryptedAddr = decryptAddress(r.address);
            } else {
              try {
                decryptedAddr = JSON.parse(r.address);
              } catch(e) {
                decryptedAddr = r.address;
              }
            }
          } else if (typeof r.address === 'object') {
            decryptedAddr = r.address;
          }
        }

        const addressObj = decryptedAddr && typeof decryptedAddr === 'object' ? decryptedAddr : null;
        const prizeLower = (r.prize || '').toLowerCase();
        const inferredType = prizeLower.includes('kohle') || prizeLower.includes('zauber') || prizeLower.includes('punkte') || prizeLower.includes('würfel') || prizeLower.includes('wuerfel') || prizeLower.includes('cube')
          ? 'channel_points'
          : 'giveaway';

        return {
          id: r.id,
          channel: r.channel || cleanChan,
          username: r.username,
          displayName: r.display_name,
          prize: r.prize,
          status: r.status,
          address: decryptedAddr,
          coalSize: addressObj ? (addressObj.coalSize || addressObj.coal_size || '') : '',
          type: addressObj?.rewardType || inferredType,
          timestamp: new Date(r.created_at).getTime()
        };
      });
    } catch(err) {
      console.error('Supabase getGiveaways error:', err.message);
      return [];
    }
  }

  async saveGiveawayWinner(winner, channel = 'marved') {
    try {
      const cleanChan = (channel || winner.channel || 'marved').toLowerCase().replace('#', '');
      let addressToSave = winner.address && typeof winner.address === 'object' ? { ...winner.address } : null;
      if (!addressToSave && (winner.type === 'channel_points' || winner.type === 'giveaway')) addressToSave = { rewardType: winner.type };
      if (addressToSave && !addressToSave.rewardType && winner.type) addressToSave.rewardType = winner.type;

      const row = {
        id: winner.id || ('win_' + Date.now()),
        channel: cleanChan,
        username: winner.username || winner.user_login || winner.user_name || '',
        display_name: winner.displayName || winner.user_name || winner.username || '',
        prize: winner.prize || '',
        status: winner.status || 'pending',
        address: addressToSave,
        created_at: new Date(winner.timestamp || winner.created_at || Date.now()).toISOString()
      };

      await this.secureRequest('giveaways.upsert', { channel: cleanChan, winner: row });
      return true;
    } catch(err) {
      console.error('Supabase saveGiveawayWinner error:', err.message);
      throw err;
    }
  }

  async deleteGiveawayWinner(id, channel = 'marved') {
    try {
      await this.secureRequest('giveaways.delete', { channel: this.normalizeChannel(channel), id });
      return true;
    } catch(err) {
      console.error('Supabase deleteGiveawayWinner error:', err.message);
      return false;
    }
  }

  // --- Poll Templates CRUD ---
  async getPollTemplates() {
    try {
      const { data, error } = await this.client
        .from('poll_templates')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []).map(r => ({
        id: r.id,
        title: r.title,
        choices: r.choices,
        duration: r.duration,
        isPreset: r.is_preset
      }));
    } catch(err) {
      console.error('Supabase getPollTemplates error:', err.message);
      return [];
    }
  }

  // --- Bestrafungen (Punishments / Challenges) CRUD ---
  async getBestrafungen(channel = 'marved') {
    try {
      const cleanChan = this.normalizeChannel(channel);
      const { data, error } = await this.client
        .from('bestrafungen')
        .select('*')
        .eq('channel', cleanChan)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(r => ({
          id: r.id,
          channel: r.channel || cleanChan,
        name: r.name,
        status: r.status,
        executedBy: r.executed_by || null,
        timestamp: new Date(r.created_at).getTime()
      }));
    } catch(err) {
      console.error('Supabase getBestrafungen error:', err.message);
      return [];
    }
  }

  async saveBestrafung(b, channel = 'marved') {
    try {
      const data = await this.secureDb('bestrafungen', 'upsert', channel, { values: {
          id: b.id || ('pen_' + Date.now()),
          channel: this.normalizeChannel(channel),
          name: b.name || '',
          status: b.status || 'offen',
          executed_by: b.executedBy || null,
          created_at: new Date(b.timestamp || Date.now()).toISOString()
        }, onConflict: 'id' });
      return data;
    } catch(err) {
      console.error('Supabase saveBestrafung error:', err.message);
      return null;
    }
  }

  async updateBestrafungStatus(id, status, executedBy = null, channel = 'marved') {
    try {
      const payload = { status };
      if (executedBy) payload.executed_by = executedBy;

      const data = await this.secureDb('bestrafungen', 'update', channel, { values: payload, filters: { id } });
      return data;
    } catch(err) {
      console.error('Supabase updateBestrafungStatus error:', err.message);
      return null;
    }
  }

  async deleteBestrafung(id, channel = 'marved') {
    try {
      await this.secureDb('bestrafungen', 'delete', channel, { filters: { id } });
      return true;
    } catch(err) {
      console.error('Supabase deleteBestrafung error:', err.message);
      return false;
    }
  }

  // --- Q&A Streamer Settings (Persons & Wheel Toggle) ---
  async getQnASettings(channel = 'marved') {
    try {
      const cleanChan = channel.toLowerCase().replace('#', '');
      const { data, error } = await this.client
        .from('qna_settings')
        .select('channel,persons,active_person,wheel_enabled,display_duration,timer_state,updated_at')
        .eq('channel', cleanChan)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        return {
          channel: data.channel,
          persons: Array.isArray(data.persons) ? data.persons : ['Marved', 'Hasty', 'Kai'],
          activePerson: data.active_person || 'Marved',
          wheelEnabled: data.wheel_enabled !== false,
          displayDuration: data.display_duration || 10
        };
      }
      return {
        channel: cleanChan,
        persons: ['Marved', 'Hasty', 'Kai'],
        activePerson: 'Marved',
        wheelEnabled: true,
        displayDuration: 10
      };
    } catch(err) {
      console.error('Supabase getQnASettings error:', err.message);
      return {
        channel,
        persons: ['Marved', 'Hasty', 'Kai'],
        activePerson: 'Marved',
        wheelEnabled: true,
        displayDuration: 10
      };
    }
  }

  async saveQnASettings(channel = 'marved', settings = {}) {
    try {
      const cleanChan = channel.toLowerCase().replace('#', '');
      const data = await this.secureDb('qna_settings', 'upsert', cleanChan, { values: {
          channel: cleanChan,
          persons: settings.persons || ['Marved', 'Hasty', 'Kai'],
          active_person: settings.activePerson || 'Marved',
          wheel_enabled: settings.wheelEnabled !== false,
          display_duration: settings.displayDuration || 10,
          updated_at: new Date().toISOString()
        }, onConflict: 'channel' });
      return data;
    } catch(err) {
      console.error('Supabase saveQnASettings error:', err.message);
      return settings;
    }
  }

  // Twitch requires the broadcaster's own token for Poll and Prediction APIs.
  // This compatibility store should be replaced by a protected server-side broker.
  async getBroadcasterToken(channel = 'marved') {
    try {
      const cleanChan = channel.toLowerCase().replace('#', '');
      const data = await this.secureDb('qna_settings', 'select', cleanChan, {
        select: 'broadcaster_token', maybeSingle: true
      });
      return data && data.broadcaster_token ? data.broadcaster_token : null;
    } catch(err) {
      console.error('Supabase getBroadcasterToken error:', err.message);
      return null;
    }
  }

  async saveBroadcasterToken(channel = 'marved', token) {
    try {
      const cleanChan = channel.toLowerCase().replace('#', '');
      await this.secureDb('qna_settings', 'upsert', cleanChan, { values: {
          channel: cleanChan,
          broadcaster_token: token,
          updated_at: new Date().toISOString()
        }, onConflict: 'channel' });
      return true;
    } catch(err) {
      console.error('Supabase saveBroadcasterToken error:', err.message);
      return false;
    }
  }

  // --- Shisha Sessions & Timer Methods ---
  async getShishaSessions(channel = 'marved') {
    try {
      const cleanChan = channel.toLowerCase().replace('#', '');
      const data = await this.secureDb('shisha_sessions', 'select', cleanChan, {
        order: { column: 'created_at', ascending: false }
      });
      return data || [];
    } catch(err) {
      console.error('Supabase getShishaSessions error:', err.message);
      return [];
    }
  }

  async saveShishaSession(session) {
    try {
      const cleanChan = (session.channel || 'marved').toLowerCase().replace('#', '');
      const row = {
        id: session.id || ('sess_' + Date.now()),
        channel: cleanChan,
        head_num: session.headNum || 1,
        tobacco: session.tobacco || '',
        tobacco_items: Array.isArray(session.tobaccoItems) ? session.tobaccoItems : [],
        bowl: session.bowl || '',
        pipe: session.pipe || '',
        hmd: session.hmd || '',
        electric_device: session.electricDevice || '',
        is_electric: !!session.isElectric,
        person: session.person || 'Marvin',
        duration_minutes: session.durationMinutes || 0,
        coal_rotations: session.coalRotations || 0,
        rating: session.rating || 0,
        notes: session.notes || '',
        started_at: session.startedAt ? new Date(session.startedAt).toISOString() : new Date().toISOString(),
        ended_at: session.endedAt ? new Date(session.endedAt).toISOString() : new Date().toISOString(),
        created_at: new Date().toISOString()
      };
      let data;
      let error = null;
      try {
        data = await this.secureDb('shisha_sessions', 'upsert', cleanChan, { values: row });
      } catch (firstError) {
        error = firstError;
        // Keep releases compatible until the optional stats migration has been applied.
        const legacyRow = { ...row };
        delete legacyRow.tobacco_items;
        delete legacyRow.electric_device;
        delete legacyRow.is_electric;
        try {
          data = await this.secureDb('shisha_sessions', 'upsert', cleanChan, { values: legacyRow });
          error = null;
        } catch (legacyError) {
          error = legacyError;
        }
      }
      if (error) throw error;
      return {
        success: true,
        session: data && data[0] ? data[0] : row
      };
    } catch(err) {
      console.error('Supabase saveShishaSession error:', err.message);
      return {
        success: false,
        session,
        error: err.message || 'Unbekannter Datenbankfehler'
      };
    }
  }

  async deleteShishaSession(id, channel = 'marved') {
    try {
      await this.secureDb('shisha_sessions', 'delete', channel, { filters: { id } });
      return true;
    } catch(err) {
      console.error('Supabase deleteShishaSession error:', err.message);
      return false;
    }
  }

  async getActiveTimerState(channel = 'marved') {
    try {
      const cleanChan = channel.toLowerCase().replace('#', '');
      const { data, error } = await this.client
        .from('qna_settings')
        .select('timer_state')
        .eq('channel', cleanChan)
        .maybeSingle();
      if (error) throw error;
      return data && data.timer_state ? data.timer_state : null;
    } catch(err) {
      return null;
    }
  }

  async saveActiveTimerState(channel = 'marved', timerState) {
    try {
      const cleanChan = channel.toLowerCase().replace('#', '');
      await this.secureDb('qna_settings', 'upsert', cleanChan, { values: {
          channel: cleanChan,
          timer_state: timerState,
          updated_at: new Date().toISOString()
        }, onConflict: 'channel' });
      return true;
    } catch(err) {
      return false;
    }
  }
}

module.exports = new SupabaseService();
