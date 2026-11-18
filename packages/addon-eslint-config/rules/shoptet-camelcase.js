/**
 * I3. camelCase naming — TypeScript variant of core `camelcase`
 *
 * Runs ESLint's own `camelcase` (same options, same messages) on TypeScript
 * files, but drops reports on AMBIENT names: anything declared with `declare`
 * (`declare const shop_config: X`, inside `declare global {}` /
 * `declare module`) and every use of such a name. An ambient declaration
 * describes a value that already exists at runtime — its name is dictated by
 * whoever defined that global, not chosen by the addon author, so a camelCase
 * finding there would be a false positive the author cannot fix.
 *
 * Plain JavaScript keeps core `camelcase` (no `declare` exists there).
 */

const { builtinRules } = require('eslint/use-at-your-own-risk');
const { findVariable } = require('@eslint-community/eslint-utils');
const { isAmbientDef } = require('./global-callee');

const baseRule = builtinRules.get('camelcase');

function insideAmbientDeclaration(node) {
  for (let current = node; current; current = current.parent) {
    if (current.declare === true) return true;
    if (current.type === 'Program') return false;
  }
  return false;
}

module.exports = {
  meta: {
    ...baseRule.meta,
    docs: {
      description: 'Enforce camelCase naming (ambient TypeScript declarations excepted)',
      category: 'Naming',
      recommended: true,
    },
  },

  create(context) {
    function isAmbientName(node) {
      if (!node || node.type !== 'Identifier') return false;
      if (insideAmbientDeclaration(node)) return true;
      const variable = findVariable(context.sourceCode.getScope(node), node);
      return Boolean(variable && variable.defs.length && variable.defs.every(isAmbientDef));
    }

    // The base rule only ever reports through context.report — filter there.
    const filteredContext = Object.create(context, {
      report: {
        value(descriptor) {
          if (isAmbientName(descriptor.node)) return;
          context.report(descriptor);
        },
      },
    });
    return baseRule.create(filteredContext);
  },
};
