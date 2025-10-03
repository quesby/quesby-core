import path from "node:path";
import fs from "fs";
import Image from "@11ty/eleventy-img";

// Unified image shortcode - ASYNC
async function imageShortcode(src, alt = "", sizes = "100vw") {
  console.log(`[DEBUG] imageShortcode called with: src="${src}", alt="${alt}", sizes="${sizes}"`);
  
  if (!src) {
    console.log(`[DEBUG] No src provided, returning empty string`);
    return "";
  }
  if (!alt) throw new Error(`Missing alt for ${src}`);

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
  
  console.log(`[DEBUG] Resolved path: ${resolved}`);

  if (!fs.existsSync(resolved)) {
    console.warn(`[imageShortcode] File not found: ${resolved}`);
    return `<img src="${src}" alt="${alt}" loading="lazy" decoding="async">`;
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
    decoding: "async"
  });
}

// Shortcode for images - SYNC (for cases where async is not possible)
function imageShortcodeSync(src, alt = "", sizes = "100vw") {
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
    return `<img src="${src}" alt="${alt}" loading="lazy" decoding="async">`;
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
    decoding: "async" 
  });
}

// Shortcode for SVG inline
function svgShortcode(svgPath, className = "") {
  console.log(`[DEBUG] SVG shortcode called with: ${svgPath}, ${className}`);
  try {
    const fullPath = path.join(process.cwd(), "src", svgPath);
    console.log(`[DEBUG] Full path: ${fullPath}`);
    const svgContent = fs.readFileSync(fullPath, "utf8");
    console.log(`[DEBUG] SVG content length: ${svgContent.length}`);

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
  console.log('[DEBUG] Registering shortcodes...');
  cfg.addNunjucksAsyncShortcode("image", imageShortcode);
  cfg.addNunjucksShortcode("imageSync", imageShortcodeSync);
  cfg.addNunjucksShortcode("imageSimple", imageSimpleShortcode);
  cfg.addNunjucksShortcode("svg", svgShortcode);
  console.log('[DEBUG] Shortcodes registered');
};
