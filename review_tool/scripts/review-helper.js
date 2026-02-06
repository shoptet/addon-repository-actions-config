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
  }
  
  if (format !== 'github-actions') {
    console.log(`\nReview complete.`);
  }
  
  process.exit(blockerCount > 0 ? 1 : 0);
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
    const message = finding.message.replace(/\r?\n/g, ' ');
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

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
