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
