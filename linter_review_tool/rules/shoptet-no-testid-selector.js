/**
 * B7. Disallow binding to data-testid attributes
 *
 * Shoptet does not guarantee the stability of data-testid attributes and may
 * remove them from production at any time. Addons must bind to regular CSS
 * classes instead. Flags any string/template literal that references
 * `data-testid`.
 */

const TESTID_PATTERN = /data-testid/;

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow selectors/attributes referencing data-testid',
      category: 'Shoptet',
      recommended: true,
    },
    messages: {
      testid:
        'Do not bind to data-testid — its stability is not guaranteed. Use a regular CSS class instead.',
    },
    schema: [],
  },

  create(context) {
    function check(node, text) {
      if (typeof text === 'string' && TESTID_PATTERN.test(text)) {
        context.report({ node, messageId: 'testid' });
      }
    }

    return {
      Literal(node) {
        if (typeof node.value === 'string') check(node, node.value);
      },
      TemplateLiteral(node) {
        for (const quasi of node.quasis) {
          check(node, quasi.value.cooked);
        }
      },
    };
  },
};
