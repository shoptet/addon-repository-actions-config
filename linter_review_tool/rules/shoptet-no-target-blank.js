/**
 * A5. External links target="_blank" require rel="noopener noreferrer"
 *
 * Flags HTML strings that open a link in a new tab without the rel protection
 * against window.opener attacks.
 */

const TARGET_BLANK = /target\s*=\s*["']?_blank/i;
const NOOPENER = /noopener/i;

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require rel="noopener noreferrer" on target="_blank" links',
      category: 'Security',
      recommended: true,
    },
    messages: {
      noopener:
        'target="_blank" without rel="noopener noreferrer" exposes a window.opener attack. Add rel="noopener noreferrer".',
    },
    schema: [],
  },

  create(context) {
    function check(node, text) {
      if (
        typeof text === 'string' &&
        TARGET_BLANK.test(text) &&
        !NOOPENER.test(text)
      ) {
        context.report({ node, messageId: 'noopener' });
      }
    }

    return {
      Literal(node) {
        if (typeof node.value === 'string') check(node, node.value);
      },
      TemplateLiteral(node) {
        // Join the static parts so target/rel split across lines is still caught.
        const text = node.quasis.map((q) => q.value.cooked).join(' ');
        check(node, text);
      },
    };
  },
};
