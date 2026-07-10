/**
 * A1. XSS / unsafe HTML insertion
 *
 * Flags dynamic (non-static) values written into the DOM as HTML:
 *   - el.innerHTML = ... / el.outerHTML = ... (and +=)
 *   - el.insertAdjacentHTML(pos, dynamicHtml)
 *   - document.write(...) / document.writeln(...)
 *   - jQuery .html(dynamicHtml)
 *
 * A value is considered safe only when it is a fully static string
 * (string literal, template literal without expressions, or a concatenation
 * of such static parts). Anything dynamic can carry attacker-controlled data.
 */

function isStaticString(node) {
  if (!node) return false;

  if (node.type === 'Literal') {
    return typeof node.value === 'string';
  }
  if (node.type === 'TemplateLiteral') {
    return node.expressions.length === 0;
  }
  if (node.type === 'BinaryExpression' && node.operator === '+') {
    return isStaticString(node.left) && isStaticString(node.right);
  }
  return false;
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow inserting dynamic data into the DOM as HTML (XSS risk)',
      category: 'Security',
      recommended: true,
    },
    messages: {
      innerHtml:
        'XSS risk: assigning dynamic data to {{prop}}. Use textContent, DOM API (createElement/append), or sanitize (DOMPurify).',
      innerHtmlUntrusted:
        'HIGH XSS risk: {{prop}} is assigned data from an untrusted source ({{source}}). Sanitize (DOMPurify) or build via DOM API — do NOT interpolate into HTML.',
      insertAdjacent:
        'XSS risk: insertAdjacentHTML with dynamic data. Build via DOM API or sanitize the HTML.',
      documentWrite:
        'XSS risk: document.{{method}} with dynamic data. Use DOM API instead.',
      jqueryHtml:
        'XSS risk: .html() with dynamic data. Use .text() for text, or build via DOM API / sanitize.',
    },
    schema: [],
  },

  create(context) {
    const sourceCode = context.getSourceCode();

    // Coarse (non-taint) signal that the value may be attacker-controlled.
    const UNTRUSTED = /\b(localStorage|sessionStorage|JSON\.parse|location\b|document\.cookie|\.search\b|\.hash\b|URLSearchParams)\b/;

    function untrustedSource(node) {
      const match = UNTRUSTED.exec(sourceCode.getText(node));
      return match ? match[0] : null;
    }

    return {
      AssignmentExpression(node) {
        if (
          node.left.type === 'MemberExpression' &&
          node.left.property &&
          (node.left.property.name === 'innerHTML' ||
            node.left.property.name === 'outerHTML') &&
          !isStaticString(node.right)
        ) {
          const source = untrustedSource(node.right);
          context.report({
            node,
            messageId: source ? 'innerHtmlUntrusted' : 'innerHtml',
            data: { prop: node.left.property.name, source },
          });
        }
      },

      CallExpression(node) {
        const { callee } = node;
        if (callee.type !== 'MemberExpression' || !callee.property) return;

        const propName = callee.property.name;

        // insertAdjacentHTML(position, html)
        if (propName === 'insertAdjacentHTML' && node.arguments.length >= 2) {
          if (!isStaticString(node.arguments[1])) {
            context.report({ node, messageId: 'insertAdjacent' });
          }
          return;
        }

        // document.write / document.writeln
        if (
          (propName === 'write' || propName === 'writeln') &&
          callee.object.type === 'Identifier' &&
          callee.object.name === 'document'
        ) {
          if (node.arguments.length && !isStaticString(node.arguments[0])) {
            context.report({
              node,
              messageId: 'documentWrite',
              data: { method: propName },
            });
          }
          return;
        }

        // jQuery .html(content)
        if (propName === 'html' && node.arguments.length === 1) {
          if (!isStaticString(node.arguments[0])) {
            context.report({ node, messageId: 'jqueryHtml' });
          }
        }
      },
    };
  },
};
