/**
 * D1. No `var` — TypeScript variant of core `no-var`
 *
 * Runs ESLint's own `no-var` (same messages) on TypeScript files, but drops
 * reports on AMBIENT declarations: `declare var shoptet: X` at the top level
 * and `var` inside `declare module 'x' { … }` / `declare namespace`. Core
 * `no-var` has no TypeScript awareness — it skips only `var` inside
 * `declare global {}`. An ambient declaration compiles to nothing, so there
 * is no `var` binding at runtime to replace (the same "emits no code" cut as
 * no-unused-vars, camelcase and no-core-overwrite make on TypeScript).
 *
 * An `eslint-disable` naming the core id `no-var` still applies
 * (core-id-directives.js). Plain JavaScript and `.jsx` keep core `no-var`
 * (no `declare` exists there).
 */

const { builtinRules } = require('eslint/use-at-your-own-risk');
const { honoringCoreDirectives } = require('./core-id-directives');

const coreRule = builtinRules.get('no-var');

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
      description: 'Require let or const instead of var (ambient TypeScript declarations excepted)',
      category: 'Shoptet',
      recommended: true,
    },
  },

  create(context) {
    return honoringCoreDirectives(coreRule, 'no-var', (descriptor) =>
      insideAmbientDeclaration(descriptor.node),
    ).create(context);
  },
};
