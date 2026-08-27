import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve('src/content/chapters/overload.mdx'), 'utf8')

describe('chapter six prose contract', () => {
  it('keeps five cognitive turns on one continuous reading surface', () => {
    const headings = [...source.matchAll(/^<h2 id="([^"]+)">([^<]+)<\/h2>$/gm)]

    expect(headings.map((heading) => heading[1])).toEqual([
      'burst-arrives',
      'cost-bearer',
      'preempt-recompute',
      'priority-dial',
      'no-free-lunch',
    ])
    expect(source.match(/^<h3/gm)).toBeNull()
    expect(source.match(/<(?:OverloadPoolFigure|CostBillsFigure)\s*\/>/g)).toHaveLength(2)
    expect(source.indexOf('<OverloadPoolFigure />')).toBeGreaterThan(source.indexOf('代价全部记在等待者的账上'))
    expect(source.indexOf('<OverloadPoolFigure />')).toBeLessThan(source.indexOf('id="cost-bearer"'))
    expect(source.indexOf('<CostBillsFigure />')).toBeGreaterThan(source.indexOf('第 07 章“正常路径之外的服务语义”的入口'))
  })

  it('lets the burst empty the pool before any policy name', () => {
    expect(source.indexOf('空闲归零')).toBeLessThan(source.indexOf('**无界排队**'))
    expect(source).toContain('候选缺容量')
    expect(source).toContain('等待成了常态')
    expect(source).toContain('把过载的代价无限期地摊给等待者')
    expect(source.indexOf('成本交给**等待者**')).toBeGreaterThan(source.indexOf('无界排队'))
  })

  it('frames admission as cost assignment before policy mechanisms', () => {
    expect(source.indexOf('它们能做的只是分配')).toBeLessThan(source.indexOf('**水位**'))
    expect(source).toContain('快速失败**本身就是一种服务承诺')
    expect(source).toContain('| t1 | `P-c`（需 2 块） | 0 | 准入 | **拒绝** |')
    expect(source).toContain('| t2 | `P-d`（需 1 块） | — | 拒绝（池满） | **准入** |')
    expect(source).toContain('它保护的是已准入请求的增长空间')
    for (const requestId of ['P-a', 'P-b', 'P-c', 'P-d']) {
      expect(source.split(requestId).length - 1).toBeGreaterThan(4)
    }
  })

  it('returns to the chapter three recompute path as recovery', () => {
    expect(source).toContain('**重新 prefill 6 个 token**')
    expect(source).toContain('无缓存重算')
    expect(source).toContain('缓存换来的节省，在抢占时刻如数退还')
    expect(source).toContain('最近开始生成者')
    expect(source).toContain('登记为教学假设')
    expect(source).toContain('默认重计算')
    expect(source.indexOf('swap')).toBeGreaterThan(0)
  })

  it('presents priority as a directed dial without recommendations', () => {
    expect(source).toContain('**优先级**是第二个旋钮')
    expect(source).toContain('**饥饿**不是事故，是定向选择的阴影面')
    expect(source).toContain('本章不给任何排序写推荐')
    expect(source).toContain('按优先级选抢占受害者')
  })

  it('closes on four bills and the abandoned-waiter gap', () => {
    expect(source).toContain('| 无界排队 | 7 | 0 | 0 | 0 | 1 | t5 |')
    expect(source).toContain('| 按满拒绝 | 5 | 1（`P-d`） | 0 | 0 | 0 | 被拒 |')
    expect(source).toContain('| 水位 W=1 | 5 | 1（`P-c`） | 0 | 0 | 0 | t2 准入 |')
    expect(source).toContain('| 抢占重计算 | 7 | 0 | 1（`P-b`） | 6 unit | 1 | t3 |')
    expect(source).toContain('没有一行全优')
    expect(source).toContain('写进代码的服务级别表态')
    expect(source).toContain('无效希望')
    expect(source).toContain('第 07 章')
  })

  it('keeps counts inside the evidence boundary', () => {
    expect(source).toContain('不能换算成真实延迟或吞吐')
    expect(source).toContain('都要测量')
    for (const forbidden of ['GB/s', '利用率', 'TTFT', 'ITL', '毫秒']) {
      expect(source.split(forbidden)).toHaveLength(1)
    }
  })
})
