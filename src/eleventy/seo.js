import { absoluteUrl } from "./utils/url.js";
import { DateTime } from "luxon";
import path from "node:path";
import fs from "fs";
import Image from "@11ty/eleventy-img";

/**
 * Process image with Eleventy Image and return processed URL
 * Returns the URL of the processed image (largest size) or fallback to original URL
 */
function processSeoImage(imageSrc, siteUrl) {
  if (!imageSrc || imageSrc.includes("http")) {
    // If already absolute URL or empty, return as-is
    return imageSrc ? absoluteUrl(imageSrc, siteUrl) : null;
  }

  // Try to resolve image path using same logic as image shortcode
  const possiblePaths = [];
  
  // If starts with /, try src/ + path
  if (imageSrc.startsWith('/')) {
    possiblePaths.push(path.join(process.cwd(), "src", imageSrc.substring(1)));
  }
  // If starts with content/ or assets/, try src/ + path
  else if (imageSrc.startsWith('content/') || imageSrc.startsWith('assets/')) {
    possiblePaths.push(path.join(process.cwd(), "src", imageSrc));
  }
  // Try common post image paths
  else {
    // Try /content/media/posts/ + filename (common pattern for posts)
    possiblePaths.push(path.join(process.cwd(), "src", "content", "media", "posts", imageSrc));
    // Try content/media/posts/ + filename
    possiblePaths.push(path.join(process.cwd(), "src", "content/media/posts", imageSrc));
    // Try assets/images/ + filename
    possiblePaths.push(path.join(process.cwd(), "src", "assets/images", imageSrc));
    // Try src/ + filename as fallback
    possiblePaths.push(path.join(process.cwd(), "src", imageSrc));
  }

  // Find first existing path
  let resolvedPath = null;
  for (const testPath of possiblePaths) {
    if (fs.existsSync(testPath)) {
      resolvedPath = testPath;
      break;
    }
  }

  if (!resolvedPath) {
    // Image not found, return original URL as fallback
    return absoluteUrl(imageSrc, siteUrl);
  }

  try {
    // Process image with Eleventy Image (sync version)
    const metadata = Image.statsSync(resolvedPath, {
      widths: [320, 640, 960, 1280, null],
      formats: ["avif", "webp"],
      outputDir: "./_site/assets/images/",
      urlPath: "/assets/images/",
    });

    // Get the largest image (prefer webp, then avif, then original format)
    let largestImage = null;

    // Prefer webp format if available
    if (metadata.webp && metadata.webp.length > 0) {
      // Get largest webp (sort by width descending)
      const webpImages = metadata.webp.sort((a, b) => (b.width || 0) - (a.width || 0));
      largestImage = webpImages[0];
    } 
    // Fallback to avif
    else if (metadata.avif && metadata.avif.length > 0) {
      const avifImages = metadata.avif.sort((a, b) => (b.width || 0) - (a.width || 0));
      largestImage = avifImages[0];
    }
    // Fallback to any other format
    else {
      for (const format in metadata) {
        if (metadata[format] && metadata[format].length > 0) {
          const images = metadata[format].sort((a, b) => (b.width || 0) - (a.width || 0));
          largestImage = images[0];
          break;
        }
      }
    }

    if (largestImage) {
      // Return absolute URL of processed image
      return absoluteUrl(largestImage.url, siteUrl);
    }

    // Fallback to original URL if processing succeeded but no image found
    return absoluteUrl(imageSrc, siteUrl);
  } catch (error) {
    // If processing fails, return original URL as fallback
    console.warn(`[SEO] Failed to process image ${imageSrc}:`, error.message);
    return absoluteUrl(imageSrc, siteUrl);
  }
}

/**
 * Build SEO model from page, site, and data
 * Returns normalized SEO data structure
 */
