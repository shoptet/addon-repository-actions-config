// Babel reads the pragma from any comment whose line holds it alone,
// even after code.
import m from 'mithril';

/** @jsx m */
export const View = () => <div className="view">hi</div>;
