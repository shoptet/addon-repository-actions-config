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
 * A TypeScript parameter property (`constructor(private base_url: string)`)
 * is a class property as much as a parameter, and the profile does not check
 * property names (`properties: 'never'`) — so it, and its uses, are exempt
 * too. An `eslint-disable` naming the core id `camelcase` still applies
 * (core-id-directives.js), as it would on JavaScript.
 *
 * Plain JavaScript keeps core `camelcase` (no `declare` exists there).
 */

const { builtinRules } = require('eslint/use-at-your-own-risk');
const { findVariable } = require('@eslint-community/eslint-utils');
const { isAmbientDef } = require('./global-callee');
const { honoringCoreDirectives } = require('./core-id-directives');

const coreRule = builtinRules.get('camelcase');

/** A parameter declared as a class property (`constructor(private x)`). */
function isParameterPropertyDef(def) {
  return (
    def.type === 'Parameter' && def.name.parent && def.name.parent.type === 'TSParameterProperty'
  );
}

function insideAmbientDeclaration(node) {
  for (let current = node; current; current = current.parent) {
    if (current.declare === true) return true;
    if (current.type === 'Program') return false;
  }
  return false;
}

module.exports = {
  meta: {
    ...coreRule.meta,
    docs: {
      description: 'Enforce camelCase naming (ambient TypeScript declarations excepted)',
      category: 'Naming',
      recommended: true,
    },
  },

  create(context) {
    function isExemptName(descriptor) {
      const node = descriptor.node;
      if (!node || node.type !== 'Identifier') return false;
      if (insideAmbientDeclaration(node)) return true;
      if (node.parent && node.parent.type === 'TSParameterProperty') return true;
      const variable = findVariable(context.sourceCode.getScope(node), node);
      if (!variable || variable.defs.length === 0) return false;
      return variable.defs.every(isAmbientDef) || variable.defs.every(isParameterPropertyDef);
    }

    // The core rule only ever reports through context.report — filtered there.
    return honoringCoreDirectives(coreRule, 'camelcase', isExemptName).create(context);
  },
};