export function buildSeoModel(page, site, data = {}) {
  // Resolve title with fallback hierarchy
  const seoTitle = data.seoTitle || data.postTitle || data.title || site.name || "";
  
  // Resolve description with fallback
  const seoDescription = data.postDescription || data.description || site.description || "";
  
  // Resolve image with fallback and process with Eleventy Image
  let seoImage = data.postImage || data.image || site.socialImage || null;
  if (seoImage) {
    seoImage = processSeoImage(seoImage, site.url);
  }
  
  // Build page URL
  const pageUrl = absoluteUrl(page?.url || "", site.url);
  
  // Determine post type (for Open Graph)
  const postType = data.postType || "website";
  
  // Robots meta
  const robotsContent = data.noindex ? "noindex, nofollow, noarchive" : "index, follow";
  
  // Twitter card type
  const twitterCard = seoImage ? "summary_large_image" : "summary";
  
  // Twitter handle (clean @ symbol)
  const twitterHandle = site.twitter ? site.twitter.replace(/^@/, "") : null;
  
  // Schema type for JSON-LD (default based on postType)
  const schemaType = data.schemaType || (postType === "article" ? "BlogPosting" : "WebPage");
  
  // Date handling for JSON-LD
  let datePublished = null;
  let dateModified = null;
  
  if (data.date) {
    try {
      const dt = typeof data.date === "string" 
        ? DateTime.fromISO(data.date) 
        : DateTime.fromJSDate(data.date);
      datePublished = dt.isValid ? dt.toFormat("yyyy-MM-dd") : null;
      dateModified = datePublished; // Default to same as published
    } catch (e) {
      // Ignore date parsing errors
    }
  }
  
  if (data.lastUpdated && datePublished) {
    try {
      const dt = typeof data.lastUpdated === "string"
        ? DateTime.fromISO(data.lastUpdated)
        : DateTime.fromJSDate(data.lastUpdated);
      dateModified = dt.isValid ? dt.toFormat("yyyy-MM-dd") : datePublished;
    } catch (e) {
      // Ignore date parsing errors
    }
  }
  
  return {
    title: seoTitle,
    description: seoDescription,
    image: seoImage,
    imageAlt: data.ogImageAlt || seoTitle, // Custom alt text for og:image:alt, fallback to title
    url: pageUrl,
    postType,
    robots: robotsContent,
    twitterCard,
    twitterHandle,
    schemaType,
    author: data.author || null,
    tags: Array.isArray(data.tags) ? data.tags : (data.tags ? [data.tags] : []),
    datePublished,
    dateModified,
    noindex: data.noindex || false,
    // Flags for disabling parts of SEO
    disableJsonLd: data.seoDisableCoreJsonLd || false,
    disableHead: data.seoDisableCoreHead || false,
  };
}

/**
 * Generate HTML meta tags (title, description, robots, canonical, Open Graph, Twitter Cards)
 * Returns HTML string ready to insert in <head>
 */
export function generateSeoHeadHtml(seoModel, site) {
  if (seoModel.disableHead) {
    return "";
  }
  
  const parts = [];
  
  // Title
  parts.push(`<title>${escapeHtml(seoModel.title)}</title>`);
  
  // Description
  if (seoModel.description) {
    parts.push(`<meta name="description" content="${escapeHtml(seoModel.description)}">`);
  }
  
  // Robots
  parts.push(`<meta name="robots" content="${seoModel.robots}">`);
  
  // Canonical
  parts.push(`<link rel="canonical" href="${escapeHtml(seoModel.url)}">`);
  
  // Open Graph
  // Convert language format from en-US to en_US for Open Graph
  const ogLocale = site.language 
    ? site.language.replace(/-/g, "_") 
    : "en_US";
  parts.push(`<meta property="og:locale" content="${ogLocale}">`);
  parts.push(`<meta property="og:type" content="${seoModel.postType}">`);
  if (site.name) {
    parts.push(`<meta property="og:site_name" content="${escapeHtml(site.name)}">`);
  }
  parts.push(`<meta property="og:title" content="${escapeHtml(seoModel.title)}">`);
  if (seoModel.description) {
    parts.push(`<meta property="og:description" content="${escapeHtml(seoModel.description)}">`);
  }
  parts.push(`<meta property="og:url" content="${escapeHtml(seoModel.url)}">`);
  
  if (seoModel.image) {
    parts.push(`<meta property="og:image" content="${escapeHtml(seoModel.image)}">`);
    parts.push(`<meta property="og:image:width" content="1200">`);
    parts.push(`<meta property="og:image:height" content="630">`);
    parts.push(`<meta property="og:image:alt" content="${escapeHtml(seoModel.imageAlt)}">`);
  }
  
  // Twitter Cards
  parts.push(`<meta name="twitter:card" content="${seoModel.twitterCard}">`);
  if (seoModel.twitterHandle) {
    parts.push(`<meta name="twitter:site" content="@${escapeHtml(seoModel.twitterHandle)}">`);
  }
  parts.push(`<meta name="twitter:title" content="${escapeHtml(seoModel.title)}">`);
  if (seoModel.description) {
    parts.push(`<meta name="twitter:description" content="${escapeHtml(seoModel.description)}">`);
  }
  if (seoModel.image) {
    parts.push(`<meta name="twitter:image" content="${escapeHtml(seoModel.image)}">`);
  }
  
  return parts.join("\n");
}

/**
 * Generate JSON-LD structured data
 * Returns JSON-LD script tag as HTML string
 */
