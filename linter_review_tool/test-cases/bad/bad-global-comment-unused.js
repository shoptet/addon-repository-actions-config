// Only the comment's own entries are dropped: an unused variable in code
// stays reported, also one named like a comment entry, and also one glued to
// the comment's closing delimiter.
/* global myAddonRuntime, helper */
const helper = 1;
/* global legacyFlag */const legacyFlag = 1;
// see /* global note
const note = 1;
/** docs */

export function run() {
  const unused = 1;
}
