/**
 * URL utility functions for SEO and absolute URL generation
 */

export function absoluteUrl(url, siteUrl) {
  if (!siteUrl) return url || "";
  
  // If url is already absolute (starts with http:// or https://), return as-is
  if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
    return url;
  }
  
  // Normalize siteUrl: remove trailing slash
  const normalizedSiteUrl = siteUrl.replace(/\/+$/, "");
  
  // Normalize url: ensure it starts with /
  const normalizedUrl = url?.startsWith("/") ? url : `/${url || ""}`;
  
  // Join and clean up any double slashes (but preserve https://)
  const joined = `${normalizedSiteUrl}${normalizedUrl}`;
  return joined.replace(/([^:]\/)\/+/g, "$1");
}
