function buildLink(url, target) {
  // A5: target="_blank" without rel
  const html = `<a href="${url}" target="_blank">link</a>`;

  // E4: loose equality — a DANGEROUS compare ('' == 0 is true); `== null` is
  // the allowed nullish-guard exception and must NOT be used here.
  if (target == '') {
    return html;
  }

  // A3: param reassignment
  url = url.trim();

  // B2: hardcoded breakpoint
  if (window.innerWidth < 768) {
    return html;
  }

  // B4: redundant Shoptet check
  if (typeof shoptet !== 'undefined') {
    return html;
  }

  // E7: localStorage without try/catch
  localStorage.setItem('myKey', url);

  return html;
}
