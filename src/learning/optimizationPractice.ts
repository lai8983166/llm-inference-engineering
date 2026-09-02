import {
  baselineDecodeBudget,
  optimizeReport,
  optimizations,
  noiseCases,
} from './bottleneckLedger'

/**
 * 实践场景：一份声称\"kernel 减半、端到端提升\"的优化报告，
 * 配套预算表与范围重叠的固定样本——收益为何没兑现由三者共同推出。
 */
export const practiceReport = {
  claim: '计算 kernel 时间减半，端到端收益显著',
  kernelReport: optimizeReport(baselineDecodeBudget, optimizations[0]),
  samples: noiseCases()[0],
}

export type GainMissReason = 'share-too-small' | 'noise-overlap' | 'wrong-target'

export function assessGainMissReason(selected: GainMissReason | undefined) {
  return {
    selected,
    // 报告的双重问题：kernel 只占一成（收益上限 1.05），且样本范围重叠（证据不支持）。
    // 首要归因是占比——预算上限在噪声之前就已判定收益不可能显著。
    expected: 'share-too-small' as GainMissReason,
    correct: selected === 'share-too-small',
  }
}

/** 归因链的固定顺序；学习者在页面上打乱后自行重建。 */
export const attributionSteps = [
  { id: 'metric', label: '指标异常：按第 08 章口径定位层与分位' },
  { id: 'budget', label: '预算分解：现场测出五部件占比' },
  { id: 'signature', label: '指纹对照：找出主导部件与嫌疑优化' },
  { id: 'hypothesis', label: '写成可反驳的假设并查收益上限' },
  { id: 'experiment', label: '最小实验：一次只改一处，按分布比较' },
  { id: 'verdict', label: '确认或推翻：收益与上限相符才算确认' },
] as const

export type AttributionStepId = (typeof attributionSteps)[number]['id']

export const attributionAnswer: readonly AttributionStepId[] = [
  'metric', 'budget', 'signature', 'hypothesis', 'experiment', 'verdict',
]

export function assessAttributionOrder(ordered: readonly AttributionStepId[]) {
  const positions = attributionAnswer.map((expectedStep, position) => ({
    expectedStep,
    selectedStep: ordered[position],
    correct: ordered[position] === expectedStep,
  }))
  return {
    positions,
    correct: positions.filter((position) => position.correct).length,
    total: attributionAnswer.length,
  }
}
