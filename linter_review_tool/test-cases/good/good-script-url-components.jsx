// A component's prop named href may only be displayed — whether a component
// forwards it to a URL is the contextual review's call, not a syntactic one.
const Preview = ({ href }) => <code>{href}</code>;
const ui = { Link: Preview };

export const Examples = () => (
  <div>
    <Preview href="javascript:alert(1)" />
    <ui.Link href="javascript:alert(1)" />
  </div>
);
