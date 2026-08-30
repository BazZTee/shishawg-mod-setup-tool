const http = require('http');
const url = require('url');
const WebSocket = require('ws');
const { shell } = require('electron');

class TwitchService {
  constructor(mainWindow, store) {
    this.mainWindow = mainWindow;
    this.store = store;
    this.authServer = null;
    this.ws = null;
    // Official ShishaWG Mod Setup Tool Twitch Client ID
    this.clientId = '440sjk1dkut7ltxkf7b3p267dekbpu'; 
    const savedCid = store.get('twitch_client_id', '');
    if (savedCid && savedCid.length > 5) {
      this.clientId = savedCid;
    } else {
      store.set('twitch_client_id', this.clientId);
    }
    this.accessToken = store.get('twitch_access_token', '');
    this.user = store.get('twitch_user', null);
    this.targetChannel = store.get('target_channel', 'marved');
  }

  setClientId(clientId) {
    if (clientId) {
      this.clientId = clientId.trim();
      this.store.set('twitch_client_id', this.clientId);
    }
  }

  setTargetChannel(channel) {
    if (!channel) return;
    this.targetChannel = channel.toLowerCase().replace('#', '').trim();
    this.store.set('target_channel', this.targetChannel);
  }

  async validateToken(tokenInput = this.accessToken) {
    if (!tokenInput) return null;

    const cleanToken = tokenInput.replace(/^oauth:/i, '').trim();

    try {
      const valResp = await fetch('https://id.twitch.tv/oauth2/validate', {
        headers: { 'Authorization': `OAuth ${cleanToken}` }
      });

      if (valResp.ok) {
        const valData = await valResp.json();
        
        let profileImage = '';
        let displayName = valData.login;
        try {
          const userResp = await fetch(`https://api.twitch.tv/helix/users?id=${valData.user_id}`, {
            headers: {
              'Authorization': `Bearer ${cleanToken}`,
              'Client-Id': valData.client_id || this.clientId
            }
          });
          if (userResp.ok) {
            const uData = await userResp.json();
            if (uData.data && uData.data.length > 0) {
              profileImage = uData.data[0].profile_image_url;
              displayName = uData.data[0].display_name || valData.login;
            }
          }
        } catch(e) {}

        let chatColor = '';
        try {
          const colorResp = await fetch(`https://api.twitch.tv/helix/chat/color?user_id=${valData.user_id}`, {
            headers: {
              'Authorization': `Bearer ${cleanToken}`,
              'Client-Id': valData.client_id || this.clientId
            }
          });
          if (colorResp.ok) {
            const cData = await colorResp.json();
            if (cData.data && cData.data.length > 0 && cData.data[0].color) {
              chatColor = cData.data[0].color;
            }
          }
        } catch(e) {}

        this.user = {
          login: valData.login,
          display_name: displayName,
          id: valData.user_id,
          profile_image_url: profileImage,
          color: chatColor
        };
        this.accessToken = cleanToken;
        if (valData.client_id) {
          this.clientId = valData.client_id;
          this.store.set('twitch_client_id', this.clientId);
        }
        this.store.set('twitch_access_token', cleanToken);
        this.store.set('twitch_user', this.user);
        return this.user;
      }
    } catch (err) {
      console.error('Twitch token validation error:', err);
    }
    return null;
  }

