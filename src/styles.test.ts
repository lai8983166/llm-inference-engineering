import styles from './styles.css?raw'

describe('reading layout safeguards', () => {
  it('keeps long chapter artifacts scrollable and collapses state columns on narrow screens', () => {
    expect(styles).toMatch(/\.chapter-prose pre \{[^}]*overflow-x: auto/s)
    expect(styles).toMatch(/\.chapter-prose table \{[^}]*overflow-x: auto/s)
    expect(styles).toMatch(/@media \(max-width: 640px\)/)
    expect(styles).toMatch(/\.trace-state \{ grid-template-columns: 1fr; \}/)
  })

  it('honors reduced-motion preferences', () => {
    expect(styles).toMatch(/@media \(prefers-reduced-motion: reduce\)/)
  })
})
