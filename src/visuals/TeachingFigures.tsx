import { useState, type CSSProperties } from 'react'

const promptTokens = ['x1', 'x2', 'x3', 'x4']

export function ExecutionShapeFigure() {
  const [mode, setMode] = useState<'prefill' | 'decode'>('prefill')
  const size = mode === 'prefill' ? 4 : 5
  const cells = Array.from({ length: mode === 'prefill' ? 16 : 5 }, (_, index) => {
    const row = mode === 'prefill' ? Math.floor(index / size) : 0
    const column = index % size
    return { row, column, allowed: mode === 'decode' || column <= row }
  })

  return (
    <figure className="concept-figure shape-figure" aria-labelledby="shape-caption">
      <header className="figure-header">
        <div><span>DEPENDENCY VIEW · 01</span><strong>同一模型，两种执行形状</strong></div>
        <div className="figure-switch" role="group" aria-label="选择执行阶段">
          <button type="button" aria-pressed={mode === 'prefill'} onClick={() => setMode('prefill')}>完整输入</button>
          <button type="button" aria-pressed={mode === 'decode'} onClick={() => setMode('decode')}>新增一步</button>
        </div>
      </header>

      <div className="shape-canvas">
        <div className="shape-input">
          <span>本次进入模型</span>
          <div className="token-line">
            {mode === 'prefill'
              ? promptTokens.map((token, index) => <i key={token} style={{ '--token-index': index } as CSSProperties}>{token}</i>)
              : <><em>x1…x4 已在 KV</em><i className="new-token">y1</i></>}
          </div>
        </div>

        <div className="attention-panel">
          <div className={`attention-matrix ${mode}`} style={{ '--matrix-size': size } as CSSProperties} aria-hidden="true">
            {cells.map((cell, index) => <i key={index} className={cell.allowed ? 'allowed' : 'masked'} style={{ '--cell-index': index } as CSSProperties} />)}
          </div>
          <div>
            <span>可读取的位置</span>
            <strong>{mode === 'prefill' ? '四个已知位置形成因果三角' : '一个新 query 读取全部五个位置'}</strong>
            <small>{mode === 'prefill' ? '未来方向被遮罩，但已知位置可以一起计算。' : '历史不必重算，只追加 y1 的一份 KV。'}</small>
          </div>
        </div>

        <dl className="shape-readout">
          <div><dt>逻辑输入</dt><dd>{mode === 'prefill' ? '[1, 4, d]' : '[1, 1, d]'}</dd></div>
          <div><dt>复用历史</dt><dd>{mode === 'prefill' ? '0 个位置' : '4 个位置'}</dd></div>
          <div><dt>新增 KV</dt><dd>{mode === 'prefill' ? '4 个位置' : '1 个位置'}</dd></div>
          <div><dt>分数用于</dt><dd>{mode === 'prefill' ? '选择 y1' : '选择 y2'}</dd></div>
        </dl>
      </div>
      <figcaption id="shape-caption">切换视图时，模型权重没有改变；改变的是已知位置的数量和可复用的历史。</figcaption>
    </figure>
  )
}

const timelineSteps = [
  { time: 't0', title: '请求就绪', detail: 'prompt 已编码，尚无 KV，也没有客户端可见文本。' },
  { time: 't1', title: '选出 y1', detail: '模型工作已经产生结果，但输出仍可能停在解码缓冲中。' },
  { time: 't2', title: '提交首片段', detail: 'y1 越过网络提交点；请求仍持有 KV 并继续 decode。' },
  { time: 't3', title: '继续生成', detail: '客户端陆续看到片段，服务端状态和 KV 同时增长。' },
  { time: 't4', title: '结束与释放', detail: '停止原因确定，流关闭，在途工作安全后才释放 KV。' },
]

const lanes = [
  { name: '模型', values: ['等待', 'prefill → y1', '—', 'decode 循环', '选中 <eos>'] },
  { name: '请求', values: ['已接收', '记录 y1', '游标前移', '生成增长', '结束原因确定'] },
  { name: '客户端', values: ['空', '仍可能为空', '首片段可见', '片段增加', '收到结束'] },
  { name: '资源', values: ['未分配', '持有 KV', '继续持有', 'KV 增长', '安全后释放'] },
]