  parseIrcColor(msg) {
    if (!msg) return null;
    const m = msg.match(/color=(#[0-9A-Fa-f]{6})/);
    if (m && m[1]) {
      const color = m[1];
      if (this.user && this.user.color !== color) {
        this.user.color = color;
        this.store.set('twitch_user', this.user);
        this.sendToRenderer('twitch:color-updated', { color });
      }
      return color;
    }
    return null;
  }

  async fetchUserChatColor() {
    if (!this.accessToken || !this.user || !this.user.id) return null;
    try {
      const res = await fetch(`https://api.twitch.tv/helix/chat/color?user_id=${this.user.id}`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Client-Id': this.clientId
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.data && data.data.length > 0 && data.data[0].color) {
          this.user.color = data.data[0].color;
          this.store.set('twitch_user', this.user);
          this.sendToRenderer('twitch:color-updated', { color: this.user.color });
          return this.user.color;
        }
      }
    } catch(e) {}
    return this.user ? this.user.color : null;
  }

  startAuthServer(customClientId = null) {
    if (customClientId) {
      this.setClientId(customClientId);
    }

    return new Promise((resolve, reject) => {
      if (this.authServer) {
        try { this.authServer.close(); } catch(e){}
      }

      const port = 17525;
      const redirectUri = `http://localhost:${port}/auth`;

      this.authServer = http.createServer(async (req, res) => {
        const reqUrl = url.parse(req.url, true);

        if (reqUrl.pathname === '/auth') {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>ShishaWG Mod Tool - Twitch Login</title>
              <style>
                body { font-family: 'Segoe UI', sans-serif; background: #0f172a; color: #f8fafc; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                .card { background: #1e293b; padding: 40px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); text-align: center; border: 1px solid #334155; }
                h2 { color: #38bdf8; margin-top: 0; }
                .loader { border: 4px solid #334155; border-top: 4px solid #0099ff; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 20px auto; }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
              </style>
            </head>
            <body>
              <div class="card">
                <h2>ShishaWG Mod Setup Tool</h2>
                <p id="msg">Twitch-Anmeldung wird verarbeitet...</p>
                <div class="loader" id="loader"></div>
              </div>
              <script>
                const hash = window.location.hash.substring(1);
                const params = new URLSearchParams(hash);
                const token = params.get('access_token');
                if (token) {
                  fetch('/token?token=' + token)
                    .then(r => r.json())
                    .then(d => {
                      document.getElementById('msg').innerText = 'Erfolgreich angemeldet! Du kannst dieses Fenster jetzt schließen.';
                      document.getElementById('loader').style.display = 'none';
                      setTimeout(() => window.close(), 1200);
                    });
                } else {
                  document.getElementById('msg').innerText = 'Fehler bei der Anmeldung. Bitte erneut versuchen.';
                  document.getElementById('loader').style.display = 'none';
                }
              </script>
            </body>
            </html>
          `);
        } else if (reqUrl.pathname === '/token') {
          const token = reqUrl.query.token;
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));

          if (token) {
            const user = await this.validateToken(token);
            if (user) {
              this.sendToRenderer('twitch:authenticated', { user, token });
            }
          }
          if (this.authServer) {
            setTimeout(() => {
              this.authServer.close();
              this.authServer = null;
            }, 1000);
          }
        }
      });

      this.authServer.listen(port, () => {
        const scopes = encodeURIComponent('chat:read chat:edit channel:moderate moderation:read user:read:email');
        const authUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${this.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${scopes}`;
        shell.openExternal(authUrl);
        resolve(authUrl);
      });

      this.authServer.on('error', (err) => {
        reject(err);
      });
    });
  }

  logout() {
    this.accessToken = '';
    this.user = null;
    this.store.delete('twitch_access_token');
    this.store.delete('twitch_user');
    if (this.ws) {
      try { this.ws.close(); } catch(e){}
      this.ws = null;
    }
    this.sendToRenderer('twitch:logout', {});
  }

  async checkStreamStatus(channel = this.targetChannel) {
    const chan = (channel || 'marved').toLowerCase().replace('#', '').trim();
    if (!this.accessToken || !this.clientId) {
      return { success: false, channel: chan, live: false, message: 'Nicht mit Twitch verbunden' };
    }
    try {
      const res = await fetch(`https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(chan)}`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Client-Id': this.clientId
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.data && data.data.length > 0) {
          const stream = data.data[0];
          return {
            success: true,
            channel: chan,
            live: true,
            viewer_count: stream.viewer_count,
            title: stream.title,
            game_name: stream.game_name,
            started_at: stream.started_at
          };
        } else {
          return {
            success: true,
            channel: chan,
            live: false
          };
        }
      }
    } catch (err) {
      console.error('Check stream status error:', err);
    }
    return { success: false, channel: chan, live: false };
  }

  async getBroadcasterId(channelName = this.targetChannel) {
    const cleanName = (channelName || 'marved').toLowerCase().replace('#', '').trim();
    if (!this.accessToken || !this.clientId) return null;
    try {
      const res = await fetch(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(cleanName)}`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Client-Id': this.clientId
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.data && data.data.length > 0) {
          return data.data[0].id;
        }
      }
    } catch(e) {
      console.error('Error fetching broadcaster ID:', e);
    }
    return null;
  }

  async getUserInfo(login) {
    if (!login) return null;
    const cleanName = login.toLowerCase().replace('#', '').trim();
    if (!this.accessToken || !this.clientId) return null;
    try {
      const res = await fetch(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(cleanName)}`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Client-Id': this.clientId
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.data && data.data.length > 0) {
          return data.data[0];
        }
      }
    } catch(e) {
      console.error('Error fetching user info for', cleanName, e);
    }
    return null;
  }

  async getChannelInformation(channel = this.targetChannel) {
    const cleanName = (channel || 'marved').toLowerCase().replace('#', '').trim();
    const broadcasterId = await this.getBroadcasterId(cleanName);
    if (!broadcasterId) return { success: false, error: 'Kanal nicht gefunden' };

    try {
      const res = await fetch(`https://api.twitch.tv/helix/channels?broadcaster_id=${broadcasterId}`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Client-Id': this.clientId
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.data && data.data.length > 0) {
          const info = data.data[0];
          return {
            success: true,
            broadcaster_id: info.broadcaster_id,
            broadcaster_name: info.broadcaster_name,
            game_name: info.game_name,
            game_id: info.game_id,
            title: info.title,
            tags: info.tags || []
          };
        }
      }
    } catch(e) {
      console.error('Error fetching channel information:', e);
    }
    return { success: false, error: 'Konnte Kanalinformationen nicht laden' };
  }

  async searchCategories(query) {
    if (!query || query.trim().length < 2) return [];
    if (!this.accessToken || !this.clientId) return [];
    try {
      const res = await fetch(`https://api.twitch.tv/helix/search/categories?query=${encodeURIComponent(query.trim())}`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Client-Id': this.clientId
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.data) {
          return data.data.map(cat => ({
            id: cat.id,
            name: cat.name,
            box_art_url: (cat.box_art_url || '').replace('{width}', '100').replace('{height}', '133')
          }));
        }
      }
    } catch(e) {
      console.error('Error searching categories:', e);
    }
    return [];
  }

