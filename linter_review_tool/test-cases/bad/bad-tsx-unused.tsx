// Only import bindings of factory names are exempt, and only the named rule
// is silenced by a directive.
import { unusedHelper } from './helpers';

const h = 5;

// eslint-disable-next-line no-console
const stillReported = 1;

/* eslint-disable no-unused-vars */
const silenced = 1;
/* eslint-enable no-unused-vars */
const reportedAgain = 1;

export const View = () => <div className="view" />;
