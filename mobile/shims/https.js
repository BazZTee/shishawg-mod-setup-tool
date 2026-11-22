'use strict';
// Node https.request on top of fetch. With CapacitorHttp enabled, fetch runs
// natively on Android, so CORS does not apply.
const { EventEmitter } = require('events');
const { Buffer } = require('buffer');

const DROPPED_HEADERS = new Set(['content-length', 'host', 'connection']);

function request(input, options, callback) {
  if (typeof options === 'function') { callback = options; options = {}; }
  let opts;
  if (typeof input === 'string' || input instanceof URL) {
    const u = new URL(String(input));
    opts = { protocol: u.protocol, hostname: u.hostname, port: u.port, path: u.pathname + u.search, ...options };
  } else {
    opts = { ...input, ...options };
  }
  const req = new EventEmitter();
  const chunks = [];
  const controller = new AbortController();
  let timer = null;
  let done = false;

  const fail = (error) => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    req.emit('error', error);
  };

  req.write = (chunk) => { if (chunk != null) chunks.push(chunk); return true; };
  req.setTimeout = (ms, cb) => {
    clearTimeout(timer);
    timer = setTimeout(() => { if (cb) cb(); else req.destroy(new Error('Zeitüberschreitung')); }, ms);
    return req;
  };
  req.destroy = (error) => {
    controller.abort();
    fail(error || new Error('Anfrage abgebrochen'));
    return req;
  };
  req.abort = () => req.destroy();
  req.end = (chunk) => {
    if (chunk != null) chunks.push(chunk);
    const protocol = opts.protocol || 'https:';
    const host = opts.hostname || opts.host || 'localhost';
    const port = opts.port ? `:${opts.port}` : '';
    const headers = {};
    for (const [k, v] of Object.entries(opts.headers || {})) {
      if (!DROPPED_HEADERS.has(k.toLowerCase())) headers[k] = String(v);
    }
    let body;
    if (chunks.length) {
      body = chunks.every(c => typeof c === 'string')
        ? chunks.join('')
        : Buffer.concat(chunks.map(c => (typeof c === 'string' ? Buffer.from(c) : Buffer.from(c))));
    }
    fetch(`${protocol}//${host}${port}${opts.path || '/'}`, {
      method: opts.method || 'GET',
      headers,
      body,
      signal: controller.signal
    }).then(async (response) => {
      const text = await response.text();
      if (done) return;
      done = true;
      clearTimeout(timer);
      const res = new EventEmitter();
      res.statusCode = response.status;
      res.statusMessage = response.statusText;
      res.headers = {};
      response.headers.forEach((value, key) => { res.headers[key] = value; });
      res.setEncoding = () => res;
      res.resume = () => res;
      if (callback) callback(res);
      req.emit('response', res);
      setTimeout(() => {
        if (text) res.emit('data', text);
        res.emit('end');
      }, 0);
    }).catch(fail);
    return req;
  };
  return req;
}

function get(input, options, callback) {
  const req = request(input, options, callback);
  req.end();
  return req;
}

module.exports = { request, get, Agent: class Agent {} };
