// Injected into every bundled module (esbuild "inject").
import { Buffer as NodeBuffer } from 'buffer';

export const process = globalThis.process || {
  platform: 'android',
  browser: true,
  version: 'v20.0.0',
  env: {},
  argv: [],
  versions: {},
  cwd: () => '/',
  nextTick: (fn, ...args) => queueMicrotask(() => fn(...args)),
  on() {},
  emitWarning() {}
};
globalThis.process = process;

export const Buffer = globalThis.Buffer || NodeBuffer;
globalThis.Buffer = Buffer;
