import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PolicyTimelineFigure, RunnableSetFigure } from './SchedulingFigures'

describe('chapter five runnable set figure', () => {
  it('shows per-cause state chips and the chosen work from the trace', async () => {
    const user = userEvent.setup()
    const { container } = render(<RunnableSetFigure />)
    await user.click(screen.getByRole('button', { name: '暂停动画' }))

    expect(container.querySelectorAll('.runnable-chip')).toHaveLength(3)
    expect(screen.getByText('prefill 优先', { selector: '.trace-readout strong' })).toBeInTheDocument()
    expect(screen.getByText('prefill {R-long}')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 't4' }))
    expect(screen.getByText('decode 组 {R-long + R-late}')).toBeInTheDocument()
    // 拍后语义：t4 末 R-late 已触发长度上限离开，芯片显示已完成。
    const chips = container.querySelectorAll('.runnable-chip')
    expect(chips[0]).toHaveTextContent('可运行')
    expect(chips[2]).toHaveTextContent('R-late')
    expect(chips[2]).toHaveTextContent('已完成')
  })

  it('distinguishes waiting-prefill from runnable under decode priority', async () => {
    const user = userEvent.setup()
    const { container } = render(<RunnableSetFigure />)
    await user.click(screen.getByRole('button', { name: '暂停动画' }))
    await user.click(screen.getByRole('button', { name: 'decode 优先' }))
    await user.click(screen.getByRole('button', { name: 't1' }))

    const chip = container.querySelectorAll('.runnable-chip')
    expect(chip[0]).toHaveTextContent('R-long')
    expect(chip[0]).toHaveTextContent('可运行')
    expect(chip[1]).toHaveTextContent('R-short')
    expect(chip[1]).toHaveTextContent('待 prefill')
    expect(screen.getAllByText('等待块').length).toBeGreaterThan(0)
    expect(screen.getByText(/拍是离散事件刻度，不是时间/)).toBeInTheDocument()
  })

  it('lists arrival and admission rows when they happen', async () => {
    const user = userEvent.setup()
    render(<RunnableSetFigure />)
    await user.click(screen.getByRole('button', { name: '暂停动画' }))
    await user.click(screen.getByRole('button', { name: 't3' }))

    const ledger = screen.getByLabelText('本拍到达与准入')
    // 到达与准入两条事件行都登记 R-late。
    expect(within(ledger).getAllByText('R-late').length).toBe(2)
    expect(within(ledger).getByText(/准入通过，预扣 2 块/)).toBeInTheDocument()
  })
})

describe('chapter five policy timeline figure', () => {
  it('renders closed-batch lanes from the chapter two trace', async () => {
    const user = userEvent.setup()
    const { container } = render(<PolicyTimelineFigure />)
    await user.click(screen.getByRole('button', { name: '暂停动画' }))

    expect(screen.getByText('封闭批次', { selector: '.trace-readout strong' })).toBeInTheDocument()
    expect(container.querySelectorAll('.timeline-row > span')).toHaveLength(21)
    expect(screen.getByText('首执行 t5 · 完成 t6')).toBeInTheDocument()
    expect(screen.getByText('总拍数', { selector: 'dt' })).toBeInTheDocument()
  })

  it('switches to prefill priority and shows earlier late-request start', async () => {
    const user = userEvent.setup()
    render(<PolicyTimelineFigure />)
    await user.click(screen.getByRole('button', { name: '暂停动画' }))
    await user.click(screen.getByRole('button', { name: 'prefill 优先' }))

    expect(screen.getByText('首执行 t3 · 完成 t4')).toBeInTheDocument()
    expect(screen.getByText(/比较的是谁在等，不是谁更快/)).toBeInTheDocument()
  })

  it('switches to decode priority with its own outcome rows', async () => {
    const user = userEvent.setup()
    render(<PolicyTimelineFigure />)
    await user.click(screen.getByRole('button', { name: '暂停动画' }))
    await user.click(screen.getByRole('button', { name: 'decode 优先' }))

    expect(screen.getByText('首执行 t0 · 完成 t3')).toBeInTheDocument()
    expect(screen.getByText('首执行 t4 · 完成 t4')).toBeInTheDocument()
    expect(screen.getByText('首执行 t5 · 完成 t6')).toBeInTheDocument()
  })

  it('starts both figures paused when reduced motion is preferred', () => {
    const originalMatchMedia = window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({ matches: true, addEventListener: () => undefined, removeEventListener: () => undefined }),
    })
    render(<><RunnableSetFigure /><PolicyTimelineFigure /></>)
    expect(screen.getAllByRole('button', { name: '继续动画' })).toHaveLength(2)
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: originalMatchMedia })
  })

  it('exposes policy and playback controls to keyboard focus', async () => {
    const user = userEvent.setup()
    render(<RunnableSetFigure />)
    await user.tab()
    expect(screen.getByRole('button', { name: 'prefill 优先' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'decode 优先' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: '暂停动画' })).toHaveFocus()
  })
})
