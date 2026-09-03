import {
  buildPrefixCacheTrace,
  hitRate,
  prefixCacheOutcome,
  prefixCachePool,
  prefixCacheRequests,
  validatePrefixCacheTrace,
} from './prefixCacheTrace'

describe('prefix cache teaching fixtures', () => {
  it('keeps a five-block pool and a block-aligned shared prefix', () => {
    expect(prefixCachePool).toEqual({ blockCount: 5, blockSizeTokens: 4 })
    expect(prefixCacheRequests.map((request) => [request.id, request.arrivalStep, request.promptTokens, request.outputTokens])).toEqual([
      ['S-a', 0, 6, 3],
      ['S-b', 1, 6, 2],
      ['S-c', 2, 6, 1],
      ['S-d', 6, 17, 1],
    ])
  })
})

describe('deterministic prefix cache traces', () => {
  it('walks the hand-checked no-cache baseline in seven ticks', () => {
    const trace = buildPrefixCacheTrace('no-cache')
    const outcome = prefixCacheOutcome(trace)

    expect(validatePrefixCacheTrace(trace)).toEqual([])
    expect(trace.ticks).toHaveLength(7)
    // S-c 排队一拍：t2 空闲 1 < 需 2，t3 借 S-b 归还的 2 块准入。
    expect(outcome).toEqual([
      { requestId: 'S-a', firstExecutionTick: 0, completionTick: 4, hit: false },
      { requestId: 'S-b', firstExecutionTick: 1, completionTick: 2, hit: false },
      { requestId: 'S-c', firstExecutionTick: 3, completionTick: 3, hit: false },
      { requestId: 'S-d', firstExecutionTick: 6, completionTick: 6, hit: false },
    ])
    expect(trace.events.filter((event) => event.kind === 'prefix-hit' || event.kind === 'prefix-miss' || event.kind === 'block-evicted')).toHaveLength(0)
    expect(hitRate(trace)).toEqual({ hits: 0, eligible: 0, rate: 0 })
  })

  it('walks the hand-checked prefix-cache timeline with hit, refcount, and eviction', () => {
    const trace = buildPrefixCacheTrace('prefix-cache')
    const outcome = prefixCacheOutcome(trace)

    expect(validatePrefixCacheTrace(trace)).toEqual([])
    expect(trace.ticks).toHaveLength(7)
    // 命中让 S-b 只新拿 1 块：S-c 在 t2 当拍准入（基线 t3）。
    expect(outcome).toEqual([
      { requestId: 'S-a', firstExecutionTick: 0, completionTick: 4, hit: false },
      { requestId: 'S-b', firstExecutionTick: 1, completionTick: 3, hit: true },
      { requestId: 'S-c', firstExecutionTick: 2, completionTick: 2, hit: false },
      { requestId: 'S-d', firstExecutionTick: 6, completionTick: 6, hit: false },
    ])

    const hit = trace.events.find((event) => event.kind === 'prefix-hit')!
    expect(hit).toMatchObject({ requestId: 'S-b', tick: 1, blocks: [0], hitTokens: 4 })
    const miss = trace.events.find((event) => event.kind === 'prefix-miss')!
    expect(miss).toMatchObject({ requestId: 'S-a', tick: 0, blocks: [0] })

    // t3 S-b 完成：私有块归还、共享块 B0 只递减 rc 2→1。
    const bRelease = trace.events.find((event) => event.requestId === 'S-b' && event.kind === 'blocks-released')!
    expect(bRelease).toMatchObject({ tick: 3, freedBlocks: [2], decrementedBlocks: [0], cachedBlocks: [] })
    // t4 S-a 完成：B0 rc 1→0 转缓存，不归还。
    const aRelease = trace.events.find((event) => event.requestId === 'S-a' && event.kind === 'blocks-released')!
    expect(aRelease).toMatchObject({ tick: 4, cachedBlocks: [0] })
    expect(aRelease.decrementedBlocks).toContain(0)
    expect(aRelease.freedBlocks).not.toContain(0)

    // t6 S-d 需 5 块 > 空闲 4：LRU 逐出缓存块 B0，随后 S-d 拿满 5 块（含 B0）。
    const eviction = trace.events.find((event) => event.kind === 'block-evicted')!
    expect(eviction).toMatchObject({ tick: 6, blocks: [0] })
    const dAdmission = trace.events.find((event) => event.requestId === 'S-d' && event.kind === 'admitted')!
    expect(dAdmission.tick).toBe(6)
    expect(dAdmission.blocks).toEqual([0, 1, 2, 3, 4])
    expect(hitRate(trace)).toEqual({ hits: 1, eligible: 2, rate: 0.5 })
  })

  it('tracks the shared block lifecycle through the tick snapshots', () => {
    const trace = buildPrefixCacheTrace('prefix-cache')
    const block0 = (tick: number) => trace.ticks[tick].blocks[0]

    expect(block0(0)).toMatchObject({ role: 'shared', refCount: 1, owners: ['S-a'], usedTokens: 4 })
    expect(block0(1)).toMatchObject({ role: 'shared', refCount: 2, owners: ['S-a', 'S-b'] })
    expect(block0(3)).toMatchObject({ role: 'shared', refCount: 1, owners: ['S-a'] })
    expect(block0(4)).toMatchObject({ role: 'cached', refCount: 0, owners: [], usedTokens: 4 })
    expect(trace.ticks[5].blocks[0]).toMatchObject({ role: 'cached' })
    // t6 快照为拍后语义：S-d 在同拍完成并释放，B0 回到空闲。
    expect(trace.ticks[6].blocks[0]).toMatchObject({ role: 'free', refCount: 0 })
  })

  it('only shares block-aligned prefix tokens', () => {
    // 毛边前缀：5-token 共享前缀只共享 1 块，第 5 个 token 私有。
    const ragged = buildPrefixCacheTrace('prefix-cache', {
      sharedPrefixTokens: new Map([['S-a', 5], ['S-b', 5]]),
    })
    const miss = ragged.events.find((event) => event.kind === 'prefix-miss')!
    expect(miss.blocks).toHaveLength(1)
    const hit = ragged.events.find((event) => event.kind === 'prefix-hit')!
    expect(hit.hitTokens).toBe(4)
  })

  it('does not embed measured time or utilization fields', () => {
    const serialized = JSON.stringify([buildPrefixCacheTrace('no-cache'), buildPrefixCacheTrace('prefix-cache')])
    const keys = [...serialized.matchAll(/"([^"]+)":/g)].map((match) => match[1].toLowerCase())

    expect(keys.some((key) => /(millisecond|duration|latency|utilization|throughput|timestamp|bandwidth|ms$|gb)/.test(key))).toBe(false)
  })
})
