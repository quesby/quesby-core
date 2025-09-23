import { execSync } from 'child_process'
import fs from 'fs'

const siteData = JSON.parse(fs.readFileSync('./src/_data/site.json', 'utf-8'))
const theme = siteData.theme || 'default'
const command = `sass --watch src/sass:src/assets/css src/themes/${theme}:src/assets/css --style=compressed`

execSync(command, { stdio: 'inherit' })
