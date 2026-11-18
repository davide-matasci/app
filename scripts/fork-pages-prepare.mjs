// Personal-fork helper: adapts a built web app (packages/web/dist) for hosting
// on GitHub Pages, where the site usually lives under a sub-path such as
// /app/ instead of at the domain root.
//
// Usage: BASE_PATH=/app APP_NAME="Notes Fork" node scripts/fork-pages-prepare.mjs <dist dir>

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const dist = process.argv[2]
if (!dist || !existsSync(join(dist, 'index.html'))) {
  console.error('Usage: node scripts/fork-pages-prepare.mjs <dist dir containing index.html>')
  process.exit(1)
}

const basePath = (process.env.BASE_PATH || '').replace(/\/+$/, '')
const baseHref = `${basePath}/`
const appName = process.env.APP_NAME || 'Notes Fork'
const escapeHtml = (value) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const replaceOnce = (content, pattern, replacement, label) => {
  if (!pattern.test(content)) {
    console.error(`Could not find ${label} in the built files; upstream may have changed it.`)
    process.exit(1)
  }
  return content.replace(pattern, replacement)
}

// index.html: base path, name, and no canonical link to the official app.
const indexPath = join(dist, 'index.html')
let html = readFileSync(indexPath, 'utf8')
html = replaceOnce(html, /<base href="[^"]*">/, `<base href="${baseHref}">`, '<base href>')
html = replaceOnce(html, /<title>[^<]*<\/title>/, `<title>${escapeHtml(appName)}</title>`, '<title>')
html = html.replace(/\s*<link rel="canonical"[^>]*>/, '')
html = html.replace(
  /(<meta content=")[^"]*(" name="(?:apple-mobile-web-app-title|application-name)"\/?>)/g,
  `$1${escapeHtml(appName)}$2`,
)
writeFileSync(indexPath, html)

// Web manifest: name and start URL for "Add to Home Screen".
const manifestPath = join(dist, 'manifest.webmanifest')
if (existsSync(manifestPath)) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  manifest.name = appName
  manifest.short_name = appName
  manifest.start_url = baseHref
  manifest.scope = baseHref
  delete manifest.app
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
}

// GitHub Pages runs Jekyll by default, which drops some files; disable it.
writeFileSync(join(dist, '.nojekyll'), '')

console.log(`Prepared ${dist} for base path "${baseHref}" as "${appName}".`)
