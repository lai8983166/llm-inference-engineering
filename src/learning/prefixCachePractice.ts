import { buildPrefixCacheTrace, type PrefixCacheEvent, type PrefixCacheTrace } from './prefixCacheTrace'
import type { KvRequestFixture } from './kvStateTrace'

/**
 * 实践换一份新工作量：毛边前缀（5-token 只共享 1 块），
 * T-b 先于 T-a 完成——账本含一次命中与一次 rc 递减不归还。
 */
export const practiceRequests: readonly KvRequestFixture[] = [
  { id: 'T-a', arrivalStep: 0, promptTokens: 5, outputTokens: 3, maxContextTokens: 8, terminalReason: 'eos' },
  { id: 'T-b', arrivalStep: 1, promptTokens: 5, outputTokens: 2, maxContextTokens: 7, terminalReason: 'eos' },
  { id: 'T-c', arrivalStep: 2, promptTokens: 5, outputTokens: 2, maxContextTokens: 7, terminalReason: 'eos' },
]

export const practiceSharedPrefix = new Map<string, number>([['T-a', 5], ['T-b', 5]])

export const practiceTrace: PrefixCacheTrace = buildPrefixCacheTrace('prefix-cache', {
  requests: practiceRequests,
  sharedPrefixTokens: practiceSharedPrefix,
  blockCount: 5,
})

/** S-b（这里为 T-b）完成时共享块发生了什么——由事件流推出。 */
export const sharedBlockRelease = (() => {
  const release = practiceTrace.events.find(
    (event) => event.requestId === 'T-b' && event.kind === 'blocks-released',
  )!
  return {
    tick: release.tick,
    freedBlocks: release.freedBlocks ?? [],
    decrementedBlocks: release.decrementedBlocks ?? [],
    cachedBlocks: release.cachedBlocks ?? [],
  }
})()

export type SharedReleaseMeaning = 'decrement-not-free' | 'free-immediately' | 'nothing'

export function assessSharedRelease(selected: SharedReleaseMeaning | undefined) {
  return {
    selected,
    expected: 'decrement-not-free' as SharedReleaseMeaning,
    correct: selected === 'decrement-not-free',
  }
}

/** 共享块完整生命周期的合法顺序。 */
export const lifecycleSteps = [
  { id: 'miss', label: '首算：为对齐前缀建共享块并登记缓存（rc=1）' },
  { id: 'hit', label: '命中：后来的请求挂入块表（rc++）' },
  { id: 'use', label: '使用：两个请求各自 decode，共享块只读' },
  { id: 'decrement', label: '一位共享者完成：只递减 rc，不归还' },
  { id: 'cache', label: '最后所有者离开：rc=0 转缓存（占池可命中）' },
  { id: 'evict', label: '压力下：新申请超过空闲，LRU 逐出缓存块' },
] as const

export type LifecycleStepId = (typeof lifecycleSteps)[number]['id']

export const lifecycleAnswer: readonly LifecycleStepId[] = ['miss', 'hit', 'use', 'decrement', 'cache', 'evict']

export function assessLifecycleOrder(ordered: readonly LifecycleStepId[]) {
  const positions = lifecycleAnswer.map((expectedStep, position) => ({
    expectedStep,
    selectedStep: ordered[position],
    correct: ordered[position] === expectedStep,
  }))
  return {
    positions,
    correct: positions.filter((position) => position.correct).length,
    total: lifecycleAnswer.length,
  }
}

export const practiceEventSummary: ReadonlyArray<Pick<PrefixCacheEvent, 'sequence' | 'tick' | 'requestId' | 'kind' | 'blocks' | 'hitTokens'>> = practiceTrace.events.map((event) => ({
  sequence: event.sequence,
  tick: event.tick,
  requestId: event.requestId,
  kind: event.kind,
  blocks: event.blocks,
  hitTokens: event.hitTokens,
}))
