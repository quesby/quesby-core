import { absoluteUrl } from "./utils/url.js";

export function register(eleventyConfig) {
  // Canonical URL filter
  eleventyConfig.addFilter("canonical", (pageUrl, siteUrl) => {
    return absoluteUrl(pageUrl, siteUrl);
  });

  // SEO Title builder with fallback
  eleventyConfig.addFilter("seoTitle", (title, siteName) => {
    if (!title) return siteName;
    return `${title} | ${siteName}`;
  });

  // Absolute URL filter for images and assets
  eleventyConfig.addFilter("absoluteUrl", (url, siteUrl) => {
    return absoluteUrl(url, siteUrl);
  });

  // Meta description fallback
  eleventyConfig.addFilter("seoDescription", (description, fallback) => {
    return description || fallback || "";
  });
}
