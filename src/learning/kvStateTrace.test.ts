import {
  buildKvTrace,
  classifyCapacityFailure,
  kvBytesForTokens,
  kvBytesPerToken,
  kvChapterRequests,
  kvCompletionTokens,
  kvPoolCapacityTokens,
  kvTeachingModel,
  primaryAllocationOf,
  validateKvTrace,
  type KvPoolInterval,
} from './kvStateTrace'
import { concurrencyChapterRequests } from './concurrencyTrace'

const strategies = ['max-reservation', 'on-demand-growth'] as const

describe('kv teaching model and byte ledger', () => {
  it('derives 128 bytes per token from the raw fixture dimensions', () => {
    const { layers, kvHeads, headDim, dtypeBytes, queryHeads } = kvTeachingModel
    expect(kvTeachingModel).toMatchObject({ layers: 4, queryHeads: 8, kvHeads: 2, headDim: 4, dtypeBytes: 2 })
    // 公式必须使用 KV heads 与 K/V 两份状态，而不是 query heads。
    expect(layers * 2 * kvHeads * headDim * dtypeBytes).toBe(128)
    expect(queryHeads).toBeGreaterThan(kvHeads)
    expect(kvBytesPerToken(kvTeachingModel)).toBe(128)
  })

  it('keeps the chapter three-request workload unchanged from chapter two', () => {
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
    expect(kvPoolCapacityTokens).toBe(24)
  })

  it('computes completion effective KV as 10, 3, 6 token units', () => {
    const [long, short, late] = kvChapterRequests
    expect(kvCompletionTokens(long)).toBe(10)
    expect(kvCompletionTokens(short)).toBe(3)
    expect(kvCompletionTokens(late)).toBe(6)
    expect(kvBytesForTokens(kvTeachingModel, 10)).toBe(1280)
    expect(kvBytesForTokens(kvTeachingModel, 3)).toBe(384)
    expect(kvBytesForTokens(kvTeachingModel, 6)).toBe(768)
  })
})

describe('deterministic kv traces', () => {
  it.each(strategies)('keeps pool intervals disjoint and fully covering for %s', (strategy) => {
    const trace = buildKvTrace(strategy)

    expect(trace.evidence).toBe('simulated')
    expect(validateKvTrace(trace)).toEqual([])
    for (const pool of trace.poolSnapshots) {
      const sorted = [...pool.intervals].sort((a, b) => a.start - b.start)
      let cursor = 0
      for (const interval of sorted) {
        expect(interval.start).toBeGreaterThanOrEqual(cursor)
        cursor = interval.start + interval.capacityTokens
      }
      expect(sorted.reduce((total, interval) => total + interval.capacityTokens, 0)).toBe(24)
    }
  })

  it.each(strategies)('keeps address publish and release ordering legal for %s', (strategy) => {
    const trace = buildKvTrace(strategy)

    for (const request of trace.requests) {
      const events = trace.events.filter((event) => event.requestId === request.id)
      for (const released of events.filter((event) => event.kind === 'released')) {
        expect(events.some(
          (event) => event.kind === 'read-complete' && event.start === released.start && event.sequence < released.sequence,
        )).toBe(true)
      }
      const kinds = events.map((event) => event.kind)
      for (let index = 0; index < kinds.length; index += 1) {
        if (kinds[index] !== 'address-published') continue
        expect(kinds.indexOf('copy-complete')).toBeLessThan(index)
        expect(kinds.indexOf('migration-start')).toBeLessThan(index)
        expect(events.findIndex((event) => event.kind === 'released' && event.start === events[index].previousStart))
          .toBeGreaterThan(index)
      }
      expect(['released', 'rejected']).toContain(kinds[kinds.length - 1])
    }
  })

  it.each(strategies)('does not embed measured time or utilization fields', (strategy) => {
    const serialized = JSON.stringify(buildKvTrace(strategy))
    const keys = [...serialized.matchAll(/"([^"]+)":/g)].map((match) => match[1].toLowerCase())

    expect(keys.some((key) => /(millisecond|duration|latency|utilization|throughput|timestamp|bandwidth|ms$|gb)/.test(key))).toBe(false)
  })

  it('max-reservation keeps one stable address per admitted request and rejects R-short on over-reservation', () => {
    const trace = buildKvTrace('max-reservation')

    const longReserved = trace.events.find((event) => event.requestId === 'R-long' && event.kind === 'reserved')!
    expect(longReserved).toMatchObject({ start: 0, tokens: 16, logicalStep: 0 })
    const longAppends = trace.events.filter((event) => event.requestId === 'R-long' && event.kind === 'appended')
    expect(longAppends.map((event) => event.tokens)).toEqual([7, 8, 9, 10])
    expect(new Set(longAppends.map((event) => event.start))).toEqual(new Set([0]))
    expect(trace.events.some((event) => event.kind === 'migration-start')).toBe(false)

    const rejection = trace.events.find((event) => event.requestId === 'R-short' && event.kind === 'rejected')!
    expect(rejection).toMatchObject({ logicalStep: 1, tokens: 16 })
    const poolAtRejection = trace.poolSnapshots[rejection.sequence]
    expect(poolAtRejection.freeTokens).toBe(8)
    // 拒绝发生时有效 KV 只有 7 个 unit（896 / 3072 bytes），空闲也还有 8 个 unit。
    expect(trace.snapshots.find(
      (snapshot) => snapshot.afterEventSequence === rejection.sequence && snapshot.requestId === 'R-long',
    )).toMatchObject({ cachedTokens: 7, effectiveBytes: 896, reservedTokens: 16 })
    expect(classifyCapacityFailure(poolAtRejection.intervals, 16, 24)).toBe('over-reservation')

    expect(trace.events.filter((event) => event.requestId === 'R-late' && event.kind === 'released'))
      .toHaveLength(1)
    const finalPool = trace.poolSnapshots[trace.poolSnapshots.length - 1]
    expect(finalPool.freeTokens).toBe(24)
  })

  it('on-demand growth admits all three requests and forces one migration when the tail is blocked', () => {
    const trace = buildKvTrace('on-demand-growth')

    for (const request of trace.requests) {
      expect(trace.events.some((event) => event.requestId === request.id && event.kind === 'released')).toBe(true)
    }
    const migrations = trace.events.filter((event) => event.kind === 'migration-start')
    expect(migrations).toHaveLength(1)
    expect(migrations[0]).toMatchObject({ requestId: 'R-long', logicalStep: 1, previousStart: 0, start: 10, tokens: 8 })

    // 双份存活：发布之前，旧区间与新区间同时属于 R-long。
    const published = trace.events.find((event) => event.kind === 'address-published')!
    const duringCopy = trace.poolSnapshots[published.sequence - 1]
    expect(duringCopy.intervals.filter((interval) => interval.owner === 'R-long').map((interval) => interval.role))
      .toEqual(expect.arrayContaining(['primary', 'migration-source']))
    expect(classifyCapacityFailure(duringCopy.intervals, 11, 24)).toBe('migration-peak')

    // R-short 在步末独立释放，R-long 的权威地址不受影响。
    const shortRelease = trace.events.find((event) => event.requestId === 'R-short' && event.kind === 'released')!
    expect(shortRelease).toMatchObject({ logicalStep: 1, start: 7, tokens: 3 })
    const afterShortRelease = trace.poolSnapshots[shortRelease.sequence]
    expect(primaryAllocationOf(afterShortRelease, 'R-long')).toMatchObject({ start: 10, capacityTokens: 8, usedTokens: 8 })
    expect(afterShortRelease.freeTokens).toBe(16)
    expect(afterShortRelease.maxContiguousFreeTokens).toBe(10)

    // 尾部空闲时按原地扩展增长，地址不变。
    const longGrows = trace.events.filter((event) => event.requestId === 'R-long' && event.kind === 'grew-in-place')
    expect(longGrows.map((event) => ({ step: event.logicalStep, start: event.start, tokens: event.tokens }))).toEqual([
      { step: 2, start: 10, tokens: 9 },
      { step: 3, start: 10, tokens: 10 },
    ])
    const lateGrows = trace.events.filter((event) => event.requestId === 'R-late' && event.kind === 'grew-in-place')
    expect(lateGrows).toHaveLength(1)

    const finalPool = trace.poolSnapshots[trace.poolSnapshots.length - 1]
    expect(finalPool.freeTokens).toBe(24)
    expect(finalPool.maxContiguousFreeTokens).toBe(24)
  })
})

