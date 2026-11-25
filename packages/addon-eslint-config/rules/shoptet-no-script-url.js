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
 *   - assigned to a DOM URL property spelled exactly `href`, `src`, `action`
 *     or `formAction` (`el.href = …`, `location.href = …`) — not on an object
 *     statically known to be a plain data object (`const fixture = {}`);
 *   - assigned to the browser's location (`location = …`, `window.location =
 *     …`, `document.location = …`; an unshadowed global only);
 *   - passed as the value to `setAttribute('href' | 'src' | 'action' |
 *     'formaction' | 'xlink:href', …)` (also `setAttributeNS`), or to jQuery
 *     `.attr('href', …)` / `.prop('href', …)` (also the object form
 *     `.attr({ href: … })`);
 *   - passed as the only argument to the browser's `location.assign()` /
 *     `location.replace()` (String#replace takes two), or to the global
 *     `open()` (`window.open('javascript:…')`);
 *   - a JSX `href` / `src` / `action` / `formAction` attribute of an intrinsic
 *     element (`<a href="javascript:void(0)">`; a component's prop is not).
 * Type-only wrappers (`'javascript:x' as string`) are looked through. Anything
 * else — comparisons, string-method arguments, array members, a value that
 * reaches a URL through a variable or concatenation — is not reported: false
 * negatives over false positives, the AI review covers intent.
 *
 * An `eslint-disable` naming the core id `no-script-url` still applies
 * (core-id-directives.js), so partners' existing directives keep working.
 */

const { findVariable } = require('@eslint-community/eslint-utils');
const {
  GLOBAL_OBJECTS,
  TS_WRAPPERS,
  globalCalleeName,
  isGlobalBinding,
  memberName,
  unwrapExpr,
} = require('./global-callee');
const { honoringCoreDirectives } = require('./core-id-directives');

// DOM URL properties, by their exact (case-sensitive) JavaScript spelling:
// `link.HREF = …` or `button.formaction = …` only create an expando property
// and never reach a URL setter. `location` is handled on its own (only the
// browser's location object counts).
const URL_PROPERTIES = new Set(['href', 'src', 'action', 'formAction']);
// HTML attribute names, matched case-insensitively (as HTML does) — for
// setAttribute(NS), jQuery .attr() and intrinsic JSX elements.
// `xlinkhref` is React's `xlinkHref` (SVG `<a>`), lower-cased.
const URL_ATTRIBUTES = new Set(['href', 'src', 'action', 'formaction', 'xlink:href', 'xlinkhref']);
// Globals of the browser that are (or hold) a window, whose `.location` is the
// browser's Location: `top.location = …`, `parent.location = …`.
const WINDOW_GLOBALS = new Set([...GLOBAL_OBJECTS, 'top', 'parent', 'opener', 'frames']);
// jQuery .prop() takes PROPERTY names (case-sensitive, like the DOM).
const URL_PROP_NAMES = URL_PROPERTIES;

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

/**
 * A browser window: an unshadowed global `window` / `self` / `globalThis` /
 * `top` / `parent` / `opener` / `frames` / `document`, `window.top` (and the
 * like), or `<frame>.contentWindow` — a DOM-specific name nothing else carries.
 */
function isBrowserWindow(rawNode, scope) {
  const node = unwrapExpr(rawNode);
  if (!node) return false;
  if (node.type === 'Identifier') {
    return (
      (WINDOW_GLOBALS.has(node.name) || node.name === 'document') &&
      isGlobalBinding(scope, node.name)
    );
  }
  if (node.type !== 'MemberExpression') return false;
  const name = memberName(node);
  if (name === 'contentWindow') return true;
  return Boolean(name && WINDOW_GLOBALS.has(name) && isBrowserWindow(node.object, scope));
}

/**
 * The BROWSER's location object: the global `location`, or `.location` of a
 * browser window (see isBrowserWindow). Any other object's `location` (a data
 * record's address string) is not a URL sink.
 */
function isBrowserLocation(rawNode, scope) {
  const node = unwrapExpr(rawNode);
  if (!node) return false;
  if (node.type === 'Identifier') {
    return node.name === 'location' && isGlobalBinding(scope, 'location');
  }
  if (node.type !== 'MemberExpression' || memberName(node) !== 'location') return false;
  return isBrowserWindow(node.object, scope);
}

/**
 * A receiver statically known to be a plain data object: an identifier whose
 * only definition is `const|let|var x = { … }` (or an object literal itself).
 * Writing `href` on it, or calling its own `setAttribute`, stores data — no
 * browser URL setter runs.
 */
function isPlainDataObject(rawNode, scope) {
  const node = unwrapExpr(rawNode);
  if (!node) return false;
  if (node.type === 'ObjectExpression') return true;
  if (node.type !== 'Identifier') return false;
  const variable = findVariable(scope, node);
  if (!variable || variable.defs.length !== 1) return false;
  // Written only by its initializer: `let link = {}; link = createElement('a')`
  // is no longer a plain data object.
  if (variable.references.filter((reference) => reference.isWrite()).length > 1) return false;
  const def = variable.defs[0];
  return Boolean(
    def.type === 'Variable' &&
    def.node.init &&
    unwrapExpr(def.node.init).type === 'ObjectExpression',
  );
}

/** A static name in `names`, compared exactly or case-insensitively. */
function namedIn(node, names, caseInsensitive) {
  const name = staticString(unwrapExpr(node));
  if (typeof name !== 'string') return false;
  return names.has(caseInsensitive ? name.toLowerCase() : name);
}

function assignmentSink(assignment, value, scope) {
  if (assignment.operator !== '=' || assignment.right !== value) return false;
  const left = unwrapExpr(assignment.left);
  if (left.type === 'Identifier') {
    return left.name === 'location' && isGlobalBinding(scope, 'location');
  }
  if (left.type !== 'MemberExpression') return false;
  // window.location = …, document.location = … (the browser's location only)
  if (isBrowserLocation(left, scope)) return true;
  const name = memberName(left);
  return Boolean(name && URL_PROPERTIES.has(name) && !isPlainDataObject(left.object, scope));
}

function callSink(call, value, scope) {
  const index = call.arguments.indexOf(value);
  const callee = unwrapExpr(call.callee);
  if (callee.type === 'MemberExpression') {
    const method = memberName(callee);
    if (method === 'setAttribute' || method === 'setAttributeNS') {
      const nameIndex = method === 'setAttribute' ? 0 : 1;
      return (
        index === nameIndex + 1 &&
        namedIn(call.arguments[nameIndex], URL_ATTRIBUTES, true) &&
        !isPlainDataObject(callee.object, scope)
      );
    }
    // jQuery: $link.attr('href', 'javascript:…') / .prop('href', …)
    if (method === 'attr' || method === 'prop') {
      return (
        index === 1 &&
        !isPlainDataObject(callee.object, scope) &&
        namedIn(
          call.arguments[0],
          method === 'attr' ? URL_ATTRIBUTES : URL_PROP_NAMES,
          method === 'attr',
        )
      );
    }
    // Location.assign / Location.replace take exactly one argument;
    // String.prototype.replace takes two — `item.location.replace('javascript:', '')`
    // is a sanitizer, not navigation.
    if ((method === 'assign' || method === 'replace') && index === 0) {
      return call.arguments.length === 1 && isBrowserLocation(callee.object, scope);
    }
  }
  return index === 0 && globalCalleeName(call.callee, scope) === 'open';
}

/** jQuery's object form: `$link.attr({ href: 'javascript:…' })` / `.prop({ … })`. */
function jqueryObjectSink(property) {
  if (property.type !== 'Property' || property.computed || property.kind !== 'init') return false;
  const object = property.parent;
  const call = object && object.parent;
  if (!call || call.type !== 'CallExpression' || call.arguments[0] !== object) return false;
  const callee = unwrapExpr(call.callee);
  if (callee.type !== 'MemberExpression') return false;
  const method = memberName(callee);
  if (method !== 'attr' && method !== 'prop') return false;
  const key = property.key.type === 'Identifier' ? property.key.name : staticString(property.key);
  if (typeof key !== 'string') return false;
  return method === 'attr' ? URL_ATTRIBUTES.has(key.toLowerCase()) : URL_PROP_NAMES.has(key);
}

/**
 * A JSX attribute on an INTRINSIC element (`<a>`, `<iframe>`, lower-case
 * tag). A component's prop named `href` (`<Preview href="…">`) may only be
 * displayed — whether a component forwards it to a URL is the contextual
 * review's call, not a syntactic one.
 */
function jsxAttributeSink(attribute) {
  const element = attribute.parent;
  if (!element || element.type !== 'JSXOpeningElement') return false;
  if (element.name.type !== 'JSXIdentifier' || !/^[a-z]/.test(element.name.name)) return false;
  const name =
    attribute.name.type === 'JSXNamespacedName'
      ? `${attribute.name.namespace.name}:${attribute.name.name.name}`
      : attribute.name.name;
  return URL_ATTRIBUTES.has(String(name).toLowerCase());
}

/** Is `value` (a literal, possibly type-wrapped) in a position where the URL runs? */
function isUrlSink(value, scope) {
  const parent = value.parent;
  if (!parent) return false;
  if (parent.type === 'AssignmentExpression') return assignmentSink(parent, value, scope);
  if (parent.type === 'CallExpression' && parent.arguments.includes(value)) {
    return callSink(parent, value, scope);
  }
  if (parent.type === 'Property' && parent.value === value) return jqueryObjectSink(parent);
  if (parent.type === 'JSXAttribute') return jsxAttributeSink(parent);
  if (
    parent.type === 'JSXExpressionContainer' &&
    parent.parent &&
    parent.parent.type === 'JSXAttribute'
  ) {
    return jsxAttributeSink(parent.parent);
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
