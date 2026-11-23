// Directives naming the CORE rule id keep working on TypeScript, where the
// rule runs under a replacement id (@typescript-eslint/…, shoptet/camelcase).
// eslint-disable-next-line no-unused-vars
const keptForDebugging = 1;

export const early = later + 1; // eslint-disable-line no-use-before-define
const later = 2;

export function touch(value: number): void {
  /* eslint-disable no-unused-expressions -- probing a getter on purpose */
  value + 1;
  /* eslint-enable no-unused-expressions */
}

// eslint-disable-next-line camelcase
export const legacy_name = 1;
