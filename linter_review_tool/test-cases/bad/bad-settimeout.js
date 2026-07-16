function init() {
  setTimeout(initWidget, 0); // no-settimeout-hack (blocker)
  setTimeout(pollForCore, 50); // prefer-shoptet-init (recommend) — wait/polling hack
}

init();
