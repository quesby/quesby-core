// tools/legacy-content-importer/index.js
// #!/usr/bin/env node

/**
 * Neutrino Legacy Content Importer
 * 
 * A standalone tool to import legacy markdown content into the Neutrino ULID system.
 * This tool can be used independently to migrate content from any markdown-based
 * blog/CMS to Neutrino's ULID-based content structure.
 * 
 * Usage:
 *   npx neutrino-legacy-content-importer --source ./old-blog --target ./src/content/posts
 *   npx neutrino-legacy-content-importer --source ./old-blog --target ./src/content/posts --dry-run
 *   npx neutrino-legacy-content-importer --config ./config.yml
 *   npx neutrino-legacy-content-importer --help
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Colors for console output (must be defined before functions that use it)
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

function logVerbose(message) {
  if (VERBOSE) {
    log(`🔍 ${message}`, 'blue');
  }
}

function yamlQuote(value) {
  const s = String(value ?? "");
  // escape doppi apici
  return `"${s.replace(/"/g, '\\"')}"`;
}

function isPlainObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .option('source', {
    alias: 's',
    type: 'string',
    description: 'Source directory containing legacy markdown files'
  })
  .option('target', {
    alias: 't',
    type: 'string',
    description: 'Target directory for Neutrino content (e.g., src/content/posts)'
  })
  .option('config', {
    alias: 'c',
    type: 'string',
    description: 'Configuration file (YAML)'
  })
  .option('author', {
    alias: 'a',
    type: 'string',
    description: 'Default author name for imported content',
    default: 'Author'
  })
  .option('image-path', {
    alias: 'i',
    type: 'string',
    description: 'Base path for images (e.g., /img/)',
    default: '/img/'
  })
  .option('backup', {
    alias: 'b',
    type: 'boolean',
    description: 'Create backup before import',
    default: true
  })
  .option('dry-run', {
    alias: 'd',
    type: 'boolean',
    description: 'Show what would be imported without making changes',
    default: false
  })
  .option('verbose', {
    alias: 'v',
    type: 'boolean',
    description: 'Verbose output',
    default: false
  })
  .help()
  .version()
  .check((argv) => {
    // Either config file or source+target must be provided
    if (!argv.config && (!argv.source || !argv.target)) {
      throw new Error('Either --config or both --source and --target must be provided');
    }
    return true;
  })
  .argv;

// Load configuration
let config = {};

if (argv.config) {
  try {
    const configFile = fs.readFileSync(argv.config, 'utf8');
    config = yaml.load(configFile);
    log(`📁 Loaded configuration from: ${argv.config}`, 'blue');
  } catch (error) {
    logError(`Failed to load config file: ${error.message}`);
    process.exit(1);
  }
}

// Merge command line args with config file
const SOURCE_DIR = path.resolve(argv.source || config.source);
const TARGET_DIR = path.resolve(argv.target || config.target);
const BACKUP_DIR = path.join(path.dirname(TARGET_DIR), 'backup-before-import');
const DRY_RUN = argv.dryRun || config.dryRun || false;
const VERBOSE = argv.verbose || config.verbose || false;
const DEFAULT_AUTHOR = argv.author || config.author || 'Author';
const IMAGE_PATH = argv.imagePath || config.imagePath || '/img/';

// Field mappings from config
const fieldMappings = config.fieldMappings || {
  title: ['page-title', 'seoTitle', 'title'],
  description: ['descrizione', 'description', 'excerpt', 'summary'],
  date: 'date',
  tags: 'tags',
  category: 'category',
  image: 'image',
  author: 'author',
  draft: 'draft',
  featured: 'featured',
  type: 'type'
};

// Content processing options
const contentOptions = config.content || {
  addCategoryToTags: true,
  createAliases: true,
  aliasPattern: '/blog/{slug}/'
};

// Backup options
const backupOptions = config.backup || {
  enabled: true,
  directory: 'backup-before-import'
};

/**
 * Generate ULID (simplified version)
 */
