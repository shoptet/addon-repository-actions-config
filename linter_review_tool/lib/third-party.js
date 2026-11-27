/**
 * Verified third-party files (CZ3TDR1-937): a file whose CONTENT is a file
 * published by a widely used library is not the partner's code, so it is not
 * linted — and it is listed as "third-party, verified: <library>@<version>"
 * instead. By content, not by name: a name or a license banner is trivial to
 * fake to escape the linter, a SHA-256 is not.
 *
 * Lookup: jsDelivr's public hash index (`data.jsdelivr.com/v1/lookup/hash`)
 * maps a file's SHA-256 to the npm package (or GitHub repository) version and
 * path that publish it. Anyone can publish a package, so a match alone could
 * be the partner's own code published to escape the gate: only a library with
 * at least MIN_MONTHLY_HITS jsDelivr hits in the last month counts
 * (`data.jsdelivr.com/v1/stats/packages/<type>/<name>`) — slick 368 M,
 * embla-carousel 18 M; a package nobody uses has next to none.
 *
 * Fail-safe direction: anything that goes wrong — no network, a timeout, a
 * rate limit, an unknown hash, a modified copy — leaves the file unverified,
 * and an unverified file is linted exactly as before. Verification can only
 * remove findings for genuine library files, never hide partner code.
 *
 * Environment:
 * - SHOPTET_LINT_THIRD_PARTY=off — no lookup at all (every file is linted).
 * - SHOPTET_LINT_THIRD_PARTY_MAP=<file.json> — an offline map
 *   `{ "<sha256 hex>": { "type", "name", "version", "file", "hits" } }` used
 *   instead of the network (tests).
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// A library file is not tiny; a partner's own small file is never looked up
// (and never costs a request).
const MIN_BYTES = 1024;
const MAX_LOOKUPS = 300;
const CONCURRENCY = 8;
const TIMEOUT_MS = 5000;
const MIN_MONTHLY_HITS = 1000000;
// What a CDN publishes as-is: plain JavaScript and CSS. TypeScript, JSX,
// SCSS/LESS and HTML are sources, never a published library build.
const LOOKUP_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.css']);

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'user-agent': 'shoptet-addon-lint' },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function networkLookup() {
  const hits = new Map();
  return async (hash) => {
    const hit = await fetchJson(`https://data.jsdelivr.com/v1/lookup/hash/${hash}`);
    if (!hit || (hit.type !== 'npm' && hit.type !== 'gh') || !hit.name || !hit.version) {
      return null;
    }
    const key = `${hit.type}/${hit.name}`;
    if (!hits.has(key)) {
      const stats = await fetchJson(
        `https://data.jsdelivr.com/v1/stats/packages/${key}?period=month`,
      );
      const total = stats && stats.hits && stats.hits.total;
      hits.set(key, typeof total === 'number' ? total : 0);
    }
    return {
      type: hit.type,
      name: hit.name,
      version: hit.version,
      file: hit.file,
      hits: hits.get(key),
    };
  };
}

function mapLookup(mapFile) {
  let map = {};
  try {
    map = JSON.parse(fs.readFileSync(mapFile, 'utf8'));
  } catch {
    map = {};
  }
  return async (hash) => map[hash] || null;
}

function lookupFromEnv(env = process.env) {
  if ((env.SHOPTET_LINT_THIRD_PARTY || '').toLowerCase() === 'off') return null;
  if (env.SHOPTET_LINT_THIRD_PARTY_MAP) return mapLookup(env.SHOPTET_LINT_THIRD_PARTY_MAP);
  return networkLookup();
}

function isCandidate(filePath) {
  if (!LOOKUP_EXTENSIONS.has(path.extname(filePath).toLowerCase())) return false;
  try {
    return fs.statSync(filePath).size >= MIN_BYTES;
  } catch {
    return false;
  }
}

/**
 * The verified third-party files among `files`: `Map(file → "name@version")`.
 * Never throws; an empty map when lookup is off or nothing verifies.
 */
async function verifyThirdParty(files, lookup = lookupFromEnv()) {
  const verified = new Map();
  if (!lookup) return verified;
  const candidates = files.filter(isCandidate).slice(0, MAX_LOOKUPS);
  let next = 0;
  const worker = async () => {
    while (next < candidates.length) {
      const file = candidates[next++];
      try {
        const hit = await lookup(sha256(file));
        if (
          hit &&
          hit.name &&
          hit.version &&
          typeof hit.hits === 'number' &&
          hit.hits >= MIN_MONTHLY_HITS
        ) {
          verified.set(file, `${hit.name}@${hit.version}`);
        }
      } catch {
        // unverified — linted as before
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return verified;
}

module.exports = { verifyThirdParty, lookupFromEnv, sha256, MIN_MONTHLY_HITS };
