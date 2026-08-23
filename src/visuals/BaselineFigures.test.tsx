import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { distributionRuns, mean, median, nearestRankPercentile } from '@/learning/baselineCase'
import { AsyncCompletionFigure, DistributionFigure, ObservationBoundaryFigure, WarmupSequenceFigure } from './BaselineFigures'

describe('baseline evidence figures', () => {
  it('changes only the selected measurement window while retaining raw events', async () => {
    const user = userEvent.setup()
    const { container } = render(<ObservationBoundaryFigure />)
    const ruler = container.querySelector('.boundary-ruler')
    expect(ruler).toHaveAttribute('data-event-count', '9')
    expect(screen.getByText('80 ms', { selector: '.window-readout strong' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '设备执行' }))
    expect(screen.getByText('47 ms', { selector: '.window-readout strong' })).toBeInTheDocument()
    expect(ruler).toHaveAttribute('data-event-count', '9')
  })

  it('keeps device work in flight after the host function returns', async () => {
    const user = userEvent.setup()
    render(<AsyncCompletionFigure />)
    await user.click(screen.getByRole('button', { name: '下一事件' }))
    expect(screen.getByText('提交函数返回')).toBeInTheDocument()
    expect(screen.getByText('仍在途')).toBeInTheDocument()
    expect(screen.getByText('已结束：2 ms')).toBeInTheDocument()
  })

  it('keeps all warm-up samples visible when changing the deployment question', async () => {
    const user = userEvent.setup()
    const { container } = render(<WarmupSequenceFigure />)
    await user.click(screen.getByRole('button', { name: '稳态' }))
    expect(screen.getByText('稳态问题：声明预热边界')).toBeInTheDocument()
    expect(container.querySelectorAll('.run-strip li')).toHaveLength(12)
    expect(container.querySelectorAll('.run-strip li.is-warmup')).toHaveLength(4)

    await user.click(screen.getByRole('button', { name: '事后删除' }))
    expect(screen.getByText('事后删样本：结论不可复核')).toBeInTheDocument()
    expect(container.querySelectorAll('.run-strip li')).toHaveLength(12)
  })

  it('preserves raw points when the summary flips from center to tail', async () => {
    const user = userEvent.setup()
    render(<DistributionFigure />)
    expect(screen.getByText('B', { selector: '.distribution-verdict strong' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'P90' }))
    expect(screen.getByText('A', { selector: '.distribution-verdict strong' })).toBeInTheDocument()
    expect(screen.getByText(/慢端判断翻转/)).toBeInTheDocument()
    expect(within(screen.getByLabelText('实现 A 的十个原始样本')).getAllByTitle(/ms/)).toHaveLength(10)
    expect(within(screen.getByLabelText('实现 B 的十个原始样本')).getAllByTitle(/ms/)).toHaveLength(10)
  })

  it('computes the documented distribution summaries deterministically', () => {
    expect(mean(distributionRuns.A)).toBeCloseTo(100.9)
    expect(mean(distributionRuns.B)).toBeCloseTo(94.6)
    expect(median(distributionRuns.A)).toBe(100.5)
    expect(median(distributionRuns.B)).toBe(89)
    expect(nearestRankPercentile(distributionRuns.A, 90)).toBe(104)
    expect(nearestRankPercentile(distributionRuns.B, 90)).toBe(120)
  })

  it('starts the asynchronous trace paused under reduced motion', () => {
    const originalMatchMedia = window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({ matches: true, addEventListener: () => undefined, removeEventListener: () => undefined }),
    })
    render(<AsyncCompletionFigure />)
    expect(screen.getByRole('button', { name: '继续动画' })).toBeInTheDocument()
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: originalMatchMedia })
  })

  it('exposes every figure mode as a keyboard reachable button', async () => {
    const user = userEvent.setup()
    render(<ObservationBoundaryFigure />)
    await user.tab()
    expect(screen.getByRole('button', { name: '客户端' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: '服务端' })).toHaveFocus()
  })
})
