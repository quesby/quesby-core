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

}
