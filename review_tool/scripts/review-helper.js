#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const {glob} = require('glob');
const {ESLint} = require('eslint');
const validators = require('../validators/shoptet-rules');

async function main() {
  const args = process.argv.slice(2);
  
  // Parse CLI arguments
  let targetPath = null;
  let format = 'console'; // default format
  
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--format=')) {
      format = args[i].split('=')[1];
    } else if (!targetPath) {
      targetPath = args[i];
    }
  }
  
  // Default to src/ if no path provided
  if (!targetPath) {
    targetPath = 'src';
  }
  
  let files = [];
  try {
    if (fs.statSync(targetPath).isDirectory()) {
      files = await glob(`${targetPath}/**/*.js`, {nodir: true});
    } else if (targetPath.endsWith('.js')) {
      files = [targetPath];
    } else {
      console.error(`Error: ${targetPath} is not a JavaScript file or directory`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`Error: Path not found: ${targetPath}`);
    process.exit(1);
  }
  
  if (files.length === 0) {
    console.error(`No .js files found in ${targetPath}`);
    process.exit(1);
  }
  
  console.log(`\n🔍 Reviewing ${files.length} file(s)...\n`);
  
  const eslint = new ESLint({
    overrideConfigFile: path.join(__dirname, '../eslint-config/shoptet-addon.js'),
    useEslintrc: false
  });
  
  let allFindings = [];
  let blockerCount = 0;
  let recommendCount = 0;
  
  let eslintResults = [];
  try {
    eslintResults = await eslint.lintFiles(files);
  } catch (error) {
    console.error(`ESLint error: ${error.message}`);
  }
  
  for (const result of eslintResults) {
    for (const message of result.messages) {
      const finding = {
        file: result.filePath,
        line: message.line,
        column: message.column,
        message: message.message,
        ruleId: message.ruleId,
        severity: message.severity === 2 ? 'blocker' : 'recommend'
      };
      
      allFindings.push(finding);
      
      if (finding.severity === 'blocker') {
        blockerCount++;
      } else {
        recommendCount++;
      }
    }
  }
  
  for (const file of files) {
    try {
      const code = fs.readFileSync(file, 'utf8');
      const astViolations = validators(code);
      
      for (const violation of astViolations) {
        allFindings.push({
          file: file,
          line: violation.line,
          column: violation.column + 1, // Normalize from 0-indexed to 1-indexed
          message: violation.message,
          ruleId: 'ast-validator',
          severity: 'blocker'
        });
        blockerCount++;
      }
    } catch (error) {
      console.error(`Error reading ${file}: ${error.message}`);
    }
  }
  
  const blockers = allFindings.filter(f => f.severity === 'blocker');
  const recommends = allFindings.filter(f => f.severity === 'recommend');
  
  // Output based on format
  if (format === 'github-actions') {
    outputGitHubActions(allFindings);
  } else {
    outputConsole(blockers, recommends, blockerCount, recommendCount);
    await generateCopilotContext(files, allFindings, blockerCount, recommendCount);
    console.log(`\n📄 LLM review context saved to .copilot-review-context.md`);
  }
  
  if (format !== 'github-actions') {
    console.log(`\nReview complete.`);
  }
  
  process.exit(blockerCount > 0 ? 1 : 0);
}

function translateMessage(message) {
  const translations = {
    'Chybí /cache/ v XHR volání na Shoptet server': 'Missing /cache/ in XHR call to Shoptet server',
    'Chybí /cache/ v jQuery AJAX volání na Shoptet server': 'Missing /cache/ in jQuery AJAX call to Shoptet server',
    'XMLHttpRequest detekován - zkontrolovat, zda používá /cache/ pro Shoptet API': 'XMLHttpRequest detected - verify it uses /cache/ for Shoptet API calls'
  };
  return translations[message] || message;
}

function getRuleTitle(finding) {
  if (finding.ruleId === 'ast-validator') {
    if (finding.message.includes('cache')) {
      return 'ShoptetCacheRequired';
    }
    return 'ShoptetValidator';
  }
  return finding.ruleId || 'CodeQuality';
}

function outputGitHubActions(findings) {
  for (const finding of findings) {
    const relativePath = path.relative(process.cwd(), finding.file);
    const level = finding.severity === 'blocker' ? 'error' : 'warning';
    const title = getRuleTitle(finding);
    const message = translateMessage(finding.message);
    const col = finding.column || 1;
    
    console.log(`::${level} file=${relativePath},line=${finding.line},col=${col},title=${title}::${message}`);
  }
  
  // Summary
  const blockers = findings.filter(f => f.severity === 'blocker').length;
  const recommends = findings.filter(f => f.severity === 'recommend').length;
  
  if (findings.length === 0) {
    console.log('::notice title=CodeReview::No issues found - code looks good!');
  } else {
    console.log(`::notice title=ReviewSummary::Found ${blockers} blocker(s) and ${recommends} recommendation(s)`);
  }
}

