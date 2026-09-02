import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { validateContent } from '../src/content/validate'

const files = [
  'src/content/chapters/trustworthy-baseline.mdx',
  'src/content/chapters/single-request.mdx',
  'src/content/chapters/naive-concurrency.mdx',
  'src/content/chapters/kv-state.mdx',
  'src/content/chapters/paged-kv.mdx',
  'src/content/chapters/scheduling.mdx',
  'src/content/chapters/overload.mdx',
  'src/content/chapters/termination.mdx',
  'src/content/chapters/metrics.mdx',
  'src/content/chapters/optimization.mdx',
]
const knownRoutes = ['/', '/chapters/trustworthy-baseline', '/chapters/single-request', '/chapters/naive-concurrency', '/chapters/kv-state', '/chapters/paged-kv', '/chapters/scheduling', '/chapters/overload', '/chapters/termination', '/chapters/metrics', '/chapters/optimization']
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
