export default function taxonomyPlugin(eleventyConfig, {
    excludeTags = ["all", "nav", "post", "posts"],
    tagField = "tags",
    categoryFields = ["category", "categories"]
  } = {}) {
    eleventyConfig.addCollection("tagList", (api) => {
      const set = new Set();
      api.getAll().forEach((item) => {
        const t = item.data[tagField];
        if (!t) return;
        (Array.isArray(t) ? t : [t]).forEach((tag) => {
          if (tag && !excludeTags.includes(tag)) set.add(tag);
        });
      });
      return [...set].sort((a,b)=>a.localeCompare(b));
    });
  
    eleventyConfig.addCollection("categoryList", (api) => {
      const set = new Set();
      api.getAll().forEach((item) => {
        const c = categoryFields.map(f => item.data[f]).find(Boolean);
        if (!c) return;
        (Array.isArray(c) ? c : [c]).forEach((cat) => { if (cat) set.add(cat); });
      });
      return [...set].sort((a,b)=>a.localeCompare(b));
    });
  
    eleventyConfig.addShortcode("allTags", (collections, sep=", ") =>
      (collections.tagList || []).join(sep)
    );
    eleventyConfig.addShortcode("allCategories", (collections, sep=", ") =>
      (collections.categoryList || []).join(sep)
    );
  }