  async searchChannels(query) {
    if (!query || query.trim().length < 2) return [];
    if (!this.accessToken || !this.clientId) return [];
    try {
      const res = await fetch(`https://api.twitch.tv/helix/search/channels?query=${encodeURIComponent(query.trim())}`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Client-Id': this.clientId
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.data) {
          return data.data.map(ch => ({
            id: ch.id,
            display_name: ch.display_name,
            broadcaster_login: ch.broadcaster_login,
            game_name: ch.game_name,
            is_live: ch.is_live,
            thumbnail_url: ch.thumbnail_url || '',
            title: ch.title || ''
          }));
        }
      }
    } catch(e) {
      console.error('Error searching channels:', e);
    }
    return [];
  }

  async createClip(channel = this.targetChannel) {
    const cleanName = (channel || 'marved').toLowerCase().replace('#', '').trim();
    const broadcasterId = await this.getBroadcasterId(cleanName);
    if (!broadcasterId) throw new Error('Kanal nicht gefunden.');

    const res = await fetch(`https://api.twitch.tv/helix/clips?broadcaster_id=${broadcasterId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Client-Id': this.clientId
      }
    });

    if (res.ok) {
      const data = await res.json();
      if (data.data && data.data.length > 0) {
        const clip = data.data[0];
        return {
          success: true,
          clip_id: clip.id,
          edit_url: clip.edit_url,
          clip_url: `https://clips.twitch.tv/${clip.id}`
        };
      }
    }
    const errText = await res.text();
    throw new Error(`Clip konnte nicht erstellt werden (${res.status}): ${errText}`);
  }

  async setStreamTitle(title, channel = this.targetChannel) {
    const cleanTitle = (title || '').trim();
    if (!cleanTitle) throw new Error('Bitte gib einen Streamtitel ein.');
    
    // Send bot chat command !settitle
    await this.sendChatMessage(`!settitle ${cleanTitle}`, channel);
    return { success: true, title: cleanTitle };
  }

  async setStreamGame(gameName, channel = this.targetChannel) {
    const cleanGame = (gameName || '').trim();
    if (!cleanGame) throw new Error('Bitte wähle eine Spiel-Kategorie.');

    // Send bot chat command !setgame
    await this.sendChatMessage(`!setgame ${cleanGame}`, channel);
    return { success: true, game: cleanGame };
  }

  async startRaid(targetUser, channel = this.targetChannel) {
    const cleanTarget = (targetUser || '').toLowerCase().replace('@', '').replace('#', '').trim();
    if (!cleanTarget) throw new Error('Bitte wähle einen Zielkanal für den Raid.');
    await this.sendChatMessage(`/raid ${cleanTarget}`, channel);
    return { success: true, target: cleanTarget };
  }

  async cancelRaid(channel = this.targetChannel) {
    await this.sendChatMessage('/unraid', channel);
    return { success: true };
  }

  async createStreamMarker(description = '', channel = this.targetChannel) {
    const cleanName = (channel || 'marved').toLowerCase().replace('#', '').trim();
    const broadcasterId = await this.getBroadcasterId(cleanName);
    if (!broadcasterId) throw new Error('Kanal nicht gefunden.');

    const res = await fetch('https://api.twitch.tv/helix/streams/markers', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Client-Id': this.clientId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: broadcasterId,
        description: (description || 'Marker').substring(0, 140)
      })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.data && data.data.length > 0) {
        const marker = data.data[0];
        return {
          success: true,
          id: marker.id,
          created_at: marker.created_at,
          description: marker.description,
          position_seconds: marker.position_seconds || 0
        };
      }
    }

    const errText = await res.text();
    throw new Error(`Twitch-Marker konnte nicht gesetzt werden: ${errText || res.statusText}`);
  }

  async getChatters(channel = this.targetChannel) {
    const cleanName = (channel || 'marved').toLowerCase().replace('#', '').trim();
    const broadcasterId = await this.getBroadcasterId(cleanName);
    if (!broadcasterId || !this.user) return { total: 0, chatters: [] };

    try {
      const res = await fetch(`https://api.twitch.tv/helix/chat/chatters?broadcaster_id=${broadcasterId}&moderator_id=${this.user.id}&first=100`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Client-Id': this.clientId
        }
      });
      if (res.ok) {
        const data = await res.json();
        return {
          total: data.total || 0,
          chatters: (data.data || []).map(c => ({
            id: c.user_id,
            login: c.user_login,
            name: c.user_name
          }))
        };
      }
    } catch(e) {
      console.error('Error fetching chatters:', e);
    }
    return { total: 0, chatters: [] };
  }

  async sendChatMessage(message, channel = this.targetChannel) {
    if (!this.accessToken || !this.user) {
      throw new Error('Nicht mit Twitch verbunden. Bitte erst einloggen.');
    }

    const chan = (channel || 'marft').toLowerCase().replace('#', '').trim();

    return new Promise((resolve, reject) => {
      let resolved = false;
      let hasSentCommand = false;
      const ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          try { ws.close(); } catch(e){}
          reject(new Error('Zeitüberschreitung bei Verbindung zum Twitch Chat'));
        }
      }, 10000);

      ws.on('open', () => {
        ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
        ws.send(`PASS oauth:${this.accessToken}`);
        ws.send(`NICK ${this.user.login.toLowerCase()}`);
        ws.send(`JOIN #${chan}`);
      });

      ws.on('message', (data) => {
        const msg = data.toString();

        if (msg.startsWith('PING')) {
          ws.send('PONG :tmi.twitch.tv');
        }

        this.parseIrcColor(msg);

        if (!hasSentCommand && (msg.includes('376') || msg.includes('JOIN') || msg.includes('USERSTATE'))) {
          hasSentCommand = true;
          ws.send(`PRIVMSG #${chan} :${message}`);
          setTimeout(() => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              try { ws.close(); } catch(e){}
              resolve({ success: true, channel: chan, message });
            }
          }, 800);
        }
      });

      ws.on('error', (err) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          reject(err);
        }
      });
    });
  }

  async fetchSetupFromChat(channel = this.targetChannel) {
    if (!this.accessToken || !this.user) {
      throw new Error('Nicht mit Twitch verbunden. Bitte erst einloggen.');
    }

    const chan = (channel || 'marft').toLowerCase().replace('#', '').trim();

    return new Promise((resolve, reject) => {
      let resolved = false;
      let hasSentSetup = false;
      const ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          try { ws.close(); } catch(e){}
          reject(new Error('Keine Antwort von bot/marvedbot im Chat innerhalb von 10 Sekunden erhalten.'));
        }
      }, 10000);

      ws.on('open', () => {
        ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
        ws.send(`PASS oauth:${this.accessToken}`);
        ws.send(`NICK ${this.user.login.toLowerCase()}`);
        ws.send(`JOIN #${chan}`);
      });

      ws.on('message', (data) => {
        const raw = data.toString();

        if (raw.startsWith('PING')) {
          ws.send('PONG :tmi.twitch.tv');
        }

        // Once joined, send !setup EXACTLY ONCE to trigger bot response
        if (!hasSentSetup && (raw.includes('376') || raw.includes('JOIN'))) {
          hasSentSetup = true;
          ws.send(`PRIVMSG #${chan} :!setup`);
        }

        // Check for IRC PRIVMSG containing setup pattern (containing // or from marvedbot)
        if (raw.includes('PRIVMSG')) {
          const match = raw.match(/:([^!]+)![^@]+@[^\s]+\s+PRIVMSG\s+#\w+\s+:(.+)/);
          if (match) {
            const author = match[1].toLowerCase();
            let text = match[2].replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim();
            text = text.replace(/^ACTION\s+/i, '').trim();

            // Ignore our own !setup request
            if (text === '!setup' && author === this.user.login.toLowerCase()) {
              return;
            }

            // Check if message is a setup response (contains // or contains name/tobacco)
            if (text.includes('//') || author.includes('marvedbot') || author.includes('bot')) {
              if (!resolved) {
                resolved = true;
                clearTimeout(timeout);
                try { ws.close(); } catch(e){}
                resolve({ success: true, author: match[1], text });
              }
            }
          }
        }
      });

      ws.on('error', (err) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          reject(err);
        }
      });
    });
  }

  startGiveawayListener(keyword, channel = this.targetChannel) {
    this.stopGiveawayListener();

    const chan = (channel || this.targetChannel || 'marved').toLowerCase().replace('#', '').trim();
    const cleanKeyword = (keyword || '!join').toLowerCase().trim();

    try {
      this.giveawayWs = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
      this.giveawayKeyword = cleanKeyword;
      this.giveawayParticipants = new Map();

      this.giveawayWs.on('open', () => {
        this.giveawayWs.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
        const nick = `justinfan${Math.floor(10000 + Math.random() * 89999)}`;
        this.giveawayWs.send(`NICK ${nick}`);
        this.giveawayWs.send(`JOIN #${chan}`);
      });

      this.giveawayWs.on('message', (data) => {
        const rawLines = data.toString().split(/\r\n|\r|\n/);
        for (const line of rawLines) {
          const raw = line.trim();
          if (!raw) continue;

          if (raw.startsWith('PING')) {
            if (this.giveawayWs && this.giveawayWs.readyState === WebSocket.OPEN) {
              this.giveawayWs.send('PONG :tmi.twitch.tv');
            }
            continue;
          }

          if (raw.includes('PRIVMSG')) {
            let tags = {};
            let rest = raw;

            if (rest.startsWith('@')) {
              const spaceIdx = rest.indexOf(' ');
              if (spaceIdx > 0) {
                const tagStr = rest.substring(1, spaceIdx);
                rest = rest.substring(spaceIdx + 1);
                tagStr.split(';').forEach(kv => {
                  const eqIdx = kv.indexOf('=');
                  if (eqIdx > 0) {
                    tags[kv.substring(0, eqIdx)] = kv.substring(eqIdx + 1);
                  }
                });
              }
            }

            const privIdx = rest.indexOf(' PRIVMSG ');
            if (privIdx > 0) {
              let senderPart = rest.substring(0, privIdx);
              if (senderPart.startsWith(':')) senderPart = senderPart.substring(1);
              const exclIdx = senderPart.indexOf('!');
              const login = (exclIdx > 0 ? senderPart.substring(0, exclIdx) : senderPart).toLowerCase().trim();

              const colonIdx = rest.indexOf(' :', privIdx);
              if (colonIdx > 0 && login) {
                const text = rest.substring(colonIdx + 2).replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim().toLowerCase();
                const kw = this.giveawayKeyword;

                if (text === kw || text.startsWith(kw + ' ') || text.includes(kw)) {
                  const displayName = tags['display-name'] || login;
                  const color = tags['color'] || '#00f0ff';
                  const badges = tags['badges'] || '';
                  const isMod = tags['mod'] === '1' || badges.includes('moderator') || badges.includes('broadcaster');
                  const isSub = tags['subscriber'] === '1' || badges.includes('subscriber') || badges.includes('founder');

                  const participant = {
                    login,
                    displayName,
                    color,
                    isMod,
                    isSub,
                    timestamp: Date.now()
                  };

                  this.giveawayParticipants.set(login, participant);
                  this.sendToRenderer('giveaway:new-participant', participant);
                }
              }
            }
          }
        }
      });

      this.giveawayWs.on('error', () => {});
      return { success: true, keyword: cleanKeyword, channel: chan };
    } catch(e) {
      return { success: false, error: e.message };
    }
  }

  stopGiveawayListener() {
    if (this.giveawayWs) {
      try {
        this.giveawayWs.close();
      } catch(e) {}
      this.giveawayWs = null;
    }
    return { success: true };
  }

  sendToRenderer(channel, payload) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, payload);
    }
  }
}

module.exports = TwitchService;
