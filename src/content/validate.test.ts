import { validateContent } from './validate'

const options = { knownRoutes: ['/', '/chapters/single-request'] }

describe('content structure validation', () => {
  it('finds skipped heading levels, duplicate anchors, missing alt text, and unknown routes', () => {
    const issues = validateContent(`# 标题 {#same}\n### 跳级\n## 重复 {#same}\n![](/image.png)\n[坏链接](/missing)`, options)
    expect(issues.map((issue) => issue.message)).toEqual([
      '标题层级从 h1 跳到 h3',
      '重复锚点：same',
      '图片缺少文字替代',
      '未知内部路径：/missing',
    ])
  })

  it('does not use heading count or prose length as a quality proxy', () => {
    const concise = validateContent('## 一个标题 {#one}\n\n短段落。', options)
    const manyHeadings = validateContent('## 一 {#one}\n\n文本。\n\n## 二 {#two}\n\n文本。\n\n## 三 {#three}\n\n文本。', options)
    expect(concise).toEqual([])
    expect(manyHeadings).toEqual([])
  })

  it('recognizes explicit anchors on MDX JSX headings', () => {
    const source = '<h2 id="execution-loop">执行循环</h2>\n\n正文。\n\n<h2 id="execution-loop">再次出现</h2>'

    expect(validateContent(source, options)).toEqual([
      { line: 5, message: '重复锚点：execution-loop' },
    ])
  })
})
