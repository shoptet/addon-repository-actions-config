// Top-level await parses ONLY as a module — this file cannot ship as a
// classic script, so its top-level function is module-local (round 13 pin
// for the script-parse detection).
const settings = await fetch('/api/settings').then((response) => response.json());
function initColorBox() {
  return settings;
}
document.title = initColorBox().title;
