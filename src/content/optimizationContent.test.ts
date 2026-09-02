import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve('src/content/chapters/optimization.mdx'), 'utf8')

describe('chapter nine prose contract', () => {
  it('keeps five cognitive turns on one continuous reading surface', () => {
    const headings = [...source.matchAll(/^<h2 id="([^"]+)">([^<]+)<\/h2>$/gm)]

    expect(headings.map((heading) => heading[1])).toEqual([
      'local-vs-system',
      'bottleneck-signatures',
      'budget-ceiling',
      'noise-controls',
      'attribution-chain',
    ])
    expect(source.match(/^<h3/gm)).toBeNull()
    expect(source.match(/<(?:BudgetGainFigure|NoiseControlFigure)\s*\/>/g)).toHaveLength(2)
    expect(source.indexOf('<BudgetGainFigure />')).toBeGreaterThan(source.indexOf('X 占多少？'))
    expect(source.indexOf('<BudgetGainFigure />')).toBeLessThan(source.indexOf('id="bottleneck-signatures"'))
    expect(source.indexOf('<NoiseControlFigure />')).toBeGreaterThan(source.indexOf('范围分离，继续核对'))
    expect(source.indexOf('<NoiseControlFigure />')).toBeLessThan(source.indexOf('id="attribution-chain"'))
  })

  it('opens with the arithmetic illusion before any tool name', () => {
    expect(source.indexOf('**预算表**')).toBeLessThan(source.indexOf('指纹'))
    expect(source).toContain('| 基线 | 2 | 8 | 2 | 6 | 2 | **20** |')
    expect(source).toContain('端到端快了 5%')
    expect(source).toContain('两个说法同时为真')
    expect(source).toContain('局部收益按占比稀释')
    expect(source).toContain('X 占多少？')
    expect(source).toContain('端到端快 1.43 倍')
  })

  it('presents five signatures before optimizations and registers observer effects', () => {
    expect(source).toContain('**CPU 提交**受限')
    expect(source).toContain('**launch 间隙**受限')
    expect(source).toContain('**同步**受限')
    expect(source).toContain('**访存带宽**受限')
    expect(source).toContain('**计算**受限')
    expect(source).toContain('指纹先于处方')
    expect(source).toContain('**观测者效应必须登记**')
    expect(source).toContain('工具选择是实验设计的一部分')
    expect(source).toContain('预算表必须现场测量')
  })

  it('derives the ceiling table by hand and bounds every gain', () => {
    expect(source).toContain('| 计算 | 10% | 1.11 | kernel ×0.5 → **1.05** |')
    expect(source).toContain('| 访存 | 30% | 1.43 | 量化 ×0.5 → **1.18** |')
    expect(source).toContain('| launch 间隙 | 40% | 1.67 | ×0.25 → **1.43** |')
    expect(source).toContain('| 同步 | 10% | 1.11 | 归零 → **1.11** |')
    expect(source).toContain('1/(1−f)')
    expect(source).toContain('一九六七年 Amdahl')
    expect(source).toContain('**上限是硬顶**')
    expect(source).toContain('**先查上限，再动手**')
    expect(source).toContain('偏乐观，不偏保守')
  })

  it('judges noise by range overlap with same-condition caveats', () => {
    expect(source).toContain('| 优化前 | 18, 19, 20, 21, 22 | 20 | [18, 22] |')
    expect(source).toContain('| 优化后（声称有效） | 19, 20, 20, 20, 21 | 20 | [19, 21] |')
    expect(source).toContain('13, 14, 14, 15, 15')
    expect(source).toContain('**不支持**任何收益声称')
    expect(source).toContain('一次只改一处')
    expect(source).toContain('范围重叠，不许声称；范围分离，继续核对')
    expect(source).toContain('不是生成数据，也不代表真实噪声')
  })

  it('closes the mainline on the attribution chain', () => {
    expect(source).toContain('**指标异常 → 层 → 预算指纹 → 假设 → 最小实验 → 确认或推翻**')
    expect(source).toContain('可反驳的假设')
    expect(source).toContain('与上限相符')
    expect(source).toContain('第 11 章起进入真实框架')
    expect(source).toContain('缺一样，就还只是故事')
  })

  it('places practice and transfer assessment after the complete prose', () => {
    expect(source.match(/<(?:OptimizationReportPractice|OptimizationTransferAssessment)\s*\/>/g)).toHaveLength(2)
    expect(source.indexOf('<OptimizationReportPractice />')).toBeGreaterThan(source.indexOf('缺一样，就还只是故事'))
    expect(source.indexOf('<OptimizationTransferAssessment />')).toBeGreaterThan(source.indexOf('<OptimizationReportPractice />'))
  })

  it('keeps every number inside the budget evidence boundary', () => {
    expect(source).toContain('整数教学单位，不是时间')
    expect(source).toContain('占比因模型、形状与硬件而异')
    expect(source).toContain('不涉及任何真实数值')
    for (const forbidden of ['GB/s', '利用率', '毫秒', 'FLOPS', 'ms']) {
      expect(source.split(forbidden)).toHaveLength(1)
    }
  })
})