function outputConsole(blockers, recommends, blockerCount, recommendCount) {
  console.log(`\n📊 Review Summary`);
  console.log(`${'='.repeat(50)}\n`);
  console.log(`❌ BLOCKERS: ${blockerCount}`);
  console.log(`😊 RECOMMENDATIONS: ${recommendCount}\n`);
  
  if (blockers.length > 0) {
    console.log(`\n❌ BLOKUJÍCÍ CHYBY\n`);
    for (const finding of blockers) {
      const relativePath = path.relative(process.cwd(), finding.file);
      console.log(`❌ BLOCKER: ${relativePath}:${finding.line} – ${finding.message}`);
    }
  }
  
  if (recommends.length > 0) {
    console.log(`\n\n😊 DOPORUČENÍ\n`);
    for (const finding of recommends) {
      const relativePath = path.relative(process.cwd(), finding.file);
      console.log(`😊 RECOMMEND: ${relativePath}:${finding.line} – ${finding.message}`);
    }
  }
  
  if (blockers.length === 0 && recommends.length === 0) {
    console.log(`\n✅ No issues found! Code looks good.\n`);
  }
}

async function generateCopilotContext(files, findings, blockerCount, recommendCount) {
  let context = `# Code Review Context\n\n`;
  context += `**Generated**: ${new Date().toISOString()}\n\n`;
  context += `## Summary\n\n`;
  context += `- **Files reviewed**: ${files.length}\n`;
  context += `- **Blockers found**: ${blockerCount}\n`;
  context += `- **Recommendations**: ${recommendCount}\n\n`;
  context += `---\n\n`;
  
  if (findings.length === 0) {
    context += `## ✅ No Issues Found\n\nAll files passed automated checks.\n`;
  } else {
    context += `## ❌ Findings\n\n`;
    
    const blockers = findings.filter(f => f.severity === 'blocker');
    const recommends = findings.filter(f => f.severity === 'recommend');
    
    if (blockers.length > 0) {
      context += `### Blockers (${blockers.length})\n\n`;
      for (const finding of blockers) {
        const relativePath = path.relative(process.cwd(), finding.file);
        context += `- **${relativePath}:${finding.line}** – ${finding.message}\n`;
      }
      context += `\n`;
    }
    
    if (recommends.length > 0) {
      context += `### Recommendations (${recommends.length})\n\n`;
      for (const finding of recommends) {
        const relativePath = path.relative(process.cwd(), finding.file);
        context += `- **${relativePath}:${finding.line}** – ${finding.message}\n`;
      }
      context += `\n`;
    }
    
    context += `---\n\n`;
    context += `## 📝 Code Context\n\n`;
    
    for (const file of files) {
      const fileFindings = findings.filter(f => f.file === file);
      if (fileFindings.length > 0) {
        const relativePath = path.relative(process.cwd(), file);
        context += `### ${relativePath}\n\n`;
        
        try {
          const code = fs.readFileSync(file, 'utf8');
          const lines = code.split('\n');
          
          if (lines.length > 1000) {
            context += `*File too large (${lines.length} lines), showing first 1000 lines*\n\n`;
          }
          
          context += '```javascript\n';
          context += lines.slice(0, 1000).join('\n');
          context += '\n```\n\n';
          
          context += `**Issues in this file:**\n\n`;
          for (const finding of fileFindings) {
            context += `- Line ${finding.line}: ${finding.message}\n`;
          }
          context += `\n`;
        } catch (error) {
          context += `*Could not read file: ${error.message}*\n\n`;
        }
      }
    }
  }
  
  context += `---\n\n`;
  context += `## 🤖 Instructions for LLM Review\n\n`;
  context += `Please review the code above against Shoptet addon guidelines:\n\n`;
  context += `1. Verify all automated findings are accurate\n`;
  context += `2. Look for additional issues that automated checks might have missed\n`;
  context += `3. Provide Czech-formatted comments for any additional concerns\n`;
  context += `4. Focus on code quality, maintainability, and Shoptet best practices\n\n`;
  context += `Use the format:\n`;
  context += `❌ BLOCKER: \`file:line\` – Explanation\n`;
  context += `😊 RECOMMEND: \`file:line\` – Suggestion\n`;
  
  fs.writeFileSync('.copilot-review-context.md', context, 'utf8');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
