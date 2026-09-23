#!/usr/bin/env node
/**
 * Pre-publish tarball verification for the packages under packages/*.
 *
 * Why this exists: linter_review_tool consumes the rule packages via Yarn
 * classic `link:../packages/<name>`, which symlinks the whole working tree.
 * Every local test therefore resolves a file whether or not `files` in
 * package.json would actually pack it, and `scripts/release-local.js` only
 * checks the opposite direction (that every entry listed in `files` exists on
 * disk). Nothing exercised npm's own packing before `npm publish` — and a
 * publish is irreversible.
 *
 * What it does, for one package directory:
 *   1. `npm pack` the package into a temporary directory (npm's real packer,
 *      so `files`, `.npmignore` and the implicit includes all apply);
 *   2. `npm install` that tarball into a scratch project together with the
 *      package's peer dependencies, so the entry point is loaded from the
 *      INSTALLED tarball content and not from this working tree;
 *   3. `require()` every subpath declared in `exports` (plus `main`), which
 *      catches any file that `files` fails to ship;
 *   4. assert the root entry point exposes at least the export names listed
 *      in EXPECTED_EXPORTS below.
 *
 * Step 4 is deliberately an "at least these names" assertion, not an equality
 * one: adding a new export (e.g. a second rule-set slice next to
 * RELIABLE_RULES) is a normal, backwards-compatible change and must not fail
 * the publish. Removing or renaming one is what we want to catch.
 *
 * The expected names live here rather than in a custom package.json field on
 * purpose: a field in package.json would be published to consumers as
 * meaningless metadata, and it drifts exactly as easily (nobody updates
 * either one when adding an export — which is precisely why the assertion is
 * "at least"). Keeping it in one reviewed file on the publish path means a
 * package that is added to publish-packages.yml without being added here
 * fails loudly (see the unknown-package error below) instead of being
 * silently unverified.
 *
 * Usage: node scripts/verify-pack.js packages/addon-eslint-config
 * Exits 0 when the packed tarball loads and exports everything expected,
 * non-zero (with the reason on stderr) otherwise.
 */

'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

/**
 * Export names each package's root entry point must expose after being
 * installed from its own tarball. "At least these" — extra names are fine.
 */
const EXPECTED_EXPORTS = {
  '@shoptet/addon-eslint-config': [
    'configs',
    'plugin',
    'parsesAsScript',
    'RELIABLE_RULES',
    'RUNNER_RULES',
  ],
  '@shoptet/addon-stylelint-config': ['configs', 'RELIABLE_RULES', 'RUNNER_RULES'],
  '@shoptet/addon-html-lint': ['lintHtmlSource', 'RELIABLE_RULES'],
  '@shoptet/addon-lint-conformance': ['corpus', 'materializeShape'],
};

function run(command, args, cwd) {
  return execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
}

function fail(message) {
  console.error(`verify-pack: ${message}`);
  process.exit(1);
}

const packageDir = path.resolve(process.argv[2] || '.');
const manifestPath = path.join(packageDir, 'package.json');
if (!fs.existsSync(manifestPath)) fail(`no package.json in ${packageDir}`);

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const name = manifest.name;
const expected = EXPECTED_EXPORTS[name];
if (!expected) {
  fail(
    `unknown package "${name}" — add its expected export names to EXPECTED_EXPORTS in scripts/verify-pack.js`,
  );
}

// Every subpath the package advertises must resolve from the packed tarball.
// `./package.json` is always packed by npm, so it carries no information.
const subpaths = Object.keys(manifest.exports || { '.': manifest.main || './index.js' }).filter(
  (subpath) => subpath !== './package.json',
);
if (!subpaths.includes('.')) subpaths.unshift('.');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-pack-'));
let ok = false;
try {
  // Run every npm command against an empty user config in tmpDir instead of
  // the ambient one. In publish-packages.yml, setup-node has already written
  // an .npmrc with `_authToken=${NODE_AUTH_TOKEN}` for the publish step, and
  // NODE_AUTH_TOKEN is not set on this step (with OIDC trusted publishing it
  // may never be set at all) — npm must not try to resolve it here. Locally
  // it keeps the check hermetic against a developer's own .npmrc, including
  // a @shoptet scope repointed at the Verdaccio rehearsal registry.
  const userconfig = path.join(tmpDir, '.npmrc');
  fs.writeFileSync(userconfig, '');
  const isolated = ['--userconfig', userconfig, '--registry', 'https://registry.npmjs.org/'];

  console.log(`verify-pack: ${name}@${manifest.version} — packing ${packageDir}`);
  const packJson = run(
    'npm',
    ['pack', '--json', '--pack-destination', tmpDir, ...isolated],
    packageDir,
  );
  const tarball = path.join(tmpDir, JSON.parse(packJson)[0].filename);
  if (!fs.existsSync(tarball)) fail(`npm pack did not produce ${tarball}`);

  // A scratch project, so npm installs into tmpDir/node_modules and does not
  // walk up into this repository's workspace root.
  fs.writeFileSync(
    path.join(tmpDir, 'package.json'),
    `${JSON.stringify({ name: 'verify-pack-scratch', version: '0.0.0', private: true }, null, 2)}\n`,
  );

  // Peer dependencies are not installed by `npm install <tarball>`, but the
  // rule files require() them at load time (stylelint, in particular). Pin
  // each peer to the version the package itself develops against when it
  // declares one, otherwise to the peer range.
  const peers = Object.entries(manifest.peerDependencies || {}).map(
    ([peer, range]) => `${peer}@${(manifest.devDependencies || {})[peer] || range}`,
  );

  console.log(
    `verify-pack: installing tarball${peers.length ? ` + peers ${peers.join(' ')}` : ''}`,
  );
  run(
    'npm',
    [
      'install',
      '--omit=dev',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--loglevel=error',
      ...isolated,
      tarball,
      ...peers,
    ],
    tmpDir,
  );

  // Load from the installed copy in a child process rooted at tmpDir, so
  // resolution can never reach back into the working tree.
  const probe = `
    const expected = ${JSON.stringify(expected)};
    const subpaths = ${JSON.stringify(subpaths)};
    for (const subpath of subpaths) {
      const specifier = subpath === '.' ? ${JSON.stringify(name)} : ${JSON.stringify(name)} + subpath.slice(1);
      require(specifier);
      console.log('  require(' + specifier + ') ok');
    }
    const root = require(${JSON.stringify(name)});
    const missing = expected.filter((key) => !(key in root));
    if (missing.length) {
      console.error('missing export(s): ' + missing.join(', '));
      process.exit(1);
    }
    console.log('  exports ok: ' + expected.join(', '));
  `;
  execFileSync(process.execPath, ['-e', probe], {
    cwd: tmpDir,
    encoding: 'utf8',
    stdio: ['ignore', 'inherit', 'inherit'],
  });

  console.log(`verify-pack: ${name} OK`);
  ok = true;
} catch (error) {
  // pack/install/require all inherit stderr, so the underlying reason is
  // already on the log — keep the summary to one line instead of dumping the
  // execFileSync error object.
  console.error(`verify-pack: ${name} — ${error.message.split('\n')[0]}`);
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  if (!ok) {
    console.error(`verify-pack: ${name} FAILED — the packed tarball is not publishable`);
    process.exitCode = 1;
  }
}
