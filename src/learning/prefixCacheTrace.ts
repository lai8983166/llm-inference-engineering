import type { KvRequestFixture } from './kvStateTrace'

export type PrefixCachePolicy = 'no-cache' | 'prefix-cache'

export type PrefixBlockRole = 'free' | 'private' | 'shared' | 'cached'

export type PrefixCacheEventKind =
  | 'arrived'
  | 'admitted'
  | 'prefix-hit'
  | 'prefix-miss'
  | 'prefill-executed'
  | 'decode-executed'
  | 'blocks-acquired'
  | 'completed'
  | 'blocks-released'
  | 'block-evicted'

export interface PrefixCacheEvent {
  sequence: number
  tick: number
  requestId: string
  kind: PrefixCacheEventKind
  blocks?: readonly number[]
  /** 命中的共享 token 数（仅 prefix-hit）。 */
  hitTokens?: number
  /** 释放细节（仅 blocks-released）：归还 / 递减 / 转缓存。 */
  freedBlocks?: readonly number[]
  decrementedBlocks?: readonly number[]
  cachedBlocks?: readonly number[]
  evidence: 'simulated'
}

export interface PrefixBlockState {
  block: number
  role: PrefixBlockRole
  /** shared/cached 块的引用计数；private 恒 1；free 恒 0。 */
  refCount: number
  owners: readonly string[]
  usedTokens: number
  /** 转缓存的拍（LRU 依据）。 */
  cachedSinceTick?: number
}

export interface PrefixTickSnapshot {
  tick: number
  afterEventSequence: number
  freeBlocks: number
  blocks: readonly PrefixBlockState[]
  chosen: { kind: 'prefill' | 'decode'; members: readonly string[] } | null
}

export interface PrefixCacheTrace {
  policy: PrefixCachePolicy
  evidence: 'simulated'
  requests: readonly KvRequestFixture[]
  sharedPrefixTokens: ReadonlyMap<string, number>
  blockCount: number
  blockSizeTokens: number
  events: readonly PrefixCacheEvent[]
  ticks: readonly PrefixTickSnapshot[]
}

/** 第 10 章固定工作量：S-a/S-b 共享 4-token 前缀（恰 1 块，块对齐）。 */
export const prefixCacheRequests: readonly KvRequestFixture[] = [
  { id: 'S-a', arrivalStep: 0, promptTokens: 6, outputTokens: 3, maxContextTokens: 9, terminalReason: 'eos' },
  { id: 'S-b', arrivalStep: 1, promptTokens: 6, outputTokens: 2, maxContextTokens: 8, terminalReason: 'eos' },
  { id: 'S-c', arrivalStep: 2, promptTokens: 6, outputTokens: 1, maxContextTokens: 7, terminalReason: 'eos' },
  { id: 'S-d', arrivalStep: 6, promptTokens: 17, outputTokens: 1, maxContextTokens: 18, terminalReason: 'eos' },
]

export const sharedPrefixTokens: ReadonlyMap<string, number> = new Map([['S-a', 4], ['S-b', 4]])

export const prefixCachePool = { blockCount: 5, blockSizeTokens: 4 }

interface MutableRequestState {
  arrived: boolean
  admitted: boolean
  finished: boolean
  generatedTokens: number
  /** 经共享块覆盖的 token 数（命中复用或首算方自建）。 */
  sharedTokens: number
  /** 本请求写入私有块的 token 数。 */
  privateTokens: number
  heldBlocks: number[]
}

interface CacheEntry {
  block: number
  tokens: number
}

/**
 * 生成确定性前缀缓存轨迹。拍内顺序延续第 05—07 章：
 * 到达与准入（命中/首算/逐出）→ prefill 优先 → 完成释放（归还/递减/转缓存）。
 * 命中只对块对齐前缀块生效：可共享块数 = floor(共享前缀 / 块大小)。
 */
