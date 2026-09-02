import {
  buildTerminationTrace,
  type TerminationCause,
  type TerminationInjection,
  type TerminationTrace,
} from './terminationTrace'
import type { KvRequestFixture } from './kvStateTrace'

/** 第 08 章固定工作量：6 请求、6 块池、无界排队、prefill 优先。 */
export const metricsRequests: readonly KvRequestFixture[] = [
  { id: 'K-a', arrivalStep: 0, promptTokens: 5, outputTokens: 3, maxContextTokens: 8, terminalReason: 'eos' },
  { id: 'K-b', arrivalStep: 0, promptTokens: 5, outputTokens: 3, maxContextTokens: 8, terminalReason: 'eos' },
  { id: 'K-c', arrivalStep: 1, promptTokens: 5, outputTokens: 3, maxContextTokens: 8, terminalReason: 'eos' },
  { id: 'K-d', arrivalStep: 2, promptTokens: 3, outputTokens: 2, maxContextTokens: 5, terminalReason: 'eos' },
  { id: 'K-e', arrivalStep: 3, promptTokens: 2, outputTokens: 4, maxContextTokens: 6, terminalReason: 'eos' },
  { id: 'K-f', arrivalStep: 6, promptTokens: 4, outputTokens: 2, maxContextTokens: 6, terminalReason: 'eos' },
]

export const metricsInjections: readonly TerminationInjection[] = [
  { requestId: 'K-b', tick: 4, cause: 'client-cancel' },
  { requestId: 'K-e', tick: 4, cause: 'timeout', firstExecutionDeadlineTick: 3 },
]

export const metricsTrace: TerminationTrace = buildTerminationTrace({
  requests: metricsRequests,
  injections: metricsInjections,
  blockCount: 6,
})

export interface RequestMetricRow {
  requestId: string
  arrivalTick: number
  /** 排队拍 = 准入拍 − 到达拍；从未准入者（如超时）为 null。 */
  queueTicks: number | null
  /** 首 token 拍 = 首个输出事件拍 − 到达拍；从未执行者为 null。 */
  ttftTicks: number | null
  /** token 间隔 = 相邻输出事件拍之差；只有一个输出者为空数组。 */
  itlTicks: readonly number[]
  /** 端到端拍 = 终态拍 − 到达拍。 */
  e2eTicks: number
  terminalTick: number
  cause: TerminationCause
}

/** 每请求指标全部由事件对差值推导——正文、图与实践消费同一结果。 */
export function requestMetrics(trace: TerminationTrace): readonly RequestMetricRow[] {
  return trace.requests.map((request) => {
    const events = trace.events.filter((event) => event.requestId === request.id)
    const arrival = events.find((event) => event.kind === 'arrived')
    const admission = events.find((event) => event.kind === 'admitted')
    const outputs = events.filter((event) => event.kind === 'prefill-executed' || event.kind === 'decode-executed')
    const terminal = events.find((event) => event.kind === 'terminated')
    const arrivalTick = arrival?.tick ?? 0
    const itlTicks = outputs.slice(1).map((event, index) => event.tick - outputs[index].tick)
    return {
      requestId: request.id,
      arrivalTick,
      queueTicks: admission ? admission.tick - arrivalTick : null,
      ttftTicks: outputs.length > 0 ? outputs[0].tick - arrivalTick : null,
      itlTicks,
      e2eTicks: (terminal?.tick ?? arrivalTick) - arrivalTick,
      terminalTick: terminal?.tick ?? -1,
      cause: terminal?.cause ?? 'eos',
    }
  })
}

/** 最近邻秩分位：第 ⌈p·N⌉ 个排序值；样本量小时 p99 退化为最大值。 */
export function percentileNearestRank(values: readonly number[], p: number): number {
  if (values.length === 0) throw new Error('分位数需要非空样本。')
  const sorted = [...values].sort((left, right) => left - right)
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length))
  return sorted[rank - 1]
}

export interface DistributionSummary {
  count: number
  sorted: readonly number[]
  mean: number
  p50: number
  p99: number
  max: number
}

export function distribution(values: readonly number[]): DistributionSummary {
  if (values.length === 0) throw new Error('分布需要非空样本。')
  const sorted = [...values].sort((left, right) => left - right)
  const total = sorted.reduce((sum, value) => sum + value, 0)
  return {
    count: sorted.length,
    sorted,
    mean: total / sorted.length,
    p50: percentileNearestRank(sorted, 50),
    p99: percentileNearestRank(sorted, 99),
    max: sorted[sorted.length - 1],
  }
}

