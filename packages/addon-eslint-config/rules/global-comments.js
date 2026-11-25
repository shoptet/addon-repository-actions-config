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

function globalCommentLocations(sourceText, filename) {
  const comments = parserComments(sourceText, filename);
  if (!comments) return null;
  return comments
    .filter((comment) => comment.type === 'Block' && GLOBAL_DIRECTIVE.test(comment.value))
    .map((comment) => ({ start: comment.loc.start, end: comment.loc.end }));
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

module.exports = { globalCommentLocations, isInsideComment };
