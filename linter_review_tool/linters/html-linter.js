/**
 * HTML accessibility linter — covers PRIRUCKA sections J (accessibility),
 * H2 (deprecated tags) and A5 (target="_blank"). Uses parse5 for accurate
 * source positions.
 */

const fs = require('fs');
const parse5 = require('parse5');

const DEPRECATED_TAGS = new Set([
  'big',
  'center',
  'font',
  'marquee',
  'blink',
  'tt',
  'strike',
]);

function getAttrs(node) {
  const map = {};
  for (const attr of node.attrs || []) {
    map[attr.name.toLowerCase()] = attr.value;
  }
  return map;
}

function getText(node) {
  let text = '';
  const stack = [...(node.childNodes || [])];
  while (stack.length) {
    const current = stack.pop();
    if (current.nodeName === '#text') text += current.value;
    if (current.childNodes) stack.push(...current.childNodes);
  }
  return text.trim();
}

function containsImageWithAlt(node) {
  const stack = [...(node.childNodes || [])];
  while (stack.length) {
    const current = stack.pop();
    if (current.tagName === 'img') {
      const attrs = getAttrs(current);
      if ('alt' in attrs && attrs.alt.trim() !== '') return true;
    }
    if (current.childNodes) stack.push(...current.childNodes);
  }
  return false;
}

function location(node) {
  const loc = node.sourceCodeLocation;
  return {
    line: (loc && loc.startLine) || 1,
    column: (loc && loc.startCol) || 1,
  };
}

function add(findings, file, node, ruleId, message, severity) {
  const { line, column } = location(node);
  findings.push({ file, line, column, message, ruleId, severity });
}

function checkElement(node, file, findings) {
  const tag = node.tagName;
  if (!tag) return;
  const attrs = getAttrs(node);

  // H2 — deprecated tags
  if (DEPRECATED_TAGS.has(tag)) {
    add(
      findings, file, node, 'html/deprecated-tag',
      `Deprecated <${tag}> tag. Use a semantic element with a CSS class instead.`,
      'recommend'
    );
  }

  // J — image without alt (alt="" is allowed for decorative images)
  if (tag === 'img' && !('alt' in attrs)) {
    add(
      findings, file, node, 'a11y/img-alt',
      'Image is missing an alt attribute (use alt="" for decorative images).',
      'blocker'
    );
  }

  // J1 — clickable non-interactive element
  if ((tag === 'div' || tag === 'span') && 'onclick' in attrs) {
    add(
      findings, file, node, 'a11y/clickable-noninteractive',
      `Clickable <${tag}> — use a <button> (or add role + tabindex + keyboard handler).`,
      'recommend'
    );
  }

  // J2 — interactive element without an accessible name
  if (tag === 'a' || tag === 'button') {
    const hasName =
      getText(node) !== '' ||
      'aria-label' in attrs ||
      'aria-labelledby' in attrs ||
      'title' in attrs ||
      containsImageWithAlt(node);
    if (!hasName) {
      add(
        findings, file, node, 'a11y/empty-interactive',
        `<${tag}> has no accessible name. Add text content or an aria-label.`,
        'recommend'
      );
    }
  }

  // A5 — target="_blank" without rel="noopener"
  if (tag === 'a' && attrs.target === '_blank' && !/noopener/i.test(attrs.rel || '')) {
    add(
      findings, file, node, 'a11y/target-blank',
      'target="_blank" without rel="noopener noreferrer" (window.opener risk).',
      'recommend'
    );
  }

  // J2 — autoplay media without controls (WCAG 2.2.2)
  if (
    (tag === 'video' || tag === 'audio') &&
    'autoplay' in attrs &&
    !('controls' in attrs)
  ) {
    add(
      findings, file, node, 'a11y/autoplay-no-controls',
      `<${tag} autoplay> without controls. Provide a pause control (WCAG 2.2.2).`,
      'recommend'
    );
  }
}

function walk(node, file, findings) {
  if (node.tagName) checkElement(node, file, findings);
  for (const child of node.childNodes || []) {
    walk(child, file, findings);
  }
}

function lintHtml(files) {
  const findings = [];
  for (const file of files) {
    let html;
    try {
      html = fs.readFileSync(file, 'utf8');
    } catch (error) {
      continue;
    }
    const document = parse5.parse(html, { sourceCodeLocationInfo: true });
    walk(document, file, findings);
  }
  return findings;
}

module.exports = { lintHtml };