export function generateSeoJsonLd(seoModel, site) {
  if (seoModel.disableJsonLd) {
    return "";
  }
  
  const schema = {
    "@context": "https://schema.org",
  };
  
  if (seoModel.schemaType === "BlogPosting") {
    schema["@type"] = "BlogPosting";
    schema.headline = seoModel.title;
    if (seoModel.description) {
      schema.description = seoModel.description;
    }
    if (seoModel.image) {
      schema.image = seoModel.image;
    }
    if (seoModel.author) {
      schema.author = {
        "@type": "Person",
        name: seoModel.author,
      };
    }
    if (site.name) {
      schema.publisher = {
        "@type": "Organization",
        name: site.name,
      };
      if (site.logo) {
        schema.publisher.logo = {
          "@type": "ImageObject",
          url: absoluteUrl(site.logo, site.url),
        };
      }
    }
    if (seoModel.datePublished) {
      schema.datePublished = seoModel.datePublished;
    }
    if (seoModel.dateModified) {
      schema.dateModified = seoModel.dateModified;
    }
    schema.mainEntityOfPage = {
      "@type": "WebPage",
      "@id": seoModel.url,
    };
    if (seoModel.tags && seoModel.tags.length > 0) {
      schema.keywords = seoModel.tags.join(", ");
    }
  } else if (seoModel.schemaType === "WebSite") {
    schema["@type"] = "WebSite";
    if (site.name) {
      schema.name = site.name;
    }
    if (site.url) {
      schema.url = site.url;
    }
    if (site.description) {
      schema.description = site.description;
    }
    if (site.name) {
      schema.publisher = {
        "@type": "Organization",
        name: site.name,
      };
      if (site.logo) {
        schema.publisher.logo = {
          "@type": "ImageObject",
          url: absoluteUrl(site.logo, site.url),
        };
      }
    }
  } else {
    // WebPage (default)
    schema["@type"] = "WebPage";
    if (seoModel.title) {
      schema.name = seoModel.title;
    }
    if (seoModel.description) {
      schema.description = seoModel.description;
    }
    if (seoModel.url) {
      schema.url = seoModel.url;
    }
  }
  
  return `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`;
}

/**
 * Escape HTML entities
 */
function escapeHtml(text) {
  if (!text) return "";
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return String(text).replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Register SEO filters and shortcodes for Eleventy
 */
export function register(eleventyConfig) {
  // Canonical URL filter (keep existing for backward compatibility)
  eleventyConfig.addFilter("canonical", (pageUrl, siteUrl) => {
    return absoluteUrl(pageUrl, siteUrl);
  });

  // SEO Title builder with fallback (keep existing for backward compatibility)
  eleventyConfig.addFilter("seoTitle", (title, siteName) => {
    if (!title) return siteName;
    return `${title} | ${siteName}`;
  });

  // Absolute URL filter for images and assets (keep existing for backward compatibility)
  eleventyConfig.addFilter("absoluteUrl", (url, siteUrl) => {
    return absoluteUrl(url, siteUrl);
  });

  // Meta description fallback (keep existing for backward compatibility)
  eleventyConfig.addFilter("seoDescription", (description, fallback) => {
    return description || fallback || "";
  });
  
  // New: Build SEO model filter
  // Accepts page (with page.data containing frontmatter) and site
  // Optionally accepts a data object to override page.data (useful when frontmatter vars are in template context)
  eleventyConfig.addFilter("seoModel", (page, site, data = null) => {
    // If data is provided, use it; otherwise use page.data
    // This allows passing frontmatter variables from template context
    const frontmatterData = data !== null ? data : (page?.data || {});
    return buildSeoModel(page, site, frontmatterData);
  });
  
  // New: Generate SEO head HTML filter
  eleventyConfig.addFilter("seoHeadHtml", (seoModel, site) => {
    return generateSeoHeadHtml(seoModel, site);
  });
  
  // New: Generate JSON-LD filter
  eleventyConfig.addFilter("seoJsonLd", (seoModel, site) => {
    return generateSeoJsonLd(seoModel, site);
  });
  
  // New: Shortcode for SEO head (convenience)
  eleventyConfig.addShortcode("seoHead", function(page, site) {
    const data = page?.data || {};
    const model = buildSeoModel(page, site, data);
    return generateSeoHeadHtml(model, site);
  });
  
  // New: Shortcode for JSON-LD (convenience)
  eleventyConfig.addShortcode("seoJsonLdShortcode", function(page, site) {
    const data = page?.data || {};
    const model = buildSeoModel(page, site, data);
    return generateSeoJsonLd(model, site);
  });
}
