import {
  buildOverloadTrace,
  overloadRequests,
  overloadSummary,
  overloadTeachingPool,
  validateOverloadTrace,
} from './overloadTrace'

describe('overload teaching fixtures', () => {
  it('keeps the chapter three pool and bursts it to empty at t1', () => {
    expect(overloadTeachingPool).toEqual({ blockCount: 6, blockSizeTokens: 4 })
    expect(overloadRequests.map((request) => [request.id, request.arrivalStep, request.promptTokens, request.outputTokens])).toEqual([
      ['P-a', 0, 5, 3],
      ['P-b', 0, 5, 3],
      ['P-c', 1, 5, 3],
      ['P-d', 2, 3, 2],
    ])
  })
})

describe('deterministic overload traces', () => {
  it('queues unboundedly and serves everyone in seven ticks', () => {
    const trace = buildOverloadTrace('queue')
    const summary = overloadSummary(trace)

    expect(validateOverloadTrace(trace)).toEqual([])
    expect(summary).toMatchObject({
      totalTicks: 7,
      rejected: [],
      preempted: [],
      recomputeTokenUnits: 0,
      maxQueueDepth: 1,
    })
    expect(summary.outcomes).toEqual([
      { requestId: 'P-a', firstExecutionTick: 0, completionTick: 4 },
      { requestId: 'P-b', firstExecutionTick: 1, completionTick: 4 },
      { requestId: 'P-c', firstExecutionTick: 2, completionTick: 4 },
      { requestId: 'P-d', firstExecutionTick: 5, completionTick: 6 },
    ])
    // P-d 从 t2 排队到 t4，t5 才准入并执行。
    expect(trace.events.filter((event) => event.requestId === 'P-d' && event.kind === 'queued')).toHaveLength(3)
  })

  it('rejects at full with watermark zero and finishes three requests in five ticks', () => {
    const trace = buildOverloadTrace('reject')
    const summary = overloadSummary(trace)

    expect(validateOverloadTrace(trace)).toEqual([])
    expect(summary).toMatchObject({
      totalTicks: 5,
      rejected: ['P-d'],
      preempted: [],
      recomputeTokenUnits: 0,
      maxQueueDepth: 0,
    })
    const rejection = trace.events.find((event) => event.kind === 'rejected')!
    expect(rejection).toMatchObject({ requestId: 'P-d', tick: 2, neededBlocks: 1, freeBlocks: 0, watermark: 0 })
    expect(summary.outcomes.find((item) => item.requestId === 'P-c')).toMatchObject({ firstExecutionTick: 2, completionTick: 4 })
  })

  it('flips the same-instant verdict with watermark one', () => {
    const trace = buildOverloadTrace('reject', { watermarkBlocks: 1 })
    const summary = overloadSummary(trace)

    expect(validateOverloadTrace(trace)).toEqual([])
    expect(summary.rejected).toEqual(['P-c'])
    expect(summary.outcomes.find((item) => item.requestId === 'P-d')).toMatchObject({ firstExecutionTick: 2, completionTick: 3 })
    expect(summary.outcomes.find((item) => item.requestId === 'P-c')).toMatchObject({ firstExecutionTick: -1, completionTick: -1 })
    const cRejection = trace.events.find((event) => event.requestId === 'P-c' && event.kind === 'rejected')!
    expect(cRejection).toMatchObject({ tick: 1, neededBlocks: 2, freeBlocks: 2, watermark: 1 })
  })

  it('preempts the newest generator and resumes via recompute', () => {
    const trace = buildOverloadTrace('preempt-recompute')
    const summary = overloadSummary(trace)

    expect(validateOverloadTrace(trace)).toEqual([])
    expect(summary).toMatchObject({
      totalTicks: 7,
      rejected: [],
      preempted: ['P-b'],
      recomputeTokenUnits: 6,
      maxQueueDepth: 1,
    })
    const preemption = trace.events.find((event) => event.kind === 'preempted')!
    expect(preemption).toMatchObject({ requestId: 'P-b', tick: 2, blocks: 2, generatedTokens: 1 })
    const recompute = trace.events.find((event) => event.kind === 'recompute-prefill')!
    expect(recompute).toMatchObject({ requestId: 'P-b', tick: 5, recomputeTokens: 6 })
    // 抢占买到的是 P-d 的提前入场（首执行 t3、t4 完成），
    // 代价是重计算 6 unit，且在跑者全部从 t4 推迟到 t6 完成。
    expect(summary.outcomes.find((item) => item.requestId === 'P-d')).toMatchObject({ firstExecutionTick: 3, completionTick: 4 })
    expect(summary.outcomes.find((item) => item.requestId === 'P-b')).toMatchObject({ firstExecutionTick: 1, completionTick: 6 })
    expect(summary.outcomes.find((item) => item.requestId === 'P-a')).toMatchObject({ completionTick: 6 })
    // 抢占只发生在空闲不足时：P-d 到达时空闲 0。
    expect(trace.ticks[1].freeBlocks).toBe(0)
  })

  it('does not embed measured time or utilization fields', () => {
    const serialized = JSON.stringify([
      buildOverloadTrace('queue'),
      buildOverloadTrace('reject'),
      buildOverloadTrace('reject', { watermarkBlocks: 1 }),
      buildOverloadTrace('preempt-recompute'),
    ])
    const keys = [...serialized.matchAll(/"([^"]+)":/g)].map((match) => match[1].toLowerCase())

    expect(keys.some((key) => /(millisecond|duration|latency|utilization|throughput|timestamp|bandwidth|ms$|gb)/.test(key))).toBe(false)
  })
})
