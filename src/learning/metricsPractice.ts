import { buildTerminationTrace, type TerminationTrace } from './terminationTrace'
import { requestMetrics } from './metricsLayer'
import type { KvRequestFixture } from './kvStateTrace'

/**
 * 实践换一份新工作量与 4 块小池：`N-c`/`N-d` 排队到 t4，
 * 一份报告把首 token 从准入起算，把排队藏进指标外。
 */
export const metricsPracticeRequests: readonly KvRequestFixture[] = [
  { id: 'N-a', arrivalStep: 0, promptTokens: 5, outputTokens: 3, maxContextTokens: 8, terminalReason: 'eos' },
  { id: 'N-b', arrivalStep: 0, promptTokens: 5, outputTokens: 3, maxContextTokens: 8, terminalReason: 'eos' },
  { id: 'N-c', arrivalStep: 1, promptTokens: 5, outputTokens: 2, maxContextTokens: 7, terminalReason: 'eos' },
  { id: 'N-d', arrivalStep: 2, promptTokens: 3, outputTokens: 2, maxContextTokens: 5, terminalReason: 'eos' },
]

export const metricsPracticeTrace: TerminationTrace = buildTerminationTrace({
  requests: metricsPracticeRequests,
  injections: [],
  blockCount: 4,
})

/** 报告声称的首 token（从准入起算）——与事件流推出的真实值对照。 */
export const practiceReport = {
  claimedTtfts: [
    { requestId: 'N-a', claimed: 0 },
    { requestId: 'N-b', claimed: 0 },
    { requestId: 'N-c', claimed: 0 },
    { requestId: 'N-d', claimed: 0 },
  ],
  claimedMean: 0,
}

export const trueTtfts = requestMetrics(metricsPracticeTrace).map((row) => ({
  requestId: row.requestId,
  queueTicks: row.queueTicks,
  ttftTicks: row.ttftTicks,
}))

export type HiddenByDefinition = 'queue-hidden' | 'token-count' | 'invalid-completions'

export function assessHiddenByDefinition(selected: HiddenByDefinition | undefined) {
  return {
    selected,
    expected: 'queue-hidden' as HiddenByDefinition,
    correct: selected === 'queue-hidden',
  }
}

/** 聚合链的固定顺序；学习者在页面上打乱后自行重建。 */
export const chainSteps = [
  { id: 'events', label: '保留原始事件（到达/准入/输出/终态）' },
  { id: 'per-request', label: '按钉死的定义算每请求指标' },
  { id: 'distribution', label: '把全体取值排成分布并取分位' },
  { id: 'verdict', label: '用阈值加分位给出 SLO 判定' },
] as const

export type ChainStepId = (typeof chainSteps)[number]['id']

export const chainAnswer: readonly ChainStepId[] = ['events', 'per-request', 'distribution', 'verdict']

export function assessChainOrder(ordered: readonly ChainStepId[]) {
  const positions = chainAnswer.map((expectedStep, position) => ({
    expectedStep,
    selectedStep: ordered[position],
    correct: ordered[position] === expectedStep,
  }))
  return {
    positions,
    correct: positions.filter((position) => position.correct).length,
    total: chainAnswer.length,
  }
}
