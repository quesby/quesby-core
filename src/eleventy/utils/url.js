/**
 * URL utility functions for SEO and absolute URL generation
 */

export function absoluteUrl(url, siteUrl) {
  if (!siteUrl) return url || "";
  const joined = `${siteUrl}${url?.startsWith("/") ? "" : "/"}${url || ""}`;
  return joined.replace(/(?<!:)\/\/+/g, "/").replace(":/", "://");
}
