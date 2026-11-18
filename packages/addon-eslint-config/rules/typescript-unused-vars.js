/**
 * `@typescript-eslint/no-unused-vars` without its "only used as a type" reports.
 *
 * Shared helper, not a `shoptet/*` rule: the config registers it under the
 * upstream id (`@typescript-eslint/no-unused-vars`), so a partner's existing
 * `eslint-disable … @typescript-eslint/no-unused-vars` comment keeps working
 * and the finding reads exactly like upstream.
 *
 * The upstream rule reports a value whose only uses are in type positions
 * (`messageId: 'usedOnlyAsType'`): `declare const brand: unique symbol` used as
 * `typeof brand`, or `const TABLE = {…}` used as `keyof typeof TABLE`. Both are
 * everyday TypeScript idioms the compiler itself counts as used (no TS6133
 * under `noUnusedLocals`), so for this gate they are false positives. Every
 * other report (`unusedVar`, …) passes through untouched.
 */

function withoutTypeOnlyUses(baseRule) {
  return {
    ...baseRule,
    create(context) {
      const filteredContext = Object.create(context, {
        report: {
          value(descriptor) {
            if (descriptor.messageId === 'usedOnlyAsType') return;
            context.report(descriptor);
          },
        },
      });
      return baseRule.create(filteredContext);
    },
  };
}

module.exports = { withoutTypeOnlyUses };
