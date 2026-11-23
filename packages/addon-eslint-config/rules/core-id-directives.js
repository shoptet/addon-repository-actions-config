/**
 * Honour `eslint-disable` directives that name the CORE rule id on a rule
 * that replaces it in the TypeScript/JSX block.
 *
 * Shared helper, not a rule. On `.ts/.tsx/.mts/.cts/.jsx` the config swaps
 * `no-unused-vars`, `no-use-before-define`, `no-unused-expressions` and
 * `camelcase` for an equivalent under another id. ESLint matches a directive
 * by id only, so `// eslint-disable-next-line no-unused-vars` would stop
 * silencing the finding the moment a file is TypeScript — or plain `.jsx`,
 * whose author has no reason to write `@typescript-eslint/…`. A replacement
 * rule wrapped here drops a report that a directive naming the core id
 * covers, with the same coverage ESLint gives the core rule:
 *   - `eslint-disable-line <ids>`      — the comment's own line
 *   - `eslint-disable-next-line <ids>` — the line after the comment ends
 *   - `eslint-disable <ids>` … `eslint-enable <ids>` — the range between them
 *     (to the end of the file without an `eslint-enable`)
 * A bare `eslint-disable` (no ids) already disables every rule, the
 * replacement included, so it needs nothing here. Parsing errs toward
 * suppressing: a directive this misreads can only hide a finding.
 */

const DIRECTIVE = /^\s*eslint-(disable-next-line|disable-line|disable|enable)(?:\s+([\s\S]*))?$/;

/** Rule ids named by a directive, without its `-- justification`. */
function namedIds(text) {
  if (!text) return [];
  const list = text.split(/\s--\s|\s--$/)[0];
  return list
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

function before(a, b) {
  return a.line < b.line || (a.line === b.line && a.column < b.column);
}

/** A function telling whether a report position is disabled for `ruleId`. */
function coreDirectiveMatcher(sourceCode, ruleId) {
  const lines = new Set();
  const ranges = [];
  let openStart = null;
  for (const comment of sourceCode.getAllComments()) {
    const match = DIRECTIVE.exec(comment.value);
    if (!match || !namedIds(match[2]).includes(ruleId)) continue;
    const kind = match[1];
    if (kind === 'disable-line') lines.add(comment.loc.start.line);
    else if (kind === 'disable-next-line') lines.add(comment.loc.end.line + 1);
    else if (kind === 'disable') {
      if (openStart === null) openStart = comment.loc.start;
    } else if (openStart !== null) {
      ranges.push([openStart, comment.loc.start]);
      openStart = null;
    }
  }
  if (openStart !== null) ranges.push([openStart, null]);

  return (position) =>
    lines.has(position.line) ||
    ranges.some(
      ([start, end]) => !before(position, start) && (end === null || before(position, end)),
    );
}

/** Start position of a report descriptor (loc given directly, or the node's). */
function reportStart(descriptor) {
  const loc = descriptor.loc || (descriptor.node && descriptor.node.loc);
  if (!loc) return null;
  return loc.start || loc; // `loc` may be a bare { line, column }
}

/**
 * Wrap `baseRule` so a directive naming `coreId` covers its reports, and an
 * optional `skip(descriptor, context)` drops further reports (both can only
 * remove findings, never add one).
 */
function honoringCoreDirectives(baseRule, coreId, skip) {
  return {
    ...baseRule,
    create(context) {
      let disabled = null; // parsed on the first report only
      const filteredContext = Object.create(context, {
        report: {
          value(descriptor) {
            if (skip && skip(descriptor, context)) return;
            const start = reportStart(descriptor);
            if (start) {
              if (!disabled) disabled = coreDirectiveMatcher(context.sourceCode, coreId);
              if (disabled(start)) return;
            }
            context.report(descriptor);
          },
        },
      });
      return baseRule.create(filteredContext);
    },
  };
}

module.exports = { honoringCoreDirectives, coreDirectiveMatcher };
