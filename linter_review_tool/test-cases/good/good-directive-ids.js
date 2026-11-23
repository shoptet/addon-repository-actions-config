// Directives naming rules this file's config does not run — a typescript-eslint
// id in a mixed TS/JS repository, a runner-only id, another plugin's rule —
// are comments ESLint cannot apply, never a defect: no finding.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function handler(event) {
  return event;
}

// eslint-disable-next-line @typescript-eslint/no-use-before-define, @typescript-eslint/no-unused-expressions
export const total = 1;

// eslint-disable-next-line shoptet/es-module-required
export const legacy = 2;

/* eslint-disable CodeQuality */
export const quality = 3;
/* eslint-enable CodeQuality */

// eslint-disable-next-line react-hooks/exhaustive-deps
export const hooks = 4;
