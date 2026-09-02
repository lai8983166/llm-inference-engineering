/** 解码步预算的五类部件；每类对应一种瓶颈指纹与一族优化。 */
export type BottleneckKind = 'submit' | 'launch' | 'sync' | 'memory' | 'compute'

export const bottleneckKinds: readonly BottleneckKind[] = ['submit', 'launch', 'sync', 'memory', 'compute']

export const bottleneckLabels: Record<BottleneckKind, string> = {
  submit: 'CPU 提交',
  launch: 'launch 间隙',
  sync: '同步',
  memory: '访存',
  compute: '计算',
}

/** 一个解码步的预算：五部件整数教学单位（不是时间量纲）。 */
export type StepBudget = Record<BottleneckKind, number>

/** 固定基线：合计 20 单位，launch 主导（40%）。 */
export const baselineDecodeBudget: StepBudget = {
  submit: 2,
  launch: 8,
  sync: 2,
  memory: 6,
  compute: 2,
}

export interface OptimizationSpec {
  id: string
  name: string
  target: BottleneckKind
  /** 优化后该部件的比例（0.5 = 减半，0 = 归零）。 */
  factor: number
}

/** 固定优化表：真实机制只作命名类比，收益全部由预算算术给出。 */
export const optimizations: readonly OptimizationSpec[] = [
  { id: 'faster-kernel', name: '更快 kernel（计算 ×0.5）', target: 'compute', factor: 0.5 },
  { id: 'cuda-graph', name: 'CUDA Graph 一类（launch ×0.25）', target: 'launch', factor: 0.25 },
  { id: 'kv-quant', name: 'KV 量化（访存 ×0.5）', target: 'memory', factor: 0.5 },
  { id: 'no-sync', name: '去同步（sync → 0）', target: 'sync', factor: 0 },
]

/** 优化是部件的比例缩放；其余部件不动。 */
export function optimize(budget: StepBudget, spec: OptimizationSpec): StepBudget {
  return { ...budget, [spec.target]: Math.round(budget[spec.target] * spec.factor) }
}

/** 端到端 = 部件之和（登记的教学简化：串行、无重叠）。 */
export function total(budget: StepBudget): number {
  return bottleneckKinds.reduce((sum, kind) => sum + budget[kind], 0)
}

/** 部件占比（0—1）。 */
export function share(budget: StepBudget, kind: BottleneckKind): number {
  return budget[kind] / total(budget)
}

/** 收益 = 优化前合计 / 优化后合计。 */
export function speedup(before: StepBudget, after: StepBudget): number {
  return total(before) / total(after)
}

/** 上限 = 该部件归零时的收益，等价于 1/(1−占比)（Amdahl 手算复现）。 */
export function ceiling(budget: StepBudget, kind: BottleneckKind): number {
  return 1 / (1 - share(budget, kind))
}

/** 一次优化在基线上的完整收益读数；正文、图与实践消费同一结果。 */
export function optimizeReport(budget: StepBudget, spec: OptimizationSpec) {
  const after = optimize(budget, spec)
  return {
    spec,
    before: budget,
    after,
    beforeTotal: total(budget),
    afterTotal: total(after),
    speedup: speedup(budget, after),
    targetShare: share(budget, spec.target),
    targetCeiling: ceiling(budget, spec.target),
  }
}

export interface NoiseCase {
  id: string
  label: string
  before: readonly number[]
  after: readonly number[]
  beforeMean: number
  afterMean: number
  beforeRange: readonly [number, number]
  afterRange: readonly [number, number]
  rangesOverlap: boolean
  claimSupported: boolean
}

function summarize(samples: readonly number[]) {
  const sorted = [...samples].sort((left, right) => left - right)
  const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length
  return { mean, range: [sorted[0], sorted[sorted.length - 1]] as [number, number] }
}

function noiseCase(id: string, label: string, before: readonly number[], after: readonly number[]): NoiseCase {
  const left = summarize(before)
  const right = summarize(after)
  const rangesOverlap = left.range[1] >= right.range[0] && right.range[1] >= left.range[0]
  return {
    id,
    label,
    before,
    after,
    beforeMean: left.mean,
    afterMean: right.mean,
    beforeRange: left.range,
    afterRange: right.range,
    rangesOverlap,
    // 范围重叠：证据不支持收益声称；分离：可支持但仍需同条件与分布核对。
    claimSupported: !rangesOverlap,
  }
}

/** 固定记录的教学样本表：不是随机生成，不代表真实噪声分布。 */
export function noiseCases(): readonly NoiseCase[] {
  return [
    noiseCase(
      'within-noise',
      '无实质变化',
      [18, 19, 20, 21, 22],
      [19, 20, 20, 20, 21],
    ),
    noiseCase(
      'real-gain',
      '真实收益（launch 8 → 2）',
      [18, 19, 20, 21, 22],
      [13, 14, 14, 15, 15],
    ),
  ]
}
