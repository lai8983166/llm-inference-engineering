import {
  assessTraceAudit,
  buildStrategyTrace,
  concurrencyChapterRequests,
  validateStrategyTrace,
  type ConcurrencyStrategy,
  type TraceAuditCategory,
} from './concurrencyTrace'

const strategies: readonly ConcurrencyStrategy[] = ['serial', 'independent-loops', 'static-batch']

describe('deterministic concurrency traces', () => {
  it.each(strategies)('keeps arrivals and logical work unchanged for %s', (strategy) => {
    const trace = buildStrategyTrace(strategy)

    expect(trace.evidence).toBe('simulated')
    expect(trace.requests).toEqual(concurrencyChapterRequests)
    expect(trace.events.filter((event) => event.kind === 'arrived').map((event) => ({
      requestId: event.requestId,
      logicalStep: event.logicalStep,
    }))).toEqual(concurrencyChapterRequests.map((request) => ({
      requestId: request.id,
      logicalStep: request.arrivalStep,
    })))
    expect(trace.events.filter((event) => event.kind === 'device-complete')).toHaveLength(
      concurrencyChapterRequests.reduce((total, request) => total + request.outputTokens, 0),
    )
    expect(validateStrategyTrace(trace)).toEqual([])
  })

  it('keeps request state independent when a static-batch member finishes early', () => {
    const trace = buildStrategyTrace('static-batch')
    const shortCompletion = trace.events.find((event) => event.requestId === 'R-short' && event.kind === 'request-complete')!
    const snapshots = trace.snapshots.filter((snapshot) => snapshot.afterEventSequence === shortCompletion.sequence)

    expect(snapshots.find((snapshot) => snapshot.requestId === 'R-short')).toMatchObject({
      status: 'done',
      phase: 'finished',
      generatedTokens: 1,
    })
    expect(snapshots.find((snapshot) => snapshot.requestId === 'R-long')).toMatchObject({
      status: 'ready',
      phase: 'prefill',
      generatedTokens: 1,
      released: false,
    })
  })

  it('records prompt padding, inactive decode slots, and a late request outside the closed batch', () => {
    const trace = buildStrategyTrace('static-batch')
    const prefill = trace.groups.find((group) => group.phase === 'prefill' && group.members.length === 2)!
    const decode = trace.groups.find((group) => group.phase === 'decode')!

    expect(prefill.members).toEqual([
      { requestId: 'R-long', slotState: 'active', validTokens: 6, paddingTokens: 0 },
      { requestId: 'R-short', slotState: 'active', validTokens: 2, paddingTokens: 4 },
    ])
    expect(decode.members.find((member) => member.requestId === 'R-short')).toEqual({
      requestId: 'R-short',
      slotState: 'inactive',
      validTokens: 0,
      paddingTokens: 0,
    })
    expect(trace.events).toContainEqual(expect.objectContaining({ requestId: 'R-late', kind: 'batch-wait' }))
  })

  it('does not embed measured time or utilization fields in the teaching model', () => {
    const serialized = JSON.stringify(strategies.map((strategy) => buildStrategyTrace(strategy)))
    const keys = [...serialized.matchAll(/"([^"]+)":/g)].map((match) => match[1].toLowerCase())

    expect(keys.some((key) => /(millisecond|duration|latency|utilization|throughput|timestamp|ms$)/.test(key))).toBe(false)
  })

  it('checks event classifications without inventing a performance score', () => {
    const selections: Record<string, TraceAuditCategory> = {
      E0: 'not-runnable',
      E1: 'ready-not-selected',
      E2: 'valid-device-work',
      E3: 'padding-or-inactive',
    }

    expect(assessTraceAudit(selections)).toMatchObject({ correct: 4, total: 4 })
    expect(assessTraceAudit({ ...selections, E1: 'not-runnable' }).results[1]).toMatchObject({
      eventId: 'E1',
      correct: false,
      expected: 'ready-not-selected',
    })
  })
})
