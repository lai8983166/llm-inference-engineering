import {
  buildKvTrace,
  kvChapterRequests,
  kvCompletionTokens,
  type KvRequestFixture,
} from './kvStateTrace'

export type BlockPoolPhase = 'not-arrived' | 'prefill' | 'decode' | 'finished' | 'rejected'

export type BlockPoolEventKind =
  | 'arrived'
  | 'block-allocated'
  | 'table-entry'
  | 'appended'
  | 'read-complete'
  | 'block-released'
  | 'rejected'

/** 块池几何：块大小（token unit）与块数。默认 6 块 × 4 unit = 24 unit 池。 */
export interface BlockPoolFixture {
  blockSizeTokens: number
  blockCount: number
}

/** 单个物理块的租约状态；generation 在块被跨请求复用时递增。 */
export interface BlockLease {
  block: number
  owner: string | null
  usedTokens: number
  generation: number
}

export interface BlockPoolEvent {
  sequence: number
  logicalStep: number
  requestId: string
  kind: BlockPoolEventKind
  /** 事件涉及的块编号。 */
  block?: number
  /** 事件涉及的 token 数（追加后的缓存长度或被拒申请量）。 */
  tokens?: number
  evidence: 'simulated'
}

/** 请求的块表状态：表项即持有的物理块编号序列。 */
export interface BlockTableSnapshot {
  afterEventSequence: number
  logicalStep: number
  requestId: string
  phase: BlockPoolPhase
  cachedTokens: number
  table: readonly number[]
  heldBlocks: number
  internalWasteTokens: number
  inFlightReads: number
  released: boolean
}

export interface BlockPoolSnapshot {
  afterEventSequence: number
  logicalStep: number
  blocks: readonly BlockLease[]
  freeBlocks: number
  internalWasteTokens: number
  /** 当前空闲块还能容纳的 token 数；准入只看这个量，不看物理连续性。 */
  allocatableTokensNow: number
}

export interface BlockPoolTrace {
  fixture: BlockPoolFixture
  evidence: 'simulated'
  requests: readonly KvRequestFixture[]
  events: readonly BlockPoolEvent[]
  tableSnapshots: readonly BlockTableSnapshot[]
  poolSnapshots: readonly BlockPoolSnapshot[]
}

/** 教学块池：延续第 03 章 24-unit 池，划为 6 块 × 4 unit。 */
export const blockPoolTeachingFixture: BlockPoolFixture = { blockSizeTokens: 4, blockCount: 6 }

/** 容纳 tokens 至少需要的块数。 */
export function blockCountFor(tokens: number, blockSizeTokens: number): number {
  return Math.ceil(tokens / blockSizeTokens)
}

/** 内部浪费：已保留块容量减去有效 token，每请求封顶于块大小减一。 */
export function internalWasteFor(tokens: number, blockSizeTokens: number): number {
  return blockCountFor(tokens, blockSizeTokens) * blockSizeTokens - tokens
}

export interface BlockLedgerRow {
  requestId: string
  completionTokens: number
  tableEntries: number
  internalWasteTokens: number
}

/** 任意块大小下的完成态账本：表项数与内部浪费可逐项手算复核。 */
export function blockLedgerFor(
  requests: readonly KvRequestFixture[] = kvChapterRequests,
  blockSizeTokens = blockPoolTeachingFixture.blockSizeTokens,
): BlockLedgerRow[] {
  return requests.map((request) => {
    const completionTokens = kvCompletionTokens(request)
    return {
      requestId: request.id,
      completionTokens,
      tableEntries: blockCountFor(completionTokens, blockSizeTokens),
      internalWasteTokens: internalWasteFor(completionTokens, blockSizeTokens),
    }
  })
}

interface MutableRequestState {
  phase: BlockPoolPhase
  cachedTokens: number
  generatedTokens: number
  table: number[]
  inFlightReads: number
  released: boolean
}

interface BlockPoolBuilder {
  fixture: BlockPoolFixture
  requests: readonly KvRequestFixture[]
  events: BlockPoolEvent[]
  tableSnapshots: BlockTableSnapshot[]
  poolSnapshots: BlockPoolSnapshot[]
  states: Map<string, MutableRequestState>
  blocks: BlockLease[]
  emit: (logicalStep: number, requestId: string, kind: BlockPoolEventKind, details?: Pick<BlockPoolEvent, 'block' | 'tokens'>) => void
}

