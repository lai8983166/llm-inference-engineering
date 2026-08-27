import {
  buildScheduleTrace,
  type ScheduleTickSnapshot,
} from './scheduleTrace'
import type { KvRequestFixture } from './kvStateTrace'

/**
 * 实践换一份新的请求工作量与 3 块小池：`T-b` 在 t0 的等待块事件
 * 是第一处需要归因的容量事件，正确答案由快照数字推出。
 */
export const schedulePracticeRequests: readonly KvRequestFixture[] = [
  { id: 'T-a', arrivalStep: 0, promptTokens: 5, outputTokens: 3, maxContextTokens: 8, terminalReason: 'eos' },
  { id: 'T-b', arrivalStep: 0, promptTokens: 5, outputTokens: 3, maxContextTokens: 8, terminalReason: 'eos' },
  { id: 'T-c', arrivalStep: 1, promptTokens: 2, outputTokens: 1, maxContextTokens: 4, terminalReason: 'eos' },
]

export const schedulePracticeBlockCount = 3

export const schedulePracticeTrace = buildScheduleTrace('prefill-priority', {
  requests: schedulePracticeRequests,
  blockCount: schedulePracticeBlockCount,
})

export interface WaitingQuestion {
  requestId: string
  tick: number
  neededBlocks: number
  freeBlocks: number
  tickSnapshot: ScheduleTickSnapshot
}

/** 首个等待块事件及其当时池状态。 */
export const scheduleFirstWaiting: WaitingQuestion = (() => {
  const waiting = schedulePracticeTrace.events.find((event) => event.kind === 'admission-waiting')!
  const heldBlocks = schedulePracticeTrace.ticks[waiting.tick].runnable
    .reduce((total, item) => total + item.heldBlocks, 0)
  return {
    requestId: waiting.requestId,
    tick: waiting.tick,
    neededBlocks: waiting.blocks ?? 0,
    freeBlocks: schedulePracticeBlockCount - heldBlocks,
    tickSnapshot: schedulePracticeTrace.ticks[waiting.tick],
  }
})()

export type WaitingCause = 'not-enough-blocks' | 'not-selected' | 'not-arrived'

export function assessWaitingCause(selected: WaitingCause | undefined) {
  return {
    selected,
    expected: 'not-enough-blocks' as WaitingCause,
    correct: selected === 'not-enough-blocks',
  }
}

/** 一拍的合法顺序；学习者在页面上打乱后自行重建。 */
export const tickOrderSteps = [
  { id: 'arrivals', label: '登记本拍到达的请求' },
  { id: 'admission', label: '重试准入并登记等待原因' },
  { id: 'runnable', label: '重算可运行集合' },
  { id: 'select', label: '按策略选择本拍工作' },
  { id: 'execute', label: '执行被选中的 prefill 或 decode 组' },
  { id: 'finish', label: '完成者当拍离开并归还块' },
] as const

export type TickOrderStepId = (typeof tickOrderSteps)[number]['id']

export const tickOrderAnswer: readonly TickOrderStepId[] = [
  'arrivals', 'admission', 'runnable', 'select', 'execute', 'finish',
]

export function assessTickOrder(ordered: readonly TickOrderStepId[]) {
  const positions = tickOrderAnswer.map((expectedStep, position) => ({
    expectedStep,
    selectedStep: ordered[position],
    correct: ordered[position] === expectedStep,
  }))
  return {
    positions,
    correct: positions.filter((position) => position.correct).length,
    total: tickOrderAnswer.length,
  }
}
