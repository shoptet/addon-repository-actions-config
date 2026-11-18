// JSX files ride the TypeScript parser — the JS rules still apply.
import React from 'react';

var legacyCounter = 0;

const Unused = () => <i />;

export const Counter = () => <b>{legacyCounter}</b>;
