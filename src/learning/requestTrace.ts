export type TraceScenario = 'cancel-first' | 'send-first'
export type PreparedOutput = 'waiting' | 'ready' | 'committed' | 'discarded'

export interface TraceState {
  visibleTokens: string[]
  preparedOutput: PreparedOutput
  terminalReason?: 'cancelled'
  runnable: boolean
  inFlight: boolean
  kv: 'held' | 'released'
  stream: 'open' | 'closed'
  releaseCount: number
}

export interface TraceFrame {
  event: string
  explanation: string
  state: TraceState
}

type AtomicEvent = 'cancel' | 'decode-completes' | 'emit-y2' | 'cleanup'

export const scenarioEvents: Record<TraceScenario, AtomicEvent[]> = {
  'cancel-first': ['cancel', 'decode-completes', 'emit-y2', 'cleanup'],
  'send-first': ['decode-completes', 'emit-y2', 'cancel', 'cleanup'],
}

export function initialTraceState(): TraceState {
  return {
    visibleTokens: ['y1'],
    preparedOutput: 'waiting',
    runnable: true,
    inFlight: true,
    kv: 'held',
    stream: 'open',
    releaseCount: 0,
  }
}

function assertInvariants(state: TraceState) {
  if (state.terminalReason && state.runnable) throw new Error('终止后请求不能继续被执行')
  if (state.kv === 'released' && state.inFlight) throw new Error('在途工作结束前不能释放 KV')
  if (state.kv === 'released' && !state.terminalReason) throw new Error('活跃请求不能释放 KV')
  if (state.stream === 'closed' && !state.terminalReason) throw new Error('活跃请求不能关闭输出流')
  if (state.releaseCount > 1) throw new Error('资源不能重复释放')
}

function applyEvent(state: TraceState, event: AtomicEvent): TraceFrame {
  const next: TraceState = { ...state, visibleTokens: [...state.visibleTokens] }
  let explanation = ''

  if (event === 'cancel') {
    if (!next.terminalReason) next.terminalReason = 'cancelled'
    next.runnable = false
    explanation = '取消取得终止权；不再允许启动新计算或提交新输出。'
  }

  if (event === 'decode-completes') {
    next.inFlight = false
    next.preparedOutput = next.terminalReason ? 'discarded' : 'ready'
    explanation = next.terminalReason
      ? '已提交的 decode 到达安全点，结果因请求已终止而丢弃。'
      : 'decode 结束并准备好 y2；此时 y2 还没有越过发送提交点。'
  }

  if (event === 'emit-y2') {
    if (!next.terminalReason && next.preparedOutput === 'ready') {
      next.visibleTokens.push('y2')
      next.preparedOutput = 'committed'
      explanation = '发送在请求仍活跃时提交，客户端可以看见 y2。'
    } else {
      if (next.preparedOutput !== 'committed') next.preparedOutput = 'discarded'
      explanation = '发送没有取得输出许可，y2 不会提交给客户端。'
    }
  }

  if (event === 'cleanup') {
    if (!next.terminalReason || next.inFlight) throw new Error('清理尚未到达安全边界')
    next.kv = 'released'
    next.stream = 'closed'
    next.releaseCount += 1
    explanation = '在途工作已结束；KV 与输出流各收束一次。'
  }

  assertInvariants(next)
  return { event, explanation, state: next }
}

export function runTrace(scenario: TraceScenario): TraceFrame[] {
  const frames: TraceFrame[] = []
  let state = initialTraceState()
  for (const event of scenarioEvents[scenario]) {
    const frame = applyEvent(state, event)
    frames.push(frame)
    state = frame.state
  }
  return frames
}
