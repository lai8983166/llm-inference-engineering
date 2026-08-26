import {
  blockCountFor,
  blockPoolTeachingFixture,
} from './blockPoolTrace'
import { kvChapterRequests, kvCompletionTokens, type KvRequestFixture } from './kvStateTrace'

export type SchedulePolicy = 'prefill-priority' | 'decode-priority'
export type ScheduleGroupKind = 'prefill' | 'decode'
export type RunnableState = 'not-arrived' | 'waiting-prefill' | 'waiting-blocks' | 'runnable' | 'finished'

export type ScheduleEventKind =
  | 'arrived'
  | 'admitted'
  | 'admission-waiting'
  | 'prefill-executed'
  | 'decode-executed'
  | 'completed'
  | 'blocks-acquired'
  | 'blocks-released'

export interface ScheduleGroupMember {
  requestId: string
  validTokens: number
}

/** 一拍内被选中的那份设备工作：prefill 单请求或 decode 组。 */
export interface ScheduleGroup {
  tick: number
  kind: ScheduleGroupKind
  members: readonly ScheduleGroupMember[]
}

export interface ScheduleEvent {
  sequence: number
  tick: number
  requestId: string
  kind: ScheduleEventKind
  /** 该事件涉及的块数（准入、释放）。 */
  blocks?: number
  /** decode 组执行时的成员数。 */
  groupSize?: number
  evidence: 'simulated'
}

/** 逐拍快照：每个请求的可运行状态、持有块与本拍选择。 */
export interface ScheduleTickSnapshot {
  tick: number
  afterEventSequence: number
  runnable: readonly {
    requestId: string
    state: RunnableState
    heldBlocks: number
    cachedTokens: number
  }[]
  chosen: ScheduleGroup | null
  pendingPrefills: readonly string[]
}

export interface ScheduleTrace {
  policy: SchedulePolicy
  evidence: 'simulated'
  requests: readonly KvRequestFixture[]
  blockCount: number
  blockSizeTokens: number
  events: readonly ScheduleEvent[]
  groups: readonly ScheduleGroup[]
  ticks: readonly ScheduleTickSnapshot[]
}

/** 教学调度池：延续第 04 章 6 块 × 4 unit。 */
export const scheduleTeachingPool = {
  blockCount: blockPoolTeachingFixture.blockCount,
  blockSizeTokens: blockPoolTeachingFixture.blockSizeTokens,
}

interface MutableRequestState {
  arrived: boolean
  admitted: boolean
  generatedTokens: number
  cachedTokens: number
  heldBlocks: number
  finished: boolean
}

function makeStates(requests: readonly KvRequestFixture[]): Map<string, MutableRequestState> {
  return new Map(requests.map((request) => [request.id, {
    arrived: false,
    admitted: false,
    generatedTokens: 0,
    cachedTokens: 0,
    heldBlocks: 0,
    finished: false,
  }]))
}

function assertFixtures(requests: readonly KvRequestFixture[], blockCount: number) {
  const ids = new Set<string>()
  for (const request of requests) {
    if (!request.id || ids.has(request.id)) throw new Error('请求标识必须存在且唯一。')
    if (kvCompletionTokens(request) > blockCount * scheduleTeachingPool.blockSizeTokens) {
      throw new Error(`请求 ${request.id} 的完成态超出块池。`)
    }
    ids.add(request.id)
  }
}

/**
 * 生成确定性调度轨迹。每拍至多一份设备工作，拍内顺序：
 * 到达与准入 → 可运行集合 → 按策略选择 → 执行 → 完成者释放块。
 */
