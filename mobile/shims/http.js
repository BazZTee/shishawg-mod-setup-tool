'use strict';
// No sockets on Android. Servers are registered by port so the app can hand a
// request to them directly (used for the Twitch login redirect).
const { EventEmitter } = require('events');
const servers = new Map();

class VirtualServer extends EventEmitter {
  constructor(handler) {
    super();
    this.handler = handler;
    this.port = null;
  }
  listen(port, host, callback) {
    if (typeof host === 'function') callback = host;
    this.port = Number(port);
    servers.set(this.port, this);
    setTimeout(() => { this.emit('listening'); if (callback) callback(); }, 0);
    return this;
  }
  close(callback) {
    if (servers.get(this.port) === this) servers.delete(this.port);
    setTimeout(() => { this.emit('close'); if (callback) callback(); }, 0);
    return this;
  }
  address() { return { port: this.port, address: '127.0.0.1' }; }
}

function createServer(options, handler) {
  return new VirtualServer(typeof options === 'function' ? options : handler);
}

function dispatch(port, path, method = 'GET') {
  const server = servers.get(Number(port));
  if (!server || !server.handler) return Promise.resolve(null);
  return new Promise((resolve) => {
    const req = new EventEmitter();
    Object.assign(req, { url: path, method, headers: { host: `localhost:${port}` } });
    const res = {
      statusCode: 200,
      headers: {},
      headersSent: false,
      setHeader(name, value) { this.headers[String(name).toLowerCase()] = value; },
      getHeader(name) { return this.headers[String(name).toLowerCase()]; },
      writeHead(status, headers = {}) {
        this.statusCode = status;
        for (const [k, v] of Object.entries(headers)) this.setHeader(k, v);
        this.headersSent = true;
        return this;
      },
      write(chunk) { this._body = (this._body || '') + chunk; },
      end(chunk = '') { resolve({ status: this.statusCode, headers: this.headers, body: (this._body || '') + chunk }); }
    };
    Promise.resolve(server.handler(req, res)).catch((error) => resolve({ status: 500, headers: {}, body: String(error) }));
    setTimeout(() => req.emit('end'), 0);
  });
}

module.exports = { createServer, Server: VirtualServer, __dispatch: dispatch, __servers: servers };