function generateULID() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const timePart = timestamp.toString(36).toUpperCase();
  const randomPart = random.toUpperCase().padEnd(16, '0').substring(0, 16);
  return timePart + randomPart;
}

/**
 * Convert legacy frontmatter to Neutrino format
 */
function convertFrontmatter(oldFrontmatter, filename) {
  // Get title from mapped fields
  let title = 'Untitled';
  for (const field of fieldMappings.title) {
    if (oldFrontmatter[field]) {
      title = oldFrontmatter[field];
      break;
    }
  }
  if (title === 'Untitled') {
    title = path.basename(filename, '.md');
  }
  
  // Get description from mapped fields
  let description = '';
  for (const field of fieldMappings.description) {
    if (oldFrontmatter[field]) {
      description = oldFrontmatter[field];
      break;
    }
  }
  
  const newFrontmatter = {
    id: generateULID(),
    title: title,
    slug: createSlug(title),
    description: description,
    date: oldFrontmatter[fieldMappings.date] || new Date().toISOString(),
    author: oldFrontmatter[fieldMappings.author] || DEFAULT_AUTHOR,
    tags: oldFrontmatter[fieldMappings.tags] || [],
    draft: oldFrontmatter[fieldMappings.draft] || false,
    aliases: []
  };

  // SEO defaults (popoliamo se mancano)
  newFrontmatter.seoTitle = oldFrontmatter.seoTitle || title;
  newFrontmatter.seoDescription = oldFrontmatter.seoDescription || description;

  // Add image if present - store only filename, no path
  if (oldFrontmatter[fieldMappings.image]) {
    // Extract just the filename from the path
    const imagePath = oldFrontmatter[fieldMappings.image];
    const filename = path.basename(imagePath);
    newFrontmatter.image = filename;
  }

  // Add category as tag if configured
  if (contentOptions.addCategoryToTags && oldFrontmatter[fieldMappings.category]) {
    newFrontmatter.tags.push(oldFrontmatter[fieldMappings.category]);
  }

  // Create alias if configured
  if (contentOptions.createAliases) {
    const alias = contentOptions.aliasPattern.replace('{slug}', createSlug(title));
    newFrontmatter.aliases.push(alias);
  }

  // Handle custom fields
  if (oldFrontmatter[fieldMappings.featured]) {
    newFrontmatter.featured = oldFrontmatter[fieldMappings.featured];
  }

  if (oldFrontmatter[fieldMappings.type]) {
    newFrontmatter.type = oldFrontmatter[fieldMappings.type];
  }

  return newFrontmatter;
}

/**
 * Create URL-friendly slug from title
 */
function createSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .trim();
}

/**
 * Find assets referenced in markdown content
 */
function findPostAssets(markdownContent, sourceDir) {
  const assets = [];
  
  // Find images in markdown
  const imageRegex = /!\[.*?\]\((.*?)\)/g;
  let match;
  while ((match = imageRegex.exec(markdownContent)) !== null) {
    const imagePath = match[1];
    // Skip external URLs
    if (!imagePath.startsWith('http') && !imagePath.startsWith('data:')) {
      const fullPath = path.isAbsolute(imagePath) 
        ? imagePath 
        : path.resolve(sourceDir, imagePath);
      
      if (fs.existsSync(fullPath)) {
        assets.push({
          type: 'image',
          source: fullPath,
          originalPath: imagePath,
          filename: path.basename(imagePath)
        });
      } else {
        logWarning(`Asset not found: ${imagePath}`);
      }
    }
  }
  
  return assets;
}

/**
 * Copy post assets to target directory
 */
