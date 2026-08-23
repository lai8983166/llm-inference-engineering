export type BenchmarkObserver = 'client' | 'server' | 'host' | 'device'
export type EvidenceKind = 'simulated' | 'measured'
export type RunPhase = 'cold' | 'warm'
export type RunStatus = 'succeeded' | 'failed'

export type BenchmarkEventName =
  | 'client-start'
  | 'server-received'
  | 'host-submit'
  | 'host-return'
  | 'device-start'
  | 'device-complete'
  | 'result-readable'
  | 'request-complete'

export interface BenchmarkEvent {
  runId: string
  observer: BenchmarkObserver
  name: BenchmarkEventName
  timestampMs: number
  metadata?: Readonly<Record<string, string | number | boolean>>
}

export interface WorkloadShape {
  taskId: string
  inputTokens: number
  outputLimit: number
  producedOutputTokens: number
  concurrency: number
}

export interface EnvironmentSnapshot {
  modelId: string
  modelRevision: string
  hardwareId: string
  softwareStack: string
}

export interface BenchmarkRun {
  id: string
  implementation: string
  sequence: number
  phase: RunPhase
  status: RunStatus
  evidence: EvidenceKind
  workload: WorkloadShape
  environment: EnvironmentSnapshot
  events: readonly BenchmarkEvent[]
}

export interface MeasurementWindow {
  id: string
  observer: BenchmarkObserver
  startEvent: BenchmarkEventName
  endEvent: BenchmarkEventName
}

export interface CorrectnessContract {
  task: string
  inputSet: string
  generationConfig: Readonly<Record<string, string | number | boolean>>
  randomnessPolicy: string
  outputAcceptance: string
}

export interface WarmupPolicy {
  question: 'cold-start' | 'steady-state'
  declaredWarmupRuns: number
  excludedRunIds: readonly string[]
}

export interface BenchmarkProtocol {
  correctness: CorrectnessContract
  environment: EnvironmentSnapshot
  workload: WorkloadShape
  warmup: WarmupPolicy
  windows: readonly MeasurementWindow[]
  aggregation: string
  conclusionScope: string
}

export type MeasurementFailureCode =
  | 'invalid-record'
  | 'missing-start'
  | 'missing-end'
  | 'ambiguous-start'
  | 'ambiguous-end'
  | 'observer-mismatch'
  | 'end-before-start'

export type WindowMeasurement =
  | {
      ok: true
      runId: string
      windowId: string
      observer: BenchmarkObserver
      startMs: number
      endMs: number
      durationMs: number
      evidence: EvidenceKind
    }
  | {
      ok: false
      runId: string
      windowId: string
      code: MeasurementFailureCode
      message: string
    }

function measurementFailure(
  run: BenchmarkRun,
  window: MeasurementWindow,
  code: MeasurementFailureCode,
  message: string,
): WindowMeasurement {
  return { ok: false, runId: run.id, windowId: window.id, code, message }
}

export function measureWindow(run: BenchmarkRun, window: MeasurementWindow): WindowMeasurement {
  const invalidEvent = run.events.find((event) => (
    event.runId !== run.id
    || !Number.isFinite(event.timestampMs)
    || event.timestampMs < 0
  ))
  if (invalidEvent) {
    return measurementFailure(run, window, 'invalid-record', '事件必须属于当前运行，并使用非负的有限单调时间。')
  }

  const namedStartEvents = run.events.filter((event) => event.name === window.startEvent)
  const namedEndEvents = run.events.filter((event) => event.name === window.endEvent)
  if (namedStartEvents.length === 0) return measurementFailure(run, window, 'missing-start', '计时窗口缺少起始事件。')
  if (namedEndEvents.length === 0) return measurementFailure(run, window, 'missing-end', '计时窗口缺少结束事件。')

  const startEvents = namedStartEvents.filter((event) => event.observer === window.observer)
  const endEvents = namedEndEvents.filter((event) => event.observer === window.observer)
  if (startEvents.length === 0 || endEvents.length === 0) {
    return measurementFailure(run, window, 'observer-mismatch', '起止事件必须来自计时窗口声明的同一观察者。')
  }
  if (startEvents.length > 1) return measurementFailure(run, window, 'ambiguous-start', '同一观察者存在多个同名起始事件。')
  if (endEvents.length > 1) return measurementFailure(run, window, 'ambiguous-end', '同一观察者存在多个同名结束事件。')

  const startMs = startEvents[0].timestampMs
  const endMs = endEvents[0].timestampMs
  if (endMs < startMs) {
    return measurementFailure(run, window, 'end-before-start', '结束事件早于起始事件，不能计算持续时间。')
  }

  return {
    ok: true,
    runId: run.id,
    windowId: window.id,
    observer: window.observer,
    startMs,
    endMs,
    durationMs: endMs - startMs,
    evidence: run.evidence,
  }
}

export type ComparabilityIssue = 'failed-run' | 'different-workload' | 'different-environment'

export interface ComparabilityResult {
  comparable: boolean
  issues: ComparabilityIssue[]
}

function sameWorkload(left: WorkloadShape, right: WorkloadShape) {
  return left.taskId === right.taskId
    && left.inputTokens === right.inputTokens
    && left.outputLimit === right.outputLimit
    && left.producedOutputTokens === right.producedOutputTokens
    && left.concurrency === right.concurrency
}

function sameEnvironment(left: EnvironmentSnapshot, right: EnvironmentSnapshot) {
  return left.modelId === right.modelId
    && left.modelRevision === right.modelRevision
    && left.hardwareId === right.hardwareId
    && left.softwareStack === right.softwareStack
}

export function assessComparability(left: BenchmarkRun, right: BenchmarkRun): ComparabilityResult {
  const issues: ComparabilityIssue[] = []
  if (left.status !== 'succeeded' || right.status !== 'succeeded') issues.push('failed-run')
  if (!sameWorkload(left.workload, right.workload)) issues.push('different-workload')
  if (!sameEnvironment(left.environment, right.environment)) issues.push('different-environment')
  return { comparable: issues.length === 0, issues }
}