function assertFixtures(fixture: BlockPoolFixture, requests: readonly KvRequestFixture[]) {
  if (!Number.isInteger(fixture.blockSizeTokens) || fixture.blockSizeTokens < 1) throw new Error('块大小必须是正整数。')
  if (!Number.isInteger(fixture.blockCount) || fixture.blockCount < 1) throw new Error('块数必须是正整数。')
  const ids = new Set<string>()
  for (const request of requests) {
    if (!request.id || ids.has(request.id)) throw new Error('请求标识必须存在且唯一。')
    if (!Number.isInteger(request.arrivalStep) || request.arrivalStep < 0) throw new Error('到达步必须是非负整数。')
    if (kvCompletionTokens(request) > fixture.blockSizeTokens * fixture.blockCount) {
      throw new Error(`请求 ${request.id} 的完成态有效 KV 超出块池。`)
    }
    ids.add(request.id)
  }
}

function makeBuilder(fixture: BlockPoolFixture, requests: readonly KvRequestFixture[]): BlockPoolBuilder {
  const builder: BlockPoolBuilder = {
    fixture,
    requests,
    events: [],
    tableSnapshots: [],
    poolSnapshots: [],
    states: new Map(requests.map((request) => [request.id, {
      phase: 'not-arrived' as BlockPoolPhase,
      cachedTokens: 0,
      generatedTokens: 0,
      table: [],
      inFlightReads: 0,
      released: false,
    }])),
    blocks: Array.from({ length: fixture.blockCount }, (_, block) => ({
      block,
      owner: null,
      usedTokens: 0,
      generation: 0,
    })),
    emit(logicalStep, requestId, kind, details = {}) {
      builder.events.push({ sequence: builder.events.length, logicalStep, requestId, kind, ...details, evidence: 'simulated' })
      const { blockSizeTokens } = builder.fixture
      const owned = builder.blocks.filter((lease) => lease.owner !== null)
      const freeBlocks = builder.blocks.filter((lease) => lease.owner === null).length
      const waste = owned.reduce((total, lease) => total + blockSizeTokens - lease.usedTokens, 0)
      builder.poolSnapshots.push({
        afterEventSequence: builder.events.length - 1,
        logicalStep,
        blocks: builder.blocks.map((lease) => ({ ...lease })),
        freeBlocks,
        internalWasteTokens: waste,
        allocatableTokensNow: freeBlocks * blockSizeTokens,
      })
      for (const request of builder.requests) {
        const state = builder.states.get(request.id)!
        builder.tableSnapshots.push({
          afterEventSequence: builder.events.length - 1,
          logicalStep,
          requestId: request.id,
          phase: state.phase,
          cachedTokens: state.cachedTokens,
          table: [...state.table],
          heldBlocks: state.table.length,
          internalWasteTokens: state.table.length > 0
            ? state.table.length * blockSizeTokens - state.cachedTokens
            : 0,
          inFlightReads: state.inFlightReads,
          released: state.released,
        })
      }
    },
  }
  return builder
}

/** 取第一个空闲块并租给 owner；generation 在复用时递增。 */
function allocateBlock(builder: BlockPoolBuilder, requestId: string): number | null {
  const lease = builder.blocks.find((item) => item.owner === null)
  if (!lease) return null
  lease.owner = requestId
  lease.usedTokens = 0
  lease.generation += 1
  return lease.block
}

function releaseBlock(builder: BlockPoolBuilder, block: number, requestId: string) {
  const lease = builder.blocks.find((item) => item.block === block)!
  if (lease.owner !== requestId) throw new Error(`块 ${block} 不属于请求 ${requestId}，不能释放。`)
  lease.owner = null
  lease.usedTokens = 0
}

function lastBlockOf(builder: BlockPoolBuilder, requestId: string): BlockLease {
  const state = builder.states.get(requestId)!
  const block = state.table.at(-1)
  if (block === undefined) throw new Error(`请求 ${requestId} 还没有任何块。`)
  return builder.blocks.find((lease) => lease.block === block)!
}

