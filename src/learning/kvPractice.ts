import {
  buildKvTrace,
  classifyCapacityFailure,
  type KvCapacityFailureCategory,
  type KvPoolSnapshot,
  type KvRequestFixture,
} from './kvStateTrace'

export type { KvCapacityFailureCategory }

/**
 * 实践换一份新的请求工作量与更小的物理池：`P-b` 在 step 1 的申请失败
 * 是第一处需要归因的容量事件，正确答案由 `classifyCapacityFailure`
 * 从原始区间计算，而不是手写在页面里。
 */
export const kvPracticeRequests: readonly KvRequestFixture[] = [
  { id: 'P-a', arrivalStep: 0, promptTokens: 4, outputTokens: 4, maxContextTokens: 14, terminalReason: 'eos' },
  { id: 'P-b', arrivalStep: 1, promptTokens: 2, outputTokens: 1, maxContextTokens: 9, terminalReason: 'eos' },
  { id: 'P-c', arrivalStep: 2, promptTokens: 4, outputTokens: 2, maxContextTokens: 6, terminalReason: 'length' },
]

export const kvPracticePoolTokens = 16

export const kvPracticeTrace = buildKvTrace('max-reservation', {
  requests: kvPracticeRequests,
  poolCapacityTokens: kvPracticePoolTokens,
})

export interface KvFailureQuestion {
  requestId: string
  logicalStep: number
  demandTokens: number
  pool: KvPoolSnapshot
  expected: KvCapacityFailureCategory
}

/** 首个被拒绝的申请及其当时池状态；期望类别由分类函数从区间推导。 */
export const kvFirstFailureQuestion: KvFailureQuestion = (() => {
  const rejection = kvPracticeTrace.events.find((event) => event.kind === 'rejected')!
  const pool = kvPracticeTrace.poolSnapshots[rejection.sequence]
  const expected = classifyCapacityFailure(pool.intervals, rejection.tokens!, kvPracticePoolTokens)
  if (expected === null) throw new Error('首个被拒申请必须能被归入一类容量失败。')
  return {
    requestId: rejection.requestId,
    logicalStep: rejection.logicalStep,
    demandTokens: rejection.tokens!,
    pool,
    expected,
  }
})()

export const kvFailureCategoryLabels: Record<KvCapacityFailureCategory, string> = {
  'effective-capacity': '有效容量耗尽',
  'over-reservation': '过度预留',
  'migration-peak': '搬迁峰值',
  'external-fragmentation': '外部碎片',
}

export function assessKvFailurePrediction(selected: KvCapacityFailureCategory | undefined, question: KvFailureQuestion = kvFirstFailureQuestion) {
  return {
    selected,
    expected: question.expected,
    correct: selected === question.expected,
  }
}

/** 搬迁链条的合法顺序；学习者在页面上打乱后自行重建。 */
export const kvMigrationSteps = [
  { id: 'apply', label: '另址申请一段足够大的连续新区间' },
  { id: 'copy', label: '把旧区间的 K/V 逐项复制到新区间' },
  { id: 'publish', label: '发布新区间为请求的权威地址' },
  { id: 'wait', label: '等待旧地址上的在途读取全部结束' },
  { id: 'release', label: '释放旧区间，归还给空闲池' },
] as const

export type KvMigrationStepId = (typeof kvMigrationSteps)[number]['id']

export const kvMigrationAnswer: readonly KvMigrationStepId[] = ['apply', 'copy', 'publish', 'wait', 'release']

export function assessKvMigrationOrder(ordered: readonly KvMigrationStepId[]) {
  const positions = kvMigrationAnswer.map((expectedStep, position) => ({
    expectedStep,
    selectedStep: ordered[position],
    correct: ordered[position] === expectedStep,
  }))
  return {
    positions,
    correct: positions.filter((position) => position.correct).length,
    total: kvMigrationAnswer.length,
  }
}
