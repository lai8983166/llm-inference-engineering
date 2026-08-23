import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TracePractice } from './TracePractice'

describe('cancellation trace practice', () => {
  it('requires a prediction and reports the first mismatch without recording mastery', async () => {
    const user = userEvent.setup()
    const storageWrite = vi.spyOn(Storage.prototype, 'setItem')
    render(<TracePractice />)

    const advance = screen.getByRole('button', { name: '核对第一个事件' })
    expect(advance).toBeDisabled()

    await user.click(screen.getByLabelText('y1 和 y2'))
    for (let index = 0; index < 4; index += 1) {
      await user.click(screen.getByRole('button'))
    }

    expect(screen.getByText(/第一处分歧在 cancel/)).toBeInTheDocument()
    expect(screen.getByText('released / closed')).toBeInTheDocument()
    expect(storageWrite).not.toHaveBeenCalled()
    storageWrite.mockRestore()
  })

  it('preserves y2 when its send commits before cancellation', async () => {
    const user = userEvent.setup()
    render(<TracePractice />)

    await user.click(screen.getByLabelText('y2 先越过发送提交点'))
    await user.click(screen.getByLabelText('y1 和 y2'))
    for (let index = 0; index < 4; index += 1) await user.click(screen.getByRole('button'))

    expect(screen.getByText(/预测与事件顺序一致：客户端最终看见 y1 和 y2/)).toBeInTheDocument()
  })
})
