import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve('src/content/chapters/naive-concurrency.mdx'), 'utf8')

describe('chapter two prose contract', () => {
  it('keeps five cognitive turns on one continuous reading surface', () => {
    const headings = [...source.matchAll(/^<h2 id="([^"]+)">([^<]+)<\/h2>$/gm)]

    expect(headings.map((heading) => heading[1])).toEqual([
      'multiple-requests',
      'independent-loops',
      'static-batch',
      'batch-diverges',
      'next-choice',
    ])
    expect(source.match(/<(?:RequestDeviceTraceFigure|StaticBatchOccupancyFigure)\s*\/>/g)).toHaveLength(2)
    expect(source.indexOf('<RequestDeviceTraceFigure />')).toBeGreaterThan(source.indexOf('主机控制流能否交错'))
    expect(source.indexOf('<StaticBatchOccupancyFigure />')).toBeGreaterThan(source.indexOf('**封闭批次**'))
  })

  it('uses the same request fixtures through all three naive strategies', () => {
    for (const requestId of ['R-long', 'R-short', 'R-late']) {
      expect(source.split(requestId).length - 1).toBeGreaterThan(4)
    }
    expect(source).toContain('串行队列')
    expect(source).toContain('每个请求创建一个线程或协程')
    expect(source).toContain('静态 batch')
  })

  it('introduces names after the concrete contradiction that creates them', () => {
    expect(source.indexOf('从 step 1 等到 step 4')).toBeLessThan(source.indexOf('队头阻塞'))
    expect(source.indexOf('2 个有效位置 + 4 个 padding')).toBeLessThan(source.indexOf('**padding**'))
    expect(source.indexOf('在此时到达并等待')).toBeLessThan(source.indexOf('**封闭批次**'))
  })

  it('separates host concurrency, device execution, batching, and measured performance', () => {
    expect(source).toContain('主机控制流能否交错')
    expect(source).toContain('设备工作是否重叠')
    expect(source).toContain('多个请求是否进入同一次模型执行')
    expect(source).toContain('不对应一毫秒')
    expect(source).toContain('仍不能证明真实 GPU 性能')
  })

  it('stops at the scheduling problem and leads to KV without teaching the later solution', () => {
    expect(source.split('continuous batching')).toHaveLength(1)
    expect(source.split('分页')).toHaveLength(1)
    expect(source).toContain('每个请求不断增长的 KV 到底占多少空间')
    expect(source).toContain('第 02 章需要留下的不是一个现成调度器')
  })
})
