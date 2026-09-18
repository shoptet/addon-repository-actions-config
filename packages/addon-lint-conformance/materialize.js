/**
 * Materializes one corpus shape (see `corpus.json` / README.md) into a real
 * temporary directory on disk, so a runner can point its own tool at it.
 *
 * Symlinked directories/files are CREATED here, at materialize time, rather
 * than shipped as committed symlinks in this package — a symlink cannot be
 * committed portably (checkout behaviour for symlinks varies by platform and
 * by `core.symlinks`), so the corpus stores the *intent* (`shape.symlinks`)
 * and this function turns it into a real filesystem symlink.
 *
 * `os.tmpdir()` is used for every shape unconditionally, including the ones
 * without `outsideRunnerTree: true` — a temp directory is never inside any
 * package's own source tree by construction, so no extra placement logic is
 * needed to satisfy that shape's requirement. `outsideRunnerTree` in the
 * manifest is documentation of INTENT (this shape's expectations only make
 * sense when materialized outside the tool's tree), not an instruction this
 * function has to act on differently.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

/**
 * @param {object} shape - one entry from corpus.json's `shapes` array
 * @returns {{ dir: string, cleanup: () => void }}
 */
function materializeShape(shape) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `addon-lint-conformance-${shape.id}-`));

  for (const [relPath, content] of Object.entries(shape.files || {})) {
    const abs = path.join(dir, relPath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }

  for (const link of shape.symlinks || []) {
    const targetAbs = path.join(dir, link.target);
    const linkAbs = path.join(dir, link.linkPath);
    fs.mkdirSync(path.dirname(linkAbs), { recursive: true });
    fs.symlinkSync(targetAbs, linkAbs);
  }

  function cleanup() {
    fs.rmSync(dir, { recursive: true, force: true });
  }

  return { dir, cleanup };
}

module.exports = { materializeShape };
