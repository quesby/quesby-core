# @quesby/core

[![npm version](https://img.shields.io/npm/v/@quesby/core)](https://www.npmjs.com/package/@quesby/core)
[![license](https://img.shields.io/npm/l/@quesby/core)](LICENSE)

Core library powering the **Quesby** static-site workflow.
Provides utilities, shortcodes, filters, configs, and shared logic used across all Quesby templates and boilerplates.

This package is designed to be **framework-agnostic** inside the Eleventy ecosystem and serves as the foundation for all Quesby projects.

**Repository:** [GitHub](https://github.com/quesby/quesby-core) | [Issues](https://github.com/quesby/quesby-core/issues)

## Features

* Centralized Eleventy configuration (collections, filters, transforms, shortcodes)
* SCSS pipeline helpers
* Image handling (Eleventy Image wrapper)
* Markdown pipeline with plugins
* SEO helpers (canonical URLs, metadata utilities)
* Utility functions shared across Quesby templates
* Consistent folder structure support (`src/`, `assets/`, etc.)
* Zero external tracking, zero bloat

## Installation

```bash
npm install @quesby/core
```

or

```bash
pnpm add @quesby/core
```

## Requirements

* **Node.js** >= 18.0.0
* **Sass** >= 1.93.3 < 2.0.0 (peer dependency)

Make sure to install Sass if you plan to use the included SASS styles:

```bash
npm install sass@^1.93.3
```

## Usage

In your Eleventy config:

```js
import quesbyCore from '@quesby/core';

export default function (eleventyConfig) {
  quesbyCore(eleventyConfig, {
    // optional overrides
    imageOptions: {},
    markdownOptions: {},
    scssOptions: {}
  });

  return {
    dir: {
      input: 'src',
      output: 'dist'
    }
  };
}
```

### What this sets up automatically

* Markdown-it with custom plugins
* Responsive image shortcodes (`img`, `picture`)
* Standard filters (`slugify`, `limit`, `formatNumber`, etc.)
* HTML minification in production
* Automatic passthrough copies (configurable)
* SEO utilities exposed to templates

Everything comes pre-wired but overridable.

## Using SASS Styles

The package includes a complete SASS stylesheet system. Import the core styles in your project:

```scss
@import '@quesby/core/sass/core';
```

Or import individual modules as needed:

```scss
@import '@quesby/core/sass/variables';
@import '@quesby/core/sass/mixins';
@import '@quesby/core/sass/typography';
@import '@quesby/core/sass/reset';
```

## Project Structure (recommended)

```text
project/
├─ src/
│  ├─ content/
│  ├─ assets/
│  ├─ layouts/
│  └─ includes/
└─ .eleventy.js
```

Quesby templates follow this layout by default, but the core does not enforce it.

## Options

All options are optional and can be used to customize the default behavior.

### `imageOptions`

Pass directly to `@11ty/eleventy-img`. Customize image processing behavior:

```js
quesbyCore(eleventyConfig, {
  imageOptions: {
    widths: [400, 800, 1200, 1600],
    formats: ['webp', 'jpeg'],
    outputDir: '_site/img/'
  }
});
```

### `markdownOptions`

Extend or replace the internal markdown-it configuration:

```js
quesbyCore(eleventyConfig, {
  markdownOptions: {
    html: true,
    breaks: true,
    linkify: true
  }
});
```

### `scssOptions`

Only relevant when paired with Quesby boilerplates. Configure SASS compilation settings.

## Versioning

This package follows simple semantic versioning:

* **patch** → fixes, internal refinements
* **minor** → new filters, shortcodes, helpers
* **major** → breaking changes

Templates using the core should always depend on a compatible semver range (e.g. `^0.1.0`).

## Changelog

See [releases on GitHub](https://github.com/quesby/quesby-core/releases) for detailed changelog and version history.

## License

MIT.
Do whatever you want with it, just don’t blame us when you break it.