export function buildScheduleTrace(
  policy: SchedulePolicy,
  options?: { requests?: readonly KvRequestFixture[]; blockCount?: number },
): ScheduleTrace {
  const requests = options?.requests ?? kvChapterRequests
  const blockCount = options?.blockCount ?? scheduleTeachingPool.blockCount
  const blockSizeTokens = scheduleTeachingPool.blockSizeTokens
  assertFixtures(requests, blockCount)

  const states = makeStates(requests)
  const events: ScheduleEvent[] = []
  const groups: ScheduleGroup[] = []
  const ticks: ScheduleTickSnapshot[] = []
  const pendingPrefills: string[] = []
  const heldTotal = () => [...states.values()].reduce((total, state) => total + state.heldBlocks, 0)
  const emit = (tick: number, requestId: string, kind: ScheduleEventKind, details: Pick<ScheduleEvent, 'blocks' | 'groupSize'> = {}) => {
    events.push({ sequence: events.length, tick, requestId, kind, ...details, evidence: 'simulated' })
  }

  let tick = 0
  while ([...states.values()].some((state) => !state.finished)) {
    if (tick > 200) throw new Error('调度轨迹未能在有限拍内完成：请检查块池是否足以让所有请求准入。')
    // 1. 到达与准入：prompt+1 个 token 所需块数不超过空闲块即通过；
    //    已到达未准入的请求每拍重试。
    for (const request of requests) {
      const state = states.get(request.id)!
      if (!state.arrived) {
        if (request.arrivalStep > tick) continue
        state.arrived = true
        emit(tick, request.id, 'arrived')
      } else if (state.admitted) {
        continue
      }
      const neededBlocks = blockCountFor(request.promptTokens + 1, blockSizeTokens)
      if (neededBlocks <= blockCount - heldTotal()) {
        state.admitted = true
        state.heldBlocks = neededBlocks
        pendingPrefills.push(request.id)
        emit(tick, request.id, 'admitted', { blocks: neededBlocks })
      } else {
        emit(tick, request.id, 'admission-waiting', { blocks: neededBlocks })
      }
    }

    // 2. 可运行集合与选择。
    const decodeReady = requests
      .filter((request) => {
        const state = states.get(request.id)!
        return state.admitted && !state.finished && state.generatedTokens > 0
      })
      .map((request) => request.id)
    const preferPrefill = policy === 'prefill-priority' ? pendingPrefills.length > 0 : decodeReady.length === 0 && pendingPrefills.length > 0
    const chosenPrefill = preferPrefill ? pendingPrefills[0] : undefined
    const runDecode = !preferPrefill && decodeReady.length > 0

    let chosen: ScheduleGroup | null = null
    if (chosenPrefill !== undefined) {
      const request = requests.find((item) => item.id === chosenPrefill)!
      const state = states.get(chosenPrefill)!
      pendingPrefills.shift()
      state.cachedTokens = request.promptTokens + 1
      state.generatedTokens = 1
      chosen = { tick, kind: 'prefill', members: [{ requestId: chosenPrefill, validTokens: request.promptTokens }] }
      emit(tick, chosenPrefill, 'prefill-executed')
    } else if (runDecode) {
      chosen = { tick, kind: 'decode', members: decodeReady.map((requestId) => ({ requestId, validTokens: 1 })) }
      for (const requestId of decodeReady) {
        const state = states.get(requestId)!
        state.generatedTokens += 1
        state.cachedTokens += 1
        // 跨块界的增长要显式取块；教学池不足时直接报错，压力场景留给第 06 章。
        const newBlocks = blockCountFor(state.cachedTokens, blockSizeTokens)
        if (newBlocks > state.heldBlocks) {
          const delta = newBlocks - state.heldBlocks
          if (heldTotal() + delta > blockCount) {
            throw new Error(`拍 ${tick} 时块池不足以支持 ${requestId} 的 decode 增长。`)
          }
          state.heldBlocks = newBlocks
          emit(tick, requestId, 'blocks-acquired', { blocks: delta })
        }
        emit(tick, requestId, 'decode-executed', { groupSize: decodeReady.length })
      }
    }

    // 3. 完成裁决：当拍离开并归还块。
    for (const request of requests) {
      const state = states.get(request.id)!
      if (!state.finished && state.generatedTokens === request.outputTokens && state.generatedTokens > 0) {
        state.finished = true
        emit(tick, request.id, 'completed')
        emit(tick, request.id, 'blocks-released', { blocks: state.heldBlocks })
        state.heldBlocks = 0
      }
    }

    if (chosen) groups.push(chosen)
    ticks.push({
      tick,
      afterEventSequence: events.length - 1,
      runnable: requests.map((request) => {
        const state = states.get(request.id)!
        return {
          requestId: request.id,
          state: runnableStateFor(state),
          heldBlocks: state.heldBlocks,
          cachedTokens: state.cachedTokens,
        }
      }),
      chosen,
      pendingPrefills: [...pendingPrefills],
    })
    tick += 1
  }

  const trace: ScheduleTrace = {
    policy,
    evidence: 'simulated',
    requests: requests.map((request) => ({ ...request })),
    blockCount,
    blockSizeTokens,
    events,
    groups,
    ticks,
  }
  const issues = validateScheduleTrace(trace)
  if (issues.length > 0) throw new Error(issues.join('\n'))
  return trace
}

