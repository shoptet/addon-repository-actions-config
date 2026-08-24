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
const { parsesAsScript } = require('./script-detect');

const CORE_FUNCTIONS = new Set(['initColorBox']);

// A file with no import/export ships as a classic script (same argument the
// no-unused-vars trust filter uses): its top-level function declarations bind
// to the shared global scope and DO overwrite the core, even though ESLint
// parses the file as a module and reports them at module scope. .mjs is a real
// module by convention and is exempt. (round 12)
function shipsAsClassicScript(context) {
  const filename = context.getFilename();
  if (/\.mjs$/i.test(filename)) return false;
  // Script-parseability IS the question: import/export, import.meta and
  // top-level await all fail it, so this cannot diverge from the linter's
  // usesModuleSyntax again (round 13, shared helper).
  return parsesAsScript(context.getSourceCode().text);
}

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

    // Core names a top-level declaration can hijack: known core functions AND
    // the core object itself — `function shoptet() {}` in a legacy script
    // replaces the whole core, strictly worse than any property write (round 13).
    function reportCoreName(node, name) {
      if (CORE_FUNCTIONS.has(name)) {
        context.report({ node, messageId: 'coreFunction', data: { name } });
      } else if (SHOPTET_GLOBALS.has(name)) {
        context.report({ node, messageId: 'shoptetMember', data: { path: name } });
      }
    }

    // Does a top-level declaration in THIS file land in the real global scope
    // at runtime? Script-mode top level always; module-parse top level only
    // when the file ships as a classic script.
    function topLevelLeaksToGlobal(scopeType) {
      return scopeType === 'global' || (scopeType === 'module' && shipsAsClassicScript(context));
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
        if (node.left.type === 'MemberExpression') {
          if (targetsGlobalShoptet(node.left, context.getScope())) {
            context.report({
              node,
              messageId: 'shoptetMember',
              data: { path: sourceCode.getText(node.left) },
            });
            return;
          }
          // window.initColorBox = … — the global-object spelling of a core
          // function write (the classic legacy way to define globals), same
          // treatment as the bare form below (round 12).
          const inner = innermostMember(node.left);
          if (
            inner.object.type === 'Identifier' &&
            GLOBAL_OBJECTS.has(inner.object.name) &&
            isGlobalBinding(context.getScope(), inner.object.name)
          ) {
            reportCoreFunction(node, memberName(inner));
            return;
          }
          // Property writes ON a core function — bare spelling
          // (initColorBox.cache = {}), symmetric with the window form above
          // (round 13).
          if (
            inner.object.type === 'Identifier' &&
            CORE_FUNCTIONS.has(inner.object.name) &&
            isGlobalBinding(context.getScope(), inner.object.name)
          ) {
            reportCoreFunction(node, inner.object.name);
          }
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
        // The declaration's binding lives in the ENCLOSING scope. A nested
        // declaration is the partner's own function in both cases.
        const enclosing = context.getScope().upper;
        if (enclosing && topLevelLeaksToGlobal(enclosing.type)) {
          reportCoreName(node, node.id.name);
        }
      },

      // Top-level lexical bindings shadow the core for every later script:
      // const/let/class initColorBox (incl. init-less let) — same harm as the
      // assignment forms (round 13). Walked on Program.body: exactly the
      // declarations whose binding can leak.
      Program(node) {
        // getScope() at Program returns the GLOBAL scope even in module mode
        // (the module scope is its child) — resolve the actual top-level scope.
        let scope = context.getScope();
        if (scope.type === 'global') {
          const moduleScope = scope.childScopes.find((s) => s.type === 'module' && s.block === node);
          if (moduleScope) scope = moduleScope;
        }
        if (!topLevelLeaksToGlobal(scope.type)) return;
        for (const stmt of node.body) {
          if (stmt.type === 'VariableDeclaration') {
            for (const declarator of stmt.declarations) {
              if (declarator.id.type === 'Identifier') reportCoreName(declarator, declarator.id.name);
            }
          } else if (stmt.type === 'ClassDeclaration' && stmt.id) {
            reportCoreName(stmt, stmt.id.name);
          }
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
