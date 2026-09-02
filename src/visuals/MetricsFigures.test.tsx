import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EventToDistributionFigure, LoopComparisonFigure } from './MetricsFigures'

describe('chapter eight aggregation chain figure', () => {
  it('switches metrics and shows distribution stats from the model', async () => {
    const user = userEvent.setup()
    render(<EventToDistributionFigure />)

    expect(screen.getByText('首 token', { selector: '.strategy-switch button[aria-pressed="true"]' })).toBeInTheDocument()
    // 首 token 池：K-a 0、K-b 1、K-c 1、K-d 2、K-f 0 → 排序 [0,0,1,1,2]。
    expect(screen.getByText('均值 0.80 · p50 1 · p99 2 · 最大 2')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '间隔' }))
    expect(screen.getByText('均值 1.71 · p50 2 · p99 3 · 最大 3')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '排队' }))
    expect(screen.getByText('均值 0.40 · p50 0 · p99 2 · 最大 2')).toBeInTheDocument()
    expect(screen.getByText(/不是时间。p99 能沿链指回产生它的请求/)).toBeInTheDocument()
  })

  it('switches requests on the event ruler', async () => {
    const user = userEvent.setup()
    render(<EventToDistributionFigure />)

    await user.click(screen.getByRole('button', { name: 'K-e' }))
    const readout = screen.getByText('5 个样本', { selector: '.trace-readout strong' }).parentElement!
    expect(within(readout).getByText('未定义 拍')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'K-b' }))
    expect(within(readout).getByText('1 拍')).toBeInTheDocument()
  })

  it('toggles the A/B counterexample with verdicts', async () => {
    const user = userEvent.setup()
    render(<EventToDistributionFigure />)

    await user.click(screen.getByRole('button', { name: 'A/B 反例' }))
    expect(screen.getByText('均值会说谎', { selector: '.trace-readout strong' })).toBeInTheDocument()
    expect(screen.getByText(/SLO ≤4@p99：违约/)).toBeInTheDocument()
    expect(screen.getByText(/SLO ≤4@p99：达标/)).toBeInTheDocument()
    expect(screen.getByText(/不冒充真实测量/)).toBeInTheDocument()
  })

  it('starts paused under reduced motion and exposes keyboard focus', async () => {
    const user = userEvent.setup()
    const originalMatchMedia = window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({ matches: true, addEventListener: () => undefined, removeEventListener: () => undefined }),
    })
    render(<><EventToDistributionFigure /><LoopComparisonFigure /></>)
    expect(screen.getAllByRole('button', { name: '继续动画' })).toHaveLength(1)
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: originalMatchMedia })

    await user.tab()
    expect(screen.getAllByRole('button', { name: /排队/ })[0]).toHaveFocus()
  })
})

describe('chapter eight loop comparison figure', () => {
  it('shows the open loop with queue depth from the trace', async () => {
    const user = userEvent.setup()
    const { container } = render(<LoopComparisonFigure />)
    await user.click(screen.getByRole('button', { name: '暂停动画' }))

    expect(container.querySelectorAll('.loop-queue-row .strip-cell')).toHaveLength(8)
    const readout = screen.getByText('最大队列 2', { selector: '.trace-readout strong' }).parentElement!
    expect(within(readout).getByText('排队 2 拍')).toBeInTheDocument()
    expect(within(readout).getByText(/未准入/)).toBeInTheDocument()
    expect(within(readout).getByText('总拍数', { selector: 'dt' })).toBeInTheDocument()
    expect(screen.getByText(/排队现形/)).toBeInTheDocument()
  })

  it('switches to the closed loop with zero queue depth', async () => {
    const user = userEvent.setup()
    const { container } = render(<LoopComparisonFigure />)
    await user.click(screen.getByRole('button', { name: '暂停动画' }))
    await user.click(screen.getByRole('button', { name: '闭环' }))

    expect(container.querySelectorAll('.loop-queue-row .strip-cell')).toHaveLength(17)
    const readout = screen.getByText('最大队列 0', { selector: '.trace-readout strong' }).parentElement!
    expect(within(readout).getAllByText('排队 0 拍')).toHaveLength(6)
    expect(within(readout).getByText('17')).toBeInTheDocument()
    expect(screen.getByText(/排队被客户端节奏吸收/)).toBeInTheDocument()
    expect(screen.getByText(/不是时间或真实排队论/)).toBeInTheDocument()
  })
})
