/**
 * Shared logic between the PR reconcile step in checks.workflow.yml (which
 * require()s this file from the checked-out tool) and the self-test suite —
 * so the highest-risk pieces of the review pipeline are unit-tested instead
 * of living untestable inside workflow YAML.
 */

const crypto = require('crypto');

/**
 * Parse a SINGLE-FILE unified diff into the set of new-side line numbers that
 * are additions. The two callers pass different shapes of "single-file": an
 * API `file.patch` carries NO `diff --git` header, raw single-path `git diff`
 * output carries exactly ONE. Both must parse; a SECOND header means a
 * concatenated multi-file diff and throws — silently mis-anchoring every
 * finding after the second file header would be worse. (Round 8 threw on the
 * first header, which killed the large-file `git diff` fallback — round 9.)
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
  let headers = 0;
  for (const raw of diff.split('\n')) {
    // Only a bare header counts: added/removed/context lines that CONTAIN
    // "diff --git" start with +/-/space and never match here.
    if (raw.startsWith('diff --git ')) {
      if (++headers > 1)
        throw new Error('parseAddedLines expects a single-file diff (got a multi-file diff)');
      continue;
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
    if (hunk) {
      newLine = parseInt(hunk[1], 10);
      inHunk = true;
      continue;
    }
    if (raw.startsWith('\\')) continue; // "\ No newline at end of file"
    // File headers ("+++ b/path") appear only BEFORE the first hunk. Inside a
    // hunk, a line starting with "+++ " is an ADDED line whose content starts
    // with "++ " (e.g. "++ x;") — skipping it there would shift every anchor
    // after it, silently un-gating findings.
    if (!inHunk && (raw.startsWith('+++') || raw.startsWith('---'))) continue;
    if (raw.startsWith('+')) {
      lines.add(newLine);
      newLine++;
    } else if (raw.startsWith('-')) {
      /* old side only */
    } else {
      newLine++;
    }
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
    .update(
      JSON.stringify([
        d.location.path,
        d.location.range.start.line,
        d.code?.value || '',
        d.message,
      ]),
    )
    .digest('hex');
}

/**
 * A Summary list of files: the first `max` entries as inline code, joined by
 * ", ", plus " … and N more" for the rest. `label` renders one entry (a path
 * string by default). Used by the checks workflow's Summary blocks.
 */
function formatFileList(entries, label = (entry) => `\`${entry}\``, max = 20) {
  const list = entries.slice(0, max).map(label).join(', ');
  const more = entries.length > max ? ` … and ${entries.length - max} more` : '';
  return `${list}${more}`;
}

/**
 * Findings in files linted outside the lint target (`outsideSrc` in the
 * payload) are Summary-only during the rollout (CZ3TDR1-937): never posted
 * inline, so a PR touching a large modified library copy is not flooded.
 */
function isSummaryOnly(diagnostic, outsideSrc) {
  return outsideSrc.has(diagnostic.location.path);
}

module.exports = { parseAddedLines, findingFingerprint, formatFileList, isSummaryOnly };
