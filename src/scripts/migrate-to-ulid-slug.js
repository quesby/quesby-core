#!/usr/bin/env node

/**
 * Migration Script: ULID to ULID--slug folder structure
 * 
 * This script migrates content from:
 * /content/posts/[ULID]/index.md
 * to:
 * /content/posts/[ULID]--[slug]/index.md
 * 
 * Features:
 * - Handles conflicts (duplicate slugs)
 * - Creates aliases for old URLs
 * - Backup before migration
 * - Dry-run mode for testing
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONTENT_DIR = 'src/content/posts';
const BACKUP_DIR = 'backup-before-migration';
const DRY_RUN = process.argv.includes('--dry-run');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`\n[${step}] ${message}`, 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
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

/**
 * Check if folder name is a valid ULID (26 characters, alphanumeric)
 */
function isULID(folderName) {
  // Simple check: 26 characters, alphanumeric only
  return folderName.length === 26 && /^[0-9A-Za-z]{26}$/.test(folderName);
}

/**
 * Check if folder name is already in new format (ULID--slug)
 */
function isNewFormat(folderName) {
  return /^[0-9A-HJKMNP-TV-Z]{26}--.+$/.test(folderName);
}

/**
 * Create backup of content directory
 */
function createBackup() {
  logStep('BACKUP', 'Creating backup of content directory...');
  
  if (fs.existsSync(BACKUP_DIR)) {
    logWarning(`Backup directory ${BACKUP_DIR} already exists. Removing...`);
    fs.rmSync(BACKUP_DIR, { recursive: true, force: true });
  }
  
  if (!DRY_RUN) {
    // Use cross-platform copy command
    const isWindows = process.platform === 'win32';
    const copyCommand = isWindows 
      ? `xcopy "${CONTENT_DIR}" "${BACKUP_DIR}" /E /I /H /Y`
      : `cp -r ${CONTENT_DIR} ${BACKUP_DIR}`;
    
    execSync(copyCommand, { stdio: 'inherit' });
    logSuccess(`Backup created: ${BACKUP_DIR}`);
  } else {
    log('DRY RUN: Would create backup', 'yellow');
  }
}

/**
 * Main migration function
 */
async function migratePosts() {
  logStep('INIT', 'Starting ULID--slug migration...');
  log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`, DRY_RUN ? 'yellow' : 'green');
  
  // Check if content directory exists
  if (!fs.existsSync(CONTENT_DIR)) {
    logError(`Content directory not found: ${CONTENT_DIR}`);
    process.exit(1);
  }
  
  // Create backup
  createBackup();
  
  // Read all folders in content directory
  const folders = fs.readdirSync(CONTENT_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
  
  logStep('SCAN', `Found ${folders.length} folders in ${CONTENT_DIR}`);
  
  const migrationResults = {
    processed: 0,
    migrated: 0,
    skipped: 0,
    errors: 0,
    conflicts: 0
  };
  
  const slugMap = new Map(); // Track used slugs to detect conflicts
  
  for (const folder of folders) {
    migrationResults.processed++;
    
    // Skip if already in new format
    if (isNewFormat(folder)) {
      log(`Skipping ${folder} (already in new format)`, 'blue');
      migrationResults.skipped++;
      continue;
    }
    
    // Skip if not a ULID
    if (!isULID(folder)) {
      logWarning(`Skipping ${folder} (not a valid ULID)`);
      migrationResults.skipped++;
      continue;
    }
    
    const indexPath = path.join(CONTENT_DIR, folder, 'index.md');
    
    // Check if index.md exists
    if (!fs.existsSync(indexPath)) {
      logError(`No index.md found in ${folder}`);
      migrationResults.errors++;
      continue;
    }
    
    try {
      // Read and parse the markdown file
      const content = fs.readFileSync(indexPath, 'utf8');
      const { frontmatter, content: markdownContent } = parseFrontmatter(content);
      
      // Check if slug exists
      if (!frontmatter.slug) {
        logWarning(`No slug found in ${folder}, skipping...`);
        migrationResults.skipped++;
        continue;
      }
      
      const ulid = folder;
      const slug = frontmatter.slug;
      const newFolderName = `${ulid}--${slug}`;
      const newPath = path.join(CONTENT_DIR, newFolderName);
      
      // Check for conflicts
      if (slugMap.has(slug)) {
        logError(`Slug conflict: "${slug}" already used by ${slugMap.get(slug)}`);
        migrationResults.conflicts++;
        continue;
      }
      
      // Check if target folder already exists
      if (fs.existsSync(newPath)) {
        logError(`Target folder already exists: ${newFolderName}`);
        migrationResults.conflicts++;
        continue;
      }
      
      log(`Migrating: ${folder} → ${newFolderName}`, 'cyan');
      
      if (!DRY_RUN) {
        // Create new folder
        fs.mkdirSync(newPath, { recursive: true });
        
        // Add alias to frontmatter for old URL
        const existingAliases = Array.isArray(frontmatter.aliases) ? frontmatter.aliases : [];
        const newAlias = `/blog/${slug}/`;
        const updatedFrontmatter = {
          ...frontmatter,
          aliases: [
            ...existingAliases.filter(alias => alias && alias.trim() !== ''),
            newAlias
          ]
        };
        
        // Write updated content to new location
        writeMarkdownFile(
          path.join(newPath, 'index.md'),
          updatedFrontmatter,
          markdownContent
        );
        
        // Remove old folder
        fs.rmSync(path.join(CONTENT_DIR, folder), { recursive: true, force: true });
      }
      
      slugMap.set(slug, newFolderName);
      migrationResults.migrated++;
      logSuccess(`Migrated: ${folder} → ${newFolderName}`);
      
    } catch (error) {
      logError(`Error processing ${folder}: ${error.message}`);
      migrationResults.errors++;
    }
  }
  
  // Print summary
  logStep('SUMMARY', 'Migration completed!');
  log(`📊 Processed: ${migrationResults.processed} folders`);
  log(`✅ Migrated: ${migrationResults.migrated} folders`);
  log(`⏭️  Skipped: ${migrationResults.skipped} folders`);
  log(`❌ Errors: ${migrationResults.errors} folders`);
  log(`⚠️  Conflicts: ${migrationResults.conflicts} folders`);
  
  if (migrationResults.errors > 0 || migrationResults.conflicts > 0) {
    log('\n⚠️  Some issues occurred during migration. Please review the output above.', 'yellow');
    process.exit(1);
  }
  
  if (DRY_RUN) {
    log('\n🔍 This was a dry run. No files were actually modified.', 'blue');
    log('Run without --dry-run to perform the actual migration.', 'blue');
  } else {
    log('\n🎉 Migration completed successfully!', 'green');
    log(`Backup available at: ${BACKUP_DIR}`, 'blue');
  }
}

// Handle command line arguments
if (process.argv.includes('--help')) {
  log('ULID--slug Migration Script', 'bright');
  log('\nUsage:');
  log('  node scripts/migrate-to-ulid-slug.js [options]');
  log('\nOptions:');
  log('  --dry-run    Run without making changes (test mode)');
  log('  --help       Show this help message');
  log('\nThis script migrates content from [ULID] to [ULID]--[slug] folder structure.');
  process.exit(0);
}

// Run migration
migratePosts().catch(error => {
  logError(`Migration failed: ${error.message}`);
  process.exit(1);
});
