# Neutrino Tools

This directory contains standalone tools for Neutrino that help with content management, migration, and development tasks.

## Available Tools

### Legacy Content Importer

A powerful tool to import legacy markdown content into the Neutrino ULID system. Perfect for migrating from other static site generators, CMSs, or blog platforms.

**Location:** `tools/legacy-content-importer/`

**Quick Start:**
```bash
# Install dependencies
cd tools/legacy-content-importer
npm install

# Test import (dry run)
npm run tools:import:config:dry

# Real import
npm run tools:import:config
```

**Features:**
- ✅ Automatic ULID generation
- ✅ Frontmatter field mapping
- ✅ Slug generation from titles
- ✅ Alias creation for SEO
- ✅ Image path handling
- ✅ Backup functionality
- ✅ Dry-run mode for testing
- ✅ Configurable field mappings
- ✅ Support for multiple content sources

**Supported Platforms:**
- Jekyll
- Hugo
- Ghost
- WordPress (exported markdown)
- Any markdown-based CMS
- Custom markdown collections

## Using Tools

### From Project Root

```bash
# Legacy Content Importer
npm run tools:import:dry          # Test import
npm run tools:import:config:dry   # Test with config file
npm run tools:import:config       # Real import with config
```

### Direct Tool Usage

```bash
# Navigate to tool directory
cd tools/legacy-content-importer

# Use tool directly
node index.js --help
node index.js --source ./old-blog --target ./src/content/posts --dry-run
node index.js --config my-config.yml --dry-run
```

## Tool Development

### Adding New Tools

1. Create a new directory in `tools/`
2. Add a `package.json` with tool metadata
3. Implement the tool with proper CLI interface
4. Add documentation in tool directory
5. Update this README with tool information
6. Add npm scripts to main `package.json`

### Tool Requirements

- **Standalone**: Each tool should work independently
- **CLI Interface**: Use yargs or similar for command-line arguments
- **Documentation**: Include README.md with usage examples
- **Configuration**: Support both CLI args and config files
- **Error Handling**: Proper error messages and exit codes
- **Testing**: Include dry-run or test modes

### Tool Structure

```
tools/
├── tool-name/
│   ├── package.json          # Tool dependencies
│   ├── index.js              # Main tool file
│   ├── README.md             # Tool documentation
│   ├── config.example.yml    # Example configuration
│   └── .gitignore            # Tool-specific ignores
└── README.md                 # This file
```

## Contributing

When contributing to tools:

1. Follow the tool requirements above
2. Test thoroughly with dry-run modes
3. Update documentation
4. Add examples for common use cases
5. Ensure cross-platform compatibility

## License

All tools are licensed under the same license as Neutrino (MIT).