export function buildPrefixCacheTrace(
  policy: PrefixCachePolicy,
  options?: {
    requests?: readonly KvRequestFixture[]
    sharedPrefixTokens?: ReadonlyMap<string, number>
    blockCount?: number
  },
): PrefixCacheTrace {
  const requests = options?.requests ?? prefixCacheRequests
  const shared = options?.sharedPrefixTokens ?? sharedPrefixTokens
  const blockCount = options?.blockCount ?? prefixCachePool.blockCount
  const blockSizeTokens = prefixCachePool.blockSizeTokens
  for (const request of requests) {
    if (request.promptTokens + request.outputTokens > blockCount * blockSizeTokens) {
      throw new Error(`请求 ${request.id} 的完成态超出块池。`)
    }
  }

  const blocks: PrefixBlockState[] = Array.from({ length: blockCount }, (_, index) => ({
    block: index,
    role: 'free' as PrefixBlockRole,
    refCount: 0,
    owners: [] as string[],
    usedTokens: 0,
  }))
  /** 缓存索引：共享 token 数 → 块，按建立/转缓存时间升序（LRU 逐出取最早的）。 */
  const cacheIndex: CacheEntry[] = []
  const states = new Map<string, MutableRequestState>(requests.map((request) => [request.id, {
    arrived: false,
    admitted: false,
    finished: false,
    generatedTokens: 0,
    sharedTokens: 0,
    privateTokens: 0,
    heldBlocks: [],
  }]))
  const events: PrefixCacheEvent[] = []
  const ticks: PrefixTickSnapshot[] = []
  const pendingPrefills: string[] = []

  const freeBlocks = () => blocks.filter((item) => item.role === 'free').length
  const emit = (tick: number, requestId: string, kind: PrefixCacheEventKind, details: Pick<PrefixCacheEvent, 'blocks' | 'hitTokens' | 'freedBlocks' | 'decrementedBlocks' | 'cachedBlocks'> = {}) => {
    events.push({ sequence: events.length, tick, requestId, kind, ...details, evidence: 'simulated' })
  }
  const takeFree = (tick: number, requestId: string): number => {
    const blockId = blocks.findIndex((item) => item.role === 'free')
    if (blockId < 0) throw new Error(`拍 ${tick}：请求 ${requestId} 需要空闲块但没有。`)
    return blockId
  }
  const shareableBlocks = (requestId: string) => Math.floor((shared.get(requestId) ?? 0) / blockSizeTokens)
  const totalTokensOf = (state: MutableRequestState) => state.sharedTokens + state.privateTokens

  /** 压力下按 LRU 逐出 rc=0 的缓存块；rc>0 的共享块跳过，永不逐出。 */
  const tryEvict = (tick: number, requestId: string, needed: number) => {
    const evicted: number[] = []
    while (freeBlocks() < needed) {
      const entryIndex = cacheIndex.findIndex((item) => blocks[item.block].role === 'cached' && blocks[item.block].refCount === 0)
      if (entryIndex < 0) break
      const entry = cacheIndex.splice(entryIndex, 1)[0]
      const target = blocks[entry.block]
      target.role = 'free'
      target.usedTokens = 0
      target.cachedSinceTick = undefined
      evicted.push(entry.block)
    }
    if (evicted.length > 0) emit(tick, requestId, 'block-evicted', { blocks: evicted })
  }

  let tick = 0
  while ([...states.values()].some((state) => !state.finished)) {
    if (tick > 100) throw new Error('前缀缓存轨迹未能在有限拍内完成。')

    // 1. 到达与准入。
    for (const request of requests) {
      const state = states.get(request.id)!
      if (!state.arrived) {
        if (request.arrivalStep > tick) continue
        state.arrived = true
        emit(tick, request.id, 'arrived')
      } else if (state.admitted || state.finished) {
        continue
      }

      const sharedCount = policy === 'prefix-cache' ? shareableBlocks(request.id) : 0
      const prefillTokens = request.promptTokens + 1
      const privateNeed = Math.max(0, Math.ceil((prefillTokens - sharedCount * blockSizeTokens) / blockSizeTokens))
      if (freeBlocks() < privateNeed) tryEvict(tick, request.id, privateNeed)
      if (freeBlocks() < privateNeed) continue
      state.admitted = true

      if (sharedCount > 0) {
        // 索引按块对齐的累计 token 数登记：毛边前缀也对齐部分命中。
        const entry = cacheIndex.find((item) => item.tokens === sharedCount * blockSizeTokens)
        const resident = entry && (blocks[entry.block].role === 'cached' || blocks[entry.block].role === 'shared')
        if (entry && resident) {
          const target = blocks[entry.block]
          target.role = 'shared'
          target.refCount += 1
          target.owners = [...target.owners, request.id]
          state.heldBlocks.push(target.block)
          state.sharedTokens = sharedCount * blockSizeTokens
          emit(tick, request.id, 'prefix-hit', { blocks: [target.block], hitTokens: target.usedTokens })
        } else {
          const created: number[] = []
          for (let index = 0; index < sharedCount; index += 1) {
            const blockId = takeFree(tick, request.id)
            blocks[blockId] = {
              ...blocks[blockId],
              role: 'shared',
              refCount: 1,
              owners: [request.id],
              usedTokens: blockSizeTokens,
            }
            created.push(blockId)
            cacheIndex.push({ block: blockId, tokens: (index + 1) * blockSizeTokens })
            state.heldBlocks.push(blockId)
          }
          state.sharedTokens = sharedCount * blockSizeTokens
          emit(tick, request.id, 'prefix-miss', { blocks: created })
        }
      }

      const privateBlocks: number[] = []
      for (let index = 0; index < privateNeed; index += 1) {
        const blockId = takeFree(tick, request.id)
        blocks[blockId] = { ...blocks[blockId], role: 'private', refCount: 1, owners: [request.id], usedTokens: 0 }
        privateBlocks.push(blockId)
        state.heldBlocks.push(blockId)
      }
      emit(tick, request.id, 'admitted', { blocks: [...state.heldBlocks] })
      pendingPrefills.push(request.id)
    }

    // 2. 选择与执行（prefill 优先，FIFO）。
    let chosen: PrefixTickSnapshot['chosen'] = null
    const pendingId = pendingPrefills[0]
    if (pendingId !== undefined) {
      pendingPrefills.shift()
      const request = requests.find((item) => item.id === pendingId)!
      const state = states.get(pendingId)!
      state.generatedTokens = 1
      state.privateTokens = request.promptTokens + 1 - state.sharedTokens
      fillPrivate(blocks, state)
      chosen = { kind: 'prefill', members: [pendingId] }
      emit(tick, pendingId, 'prefill-executed')
    } else {
      const decodeReady = requests
        .filter((item) => {
          const state = states.get(item.id)!
          return state.admitted && !state.finished && state.generatedTokens > 0
        })
        .map((item) => item.id)
      if (decodeReady.length > 0) {
        chosen = { kind: 'decode', members: decodeReady }
        for (const requestId of decodeReady) {
          const state = states.get(requestId)!
          state.generatedTokens += 1
          state.privateTokens += 1
          const neededBlocks = Math.ceil(totalTokensOf(state) / blockSizeTokens)
          while (state.heldBlocks.length < neededBlocks) {
            const blockId = takeFree(tick, requestId)
            blocks[blockId] = { ...blocks[blockId], role: 'private', refCount: 1, owners: [requestId], usedTokens: 0 }
            state.heldBlocks.push(blockId)
            emit(tick, requestId, 'blocks-acquired', { blocks: [blockId] })
          }
          fillPrivate(blocks, state)
          emit(tick, requestId, 'decode-executed')
        }
      }
    }

    // 3. 完成释放：私有归还；共享只递减；rc=0 转缓存。
    for (const request of requests) {
      const state = states.get(request.id)!
      if (state.admitted && !state.finished && state.generatedTokens === request.outputTokens) {
        state.finished = true
        const freed: number[] = []
        const decremented: number[] = []
        const cachedNow: number[] = []
        for (const blockId of state.heldBlocks) {
          const target = blocks[blockId]
          if (target.role === 'private') {
            freed.push(blockId)
            target.role = 'free'
            target.refCount = 0
            target.owners = []
            target.usedTokens = 0
          } else if (target.role === 'shared') {
            target.refCount -= 1
            target.owners = target.owners.filter((owner) => owner !== request.id)
            decremented.push(blockId)
            if (target.refCount === 0) {
              target.role = 'cached'
              target.cachedSinceTick = tick
              cachedNow.push(blockId)
            }
          }
        }
        state.heldBlocks = []
        emit(tick, request.id, 'completed')
        emit(tick, request.id, 'blocks-released', { freedBlocks: freed, decrementedBlocks: decremented, cachedBlocks: cachedNow })
      }
    }

    ticks.push({
      tick,
      afterEventSequence: events.length - 1,
      freeBlocks: freeBlocks(),
      blocks: blocks.map((item) => ({ ...item, owners: [...item.owners] })),
      chosen,
    })
    tick += 1
  }

  const trace: PrefixCacheTrace = {
    policy,
    evidence: 'simulated',
    requests: requests.map((request) => ({ ...request })),
    sharedPrefixTokens: new Map(shared),
    blockCount,
    blockSizeTokens,
    events,
    ticks,
  }
  const issues = validatePrefixCacheTrace(trace)
  if (issues.length > 0) throw new Error(issues.join('\n'))
  return trace
}

