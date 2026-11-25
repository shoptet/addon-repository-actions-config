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
 *     (to the end of the file without an `eslint-enable`); a bare
 *     `eslint-enable` (no ids) closes it too, as it re-enables every rule
 * A bare `eslint-disable` (no ids) already disables every rule, the
 * replacement included, so it needs nothing here.
 *
 * The goal is parity with JavaScript, so the comment forms ESLint itself
 * accepts are the only ones read (measured on ESLint 9.39):
 *   - `eslint-disable` / `eslint-enable` only in a block comment — a
 *     `// eslint-disable no-unused-vars` line comment is ignored by ESLint;
 *   - `eslint-disable-line` only in a comment on a single line — a block
 *     comment spanning lines is rejected by ESLint;
 *   - `eslint-disable-next-line` in either comment type, counted from the
 *     line the comment ends on.
 *
 * An inline config comment that turns the core id OFF
 * (`/* eslint no-unused-vars: "off" *\/`, also `0` / `["off"]`) switches the
 * replacement off for the whole file, as ESLint does for the core rule.
 */

// Parsing mirrors ESLint's own (@eslint/plugin-kit ConfigCommentParser,
// read from its source): the justification is split off the WHOLE comment
// first (two or more dashes with whitespace on both sides), the directive name
// is matched on what remains, and the rule list is split on commas, each id
// trimmed and unquoted. So `/* eslint-enable -- done */` is a bare enable, and
// `--- kept` is a justification.
const JUSTIFICATION = /\s-{2,}\s/u;
const DIRECTIVE = /^eslint-(disable-next-line|disable-line|disable|enable)(?:\s|$)/u;

const INLINE_CONFIG = /^eslint(?:\s|$)/u;

/** Escape a rule id for use inside a RegExp. */
function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

/**
 * The severity an inline config comment (`/* eslint no-unused-vars: "off" *\/`)
 * gives `ruleId`, as `'off'` / `'on'`, or null when the comment does not name
 * it. Only block comments count, and ESLint applies the FIRST configuration of
 * a rule in the file to the whole file, wherever the comment sits (measured on
 * ESLint 9.39). Only "off" can be mirrored by a wrapper that drops reports;
 * a `"warn"` downgrade or an options override cannot (README).
 */
function inlineSeverity(commentValue, ruleId) {
  const separator = JUSTIFICATION.exec(commentValue);
  const directivePart = (separator ? commentValue.slice(0, separator.index) : commentValue).trim();
  if (!INLINE_CONFIG.test(directivePart) || DIRECTIVE.test(directivePart)) return null;
  const entry = new RegExp(
    `(?:^|[\\s,{])(["']?)${escapeRegExp(ruleId)}\\1\\s*:\\s*\\[?\\s*(["']?)(off|warn|error|0|1|2)\\2(?![\\w-])`,
    'u',
  ).exec(directivePart.slice('eslint'.length));
  if (!entry) return null;
  return entry[3] === 'off' || entry[3] === '0' ? 'off' : 'on';
}

/** `{ kind, ids }` for a directive comment, or null for any other comment. */
function parseDirective(commentValue) {
  const separator = JUSTIFICATION.exec(commentValue);
  const directivePart = (separator ? commentValue.slice(0, separator.index) : commentValue).trim();
  const match = DIRECTIVE.exec(directivePart);
  if (!match) return null;
  const ids = directivePart
    .slice(match[0].length)
    .split(',')
    .map((id) => id.trim().replace(/^(['"]?)(.*)\1$/su, '$2'))
    .filter(Boolean);
  return { kind: match[1], ids };
}

function before(a, b) {
  return a.line < b.line || (a.line === b.line && a.column < b.column);
}

/** A function telling whether a report position is disabled for `ruleId`. */
function coreDirectiveMatcher(sourceCode, ruleId) {
  const lines = new Set();
  const ranges = [];
  let openStart = null;
  let inlineConfig = null; // first `/* eslint <ruleId>: … */` wins, file-wide
  for (const comment of sourceCode.getAllComments()) {
    if (inlineConfig === null && comment.type === 'Block') {
      inlineConfig = inlineSeverity(comment.value, ruleId);
    }
    const directive = parseDirective(comment.value);
    if (!directive) continue;
    const { kind, ids } = directive;
    const isBlock = comment.type === 'Block';
    // Forms ESLint ignores are ignored here too (see the header).
    if ((kind === 'disable' || kind === 'enable') && !isBlock) continue;
    if (kind === 'disable-line' && comment.loc.start.line !== comment.loc.end.line) continue;
    // A bare `eslint-enable` re-enables every rule, so it closes our range;
    // any other directive only counts when it names the core id.
    const bareEnable = kind === 'enable' && ids.length === 0;
    if (!bareEnable && !ids.includes(ruleId)) continue;
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
  if (inlineConfig === 'off') return () => true;

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
