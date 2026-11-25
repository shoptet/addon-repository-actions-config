// Every javascript: URL below can run — each one is a blocker.
export function wire(link, frame, form, button) {
  link.href = 'javascript:void(0)';
  frame.src = `javascript:alert(1)`;
  form.action = 'JavaScript:submitIt()';
  button.formAction = 'javascript:go()';
  link.setAttribute('href', 'javascript:void(0)');
  link.setAttributeNS(null, 'href', 'javascript:void(0)');
  window.location = 'javascript:void(0)';
  location.href = 'javascript:void(0)';
  window.location.assign('javascript:void(0)');
  location.replace('javascript:void(0)');
  window.open('javascript:void(0)');
  document.location = 'javascript:void(0)';
}

// jQuery — the everyday Shoptet spelling — in all three forms.
export function wireJquery($link) {
  $link.attr('href', 'javascript:void(0)');
  $link.prop('href', 'javascript:void(0)');
  $link.attr({ href: 'javascript:void(0)' });
}

// Every browser window's location, and a variable re-bound from a plain
// object to a real element.
export function wireWindows(iframe) {
  top.location = 'javascript:void(0)';
  parent.location = 'javascript:void(0)';
  iframe.contentWindow.location = 'javascript:void(0)';
  window.top.location = 'javascript:void(0)';
  opener.location.replace('javascript:void(0)');
  let link = {};
  link = document.createElement('a');
  link.href = 'javascript:void(0)';
}
