'use strict';
function parse(value, parseQuery = false) {
  const u = new URL(String(value), 'http://localhost');
  const query = parseQuery ? Object.fromEntries(u.searchParams.entries()) : u.search.slice(1);
  return {
    href: u.href,
    protocol: u.protocol,
    host: u.host,
    hostname: u.hostname,
    port: u.port,
    pathname: u.pathname,
    search: u.search,
    hash: u.hash,
    path: u.pathname + u.search,
    query
  };
}

module.exports = { parse, URL, URLSearchParams, fileURLToPath: (u) => new URL(u).pathname };
