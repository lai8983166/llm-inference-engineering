import {
  closedLoopTrace,
  distribution,
  goodputSummary,
  loopComparison,
  meanTailCounterexample,
  metricsTrace,
  percentileNearestRank,
  requestMetrics,
  sloVerdict,
} from './metricsLayer'
import { noLeakIssues } from './terminationTrace'

describe('metrics teaching trace', () => {
  it('runs the hand-checked eight-tick open-loop timeline', () => {
    expect(noLeakIssues(metricsTrace)).toEqual([])
    expect(metricsTrace.ticks).toHaveLength(8)
  })

  it('derives every per-request metric from event-pair differences', () => {
    const rows = requestMetrics(metricsTrace)

    expect(rows).toEqual([
      { requestId: 'K-a', arrivalTick: 0, queueTicks: 0, ttftTicks: 0, itlTicks: [3, 2], e2eTicks: 5, terminalTick: 5, cause: 'eos' },
      { requestId: 'K-b', arrivalTick: 0, queueTicks: 0, ttftTicks: 1, itlTicks: [2], e2eTicks: 4, terminalTick: 4, cause: 'client-cancel' },
      { requestId: 'K-c', arrivalTick: 1, queueTicks: 0, ttftTicks: 1, itlTicks: [1, 2], e2eTicks: 4, terminalTick: 5, cause: 'eos' },
      { requestId: 'K-d', arrivalTick: 2, queueTicks: 2, ttftTicks: 2, itlTicks: [1], e2eTicks: 3, terminalTick: 5, cause: 'eos' },
      { requestId: 'K-e', arrivalTick: 3, queueTicks: null, ttftTicks: null, itlTicks: [], e2eTicks: 1, terminalTick: 4, cause: 'timeout' },
      { requestId: 'K-f', arrivalTick: 6, queueTicks: 0, ttftTicks: 0, itlTicks: [1], e2eTicks: 1, terminalTick: 7, cause: 'eos' },
    ])
    // K-d 的首 token 2 拍里包含 2 拍排队——换边界（从准入起算）就换成 0。
    expect(rows[3].ttftTicks).toBe(rows[3].queueTicks)
  })

  it('computes the pooled ITL distribution by nearest-rank percentiles', () => {
    const rows = requestMetrics(metricsTrace)
    const itls = rows.flatMap((row) => row.itlTicks)
    const summary = distribution(itls)

    expect(summary.count).toBe(7)
    expect(summary.sorted).toEqual([1, 1, 1, 2, 2, 2, 3])
    expect(summary.mean).toBeCloseTo(12 / 7, 10)
    expect(summary.p50).toBe(2)
    expect(summary.p99).toBe(3)
    expect(percentileNearestRank([2, 2, 2, 2, 2], 99)).toBe(2)
  })

  it('separates throughput from goodput by terminal cause', () => {
    const summary = goodputSummary(metricsTrace)

    expect(summary.arrivals).toBe(6)
    expect(summary.usefulCompletions).toBe(4)
    expect(summary.excluded).toEqual([
      { requestId: 'K-b', cause: 'client-cancel' },
      { requestId: 'K-e', cause: 'timeout' },
    ])
    expect(summary.throughputFraction).toBeCloseTo(6 / 8, 10)
    expect(summary.goodputFraction).toBeCloseTo(4 / 8, 10)
  })
})

describe('mean-tail counterexample', () => {
  it('shows better mean with worse tail and flipped SLO verdict', () => {
    const example = meanTailCounterexample()

    expect(example.systemA.summary.mean).toBeCloseTo(1.8, 10)
    expect(example.systemA.summary.p99).toBe(5)
    expect(example.systemA.verdict.passes).toBe(false)
    expect(example.systemB.summary.mean).toBeCloseTo(2.0, 10)
    expect(example.systemB.summary.p99).toBe(2)
    expect(example.systemB.verdict.passes).toBe(true)
    // A 的均值更好而 p99 更差：两种数字回答不同的问题。
    expect(example.systemA.summary.mean).toBeLessThan(example.systemB.summary.mean)
    expect(example.systemA.summary.p99).toBeGreaterThan(example.systemB.summary.p99)
    expect(sloVerdict([1, 1, 1, 1, 4], 4, 99).passes).toBe(true)
  })
})

describe('open versus closed loop', () => {
  it('derives serial arrivals from the open trace with no injections', () => {
    const closed = closedLoopTrace()

    expect(noLeakIssues(closed)).toEqual([])
    expect(closed.requests.map((request) => request.arrivalStep)).toEqual([0, 3, 6, 9, 11, 15])
    expect(closed.ticks).toHaveLength(17)
  })

  it('shows closed loop absorbing all queueing', () => {
    const comparison = loopComparison()

    expect(comparison.openMaxQueueDepth).toBe(2)
    expect(comparison.closedMaxQueueDepth).toBe(0)
    expect(comparison.openTicks).toBe(8)
    expect(comparison.closedTicks).toBe(17)
    // 串行客户端：人人排队 0 拍、首 token 0 拍——闭环测不出排队行为。
    expect(comparison.rows.every((row) => row.closedQueueTicks === 0)).toBe(true)
    expect(comparison.rows.every((row) => row.closedTtftTicks === 0)).toBe(true)
    const queued = comparison.rows.filter((row) => (row.openQueueTicks ?? 0) > 0)
    expect(queued.map((row) => row.requestId)).toEqual(['K-d'])
    // 闭环下全部自然完成：goodput 与吞吐相等。
    expect(goodputSummary(closedLoopTrace()).usefulCompletions).toBe(6)
  })

  it('does not embed measured time or utilization fields', () => {
    const serialized = JSON.stringify([metricsTrace, closedLoopTrace(), loopComparison(), meanTailCounterexample()])
    const keys = [...serialized.matchAll(/"([^"]+)":/g)].map((match) => match[1].toLowerCase())

    expect(keys.some((key) => /(millisecond|duration|latency|utilization|throughput[^F]|timestamp|bandwidth|ms$|gb)/.test(key))).toBe(false)
  })
})
