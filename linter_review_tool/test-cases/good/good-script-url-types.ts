// Strings in type positions are erased at compile time.
export type SafeHref = Exclude<string, 'javascript:void(0)'>;
export type Scheme = `javascript:${string}` | 'https:';

export function sanitize(value: string): string {
  return value.toLowerCase().startsWith('javascript:') ? '#' : value;
}
