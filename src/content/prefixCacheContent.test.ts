import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve('src/content/chapters/prefix-cache.mdx'), 'utf8')

describe('chapter ten prose contract', () => {
  it('keeps five cognitive turns on one continuous reading surface', () => {
    const headings = [...source.matchAll(/^<h2 id="([^"]+)">([^<]+)<\/h2>$/gm)]

    expect(headings.map((heading) => heading[1])).toEqual([
      'shared-prefix',
      'hit-and-ledger',
      'shared-ownership',
      'eviction-budget',
      'combination-contract',
    ])
    expect(source.match(/^<h3/gm)).toBeNull()
    expect(source.match(/<(?:SharedLifecycleFigure|HitAdmissionFigure)\s*\/>/g)).toHaveLength(2)
    expect(source.indexOf('<SharedLifecycleFigure />')).toBeGreaterThan(source.indexOf('工程答案'))
    expect(source.indexOf('<SharedLifecycleFigure />')).toBeLessThan(source.indexOf('id="eviction-budget"'))
    expect(source.indexOf('<HitAdmissionFigure />')).toBeGreaterThan(source.indexOf('只把问题钉在清单上'))
    expect(source.indexOf('<HitAdmissionFigure />')).toBeLessThan(source.indexOf('id="combination-contract"'))
  })

  it('derives the cache from the recompute counterexample with block alignment', () => {
    expect(source.indexOf('完整计算两遍')).toBeLessThan(source.indexOf('缓存的想法'))
    expect(source).toContain('⌊共享前缀长 / 块大小⌋')
    expect(source).toContain('第 5 个 token 是毛边')
    expect(source).toContain('只缓存整块')
    expect(source).toContain('决定**能共享多少**')
    for (const requestId of ['S-a', 'S-b', 'S-c', 'S-d']) {
      expect(source.split(requestId).length - 1).toBeGreaterThan(2)
    }
  })

  it('walks the hit ledger and keeps hit rate as evidence not gain', () => {
    expect(source).toContain('**命中**——共享块直接挂进它的块表')
    expect(source).toContain('首执行从 t3 提前到 t2')
    expect(source).toContain('命中率 1/2')
    expect(source).toContain('`S-c`/`S-d` 无前缀可查，不计入分母')
    expect(source).toContain('命中率是证据不是收益')
    expect(source).toContain('只省 prefill 侧的重复计算，不减少 decode')
  })

  it('rewrites ownership with refcount and renames copy-on-write without modeling it', () => {
    expect(source).toContain('**引用计数**')
    expect(source).toContain('私有块**归还**，共享块只**递减**')
    expect(source).toContain('rc 2→1，**不归还**')
    expect(source).toContain('块**转为缓存**')
    expect(source).toContain('取消同理')
    expect(source).toContain('零**独占**块')
    expect(source).toContain('**写时复制**')
    expect(source).toContain('不建模它的轨迹')
  })

  it('presents the eviction tug-of-war without judging the dial', () => {
    expect(source).toContain('`S-d` 到达：prompt 17 个 token，需要 5 块')
    expect(source).toContain('空闲只有 4')
    expect(source).toContain('**rc>0 的块永不逐出**')
    expect(source).toContain('最早转缓存的先走')
    expect(source).toContain('统计不出来')
    expect(source).toContain('下一次本可命中')
    expect(source).toContain('又一个把成本寄给谁的决定')
    expect(source).toContain('本章不评判')
  })

  it('closes on the combination contract checklist', () => {
    expect(source).toContain('**所有权**')
    expect(source).toContain('**失效与逐出**')
    expect(source).toContain('**调度交互**')
    expect(source).toContain('**证据**')
    expect(source).toContain('机制叠加放大的是复杂度，不只是功能')
    expect(source).toContain('用了开关，也要知道签掉的是什么')
    expect(source).toContain('下一章就带着这份问卷走进真实框架')
  })

  it('keeps every number inside the simulated evidence boundary', () => {
    expect(source).toContain('教学数字不换算成任何真实节省')
    expect(source).toContain('命中率 1/2 是构造值')
    for (const forbidden of ['GB/s', '利用率', '毫秒', '加速']) {
      expect(source.split(forbidden)).toHaveLength(1)
    }
  })
})
