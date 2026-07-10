/**
 * F1. No commented-out code in production
 *
 * Heuristically detects commented-out source code (as opposed to prose
 * comments). History lives in git. Skips ESLint directive comments and JSDoc.
 */

// Strong signals that a comment line is actually code.
const CODE_SIGNALS = [
  /;\s*$/, // ends with a semicolon
  /[{}]\s*$/, // ends with a brace
  /^\s*(const|let|var|function|return|if|for|while|switch|else|import|export|class|await|async)\b/,
  /=>/, // arrow function
  /===|!==/, // strict comparisons
  /^\s*[\w$.]+\([^)]*\)\s*;?\s*$/, // a bare function/method call
  /^\s*[\w$.]+\s*=\s*[^=]/, // an assignment
];

// Directive prefixes that must never be treated as code.
const DIRECTIVE = /^\s*(eslint|global|jshint|jslint|@ts-|prettier-|istanbul|c8|v8)\b/;

function looksLikeCode(line) {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (DIRECTIVE.test(trimmed)) return false;
  if (trimmed.startsWith('*')) return false; // JSDoc continuation
  return CODE_SIGNALS.some((re) => re.test(trimmed));
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow commented-out code in production',
      category: 'Cleanliness',
      recommended: true,
    },
    messages: {
      commentedCode:
        'Remove commented-out code — history is kept in git.',
    },
    schema: [],
  },

  create(context) {
    const sourceCode = context.getSourceCode();

    return {
      'Program:exit'() {
        for (const comment of sourceCode.getAllComments()) {
          // Block comments that are JSDoc (start with *) are documentation.
          if (comment.type === 'Block' && comment.value.trim().startsWith('*')) {
            continue;
          }

          const lines = comment.value.split('\n');
          if (lines.some(looksLikeCode)) {
            context.report({ loc: comment.loc, messageId: 'commentedCode' });
          }
        }
      },
    };
  },
};
