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

const { GLOBAL_OBJECTS, memberName, isGlobalBinding } = require('./global-callee');

const CORE_FUNCTIONS = new Set(['initColorBox']);

// Both casings are Shoptet core globals (both are declared readonly in .eslintrc.js).
const SHOPTET_GLOBALS = new Set(['shoptet', 'Shoptet']);

/** `shoptet?.x` arrives wrapped in ChainExpression — unwrap before matching. */
function unwrapChain(node) {
  return node && node.type === 'ChainExpression' ? node.expression : node;
}

/** Innermost MemberExpression of a chain — the one whose `.object` is the base. */
function innermostMember(node) {
  let current = node;
  while (current.object && current.object.type === 'MemberExpression') {
    current = current.object;
  }
  return current;
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
  if (GLOBAL_OBJECTS.has(base.name)) {
    return isGlobalBinding(scope, base.name) && SHOPTET_GLOBALS.has(memberName(inner));
  }
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
    GLOBAL_OBJECTS.has(node.object.name) &&
    isGlobalBinding(scope, node.object.name)
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

        if (
          node.left.type === 'Identifier' &&
          // A partner's own local of the same name (let initColorBox; …) cannot
          // overwrite the global — only an undeclared/global binding gates.
          isGlobalBinding(context.getScope(), node.left.name)
        ) {
          reportCoreFunction(node, node.left.name);
        }
      },

      FunctionDeclaration(node) {
        if (!node.id) return;
        // The declaration's binding lives in the ENCLOSING scope. Only the true
        // global scope (script-mode top level) can overwrite the core — a
        // module-scope or nested declaration is the partner's own function.
        const enclosing = context.getScope().upper;
        if (enclosing && enclosing.type === 'global') {
          reportCoreFunction(node, node.id.name);
        }
      },

      // delete shoptet.x (incl. delete shoptet?.x)
      UnaryExpression(node) {
        const argument = unwrapChain(node.argument);
        if (
          node.operator === 'delete' &&
          argument.type === 'MemberExpression' &&
          targetsGlobalShoptet(argument, context.getScope())
        ) {
          report(node, argument);
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
        if (callee.type !== 'MemberExpression') return;
        // `Object` is resolved by SCOPE like every other identifier in this
        // rule (a local `import Object from …` is not the built-in) — and the
        // built-in reached through the global object counts too
        // (window.Object.assign).
        const base = callee.object;
        const isBuiltinObject =
          (base.type === 'Identifier' &&
            base.name === 'Object' &&
            isGlobalBinding(context.getScope(), 'Object')) ||
          (base.type === 'MemberExpression' &&
            base.object.type === 'Identifier' &&
            GLOBAL_OBJECTS.has(base.object.name) &&
            isGlobalBinding(context.getScope(), base.object.name) &&
            memberName(base) === 'Object');
        const arg0 = unwrapChain(node.arguments[0]);
        if (
          isBuiltinObject &&
          ['assign', 'defineProperty', 'defineProperties'].includes(memberName(callee)) &&
          arg0 &&
          (isGlobalShoptetRef(arg0, context.getScope()) ||
            // …including writes INTO a core sub-object: Object.assign(shoptet.config, …)
            (arg0.type === 'MemberExpression' &&
              targetsGlobalShoptet(arg0, context.getScope())))
        ) {
          report(node, node.arguments[0]);
        }
      },

      // Destructuring writes: [shoptet.x] = […], ({a: shoptet.y} = {…}),
      // for ([shoptet.x] of list). Walk the pattern for member targets.
      'AssignmentExpression[left.type=/Pattern$/], ForOfStatement[left.type=/Pattern$/], ForInStatement[left.type=/Pattern$/]'(node) {
        const scope = context.getScope();
        const stack = [node.left];
        while (stack.length) {
          const current = stack.pop();
          if (!current || typeof current.type !== 'string') continue;
          if (current.type === 'MemberExpression') {
            if (targetsGlobalShoptet(current, scope)) report(node, current);
            continue; // don't descend into the member chain
          }
          if (current.type === 'ArrayPattern') stack.push(...current.elements);
          else if (current.type === 'ObjectPattern') stack.push(...current.properties);
          else if (current.type === 'Property') stack.push(current.value);
          else if (current.type === 'AssignmentPattern') stack.push(current.left);
          else if (current.type === 'RestElement') stack.push(current.argument);
        }
      },
    };
  },
};
