// CommonJS: the loader wraps the file in a module function, so a top-level
// binding named like the core is function-scoped and never reaches the global.
const shoptet = require('./api');

function initColorBox() {
  return shoptet;
}

module.exports = { initColorBox };
