// A `.js` file with JSX is linted with the full rule set, so its real
// blockers are reported — not hidden behind a parse error.
export function Widget({ code }) {
  eval(code);
  return <div />;
}