/** 完成裁决：读取结束后整块归还自己的表项，不影响其他请求。 */
function finishRequest(builder: BlockPoolBuilder, logicalStep: number, request: KvRequestFixture) {
  const state = builder.states.get(request.id)!
  state.phase = 'finished'
  builder.emit(logicalStep, request.id, 'read-complete')
  state.inFlightReads = 0
  const blocks = [...state.table]
  state.table = []
  state.released = true
  for (const block of blocks) {
    releaseBlock(builder, block, request.id)
    builder.emit(logicalStep, request.id, 'block-released', { block })
  }
}

/** 追加一个 token：块内有余位则直接写，否则分配新块并登记表项。 */
function appendToken(builder: BlockPoolBuilder, logicalStep: number, request: KvRequestFixture) {
  const state = builder.states.get(request.id)!
  const needed = state.cachedTokens + 1
  if (blockCountFor(needed, builder.fixture.blockSizeTokens) > state.table.length) {
    const block = allocateBlock(builder, request.id)
    if (block === null) {
      state.phase = 'rejected'
      builder.emit(logicalStep, request.id, 'rejected', { tokens: needed })
      return
    }
    builder.emit(logicalStep, request.id, 'block-allocated', { block })
    state.table.push(block)
    builder.emit(logicalStep, request.id, 'table-entry', { block })
  }
  const lease = lastBlockOf(builder, request.id)
  // 最后一块的用量 = 本块内 token 数：整块为 B，否则为余数。
  lease.usedTokens = needed % builder.fixture.blockSizeTokens === 0
    ? builder.fixture.blockSizeTokens
    : needed % builder.fixture.blockSizeTokens
  state.cachedTokens = needed
  builder.emit(logicalStep, request.id, 'appended', { block: lease.block, tokens: needed })
}

/**
 * 生成确定性块池轨迹。步内顺序与第 03 章一致：到达与准入 → 各驻留请求
 * decode 追加 → 完成者在读取结束后整块释放，保证两种布局可对照。
 */
export function buildBlockPoolTrace(
  options?: { fixture?: BlockPoolFixture; requests?: readonly KvRequestFixture[] },
): BlockPoolTrace {
  const fixture = options?.fixture ?? blockPoolTeachingFixture
  const requests = options?.requests ?? kvChapterRequests
  assertFixtures(fixture, requests)

  const builder = makeBuilder(fixture, requests)
  let logicalStep = 0
  while ([...builder.states.values()].some((state) => state.phase !== 'finished' && state.phase !== 'rejected')) {
    const arrivedThisStep = new Set<string>()
    const finishers: KvRequestFixture[] = []

    for (const request of requests) {
      const state = builder.states.get(request.id)!
      if (state.phase !== 'not-arrived' || request.arrivalStep > logicalStep) continue
      state.phase = 'prefill'
      builder.emit(logicalStep, request.id, 'arrived')
      arrivedThisStep.add(request.id)
      const demand = request.promptTokens + 1
      const blocksNeeded = blockCountFor(demand, fixture.blockSizeTokens)
      if (blocksNeeded > builder.blocks.filter((lease) => lease.owner === null).length) {
        state.phase = 'rejected'
        builder.emit(logicalStep, request.id, 'rejected', { tokens: demand })
        continue
      }
      for (let index = 0; index < blocksNeeded; index += 1) {
        const block = allocateBlock(builder, request.id)!
        builder.emit(logicalStep, request.id, 'block-allocated', { block })
        state.table.push(block)
        builder.emit(logicalStep, request.id, 'table-entry', { block })
      }
      const lease = lastBlockOf(builder, request.id)
      lease.usedTokens = demand % fixture.blockSizeTokens === 0 ? fixture.blockSizeTokens : demand % fixture.blockSizeTokens
      state.cachedTokens = demand
      state.generatedTokens = 1
      builder.emit(logicalStep, request.id, 'appended', { block: lease.block, tokens: demand })
      if (state.generatedTokens === request.outputTokens) {
        state.inFlightReads = 1
        finishers.push(request)
      } else {
        state.phase = 'decode'
      }
    }

    for (const request of requests) {
      const state = builder.states.get(request.id)!
      if (state.phase !== 'decode' || arrivedThisStep.has(request.id)) continue
      state.generatedTokens += 1
      appendToken(builder, logicalStep, request)
      if (state.phase === 'decode' && state.generatedTokens === request.outputTokens) {
        state.inFlightReads = 1
        finishers.push(request)
      }
    }

    for (const request of finishers) finishRequest(builder, logicalStep, request)
    logicalStep += 1
  }

  const trace: BlockPoolTrace = {
    fixture,
    evidence: 'simulated',
    requests: requests.map((request) => ({ ...request })),
    events: builder.events,
    tableSnapshots: builder.tableSnapshots,
    poolSnapshots: builder.poolSnapshots,
  }
  const issues = validateBlockPoolTrace(trace)
  if (issues.length > 0) throw new Error(issues.join('\n'))
  return trace
}

