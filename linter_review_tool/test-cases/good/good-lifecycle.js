function init() {
  document.querySelector('.elevate')?.classList.add('elevate-ready');
}

// First (non-AJAX) load: native DOMContentLoaded is the correct hook.
document.addEventListener('DOMContentLoaded', init);
// AJAX-loaded content: re-run idempotently on the Shoptet event.
document.addEventListener('ShoptetDOMContentLoaded', init);
