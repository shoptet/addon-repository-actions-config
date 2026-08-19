/**
 * I1. Comments must be in English
 *
 * Flags comments containing Czech/Slovak diacritics. (Identifiers in those
 * languages without diacritics cannot be reliably detected, so this rule
 * targets the strongest signal — diacritic characters in comments.)
 */

// Only Czech/Slovak-distinctive letters (caron + ring). The shared acute vowels
// (á é í ó ú) and umlauts (ä ö ü) are deliberately excluded — they also occur in
// Spanish/French/German and in proper names ("café", "José"), which caused false
// positives. Note: caron-bearing names ("Tomáš") still match — an accepted
// trade-off. Trades recall for precision (this rule is a warning).
const DIACRITICS = /[ěščřžďťňůľĺŕ]/i;

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow Czech/Slovak comments (use English)',
      category: 'Localization',
      recommended: true,
    },
    messages: {
      english: 'Comments must be in English (Czech/Slovak diacritics detected).',
    },
    schema: [],
  },

  create(context) {
    const sourceCode = context.getSourceCode();

    return {
      'Program:exit'() {
        for (const comment of sourceCode.getAllComments()) {
          // Anchor on the first line INSIDE the comment that carries the
          // diacritics — a block comment's own loc spans the whole block, and
          // the per-changed-line gate would drop a finding anchored on an
          // unchanged first line (round 11).
          const lines = comment.value.split('\n');
          const index = lines.findIndex((line) => DIACRITICS.test(line));
          if (index === -1) continue;
          const line = comment.loc.start.line + index;
          context.report({
            loc: {
              start: { line, column: 0 },
              end: { line, column: lines[index].length },
            },
            messageId: 'english',
          });
        }
      },
    };
  },
};