export interface SloVerdict {
  threshold: number
  percentile: number
  valueAtPercentile: number
  passes: boolean
}

/** SLO = 阈值 + 分位；判定由最近邻秩分位给出。 */
export function sloVerdict(values: readonly number[], threshold: number, percentile = 99): SloVerdict {
  const valueAtPercentile = percentileNearestRank(values, percentile)
  return { threshold, percentile, valueAtPercentile, passes: valueAtPercentile <= threshold }
}

export interface GoodputSummary {
  arrivals: number
  usefulCompletions: number
  excluded: readonly { requestId: string; cause: TerminationCause }[]
  throughputFraction: number
  goodputFraction: number
}

/** 吞吐按全部终态计；goodput 只数 eos/length 的有效完成。 */
export function goodputSummary(trace: TerminationTrace): GoodputSummary {
  const metrics = requestMetrics(trace)
  const excluded = metrics
    .filter((row) => row.cause !== 'eos' && row.cause !== 'length')
    .map((row) => ({ requestId: row.requestId, cause: row.cause }))
  const useful = metrics.length - excluded.length
  return {
    arrivals: metrics.length,
    usefulCompletions: useful,
    excluded,
    throughputFraction: metrics.length / trace.ticks.length,
    goodputFraction: useful / trace.ticks.length,
  }
}

export interface MeanTailSystem {
  label: string
  itls: readonly number[]
  summary: DistributionSummary
  verdict: SloVerdict
}

/** 均值-尾部反例：A 均值更好而 B 的 p99 与 SLO 判定更好（登记的教学分布）。 */
export function meanTailCounterexample(): {
  systemA: MeanTailSystem
  systemB: MeanTailSystem
  slo: { threshold: number; percentile: number }
} {
  const slo = { threshold: 4, percentile: 99 }
  const build = (label: string, itls: readonly number[]): MeanTailSystem => ({
    label,
    itls,
    summary: distribution(itls),
    verdict: sloVerdict(itls, slo.threshold, slo.percentile),
  })
  return {
    systemA: build('A：快时很快、偶尔卡顿', [1, 1, 1, 1, 5]),
    systemB: build('B：恒定稍慢', [2, 2, 2, 2, 2]),
    slo,
  }
}

/** 闭环到达表：串行客户端，请求 i 的终态 = 到达拍 + 输出数 − 1，
 * 下一请求到达 = 该终态拍 + 1；注入不随环式迁移。 */
export function closedLoopTrace(open: TerminationTrace = metricsTrace): TerminationTrace {
  let arrival = 0
  const requests = open.requests.map((request) => {
    const fixture = { ...request, arrivalStep: arrival }
    arrival = arrival + request.outputTokens
    return fixture
  })
  return buildTerminationTrace({ requests, injections: [], blockCount: open.blockCount })
}

export interface LoopComparisonRow {
  requestId: string
  openQueueTicks: number | null
  closedQueueTicks: number | null
  openTtftTicks: number | null
  closedTtftTicks: number | null
}

/** 同一服务、同一请求集合在开环与串行闭环下的排队与首 token 对照。 */
export function loopComparison(open: TerminationTrace = metricsTrace): {
  rows: readonly LoopComparisonRow[]
  openMaxQueueDepth: number
  closedMaxQueueDepth: number
  openTicks: number
  closedTicks: number
} {
  const closed = closedLoopTrace(open)
  const openMetrics = requestMetrics(open)
  const closedMetrics = requestMetrics(closed)
  return {
    rows: openMetrics.map((row, index) => ({
      requestId: row.requestId,
      openQueueTicks: row.queueTicks,
      closedQueueTicks: closedMetrics[index].queueTicks,
      openTtftTicks: row.ttftTicks,
      closedTtftTicks: closedMetrics[index].ttftTicks,
    })),
    openMaxQueueDepth: Math.max(...open.ticks.map((snapshot) => snapshot.queueDepth)),
    closedMaxQueueDepth: Math.max(...closed.ticks.map((snapshot) => snapshot.queueDepth)),
    openTicks: open.ticks.length,
    closedTicks: closed.ticks.length,
  }
}
