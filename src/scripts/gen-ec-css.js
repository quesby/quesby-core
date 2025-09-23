import { ExpressiveCodeEngine } from '@expressive-code/core';
import { pluginShiki } from '@expressive-code/plugin-shiki';
import { fileURLToPath } from 'url';
import fs from 'fs';
import path from 'path';

const engine = new ExpressiveCodeEngine({
  plugins: [
    pluginShiki({
      themes: ['github-light', 'github-dark']
    })
  ]
});

const styles = await engine.getBaseStyles();
const themeStyles = await engine.getThemeStyles();

const fullStyles = styles + '\n' + themeStyles;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.resolve(__dirname, '../src/assets/css/expressive-code.css');

fs.writeFileSync(outPath, fullStyles, 'utf8');
console.log('✅ expressive-code.css generated with themes.');
