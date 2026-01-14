#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Final cleanup fixes for remaining errors
const finalFixes = [
  // Fix await-thenable errors
  {
    pattern: /await\s+this\.isAchievementUnlocked\(/g,
    replacement: 'this.isAchievementUnlocked('
  },
  {
    pattern: /await\s+this\.unlockAchievement\(/g,
    replacement: 'this.unlockAchievement('
  },
  
  // Fix unused expressions
  {
    pattern: /^\s*console\.log\([^)]*\);\s*$/gm,
    replacement: '// console.log removed'
  },
  
  // Fix typeof comparisons
  {
    pattern: /typeof\s+[^=]*\s*!=\s*'undefined'/g,
    replacement: (match) => match.replace('!=', '!==')
  },
  
  // Fix escape characters
  {
    pattern: /\\(\(|\))/g,
    replacement: '$1'
  }
];

function applyFinalFixes(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    finalFixes.forEach(fix => {
      const newContent = content.replace(fix.pattern, fix.replacement);
      if (newContent !== content) {
        content = newContent;
        modified = true;
      }
    });
    
    if (modified) {
      fs.writeFileSync(filePath, content);
      console.log(`Applied final fixes to: ${filePath}`);
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
  }
}

function findTsFiles(dir) {
  const files = [];
  
  function traverse(currentDir) {
    try {
      const items = fs.readdirSync(currentDir);
      
      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          traverse(fullPath);
        } else if (stat.isFile() && item.endsWith('.ts') && !item.endsWith('.d.ts')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${currentDir}:`, error.message);
    }
  }
  
  traverse(dir);
  return files;
}

// Apply final fixes to all TypeScript files
const srcDir = path.join(__dirname, 'src');
const tsFiles = findTsFiles(srcDir);

console.log(`Applying final fixes to ${tsFiles.length} TypeScript files...`);
tsFiles.forEach(applyFinalFixes);
console.log('Final cleanup completed!');