/**
 * A1. No `javascript:` URLs — only where the URL can actually run
 *
 * Core `no-script-url` reports EVERY string literal (and expression-less
 * template literal) starting with `javascript:`, wherever it sits. An addon
 * that defends against script URLs — an XSS sanitizer comparing a value with
 * `"javascript:"`, a blocklist, a type `Exclude<string, 'javascript:…'>` —
 * therefore failed the gate on the defence itself (CZ3TDR1-959).
 *
 * This rule matches the same values as the core rule (case-insensitive
 * `javascript:` prefix, static strings only) but reports one only where it
 * becomes a URL a browser can navigate to or load:
 *   - assigned to `href`, `src`, `action`, `formAction` or `location`
 *     (`el.href = …`, `window.location = …`, `location.href = …`);
 *   - passed as the value to `setAttribute('href' | 'src' | 'action' |
 *     'formaction' | 'xlink:href', …)` (also `setAttributeNS`);
 *   - passed to `location.assign()` / `location.replace()` or to the global
 *     `open()` (`window.open('javascript:…')`);
 *   - a JSX attribute `href` / `src` / `action` / `formAction` with that
 *     literal value (`<a href="javascript:void(0)">`).
 * Type-only wrappers (`'javascript:x' as string`) are looked through. Anything
 * else — comparisons, string-method arguments, array members, a value that
 * reaches a URL through a variable or concatenation — is not reported: false
 * negatives over false positives, the AI review covers intent.
 *
 * An `eslint-disable` naming the core id `no-script-url` still applies
 * (core-id-directives.js), so partners' existing directives keep working.
 */

const {
  TS_WRAPPERS,
  globalCalleeName,
  isGlobalBinding,
  memberName,
  unwrapExpr,
} = require('./global-callee');
const { honoringCoreDirectives } = require('./core-id-directives');

const URL_PROPERTIES = new Set(['href', 'src', 'action', 'formaction', 'location']);
const URL_ATTRIBUTES = new Set(['href', 'src', 'action', 'formaction', 'xlink:href']);

/** The static string of a Literal / expression-less TemplateLiteral, else null. */
function staticString(node) {
  if (!node) return null;
  if (node.type === 'Literal') return typeof node.value === 'string' ? node.value : null;
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
    const cooked = node.quasis[0] && node.quasis[0].value.cooked;
    return typeof cooked === 'string' ? cooked : null;
  }
  return null;
}

/** Same match as core no-script-url. */
function isScriptUrl(value) {
  return typeof value === 'string' && value.toLowerCase().startsWith('javascript:');
}

/** The node standing for the literal's value: the literal plus any type wrappers. */
function valuePosition(literal) {
  let current = literal;
  while (current.parent && TS_WRAPPERS.has(current.parent.type)) current = current.parent;
  return current;
}

/** `location` (the global) or `<anything>.location`. */
function isLocationRef(rawNode, scope) {
  const node = unwrapExpr(rawNode);
  if (!node) return false;
  if (node.type === 'Identifier')
    return node.name === 'location' && isGlobalBinding(scope, 'location');
  return node.type === 'MemberExpression' && memberName(node) === 'location';
}

/** Is `value` (a literal, possibly type-wrapped) in a position where the URL runs? */
function isUrlSink(value, scope) {
  const parent = value.parent;
  if (!parent) return false;

  // el.href = 'javascript:…', window.location = …, location = …
  if (parent.type === 'AssignmentExpression' && parent.operator === '=' && parent.right === value) {
    const left = unwrapExpr(parent.left);
    if (left.type === 'MemberExpression') {
      const name = memberName(left);
      return Boolean(name && URL_PROPERTIES.has(name.toLowerCase()));
    }
    return (
      left.type === 'Identifier' && left.name === 'location' && isGlobalBinding(scope, 'location')
    );
  }

  // setAttribute('href', …), location.assign(…), window.open(…)
  if (parent.type === 'CallExpression' && parent.arguments.includes(value)) {
    const callee = unwrapExpr(parent.callee);
    const index = parent.arguments.indexOf(value);
    if (callee.type === 'MemberExpression') {
      const method = memberName(callee);
      if (method === 'setAttribute' || method === 'setAttributeNS') {
        const nameIndex = method === 'setAttribute' ? 0 : 1;
        const attribute = staticString(unwrapExpr(parent.arguments[nameIndex]));
        return (
          index === nameIndex + 1 &&
          typeof attribute === 'string' &&
          URL_ATTRIBUTES.has(attribute.toLowerCase())
        );
      }
      if ((method === 'assign' || method === 'replace') && index === 0) {
        return isLocationRef(callee.object, scope);
      }
    }
    return index === 0 && globalCalleeName(parent.callee, scope) === 'open';
  }

  // <a href="javascript:…"> / <a href={'javascript:…'}>
  const attribute =
    parent.type === 'JSXAttribute'
      ? parent
      : parent.type === 'JSXExpressionContainer' &&
          parent.parent &&
          parent.parent.type === 'JSXAttribute'
        ? parent.parent
        : null;
  if (attribute) {
    const name =
      attribute.name.type === 'JSXNamespacedName'
        ? `${attribute.name.namespace.name}:${attribute.name.name.name}`
        : attribute.name.name;
    return URL_ATTRIBUTES.has(String(name).toLowerCase());
  }
  return false;
}

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow javascript: URLs where the URL can run',
      category: 'Security',
      recommended: true,
    },
    messages: {
      // Same wording as core no-script-url — the finding reads the same.
      unexpectedScriptURL: 'Script URL is a form of eval.',
    },
    schema: [],
  },

  create(context) {
    function check(node) {
      if (!isScriptUrl(staticString(node))) return;
      if (isUrlSink(valuePosition(node), context.sourceCode.getScope(node))) {
        context.report({ node, messageId: 'unexpectedScriptURL' });
      }
    }
    return {
      Literal: check,
      TemplateLiteral(node) {
        if (node.parent && node.parent.type === 'TaggedTemplateExpression') return;
        check(node);
      },
    };
  },
};

module.exports = honoringCoreDirectives(rule, 'no-script-url');
