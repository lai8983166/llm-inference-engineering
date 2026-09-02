import { useMemo, useState, type CSSProperties } from 'react'
import {
  baselineDecodeBudget,
  bottleneckKinds,
  bottleneckLabels,
  noiseCases,
  optimizeReport,
  optimizations,
  type OptimizationSpec,
} from '@/learning/bottleneckLedger'

/** 收益预算图：基线堆叠条 + 优化切换后的新堆叠条、收益与上限读数。 */
export function BudgetGainFigure() {
  const [selected, setSelected] = useState<OptimizationSpec>(optimizations[0])
  const report = useMemo(() => optimizeReport(baselineDecodeBudget, selected), [selected])

  const bar = (budget: typeof baselineDecodeBudget, label: string) => (
    <div className="budget-bar-block">
      <strong>{label}</strong>
      <div className="budget-bar" role="img" aria-label={`${label}：合计 ${Object.values(budget).reduce((sum, value) => sum + value, 0)} 单位`}>
        {bottleneckKinds.map((kind) => (
          <span key={kind} data-kind={kind} style={{ '--segment': budget[kind] } as CSSProperties}>
            {budget[kind]}
          </span>
        ))}
      </div>
      <small>合计 {Object.values(budget).reduce((sum, value) => sum + value, 0)} 单位</small>
    </div>
  )

  return (
    <figure className="concurrency-figure budget-gain-figure" aria-labelledby="budget-gain-caption">
      <header className="concurrency-figure-header">
        <div><span>BUDGET GAIN · 09</span><strong>收益去哪了</strong></div>
        <div className="concurrency-toolbar">
          <div role="group" aria-label="选择优化" className="strategy-switch">
            {optimizations.map((spec) => (
              <button key={spec.id} type="button" aria-pressed={selected.id === spec.id} onClick={() => setSelected(spec)}>
                {spec.name}
              </button>
            ))}
          </div>
        </div>
      </header>
      <div className="budget-gain-workbench">
        {bar(baselineDecodeBudget, '基线预算')}
        {bar(report.after, `优化后（${selected.name}）`)}
        <div className="budget-legend" aria-label="部件图例">
          {bottleneckKinds.map((kind) => (
            <span key={kind}><i data-kind={kind} />{bottleneckLabels[kind]}</span>
          ))}
        </div>
        <div className="trace-readout budget-gain-readout" aria-live="polite">
          <span>{selected.target}</span>
          <strong>端到端收益 ×{report.speedup.toFixed(2)}</strong>
          <p>目标部件占比 {Math.round(report.targetShare * 100)}%，上限 ×{report.targetCeiling.toFixed(2)}——实际收益永远不超上限。</p>
          <dl>
            <div><dt>优化前合计</dt><dd>{report.beforeTotal} 单位</dd></div>
            <div><dt>优化后合计</dt><dd>{report.afterTotal} 单位</dd></div>
            <div><dt>目标部件上限</dt><dd>×{report.targetCeiling.toFixed(2)}</dd></div>
            <div><dt>实际收益</dt><dd>×{report.speedup.toFixed(2)}</dd></div>
          </dl>
        </div>
      </div>
      <figcaption id="budget-gain-caption">堆叠分段与读数全部来自 simulated 预算纯函数；单位是教学预算，不是时间。收益由占比决定，任何手段都不超越上限。</figcaption>
    </figure>
  )
}

/** 噪声对照图：两组固定样本的取值条带与范围括号、重叠/分离判定。 */
export function NoiseControlFigure() {
  const cases = useMemo(() => noiseCases(), [])
  const [selectedId, setSelectedId] = useState(cases[0].id)
  const active = cases.find((item) => item.id === selectedId)!

  const sampleStrip = (samples: readonly number[], label: string, range: readonly [number, number]) => (
    <div className="noise-sample-block">
      <strong>{label}</strong>
      <ol className="noise-sample-strip" aria-label={`${label}样本`}>
        {samples.map((value, index) => (
          <li key={index} data-near-range={value >= range[0] && value <= range[1] ? 'true' : undefined}>{value}</li>
        ))}
      </ol>
      <small>范围 [{range[0]}, {range[1]}]</small>
    </div>
  )

  return (
    <figure className="concurrency-figure noise-control-figure" aria-labelledby="noise-control-caption">
      <header className="concurrency-figure-header">
        <div><span>NOISE CONTROL · 09</span><strong>噪声与对照</strong></div>
        <div className="concurrency-toolbar">
          <div role="group" aria-label="选择样本组" className="strategy-switch">
            {cases.map((item) => (
              <button key={item.id} type="button" aria-pressed={item.id === selectedId} onClick={() => setSelectedId(item.id)}>
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </header>
      <div className="noise-control-workbench">
        {sampleStrip(active.before, '优化前样本', active.beforeRange)}
        {sampleStrip(active.after, '优化后样本', active.afterRange)}
        <div className={`noise-verdict ${active.claimSupported ? 'is-supported' : 'is-unsupported'}`} role="status">
          <strong>{active.rangesOverlap ? '范围重叠：证据不支持收益声称' : '范围分离：证据可支持收益'}</strong>
          <p>{active.rangesOverlap
            ? '两组样本的范围互相覆盖、均值接近——下一步是加样本、核对环境或放弃声称，不是发布结论。'
            : '分离只是必要条件：仍需同负载、同环境、一次只改一处，并按分布与分位比较（第 08 章口径）。'}</p>
          <small>simulated · 固定记录样本，非真实噪声</small>
        </div>
      </div>
      <figcaption id="noise-control-caption">样本为固定记录的教学数据，不代表真实噪声分布。范围重叠不许声称、范围分离继续核对；真实噪声幅度必须现场测量。</figcaption>
    </figure>
  )
}
