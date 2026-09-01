// Delay spellings that coerce to 0 at runtime must not evade the blocker.
setTimeout(initA, null);
setTimeout(initB, false);
setTimeout(initC, '');
setTimeout(initD, undefined);
setTimeout(initE, void 0);
setTimeout(initF, []);
setTimeout(initG, 0.4);
setTimeout(initH, -1);
