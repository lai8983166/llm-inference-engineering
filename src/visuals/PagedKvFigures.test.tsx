import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BlockPoolEvolutionFigure, BlockTableTranslationFigure } from './PagedKvFigures'

describe('chapter four block table translation figure', () => {
  it('reads the same positions in both modes with different translation steps', async () => {
    const user = userEvent.setup()
    render(<BlockTableTranslationFigure />)
    await user.click(screen.getByRole('button', { name: '暂停动画' }))

    expect(screen.getByText('连续区间直读', { selector: '.trace-readout strong' })).toBeInTheDocument()
    expect(screen.getByText('直读：基地址 + p0')).toBeInTheDocument()
    expect(screen.getByText('0 次', { selector: 'dd' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '块表翻译' }))
    expect(screen.getByText('块表翻译', { selector: '.trace-readout strong' })).toBeInTheDocument()
    expect(screen.getByText('查表项 0 → B0，偏移 0')).toBeInTheDocument()
    expect(screen.getByText(/不据此声称任何速度差异/)).toBeInTheDocument()
  })

  it('walks positions through table entries with per-position translation', async () => {
    const user = userEvent.setup()
    const { container } = render(<BlockTableTranslationFigure />)
    await user.click(screen.getByRole('button', { name: '暂停动画' }))
    await user.click(screen.getByRole('button', { name: '块表翻译' }))

    for (let index = 0; index < 9; index += 1) await user.click(screen.getByRole('button', { name: '下一步' }))
    expect(screen.getByText('p9', { selector: '.trace-readout > span' })).toBeInTheDocument()
    expect(screen.getByText('查表项 2 → B2，偏移 1')).toBeInTheDocument()
    expect(container.querySelectorAll('.block-table-lane li.is-current')).toHaveLength(1)
    expect(container.querySelector('.physical-block-row li.is-hit')).toHaveTextContent('B2')
  })
})

describe('chapter four block pool evolution figure', () => {
  it('shows six blocks in block mode with zero migrations and block reuse', async () => {
    const user = userEvent.setup()
    const { container } = render(<BlockPoolEvolutionFigure />)
    await user.click(screen.getByRole('button', { name: '暂停动画' }))

    expect(container.querySelectorAll('.address-band > li')).toHaveLength(6)
    // 累计搬迁与累计拒绝都是 0：块池轨迹没有搬迁，也没有拒绝。
    expect(screen.getAllByText('0 次', { selector: 'dd' })).toHaveLength(2)

    for (let index = 0; index < 13; index += 1) await user.click(screen.getByRole('button', { name: '下一步' }))
    const readout = screen.getByText('固定块池', { selector: '.trace-readout strong' }).parentElement!
    expect(within(readout).getByText(/R-long · 分配块 · B2/)).toBeInTheDocument()
    // B2 刚被 R-long 从 R-short 归还的空闲池中取走，世代为 2。
    expect(container.querySelectorAll('.address-band > li[data-reused="true"]')).toHaveLength(1)

    for (let index = 0; index < 8; index += 1) await user.click(screen.getByRole('button', { name: '下一步' }))
    expect(within(readout).getByText(/空闲 1\/6 块/)).toBeInTheDocument()
  })

  it('switches to the contiguous baseline with its migration event', async () => {
    const user = userEvent.setup()
    const { container } = render(<BlockPoolEvolutionFigure />)
    await user.click(screen.getByRole('button', { name: '暂停动画' }))
    await user.click(screen.getByRole('button', { name: '连续按需' }))

    expect(container.querySelectorAll('.address-band > li')).toHaveLength(24)
    const readout = screen.getByText('连续按需', { selector: '.trace-readout strong' }).parentElement!
    expect(within(readout).getByText('1 次', { selector: 'dd' })).toBeInTheDocument()

    for (let index = 0; index < 6; index += 1) await user.click(screen.getByRole('button', { name: '下一步' }))
    expect(within(readout).getByText(/R-long · 搬迁开始 · \[10\+8\]/)).toBeInTheDocument()
    expect(container.querySelectorAll('.address-band > li[data-role="migration-source"]')).toHaveLength(7)
    expect(screen.getByText(/不是真实显存块地址/)).toBeInTheDocument()
  })

  it('starts both figures paused when reduced motion is preferred', () => {
    const originalMatchMedia = window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({ matches: true, addEventListener: () => undefined, removeEventListener: () => undefined }),
    })
    render(<><BlockTableTranslationFigure /><BlockPoolEvolutionFigure /></>)
    expect(screen.getAllByRole('button', { name: '继续动画' })).toHaveLength(2)
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: originalMatchMedia })
  })

  it('exposes mode and playback controls to keyboard focus', async () => {
    const user = userEvent.setup()
    render(<BlockPoolEvolutionFigure />)
    await user.tab()
    expect(screen.getByRole('button', { name: '固定块池' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: '连续按需' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: '暂停动画' })).toHaveFocus()
  })
})
