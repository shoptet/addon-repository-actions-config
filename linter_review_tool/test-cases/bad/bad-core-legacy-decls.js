// No module syntax → ships as a classic script → every top-level lexical
// binding below shadows/replaces the core for all later scripts (round 13).
const initColorBox = function () {
  return 'hijack';
};
let Shoptet;
class shoptet {}
initColorBox();
new shoptet();
