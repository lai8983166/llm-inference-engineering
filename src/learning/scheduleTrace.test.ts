import {
  buildScheduleTrace,
  scheduleOutcome,
  scheduleTeachingPool,
  validateScheduleTrace,
  type SchedulePolicy,
} from './scheduleTrace'
import { concurrencyChapterRequests } from './concurrencyTrace'
import { kvChapterRequests, type KvRequestFixture } from './kvStateTrace'

const policies: readonly SchedulePolicy[] = ['prefill-priority', 'decode-priority']

describe('schedule teaching fixtures', () => {
  it('keeps the chapter three-request workload and the chapter four pool', () => {
    expect(scheduleTeachingPool).toEqual({ blockCount: 6, blockSizeTokens: 4 })
    expect(kvChapterRequests.map((request) => ({
      id: request.id,
      arrivalStep: request.arrivalStep,
      promptTokens: request.promptTokens,
      outputTokens: request.outputTokens,
      terminalReason: request.terminalReason,
    }))).toEqual(concurrencyChapterRequests.map((request) => ({
      id: request.id,
      arrivalStep: request.arrivalStep,
      promptTokens: request.promptTokens,
      outputTokens: request.outputTokens,
      terminalReason: request.terminalReason,
    })))
  })
})

describe('deterministic schedule traces', () => {
  it.each(policies)('keeps every invariant for %s', (policy) => {
    const trace = buildScheduleTrace(policy)

    expect(trace.evidence).toBe('simulated')
    expect(validateScheduleTrace(trace)).toEqual([])
    // 准入从不成为瓶颈：canonical 工作量在 6 块池内全部当拍通过。
    expect(trace.events.filter((event) => event.kind === 'admission-waiting')).toHaveLength(0)
    for (const tickSnapshot of trace.ticks) {
      const held = tickSnapshot.runnable.reduce((total, item) => total + item.heldBlocks, 0)
      expect(held).toBeLessThanOrEqual(6)
    }
  })

  it('walks the hand-checked prefill-priority timeline', () => {
    const trace = buildScheduleTrace('prefill-priority')
    const summary = trace.groups.map((group) => `${group.tick}:${group.kind}(${group.members.map((member) => member.requestId).join('+')})`)

    expect(summary).toEqual([
      '0:prefill(R-long)',
      '1:prefill(R-short)',
      '2:decode(R-long)',
      '3:prefill(R-late)',
      '4:decode(R-long+R-late)',
      '5:decode(R-long)',
    ])
    expect(scheduleOutcome(trace)).toEqual([
      { requestId: 'R-long', firstExecutionTick: 0, completionTick: 5 },
      { requestId: 'R-short', firstExecutionTick: 1, completionTick: 1 },
      { requestId: 'R-late', firstExecutionTick: 3, completionTick: 4 },
    ])
    // decode 组等宽：每个成员 1 个有效 token，没有 padding。
    expect(trace.groups[4].members).toEqual([
      { requestId: 'R-long', validTokens: 1 },
      { requestId: 'R-late', validTokens: 1 },
    ])
  })

  it('walks the hand-checked decode-priority timeline', () => {
    const trace = buildScheduleTrace('decode-priority')
    const summary = trace.groups.map((group) => `${group.tick}:${group.kind}(${group.members.map((member) => member.requestId).join('+')})`)

    expect(summary).toEqual([
      '0:prefill(R-long)',
      '1:decode(R-long)',
      '2:decode(R-long)',
      '3:decode(R-long)',
      '4:prefill(R-short)',
      '5:prefill(R-late)',
      '6:decode(R-late)',
    ])
    expect(scheduleOutcome(trace)).toEqual([
      { requestId: 'R-long', firstExecutionTick: 0, completionTick: 3 },
      { requestId: 'R-short', firstExecutionTick: 4, completionTick: 4 },
      { requestId: 'R-late', firstExecutionTick: 5, completionTick: 6 },
    ])
  })

  it('recomputes the runnable set each tick with per-cause labels', () => {
    const trace = buildScheduleTrace('prefill-priority')
    const at = (tick: number) => Object.fromEntries(
      trace.ticks[tick].runnable.map((item) => [item.requestId, item.state]),
    )

    // 快照是拍后语义：t0 末 R-long 已 prefill，成为可 decode。
    expect(at(0)).toEqual({ 'R-long': 'runnable', 'R-short': 'not-arrived', 'R-late': 'not-arrived' })
    expect(at(2)).toEqual({ 'R-long': 'runnable', 'R-short': 'finished', 'R-late': 'not-arrived' })
    // t3 的选择是 R-late 的 prefill：R-long 让位一拍。
    expect(trace.ticks[3].chosen).toMatchObject({ kind: 'prefill', members: [{ requestId: 'R-late', validTokens: 4 }] })
    expect(trace.ticks[4].chosen).toMatchObject({ kind: 'decode' })

    // decode 优先下，已准入未 prefill 的请求以“待 prefill”状态可见。
    const decodeFirst = buildScheduleTrace('decode-priority')
    const decodeAt = (tick: number) => Object.fromEntries(
      decodeFirst.ticks[tick].runnable.map((item) => [item.requestId, item.state]),
    )
    expect(decodeAt(1)).toEqual({ 'R-long': 'runnable', 'R-short': 'waiting-prefill', 'R-late': 'not-arrived' })
    expect(decodeAt(3)).toEqual({ 'R-long': 'finished', 'R-short': 'waiting-prefill', 'R-late': 'waiting-prefill' })
  })

  it('retries admission every tick when blocks are insufficient', () => {
    const requests: KvRequestFixture[] = [
      { id: 'S-a', arrivalStep: 0, promptTokens: 7, outputTokens: 1, maxContextTokens: 8, terminalReason: 'eos' },
      { id: 'S-b', arrivalStep: 0, promptTokens: 7, outputTokens: 1, maxContextTokens: 8, terminalReason: 'eos' },
    ]
    // 4 块池：两个请求各需 2 块 prefill，但完成前并发 4 块恰好放下；
    // 改成 3 块池则第二个请求必须等第一个完成释放后再准入。
    const tight = buildScheduleTrace('prefill-priority', { requests, blockCount: 3 })
    const waiting = tight.events.filter((event) => event.kind === 'admission-waiting')
    expect(waiting.length).toBeGreaterThan(0)
    expect(waiting[0]).toMatchObject({ requestId: 'S-b', blocks: 2 })
    expect(tight.events.find((event) => event.requestId === 'S-b' && event.kind === 'admitted')!.tick)
      .toBeGreaterThan(waiting[0].tick)
    expect(validateScheduleTrace(tight)).toEqual([])
  })

  it('does not embed measured time or utilization fields', () => {
    const serialized = JSON.stringify(policies.map((policy) => buildScheduleTrace(policy)))
    const keys = [...serialized.matchAll(/"([^"]+)":/g)].map((match) => match[1].toLowerCase())

    expect(keys.some((key) => /(millisecond|duration|latency|utilization|throughput|timestamp|bandwidth|ms$|gb)/.test(key))).toBe(false)
  })
})
