import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CapacityRecycleFigure, TerminalCoverageFigure } from './TerminationFigures'

describe('chapter seven terminal coverage figure', () => {
  it('shows per-cause terminals with cleanup ticks from the trace', async () => {
    const user = userEvent.setup()
    const { container } = render(<TerminalCoverageFigure />)
    await user.click(screen.getByRole('button', { name: '暂停动画' }))

    expect(container.querySelectorAll('.terminal-row')).toHaveLength(5)
    await user.click(screen.getByRole('button', { name: 't4' }))
    // t4 是双终态拍：C-b 取消（释放块）与 C-e 超时（离队）。
    expect(screen.getByText('取消 零块✓ 关流✓')).toBeInTheDocument()
    expect(screen.getByText('超时 零块✓ 离队✓ 关流✓')).toBeInTheDocument()
  })

  it('marks natural completion with the same ritual at its own tick', async () => {
    const user = userEvent.setup()
    const { container } = render(<TerminalCoverageFigure />)
    await user.click(screen.getByRole('button', { name: '暂停动画' }))
    await user.click(screen.getByRole('button', { name: 't5' }))

    expect(container.querySelectorAll('.terminal-row > span[data-phase="terminal-eos"]')).toHaveLength(3)
    const readout = screen.getByText('本拍终点', { selector: '.trace-readout strong' }).parentElement!
    expect(within(readout).getAllByText(/清理当拍完成/)).toHaveLength(3)
    expect(screen.getByText(/不是真实延迟或可靠性/)).toBeInTheDocument()
  })

  it('starts paused under reduced motion and exposes keyboard focus', async () => {
    const user = userEvent.setup()
    const originalMatchMedia = window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({ matches: true, addEventListener: () => undefined, removeEventListener: () => undefined }),
    })
    render(<TerminalCoverageFigure />)
    expect(screen.getByRole('button', { name: '继续动画' })).toBeInTheDocument()
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: originalMatchMedia })

    await user.tab()
    expect(screen.getByRole('button', { name: '继续动画' })).toHaveFocus()
  })
})

describe('chapter seven capacity recycle figure', () => {
  it('renders both strips from the same workload with honest outcome rows', async () => {
    const user = userEvent.setup()
    const { container } = render(<CapacityRecycleFigure />)
    await user.click(screen.getByRole('button', { name: '暂停动画' }))

    expect(container.querySelectorAll('.recycle-strip-block')).toHaveLength(2)
    expect(screen.getByText('基线（无终止注入）')).toBeInTheDocument()
    expect(screen.getByText('注入终止（取消 + 超时）')).toBeInTheDocument()
    const readout = screen.getByText('t4：释放与准入同拍', { selector: '.trace-readout strong' }).parentElement!
    expect(within(readout).getByText('基线 t5/t7 → 注入 t4/t5')).toBeInTheDocument()
    expect(within(readout).getByText('基线 t6/t6 → 注入 未执行')).toBeInTheDocument()
    expect(screen.getByText(/计数不是收益结论/)).toBeInTheDocument()
  })

  it('advances the shared tick cursor across both strips', async () => {
    const user = userEvent.setup()
    const { container } = render(<CapacityRecycleFigure />)
    await user.click(screen.getByRole('button', { name: '暂停动画' }))

    for (let index = 0; index < 3; index += 1) await user.click(screen.getByRole('button', { name: '下一步' }))
    expect(container.querySelectorAll('.recycle-strip .strip-cell.is-current')).toHaveLength(2)
    expect(screen.getByText('t3', { selector: '.trace-readout > span' })).toBeInTheDocument()
  })
})
