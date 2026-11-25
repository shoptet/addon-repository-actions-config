// Code that DEFENDS against javascript: URLs must not fail the gate: the
// string is data here, never a URL that runs (CZ3TDR1-959).
const BLOCKED_SCHEMES = ['javascript:', 'data:', 'vbscript:'];

export function isScriptUrl(value) {
  const cleaned = value.replace(/[\t\n\r]/g, '').trim().toLowerCase();
  return cleaned.slice(0, 'javascript:'.length).startsWith('javascript:');
}

export function isBlocked(url) {
  return BLOCKED_SCHEMES.some((scheme) => url.toLowerCase().startsWith(scheme));
}

export function isVoidLink(href) {
  return href === 'javascript:void(0)' || href.indexOf('javascript:') === 0;
}

export const message = `Links starting with javascript: are removed.`;

// A javascript: URL that can run, silenced with the CORE id: partners'
// existing directives keep working after the rule became shoptet/no-script-url.
export function makeInert(link) {
  // eslint-disable-next-line no-script-url
  link.href = 'javascript:void(0)';
}

// Not URL sinks: a String#replace on a data record's `location` (two
// arguments, unlike Location#replace), a shadowed `window`, expando
// properties with the wrong case, and plain data objects.
export function sanitizeRecord(record) {
  return record.location.replace('javascript:', '');
}

export function withOwnWindow(window) {
  window.location = 'javascript:void(0)';
}

export function expandos(link, button) {
  link.HREF = 'javascript:void(0)';
  button.formaction = 'javascript:void(0)';
}

export function dataOnly() {
  const fixture = {};
  fixture.href = 'javascript:void(0)';
  const fake = { setAttribute() {} };
  fake.setAttribute('href', 'javascript:void(0)');
  return [fixture, fake];
}

// A plain data object's own attr(), and a shadowed `top`.
export function moreData(top) {
  const opts = { attr() {} };
  opts.attr('href', 'javascript:void(0)');
  top.location = 'javascript:void(0)';
  return opts;
}
