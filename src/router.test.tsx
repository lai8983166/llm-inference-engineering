import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { routes } from './router'

function renderRoute(path: string) {
  const testRouter = createMemoryRouter(routes, { initialEntries: [path] })
  return render(<RouterProvider router={testRouter} />)
}

describe('minimal course routes', () => {
  it('renders the focused course entry', () => {
    renderRoute('/')
    expect(screen.getByRole('heading', { level: 1, name: '从一次请求开始，推导推理系统' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /阅读第 01 章/ })).toHaveAttribute('href', '/chapters/single-request')
  })

  it('renders one continuous chapter reading surface', () => {
    renderRoute('/chapters/single-request')
    expect(screen.getByRole('heading', { level: 1, name: '一次请求怎样活着' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: '本章内容' })).toBeInTheDocument()
    expect(document.querySelectorAll('.chapter-prose > h2')).toHaveLength(5)
    expect(document.querySelectorAll('.chapter-prose')).toHaveLength(1)
    expect(document.querySelectorAll('[class*="card"]')).toHaveLength(0)
    const finalBodyHeading = screen.getByRole('heading', { level: 2, name: '结束不是一个瞬间' })
    const practiceHeading = screen.getByRole('heading', { level: 2, name: '推演一次取消' })
    expect(finalBodyHeading.compareDocumentPosition(practiceHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: '用新场景验收' })).toBeInTheDocument()
    expect(screen.queryByText(/学习进度|掌握率/)).not.toBeInTheDocument()
  })
})
