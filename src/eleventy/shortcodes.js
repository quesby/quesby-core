import path from "node:path";
import fs from "fs";
import Image from "@11ty/eleventy-img";

// Unified image shortcode - ASYNC
async function imageShortcode(src, alt = "", sizesOrAttrs = "100vw", attrs = {}) {
  if (!src) {
    return "";
  }
  if (!alt) throw new Error(`Missing alt for ${src}`);

  // Determine sizes and attributes based on third parameter type
  let sizes = "100vw";
  let htmlAttrs = {};
  
  if (typeof sizesOrAttrs === "string" || sizesOrAttrs === undefined) {
    // Third param is sizes (string) or undefined
    sizes = sizesOrAttrs || "100vw";
    htmlAttrs = attrs || {};
  } else if (typeof sizesOrAttrs === "object" && sizesOrAttrs !== null) {
    // Third param is attributes object
    sizes = "100vw";
    htmlAttrs = sizesOrAttrs;
  }

  // Unified path resolution - handle different input patterns
  let resolved;
  if (src.startsWith('/')) {
    // Absolute path from root - remove duplicate "website"
    resolved = path.join(process.cwd(), "src", src.substring(1));
  } else if (src.startsWith('content/')) {
    // Content directory path
    resolved = path.join(process.cwd(), "src", src);
  } else if (src.startsWith('assets/')) {
    // Assets directory path
    resolved = path.join(process.cwd(), "src", src);
  } else {
    // Relative path - assume it's from src root
    resolved = path.join(process.cwd(), "src", src);
  }
  
  if (!fs.existsSync(resolved)) {
    console.warn(`[imageShortcode] File not found: ${resolved}`);
    const fallbackAttrs = { loading: "lazy", decoding: "async", ...htmlAttrs };
    const attrsString = Object.entries(fallbackAttrs)
      .map(([key, value]) => `${key}="${value}"`)
      .join(" ");
    return `<img src="${src}" alt="${alt}" ${attrsString}>`;
  }

  const metadata = await Image(resolved, {
    widths: [320, 640, 960, 1280, null],
    formats: ["avif", "webp"],
    outputDir: "./_site/assets/images/",
    urlPath: "/assets/images/",
  });

  return Image.generateHTML(metadata, {
    alt,
    sizes,
    loading: "lazy",
    decoding: "async",
    ...htmlAttrs
  });
}

// Shortcode for images - SYNC (for cases where async is not possible)
function imageShortcodeSync(src, alt = "", sizesOrAttrs = "100vw", attrs = {}) {
  // Determine sizes and attributes based on third parameter type
  let sizes = "100vw";
  let htmlAttrs = {};
  
  if (typeof sizesOrAttrs === "string" || sizesOrAttrs === undefined) {
    // Third param is sizes (string) or undefined
    sizes = sizesOrAttrs || "100vw";
    htmlAttrs = attrs || {};
  } else if (typeof sizesOrAttrs === "object" && sizesOrAttrs !== null) {
    // Third param is attributes object
    sizes = "100vw";
    htmlAttrs = sizesOrAttrs;
  }

  // Use same path resolution logic as async version
  let resolved;
  if (src.startsWith('/')) {
    resolved = path.join(process.cwd(), "src", src.substring(1));
  } else if (src.startsWith('content/')) {
    resolved = path.join(process.cwd(), "src", src);
  } else if (src.startsWith('assets/')) {
    resolved = path.join(process.cwd(), "src", src);
  } else {
    resolved = path.join(process.cwd(), "src", src);
  }

  if (!fs.existsSync(resolved)) {
    console.warn(`[imageShortcodeSync] File not found: ${resolved}`);
    const fallbackAttrs = { loading: "lazy", decoding: "async", ...htmlAttrs };
    const attrsString = Object.entries(fallbackAttrs)
      .map(([key, value]) => `${key}="${value}"`)
      .join(" ");
    return `<img src="${src}" alt="${alt}" ${attrsString}>`;
  }

  const metadata = Image.statsSync(resolved, {
    widths: [320, 640, 960, 1280, null],
    formats: ["avif", "webp"],
    outputDir: "./_site/assets/images/",
    urlPath: "/assets/images/",
  });
  
  return Image.generateHTML(metadata, { 
    alt, 
    sizes, 
    loading: "lazy", 
    decoding: "async",
    ...htmlAttrs
  });
}

// Shortcode for SVG inline
function svgShortcode(svgPath, className = "") {
  try {
    const fullPath = path.join(process.cwd(), "src", svgPath);
    const svgContent = fs.readFileSync(fullPath, "utf8");

    const cleanSvg = svgContent.replace(/<svg([^>]*)>/, (match, attrs) => {
      // cerca attributo class
      const classAttrMatch = attrs.match(/class="([^"]*)"/);

      if (classAttrMatch) {
        // se esiste già, append
        const existingClasses = classAttrMatch[1];
        const mergedClasses = `${existingClasses} ${className}`.trim();
        return match.replace(
          /class="[^"]*"/,
          `class="${mergedClasses}"`
        );
      } else {
        // altrimenti aggiungi attributo class
        return `<svg${attrs} class="${className}">`;
      }
    });

    return cleanSvg;
  } catch (error) {
    console.error(`Error loading SVG: ${svgPath}`, error);
    return "";
  }
}

// Shortcode for simple images (fallback)
function imageSimpleShortcode(src, alt, className = "") {
  // Ensure the path is correct
  const imagePath = src.startsWith('/') ? src : `/${src}`;
  return `<img src="${imagePath}" alt="${alt}" class="${className}" loading="lazy" decoding="async">`;
}

export default (cfg)=> {
  cfg.addNunjucksAsyncShortcode("image", imageShortcode);
  cfg.addNunjucksShortcode("imageSync", imageShortcodeSync);
  cfg.addNunjucksShortcode("imageSimple", imageSimpleShortcode);
  cfg.addNunjucksShortcode("svg", svgShortcode);
};
