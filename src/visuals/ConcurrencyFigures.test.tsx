import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RequestDeviceTraceFigure, StaticBatchOccupancyFigure } from './ConcurrencyFigures'

describe('chapter two concurrency figures', () => {
  it('switches execution organization without changing the request workload', async () => {
    const user = userEvent.setup()
    const { container } = render(<RequestDeviceTraceFigure />)
    const lanes = container.querySelector('.request-state-lanes')

    expect(lanes).toHaveAttribute('data-request-count', '3')
    expect(screen.getByText('整请求串行', { selector: '.trace-readout strong' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '独立循环' }))
    expect(screen.getByText('独立请求循环', { selector: '.trace-readout strong' })).toBeInTheDocument()
    expect(lanes).toHaveAttribute('data-request-count', '3')
    expect(screen.getAllByText('R-long').length).toBeGreaterThan(0)
    expect(screen.getAllByText('R-short').length).toBeGreaterThan(0)
    expect(screen.getAllByText('R-late').length).toBeGreaterThan(0)
  })

  it('advances one logical event boundary and keeps host and device readouts distinct', async () => {
    const user = userEvent.setup()
    render(<RequestDeviceTraceFigure />)
    await user.click(screen.getByRole('button', { name: '暂停动画' }))
    await user.click(screen.getByRole('button', { name: '下一步' }))

    expect(screen.getByText('t1', { selector: '.trace-readout > span' })).toBeInTheDocument()
    const readout = screen.getByText('整请求串行', { selector: '.trace-readout strong' }).parentElement!
    expect(within(readout).getByText('主机提交')).toBeInTheDocument()
    expect(within(readout).getByText('设备执行组')).toBeInTheDocument()
  })

  it('shows padding, inactive slots, and late batch waiting from the static trace', async () => {
    const user = userEvent.setup()
    const { container } = render(<StaticBatchOccupancyFigure />)
    await user.click(screen.getByRole('button', { name: '暂停动画' }))
    await user.click(screen.getByRole('button', { name: 't1' }))
    expect(container.querySelectorAll('.occupancy-row > span[data-kind="prefill-padding"]')).toHaveLength(1)
    expect(screen.getByText('2 有效 + 4 pad')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 't3' }))
    expect(container.querySelectorAll('.occupancy-row > span.is-current[data-kind="inactive"]')).toHaveLength(1)
    expect(container.querySelectorAll('.occupancy-row > span.is-current[data-kind="waiting"]')).toHaveLength(1)
    expect(screen.getByText(/本次执行推进 1 个请求/)).toBeInTheDocument()
  })

  it('starts both timelines paused when reduced motion is preferred', () => {
    const originalMatchMedia = window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({ matches: true, addEventListener: () => undefined, removeEventListener: () => undefined }),
    })
    render(<><RequestDeviceTraceFigure /><StaticBatchOccupancyFigure /></>)
    expect(screen.getAllByRole('button', { name: '继续动画' })).toHaveLength(2)
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: originalMatchMedia })
  })

  it('exposes strategy, playback, and logical-step controls to keyboard focus', async () => {
    const user = userEvent.setup()
    render(<RequestDeviceTraceFigure />)
    await user.tab()
    expect(screen.getByRole('button', { name: '整请求串行' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: '独立循环' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: '暂停动画' })).toHaveFocus()
  })
})
