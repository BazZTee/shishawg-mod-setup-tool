const WebSocket = require('ws');
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = WebSocket;
}
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://gdaprclycouoxtffcuxb.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkYXByY2x5Y291b3h0ZmZjdXhiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODE3NjE2MywiZXhwIjoyMTAzNzUyMTYzfQ.MbwS0KXB78PjWq1dHxhrUyxQBPQEW1x9eeydTZC3Bg8';

class SupabaseService {
  constructor() {
    this.client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false },
      realtime: {
        websocket: WebSocket,
        params: { eventsPerSecond: 20 }
      }
    });
    this.mainWindow = null;
    this.channelSubscriptions = [];
  }

  setMainWindow(win) {
    this.mainWindow = win;
  }

  // --- Realtime WebSocket Subscriptions for Electron ---
  initRealtimeListeners() {
    try {
      const qnaChannel = this.client
        .channel('db-qna-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'qna_questions' }, (payload) => {
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('supabase:qna-changed', payload);
          }
        })
        .subscribe();

      const setupChannel = this.client
        .channel('db-setup-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'stream_setups' }, (payload) => {
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('supabase:setup-changed', payload);
          }
        })
        .subscribe();

      const chatChannel = this.client
        .channel('db-chat-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'mod_chat' }, (payload) => {
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('supabase:chat-changed', payload);
          }
        })
        .subscribe();

      const bestrafungenChannel = this.client
        .channel('db-bestrafungen-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bestrafungen' }, (payload) => {
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('supabase:bestrafungen-changed', payload);
          }
        })
        .subscribe();

      const settingsChannel = this.client
        .channel('db-settings-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'qna_settings' }, (payload) => {
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('supabase:settings-changed', payload);
          }
        })
        .subscribe();

      this.channelSubscriptions.push(qnaChannel, setupChannel, chatChannel, bestrafungenChannel, settingsChannel);
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

      const { data, error } = await this.client
        .from('qna_questions')
        .upsert(row, { onConflict: 'id' })
        .select();

      if (error) throw error;
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

      const { data, error } = await this.client
        .from('qna_questions')
        .upsert(rows, { onConflict: 'id' })
        .select();

      if (error) throw error;
      return data;
    } catch(err) {
      console.error('Supabase saveAllQnAQuestions error:', err.message);
      return [];
    }
  }

  async setQnAStatus(questionId, status) {
    try {
      const { data, error } = await this.client
        .from('qna_questions')
        .update({
          status: status,
          updated_at: new Date().toISOString()
        })
        .eq('id', questionId)
        .select();

      if (error) throw error;
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
      await this.client
        .from('qna_questions')
        .update({ status: 'approved', updated_at: new Date().toISOString() })
        .eq('channel', cleanChan)
        .eq('status', 'on_air');

      // 2. If a new question is to be set on_air
      if (questionObj && questionObj.id) {
        await this.client
          .from('qna_questions')
          .update({ status: 'on_air', updated_at: new Date().toISOString() })
          .eq('id', questionObj.id);
      }
      return questionObj;
    } catch(err) {
      console.error('Supabase setActiveQnAQuestion error:', err.message);
      return questionObj;
    }
  }

  async deleteQnAQuestion(questionId) {
    try {
      const { error } = await this.client
        .from('qna_questions')
        .delete()
        .eq('id', questionId);

      if (error) throw error;
      return true;
    } catch(err) {
      console.error('Supabase deleteQnAQuestion error:', err.message);
      return false;
    }
  }

  async deleteAllQnAQuestions(channel = 'marved') {
    try {
      const cleanChan = channel.toLowerCase().replace('#', '');
      const { error } = await this.client
        .from('qna_questions')
        .delete()
        .eq('channel', cleanChan);

      if (error) throw error;
      return true;
    } catch(err) {
      console.error('Supabase deleteAllQnAQuestions error:', err.message);
      return false;
    }
  }

  async deleteAnsweredQnAQuestions(channel = 'marved') {
    try {
      const cleanChan = channel.toLowerCase().replace('#', '');
      const { error } = await this.client
        .from('qna_questions')
        .delete()
        .eq('channel', cleanChan)
        .eq('status', 'answered');

      if (error) throw error;
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
      const { data, error } = await this.client
        .from('stream_setups')
        .upsert({
          channel: cleanChan,
          setup_data: setupData,
          updated_at: new Date().toISOString()
        }, { onConflict: 'channel' })
        .select();

      if (error) throw error;
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
      await this.client
        .from('shishawg_catalog')
        .upsert({
          category,
          items: Array.isArray(items) ? items : [],
          updated_at: new Date().toISOString()
        }, { onConflict: 'category' });
    } catch(err) {
      console.error('Supabase saveCatalogCategory error:', err.message);
    }
  }

  // --- Mod Watchlist CRUD ---
  async getWatchlist(channel = 'marved') {
    try {
      const cleanChan = (channel || 'marved').toLowerCase().replace('#', '');
      let query = this.client
        .from('mod_watchlist')
        .select('*');
      
      // Attempt to filter by channel if supported
      try {
        query = query.or(`channel.eq.${cleanChan},channel.is.null`);
      } catch(e) {}

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(r => ({
        id: r.id,
        channel: r.channel || cleanChan,
        username: r.username,
        addedBy: r.added_by,
        reason: r.reason,
        timestamp: new Date(r.created_at).getTime()
      }));
    } catch(err) {
      console.error('Supabase getWatchlist error:', err.message);
      return [];
    }
  }

  async addToWatchlist(item, channel = 'marved') {
    try {
      const cleanChan = (channel || item.channel || 'marved').toLowerCase().replace('#', '');
      await this.client
        .from('mod_watchlist')
        .upsert({
          id: item.id || ('wl_' + Date.now()),
          channel: cleanChan,
          username: item.username,
          added_by: item.addedBy || 'Mod',
          reason: item.reason || '',
          created_at: new Date(item.timestamp || Date.now()).toISOString()
        }, { onConflict: 'id' });
    } catch(err) {
      console.error('Supabase addToWatchlist error:', err.message);
    }
  }

  async removeFromWatchlist(id) {
    try {
      await this.client
        .from('mod_watchlist')
        .delete()
        .eq('id', id);
    } catch(err) {
      console.error('Supabase removeFromWatchlist error:', err.message);
    }
  }

  // --- Telegram Config CRUD ---
  async getTelegramConfig(channel = 'marved') {
    try {
      const cleanChan = (channel || 'marved').toLowerCase().replace('#', '');
      const { data, error } = await this.client
        .from('telegram_config')
        .select('*')
        .in('id', [cleanChan, 'default'])
        .order('id', { ascending: true }) // custom channel first or fallback
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ? { botToken: data.bot_token, chatId: data.chat_id, claimUrl: data.claim_url } : null;
    } catch(err) {
      console.error('Supabase getTelegramConfig error:', err.message);
      return null;
    }
  }

  async saveTelegramConfig(config, channel = 'marved') {
    try {
      const cleanChan = (channel || config.channel || 'marved').toLowerCase().replace('#', '');
      await this.client
        .from('telegram_config')
        .upsert({
          id: cleanChan,
          bot_token: config.botToken || '',
          chat_id: config.chatId || '',
          claim_url: config.claimUrl || '',
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });
    } catch(err) {
      console.error('Supabase saveTelegramConfig error:', err.message);
    }
  }

  // --- Mod Chat CRUD ---
  async getModChat(channel = 'marved') {
    try {
      const cleanChan = (channel || 'marved').toLowerCase().replace('#', '');
      let query = this.client
        .from('mod_chat')
        .select('*');

      try {
        query = query.or(`channel.eq.${cleanChan},channel.is.null`);
      } catch(e) {}

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []).reverse().map(r => ({
        id: r.id,
        channel: r.channel || cleanChan,
        sender: r.sender,
        message: r.message,
        color: r.color,
        timestamp: new Date(r.created_at).getTime()
      }));
    } catch(err) {
      console.error('Supabase getModChat error:', err.message);
      return [];
    }
  }

  async sendModChatMessage(msg, channel = 'marved') {
    try {
      const cleanChan = (channel || msg.channel || 'marved').toLowerCase().replace('#', '');
      await this.client
        .from('mod_chat')
        .upsert({
          id: msg.id || ('chat_' + Date.now()),
          channel: cleanChan,
          sender: msg.sender || 'Mod',
          message: msg.message || '',
          color: msg.color || '#00f0ff',
          created_at: new Date(msg.timestamp || Date.now()).toISOString()
        }, { onConflict: 'id' });
    } catch(err) {
      console.error('Supabase sendModChatMessage error:', err.message);
    }
  }

  // --- Giveaway Winners CRUD ---
  async getGiveaways(channel = 'marved') {
    try {
      const cleanChan = (channel || 'marved').toLowerCase().replace('#', '');
      let query = this.client
        .from('giveaway_winners')
        .select('*');

      try {
        query = query.or(`channel.eq.${cleanChan},channel.is.null`);
      } catch(e) {}

      const { data, error } = await query
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(r => ({
        id: r.id,
        channel: r.channel || cleanChan,
        username: r.username,
        displayName: r.display_name,
        prize: r.prize,
        status: r.status,
        address: r.address,
        timestamp: new Date(r.created_at).getTime()
      }));
    } catch(err) {
      console.error('Supabase getGiveaways error:', err.message);
      return [];
    }
  }

  async saveGiveawayWinner(winner, channel = 'marved') {
    try {
      const cleanChan = (channel || winner.channel || 'marved').toLowerCase().replace('#', '');
      await this.client
        .from('giveaway_winners')
        .upsert({
          id: winner.id || ('win_' + Date.now()),
          channel: cleanChan,
          username: winner.username,
          display_name: winner.displayName || winner.username,
          prize: winner.prize || '',
          status: winner.status || 'pending',
          address: winner.address || null,
          created_at: new Date(winner.timestamp || Date.now()).toISOString()
        }, { onConflict: 'id' });
    } catch(err) {
      console.error('Supabase saveGiveawayWinner error:', err.message);
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
  async getBestrafungen() {
    try {
      const { data, error } = await this.client
        .from('bestrafungen')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(r => ({
        id: r.id,
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

  async saveBestrafung(b) {
    try {
      const { data, error } = await this.client
        .from('bestrafungen')
        .upsert({
          id: b.id || ('pen_' + Date.now()),
          name: b.name || '',
          status: b.status || 'offen',
          executed_by: b.executedBy || null,
          created_at: new Date(b.timestamp || Date.now()).toISOString()
        }, { onConflict: 'id' })
        .select();
      if (error) throw error;
      return data;
    } catch(err) {
      console.error('Supabase saveBestrafung error:', err.message);
      return null;
    }
  }

  async updateBestrafungStatus(id, status, executedBy = null) {
    try {
      const payload = { status };
      if (executedBy) payload.executed_by = executedBy;

      const { data, error } = await this.client
        .from('bestrafungen')
        .update(payload)
        .eq('id', id)
        .select();
      if (error) throw error;
      return data;
    } catch(err) {
      console.error('Supabase updateBestrafungStatus error:', err.message);
      return null;
    }
  }

  async deleteBestrafung(id) {
    try {
      const { error } = await this.client
        .from('bestrafungen')
        .delete()
        .eq('id', id);
      if (error) throw error;
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
        .select('*')
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
      const { data, error } = await this.client
        .from('qna_settings')
        .upsert({
          channel: cleanChan,
          persons: settings.persons || ['Marved', 'Hasty', 'Kai'],
          active_person: settings.activePerson || 'Marved',
          wheel_enabled: settings.wheelEnabled !== false,
          display_duration: settings.displayDuration || 10,
          updated_at: new Date().toISOString()
        }, { onConflict: 'channel' })
        .select();
      if (error) throw error;
      return data;
    } catch(err) {
      console.error('Supabase saveQnASettings error:', err.message);
      return settings;
    }
  }

  async getBroadcasterToken(channel = 'marved') {
    try {
      const cleanChan = channel.toLowerCase().replace('#', '');
      const { data, error } = await this.client
        .from('qna_settings')
        .select('broadcaster_token')
        .eq('channel', cleanChan)
        .maybeSingle();
      if (error) throw error;
      return data && data.broadcaster_token ? data.broadcaster_token : null;
    } catch(err) {
      console.error('Supabase getBroadcasterToken error:', err.message);
      return null;
    }
  }

  async saveBroadcasterToken(channel = 'marved', token) {
    try {
      const cleanChan = channel.toLowerCase().replace('#', '');
      const { data, error } = await this.client
        .from('qna_settings')
        .upsert({
          channel: cleanChan,
          broadcaster_token: token,
          updated_at: new Date().toISOString()
        }, { onConflict: 'channel' })
        .select();
      if (error) throw error;
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
      const { data, error } = await this.client
        .from('shisha_sessions')
        .select('*')
        .eq('channel', cleanChan)
        .order('created_at', { ascending: false });
      if (error) throw error;
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
        bowl: session.bowl || '',
        pipe: session.pipe || '',
        hmd: session.hmd || '',
        person: session.person || 'Marvin',
        duration_minutes: session.durationMinutes || 0,
        coal_rotations: session.coalRotations || 0,
        rating: session.rating || 0,
        notes: session.notes || '',
        started_at: session.startedAt ? new Date(session.startedAt).toISOString() : new Date().toISOString(),
        ended_at: session.endedAt ? new Date(session.endedAt).toISOString() : new Date().toISOString(),
        created_at: new Date().toISOString()
      };
      const { data, error } = await this.client
        .from('shisha_sessions')
        .upsert(row)
        .select();
      if (error) throw error;
      return data && data[0] ? data[0] : row;
    } catch(err) {
      console.error('Supabase saveShishaSession error:', err.message);
      return session;
    }
  }

  async deleteShishaSession(id) {
    try {
      const { error } = await this.client
        .from('shisha_sessions')
        .delete()
        .eq('id', id);
      if (error) throw error;
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
      const { error } = await this.client
        .from('qna_settings')
        .upsert({
          channel: cleanChan,
          timer_state: timerState,
          updated_at: new Date().toISOString()
        }, { onConflict: 'channel' });
      if (error) throw error;
      return true;
    } catch(err) {
      return false;
    }
  }
}

module.exports = new SupabaseService();
