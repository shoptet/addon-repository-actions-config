#!/usr/bin/env node
'use strict';

// `yarn release:local` — publishes the `packages/*` rule packages into a local Verdaccio registry
// you already have running (`yarn verdaccio:local`), so the publish-then-consume path can be
// rehearsed locally while the real `@shoptet` scope publish rights are still blocked. The real
// release path is `.github/workflows/publish-packages.yml` (OIDC trusted publishing); this script
// is a local rehearsal and is never part of it.
//
// Two contracts worth knowing:
//
// 1. The committed `packages/*/package.json` files are NEVER opened for writing. Each package is
//    published from a temporary copy with the version patched in, so a dozen local releases leave
//    the working tree clean and the `1.0.0` in those manifests keeps meaning "what the real OIDC
//    release would ship".
// 2. The base version is the highest version already in the *local* registry, or the manifest's
//    version when that package has never been published there. The requested bump is always
//    applied on top, so a first run against a manifest at `1.0.0` with `--bump=patch` publishes
//    `1.0.1`.
//
// Usage:
//   yarn release:local                                   # all packages, patch bump
//   yarn release:local --bump=minor
//   yarn release:local --package=addon-eslint-config
//   yarn release:local --package=addon-eslint-config --package=addon-html-lint --bump=major
//   yarn release:local --package=addon-lint-conformance
//
// The registry defaults to http://localhost:4873/ and can be overridden with
// SHOPTET_LOCAL_REGISTRY_URL.

const { execFileSync } = require('node:child_process');
const { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

const REPO_ROOT = join(__dirname, '..');
const PACKAGES_DIR = join(REPO_ROOT, 'packages');
const DEFAULT_REGISTRY_URL = 'http://localhost:4873/';
const KNOWN_PACKAGES = [
  'addon-eslint-config',
  'addon-stylelint-config',
  'addon-html-lint',
  'addon-lint-conformance',
];
const BUMP_TYPES = ['patch', 'minor', 'major'];

function parseArgs(argv) {
  const dirs = [];
  let bump = 'patch';
  for (const arg of argv) {
    if (arg.startsWith('--package=')) {
      const value = arg.slice('--package='.length);
      if (value === 'all') {
        dirs.push(...KNOWN_PACKAGES);
      } else if (KNOWN_PACKAGES.includes(value)) {
        dirs.push(value);
      } else {
        throw new Error(`--package must be "all" or one of ${KNOWN_PACKAGES.join(', ')}`);
      }
    } else if (arg.startsWith('--bump=')) {
      bump = arg.slice('--bump='.length);
      if (!BUMP_TYPES.includes(bump)) {
        throw new Error(`--bump must be one of ${BUMP_TYPES.join(', ')} (got "${bump}")`);
      }
    } else {
      throw new Error(`unknown argument "${arg}"`);
    }
  }
  return { dirs: dirs.length > 0 ? [...new Set(dirs)] : [...KNOWN_PACKAGES], bump };
}

/** Loopback per RFC 5735 / RFC 4291, plus the `.test`/`.local` names RFC 6761 and RFC 6762 reserve
 * for local use — the only hosts that can never be a real public registry. */
function isLocalHost(hostname) {
  // WHATWG URL keeps the brackets on an IPv6 literal (`new URL('http://[::1]/').hostname ===
  // '[::1]'`), so strip them before comparing or `::1` is unreachable.
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host === '::1' || /^127(?:\.\d{1,3}){3}$/.test(host)) return true;
  return host.endsWith('.test') || host.endsWith('.local');
}

/** Refuse to publish anywhere but this machine. `npm publish` will happily reuse whatever real
 * credential the developer's `.npmrc` holds, so a mistyped SHOPTET_LOCAL_REGISTRY_URL (or one
 * copied from a production config) would push these packages to the public registry for real —
 * the exact thing the blocked-by-design state in `publish-packages.yml` exists to prevent. */
function assertLocalRegistry(registryUrl) {
  let hostname;
  try {
    hostname = new URL(registryUrl).hostname;
  } catch {
    throw new Error(`not a valid registry URL: "${registryUrl}"`);
  }
  if (isLocalHost(hostname)) return;
  throw new Error(
    `Refusing to publish to non-local registry host "${hostname}" (${registryUrl}). ` +
      `This script publishes with whatever npm credentials are configured, so this could ship ` +
      `the packages for real. Only loopback (localhost, 127.0.0.0/8, ::1) and \`.test\`/\`.local\` ` +
      `hosts are allowed. The real release goes out from CI — see publish-packages.yml.`,
  );
}