function copyPostAssets(assets, targetDir, postSlug) {
  if (assets.length === 0) return [];
  
  const assetsDir = path.join(targetDir, 'assets');
  const copiedAssets = [];
  
  for (const asset of assets) {
    try {
      // Create assets directory if it doesn't exist
      if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
      }
      
      // Keep original filename
      const targetPath = path.join(assetsDir, asset.filename);
      
      // Check if file already exists (from another post)
      if (fs.existsSync(targetPath)) {
        logWarning(`Asset already exists: ${asset.filename} (skipping copy)`);
        // Still add to copiedAssets so paths get updated
        copiedAssets.push({
          ...asset,
          targetPath: targetPath,
          newPath: `assets/${asset.filename}`,
          skipped: true
        });
        continue;
      }
      
      // Copy the asset with original name
      fs.copyFileSync(asset.source, targetPath);
      
      copiedAssets.push({
        ...asset,
        targetPath: targetPath,
        newPath: `assets/${asset.filename}`
      });
      
      logVerbose(`📁 Copied asset: ${asset.filename}`);
    } catch (error) {
      logError(`Failed to copy asset ${asset.filename}: ${error.message}`);
    }
  }
  
  return copiedAssets;
}

/**
 * Update asset paths in markdown content
 */
function updateAssetPaths(content, copiedAssets) {
  let updatedContent = content;
  
  for (const asset of copiedAssets) {
    // Update markdown image references
    const imageRegex = new RegExp(`!\\[.*?\\]\\(${asset.originalPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`, 'g');
    updatedContent = updatedContent.replace(imageRegex, (match) => {
      return match.replace(asset.originalPath, asset.newPath);
    });
  }
  
  return updatedContent;
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

  const quoteKeys = new Set([
    'title',
    'description',
    'author',
    'seoTitle',
    'seoDescription'
  ]);

  for (const [key, value] of Object.entries(frontmatter)) {
    if (Array.isArray(value)) {
      frontmatterText += `${key}:\n`;
      for (const item of value) {
        // elementi array: se stringhe → quotale
        if (typeof item === 'string') {
          frontmatterText += `  - ${yamlQuote(item)}\n`;
        } else {
          frontmatterText += `  - ${item}\n`;
        }
      }
    } else if (typeof value === 'boolean' || typeof value === 'number') {
      frontmatterText += `${key}: ${value}\n`;
    } else if (value == null) {
      frontmatterText += `${key}: ""\n`;
    } else if (isPlainObject(value)) {
      // oggetti semplici → serializza chiavi stringa quotandole
      frontmatterText += `${key}:\n`;
      for (const [k2, v2] of Object.entries(value)) {
        if (typeof v2 === 'string') {
          frontmatterText += `  ${k2}: ${yamlQuote(v2)}\n`;
        } else {
          frontmatterText += `  ${k2}: ${v2}\n`;
        }
      }
    } else {
      // stringhe
      const needsQuote = quoteKeys.has(key) || typeof value === 'string';
      frontmatterText += `${key}: ${needsQuote ? yamlQuote(value) : value}\n`;
    }
  }

  frontmatterText += '---\n\n';
  const fullContent = frontmatterText + content;
  fs.writeFileSync(filePath, fullContent, 'utf8');
}

/**
 * Create backup of target directory
 */
function createBackup() {
  if (!backupOptions.enabled) return;
  
  logStep('BACKUP', 'Creating backup of target directory...');
  
  if (fs.existsSync(BACKUP_DIR)) {
    logWarning(`Backup directory ${BACKUP_DIR} already exists. Removing...`);
    fs.rmSync(BACKUP_DIR, { recursive: true, force: true });
  }
  
  if (!DRY_RUN && fs.existsSync(TARGET_DIR)) {
    // Use cross-platform copy command
    const isWindows = process.platform === 'win32';
    const copyCommand = isWindows 
      ? `xcopy "${TARGET_DIR}" "${BACKUP_DIR}" /E /I /H /Y`
      : `cp -r ${TARGET_DIR} ${BACKUP_DIR}`;
    
    execSync(copyCommand, { stdio: 'inherit' });
    logSuccess(`Backup created: ${BACKUP_DIR}`);
  } else if (DRY_RUN) {
    log('DRY RUN: Would create backup', 'yellow');
  }
}

