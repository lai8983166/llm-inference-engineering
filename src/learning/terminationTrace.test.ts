import {
  buildTerminationTrace,
  noLeakIssues,
  terminationInjections,
  terminationOutcome,
  terminationRequests,
  terminationTeachingPool,
} from './terminationTrace'
import { concurrencyChapterRequests } from './concurrencyTrace'
import { kvChapterRequests } from './kvStateTrace'

describe('termination teaching fixtures', () => {
  it('keeps the chapter pool and adds a burst with two injected terminations', () => {
    expect(terminationTeachingPool).toEqual({ blockCount: 6, blockSizeTokens: 4 })
    expect(kvChapterRequests.map((request) => request.id)).toEqual(['R-long', 'R-short', 'R-late'])
    expect(concurrencyChapterRequests).toHaveLength(3)
    expect(terminationRequests.map((request) => [request.id, request.arrivalStep])).toEqual([
      ['C-a', 0], ['C-b', 0], ['C-c', 1], ['C-d', 2], ['C-e', 3],
    ])
    expect(terminationInjections).toEqual([
      { requestId: 'C-b', tick: 4, cause: 'client-cancel' },
      { requestId: 'C-e', tick: 4, cause: 'timeout', firstExecutionDeadlineTick: 3 },
    ])
  })
})

describe('deterministic termination traces', () => {
  it('walks the hand-checked injected timeline in six ticks', () => {
    const trace = buildTerminationTrace()
    const outcomes = terminationOutcome(trace)

    expect(noLeakIssues(trace)).toEqual([])
    expect(trace.ticks).toHaveLength(6)
    expect(outcomes).toEqual([
      { requestId: 'C-a', firstExecutionTick: 0, terminalTick: 5, cause: 'eos' },
      { requestId: 'C-b', firstExecutionTick: 1, terminalTick: 4, cause: 'client-cancel' },
      { requestId: 'C-c', firstExecutionTick: 2, terminalTick: 5, cause: 'eos' },
      { requestId: 'C-d', firstExecutionTick: 4, terminalTick: 5, cause: 'eos' },
      { requestId: 'C-e', firstExecutionTick: -1, terminalTick: 4, cause: 'timeout' },
    ])
    // C-b 取消当拍释放 2 块，C-d 借块在同拍准入并 prefill。
    const cancelRelease = trace.events.find((event) => event.requestId === 'C-b' && event.kind === 'blocks-released')!
    expect(cancelRelease).toMatchObject({ tick: 4, blocks: 2 })
    const dAdmission = trace.events.find((event) => event.requestId === 'C-d' && event.kind === 'admitted')!
    expect(dAdmission.tick).toBe(4)
    // C-e 超时离队：释放的是队列位置，不是块。
    const eLeftQueue = trace.events.find((event) => event.requestId === 'C-e' && event.kind === 'left-queue')!
    expect(eLeftQueue.tick).toBe(4)
    expect(trace.events.filter((event) => event.requestId === 'C-e' && event.kind === 'blocks-released')).toHaveLength(0)
  })

  it('walks the hand-checked baseline without injections in eight ticks', () => {
    const trace = buildTerminationTrace({ injections: [] })
    const outcomes = terminationOutcome(trace)

    expect(noLeakIssues(trace)).toEqual([])
    expect(trace.ticks).toHaveLength(8)
    expect(outcomes).toEqual([
      { requestId: 'C-a', firstExecutionTick: 0, terminalTick: 4, cause: 'eos' },
      { requestId: 'C-b', firstExecutionTick: 1, terminalTick: 4, cause: 'eos' },
      { requestId: 'C-c', firstExecutionTick: 2, terminalTick: 4, cause: 'eos' },
      { requestId: 'C-d', firstExecutionTick: 5, terminalTick: 7, cause: 'eos' },
      { requestId: 'C-e', firstExecutionTick: 6, terminalTick: 6, cause: 'eos' },
    ])
  })

  it('runs the cleanup ritual in fixed order on the terminal tick', () => {
    const trace = buildTerminationTrace()
    const bEvents = trace.events.filter((event) => event.requestId === 'C-b' && event.tick === 4).map((event) => event.kind)

    expect(bEvents).toEqual(['blocks-released', 'stream-closed', 'terminated'])
    const eEvents = trace.events.filter((event) => event.requestId === 'C-e' && event.tick === 4).map((event) => event.kind)
    expect(eEvents).toEqual(['left-queue', 'stream-closed', 'terminated'])
    // 自然完成同样走仪式：completed 之后接清理三步。
    const aEvents = trace.events.filter((event) => event.requestId === 'C-a' && event.tick === 5).map((event) => event.kind)
    expect(aEvents).toEqual(['decode-executed', 'completed', 'blocks-released', 'stream-closed', 'terminated'])
  })

  it('flags leaks when the ritual is broken', () => {
    const trace = buildTerminationTrace()
    // 手工破坏：删掉 C-b 的块释放事件，校验器必须报告泄漏。
    const broken = {
      ...trace,
      events: trace.events.filter((event) => !(event.requestId === 'C-b' && event.kind === 'blocks-released')),
    }
    const issues = noLeakIssues(broken as typeof trace)
    expect(issues.some((issue) => issue.includes('C-b'))).toBe(true)
  })

  it('does not embed measured time or utilization fields', () => {
    const serialized = JSON.stringify([
      buildTerminationTrace(),
      buildTerminationTrace({ injections: [] }),
    ])
    const keys = [...serialized.matchAll(/"([^"]+)":/g)].map((match) => match[1].toLowerCase())

    expect(keys.some((key) => /(millisecond|duration|latency|utilization|throughput|timestamp|bandwidth|ms$|gb)/.test(key))).toBe(false)
  })
})
