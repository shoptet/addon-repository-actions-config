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
 * Scope: only files OUTSIDE the lint target (outside `src/`), where findings
 * are non-blocking during the rollout — the gate's verdict on `src/` never
 * depends on this lookup or on an external service (PR #32 review, P2).
 *
 * Data flow: the SHA-256 of each candidate file (never its content) is sent to
 * `data.jsdelivr.com`, from the CI runner. Turn it off with
 * SHOPTET_LINT_THIRD_PARTY=off.
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

// Whole-run budget and circuit breaker (PR #32 review, P2): when jsDelivr is
// slow or down, the gate must not wait minutes — after TOTAL_BUDGET_MS, or
// after MAX_CONSECUTIVE_FAILURES failed requests in a row (timeout, network
// error, 429 / 5xx), no further lookup is made and the rest stays unverified,
// i.e. linted. A 404 (unknown hash) is an answer, not a failure.
const TOTAL_BUDGET_MS = 20000;
const MAX_CONSECUTIVE_FAILURES = 3;

function createBreaker(now = Date.now) {
  const deadline = now() + TOTAL_BUDGET_MS;
  let failures = 0;
  return {
    open: () => failures >= MAX_CONSECUTIVE_FAILURES || now() > deadline,
    failed: () => {
      failures += 1;
    },
    answered: () => {
      failures = 0;
    },
  };
}

async function fetchJson(url, breaker) {
  if (breaker.open()) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'user-agent': 'shoptet-addon-lint' },
    });
    if (response.status === 404) {
      breaker.answered();
      return null;
    }
    if (!response.ok) {
      breaker.failed();
      return null;
    }
    breaker.answered();
    return await response.json();
  } catch {
    breaker.failed();
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// The owner of the repository under review (GitHub Actions sets it). A
// GitHub match from that owner's own repository is the partner's own code
// served by jsDelivr — popular because their addon is, not because it is a
// third-party library (PR #32 review, P1) — and never verifies.
function ownGithubOwner(env = process.env) {
  const owner = env.GITHUB_REPOSITORY_OWNER || (env.GITHUB_REPOSITORY || '').split('/')[0];
  return owner ? owner.toLowerCase() : null;
}

function isOwnRepository(hit, owner) {
  return hit.type === 'gh' && owner !== null && hit.name.split('/')[0].toLowerCase() === owner;
}

function networkLookup() {
  const hits = new Map();
  const breaker = createBreaker();
  return async (hash) => {
    const hit = await fetchJson(`https://data.jsdelivr.com/v1/lookup/hash/${hash}`, breaker);
    if (!hit || (hit.type !== 'npm' && hit.type !== 'gh') || !hit.name || !hit.version) {
      return null;
    }
    const key = `${hit.type}/${hit.name}`;
    if (!hits.has(key)) {
      const stats = await fetchJson(
        `https://data.jsdelivr.com/v1/stats/packages/${key}?period=month`,
        breaker,
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
async function verifyThirdParty(files, lookup = lookupFromEnv(), owner = ownGithubOwner()) {
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
          !isOwnRepository(hit, owner) &&
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

module.exports = { verifyThirdParty, lookupFromEnv, sha256, createBreaker, MIN_MONTHLY_HITS };
