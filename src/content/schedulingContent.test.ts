import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve('src/content/chapters/scheduling.mdx'), 'utf8')

describe('chapter five prose contract', () => {
  it('keeps five cognitive turns on one continuous reading surface', () => {
    const headings = [...source.matchAll(/^<h2 id="([^"]+)">([^<]+)<\/h2>$/gm)]

    expect(headings.map((heading) => heading[1])).toEqual([
      'tick-decision',
      'runnable-set',
      'open-membership',
      'prefill-decode-contention',
      'policy-contracts',
    ])
    expect(source.match(/^<h3/gm)).toBeNull()
    expect(source.match(/<(?:RunnableSetFigure|PolicyTimelineFigure)\s*\/>/g)).toHaveLength(2)
    expect(source.indexOf('<RunnableSetFigure />')).toBeGreaterThan(source.indexOf('不是它的出处'))
    expect(source.indexOf('<RunnableSetFigure />')).toBeLessThan(source.indexOf('id="prefill-decode-contention"'))
    expect(source.indexOf('<PolicyTimelineFigure />')).toBeGreaterThan(source.indexOf('要靠测量说话'))
    expect(source.indexOf('<PolicyTimelineFigure />')).toBeLessThan(source.indexOf('id="policy-contracts"'))
  })

  it('formalizes the tick before any mechanism name', () => {
    expect(source.indexOf('一拍（tick）')).toBeLessThan(source.indexOf('连续批处理'))
    expect(source).toContain('调度器每拍都回答“和上拍一样”')
    expect(source).toContain('两问')
    expect(source).toContain('不能靠印象')
    expect(source).toContain('不是速度')
  })

  it('defines the runnable set by contract before discussing policy', () => {
    expect(source.indexOf('六项输入全部满足')).toBeLessThan(source.indexOf('prefill 优先'))
    expect(source.indexOf('未到达、待 prefill、等待块、已完成')).toBeLessThan(source.indexOf('prefill 优先'))
    expect(source).toContain('每拍重算')
    expect(source).toContain('把容量问题误诊成调度问题')
  })

  it('derives open membership and names continuous batching after the walk-through', () => {
    for (const requestId of ['R-long', 'R-short', 'R-late']) {
      expect(source.split(requestId).length - 1).toBeGreaterThan(4)
    }
    expect(source).toContain('| 3 | `R-late` 到达，准入 2 块 | prefill `R-late`，产出 y1；`R-long` 让位一拍 | — |')
    expect(source).toContain('decode 组 {`R-long`, `R-late`}，各产出 1 token')
    expect(source.indexOf('成员资格每拍重算')).toBeLessThan(source.indexOf('**连续批处理**'))
    expect(source).toContain('不是它的出处')
    expect(source).toContain('不需要 padding')
  })

  it('presents both policy timelines as waiting migration, not as speed claims', () => {
    expect(source).toContain('| `R-long` 首执行 / 完成 | t1 / t4 | t0 / t5 | t0 / t3 |')
    expect(source).toContain('| `R-short` 首执行 / 完成 | t1 / t1 | t1 / t1 | t4 / t4 |')
    expect(source).toContain('| `R-late` 首执行 / 完成 | t5 / t6 | t3 / t4 | t5 / t6 |')
    expect(source).toContain('不能换算成“快 17%”')
    expect(source).toContain('等待不会消失，只在晚到者与在跑者之间迁移')
    expect(source).toContain('要靠测量说话')
  })

  it('places practice and transfer assessment after the complete prose', () => {
    expect(source.match(/<(?:TickLedgerPractice|SchedulingTransferAssessment)\s*\/>/g)).toHaveLength(2)
    expect(source.indexOf('<TickLedgerPractice />')).toBeGreaterThan(source.indexOf('id="policy-contracts"'))
    expect(source.indexOf('<SchedulingTransferAssessment />')).toBeGreaterThan(source.indexOf('<TickLedgerPractice />'))
    expect(source.indexOf('<TickLedgerPractice />')).toBeGreaterThan(source.indexOf('只对本章的规则负责'))
  })

  it('closes on the scheduling contract list and defers pressure and fairness', () => {
    expect(source).toContain('拍节奏：决定点在哪里')
    expect(source).toContain('可运行定义：六项输入')
    expect(source).toContain('选择规则：候选如何排序或分组')
    expect(source).toContain('准入上限：池还剩多少块时放新请求进来')
    expect(source).toContain('下一章的入口')
    expect(source).toContain('锁定版本')
  })

  it('keeps tick counts inside the evidence boundary', () => {
    expect(source).toContain('不能证明任何真实系统的延迟、吞吐或公平性')
    expect(source).toContain('拍不是时间')
    expect(source).toContain('不等于一毫秒')
    for (const forbidden of ['GB/s', '利用率', 'TTFT', 'ITL']) {
      expect(source.split(forbidden)).toHaveLength(1)
    }
  })
})