function readManifest(packageDir) {
  const parsed = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'));
  if (typeof parsed.name !== 'string' || typeof parsed.version !== 'string') {
    throw new Error(`${packageDir}/package.json has no usable "name"/"version"`);
  }
  if (!Array.isArray(parsed.files)) {
    throw new Error(`${parsed.name}: package.json has no "files" array to publish from`);
  }
  return parsed;
}

/** The highest version of `name` in the target registry, or undefined when it has never been
 * published there. A missing package is the normal first-run case, not an error.
 *
 * This resolves through Verdaccio's npmjs uplink, so once these names exist on the public
 * registry the bump base becomes the *published* version rather than the last local one. That is
 * the desired behaviour for a rehearsal of a real release; delete `local-releases/` if you want a
 * clean slate instead. */
function publishedVersion(name, registryUrl) {
  try {
    const out = execFileSync(
      'npm',
      ['view', `${name}@latest`, 'version', '--registry', registryUrl],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    );
    const version = out.trim();
    return version === '' ? undefined : version;
  } catch {
    return undefined;
  }
}

function bumpVersion(version, bump) {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
  if (match === null) throw new Error(`cannot bump a non-semver version: "${version}"`);
  const [major, minor, patch] = match.slice(1).map(Number);
  if (bump === 'major') return `${major + 1}.0.0`;
  if (bump === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

/** `npm publish` refuses to even attempt the request without *some* token configured for the
 * target registry, even one that accepts anonymous publish the way this Verdaccio config does.
 * A single CLI flag scoped to exactly this registry's host satisfies that client-side
 * precondition without touching the developer's real `.npmrc`. */
function dummyAuthTokenFlag(registryUrl) {
  return `--//${registryUrl.replace(/^https?:\/\//, '')}:_authToken=shoptet-release-local`;
}

function publishOne(packageDirName, version, registryUrl) {
  const packageDir = join(PACKAGES_DIR, packageDirName);
  const manifest = readManifest(packageDir);

  const tempDir = mkdtempSync(join(tmpdir(), 'shoptet-release-local-'));
  try {
    for (const file of manifest.files) {
      const source = join(packageDir, file);
      if (!existsSync(source)) {
        throw new Error(
          `${manifest.name}: "${file}" is listed in "files" but missing at ${source}`,
        );
      }
      cpSync(source, join(tempDir, file), { recursive: true });
    }
    writeFileSync(
      join(tempDir, 'package.json'),
      `${JSON.stringify({ ...manifest, version }, null, 2)}\n`,
      'utf8',
    );

    console.log(`release-local: publishing ${manifest.name}@${version} to ${registryUrl}`);
    // cwd is the temp dir, outside this repository, so no project-level .npmrc is picked up;
    // --no-provenance is the second line of defense, since provenance can only be generated from
    // a CI/OIDC provider and never from a local registry.
    execFileSync(
      'npm',
      [
        'publish',
        tempDir,
        '--registry',
        registryUrl,
        '--no-provenance',
        dummyAuthTokenFlag(registryUrl),
      ],
      { cwd: tempDir, stdio: 'inherit' },
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function main() {
  const { dirs, bump } = parseArgs(process.argv.slice(2));
  const registryUrl = process.env.SHOPTET_LOCAL_REGISTRY_URL ?? DEFAULT_REGISTRY_URL;
  assertLocalRegistry(registryUrl);

  const plan = dirs.map((dir) => {
    const manifest = readManifest(join(PACKAGES_DIR, dir));
    const base = publishedVersion(manifest.name, registryUrl) ?? manifest.version;
    return { dir, name: manifest.name, from: base, to: bumpVersion(base, bump) };
  });

  console.log(`release-local: ${registryUrl} (${bump})`);
  for (const entry of plan) console.log(`  ${entry.name}: ${entry.from} -> ${entry.to}`);

  for (const entry of plan) publishOne(entry.dir, entry.to, registryUrl);

  console.log(`release-local: published ${plan.length} package(s) to ${registryUrl}`);
}

try {
  main();
} catch (error) {
  console.error(`release-local: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