export function OutputTimelineFigure() {
  const [step, setStep] = useState(0)

  return (
    <figure className="concept-figure timeline-figure" aria-labelledby="timeline-caption">
      <header className="figure-header">
        <div><span>EVENT VIEW · 02</span><strong>“产生”“看见”“结束”不在同一刻</strong></div>
        <div className="timeline-controls">
          <button type="button" onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={step === 0}>上一步</button>
          <b>{step + 1} / {timelineSteps.length}</b>
          <button type="button" onClick={() => setStep((value) => Math.min(timelineSteps.length - 1, value + 1))} disabled={step === timelineSteps.length - 1}>下一步</button>
        </div>
      </header>

      <div className="timeline-canvas">
        <ol className="timeline-axis" aria-label="选择时间点">
          {timelineSteps.map((item, index) => (
            <li key={item.time} className={index <= step ? 'passed' : ''}>
              <button type="button" aria-current={step === index ? 'step' : undefined} onClick={() => setStep(index)}><span>{item.time}</span>{item.title}</button>
            </li>
          ))}
        </ol>
        <div className="timeline-lanes">
          {lanes.map((lane) => (
            <div className="timeline-lane" key={lane.name}>
              <strong>{lane.name}</strong>
              {lane.values.map((value, index) => <span key={`${lane.name}-${index}`} className={index === step ? 'current' : index < step ? 'passed' : ''}>{value}</span>)}
            </div>
          ))}
        </div>
        <div className="timeline-explanation" aria-live="polite"><span>{timelineSteps[step].time}</span><strong>{timelineSteps[step].title}</strong><p>{timelineSteps[step].detail}</p></div>
      </div>
      <figcaption id="timeline-caption">逐步移动时间点，观察四条记录何时分开、又在终止时怎样收束。</figcaption>
    </figure>
  )
}

const lifecycleStages = [
  {
    name: '运行中', note: 'decode 已提交', terminal: '—', compute: '执行中', kv: 'held', stream: 'open', next: '允许',
  },
  {
    name: '终止已登记', note: '取消取得顺序', terminal: 'cancelled', compute: '等待安全点', kv: '暂不释放', stream: '禁止新写入', next: '禁止',
  },
  {
    name: '清理完成', note: '在途工作结束', terminal: 'cancelled', compute: '安全', kv: 'released', stream: 'closed', next: '禁止',
  },
]

export function ResourceLifecycleFigure() {
  const [stage, setStage] = useState(0)
  const current = lifecycleStages[stage]

  return (
    <figure className="concept-figure resource-figure" aria-labelledby="resource-caption">
      <header className="figure-header">
        <div><span>OWNERSHIP VIEW · 03</span><strong>终止先关闭许可，资源稍后释放</strong></div>
      </header>
      <div className="resource-canvas">
        <ol className="resource-stages">
          {lifecycleStages.map((item, index) => (
            <li key={item.name} className={index <= stage ? 'passed' : ''}>
              <button type="button" aria-current={stage === index ? 'step' : undefined} onClick={() => setStage(index)}>
                <b>{index + 1}</b><span>{item.name}<small>{item.note}</small></span>
              </button>
            </li>
          ))}
        </ol>
        <div className="resource-gate" aria-live="polite">
          <span className={`gate-indicator stage-${stage}`} aria-hidden="true" />
          <div><span>terminal reason</span><strong>{current.terminal}</strong></div>
          <div><span>新计算许可</span><strong>{current.next}</strong></div>
        </div>
        <dl className="resource-leases">
          <div><dt>设备工作</dt><dd>{current.compute}</dd><i className={stage === 0 ? 'busy' : stage === 1 ? 'waiting' : 'done'} /></div>
          <div><dt>KV 租约</dt><dd>{current.kv}</dd><i className={stage < 2 ? 'held' : 'done'} /></div>
          <div><dt>输出流</dt><dd>{current.stream}</dd><i className={stage === 0 ? 'busy' : stage === 1 ? 'waiting' : 'done'} /></div>
        </dl>
      </div>
      <figcaption id="resource-caption">取消不是“立刻删除一切”：先禁止新动作，再等旧动作到达安全点，最后完成一次性释放。</figcaption>
    </figure>
  )
}
