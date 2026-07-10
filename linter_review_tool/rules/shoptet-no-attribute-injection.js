/**
 * A1 (attribute injection). Dynamic data written into sensitive attributes.
 *
 * innerHTML is covered by shoptet/no-xss; this rule catches the other sinks a
 * shallow HTML check misses:
 *   - el.src / el.href / el.action = <dynamic>      (URL injection, javascript:)
 *   - el.style.cssText / el.style.<prop> = <dynamic> (CSS injection)
 *   - el.setAttribute('src'|'href'|'style'|'on*', <dynamic>)
 *
 * Reported as a recommendation — verify the value is not attacker-controlled.
 */

const URL_ATTRS = new Set(['src', 'href', 'action', 'formAction', 'srcdoc', 'data']);
const SETATTR_SINKS = /^(src|href|xlink:href|srcdoc|action|formaction|style|on\w+)$/i;

function isStaticString(node) {
  if (!node) return false;
  if (node.type === 'Literal') return typeof node.value === 'string';
  if (node.type === 'TemplateLiteral') return node.expressions.length === 0;
  if (node.type === 'BinaryExpression' && node.operator === '+') {
    return isStaticString(node.left) && isStaticString(node.right);
  }
  return false;
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow dynamic data in sensitive attributes (URL/CSS/attribute injection)',
      category: 'Security',
      recommended: true,
    },
    messages: {
      urlAttr:
        'Dynamic value assigned to `{{attr}}` — verify it cannot be attacker-controlled (javascript:/URL injection).',
      styleAttr:
        'Dynamic value assigned to inline style — verify it cannot be attacker-controlled (CSS injection). Prefer a CSS class.',
      setAttr:
        'Dynamic value passed to setAttribute("{{attr}}") — verify it cannot be attacker-controlled.',
    },
    schema: [],
  },

  create(context) {
    return {
      AssignmentExpression(node) {
        if (node.left.type !== 'MemberExpression' || !node.left.property) return;
        if (isStaticString(node.right)) return;

        const prop = node.left.property.name;

        // el.style.cssText = … / el.style.<prop> = …
        if (
          node.left.object.type === 'MemberExpression' &&
          node.left.object.property &&
          node.left.object.property.name === 'style'
        ) {
          context.report({ node, messageId: 'styleAttr' });
          return;
        }

        if (URL_ATTRS.has(prop)) {
          context.report({ node, messageId: 'urlAttr', data: { attr: prop } });
        }
      },

      CallExpression(node) {
        const { callee } = node;
        if (
          callee.type === 'MemberExpression' &&
          callee.property &&
          callee.property.name === 'setAttribute' &&
          node.arguments.length >= 2 &&
          node.arguments[0].type === 'Literal' &&
          SETATTR_SINKS.test(String(node.arguments[0].value)) &&
          !isStaticString(node.arguments[1])
        ) {
          context.report({
            node,
            messageId: 'setAttr',
            data: { attr: node.arguments[0].value },
          });
        }
      },
    };
  },
};
