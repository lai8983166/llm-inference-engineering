import {
  blockCountFor,
  blockLedgerFor,
  blockPoolTeachingFixture,
  buildBlockPoolTrace,
  compareLayouts,
  internalWasteFor,
  validateBlockPoolTrace,
} from './blockPoolTrace'
import { concurrencyChapterRequests } from './concurrencyTrace'
import { buildKvTrace, kvChapterRequests, type KvRequestFixture } from './kvStateTrace'

describe('block pool teaching fixture and ledger', () => {
  it('keeps the chapter three workload and pool, divided into six four-unit blocks', () => {
    expect(blockPoolTeachingFixture).toEqual({ blockSizeTokens: 4, blockCount: 6 })
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

  it('computes completion ledgers as 3/1/2 blocks with 2/1/2 units of internal waste', () => {
    expect(blockCountFor(10, 4)).toBe(3)
    expect(blockCountFor(3, 4)).toBe(1)
    expect(blockCountFor(6, 4)).toBe(2)
    expect(blockLedgerFor()).toEqual([
      { requestId: 'R-long', completionTokens: 10, tableEntries: 3, internalWasteTokens: 2 },
      { requestId: 'R-short', completionTokens: 3, tableEntries: 1, internalWasteTokens: 1 },
      { requestId: 'R-late', completionTokens: 6, tableEntries: 2, internalWasteTokens: 2 },
    ])
    expect(internalWasteFor(10, 4)).toBe(2)
  })

  it('sweeps block sizes between the two degenerate extremes', () => {
    const entriesFor = (blockSize: number) => blockLedgerFor(kvChapterRequests, blockSize)
      .reduce((total, row) => total + row.tableEntries, 0)
    const wasteFor = (blockSize: number) => blockLedgerFor(kvChapterRequests, blockSize)
      .reduce((total, row) => total + row.internalWasteTokens, 0)

    expect(entriesFor(1)).toBe(19)
    expect(wasteFor(1)).toBe(0)
    expect(entriesFor(2)).toBe(10)
    expect(wasteFor(2)).toBe(1)
    expect(entriesFor(4)).toBe(6)
    expect(wasteFor(4)).toBe(5)
    expect(entriesFor(8)).toBe(4)
    expect(wasteFor(8)).toBe(13)
    // B=24 退化为单一连续区间：每个请求独占整池。
    expect(entriesFor(24)).toBe(3)
    expect(wasteFor(24)).toBe(53)
  })
})

describe('deterministic block pool trace', () => {
  it('walks the canonical hand-checked event sequence', () => {
    const trace = buildBlockPoolTrace()

    expect(trace.evidence).toBe('simulated')
    expect(validateBlockPoolTrace(trace)).toEqual([])
    const summary = trace.events.map((event) => `${event.requestId}:${event.kind}${event.block !== undefined ? `@B${event.block}` : ''}`)
    expect(summary).toEqual([
      'R-long:arrived',
      'R-long:block-allocated@B0', 'R-long:table-entry@B0',
      'R-long:block-allocated@B1', 'R-long:table-entry@B1',
      'R-long:appended@B1',
      'R-short:arrived',
      'R-short:block-allocated@B2', 'R-short:table-entry@B2',
      'R-short:appended@B2',
      'R-long:appended@B1',
      'R-short:read-complete', 'R-short:block-released@B2',
      'R-long:block-allocated@B2', 'R-long:table-entry@B2', 'R-long:appended@B2',
      'R-late:arrived',
      'R-late:block-allocated@B3', 'R-late:table-entry@B3',
      'R-late:block-allocated@B4', 'R-late:table-entry@B4',
      'R-late:appended@B4',
      'R-long:appended@B2',
      'R-long:read-complete', 'R-long:block-released@B0', 'R-long:block-released@B1', 'R-long:block-released@B2',
      'R-late:appended@B4',
      'R-late:read-complete', 'R-late:block-released@B3', 'R-late:block-released@B4',
    ])
  })

  it('reuses the block freed by R-short and never migrates', () => {
    const trace = buildBlockPoolTrace()

    const shortRelease = trace.events.find((event) => event.requestId === 'R-short' && event.kind === 'block-released')!
    expect(shortRelease).toMatchObject({ logicalStep: 1, block: 2 })
    const reallocation = trace.events.find((event) => event.requestId === 'R-long' && event.kind === 'block-allocated' && event.block === 2)!
    expect(reallocation.logicalStep).toBe(2)
    expect(reallocation.sequence).toBeGreaterThan(shortRelease.sequence)
    // 复用递增世代：B2 的租约世代从 1（R-short）变为 2（R-long）。
    const afterReuse = trace.poolSnapshots[reallocation.sequence]
    expect(afterReuse.blocks.find((lease) => lease.block === 2)).toMatchObject({ owner: 'R-long', generation: 2, usedTokens: 0 })

    // token 8 与 10 是块内追加：不发生任何分配。
    const appends = trace.events.filter((event) => event.requestId === 'R-long' && event.kind === 'appended')
    expect(appends.map((event) => ({ block: event.block, tokens: event.tokens }))).toEqual([
      { block: 1, tokens: 7 },
      { block: 1, tokens: 8 },
      { block: 2, tokens: 9 },
      { block: 2, tokens: 10 },
    ])
  })

  it('releases whole blocks independently and ends with an empty pool', () => {
    const trace = buildBlockPoolTrace()
    const finalPool = trace.poolSnapshots[trace.poolSnapshots.length - 1]

    expect(finalPool.freeBlocks).toBe(6)
    expect(finalPool.allocatableTokensNow).toBe(24)
    expect(finalPool.internalWasteTokens).toBe(0)
    const finalLongTable = trace.tableSnapshots.filter((snapshot) => snapshot.requestId === 'R-long').at(-1)!
    expect(finalLongTable).toMatchObject({ phase: 'finished', heldBlocks: 0, released: true, internalWasteTokens: 0 })
    const completionTable = trace.tableSnapshots.find(
      (snapshot) => snapshot.requestId === 'R-long' && snapshot.cachedTokens === 10,
    )!
    expect(completionTable.table).toEqual([0, 1, 2])
    expect(completionTable.internalWasteTokens).toBe(2)
  })

  it('keeps peak concurrency within the pool and admits every request', () => {
    const trace = buildBlockPoolTrace()
    const peak = Math.max(...trace.poolSnapshots.map((snapshot) => snapshot.blocks.length - snapshot.freeBlocks))

    expect(peak).toBe(5)
    expect(trace.events.filter((event) => event.kind === 'rejected')).toHaveLength(0)
    expect(trace.events.some((event) => event.kind === 'read-complete')).toBe(true)
  })

  it('does not embed measured time or utilization fields', () => {
    const serialized = JSON.stringify(buildBlockPoolTrace())
    const keys = [...serialized.matchAll(/"([^"]+)":/g)].map((match) => match[1].toLowerCase())

    expect(keys.some((key) => /(millisecond|duration|latency|utilization|throughput|timestamp|bandwidth|ms$|gb)/.test(key))).toBe(false)
  })

  it('rejects a request when no free block can serve it', () => {
    const requests: KvRequestFixture[] = [
      { id: 'P-a', arrivalStep: 0, promptTokens: 3, outputTokens: 2, maxContextTokens: 8, terminalReason: 'eos' },
      { id: 'P-b', arrivalStep: 1, promptTokens: 4, outputTokens: 1, maxContextTokens: 8, terminalReason: 'eos' },
    ]
    const trace = buildBlockPoolTrace({ fixture: { blockSizeTokens: 4, blockCount: 2 }, requests })

    const rejection = trace.events.find((event) => event.kind === 'rejected')!
    expect(rejection).toMatchObject({ requestId: 'P-b', logicalStep: 1 })
    expect(validateBlockPoolTrace(trace)).toEqual([])
  })
})

describe('layout comparison against the contiguous baseline', () => {
  it('replays the chapter three fragmentation scenario with a third outcome', () => {
    const comparison = compareLayouts()
    const contiguous = buildKvTrace('on-demand-growth')

    expect(comparison.blockPool.migrationEvents).toBe(0)
    expect(comparison.blockPool.rejections).toBe(0)
    expect(comparison.blockPool.peakHeldBlocks).toBe(5)
    expect(comparison.blockPool.finalFreeTokens).toBe(24)
    expect(comparison.contiguous.migrationEvents).toBe(
      contiguous.events.filter((event) => event.kind === 'migration-start').length,
    )
    expect(comparison.contiguous.migrationEvents).toBeGreaterThan(0)
    expect(comparison.contiguous.finalFreeTokens).toBe(24)

    // step 1 末：连续布局空闲 16 但最大连续 10，11-unit 申请失败；
    // 块池 4 个空闲块可容纳 16 unit，同一申请可满足。
    expect(comparison.stepOneFragmentationProbe).toEqual({
      logicalStep: 1,
      demandTokens: 11,
      contiguousAdmissible: false,
      blockPoolAdmissible: true,
    })
  })
})
