import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve('src/content/chapters/termination.mdx'), 'utf8')

describe('chapter seven prose contract', () => {
  it('keeps five cognitive turns on one continuous reading surface', () => {
    const headings = [...source.matchAll(/^<h2 id="([^"]+)">([^<]+)<\/h2>$/gm)]

    expect(headings.map((heading) => heading[1])).toEqual([
      'cancel-any-state',
      'terminal-unification',
      'timeout-disconnect',
      'failure-isolation',
      'no-leak-contract',
    ])
    expect(source.match(/^<h3/gm)).toBeNull()
    expect(source.match(/<(?:TerminalCoverageFigure|CapacityRecycleFigure)\s*\/>/g)).toHaveLength(2)
    expect(source.indexOf('<TerminalCoverageFigure />')).toBeGreaterThan(source.indexOf('而不是“全部作废”'))
    expect(source.indexOf('<TerminalCoverageFigure />')).toBeLessThan(source.indexOf('id="timeout-disconnect"'))
    expect(source.indexOf('<CapacityRecycleFigure />')).toBeGreaterThan(source.indexOf('原因也是合同的一部分'))
    expect(source.indexOf('<CapacityRecycleFigure />')).toBeLessThan(source.indexOf('id="failure-isolation"'))
  })

  it('models cancellation as state × event before any cleanup detail', () => {
    expect(source.indexOf('无效希望')).toBeLessThan(source.indexOf('清理仪式'))
    expect(source).toContain('外部事件可以落在任何状态上')
    expect(source).toContain('落在**排队者**身上')
    expect(source).toContain('落在**生成者**身上')
    expect(source).toContain('重算恢复者')
    for (const requestId of ['C-a', 'C-b', 'C-c', 'C-d', 'C-e']) {
      expect(source.split(requestId).length - 1).toBeGreaterThan(2)
    }
  })

  it('unifies all terminal paths into one ritual with chapter-one partial output', () => {
    expect(source).toContain('同一次清理仪式')
    expect(source).toContain('| 释放块 | 归还全部 KV 块 |')
    expect(source).toContain('| 关闭流 | 输出通道收尾 |')
    expect(source).toContain('部分输出')
    expect(source).toContain('终止不收回历史')
    expect(source).toContain('在途安全')
  })

  it('presents the injected versus baseline timeline with honest consequences', () => {
    expect(source).toContain('| `C-a` | t0 / t4 | t0 / t5 | 完成拍后移一拍 |')
    expect(source).toContain('| `C-b` | t1 / t4 | t1 / t4（取消） | 释放 2 块，产出停在 2 个 token |')
    expect(source).toContain('| `C-d` | t5 / t7 | **t4 / t5** | 借释放的块提前一拍准入、早两拍完成 |')
    expect(source).toContain('| `C-e` | t6 / t6 | — / t4（超时） | 从未执行；释放的是队列位置 |')
    expect(source).toContain('| 总拍数 | 8 | 6 |')
    expect(source).toContain('被取消者的块是立刻回收的容量')
    expect(source).toContain('清理也有调度后果')
    expect(source).toContain('检测是边缘的事，转移是状态机的事')
  })

  it('grades failure by blast radius without judging either', () => {
    expect(source).toContain('**爆炸半径**')
    expect(source).toContain('请求级错误')
    expect(source).toContain('引擎级失败')
    expect(source).toContain('半径决定谁终止，不决定怎样终止')
    expect(source).toContain('两种半径没有对错')
  })

  it('closes on the machine-checkable no-leak contract', () => {
    expect(source).toContain('noLeakIssues')
    expect(source).toContain('恰有一个**终态事件')
    expect(source).toContain('终态当拍，块持有归零、离开队列、流已关闭')
    expect(source).toContain('指名道姓地报错')
    expect(source).toContain('可观测的终点')
    expect(source).toContain('聚合')
    expect(source).toContain('必须实测')
  })

  it('keeps counts inside the evidence boundary', () => {
    expect(source).toContain('不换算为真实延迟、可靠性或资源回收收益')
    for (const forbidden of ['GB/s', '利用率', 'TTFT', 'ITL', '毫秒']) {
      expect(source.split(forbidden)).toHaveLength(1)
    }
  })
})
