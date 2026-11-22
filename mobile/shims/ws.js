'use strict';
// Browser WebSocket with the subset of the Node "ws" event API used by the
// desktop services. Supabase realtime uses the browser API on the same class.
const NativeWebSocket = globalThis.WebSocket;

class WebSocket extends NativeWebSocket {
  on(event, handler) {
    const listener = (e) => {
      if (event === 'message') handler(e.data);
      else if (event === 'close') handler(e.code, e.reason);
      else if (event === 'error') handler(e.error || new Error('WebSocket-Verbindungsfehler'));
      else handler();
    };
    (this._swgListeners ||= []).push({ event, handler, listener });
    this.addEventListener(event, listener);
    return this;
  }
  once(event, handler) {
    const wrapped = (...args) => { this.off(event, wrapped); handler(...args); };
    return this.on(event, wrapped);
  }
  off(event, handler) {
    const list = this._swgListeners || [];
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i].event === event && list[i].handler === handler) {
        this.removeEventListener(event, list[i].listener);
        list.splice(i, 1);
      }
    }
    return this;
  }
  removeListener(event, handler) { return this.off(event, handler); }
  removeAllListeners() {
    for (const item of this._swgListeners || []) this.removeEventListener(item.event, item.listener);
    this._swgListeners = [];
    return this;
  }
  terminate() { this.close(); }
  ping() {}
}

module.exports = WebSocket;
module.exports.WebSocket = WebSocket;
module.exports.default = WebSocket;
