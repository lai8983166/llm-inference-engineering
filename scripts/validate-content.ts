import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { validateContent } from '../src/content/validate'

const files = ['src/content/chapters/single-request.mdx']
const knownRoutes = ['/', '/chapters/single-request']
let failed = false

for (const file of files) {
  const source = readFileSync(resolve(file), 'utf8')
  const issues = validateContent(source, { knownRoutes })
  for (const issue of issues) {
    failed = true
    console.error(`${file}:${issue.line} ${issue.message}`)
  }
}

if (failed) process.exitCode = 1
else console.log(`Content valid: ${files.length} prose-first chapter checked.`)
