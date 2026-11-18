// Global-object and type-wrapper spellings of banned calls.
export {};

const DELAY = 0 as const;

export function run(done: () => void): void {
  (window as any).console.log('debug');
  (window as any).setTimeout(done, 0);
  setTimeout(done, 0 as number);
  setTimeout(done, DELAY);
  const request = new (window as any).XMLHttpRequest();
  request.open('GET', '/x');
}
