import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HitAdmissionFigure, SharedLifecycleFigure } from './PrefixCacheFigures'

describe('chapter ten shared lifecycle figure', () => {
  it('renders the five-block band with rc badges from the trace', async () => {
    const user = userEvent.setup()
    const { container } = render(<SharedLifecycleFigure />)
    await user.click(screen.getByRole('button', { name: '暂停动画' }))

    expect(container.querySelectorAll('.lifecycle-row')).toHaveLength(5)
    // t1：B0 共享 rc2（S-b 命中）。
    await user.click(container.querySelectorAll('.lifecycle-head button')[1])
    expect(container.querySelector('.lifecycle-row [data-role="shared"][data-rc="2"]')).not.toBeNull()
    // t4：B0 转缓存 rc0。
    await user.click(container.querySelectorAll('.lifecycle-head button')[4])
    expect(container.querySelector('.lifecycle-row [data-role="cached"][data-rc="0"]')).not.toBeNull()
    expect(screen.getByText(/不是真实显存或收益/)).toBeInTheDocument()
  })

  it('shows the eviction tick in the readout', async () => {
    const user = userEvent.setup()
    render(<SharedLifecycleFigure />)
    await user.click(screen.getByRole('button', { name: '暂停动画' }))
    for (let index = 0; index < 6; index += 1) await user.click(screen.getByRole('button', { name: '下一步' }))
    const readout = screen.getByText('本拍事件', { selector: '.trace-readout strong' }).parentElement!
    expect(within(readout).getByText(/block-evicted/)).toBeInTheDocument()
  })

  it('starts paused under reduced motion and exposes keyboard focus', async () => {
    const user = userEvent.setup()
    const originalMatchMedia = window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({ matches: true, addEventListener: () => undefined, removeEventListener: () => undefined }),
    })
    render(<SharedLifecycleFigure />)
    expect(screen.getByRole('button', { name: '继续动画' })).toBeInTheDocument()
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: originalMatchMedia })

    await user.tab()
    expect(screen.getByRole('button', { name: '继续动画' })).toHaveFocus()
  })
})

describe('chapter ten hit admission figure', () => {
  it('shows the no-cache queue wait from the trace', async () => {
    const user = userEvent.setup()
    const { container } = render(<HitAdmissionFigure />)
    await user.click(screen.getByRole('button', { name: '暂停动画' }))

    expect(screen.getByText('S-c 排队一拍，t3 准入', { selector: '.trace-readout strong' })).toBeInTheDocument()
    const readout = screen.getByText('S-c 排队一拍，t3 准入', { selector: '.trace-readout strong' }).parentElement!
    expect(within(readout).getByText('首执行 t3 · 完成 t3')).toBeInTheDocument()
    expect(container.querySelectorAll('.hit-strip-row .strip-cell')).toHaveLength(7)
  })

  it('switches to prefix-cache with hit, earlier admission, and eviction', async () => {
    const user = userEvent.setup()
    render(<HitAdmissionFigure />)
    await user.click(screen.getByRole('button', { name: '暂停动画' }))
    await user.click(screen.getByRole('button', { name: '前缀缓存' }))

    expect(screen.getByText('S-b 命中省 1 块，S-c 当拍准入', { selector: '.trace-readout strong' })).toBeInTheDocument()
    const readout = screen.getByText('S-b 命中省 1 块，S-c 当拍准入', { selector: '.trace-readout strong' }).parentElement!
    expect(within(readout).getByText('首执行 t2 · 完成 t2')).toBeInTheDocument()
    expect(within(readout).getByText(/· 命中/)).toBeInTheDocument()
    expect(within(readout).getByText('1/2 = 0.5')).toBeInTheDocument()
    expect(screen.getByText(/S-d 需 5 块逐出缓存块/)).toBeInTheDocument()
    expect(screen.getByText('S-b 命中')).toBeInTheDocument()
    expect(screen.getByText('S-d 逐出')).toBeInTheDocument()
    expect(screen.getByText(/真实收益必须实测/)).toBeInTheDocument()
  })

  it('exposes policy switches to keyboard focus', async () => {
    const user = userEvent.setup()
    render(<HitAdmissionFigure />)
    await user.tab()
    expect(screen.getByRole('button', { name: '无缓存' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: '前缀缓存' })).toHaveFocus()
  })
})
