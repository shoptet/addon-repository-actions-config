// TypeScript counterparts of the JS dead-code / TDZ blockers.
const unusedLocal = 1;

export const early = later + 1;
const later = 2;

export function noop(value: number): void {
  value + 1;
}

// Only `_` is exempt: any other unused destructured name is still dead code.
export function firstOnly(parts: string[]): string {
  const [first, unusedSecond] = parts;
  return first;
}

// A real `var` on TypeScript is still reported (shoptet/no-var).
export var legacyTotal = 0;
