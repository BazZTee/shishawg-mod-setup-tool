'use strict';
const { Buffer } = require('buffer');
const vfs = require('./vfs');

function notFound(p) {
  const error = new Error(`ENOENT: no such file or directory, '${p}'`);
  error.code = 'ENOENT';
  return error;
}

function encodingOf(options) {
  return typeof options === 'string' ? options : options && options.encoding;
}

function toText(data) {
  if (typeof data === 'string') return data;
  if (data && typeof data === 'object' && (data instanceof Uint8Array || ArrayBuffer.isView(data))) return Buffer.from(data).toString('utf8');
  return String(data);
}

const fs = {
  existsSync: p => vfs.has(p) || vfs.isDir(p),
  readFileSync(p, options) {
    if (!vfs.has(p)) throw notFound(p);
    const text = vfs.read(p);
    return encodingOf(options) ? text : Buffer.from(text, 'utf8');
  },
  writeFileSync(p, data) { vfs.write(p, toText(data)); },
  mkdirSync() {},
  copyFileSync(from, to) {
    if (!vfs.has(from)) throw notFound(from);
    vfs.write(to, vfs.read(from));
  },
  renameSync(from, to) {
    if (!vfs.has(from)) throw notFound(from);
    vfs.write(to, vfs.read(from));
    vfs.remove(from);
  },
  unlinkSync(p) {
    if (!vfs.has(p)) throw notFound(p);
    vfs.remove(p);
  }
};

fs.promises = {
  readFile: async (p, o) => fs.readFileSync(p, o),
  writeFile: async (p, d) => fs.writeFileSync(p, d),
  mkdir: async () => {},
  unlink: async p => fs.unlinkSync(p)
};

module.exports = fs;