export interface LayoutComparison {
  poolTokens: number
  blockSizeTokens: number
  blockPool: {
    migrationEvents: number
    rejections: number
    peakHeldBlocks: number
    finalFreeTokens: number
  }
  contiguous: {
    migrationEvents: number
    rejections: number
    finalFreeTokens: number
  }
  /** 第 03 章 step 1 末碎片场景重放：空闲总量够、最大连续不够的申请。 */
  stepOneFragmentationProbe: {
    logicalStep: number
    demandTokens: number
    contiguousAdmissible: boolean
    blockPoolAdmissible: boolean
  }
}

/** 同一池、同一工作量下并列连续按需轨迹与块池轨迹，差异全部来自事件计数。 */
export function compareLayouts(
  options?: { poolTokens?: number; blockSizeTokens?: number; requests?: readonly KvRequestFixture[] },
): LayoutComparison {
  const poolTokens = options?.poolTokens ?? blockPoolTeachingFixture.blockSizeTokens * blockPoolTeachingFixture.blockCount
  const blockSizeTokens = options?.blockSizeTokens ?? blockPoolTeachingFixture.blockSizeTokens
  const requests = options?.requests ?? kvChapterRequests

  const blocked = buildBlockPoolTrace({
    fixture: { blockSizeTokens, blockCount: poolTokens / blockSizeTokens },
    requests,
  })
  const contiguous = buildKvTrace('on-demand-growth', { requests, poolCapacityTokens: poolTokens })

  const shortRelease = blocked.events.find((event) => event.requestId === 'R-short' && event.kind === 'block-released')!
  const blockPoolAtProbe = blocked.poolSnapshots[shortRelease.sequence]
  const demandTokens = 11
  // 连续轨迹在同一逻辑步末（R-short 释放后）的最大连续空闲。
  const contiguousStepEnd = [...contiguous.poolSnapshots]
    .filter((snapshot) => snapshot.logicalStep === shortRelease.logicalStep)
    .at(-1)!
  return {
    poolTokens,
    blockSizeTokens,
    blockPool: {
      migrationEvents: 0,
      rejections: blocked.events.filter((event) => event.kind === 'rejected').length,
      peakHeldBlocks: Math.max(...blocked.poolSnapshots.map((snapshot) => snapshot.blocks.length - snapshot.freeBlocks)),
      finalFreeTokens: blocked.poolSnapshots[blocked.poolSnapshots.length - 1].freeBlocks * blockSizeTokens,
    },
    contiguous: {
      migrationEvents: contiguous.events.filter((event) => event.kind === 'migration-start').length,
      rejections: contiguous.events.filter((event) => event.kind === 'rejected').length,
      finalFreeTokens: contiguous.poolSnapshots[contiguous.poolSnapshots.length - 1].freeTokens,
    },
    stepOneFragmentationProbe: {
      logicalStep: shortRelease.logicalStep,
      demandTokens,
      contiguousAdmissible: contiguousStepEnd.maxContiguousFreeTokens >= demandTokens,
      blockPoolAdmissible: blockPoolAtProbe.allocatableTokensNow >= demandTokens,
    },
  }
}

