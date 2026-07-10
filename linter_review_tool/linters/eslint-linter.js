/**
 * JavaScript linter — runs ESLint with the local Shoptet plugin and returns
 * findings in the shared review format.
 */

const path = require('path');
const { ESLint } = require('eslint');

const ROOT = path.join(__dirname, '..');

async function lintJavaScript(files) {
  const eslint = new ESLint({
    useEslintrc: false,
    overrideConfigFile: path.join(ROOT, '.eslintrc.js'),
    cwd: ROOT,
    resolvePluginsRelativeTo: ROOT,
    plugins: {
      shoptet: require('../rules'),
    },
  });

  const results = await eslint.lintFiles(files);
  const findings = [];

  for (const result of results) {
    for (const message of result.messages) {
      findings.push({
        file: result.filePath,
        line: message.line || 1,
        column: message.column || 1,
        message: message.message,
        ruleId: message.ruleId || 'CodeQuality',
        severity: message.severity === 2 ? 'blocker' : 'recommend',
      });
    }
  }

  return findings;
}

module.exports = { lintJavaScript };
