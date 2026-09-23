/**
 * @shoptet/addon-lint-conformance — package entry point.
 *
 * Exports the corpus manifest (`corpus.json`, loaded and parsed — see
 * README.md for its schema) and `materializeShape` (see materialize.js).
 * A consumer that wants raw file access to `corpus.json` (e.g. to hash it
 * for a pinned-content check) can also `require('@shoptet/addon-lint-conformance/corpus.json')`
 * directly.
 */

const corpus = require('./corpus.json');
const { materializeShape } = require('./materialize');

module.exports = { corpus, materializeShape };
