/**
 * B7. Disallow binding to data-testid attributes
 *
 * Shoptet does not guarantee the stability of data-testid attributes and may
 * remove them from production at any time. Addons must bind to regular CSS
 * classes instead. Flags the CSS attribute-selector form `[data-testid…]`
 * (selecting elements by testid), not a plain `'data-testid'` string — so
 * setting the attribute or the addon's own markup is not a false positive.
 */

// Boundary: [data-testid] / [data-testid=…] yes; [data-testid-mine] is a
// different (partner-owned) attribute and must not match.
const TESTID_PATTERN = /\[\s*data-testid(?![\w-])/i;

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

    // Multi-line quasis anchor on the LINE with the match, not the literal's
    // first line — a testid added to line 3 of an existing template would
    // otherwise anchor on an unchanged line and be dropped by the
    // per-changed-line gate (round 13; same technique as czech-comments).
    function checkQuasi(quasi) {
      const text = quasi.value.cooked;
      if (typeof text !== 'string') return;
      const lines = text.split('\n');
      const index = lines.findIndex((line) => TESTID_PATTERN.test(line));
      if (index === -1) return;
      const line = quasi.loc.start.line + index;
      const origin = index === 0 ? quasi.loc.start.column : 0;
      const matchCol = lines[index].search(TESTID_PATTERN);
      context.report({
        loc: {
          start: { line, column: origin + matchCol },
          end: { line, column: origin + lines[index].length },
        },
        messageId: 'testid',
      });
    }

    return {
      Literal(node) {
        if (typeof node.value === 'string') check(node, node.value);
      },
      TemplateLiteral(node) {
        for (const quasi of node.quasis) {
          checkQuasi(quasi);
        }
      },
    };
  },
};
