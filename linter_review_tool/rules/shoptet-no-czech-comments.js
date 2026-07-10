/**
 * I1. Comments must be in English
 *
 * Flags comments containing Czech/Slovak diacritics. (Identifiers in those
 * languages without diacritics cannot be reliably detected, so this rule
 * targets the strongest signal — diacritic characters in comments.)
 */

// Czech + Slovak diacritic letters (lower-case; matched case-insensitively).
const DIACRITICS = /[áäčďéěíĺľňóôŕřšťúůýž]/i;

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
          if (DIACRITICS.test(comment.value)) {
            context.report({
              loc: comment.loc,
              messageId: 'english',
            });
          }
        }
      },
    };
  },
};
