// Wired from markup (onclick="openSizeChart()") — no module syntax on purpose:
// the callers live in HTML, so "defined but never used" would be a false claim.
function openSizeChart() {
  document.querySelector('.size-chart').classList.add('open');
}
