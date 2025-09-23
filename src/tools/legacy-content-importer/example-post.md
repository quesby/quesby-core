# tools/legacy-content-importer/example-post.md
---
page-title: "Example Post from Legacy System"
seoTitle: "Example Post from Legacy System"
descrizione: "This is an example post to test the importer"
date: 2025-01-20T12:00:00
excerpt: "Short description of the post"
image: "example-image.webp"
type: "post"
category: "Tutorial"
tags: [example, test, migration]
layout: single-post
---

# Example Post

This is an example post to test the Neutrino Legacy Content Importer.

## Features

- Automatic ULID generation
- Frontmatter conversion
- Slug generation
- Alias creation
- Image path handling

## Usage

```bash
npx neutrino-legacy-content-importer \
  --source ./example-post.md \
  --target ./src/content/posts \
  --dry-run
```

This will convert the legacy format to Neutrino's ULID system.