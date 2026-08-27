import { buildOverloadTrace, type OverloadTrace } from './overloadTrace'
import type { KvRequestFixture } from './kvStateTrace'

/**
 * 实践换一份新的突发与 4 块小池：`Q-3` 在 t1 的拒绝是第一处
 * 需要归因的裁决，正确答案由当时的 free/need 数字推出。
 */
export const overloadPracticeRequests: readonly KvRequestFixture[] = [
  { id: 'Q-1', arrivalStep: 0, promptTokens: 5, outputTokens: 3, maxContextTokens: 8, terminalReason: 'eos' },
  { id: 'Q-2', arrivalStep: 0, promptTokens: 5, outputTokens: 3, maxContextTokens: 8, terminalReason: 'eos' },
  { id: 'Q-3', arrivalStep: 1, promptTokens: 6, outputTokens: 2, maxContextTokens: 8, terminalReason: 'eos' },
]

export const overloadPracticeBlockCount = 4

export const overloadPracticeTrace: OverloadTrace = buildOverloadTrace('reject', {
  requests: overloadPracticeRequests,
  blockCount: overloadPracticeBlockCount,
})

export interface RejectionQuestion {
  requestId: string
  tick: number
  neededBlocks: number
  freeBlocks: number
  watermark: number
}

export const overloadFirstRejection: RejectionQuestion = (() => {
  const rejection = overloadPracticeTrace.events.find((event) => event.kind === 'rejected')!
  return {
    requestId: rejection.requestId,
    tick: rejection.tick,
    neededBlocks: rejection.neededBlocks ?? 0,
    freeBlocks: rejection.freeBlocks ?? 0,
    watermark: rejection.watermark ?? 0,
  }
})()

export type RejectionMeaning = 'caller-bears-cost' | 'selection-order' | 'not-arrived'

export function assessRejectionMeaning(selected: RejectionMeaning | undefined) {
  return {
    selected,
    expected: 'caller-bears-cost' as RejectionMeaning,
    correct: selected === 'caller-bears-cost',
  }
}

/** 一次到达的准入裁决必须走完的合法顺序。 */
export const admissionSteps = [
  { id: 'register', label: '登记到达与输入就绪' },
  { id: 'inputs', label: '计算 free、need 与水位' },
  { id: 'decide', label: '作出准入/排队/拒绝/抢占裁决' },
  { id: 'record', label: '登记结果与原因（如等待块、被拒）' },
  { id: 'handoff', label: '交给本拍的选择与执行' },
] as const

export type AdmissionStepId = (typeof admissionSteps)[number]['id']

export const admissionAnswer: readonly AdmissionStepId[] = ['register', 'inputs', 'decide', 'record', 'handoff']

export function assessAdmissionOrder(ordered: readonly AdmissionStepId[]) {
  const positions = admissionAnswer.map((expectedStep, position) => ({
    expectedStep,
    selectedStep: ordered[position],
    correct: ordered[position] === expectedStep,
  }))
  return {
    positions,
    correct: positions.filter((position) => position.correct).length,
    total: admissionAnswer.length,
  }
}
