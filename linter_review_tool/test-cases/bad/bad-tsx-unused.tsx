// Only import bindings of factory names are exempt, and only the named rule
// is silenced by a directive.
import { unusedHelper } from './helpers';
import { notAFactory } from './factories';

const h = 5;

// eslint-disable-next-line no-console
const stillReported = 1;

/* eslint-disable no-unused-vars */
const silenced = 1;
/* eslint-enable no-unused-vars */
const reportedAgain = 1;

// A bare eslint-enable re-enables every rule, the core id included.
/* eslint-disable no-unused-vars */
const silencedToo = 1;
/* eslint-enable */
const afterBareEnable = 1;

// Neither compiler reads a pragma from prose: the factory: @jsx notAFactory

export const View = () => <div className="view" />;

// ESLint ignores eslint-disable in a line comment, and so does the wrapper.
// eslint-disable no-unused-vars
const lineDisableIgnored = 1;
