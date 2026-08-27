import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CostBillsFigure, OverloadPoolFigure } from './OverloadFigures'

describe('chapter six overload pool figure', () => {
  it('renders dual strips from the trace with queue depth visible', async () => {
    const user = userEvent.setup()
    const { container } = render(<OverloadPoolFigure />)
    await user.click(screen.getByRole('button', { name: '暂停动画' }))

    expect(screen.getByText('无界排队', { selector: '.trace-readout strong' })).toBeInTheDocument()
    expect(container.querySelectorAll('.dual-strip-row')).toHaveLength(2)
    // t2 起 P-d 排队：t3 快照的排队条带读数为 1。
    await user.click(screen.getByRole('button', { name: 't3' }))
    const readout = screen.getByText('无界排队', { selector: '.trace-readout strong' }).parentElement!
    expect(within(readout).getByText(/P-d 排队/)).toBeInTheDocument()
  })

  it('switches to watermark mode and shows the flipped verdict', async () => {
    const user = userEvent.setup()
    render(<OverloadPoolFigure />)
    await user.click(screen.getByRole('button', { name: '暂停动画' }))
    await user.click(screen.getByRole('button', { name: '水位 W=1' }))
    await user.click(screen.getByRole('button', { name: 't1' }))

    const readout = screen.getByText('水位 W=1', { selector: '.trace-readout strong' }).parentElement!
    expect(within(readout).getByText(/P-c 拒绝/)).toBeInTheDocument()
    expect(within(readout).getByText(/成本承担者：调用方/)).toBeInTheDocument()
  })

  it('marks the recompute prefill in the preempt ledger', async () => {
    const user = userEvent.setup()
    render(<OverloadPoolFigure />)
    await user.click(screen.getByRole('button', { name: '暂停动画' }))
    await user.click(screen.getByRole('button', { name: '抢占重计算' }))

    expect(screen.getByText(/重算 prefill 6/)).toBeInTheDocument()
    const preemptEntry = screen.getByText('被抢占', { selector: 'em' })
    expect(preemptEntry.previousElementSibling).toHaveTextContent('P-b')
    expect(screen.getByText(/是计数，不是时间/)).toBeInTheDocument()
  })

  it('starts paused under reduced motion and exposes keyboard focus', async () => {
    const user = userEvent.setup()
    const originalMatchMedia = window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({ matches: true, addEventListener: () => undefined, removeEventListener: () => undefined }),
    })
    render(<OverloadPoolFigure />)
    expect(screen.getByRole('button', { name: '继续动画' })).toBeInTheDocument()
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: originalMatchMedia })

    await user.tab()
    expect(screen.getByRole('button', { name: '无界排队' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: '按满拒绝' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: '水位 W=1' })).toHaveFocus()
  })
})

describe('chapter six cost bills figure', () => {
  it('lists four bills with counts from overloadSummary', () => {
    render(<CostBillsFigure />)

    const table = screen.getByRole('table', { name: '四策略成本对照' })
    expect(within(table).getByText('无界排队'))
    expect(within(table).getByText('抢占重计算'))
    expect(within(table).getAllByText('7')).toHaveLength(2)
    expect(within(table).getByText('6 unit')).toBeInTheDocument()
    expect(within(table).getByText('被抢占者')).toBeInTheDocument()
    expect(within(table).getByText('调用方（边界大申请）')).toBeInTheDocument()
  })

  it('switches the detail panel to the preempt bill', async () => {
    const user = userEvent.setup()
    render(<CostBillsFigure />)
    const toolbar = within(screen.getByRole('group', { name: '选择查看的策略' }))
    await user.click(toolbar.getByRole('button', { name: '抢占重计算' }))

    expect(screen.getByText('被抢占者 承担过载成本', { selector: '.trace-readout strong' })).toBeInTheDocument()
    expect(screen.getByText('首执行 t3 · 完成 t4')).toBeInTheDocument()
    expect(screen.getByText(/不是找最小值/)).toBeInTheDocument()
  })

  it('shows the rejected request as never executed under reject-full', async () => {
    const user = userEvent.setup()
    render(<CostBillsFigure />)
    const toolbar = within(screen.getByRole('group', { name: '选择查看的策略' }))
    await user.click(toolbar.getByRole('button', { name: '按满拒绝' }))

    expect(screen.getByText('被拒，从未执行')).toBeInTheDocument()
    expect(screen.getByText('调用方 承担过载成本', { selector: '.trace-readout strong' })).toBeInTheDocument()
  })
})
