import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve('src/content/chapters/kv-state.mdx'), 'utf8')

describe('chapter three prose contract', () => {
  it('keeps five cognitive turns on one continuous reading surface', () => {
    const headings = [...source.matchAll(/^<h2 id="([^"]+)">([^<]+)<\/h2>$/gm)]

    expect(headings.map((heading) => heading[1])).toEqual([
      'recompute-or-reuse',
      'kv-byte-ledger',
      'max-reservation',
      'contiguous-growth',
      'fragmentation-wall',
    ])
    expect(source.match(/^<h3/gm)).toBeNull()
    expect(source.match(/<(?:AttentionHistoryFigure|PoolIntervalFigure)\s*\/>/g)).toHaveLength(2)
    expect(source.indexOf('<AttentionHistoryFigure />')).toBeGreaterThan(source.indexOf('在固定软硬件上测'))
    expect(source.indexOf('<AttentionHistoryFigure />')).toBeLessThan(source.indexOf('id="kv-byte-ledger"'))
    expect(source.indexOf('<PoolIntervalFigure />')).toBeGreaterThan(source.indexOf('而是“搬去哪”'))
    expect(source.indexOf('<PoolIntervalFigure />')).toBeLessThan(source.indexOf('id="fragmentation-wall"'))
  })

  it('derives the cache from recompute before naming it', () => {
    expect(source.indexOf('用完即抛')).toBeLessThan(source.indexOf('**KV cache**'))
    expect(source.indexOf('当前 query 是本步的输入')).toBeLessThan(source.indexOf('**KV cache**'))
    expect(source).toContain('复用有一个比“省计算”更重要的前提')
    expect(source).toContain('不构成动它的理由')
  })

  it('builds the byte ledger from raw dimensions with the GQA counterexample', () => {
    expect(source).toContain('2 KV heads × 4 dim × 2 bytes = 128 bytes')
    expect(source).toContain('8 个 query heads 不进入这条公式')
    for (const requestId of ['R-long', 'R-short', 'R-late']) {
      expect(source.split(requestId).length - 1).toBeGreaterThan(4)
    }
    expect(source).toContain('10 units | 1280 bytes')
    expect(source).toContain('3 units | 384 bytes')
    expect(source).toContain('6 units | 768 bytes')
    expect(source).toContain('24 token unit')
    expect(source).toContain('包括最后生成的输出 token')
  })

  it('presents max-reservation virtues before the admission failure ledger', () => {
    expect(source.indexOf('地址稳定')).toBeLessThan(source.indexOf('`R-short` 被拒绝'))
    expect(source).toContain('`R-long` 有效 KV | 7 | 896')
    expect(source).toContain('`R-long` 保留未用 | 9 | 1152')
    expect(source).toContain('空闲 | 8 | 1024')
    expect(source).toContain('不是显存被有效状态填满')
    expect(source).toContain('`R-late` 的经历说明这不是“预留必然失败”')
  })

  it('walks the migration chain in order with the authority contract', () => {
    expect(source.indexOf('原地扩展的前提')).toBeLessThan(source.indexOf('**另址申请。**'))
    expect(source.indexOf('**另址申请。**')).toBeLessThan(source.indexOf('**复制。**'))
    expect(source.indexOf('**复制。**')).toBeLessThan(source.indexOf('**地址发布。**'))
    expect(source.indexOf('**地址发布。**')).toBeLessThan(source.indexOf('**等待在途读取。**'))
    expect(source.indexOf('**等待在途读取。**')).toBeLessThan(source.indexOf('**释放旧区间。**'))
    expect(source).toContain('旧地址仍是权威状态')
    expect(source).toContain('不能回收正被读取的旧区间')
    expect(source).toContain('几乎是它有效 KV 的两倍')
  })

  it('names external fragmentation after the hole phenomenon and classifies four failures', () => {
    expect(source.indexOf('尽管空闲总量绰绰有余')).toBeLessThan(source.indexOf('**外部碎片**'))
    expect(source).toContain('没有一段连续区间能满足申请')
    for (const category of ['有效容量耗尽', '过度预留', '搬迁峰值', '外部碎片']) {
      expect(source.indexOf(category)).toBeGreaterThan(source.indexOf('id="fragmentation-wall"'))
    }
    expect(source).toContain('空闲总量够，最大连续不够')
    expect(source).toContain('空闲合计 16 个 unit，最大的一段连续空闲只有 10')
  })

  it('closes on the layout question and leaves paging to the next chapter', () => {
    expect(source).toContain('物理存储是否必须是单一连续区间')
    expect(source).toContain('任何替代布局必须原样保住这四条')
    for (const forbidden of ['分页', 'paged attention', 'block table', 'block', 'page']) {
      expect(source.split(forbidden)).toHaveLength(1)
    }
  })

  it('keeps simulated evidence boundaries instead of performance claims', () => {
    expect(source).toContain('整数教学单位')
    expect(source).toContain('不能证明真实 GPU')
    expect(source).toContain('不把“省”换算成任何时间或吞吐数字')
    expect(source).toContain('必须在指定软硬件上测量')
    for (const forbidden of ['毫秒', 'GB/s', '利用率']) {
      expect(source.split(forbidden)).toHaveLength(1)
    }
  })
})
