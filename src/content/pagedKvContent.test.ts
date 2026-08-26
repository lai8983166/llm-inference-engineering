import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve('src/content/chapters/paged-kv.mdx'), 'utf8')

describe('chapter four prose contract', () => {
  it('keeps five cognitive turns on one continuous reading surface', () => {
    const headings = [...source.matchAll(/^<h2 id="([^"]+)">([^<]+)<\/h2>$/gm)]

    expect(headings.map((heading) => heading[1])).toEqual([
      'split-intervals',
      'piece-granularity',
      'block-table',
      'block-pool',
      'block-size-tradeoff',
    ])
    expect(source.match(/^<h3/gm)).toBeNull()
    expect(source.match(/<(?:BlockTableTranslationFigure|BlockPoolEvolutionFigure)\s*\/>/g)).toHaveLength(2)
    expect(source.indexOf('<BlockTableTranslationFigure />')).toBeGreaterThan(source.indexOf('它换来的东西在下一节兑现'))
    expect(source.indexOf('<BlockTableTranslationFigure />')).toBeLessThan(source.indexOf('id="block-pool"'))
    expect(source.indexOf('<BlockPoolEvolutionFigure />')).toBeGreaterThan(source.indexOf('其他请求的表项与块不受波及'))
    expect(source.indexOf('<BlockPoolEvolutionFigure />')).toBeLessThan(source.indexOf('id="block-size-tradeoff"'))
  })

  it('judges candidate layouts by the chapter three contracts, not framework structures', () => {
    expect(source.indexOf('四条任何替代布局必须保住的合同')).toBeLessThan(source.indexOf('id="split-intervals"'))
    expect(source.indexOf('第 03 章结尾的四条合同')).toBeGreaterThan(source.indexOf('id="split-intervals"'))
    expect(source).toContain('压缩是合法的应急动作，不是对“必须连续”这条约束的解除')
    expect(source).toContain('四条全部保住')
    expect(source).toContain('段落边界只存在于存储层')
    expect(source).toContain('映射本身：读取之前必须先回答“位置 p 在哪”')
  })

  it('derives fixed blocks after the matching failure and names paging last', () => {
    expect(source.indexOf('原地复活')).toBeLessThan(source.indexOf('**内部浪费**'))
    expect(source.indexOf('**内部浪费**')).toBeLessThan(source.indexOf('**块**'))
    expect(source.indexOf('**块**')).toBeLessThan(source.indexOf('**分页**'))
    expect(source).toContain('任何空闲段可以服务任何请求的下一次增长')
    expect(source).toContain('每个请求最多浪费一段减一个 unit')
    expect(source).toContain('24 个 unit 正好是 6 块')
    expect(source).toContain('每块 512 bytes')
  })

  it('states the block table as an explicit mapping contract with metadata in the ledger', () => {
    expect(source).toContain('**块表**')
    expect(source).toContain('先有块、再登记、后写入')
    expect(source).toContain('正确性缺陷')
    expect(source).toContain('⌈长度/B⌉')
    expect(source).toContain('6 个表项')
    expect(source).toContain('5 unit 的内部浪费')
    expect(source).toContain('元数据走到了台前')
  })

  it('walks the canonical block pool trace with reuse and zero migrations', () => {
    for (const requestId of ['R-long', 'R-short', 'R-late']) {
      expect(source.split(requestId).length - 1).toBeGreaterThan(3)
    }
    expect(source).toContain('拿到 B0、B1')
    expect(source).toContain('没有分配，没有搬迁')
    expect(source).toContain('拿到的正是刚归还的 B2')
    expect(source).toContain('整块归还 B0、B1、B2')
    expect(source).toContain('5 个 token 拿 B3、B4')
    expect(source).toContain('在途读取未结束的块不回收')
  })

  it('replays the chapter three fragmentation scenario with a third outcome and honest costs', () => {
    expect(source).toContain('`⌈11/4⌉ = 3` 块，直接准入')
    expect(source).toContain('搬迁事件为零')
    expect(source).toContain('2、1、2 unit，共 5 unit')
    expect(source).toContain('**连续性约束**')
    expect(source).toContain('浪费从“不可预测的孔洞”变成了“可预算的余位”')
    expect(source).toContain('声明多长不再预扣空间')
  })

  it('sweeps block sizes without recommending one and keeps real costs measurable', () => {
    expect(source).toContain('| 1 | 19 | 0 unit |')
    expect(source).toContain('| 2 | 10 | 1 unit |')
    expect(source).toContain('| 4 | 6 | 5 unit |')
    expect(source).toContain('| 8 | 4 | 13 unit |')
    expect(source).toContain('| 24 | 3 | 53 unit |')
    expect(source).toContain('块大小拧到头，布局退回原点')
    expect(source).toContain('没有哪一行是“正确答案”')
    expect(source).toContain('必须在指定软硬件上测量')
    expect(source).toContain('版本锁定的实现示例，不是本章推导的终点')
  })

  it('places practice and transfer assessment after the complete prose', () => {
    expect(source.match(/<(?:BlockEventPractice|BlockLayoutAssessment)\s*\/>/g)).toHaveLength(2)
    expect(source.indexOf('<BlockEventPractice />')).toBeGreaterThan(source.indexOf('id="block-size-tradeoff"'))
    expect(source.indexOf('<BlockLayoutAssessment />')).toBeGreaterThan(source.indexOf('<BlockEventPractice />'))
    expect(source.indexOf('<BlockEventPractice />')).toBeGreaterThan(source.indexOf('教学计数不是选型依据'))
  })

  it('closes on the unsolved admission and sharing questions with evidence boundaries', () => {
    expect(source).toContain('最后一个空闲块给新请求还是给正在增长的请求')
    expect(source).toContain('共享同一段前缀 K/V 时块的所有权归谁')
    expect(source).toContain('任何后续机制都必须保住这四条')
    expect(source).toContain('整数教学单位')
    expect(source).toContain('教学计数不是选型依据')
    for (const forbidden of ['毫秒', 'GB/s', '利用率', 'TLB', '缺页']) {
      expect(source.split(forbidden)).toHaveLength(1)
    }
  })
})
