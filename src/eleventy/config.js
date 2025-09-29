import Image from "@11ty/eleventy-img";
import { eleventyImageTransformPlugin } from "@11ty/eleventy-img";
import slugify from "slugify";
import MarkdownIt from 'markdown-it';
import MarkdownItLinkAttributes from 'markdown-it-link-attributes';
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { execSync } from "child_process";
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeExpressiveCode from 'rehype-expressive-code';
import rehypeStringify from 'rehype-stringify';
import { DateTime } from "luxon";
import * as cheerio from 'cheerio';

// Import local modules
import filters from "./filters.js";
import rss from "./utils/rss.js";
import shortcodes from "./shortcodes.js";
import { register as registerSEO } from "./seo.js";

export function createEleventyConfig() {
  dotenv.config();

  // Get site data from the website's _data directory
  const sitePath = path.resolve(process.cwd(), "src/_data/site.json");
  const site = JSON.parse(fs.readFileSync(sitePath, "utf-8"));

  /**
   * Replace ${VARNAME} in a string with corresponding process.env values.
   * Example: "${NEUTRINO_CONTENT_PATH}" → "D:/..."
   */
  function expandEnv(str) {
    if (typeof str !== "string") return str;
    return str.replace(/\$\{([^}]+)\}/g, (_, key) => process.env[key] ?? "");
  }

  /**
   * Copy directory recursively with proper error handling
   */
  function copyDirectoryRecursive(source, destination) {
    try {
      // Ensure destination directory exists
      if (!fs.existsSync(destination)) {
        fs.mkdirSync(destination, { recursive: true });
      }

      // Read source directory
      const items = fs.readdirSync(source);
      
      for (const item of items) {
        const sourcePath = path.join(source, item);
        const destPath = path.join(destination, item);
        
        if (fs.statSync(sourcePath).isDirectory()) {
          // Recursively copy subdirectories
          copyDirectoryRecursive(sourcePath, destPath);
        } else {
          // Copy files
          fs.copyFileSync(sourcePath, destPath);
        }
      }
      
      console.log(`✅ Contents copied from: ${source} → ${destination}`);
    } catch (error) {
      console.error(`❌ Error during copy: ${error.message}`);
      throw error;
    }
  }

  /**
   * Setup content directory automatically
   */
  function setupContentDirectory() {
    // Expand and normalize the content path
    const raw = expandEnv(site.contentPath);
    const resolvedRaw = raw && raw.trim().length ? raw : "src/content";

    // Resolve path relative to project root (process.cwd())
    const contentPath = path.isAbsolute(resolvedRaw)
      ? resolvedRaw
      : path.resolve(process.cwd(), resolvedRaw);

    // Check if external content path exists
    if (!fs.existsSync(contentPath)) {
      throw new Error(
        `❌ Content path not found:\n${contentPath}\n\n` +
        `Check your contentPath in site.json or the .env variable NEUTRINO_CONTENT_PATH`
      );
    }

    // Define local content directory
    const localContentDir = path.join(process.cwd(), "src", "content");
    
    // Check if we need to copy contents
    if (!fs.existsSync(localContentDir) || fs.readdirSync(localContentDir).length === 0) {
      console.log(`🔄 Automatic content directory setup...`);
      console.log(`�� External path: ${contentPath}`);
      console.log(`📁 Local directory: ${localContentDir}`);
      
      // Copy contents from external path to local src/content
      copyDirectoryRecursive(contentPath, localContentDir);
    } else {
      console.log(`✅ Content directory already configured: ${localContentDir}`);
    }

    return localContentDir;
  }

  // Setup content directory before Eleventy configuration
  const localContentPath = setupContentDirectory();

  return function(eleventyConfig) {
    // Load theme from site.json configuration
    const siteData = JSON.parse(fs.readFileSync(sitePath, 'utf8'));
    const activeTheme = siteData.theme || "neutrino-electron-core";

    // Watch folders
    eleventyConfig.addWatchTarget("src/_data");
    eleventyConfig.addWatchTarget("src/scss");
    eleventyConfig.addWatchTarget(`src/themes/${activeTheme}`); // Aggiunto src/
    eleventyConfig.addWatchTarget(localContentPath); // Watch content directory

    // Pass-through static files
    eleventyConfig.addPassthroughCopy({ "src/assets": "/assets" });
    eleventyConfig.addPassthroughCopy({ "src/admin": "/admin" });

    // Pass-through for content media - copy only post directories
    eleventyConfig.addPassthroughCopy({ "src/content/posts": "/content/posts" });
    eleventyConfig.addPassthroughCopy({ "src/content/media": "/content/media" });

    // Copy SCSS files from core to website
    eleventyConfig.addPassthroughCopy({ 
      "packages/@neutrino/core/src/sass": "/sass" 
    });

    // Global variable for Nunjucks templates
    eleventyConfig.addGlobalData("theme", activeTheme);

    // add collections for posts, projects, and documentation
    eleventyConfig.addCollection('posts', collection => {
      // Support both old format (ULID only) and new format (ULID--slug)
      const posts = collection.getFilteredByGlob([
        'src/content/posts/*/index.md',  // Old format: ULID/index.md
        'src/content/posts/*--*/index.md' // New format: ULID--slug/index.md
      ]);
      console.log(`[📝] Collection posts: found ${posts.length} posts`);
      console.log(`[��] Patterns used: src/content/posts/*/index.md and src/content/posts/*--*/index.md`);
      return posts;
    });

    eleventyConfig.addCollection('documentation', collection => {
      const docs = collection.getFilteredByGlob(['src/content/documentation/*.md']);
      console.log(`[📚] Collection documentation: found ${docs.length} pages`);
      console.log(`[🔍] Pattern used: src/content/documentation/*.md`);
      return docs.sort((a, b) => {
        // Sort by order field first, then by title
        const orderA = a.data.order || 999;
        const orderB = b.data.order || 999;
        
        if (orderA !== orderB) {
          return orderA - orderB;
        }
        
        // If same order, sort by title
        const titleA = a.data.title || a.fileSlug || '';
        const titleB = b.data.title || b.fileSlug || '';
        return titleA.localeCompare(titleB);
      });
    });

    eleventyConfig.addFilter("slugify", str =>
      slugify(str, { lower: true, strict: true })
    );

    // Register SEO filters and utilities
    registerSEO(eleventyConfig);

    // Documentation navigation filters
    eleventyConfig.addFilter("getNextDoc", (currentUrl, docs) => {
      const currentIndex = docs.findIndex(doc => doc.url === currentUrl);
      return currentIndex < docs.length - 1 ? docs[currentIndex + 1] : null;
    });

    eleventyConfig.addFilter("getPrevDoc", (currentUrl, docs) => {
      const currentIndex = docs.findIndex(doc => doc.url === currentUrl);
      return currentIndex > 0 ? docs[currentIndex - 1] : null;
    });

    // Custom plugin to process images with eleventy-img
    const rehypeImages = () => {
      return (tree) => {
        const visit = (node) => {
          if (node.type === 'element' && node.tagName === 'img') {
            const src = node.properties?.src;
            const alt = node.properties?.alt || '';
            
            // Skip external URLs
            if (src && (src.startsWith('http') || src.startsWith('data:'))) {
              return;
            }
            
            // Process local images with eleventy-img
            if (src) {
              console.log(`🖼️ Found image to process: ${src}`);
              
              // Replace the img element with a placeholder that we'll process later
              node.type = 'element';
              node.tagName = 'div';
              node.properties = {
                'data-image-src': src,
                'data-image-alt': alt,
                'data-image-placeholder': 'true'
              };
              node.children = [];
            }
          }
          
          if (node.children) {
            node.children.forEach(visit);
          }
        };
        
        visit(tree);
      };
    };

    const processor = unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkRehype)
      .use(rehypeImages)
      .use(rehypeExpressiveCode, {
        themes: ['github-light', 'github-dark'],
        defaultProps: {
          wrap: true
        }
      })
      .use(rehypeStringify);

    eleventyConfig.setLibrary("md", {
      async render(str) {
        const result = await processor.process(str);
        return result.toString();
      }
    });

    // Configure markdown-it
    const md = new MarkdownIt({
      html: true,
      breaks: true,
      linkify: true
    }).use(MarkdownItLinkAttributes, {
      pattern: /^https?:/,
      attrs: {
        target: '_blank',
        rel: 'noopener'
      }
    });

    // Add custom image processing to markdown-it
    md.renderer.rules.image = function (tokens, idx, options, env, renderer) {
      const token = tokens[idx];
      const src = token.attrGet('src');
      const alt = token.attrGet('alt') || '';
      
      // Skip external URLs
      if (src && (src.startsWith('http') || src.startsWith('data:'))) {
        return `<img src="${src}" alt="${alt}">`;
      }
      
      // For local images, we'll process them with eleventy-img
      // This is a placeholder - we'll need to handle this differently
      return `<img src="${src}" alt="${alt}">`;
    };

    // Date formatting with Luxon
    eleventyConfig.addFilter("date", (dateObj, format = "dd LLLL yyyy") => {
      let dt;
      
      if (typeof dateObj === 'string') {
        // try different string formats
        dt = DateTime.fromISO(dateObj) || 
             DateTime.fromSQL(dateObj) || 
             DateTime.fromFormat(dateObj, 'yyyy-MM-dd');
      } else if (dateObj instanceof Date) {
        dt = DateTime.fromJSDate(dateObj);
      } else {
        // Fallback
        dt = DateTime.fromJSDate(new Date(dateObj));
      }
      
      return dt.setZone("utc").setLocale("it").toFormat(format);
    });

    // Filter to include markdown files with Expressive Code support
    eleventyConfig.addFilter("includeMarkdown", async function(markdownPath) {
      try {
        // Path relative to src/_includes directory
        const fullPath = path.join(process.cwd(), 'src', '_includes', markdownPath);
        
        console.log(`🔍 Looking for markdown file: ${fullPath}`);
        console.log(`🔍 File exists: ${fs.existsSync(fullPath)}`);
        
        if (fs.existsSync(fullPath)) {
          const markdownContent = fs.readFileSync(fullPath, 'utf-8');
          console.log(`✅ Successfully loaded: ${markdownPath}`);
          
          // Use unified processor with Expressive Code
          const result = await processor.process(markdownContent);
          return result.toString();
        } else {
          console.warn(`⚠️  Markdown file not found: ${fullPath}`);
          return `<p>⚠️ Content not found: ${markdownPath}</p>`;
        }
      } catch (error) {
        console.error(`❌ Error loading ${markdownPath}:`, error);
        return `<p>❌ Error loading content</p>`;
      }
    });

    // Format number with thousands separator
    eleventyConfig.addFilter("formatNumber", (num, options = {}) => {
      if (typeof num !== 'number') return num;
      
      const {
        thousandsSeparator = ".",
        decimalSeparator = ",",
        decimals = 0
      } = options;
      
      return num.toLocaleString('it-IT', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      }).replace(/,/g, decimalSeparator).replace(/\./g, thousandsSeparator);
    });

    eleventyConfig.addGlobalData("eleventyComputed", {
      permalink: (data) => {
        const input = (data.page?.inputPath || "").replace(/\\/g, "/");
        if (input.includes("/content/posts/")) {
          // Use slug from frontmatter, otherwise fallback to fileSlug
          const slug = data.slug || data.page.fileSlug;
          return `/blog/${slug}/`;
        }
        if (input.includes("/content/documentation/")) {
          // Use slug from frontmatter, otherwise fallback to fileSlug
          const slug = data.slug || data.page.fileSlug;
          return `/documentation/${slug}/`;
        }
        return data.permalink;
      },
      layout: (data) => {
        const input = (data.page?.inputPath || "").replace(/\\/g, "/");
        if (input.includes("/content/posts/")) return "layouts/single-post.njk";
        return data.layout;
      },
      tags: (data) => {
        const input = (data.page?.inputPath || "").replace(/\\/g, "/");
        if (!input.includes("/content/posts/")) return data.tags;
        const prev = Array.isArray(data.tags) ? data.tags : (data.tags ? [data.tags] : []);
        return Array.from(new Set([...prev, "blog"]));
      },
    });

    // Transform to process image placeholders with eleventy-img
    eleventyConfig.addTransform("processImagePlaceholders", async function(content, outputPath) {
      // Only process HTML files
      if (!outputPath || !outputPath.endsWith('.html')) {
        return content;
      }

      // Find all image placeholders
      const placeholderRegex = /<div data-image-src="([^"]*)" data-image-alt="([^"]*)" data-image-placeholder="true"[^>]*><\/div>/g;
      
      let processedContent = content;
      let match;
      const placeholders = [];
      
      // Collect all placeholders
      while ((match = placeholderRegex.exec(content)) !== null) {
        placeholders.push({
          fullMatch: match[0],
          src: match[1],
          alt: match[2],
          index: match.index
        });
      }

      console.log(`🖼️ Processing ${placeholders.length} image placeholders in ${outputPath}`);

      // Process placeholders in reverse order to maintain indices
      for (let i = placeholders.length - 1; i >= 0; i--) {
        const { fullMatch, src, alt, index } = placeholders[i];
        
        try {
          // Unified path resolution - same logic as shortcode
          let imagePath;
          if (src.startsWith('/')) {
            imagePath = path.resolve(process.cwd(), "src", src.substring(1));
          } else if (src.startsWith('content/')) {
            imagePath = path.resolve(process.cwd(), "src", src);
          } else if (src.startsWith('assets/')) {
            imagePath = path.resolve(process.cwd(), "src", src);
          } else {
            imagePath = path.resolve(process.cwd(), "src", src);
          }

          // Check if image exists
          if (!fs.existsSync(imagePath)) {
            console.warn(`⚠️ Image not found: ${imagePath}`);
            continue;
          }

          // Process image with eleventy-img
          const metadata = await Image(imagePath, {
            widths: [320, 640, 960, 1280, null],
            formats: ["avif", "webp"],
            outputDir: "./_site/assets/images/",
            urlPath: "/assets/images/",
          });

          const imageAttributes = {
            alt: alt || '',
            sizes: "100vw",
            loading: "lazy",
            decoding: "async",
          };

          const replacement = `<figure>${Image.generateHTML(metadata, imageAttributes)}</figure>`;
          processedContent = processedContent.substring(0, index) + replacement + processedContent.substring(index + fullMatch.length);
          
          console.log(`✅ Processed image: ${src}`);
        } catch (error) {
          console.error(`❌ Error processing image ${src}:`, error);
          // Keep original placeholder if processing fails
        }
      }

      return processedContent;
    });

    // Add transform to add IDs to headings and insert TOC in aside
    eleventyConfig.addTransform("addHeadingIdsAndTOC", function(content, outputPath) {
      // Only process HTML files in documentation
      if (outputPath && outputPath.endsWith('.html') && outputPath.includes('/documentation/')) {
        console.log(`Adding heading IDs and TOC for: ${outputPath}`);
        
        // Parse HTML with Cheerio
        const $ = cheerio.load(content);
        const headings = [];
        let headingCount = 0;
        
        // Find all h2 elements and add IDs
        $('h2').each(function() {
          const $heading = $(this);
          const title = $heading.text().trim();
          
          // Skip if already has an ID
          if ($heading.attr('id')) {
            return;
          }
          
          // Generate anchor from title
          const anchor = title
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-')
            .trim();
          
          // Add ID to heading
          $heading.attr('id', anchor);
          headingCount++;
          
          // Add to headings array for TOC
          headings.push({
            title: title,
            anchor: anchor
          });
        });
        
        // Generate TOC HTML if we have headings
        if (headings.length > 0) {
          let tocHTML = '<nav class="documentation-toc">\n';
          tocHTML += '  <h3>On this page</h3>\n';
          tocHTML += '  <ul>\n';
          
          headings.forEach(heading => {
            tocHTML += `    <li>\n`;
            tocHTML += `      <a href="#${heading.anchor}">${heading.title}</a>\n`;
            tocHTML += `    </li>\n`;
          });
          
          tocHTML += '  </ul>\n';
          tocHTML += '</nav>';
          
          // Replace the TOC placeholder in the aside
          $('nav.documentation-toc').replaceWith(tocHTML);
          
          console.log(`Added IDs to ${headingCount} headings and inserted TOC for ${outputPath}`);
        }
        
        return $.html();
      }
      
      return content;
    });

    // Load filters
    filters(eleventyConfig);
    rss(eleventyConfig);
    shortcodes(eleventyConfig);

    return {
      dir: {
        input: "src",
        output: "_site",
        includes: "_includes",
        data: "_data"
      },
      markdownTemplateEngine: false,
      htmlTemplateEngine: "njk",
      passthroughFileCopy: true
    };
  };
}
