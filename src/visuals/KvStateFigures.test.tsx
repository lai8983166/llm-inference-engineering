import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AttentionHistoryFigure, PoolIntervalFigure } from './KvStateFigures'
import { buildKvTrace } from '@/learning/kvStateTrace'

describe('chapter three history dependency figure', () => {
  it('keeps the same token history and semantic boundary in both modes', async () => {
    const user = userEvent.setup()
    render(<AttentionHistoryFigure />)
    await user.click(screen.getByRole('button', { name: '暂停动画' }))

    expect(screen.getByText('重算历史', { selector: '.trace-readout strong' })).toBeInTheDocument()
    expect(screen.getByText('0…6，共 7 个')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '复用历史' }))
    expect(screen.getByText('复用历史', { selector: '.trace-readout strong' })).toBeInTheDocument()
    expect(screen.getByText('0…6，共 7 个')).toBeInTheDocument()
    expect(screen.getByText('scores · context · logits（即抛）')).toBeInTheDocument()
    expect(screen.getByText(/不据此声称任何速度差异/)).toBeInTheDocument()
  })

  it('advances decode steps and phases without changing the completion ledger', async () => {
    const user = userEvent.setup()
    const { container } = render(<AttentionHistoryFigure />)
    await user.click(screen.getByRole('button', { name: '暂停动画' }))

    await user.click(screen.getByRole('button', { name: 'decode 3' }))
    expect(screen.getByText('0…8，共 9 个')).toBeInTheDocument()
    expect(screen.getByText('10 个 token · 1280 bytes')).toBeInTheDocument()

    for (let index = 0; index < 3; index += 1) await user.click(screen.getByRole('button', { name: '下一步' }))
    expect(container.querySelectorAll('.kv-phase-row.is-revealed')).toHaveLength(4)
    expect(container.querySelector('.kv-phase-row.is-current')).toHaveTextContent('缓存写入')
    await user.click(screen.getByRole('button', { name: '上一步' }))
    expect(container.querySelector('.kv-phase-row.is-current')).toHaveTextContent('本步中间量')
  })
})

describe('chapter three pool interval figure', () => {
  it('derives every cell from the domain trace in both strategies', async () => {
    const user = userEvent.setup()
    const { container } = render(<PoolIntervalFigure />)
    await user.click(screen.getByRole('button', { name: '暂停动画' }))

    const expectedCells = (strategy: 'max-reservation' | 'on-demand-growth') => {
      const trace = buildKvTrace(strategy)
      return trace.poolSnapshots[0].intervals.reduce((total, interval) => total + interval.capacityTokens, 0)
    }
    expect(container.querySelectorAll('.address-band > li')).toHaveLength(expectedCells('max-reservation'))
    await user.click(screen.getByRole('button', { name: '按需增长' }))
    expect(container.querySelectorAll('.address-band > li')).toHaveLength(expectedCells('on-demand-growth'))
    expect(screen.getByText(/不是 CUDA 地址/)).toBeInTheDocument()
  })

  it('steps to the over-reservation rejection in the max-reservation trace', async () => {
    const user = userEvent.setup()
    render(<PoolIntervalFigure />)
    await user.click(screen.getByRole('button', { name: '暂停动画' }))

    for (let index = 0; index < 4; index += 1) await user.click(screen.getByRole('button', { name: '下一步' }))
    const readout = screen.getByText('最大预留', { selector: '.trace-readout strong' }).parentElement!
    expect(within(readout).getByText('R-short · 拒绝')).toBeInTheDocument()
  })

  it('shows the migration double-hold and the fragmented pool in the on-demand trace', async () => {
    const user = userEvent.setup()
    const { container } = render(<PoolIntervalFigure />)
    await user.click(screen.getByRole('button', { name: '暂停动画' }))
    await user.click(screen.getByRole('button', { name: '按需增长' }))

    for (let index = 0; index < 6; index += 1) await user.click(screen.getByRole('button', { name: '下一步' }))
    expect(container.querySelectorAll('.address-band > li[data-role="migration-source"]')).toHaveLength(7)
    const readout = screen.getByText('按需增长', { selector: '.trace-readout strong' }).parentElement!
    expect(within(readout).getByText('R-long · 搬迁开始 · [10+8]')).toBeInTheDocument()
    // 搬迁开始时新区间已划出但尚未写入：双份存活 = 旧区间 7 + 空新区间 8。
    expect(container.querySelectorAll('.address-band > li[data-role="reserved-unused"]')).toHaveLength(8)

    await user.click(screen.getByRole('button', { name: '下一步' }))
    expect(within(readout).getByText('R-long · 复制完成 · [10+8]')).toBeInTheDocument()
    expect(container.querySelectorAll('.address-band > li[data-role="used"]')).toHaveLength(11)

    for (let index = 0; index < 5; index += 1) await user.click(screen.getByRole('button', { name: '下一步' }))
    expect(within(readout).getByText('16 / 24 units · 最大连续 10')).toBeInTheDocument()
  })

  it('starts both figures paused when reduced motion is preferred', () => {
    const originalMatchMedia = window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({ matches: true, addEventListener: () => undefined, removeEventListener: () => undefined }),
    })
    render(<><AttentionHistoryFigure /><PoolIntervalFigure /></>)
    expect(screen.getAllByRole('button', { name: '继续动画' })).toHaveLength(2)
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: originalMatchMedia })
  })

  it('exposes mode and playback controls to keyboard focus', async () => {
    const user = userEvent.setup()
    render(<PoolIntervalFigure />)
    await user.tab()
    expect(screen.getByRole('button', { name: '最大预留' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: '按需增长' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: '暂停动画' })).toHaveFocus()
  })
})