/** 校验块池轨迹不变量：块不超填、单所有者、表项与持有一致、释放后于读取完成、每请求一次终结。 */
export function validateBlockPoolTrace(trace: BlockPoolTrace): string[] {
  const issues: string[] = []
  const requestsById = new Map(trace.requests.map((request) => [request.id, request]))
  let previousStep = -1

  trace.events.forEach((event, index) => {
    if (event.sequence !== index) issues.push(`事件 ${index} 的序号不连续。`)
    if (event.logicalStep < previousStep) issues.push(`事件 ${event.sequence} 的逻辑步发生逆序。`)
    previousStep = event.logicalStep
    const request = requestsById.get(event.requestId)
    if (!request) issues.push(`事件 ${event.sequence} 引用了未知请求。`)
    else if (event.logicalStep < request.arrivalStep) issues.push(`请求 ${event.requestId} 在到达前产生事件。`)
  })

  const poolBefore = (sequence: number) => trace.poolSnapshots[sequence - 1]
  trace.events.forEach((event) => {
    if (event.kind === 'block-allocated' && event.sequence > 0) {
      const before = poolBefore(event.sequence).blocks.find((lease) => lease.block === event.block)!
      if (before.owner !== null) issues.push(`事件 ${event.sequence} 分配了仍被 ${before.owner} 持有的块 ${event.block}。`)
    }
    if (event.kind === 'block-released' && event.sequence > 0) {
      const before = poolBefore(event.sequence).blocks.find((lease) => lease.block === event.block)!
      if (before.owner !== event.requestId) issues.push(`事件 ${event.sequence} 释放了不属于本请求的块 ${event.block}。`)
    }
  })

  for (const pool of trace.poolSnapshots) {
    if (pool.blocks.length !== trace.fixture.blockCount) issues.push(`事件 ${pool.afterEventSequence} 后块数不等于池块数。`)
    for (const lease of pool.blocks) {
      if (lease.usedTokens < 0 || lease.usedTokens > trace.fixture.blockSizeTokens) {
        issues.push(`事件 ${pool.afterEventSequence} 后块 ${lease.block} 的用量越界。`)
      }
      if (lease.owner === null && lease.usedTokens !== 0) {
        issues.push(`事件 ${pool.afterEventSequence} 后空闲块 ${lease.block} 仍有用量。`)
      }
    }
    const freeBlocks = pool.blocks.filter((lease) => lease.owner === null).length
    if (freeBlocks !== pool.freeBlocks) issues.push(`事件 ${pool.afterEventSequence} 后空闲块计数不一致。`)
  }

  for (const request of trace.requests) {
    const events = trace.events.filter((event) => event.requestId === request.id)
    if (events.filter((event) => event.kind === 'arrived').length !== 1) {
      issues.push(`请求 ${request.id} 必须且只能到达一次。`)
    }
    const rejected = events.filter((event) => event.kind === 'rejected')
    const released = events.filter((event) => event.kind === 'block-released')
    if (rejected.length > 1) issues.push(`请求 ${request.id} 被拒绝了多次。`)
    if (rejected.length > 0 && released.length > 0) issues.push(`请求 ${request.id} 不能既释放又被拒绝。`)
    if (rejected.length === 0 && released.length === 0) issues.push(`请求 ${request.id} 必须以整块释放或拒绝终结。`)
    for (const event of released) {
      if (!events.some((item) => item.kind === 'read-complete' && item.sequence < event.sequence)) {
        issues.push(`请求 ${request.id} 在读取完成前释放了块 ${event.block}。`)
      }
    }
    for (const entry of events.filter((event) => event.kind === 'table-entry')) {
      const allocation = events.find((event) => event.kind === 'block-allocated' && event.block === entry.block)
      if (!allocation || allocation.sequence > entry.sequence) {
        issues.push(`请求 ${request.id} 的表项 ${entry.block} 未在分配后登记。`)
      }
    }
    const lastEvent = events[events.length - 1]
    if (rejected.length > 0 && lastEvent && lastEvent.kind !== 'rejected') {
      issues.push(`请求 ${request.id} 的拒绝必须是它的最后一个事件。`)
    }
    if (rejected.length === 0 && released.length > 0) {
      const finalTable = trace.tableSnapshots.find(
        (snapshot) => snapshot.requestId === request.id && snapshot.afterEventSequence === lastEvent.sequence,
      )
      if (finalTable && (finalTable.heldBlocks !== 0 || !finalTable.released)) {
        issues.push(`请求 ${request.id} 终结后仍持有块。`)
      }
    }
  }
  return issues
}
