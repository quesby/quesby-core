// ESM entrypoint for the core
import { createEleventyConfig } from './src/eleventy/config.js';

export default function(eleventyConfig) {
  // Import complete configuration
  const config = createEleventyConfig();
  return config(eleventyConfig);
}

export { createEleventyConfig } from './src/eleventy/config.js';
  