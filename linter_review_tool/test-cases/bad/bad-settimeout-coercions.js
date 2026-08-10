// Delay spellings that coerce to 0 at runtime must not evade the blocker.
setTimeout(initA, null);
setTimeout(initB, false);
setTimeout(initC, '');
setTimeout(initD, undefined);
setTimeout(initE, void 0);
