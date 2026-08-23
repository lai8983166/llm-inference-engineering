export interface ContentIssue {
  line: number
  message: string
}

export interface ContentValidationOptions {
  knownRoutes: string[]
}

const slugify = (value: string) => value
  .toLowerCase()
  .replace(/\{#[^}]+\}\s*$/, '')
  .replace(/[`*_]/g, '')
  .trim()
  .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
  .replace(/\s+/g, '-')

export function validateContent(source: string, options: ContentValidationOptions): ContentIssue[] {
  const issues: ContentIssue[] = []
  const anchors = new Set<string>()
  let previousHeadingLevel = 0
  let fenced = false

  source.split(/\r?\n/).forEach((line, index) => {
    const lineNumber = index + 1
    if (/^```/.test(line.trim())) { fenced = !fenced; return }
    if (fenced) return

    const markdownHeading = /^(#{1,6})\s+(.+)$/.exec(line)
    const jsxHeading = /^<h([1-6])(?:\s+id=["']([^"']+)["'])?>(.+)<\/h\1>$/.exec(line.trim())
    const heading = markdownHeading
      ? { level: markdownHeading[1].length, text: markdownHeading[2], explicit: /\{#([^}]+)\}\s*$/.exec(markdownHeading[2])?.[1] }
      : jsxHeading
        ? { level: Number(jsxHeading[1]), text: jsxHeading[3], explicit: jsxHeading[2] }
        : undefined
    if (heading) {
      const level = heading.level
      if (previousHeadingLevel > 0 && level > previousHeadingLevel + 1) issues.push({ line: lineNumber, message: `标题层级从 h${previousHeadingLevel} 跳到 h${level}` })
      previousHeadingLevel = level
      const anchor = heading.explicit ?? slugify(heading.text)
      if (!anchor) issues.push({ line: lineNumber, message: '标题无法生成有效锚点' })
      else if (anchors.has(anchor)) issues.push({ line: lineNumber, message: `重复锚点：${anchor}` })
      else anchors.add(anchor)
    }

    for (const image of line.matchAll(/!\[([^\]]*)\]\([^)]+\)/g)) {
      if (!image[1].trim()) issues.push({ line: lineNumber, message: '图片缺少文字替代' })
    }

    for (const link of line.matchAll(/(?<!!)\[[^\]]+\]\((\/[^)#\s]*)(?:#[^)]+)?\)/g)) {
      if (!options.knownRoutes.includes(link[1])) issues.push({ line: lineNumber, message: `未知内部路径：${link[1]}` })
    }
  })

  return issues
}