/** 私有块按序填充：满块在前，最后一个私有块装余数。 */
function fillPrivate(blocks: PrefixBlockState[], state: MutableRequestState) {
  const privateBlockIds = state.heldBlocks.filter((blockId) => blocks[blockId].role === 'private')
  const blockSize = prefixCachePool.blockSizeTokens
  privateBlockIds.forEach((blockId, index) => {
    const remaining = state.privateTokens - index * blockSize
    blocks[blockId].usedTokens = Math.min(blockSize, Math.max(0, remaining))
  })
}

/** 校验不变量：命中只对块对齐前缀且晚于首算；逐出只针对已转缓存的块；每请求恰一次到达与完成。 */
export function validatePrefixCacheTrace(trace: PrefixCacheTrace): string[] {
  const issues: string[] = []
  for (const request of trace.requests) {
    const events = trace.events.filter((event) => event.requestId === request.id)
    if (events.filter((event) => event.kind === 'arrived').length !== 1) {
      issues.push(`请求 ${request.id} 必须且只能到达一次。`)
    }
    if (events.filter((event) => event.kind === 'completed').length !== 1) {
      issues.push(`请求 ${request.id} 必须且只能完成一次。`)
    }
    const shared = trace.sharedPrefixTokens.get(request.id) ?? 0
    const shareable = Math.floor(shared / trace.blockSizeTokens)
    const hits = events.filter((event) => event.kind === 'prefix-hit')
    const misses = events.filter((event) => event.kind === 'prefix-miss')
    if (trace.policy === 'prefix-cache' && shareable > 0 && hits.length + misses.length !== 1) {
      issues.push(`请求 ${request.id} 必须恰有一次命中或首算事件。`)
    }
    if (trace.policy === 'no-cache' && (hits.length > 0 || misses.length > 0)) {
      issues.push(`请求 ${request.id} 在无缓存策略下出现了命中/首算事件。`)
    }
    if (hits.length > 0 && shareable < 1) {
      issues.push(`请求 ${request.id} 没有块对齐前缀却发生了命中。`)
    }
    // 命中必须晚于同 token 数的首算。
    if (hits.length > 0) {
      const hit = hits[0]
      const miss = trace.events.find(
        (event) => event.kind === 'prefix-miss' && event.sequence < hit.sequence && event.tick <= hit.tick,
      )
      if (!miss) issues.push(`请求 ${request.id} 的命中没有更早的首算事件。`)
    }
  }
  for (const evicted of trace.events.filter((event) => event.kind === 'block-evicted')) {
    for (const blockId of evicted.blocks ?? []) {
      const becameCached = trace.events.some(
        (event) => event.kind === 'blocks-released' && (event.cachedBlocks ?? []).includes(blockId) && event.sequence < evicted.sequence,
      )
      if (!becameCached) issues.push(`逐出的块 ${blockId} 没有先转为缓存。`)
    }
  }
  for (const snapshot of trace.ticks) {
    if (snapshot.blocks.length !== trace.blockCount) issues.push(`拍 ${snapshot.tick} 的块数与池不一致。`)
    const freeCount = snapshot.blocks.filter((item) => item.role === 'free').length
    if (freeCount !== snapshot.freeBlocks) issues.push(`拍 ${snapshot.tick} 的空闲块计数不一致。`)
  }
  return issues
}

/** 每请求首执行/完成拍与命中标记。 */
export function prefixCacheOutcome(trace: PrefixCacheTrace) {
  return trace.requests.map((request) => {
    const events = trace.events.filter((event) => event.requestId === request.id)
    return {
      requestId: request.id,
      firstExecutionTick: events.find((event) => event.kind === 'prefill-executed' || event.kind === 'decode-executed')?.tick ?? -1,
      completionTick: events.find((event) => event.kind === 'completed')?.tick ?? -1,
      hit: events.some((event) => event.kind === 'prefix-hit'),
    }
  })
}

/** 命中率 = 命中请求数 / 应计请求数（应计 = 缓存策略下有共享前缀的请求）。 */
export function hitRate(trace: PrefixCacheTrace): { hits: number; eligible: number; rate: number } {
  const hits = trace.events.filter((event) => event.kind === 'prefix-hit').length
  const eligible = trace.policy === 'prefix-cache'
    ? trace.requests.filter((request) => (trace.sharedPrefixTokens.get(request.id) ?? 0) > 0).length
    : 0
  return { hits, eligible, rate: eligible > 0 ? hits / eligible : 0 }
}
