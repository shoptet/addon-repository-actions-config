/**
 * HTML linter — factual DOM checks: missing image alt (a11y) and deprecated
 * tags. Uses parse5 for accurate source positions.
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
