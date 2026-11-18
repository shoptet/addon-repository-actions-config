// TypeScript counterparts of the JS dead-code / TDZ blockers.
const unusedLocal = 1;

export const early = later + 1;
const later = 2;

export function noop(value: number): void {
  value + 1;
}
