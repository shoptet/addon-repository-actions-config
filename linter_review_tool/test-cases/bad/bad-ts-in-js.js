// TypeScript syntax in a `.js` file stays a parse error, also next to JSX:
// the JSX retry accepts only what espree parses as JavaScript with JSX.
export const count: number = 1;
export const View = () => <i />;
