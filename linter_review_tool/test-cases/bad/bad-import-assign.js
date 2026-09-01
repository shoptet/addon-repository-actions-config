// no-import-assign: reassigning an import binding is a runtime TypeError.
import { helper } from './utils.js';

helper = null;
export { helper };
