#!/usr/bin/env node

/**
 * Fix Aliases Script
 * 
 * This script cleans up aliases in migrated posts by removing empty entries
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONTENT_DIR = 'src/content/posts';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Parse frontmatter from markdown file
 */
function parseFrontmatter(content) {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);
  
  if (!match) {
    return { frontmatter: {}, content: content.trim() };
  }
  
  const frontmatterText = match[1];
  const markdownContent = match[2];
  
  // Simple YAML parser for basic frontmatter
  const frontmatter = {};
  const lines = frontmatterText.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) continue;
    
    const key = trimmed.substring(0, colonIndex).trim();
    let value = trimmed.substring(colonIndex + 1).trim();
    
    // Remove quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) || 
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    
    // Handle arrays (simple case)
    if (value.startsWith('[') && value.endsWith(']')) {
      const arrayContent = value.slice(1, -1);
      frontmatter[key] = arrayContent.split(',').map(item => item.trim().replace(/['"]/g, ''));
    } else if (key === 'aliases' || key === 'tags') {
      // Handle YAML array format (lines starting with -)
      frontmatter[key] = [];
    } else {
      frontmatter[key] = value;
    }
  }
  
  return { frontmatter, content: markdownContent };
}

/**
 * Write frontmatter and content to file
 */
function writeMarkdownFile(filePath, frontmatter, content) {
  let frontmatterText = '---\n';
  
  for (const [key, value] of Object.entries(frontmatter)) {
    if (Array.isArray(value)) {
      frontmatterText += `${key}:\n`;
      for (const item of value) {
        frontmatterText += `  - ${item}\n`;
      }
    } else {
      frontmatterText += `${key}: ${value}\n`;
    }
  }
  
  frontmatterText += '---\n\n';
  
  const fullContent = frontmatterText + content;
  fs.writeFileSync(filePath, fullContent, 'utf8');
}

async function fixAliases() {
  log('🔧 Fixing aliases in migrated posts...', 'yellow');
  
  const folders = fs.readdirSync(CONTENT_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
  
  let fixed = 0;
  
  for (const folder of folders) {
    const indexPath = path.join(CONTENT_DIR, folder, 'index.md');
    
    if (!fs.existsSync(indexPath)) continue;
    
    try {
      let content = fs.readFileSync(indexPath, 'utf8');
      
      // Fix empty aliases using regex
      const aliasesRegex = /aliases:\s*\n(\s*-\s*\n)*(\s*-\s*[^\n]+\n)*/g;
      const match = content.match(aliasesRegex);
      
      if (match) {
        const originalAliases = match[0];
        
        // Extract non-empty aliases
        const aliasLines = originalAliases.split('\n').filter(line => {
          const trimmed = line.trim();
          return trimmed.startsWith('-') && trimmed.length > 1 && trimmed !== '-';
        });
        
        if (aliasLines.length > 0) {
          const cleanedAliases = `aliases:\n${aliasLines.map(line => `  ${line}`).join('\n')}\n`;
          content = content.replace(aliasesRegex, cleanedAliases);
          
          fs.writeFileSync(indexPath, content, 'utf8');
          log(`✅ Fixed aliases in ${folder}`, 'green');
          fixed++;
        }
      }
    } catch (error) {
      log(`❌ Error processing ${folder}: ${error.message}`, 'red');
    }
  }
  
  log(`\n🎉 Fixed aliases in ${fixed} posts`, 'green');
}

fixAliases().catch(error => {
  log(`❌ Error: ${error.message}`, 'red');
  process.exit(1);
});