/**
 * Main import function
 */
async function importContent() {
  log(' Neutrino Legacy Content Importer', 'bright');
  log(`Source: ${SOURCE_DIR}`, 'blue');
  log(`Target: ${TARGET_DIR}`, 'blue');
  log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`, DRY_RUN ? 'yellow' : 'green');
  
  // Check if source directory exists
  if (!fs.existsSync(SOURCE_DIR)) {
    logError(`Source directory not found: ${SOURCE_DIR}`);
    process.exit(1);
  }
  
  // Create backup
  createBackup();
  
  // Ensure target directory exists
  if (!DRY_RUN) {
    fs.mkdirSync(TARGET_DIR, { recursive: true });
  }
  
  // Read all markdown files in source directory
  const files = fs.readdirSync(SOURCE_DIR)
    .filter(file => file.endsWith('.md'))
    .map(file => path.join(SOURCE_DIR, file));
  
  logStep('SCAN', `Found ${files.length} markdown files in ${SOURCE_DIR}`);
  
  const importResults = {
    processed: 0,
    imported: 0,
    skipped: 0,
    errors: 0
  };
  
  for (const filePath of files) {
    importResults.processed++;
    
    try {
      // Read and parse the markdown file
      const content = fs.readFileSync(filePath, 'utf8');
      const { frontmatter, content: markdownContent } = parseFrontmatter(content);
      
      // Convert frontmatter to Neutrino format
      const newFrontmatter = convertFrontmatter(frontmatter, path.basename(filePath));
      
      // Create directory name in format: ULID--slug
      const dirName = `${newFrontmatter.id}--${newFrontmatter.slug}`;
      const targetPath = path.join(TARGET_DIR, dirName);
      
      // Check if target directory already exists
      if (fs.existsSync(targetPath)) {
        logWarning(`Target directory already exists: ${dirName}`);
        importResults.skipped++;
        continue;
      }
      
      log(`Importing: ${path.basename(filePath)} → ${dirName}`, 'cyan');
      logVerbose(`Title: ${newFrontmatter.title}`);
      logVerbose(`Slug: ${newFrontmatter.slug}`);
      logVerbose(`Tags: ${newFrontmatter.tags.join(', ')}`);
      
      if (!DRY_RUN) {
        // Create new directory
        fs.mkdirSync(targetPath, { recursive: true });
        
        // Write updated content to new location
        writeMarkdownFile(
          path.join(targetPath, 'index.md'),
          newFrontmatter,
          markdownContent
        );
      }
      
      importResults.imported++;
      logSuccess(`Imported: ${path.basename(filePath)} → ${dirName}`);
      
    } catch (error) {
      logError(`Error processing ${path.basename(filePath)}: ${error.message}`);
      importResults.errors++;
    }
  }
  
  // Print summary
  logStep('SUMMARY', 'Import completed!');
  log(`📊 Processed: ${importResults.processed} files`);
  log(`✅ Imported: ${importResults.imported} files`);
  log(`⏭️  Skipped: ${importResults.skipped} files`);
  log(`❌ Errors: ${importResults.errors} files`);
  
  if (importResults.errors > 0) {
    log('\n⚠️  Some issues occurred during import. Please review the output above.', 'yellow');
    process.exit(1);
  }
  
  if (DRY_RUN) {
    log('\n This was a dry run. No files were actually modified.', 'blue');
    log('Run without --dry-run to perform the actual import.', 'blue');
  } else {
    log('\n Import completed successfully!', 'green');
    if (backupOptions.enabled) {
      log(`Backup available at: ${BACKUP_DIR}`, 'blue');
    }
  }
}

// Run import
importContent().catch(error => {
  logError(`Import failed: ${error.message}`);
  process.exit(1);
});