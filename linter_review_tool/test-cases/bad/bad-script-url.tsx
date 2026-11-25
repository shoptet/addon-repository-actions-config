// The same on TypeScript/JSX, through type wrappers and JSX attributes.
export function wire(link: HTMLAnchorElement): void {
  (link as any).href = 'javascript:void(0)';
  link.href = 'javascript:void(0)' as string;
  (window as any).location.href = 'javascript:void(0)';
}

export const Link = () => <a href="javascript:void(0)">x</a>;
export const Frame = () => <iframe src={'javascript:void(0)'} />;
