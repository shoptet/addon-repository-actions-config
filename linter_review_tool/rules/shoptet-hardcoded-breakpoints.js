/**
 * B2. Breakpoints must come from Shoptet
 *
 * Flags hardcoded viewport breakpoints instead of reading
 * shoptet.config.breakpoints. Detects:
 *   - matchMedia('... <number>px ...')
 *   - comparisons of window.innerWidth / outerWidth / screen.width to a number
 */

const PX_IN_MEDIA = /\d+\s*px/i;
const WIDTH_PROPS = new Set(['innerWidth', 'outerWidth', 'clientWidth']);
const COMPARISON_OPS = new Set(['<', '>', '<=', '>=', '===', '!==', '==', '!=']);

function isWidthMember(node) {
  if (!node || node.type !== 'MemberExpression' || !node.property) return false;
  if (WIDTH_PROPS.has(node.property.name)) return true;
  // screen.width
  return (
    node.property.name === 'width' &&
    node.object.type === 'Identifier' &&
    node.object.name === 'screen'
  );
}

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow hardcoded breakpoints; use shoptet.config.breakpoints',
      category: 'Shoptet',
      recommended: true,
    },
    messages: {
      hardcoded:
        'Hardcoded breakpoint. Read viewport widths from shoptet.config.breakpoints instead.',
    },
    schema: [],
  },

  create(context) {
    return {
      CallExpression(node) {
        const { callee } = node;
        const isMatchMedia =
          (callee.type === 'Identifier' && callee.name === 'matchMedia') ||
          (callee.type === 'MemberExpression' &&
            callee.property &&
            callee.property.name === 'matchMedia');

        if (
          isMatchMedia &&
          node.arguments.length &&
          node.arguments[0].type === 'Literal' &&
          typeof node.arguments[0].value === 'string' &&
          PX_IN_MEDIA.test(node.arguments[0].value)
        ) {
          context.report({ node: node.arguments[0], messageId: 'hardcoded' });
        }
      },

      BinaryExpression(node) {
        if (!COMPARISON_OPS.has(node.operator)) return;

        const left = node.left;
        const right = node.right;
        const widthVsNumber =
          (isWidthMember(left) && right.type === 'Literal' && typeof right.value === 'number') ||
          (isWidthMember(right) && left.type === 'Literal' && typeof left.value === 'number');

        if (widthVsNumber) {
          context.report({ node, messageId: 'hardcoded' });
        }
      },
    };
  },
};
