import { useEffect, useState } from 'react'

const moments = [
  { label: '请求进入', detail: '1 个 API 请求', forward: '0', output: '—' },
  { label: '处理输入', detail: '读取 x1…x4', forward: '1', output: '—' },
  { label: '逐步生成', detail: 'y1 → y2 → y3', forward: '2…4', output: 'y1  y2' },
  { label: '安全结束', detail: '停止并释放资源', forward: '4', output: 'y1  y2  y3' },
]

export function RequestPulseHero() {
  const [moment, setMoment] = useState(0)
  const [playing, setPlaying] = useState(() => typeof window.matchMedia !== 'function' || !window.matchMedia('(prefers-reduced-motion: reduce)').matches)

  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(() => setMoment((value) => (value + 1) % moments.length), 1800)
    return () => window.clearInterval(timer)
  }, [playing])

  const active = moments[moment]

  return (
    <figure className={`request-pulse${playing ? '' : ' is-paused'}`} aria-labelledby="request-pulse-caption">
      <div className="pulse-topline">
        <span><i aria-hidden="true" /> REQUEST R-01</span>
        <button type="button" onClick={() => setPlaying((value) => !value)}>{playing ? '暂停动画' : '继续动画'}</button>
      </div>

      <div className="pulse-stage" aria-live="polite">
        <div className="pulse-request">
          <span>API</span>
          <strong>一次请求</strong>
          <small>prompt + 参数</small>
        </div>
        <div className="pulse-track" aria-hidden="true"><b style={{ '--pulse-step': moment } as React.CSSProperties} /></div>
        <div className="pulse-engine">
          <span className="engine-orbit" aria-hidden="true" />
          <strong>{active.label}</strong>
          <small>{active.detail}</small>
        </div>
        <div className="pulse-track pulse-track-out" aria-hidden="true"><b style={{ '--pulse-step': moment } as React.CSSProperties} /></div>
        <div className="pulse-output">
          <span>STREAM</span>
          <strong>{active.output}</strong>
          <small>客户端可见</small>
        </div>
      </div>

      <div className="pulse-readout">
        <span>模型执行 <strong>{active.forward}</strong></span>
        <ol aria-label="动画阶段">
          {moments.map((item, index) => (
            <li key={item.label}>
              <button type="button" aria-current={moment === index ? 'step' : undefined} onClick={() => { setMoment(index); setPlaying(false) }}>
                <span>{String(index + 1).padStart(2, '0')}</span>{item.label}
              </button>
            </li>
          ))}
        </ol>
      </div>
      <figcaption id="request-pulse-caption">客户端只调用一次，服务端内部却经历多个不可合并的时刻。</figcaption>
    </figure>
  )
}