function runnableStateFor(state: MutableRequestState): RunnableState {
  if (state.finished) return 'finished'
  if (!state.arrived) return 'not-arrived'
  if (!state.admitted) return 'waiting-blocks'
  if (state.generatedTokens === 0) return 'waiting-prefill'
  return 'runnable'
}

export interface ScheduleOutcomeRow {
  requestId: string
  firstExecutionTick: number
  completionTick: number
}

/** 每个请求的首执行拍与完成拍，由事件推导。 */
export function scheduleOutcome(trace: ScheduleTrace): ScheduleOutcomeRow[] {
  return trace.requests.map((request) => {
    const executions = trace.events.filter((event) =>
      event.requestId === request.id && (event.kind === 'prefill-executed' || event.kind === 'decode-executed'))
    const completion = trace.events.find((event) => event.requestId === request.id && event.kind === 'completed')
    return {
      requestId: request.id,
      firstExecutionTick: executions[0]?.tick ?? -1,
      completionTick: completion?.tick ?? -1,
    }
  })
}

/** 校验调度轨迹不变量：每拍至多一份工作、成员拍前可运行、准入不超池、恰一次终结。 */
export function validateScheduleTrace(trace: ScheduleTrace): string[] {
  const issues: string[] = []
  const requestsById = new Map(trace.requests.map((request) => [request.id, request]))

  for (let index = 0; index < trace.groups.length; index += 1) {
    const group = trace.groups[index]
    if (index > 0 && group.tick <= trace.groups[index - 1].tick) {
      issues.push(`执行组 ${index} 的拍数没有严格递增。`)
    }
  }
  const ticksWithWork = new Set(trace.groups.map((group) => group.tick))
  for (const tickSnapshot of trace.ticks) {
    if (tickSnapshot.chosen && !ticksWithWork.has(tickSnapshot.tick)) {
      issues.push(`拍 ${tickSnapshot.tick} 登记了不存在的工作。`)
    }
  }

  let heldTotal = 0
  for (const event of trace.events) {
    const request = requestsById.get(event.requestId)
    if (!request) issues.push(`事件 ${event.sequence} 引用了未知请求。`)
    if (event.kind === 'admitted' || event.kind === 'blocks-acquired') heldTotal += event.blocks ?? 0
    if (event.kind === 'blocks-released') heldTotal -= event.blocks ?? 0
    if (heldTotal < 0 || heldTotal > trace.blockCount) {
      issues.push(`事件 ${event.sequence} 后持有块数 ${heldTotal} 越界。`)
    }
    if (event.kind === 'admission-waiting' && event.tick < (request?.arrivalStep ?? 0)) {
      issues.push(`请求 ${event.requestId} 在到达前等待准入。`)
    }
  }

  for (const request of trace.requests) {
    const events = trace.events.filter((event) => event.requestId === request.id)
    if (events.filter((event) => event.kind === 'arrived').length !== 1) {
      issues.push(`请求 ${request.id} 必须且只能到达一次。`)
    }
    const completions = events.filter((event) => event.kind === 'completed')
    if (completions.length !== 1) issues.push(`请求 ${request.id} 必须且只能完成一次。`)
    const executions = events.filter((event) => event.kind === 'prefill-executed' || event.kind === 'decode-executed')
    const prefills = executions.filter((event) => event.kind === 'prefill-executed')
    if (prefills.length !== 1) issues.push(`请求 ${request.id} 必须且只能执行一次 prefill。`)
    if (executions.length !== request.outputTokens) {
      issues.push(`请求 ${request.id} 的执行次数应等于输出 token 数。`)
    }
    const waiting = events.filter((event) => event.kind === 'admission-waiting')
    for (const event of waiting) {
      const admitted = events.find((item) => item.kind === 'admitted')
      if (admitted && admitted.sequence < event.sequence) {
        issues.push(`请求 ${request.id} 在准入后再次出现等待块事件。`)
      }
    }
  }

  // 等待块的请求在后续拍必须重试准入，直到通过或轨迹结束。
  for (const request of trace.requests) {
    const events = trace.events.filter((event) => event.requestId === request.id)
    const waiting = events.find((event) => event.kind === 'admission-waiting')
    if (waiting && !events.some((event) => event.kind === 'admitted')) {
      issues.push(`请求 ${request.id} 等待块后从未获得准入。`)
    }
  }
  return issues
}
