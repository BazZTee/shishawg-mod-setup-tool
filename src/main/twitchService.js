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
            }
          }
        } catch(e) {}

        this.user = {
          login: valData.login,
          display_name: valData.login,
          id: valData.user_id,
          profile_image_url: profileImage
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

        if (!hasSentCommand && (msg.includes('376') || msg.includes('JOIN'))) {
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
            const text = match[2].trim();

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

  sendToRenderer(channel, payload) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, payload);
    }
  }
}

module.exports = TwitchService;
