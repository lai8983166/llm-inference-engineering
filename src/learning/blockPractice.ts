import {
  buildBlockPoolTrace,
  type BlockPoolFixture,
  type BlockPoolSnapshot,
} from './blockPoolTrace'
import type { KvRequestFixture } from './kvStateTrace'

/**
 * 实践换一份新的请求工作量与 4 块 × 3 unit 的更小池：`Q-c` 在 step 2
 * 的申请失败是第一处需要解释的事件，正确归因由快照数字推出。
 */
export const blockPracticeRequests: readonly KvRequestFixture[] = [
  { id: 'Q-a', arrivalStep: 0, promptTokens: 3, outputTokens: 3, maxContextTokens: 6, terminalReason: 'eos' },
  { id: 'Q-b', arrivalStep: 1, promptTokens: 2, outputTokens: 2, maxContextTokens: 6, terminalReason: 'eos' },
  { id: 'Q-c', arrivalStep: 2, promptTokens: 8, outputTokens: 1, maxContextTokens: 9, terminalReason: 'eos' },
]

export const blockPracticeFixture: BlockPoolFixture = { blockSizeTokens: 3, blockCount: 4 }

export const blockPracticeTrace = buildBlockPoolTrace({
  fixture: blockPracticeFixture,
  requests: blockPracticeRequests,
})

export interface BlockRejectionQuestion {
  requestId: string
  logicalStep: number
  demandedBlocks: number
  freeBlocks: number
  pool: BlockPoolSnapshot
}

/** 首个被拒绝的申请及其当时池状态。 */
export const blockFirstRejection: BlockRejectionQuestion = (() => {
  const rejection = blockPracticeTrace.events.find((event) => event.kind === 'rejected')!
  const pool = blockPracticeTrace.poolSnapshots[rejection.sequence]
  return {
    requestId: rejection.requestId,
    logicalStep: rejection.logicalStep,
    demandedBlocks: Math.ceil((rejection.tokens ?? 0) / blockPracticeFixture.blockSizeTokens),
    freeBlocks: pool.freeBlocks,
    pool,
  }
})()

export type BlockRejectionCause = 'not-enough-blocks' | 'table-too-long' | 'waste-too-large'

export function assessBlockRejectionCause(selected: BlockRejectionCause | undefined) {
  return {
    selected,
    expected: 'not-enough-blocks' as BlockRejectionCause,
    correct: selected === 'not-enough-blocks',
  }
}

/** 一次“当前块已满”的增长必须走完的合法顺序。 */
export const blockLifecycleSteps = [
  { id: 'allocate', label: '从池中分配一个空闲块' },
  { id: 'entry', label: '在块表末尾登记新表项' },
  { id: 'write', label: '把新 token 写入该块' },
  { id: 'release', label: '请求结束后整块归还' },
] as const

export type BlockLifecycleStepId = (typeof blockLifecycleSteps)[number]['id']

export const blockLifecycleAnswer: readonly BlockLifecycleStepId[] = ['allocate', 'entry', 'write', 'release']

export function assessBlockLifecycleOrder(ordered: readonly BlockLifecycleStepId[]) {
  const positions = blockLifecycleAnswer.map((expectedStep, position) => ({
    expectedStep,
    selectedStep: ordered[position],
    correct: ordered[position] === expectedStep,
  }))
  return {
    positions,
    correct: positions.filter((position) => position.correct).length,
    total: blockLifecycleAnswer.length,
  }
}
