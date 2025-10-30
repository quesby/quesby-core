import { DateTime } from "luxon";

export default function(eleventyConfig) {
  // Format date to W3C (ISO 8601) for sitemaps
  eleventyConfig.addFilter("w3cDate", dateObj => {
    if (!dateObj) return "";
    return DateTime.fromJSDate(dateObj, { zone: "utc" }).toFormat("yyyy-MM-dd");
  });

  // URL encoding filter (equivalent to Liquid's url_encode)
  eleventyConfig.addFilter("url_encode", str => {
    if (!str) return "";
    return encodeURIComponent(str);
  });

   // Generic sort filter
   eleventyConfig.addFilter("sortBy", (arr, attr, direction = "asc") => {
    if (!Array.isArray(arr)) return arr;

    return arr.slice().sort((a, b) => {
      // get nested property (attr or data.attr)
      const getValue = (obj, key) => {
        // prefer explicit key (a.date) else fallback to (a.data.date)
        if (obj[key] !== undefined) return obj[key];
        if (obj.data && obj.data[key] !== undefined) return obj.data[key];
        return key.split('.').reduce((o, k) => o?.[k], obj);
      };

      const valA = getValue(a, attr);
      const valB = getValue(b, attr);

      if (valA === valB) return 0;
      if (direction === "desc") return valA < valB ? 1 : -1;
      return valA > valB ? 1 : -1;
    });
  });

  // Limit results
  eleventyConfig.addFilter("limit", (arr, n) => {
    if (!Array.isArray(arr)) return arr;
    return arr.slice(0, n);
  });

  // Offset results
  eleventyConfig.addFilter("offset", (arr, n) => {
    if (!Array.isArray(arr)) return arr;
    return arr.slice(n);
  });

  // Exclude current item from array
  eleventyConfig.addFilter("exclude", (arr, current) => {
    if (!Array.isArray(arr) || !current) return arr || [];
    const currUrl = current.url || current.page?.url;
    const currPath = current.inputPath || current.page?.inputPath;
    const currSlug = current.fileSlug || current.page?.fileSlug;
    return arr.filter(item =>
      item.url !== currUrl &&
      item.inputPath !== currPath &&
      item.fileSlug !== currSlug
    );
  });

  // Add current year filter
  eleventyConfig.addFilter("currentYear", () => new Date().getFullYear());

  // Date formatting with Luxon
  eleventyConfig.addFilter("date", (dateObj, format = "dd LLLL yyyy", locale = "en-US") => {
    let dt;

    if (typeof dateObj === 'function') {
      dateObj = dateObj();
    }
    if (typeof dateObj === 'string') {
      dt = DateTime.fromISO(dateObj) || DateTime.fromSQL(dateObj) || DateTime.fromFormat(dateObj, 'yyyy-MM-dd');
    } else if (dateObj instanceof Date) {
      dt = DateTime.fromJSDate(dateObj);
    } else {
      dt = DateTime.fromJSDate(new Date(dateObj));
    }

    return dt.setZone("utc").setLocale(locale).toFormat(format);
  });

  // Add filter categories from collection
  eleventyConfig.addFilter("categoryListFrom", (items = []) => {
    const slugify = eleventyConfig.getFilter("slugify");
    const map = new Map(); // slug -> display name
    items.forEach((item) => {
      const c = item.data?.category ?? item.data?.categories;
      if (!c) return;
      (Array.isArray(c) ? c : [c]).forEach((cat) => {
        if (!cat) return;
        const name = String(cat).trim();
        if (!name) return;
        const slug = slugify(name);
        if (!slug) return;
        if (!map.has(slug)) map.set(slug, name);
      });
    });
    return Array.from(map, ([slug, name]) => ({ slug, name }));
  });

  // Add filter tags from collection
  eleventyConfig.addFilter("tagListFrom", (items = []) => {
    const slugify = eleventyConfig.getFilter("slugify");
    const exclude = new Set(["all", "nav", "post", "posts"]);
    const map = new Map(); // slug -> display name
  
    items.forEach((item) => {
      const t = item.data?.tags;
      if (!t) return;
      (Array.isArray(t) ? t : [t]).forEach((tag) => {
        const name = String(tag || "").trim();
        if (!name || exclude.has(name)) return;
        const slug = slugify(name);
        if (!slug) return;
        if (!map.has(slug)) map.set(slug, name);
      });
    });
  
    return Array.from(map, ([slug, name]) => ({ slug, name }));
  });
  
}
