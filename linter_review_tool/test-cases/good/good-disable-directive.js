// A no-undef disable is legitimately "unused" (no-undef is 'off' in this
// profile) — reportUnusedDisableDirectives must stay off or this triggers a
// bogus CodeQuality warning routed through ruleId: null.
// eslint-disable-next-line no-undef
export const x = window.foo;
