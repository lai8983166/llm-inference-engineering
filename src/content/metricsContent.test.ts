import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve('src/content/chapters/metrics.mdx'), 'utf8')

describe('chapter eight prose contract', () => {
  it('keeps five cognitive turns on one continuous reading surface', () => {
    const headings = [...source.matchAll(/^<h2 id="([^"]+)">([^<]+)<\/h2>$/gm)]

    expect(headings.map((heading) => heading[1])).toEqual([
      'event-pairs',
      'distribution-not-mean',
      'open-closed-loop',
      'goodput',
      'aggregation-chain',
    ])
    expect(source.match(/^<h3/gm)).toBeNull()
    expect(source.match(/<(?:EventToDistributionFigure|LoopComparisonFigure)\s*\/>/g)).toHaveLength(2)
    expect(source.indexOf('<EventToDistributionFigure />')).toBeGreaterThan(source.indexOf('先查边界，再查数字'))
    expect(source.indexOf('<EventToDistributionFigure />')).toBeLessThan(source.indexOf('id="distribution-not-mean"'))
    expect(source.indexOf('<LoopComparisonFigure />')).toBeGreaterThan(source.indexOf('报告必须声明它'))
    expect(source.indexOf('<LoopComparisonFigure />')).toBeLessThan(source.indexOf('id="goodput"'))
  })

  it('pins definitions to event pairs before any metric number', () => {
    expect(source.indexOf('定义先于数值')).toBeGreaterThan(0)
    expect(source).toContain('**排队** = 准入拍减到达拍')
    expect(source).toContain('**首 token** = 首个输出事件拍减到达拍')
    expect(source).toContain('**间隔**（ITL）= 相邻两个输出事件拍之差')
    expect(source).toContain('**端到端** = 终态拍减到达拍')
    expect(source).toContain('把它记成 0，均值就凭空变好了')
    expect(source).toContain('定义可迁移，数值不可迁移')
    expect(source).toContain('先查边界，再查数字')
    for (const requestId of ['K-a', 'K-b', 'K-d', 'K-e']) {
      expect(source.split(requestId).length - 1).toBeGreaterThan(1)
    }
  })

  it('presents the counterexample and nearest-rank percentiles before SLO', () => {
    expect(source).toContain('| A：快时很快、偶尔卡顿 | [1,1,1,1,5] | 1.8 | 5 | **违约** |')
    expect(source).toContain('| B：恒定稍慢 | [2,2,2,2,2] | 2.0 | 2 | **达标** |')
    expect(source).toContain('最近邻秩')
    expect(source).toContain('p50 是第 4 个（2 拍）')
    expect(source).toContain('阈值加分位，缺一不可')
    expect(source).toContain('均值回答总量')
    expect(source.indexOf('分位数把尾部找回来')).toBeLessThan(source.indexOf('**SLO** 的含义'))
  })

  it('contrasts open and closed loops without declaring a winner', () => {
    expect(source).toContain('| 到达拍 | 0,0,1,2,3,6（固定） | 0,3,6,9,11,15（由完成推导） |')
    expect(source).toContain('| 最大队列深度 | 2 | 0 |')
    expect(source).toContain('| 总拍数 | 8 | 17 |')
    expect(source).toContain('把排队**吸收**了')
    expect(source).toContain('永远测不出过载行为')
    expect(source).toContain('负载生成器的性质是结论的一部分')
    expect(source).toContain('取决于生产流量像哪种')
  })

  it('separates throughput from goodput with an itemized exclusion list', () => {
    expect(source).toContain('**goodput** 只数有效完成')
    expect(source).toContain('goodput 4/8')
    expect(source).toContain('取消 1、超时 1')
    expect(source).toContain('把失败记成功')
    expect(source).toContain('吞吐、goodput、排除清单（按原因）三者并列')
    expect(source).toContain('无效希望')
  })

  it('closes on the reversible aggregation chain and chapter nine hook', () => {
    expect(source).toContain('**原始事件 → 每请求指标 → 分布 → SLO 判定**')
    expect(source).toContain('反向走')
    expect(source).toContain('五项缺一，结论就退化为故事')
    expect(source).toContain('首 token 分位正常而间隔分位劣化，指向 decode 路径')
    expect(source).toContain('哪一层慢')
    expect(source).toContain('精确地测量错误的东西')
  })

  it('places practice and transfer assessment after the complete prose', () => {
    expect(source.match(/<(?:MetricsReportPractice|MetricsTransferAssessment)\s*\/>/g)).toHaveLength(2)
    expect(source.indexOf('<MetricsReportPractice />')).toBeGreaterThan(source.indexOf('精确地测量错误的东西'))
    expect(source.indexOf('<MetricsTransferAssessment />')).toBeGreaterThan(source.indexOf('<MetricsReportPractice />'))
  })

  it('keeps every number inside the tick evidence boundary', () => {
    expect(source).toContain('教学单位仍是拍')
    expect(source).toContain('真实系统对时间戳做同样的差')
    for (const forbidden of ['GB/s', '利用率', '毫秒', 'ms']) {
      expect(source.split(forbidden)).toHaveLength(1)
    }
  })
})
