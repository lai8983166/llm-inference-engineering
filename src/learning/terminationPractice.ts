import { buildTerminationTrace, type TerminationInjection, type TerminationTrace } from './terminationTrace'
import type { KvRequestFixture } from './kvStateTrace'

/**
 * 实践换一份新的工作量与 4 块小池：t3 同时注入两类终止——
 * 生成中断开（D-2，持有 2 块）与排队中超时（D-3，零块）。
 */
export const terminationPracticeRequests: readonly KvRequestFixture[] = [
  { id: 'D-1', arrivalStep: 0, promptTokens: 5, outputTokens: 3, maxContextTokens: 8, terminalReason: 'eos' },
  { id: 'D-2', arrivalStep: 0, promptTokens: 5, outputTokens: 3, maxContextTokens: 8, terminalReason: 'eos' },
  { id: 'D-3', arrivalStep: 1, promptTokens: 5, outputTokens: 2, maxContextTokens: 7, terminalReason: 'eos' },
  { id: 'D-4', arrivalStep: 2, promptTokens: 2, outputTokens: 1, maxContextTokens: 3, terminalReason: 'eos' },
]

export const terminationPracticeInjections: readonly TerminationInjection[] = [
  { requestId: 'D-2', tick: 3, cause: 'disconnect' },
  { requestId: 'D-3', tick: 3, cause: 'timeout', firstExecutionDeadlineTick: 2 },
]

export const terminationPracticeTrace: TerminationTrace = buildTerminationTrace({
  requests: terminationPracticeRequests,
  injections: terminationPracticeInjections,
  blockCount: 4,
})

export interface ReleasedQuestion {
  requestId: string
  tick: number
  releasedBlocks: number
  leftQueue: boolean
}

/** 两个注入终态各自释放了什么，由事件流推出。 */
export const terminationPracticeQuestions: readonly ReleasedQuestion[] = (() => {
  return terminationPracticeInjections.map((injection) => {
    const events = terminationPracticeTrace.events.filter((event) => event.requestId === injection.requestId)
    const release = events.find((event) => event.kind === 'blocks-released')
    return {
      requestId: injection.requestId,
      tick: injection.tick,
      releasedBlocks: release?.blocks ?? 0,
      leftQueue: events.some((event) => event.kind === 'left-queue'),
    }
  })
})()

export type DisconnectRelease = 'blocks-and-stream' | 'stream-only' | 'nothing'

export function assessDisconnectRelease(selected: DisconnectRelease | undefined) {
  return {
    selected,
    expected: 'blocks-and-stream' as DisconnectRelease,
    correct: selected === 'blocks-and-stream',
  }
}

/** 清理仪式的合法顺序（教学模型的事件顺序）。 */
export const cleanupSteps = [
  { id: 'decide', label: '终止裁决：确定原因并冻结状态' },
  { id: 'inflight', label: '在途安全：等已提交的工作结束' },
  { id: 'release', label: '释放块（如有）并离队（如在队）' },
  { id: 'close', label: '关闭流：输出通道收尾' },
  { id: 'record', label: '记录带原因的终态事件' },
] as const

export type CleanupStepId = (typeof cleanupSteps)[number]['id']

export const cleanupAnswer: readonly CleanupStepId[] = ['decide', 'inflight', 'release', 'close', 'record']

export function assessCleanupOrder(ordered: readonly CleanupStepId[]) {
  const positions = cleanupAnswer.map((expectedStep, position) => ({
    expectedStep,
    selectedStep: ordered[position],
    correct: ordered[position] === expectedStep,
  }))
  return {
    positions,
    correct: positions.filter((position) => position.correct).length,
    total: cleanupAnswer.length,
  }
}
