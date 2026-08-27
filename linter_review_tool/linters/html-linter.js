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
  'acronym',
  'applet',
  'dir',
  'basefont',
  'frame',
  'frameset',
  'xmp',
  'plaintext',
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

  // J — image without alt (alt="" is allowed for decorative images).
  // Templating guard: a placeholder in ATTRIBUTE POSITION (<img {{alt_attr}}>)
  // breaks parse5's tokenization — the attribute set cannot be trusted, so
  // don't claim alt is missing (FN over FP; round 13). Legal HTML attribute
  // names never contain braces, so this can't misfire on real markup.
  const brokenTokenization = Object.keys(attrs).some((name) => name.includes('{{') || name.includes('}}'));
  if (tag === 'img' && !('alt' in attrs) && !brokenTokenization) {
    add(
      findings, file, node, 'a11y/img-alt',
      'Image is missing an alt attribute (use alt="" for decorative images).',
      'blocker'
    );
  }

  // Inline JS is a whole-category coverage gap: this linter never lints script
  // TEXT, so every shoptet/* and core-JS blocker could hide behind a green
  // check (round 14). Policy blocker, same spirit as es-module-required:
  // JS belongs in .js files, where the full rule set applies. Deterministic
  // cut: a non-empty script element whose type is missing or a JS MIME —
  // external scripts (src=, empty content) and DATA blocks (ld+json,
  // text/template, …) are not executable inline JS and never flag.
  if (tag === 'script') {
    // MIME essence only — browsers execute `text/javascript;charset=utf-8`,
    // so parameters must not evade the blocker (post-approval nit).
    const type = (attrs.type || '').split(';')[0].trim().toLowerCase();
    const isJs = type === '' || type === 'module' || type === 'text/javascript' || type === 'application/javascript';
    const text = (node.childNodes || [])
      .filter((child) => child.nodeName === '#text')
      .map((child) => child.value)
      .join('');
    if (isJs && text.trim() !== '') {
      add(
        findings, file, node, 'html/no-inline-script',
        'Inline script content is not linted — move the code to a .js file in src/, where the full rule set applies.',
        'blocker'
      );
    }
  }
}

// Iterative (explicit stack) — recursion would overflow on pathologically deep
// markup and crash the whole run.
function walk(root, file, findings) {
  const stack = [root];
  while (stack.length) {
    const node = stack.pop();
    if (node.tagName) checkElement(node, file, findings);
    // parse5 stores <template> children on node.content (a DocumentFragment),
    // not childNodes — without this, template markup would escape all checks.
    if (node.content) stack.push(node.content);
    for (const child of node.childNodes || []) stack.push(child);
  }
}

function lintHtml(files) {
  const findings = [];
  for (const file of files) {
    let html;
    try {
      html = fs.readFileSync(file, 'utf8');
    } catch (error) {
      // Fail closed: an unreadable file must not silently pass as clean.
      findings.push({
        file,
        line: 1,
        column: 1,
        message: `Could not read file: ${error.message}`,
        ruleId: 'CodeQuality',
        severity: 'blocker',
      });
      continue;
    }
    const document = parse5.parse(html, { sourceCodeLocationInfo: true });
    walk(document, file, findings);
  }
  return findings;
}

module.exports = { lintHtml };
