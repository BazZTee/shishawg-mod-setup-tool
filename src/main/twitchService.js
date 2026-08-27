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
    this.clientId = store.get('twitch_client_id', 'kimne78kx3ncx6brogo4mv6wki5h1ko'); // Standard Twitch Web Client ID fallback
    this.accessToken = store.get('twitch_access_token', '');
    this.user = store.get('twitch_user', null);
    this.targetChannel = store.get('target_channel', 'marft');
    this.isConnectedToChat = false;
  }

  setTargetChannel(channel) {
    if (!channel) return;
    this.targetChannel = channel.toLowerCase().replace('#', '').trim();
    this.store.set('target_channel', this.targetChannel);
  }

  async validateToken(token = this.accessToken) {
    if (!token) return null;
    try {
      const response = await fetch('https://api.twitch.tv/helix/users', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Client-Id': this.clientId
        }
      });

      if (!response.ok) {
        // Try fallback with id.twitch.tv/oauth2/validate
        const valResp = await fetch('https://id.twitch.tv/oauth2/validate', {
          headers: { 'Authorization': `OAuth ${token}` }
        });
        if (valResp.ok) {
          const valData = await valResp.json();
          this.user = {
            login: valData.login,
            display_name: valData.login,
            id: valData.user_id,
            profile_image_url: ''
          };
          this.accessToken = token;
          this.store.set('twitch_access_token', token);
          this.store.set('twitch_user', this.user);
          return this.user;
        }
        return null;
      }

      const data = await response.json();
      if (data.data && data.data.length > 0) {
        this.user = data.data[0];
        this.accessToken = token;
        this.store.set('twitch_access_token', token);
        this.store.set('twitch_user', this.user);
        return this.user;
      }
    } catch (err) {
      console.error('Twitch token validation error:', err);
    }
    return null;
  }

  startAuthServer() {
    return new Promise((resolve, reject) => {
      if (this.authServer) {
        try { this.authServer.close(); } catch(e){}
      }

      const port = 17525;
      const redirectUri = `http://localhost:${port}/auth`;

      this.authServer = http.createServer(async (req, res) => {
        const reqUrl = url.parse(req.url, true);

        if (reqUrl.pathname === '/auth') {
          // Serve HTML page that extracts hash fragment and posts to /token
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
                      setTimeout(() => window.close(), 1500);
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

        if (msg.includes(`:${this.user.login.toLowerCase()}!`) || msg.includes('376') || msg.includes('JOIN')) {
          // Send message
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

  sendToRenderer(channel, payload) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, payload);
    }
  }
}

module.exports = TwitchService;
