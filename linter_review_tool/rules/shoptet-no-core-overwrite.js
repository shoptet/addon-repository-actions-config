/**
 * B6. Do not overwrite Shoptet core
 *
 * Flags re-implementing or overwriting core functions/objects:
 *   - assigning to ANY property path rooted at the global `shoptet` object
 *     (shoptet.x = …, shoptet.menu.splitMenu = …, shoptet.a.b.c = …)
 *   - (re)defining a known core function name (e.g. initColorBox)
 */

const { GLOBAL_OBJECTS, memberName } = require('./global-callee');

const CORE_FUNCTIONS = new Set(['initColorBox']);

/** Innermost MemberExpression of a chain — the one whose `.object` is the base. */
function innermostMember(node) {
  let current = node;
  while (current.object && current.object.type === 'MemberExpression') {
    current = current.object;
  }
  return current;
}

/**
 * True only when `name` is the GLOBAL binding in this scope — i.e. not declared
 * anywhere up the scope chain. A partner's own `const shoptet = …` (or a param)
 * is a local and must not be flagged as overwriting the Shoptet core.
 */
function isGlobalBinding(scope, name) {
  for (let s = scope; s; s = s.upper) {
    const variable = s.variables.find((v) => v.name === name);
    if (variable) return variable.defs.length === 0;
  }
  return true;
}

/**
 * Does this assignment target write into the global Shoptet core object?
 * Matches `shoptet.x = …` (only if `shoptet` is the global, not a local) and
 * `window.shoptet.x = …` / `self.…` / `globalThis.…` (incl. computed forms).
 */
function targetsGlobalShoptet(memberExpr, scope) {
  const inner = innermostMember(memberExpr);
  const base = inner.object;
  if (!base || base.type !== 'Identifier') return false;
  if (base.name === 'shoptet') return isGlobalBinding(scope, 'shoptet');
  if (GLOBAL_OBJECTS.has(base.name)) return memberName(inner) === 'shoptet';
  return false;
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow overwriting Shoptet core functions/objects',
      category: 'Shoptet',
      recommended: true,
    },
    messages: {
      shoptetMember:
        'Do not overwrite the Shoptet core (`{{path}}`). It breaks on core updates and collides with other addons.',
      coreFunction:
        'Do not redefine the Shoptet core function `{{name}}`. Reuse the existing implementation.',
    },
    schema: [],
  },

  create(context) {
    const sourceCode = context.getSourceCode();

    function reportCoreFunction(node, name) {
      if (CORE_FUNCTIONS.has(name)) {
        context.report({ node, messageId: 'coreFunction', data: { name } });
      }
    }

    return {
      AssignmentExpression(node) {
        if (
          node.left.type === 'MemberExpression' &&
          targetsGlobalShoptet(node.left, context.getScope())
        ) {
          context.report({
            node,
            messageId: 'shoptetMember',
            data: { path: sourceCode.getText(node.left) },
          });
          return;
        }

        if (node.left.type === 'Identifier') {
          reportCoreFunction(node, node.left.name);
        }
      },

      FunctionDeclaration(node) {
        if (node.id) reportCoreFunction(node, node.id.name);
      },
    };
  },
};
