/**
 * J / H2 in JS-generated DOM
 *
 * Addons build most of their markup as HTML strings in JS, so the standalone
 * HTML linter never sees it. This rule scans string/template literals that
 * contain HTML for the most common accessibility / deprecated-tag problems:
 *   - <img …> without alt          (J)
 *   - clickable <div>/<span> with onclick / role=button without tabindex (J1)
 *   - deprecated tags <big>/<center>/<font>/…                            (H2)
 */

const IMG_NO_ALT = /<img\b(?![^>]*\balt\s*=)[^>]*>/i;
const CLICKABLE_DIV = /<(div|span)\b[^>]*\bonclick\s*=/i;
const DEPRECATED_TAG = /<(big|center|font|marquee|blink|tt|strike)\b/i;

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Accessibility/deprecated-tag checks for HTML built in JS strings',
      category: 'Accessibility',
      recommended: true,
    },
    messages: {
      imgAlt: 'HTML string builds an <img> without alt. Add alt (use alt="" if decorative) (J).',
      clickableDiv:
        'Clickable <{{tag}}> in HTML string. Use <button> (or add role + tabindex + keyboard handler) (J1).',
      deprecatedTag: 'Deprecated <{{tag}}> tag in HTML string. Use a semantic element with a CSS class (H2).',
    },
    schema: [],
  },

  create(context) {
    function check(node, text) {
      if (typeof text !== 'string' || text.indexOf('<') === -1) return;

      if (IMG_NO_ALT.test(text)) {
        context.report({ node, messageId: 'imgAlt' });
      }
      const clickable = CLICKABLE_DIV.exec(text);
      if (clickable) {
        context.report({ node, messageId: 'clickableDiv', data: { tag: clickable[1] } });
      }
      const deprecated = DEPRECATED_TAG.exec(text);
      if (deprecated) {
        context.report({ node, messageId: 'deprecatedTag', data: { tag: deprecated[1] } });
      }
    }

    return {
      Literal(node) {
        if (typeof node.value === 'string') check(node, node.value);
      },
      TemplateLiteral(node) {
        check(node, node.quasis.map((q) => q.value.cooked).join(' '));
      },
    };
  },
};
