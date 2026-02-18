const fs = require('fs');
const path = require('path');
const {glob} = require('glob');
const {ESLint} = require('eslint');

async function main() {
  // Get target path from command line or default to 'src'
  const targetPathArg = process.argv[2] || 'src';
  const targetPath = path.resolve(process.cwd(), targetPathArg);
  
  // Find all JavaScript files
  let files = [];
  try {
    const stats = fs.statSync(targetPath);
    
    if (stats.isDirectory()) {
      files = await glob('**/*.js', {
        nodir: true,
        cwd: targetPath,
        absolute: true
      });
      console.log(`🔍 Reviewing ${files.length} file(s) in directory: ${targetPath}`);
    } else if (targetPath.endsWith('.js')) {
      files = [targetPath];
      console.log(`🔍 Reviewing single file: ${targetPath}`);
    } else {
      console.error(`::error::${targetPath} is not a JavaScript file or directory`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`::error::Path not found: ${targetPath}`);
    process.exit(1);
  }
  
  if (files.length === 0) {
    console.error(`::error::No .js files found in ${targetPath}`);
    process.exit(1);
  }
  
  // Initialize ESLint with local plugin
  const eslint = new ESLint({
    useEslintrc: false,
    overrideConfigFile: path.join(__dirname, '.eslintrc.js'),
    cwd: __dirname,
    resolvePluginsRelativeTo: __dirname,
    plugins: {
      shoptet: require('./rules'),
    },
  });
  
  // Run ESLint
  let eslintResults = [];
  try {
    eslintResults = await eslint.lintFiles(files);
  } catch (error) {
    console.error(`::error::ESLint execution failed: ${error.message}`);
    process.exit(1);
  }
  
  // Collect findings
  const findings = [];
  let blockerCount = 0;
  let recommendCount = 0;
  
  for (const result of eslintResults) {
    for (const message of result.messages) {
      const finding = {
        file: result.filePath,
        line: message.line || 1,
        column: message.column || 1,
        message: message.message,
        ruleId: message.ruleId || 'CodeQuality',
        severity: message.severity === 2 ? 'blocker' : 'recommend',
      };
      
      findings.push(finding);
      
      if (finding.severity === 'blocker') {
        blockerCount++;
      } else {
        recommendCount++;
      }
    }
  }
  
  // Output GitHub Actions annotations
  outputGitHubActions(findings, blockerCount, recommendCount);
  
  // Exit with error code if blockers found
  process.exit(blockerCount > 0 ? 1 : 0);
}

function getRuleTitle(ruleId) {
  if (!ruleId) return 'CodeQuality';
  
  // Format custom rules nicely
  if (ruleId.startsWith('shoptet/')) {
    return ruleId.split('/').map(part => 
      part.charAt(0).toUpperCase() + part.slice(1)
    ).join('/');
  }
  
  return ruleId;
}

function outputGitHubActions(findings, blockerCount, recommendCount) {
  // Output each finding as annotation
  for (const finding of findings) {
    const relativePath = path.relative(process.cwd(), finding.file);
    const level = finding.severity === 'blocker' ? 'error' : 'warning';
    const title = getRuleTitle(finding.ruleId);
    const message = finding.message.replace(/\r?\n/g, ' ');
    
    console.log(
      `::${level} file=${relativePath},line=${finding.line},col=${finding.column},title=${title}::${message}`
    );
  }
  
  // Output summary
  if (findings.length === 0) {
    console.log('::notice title=CodeReview::✅ No issues found - code looks good!');
  } else {
    console.log(
      `::notice title=ReviewSummary::Found ${blockerCount} blocker(s) and ${recommendCount} recommendation(s)`
    );
  }
}

main().catch(error => {
  console.error(`::error::Fatal error: ${error.message}`);
  process.exit(1);
});