describe('capacity failure classification from raw intervals', () => {
  const interval = (partial: Partial<KvPoolInterval>): KvPoolInterval => ({
    start: 0,
    capacityTokens: 0,
    usedTokens: 0,
    owner: null,
    generation: 0,
    role: 'free',
    ...partial,
  })

  it('returns null when the largest free interval already satisfies the demand', () => {
    const intervals = [interval({ start: 0, capacityTokens: 6 }), interval({ start: 10, capacityTokens: 12, owner: 'X', usedTokens: 12, role: 'primary' })]
    expect(classifyCapacityFailure(intervals, 6, 24)).toBeNull()
  })

  it('classifies enough-total-but-no-contiguous-interval as external fragmentation', () => {
    const intervals = [interval({ start: 0, capacityTokens: 10 }), interval({ start: 14, capacityTokens: 10 })]
    expect(classifyCapacityFailure(intervals, 12, 24)).toBe('external-fragmentation')
  })

  it('classifies workload-too-big-even-after-any-reclaim as effective capacity', () => {
    const intervals = [
      interval({ start: 0, capacityTokens: 20, usedTokens: 20, owner: 'X', role: 'primary' }),
      interval({ start: 20, capacityTokens: 4 }),
    ]
    expect(classifyCapacityFailure(intervals, 10, 24)).toBe('effective-capacity')
  })

  it('classifies a blocked demand covered only while both migration copies live as migration peak', () => {
    const intervals = [
      interval({ start: 0, capacityTokens: 8, usedTokens: 8, owner: 'X', role: 'primary' }),
      interval({ start: 8, capacityTokens: 8, usedTokens: 8, owner: 'X', role: 'migration-source' }),
      interval({ start: 16, capacityTokens: 8 }),
    ]
    expect(classifyCapacityFailure(intervals, 12, 24)).toBe('migration-peak')
  })

  it('classifies unused reserved space blocking admission as over-reservation', () => {
    const intervals = [
      interval({ start: 0, capacityTokens: 16, usedTokens: 6, owner: 'X', role: 'primary' }),
      interval({ start: 16, capacityTokens: 8 }),
    ]
    expect(classifyCapacityFailure(intervals, 16, 24)).toBe('over-reservation')
  })
})
