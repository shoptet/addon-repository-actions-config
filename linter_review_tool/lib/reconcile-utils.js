/**
 * Shared logic between the PR reconcile step in checks.workflow.yml (which
 * require()s this file from the checked-out tool) and the self-test suite —
 * so the highest-risk pieces of the review pipeline are unit-tested instead
 * of living untestable inside workflow YAML.
 */

const crypto = require('crypto');

/**
 * Parse a SINGLE-FILE unified diff into the set of new-side line numbers that
 * are additions. Both callers honor this contract (one API `file.patch`, one
 * single-path `git diff`); a concatenated multi-file diff throws — silently
 * mis-anchoring every finding after the second file header would be worse.
 *
 * Edge cases covered (each pinned by the self-test):
 * - "\ No newline at end of file" is a marker, not a line — it must not shift
 *   the counter, otherwise a finding on the last edited line of a file without
 *   a trailing newline silently stops gating.
 * - File headers ("+++ b/path") are recognized only before the first hunk;
 *   inside hunks, lines starting with "+++"/"---" are added/removed CONTENT
 *   (e.g. an added "++ x;" renders as "+++ x;").
 */
function parseAddedLines(diff) {
  const lines = new Set();
  let newLine = 0;
  let inHunk = false;
  for (const raw of diff.split('\n')) {
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
    if (raw.startsWith('diff --git ')) {
      throw new Error('parseAddedLines expects a single-file diff (got a multi-file diff)');
    }
    if (hunk) { newLine = parseInt(hunk[1], 10); inHunk = true; continue; }
    if (raw.startsWith('\\')) continue; // "\ No newline at end of file"
    // File headers ("+++ b/path") appear only BEFORE the first hunk. Inside a
    // hunk, a line starting with "+++ " is an ADDED line whose content starts
    // with "++ " (e.g. "++ x;") — skipping it there would shift every anchor
    // after it, silently un-gating findings.
    if (!inHunk && (raw.startsWith('+++') || raw.startsWith('---'))) continue;
    if (raw.startsWith('+')) { lines.add(newLine); newLine++; }
    else if (raw.startsWith('-')) { /* old side only */ }
    else { newLine++; }
  }
  return lines;
}

/**
 * Stable identity of a finding across pushes — used as the dedup marker in
 * review comments. Includes the line number on purpose: two identical findings
 * in one file could not be told apart without it (the cost — line shifts
 * re-create threads — is documented in the README known limitations).
 * The column is deliberately NOT included: two same-rule/same-message findings
 * on one line collapse into a single comment, which is one actionable item for
 * the author, not a lost finding (gating is unaffected).
 */
function findingFingerprint(d) {
  // JSON.stringify, not join('\n'): a field containing a newline (paths are
  // partner-controlled, messages are raw linter output) must not make two
  // different findings collide in `wanted` and silently drop one.
  return crypto
    .createHash('sha1')
    .update(JSON.stringify([d.location.path, d.location.range.start.line, d.code?.value || '', d.message]))
    .digest('hex');
}

module.exports = { parseAddedLines, findingFingerprint };
