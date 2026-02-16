/**
 * ESLint rule to enforce /cache/ path in Shoptet API calls
 * 
 * This rule checks for AJAX calls to Shoptet domains and ensures
 * they include /cache/ in the URL for proper caching.
 */

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require /cache/ path in XHR calls to Shoptet servers',
      category: 'Best Practices',
      recommended: true,
    },
    messages: {
      missingCache: 'Missing /cache/ in {{method}} call to Shoptet server',
      verifyXHR: 'XMLHttpRequest detected - verify it uses /cache/ for Shoptet API calls',
    },
    schema: [], // no options
  },

  create(context) {
    const shoptetDomainPattern = /\.(shoptet\.cz|myshoptet\.com)/;
    const cachePattern = /\/cache\//;

    /**
     * Check if a string literal contains a Shoptet domain without /cache/
     */
    function isViolatingUrl(node) {
      if (!node || (node.type !== 'Literal' && node.type !== 'TemplateLiteral')) {
        return false;
      }

      let url = null;
      if (node.type === 'Literal') {
        url = node.value;
      } else if (node.type === 'TemplateLiteral' && node.quasis.length === 1) {
        // Only check template literals without expressions
        url = node.quasis[0].value.cooked;
      }

      return (
        typeof url === 'string' &&
        shoptetDomainPattern.test(url) &&
        !cachePattern.test(url)
      );
    }

    /**
     * Get the method name for error message
     */
    function getMethodName(node) {
      if (node.callee.type === 'Identifier') {
        return node.callee.name;
      }
      if (node.callee.type === 'MemberExpression' && node.callee.property) {
        return `$.${node.callee.property.name}`;
      }
      return 'AJAX';
    }

    return {
      // Check fetch() calls
      CallExpression(node) {
        // Check: fetch('url')
        if (
          node.callee.type === 'Identifier' &&
          node.callee.name === 'fetch' &&
          node.arguments.length > 0
        ) {
          const firstArg = node.arguments[0];
          if (isViolatingUrl(firstArg)) {
            context.report({
              node: firstArg,
              messageId: 'missingCache',
              data: {
                method: 'fetch',
              },
            });
          }
        }

        // Check: $.get(), $.post(), $.ajax()
        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.object.name === '$' &&
          ['post', 'get', 'ajax'].includes(node.callee.property.name) &&
          node.arguments.length > 0
        ) {
          const firstArg = node.arguments[0];
          if (isViolatingUrl(firstArg)) {
            context.report({
              node: firstArg,
              messageId: 'missingCache',
              data: {
                method: getMethodName(node),
              },
            });
          }
        }
      },

      // Check: new XMLHttpRequest()
      NewExpression(node) {
        if (
          node.callee.type === 'Identifier' &&
          node.callee.name === 'XMLHttpRequest'
        ) {
          context.report({
            node,
            messageId: 'verifyXHR',
          });
        }
      },
    };
  },
};
