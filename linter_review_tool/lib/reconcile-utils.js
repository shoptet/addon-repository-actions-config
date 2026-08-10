/**
 * Shared logic between the PR reconcile step in checks.workflow.yml (which
 * require()s this file from the checked-out tool) and the self-test suite —
 * so the highest-risk pieces of the review pipeline are unit-tested instead
 * of living untestable inside workflow YAML.
 */

const crypto = require('crypto');

/**
 * Parse a unified diff into the set of new-side line numbers that are additions.
 *
 * Edge cases covered (each pinned by the self-test):
 * - "\ No newline at end of file" is a marker, not a line — it must not shift
 *   the counter, otherwise a finding on the last edited line of a file without
 *   a trailing newline silently stops gating.
 * - File headers always have a space after the sigils ("+++ b/path"); an added
 *   line whose content starts with "++" (e.g. "+++i;") is content, not a header.
 */
function parseAddedLines(diff) {
  const lines = new Set();
  let newLine = 0;
  for (const raw of diff.split('\n')) {
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
    if (hunk) { newLine = parseInt(hunk[1], 10); continue; }
    if (raw.startsWith('\\')) continue; // "\ No newline at end of file"
    if (raw.startsWith('+++ ') || raw.startsWith('--- ')) continue; // file headers
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
 */
function findingFingerprint(d) {
  return crypto
    .createHash('sha1')
    .update([d.location.path, d.location.range.start.line, d.code?.value || '', d.message].join('\n'))
    .digest('hex');
}

module.exports = { parseAddedLines, findingFingerprint };
