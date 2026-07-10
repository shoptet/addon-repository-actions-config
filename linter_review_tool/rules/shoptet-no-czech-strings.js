/**
 * I2 / I4. Localization holes
 *
 * - Hardcoded Czech/Slovak text in string literals (I2) — should live in a
 *   translations file, not in logic.
 * - Hardcoded locales in toLocaleString / Intl.* (I4) — derive the locale from
 *   getShoptetDataLayer('language') so number/price/date formats are correct
 *   across markets.
 */

const DIACRITICS = /[áäčďéěíĺľňóôŕřšťúůýž]/i;
const LOCALE_METHODS = new Set([
  'toLocaleString',
  'toLocaleDateString',
  'toLocaleTimeString',
]);
const INTL_FORMATTERS = new Set(['NumberFormat', 'DateTimeFormat', 'RelativeTimeFormat']);

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow hardcoded Czech/Slovak strings and hardcoded locales',
      category: 'Localization',
      recommended: true,
    },
    messages: {
      czechText:
        'Hardcoded localized text. Move UI strings to a translations file and support multiple languages (I2).',
      hardcodedLocale:
        'Hardcoded locale "{{locale}}". Derive it from getShoptetDataLayer("language") so formats match the market (I4).',
    },
    schema: [],
  },

  create(context) {
    function checkLocaleArg(node, arg) {
      if (arg && arg.type === 'Literal' && typeof arg.value === 'string' && arg.value) {
        context.report({
          node,
          messageId: 'hardcodedLocale',
          data: { locale: arg.value },
        });
      }
    }

    return {
      Literal(node) {
        if (typeof node.value === 'string' && DIACRITICS.test(node.value)) {
          context.report({ node, messageId: 'czechText' });
        }
      },

      TemplateLiteral(node) {
        const text = node.quasis.map((q) => q.value.cooked).join('');
        if (DIACRITICS.test(text)) {
          context.report({ node, messageId: 'czechText' });
        }
      },

      CallExpression(node) {
        const { callee } = node;
        if (
          callee.type === 'MemberExpression' &&
          callee.property &&
          LOCALE_METHODS.has(callee.property.name)
        ) {
          checkLocaleArg(node, node.arguments[0]);
        }
      },

      NewExpression(node) {
        const { callee } = node;
        if (
          callee.type === 'MemberExpression' &&
          callee.object.name === 'Intl' &&
          callee.property &&
          INTL_FORMATTERS.has(callee.property.name)
        ) {
          checkLocaleArg(node, node.arguments[0]);
        }
      },
    };
  },
};
