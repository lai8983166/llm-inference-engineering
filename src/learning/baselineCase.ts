import type { BenchmarkEvent, MeasurementWindow } from './benchmarkEvidence'

export const boundaryEvents: readonly BenchmarkEvent[] = [
  { runId: 'boundary-demo', observer: 'client', name: 'client-start', timestampMs: 0 },
  { runId: 'boundary-demo', observer: 'server', name: 'server-received', timestampMs: 8 },
  { runId: 'boundary-demo', observer: 'host', name: 'host-submit', timestampMs: 18 },
  { runId: 'boundary-demo', observer: 'host', name: 'host-return', timestampMs: 20 },
  { runId: 'boundary-demo', observer: 'device', name: 'device-start', timestampMs: 21 },
  { runId: 'boundary-demo', observer: 'device', name: 'device-complete', timestampMs: 68 },
  { runId: 'boundary-demo', observer: 'server', name: 'request-complete', timestampMs: 74 },
  { runId: 'boundary-demo', observer: 'client', name: 'request-complete', timestampMs: 80 },
]

export const boundaryWindows: readonly MeasurementWindow[] = [
  { id: 'client-e2e', observer: 'client', startEvent: 'client-start', endEvent: 'request-complete' },
  { id: 'server-request', observer: 'server', startEvent: 'server-received', endEvent: 'request-complete' },
  { id: 'host-submit', observer: 'host', startEvent: 'host-submit', endEvent: 'host-return' },
  { id: 'device-execution', observer: 'device', startEvent: 'device-start', endEvent: 'device-complete' },
]

export const warmupRuns = {
  A: [168, 112, 103, 100, 101, 99],
  B: [240, 125, 92, 90, 91, 89],
} as const

export const distributionRuns = {
  A: [96, 98, 99, 100, 100, 101, 102, 103, 104, 106],
  B: [80, 82, 84, 86, 88, 90, 92, 94, 120, 130],
} as const
