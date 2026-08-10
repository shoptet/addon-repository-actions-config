/**
 * B6. Do not overwrite Shoptet core
 *
 * Flags re-implementing or mutating core functions/objects — for both the
 * lowercase `shoptet` and capital `Shoptet` globals, written bare or through
 * the global object (`window.shoptet.x`, incl. computed forms):
 *   - property assignment: shoptet.x = …, shoptet.a.b ||= …
 *   - delete shoptet.x, shoptet.counter++, for (shoptet.x of …)
 *   - Object.assign(shoptet, …) / Object.defineProperty(shoptet, …)
 *   - (re)defining a known core function name (e.g. initColorBox)
 * (`shoptet = {}` — replacing the whole object — is gated by no-global-assign.)
 */

const { GLOBAL_OBJECTS, memberName } = require('./global-callee');

const CORE_FUNCTIONS = new Set(['initColorBox']);

// Both casings are Shoptet core globals (both are declared readonly in .eslintrc.js).
const SHOPTET_GLOBALS = new Set(['shoptet', 'Shoptet']);

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
  if (SHOPTET_GLOBALS.has(base.name)) return isGlobalBinding(scope, base.name);
  if (GLOBAL_OBJECTS.has(base.name)) return SHOPTET_GLOBALS.has(memberName(inner));
  return false;
}

/** Is this expression a direct reference to the global shoptet/Shoptet object? */
function isGlobalShoptetRef(node, scope) {
  if (node.type === 'Identifier' && SHOPTET_GLOBALS.has(node.name)) {
    return isGlobalBinding(scope, node.name);
  }
  if (
    node.type === 'MemberExpression' &&
    node.object.type === 'Identifier' &&
    GLOBAL_OBJECTS.has(node.object.name)
  ) {
    return SHOPTET_GLOBALS.has(memberName(node));
  }
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

    function report(node, targetExpr) {
      context.report({
        node,
        messageId: 'shoptetMember',
        data: { path: sourceCode.getText(targetExpr) },
      });
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

      // delete shoptet.x
      UnaryExpression(node) {
        if (
          node.operator === 'delete' &&
          node.argument.type === 'MemberExpression' &&
          targetsGlobalShoptet(node.argument, context.getScope())
        ) {
          report(node, node.argument);
        }
      },

      // shoptet.counter++ / --shoptet.x
      UpdateExpression(node) {
        if (
          node.argument.type === 'MemberExpression' &&
          targetsGlobalShoptet(node.argument, context.getScope())
        ) {
          report(node, node.argument);
        }
      },

      // for (shoptet.current of list) / for (shoptet.key in obj)
      'ForOfStatement, ForInStatement'(node) {
        if (
          node.left.type === 'MemberExpression' &&
          targetsGlobalShoptet(node.left, context.getScope())
        ) {
          report(node, node.left);
        }
      },

      // Object.assign(shoptet, …) / Object.defineProperty(shoptet, …)
      CallExpression(node) {
        const callee = node.callee;
        if (
          callee.type === 'MemberExpression' &&
          callee.object.type === 'Identifier' &&
          callee.object.name === 'Object' &&
          ['assign', 'defineProperty', 'defineProperties'].includes(memberName(callee)) &&
          node.arguments[0] &&
          isGlobalShoptetRef(node.arguments[0], context.getScope())
        ) {
          report(node, node.arguments[0]);
        }
      },
    };
  },
};
