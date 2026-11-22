'use strict';
// crypto-browserify covers AES-GCM, hashes and random bytes. scryptSync is
// added with scrypt-js using the Node defaults (N=16384, r=8, p=1).
const { Buffer } = require('buffer');
const base = require('crypto-browserify');
const { syncScrypt } = require('scrypt-js');

function toBytes(value) {
  return typeof value === 'string' ? Buffer.from(value, 'utf8') : Buffer.from(value);
}

function scryptSync(password, salt, keylen, options = {}) {
  const N = options.N || options.cost || 16384;
  const r = options.r || options.blockSize || 8;
  const p = options.p || options.parallelization || 1;
  return Buffer.from(syncScrypt(toBytes(password), toBytes(salt), N, r, p, keylen));
}

function randomUUID() {
  return globalThis.crypto.randomUUID();
}

module.exports = { ...base, scryptSync, randomUUID };
