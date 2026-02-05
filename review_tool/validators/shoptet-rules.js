const parser = require('@babel/parser');

function parseCode(code) {
  try {
    return parser.parse(code, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx']
    });
  } catch (error) {
    console.warn('Parse error:', error.message);
    return null;
  }
}

function traverse(node, visitors, parent = null) {
  if (!node || typeof node !== 'object') return;
  
  const nodeType = node.type;
  if (visitors[nodeType]) {
    visitors[nodeType](node, parent);
  }
  
  for (const key in node) {
    if (key === 'loc' || key === 'start' || key === 'end') continue;
    const child = node[key];
    if (Array.isArray(child)) {
      child.forEach(c => traverse(c, visitors, node));
    } else if (child && typeof child === 'object') {
      traverse(child, visitors, node);
    }
  }
}

function validateShoptetCache(code) {
  const violations = [];
  const ast = parseCode(code);
  if (!ast) return violations;
  
  const shoptetDomainPattern = /\.(shoptet\.cz|myshoptet\.com)/;
  const cachePattern = /\/cache\//;
  
  traverse(ast, {
    CallExpression(node) {
      if (node.callee.type === 'Identifier' && node.callee.name === 'fetch') {
        if (node.arguments.length > 0) {
          const firstArg = node.arguments[0];
          if (firstArg.type === 'StringLiteral' || firstArg.type === 'Literal') {
            const url = firstArg.value;
            if (typeof url === 'string' && shoptetDomainPattern.test(url) && !cachePattern.test(url)) {
              violations.push({
                line: node.loc.start.line,
                column: node.loc.start.column,
                message: 'Chybí /cache/ v XHR volání na Shoptet server'
              });
            }
          }
        }
      }
      
      if (node.callee.type === 'MemberExpression' && 
          node.callee.object.name === '$' &&
          (node.callee.property.name === 'post' || node.callee.property.name === 'get' || node.callee.property.name === 'ajax')) {
        if (node.arguments.length > 0) {
          const firstArg = node.arguments[0];
          if (firstArg.type === 'StringLiteral' || firstArg.type === 'Literal') {
            const url = firstArg.value;
            if (typeof url === 'string' && shoptetDomainPattern.test(url) && !cachePattern.test(url)) {
              violations.push({
                line: node.loc.start.line,
                column: node.loc.start.column,
                message: 'Chybí /cache/ v jQuery AJAX volání na Shoptet server'
              });
            }
          }
        }
      }
    },
    
    NewExpression(node) {
      if (node.callee.type === 'Identifier' && node.callee.name === 'XMLHttpRequest') {
        violations.push({
          line: node.loc.start.line,
          column: node.loc.start.column,
          message: 'XMLHttpRequest detekován - zkontrolovat, zda používá /cache/ pro Shoptet API'
        });
      }
    }
  });
  
  return violations;
}

module.exports = validateShoptetCache;
