/**
 * Locations of the `/* global … *\/` (and `/* globals … *\/`) directive
 * comments in a source, as the PARSER sees them.
 *
 * Shared helper, not a rule. The runner uses it to drop core no-redeclare's
 * `redeclaredAsBuiltin` reports that sit inside such a comment — a redundant
 * comment, not a redeclaration (CZ3TDR1-979). The comments come from the
 * parser's tokenizer, not from a regex over the raw text, so `/* global`
 * inside a string or a line comment is not mistaken for a directive, the end
 * of the comment is exact, and line numbers follow the parser (CR, CRLF,
 * U+2028/U+2029 all end a line, as in ESLint).
 *
 * Returns `[{ start, end }]` with ESLint-style positions (1-based line,
 * 0-based column; `end` is the position just after the closing `*\/`), or
 * null when the source cannot be tokenized — the caller then filters nothing,
 * so a tokenizer problem can only keep a report, never hide one.
 */

const espree = require('espree');

const TS_OR_JSX = /\.(ts|tsx|mts|cts|jsx)$/i;
// ESLint reads a global directive from a Block comment whose value starts
// with `global` or `globals` followed by whitespace.
const GLOBAL_DIRECTIVE = /^\s*globals?\s/u;

function parserComments(sourceText, filename) {
  if (typeof filename === 'string' && TS_OR_JSX.test(filename)) {
    const { parse } = require('@typescript-eslint/typescript-estree');
    try {
      return parse(sourceText, {
        filePath: filename,
        jsx: /\.(tsx|jsx)$/i.test(filename),
        comment: true,
        loc: true,
        range: true,
      }).comments;
    } catch {
      return null;
    }
  }
  for (const sourceType of ['module', 'script']) {
    try {
      return espree.tokenize(sourceText, {
        ecmaVersion: 'latest',
        sourceType,
        comment: true,
        loc: true,
        range: true,
      }).comments;
    } catch {
      // a classic script may fail the module tokenization — try script
    }
  }
  return null;
}

/**
 * `name → value` of a global directive's entries, parsed the way ESLint does
 * (@eslint/plugin-kit ConfigCommentParser#parseStringConfig): whitespace around
 * `:` and `,` collapsed, items split on whitespace or commas, `name[:value]`.
 * A name without a value maps to null (= readonly).
 */
function directiveEntries(commentValue) {
  const body = commentValue.replace(GLOBAL_DIRECTIVE, '');
  const separator = /\s-{2,}\s/u.exec(body);
  const list = (separator ? body.slice(0, separator.index) : body)
    .trim()
    .replace(/(?<!\s)\s*([:,])\s*/gu, '$1');
  const entries = new Map();
  for (const item of list.split(/\s|,+/u)) {
    if (!item) continue;
    const [name, value = null] = item.split(':');
    entries.set(name, value);
  }
  return entries;
}

function globalCommentLocations(sourceText, filename) {
  const comments = parserComments(sourceText, filename);
  if (!comments) return null;
  return comments
    .filter((comment) => comment.type === 'Block' && GLOBAL_DIRECTIVE.test(comment.value))
    .map((comment) => ({
      start: comment.loc.start,
      end: comment.loc.end,
      entries: directiveEntries(comment.value),
    }));
}

// Values that keep a global read-only — the only case where repeating it in
// a comment is redundant. `writable` / `writeable` / `true` make it
// assignable and `off` removes it: both switch off no-global-assign /
// no-implicit-globals protection for that name, so the comment is an opt-out,
// not a no-op, and its no-redeclare report must stay.
const READONLY_VALUES = new Set([null, 'readonly', 'readable', 'false']);

/**
 * Is a `redeclaredAsBuiltin` report (`'shoptet' is already defined as a
 * built-in global variable.`) one of a merely redundant global comment: inside
 * such a comment, for a name the comment keeps read-only?
 */
function isRedundantGlobalReport(message, locations) {
  const match = /^'(.+)' is already defined as a built-in global variable\.$/u.exec(
    message.message,
  );
  if (!match) return false;
  return locations.some(
    (location) =>
      isInsideComment(message, [location]) &&
      location.entries.has(match[1]) &&
      READONLY_VALUES.has(location.entries.get(match[1])),
  );
}

/**
 * Is an ESLint message (1-based line and column) inside one of the comments?
 * The end is exclusive: an identifier glued to the closing delimiter
 * (`/* global x *\/x = 1`) is code, not comment.
 */
function isInsideComment(message, locations) {
  const column = message.column - 1; // to the 0-based column of `loc`
  return locations.some(({ start, end }) => {
    const afterStart =
      message.line > start.line || (message.line === start.line && column >= start.column);
    const beforeEnd = message.line < end.line || (message.line === end.line && column < end.column);
    return afterStart && beforeEnd;
  });
}

module.exports = { globalCommentLocations, isInsideComment, isRedundantGlobalReport };
