// JSX files ride the TypeScript parser — the JS rules still apply.
import React from 'react';

var legacyCounter = 0;

const Unused = () => <i />;

export const Counter = () => <b>{legacyCounter}</b>;

// .jsx keeps the core no-redeclare: no tsc runs there to catch this.
export function render() {
  return 1;
}
function render() {
  return 2;
}
