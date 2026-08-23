import styles from './styles.css?raw'

describe('reading layout safeguards', () => {
  it('keeps long chapter artifacts scrollable and collapses state columns on narrow screens', () => {
    expect(styles).toMatch(/\.chapter-prose pre \{[^}]*overflow-x: auto/s)
    expect(styles).toMatch(/\.chapter-prose table \{[^}]*overflow-x: auto/s)
    expect(styles).toMatch(/@media \(max-width: 760px\)/)
    expect(styles).toMatch(/\.trace-state \{ grid-template-columns: 1fr; \}/)
  })

  it('honors reduced-motion preferences', () => {
    expect(styles).toMatch(/@media \(prefers-reduced-motion: reduce\)/)
    expect(styles).toMatch(/animation-duration: 0\.001ms !important/)
  })

  it('does not leak dark prose emphasis into dark figure panels', () => {
    expect(styles).toMatch(/\.chapter-prose \.concept-figure strong \{ box-shadow: none; \}/)
    expect(styles).toMatch(/\.timeline-explanation > strong \{ color: white;/)
    expect(styles).toMatch(/\.resource-gate div strong \{ color: white;/)
    expect(styles).toMatch(/\.evidence-header strong \{ color: white;/)
  })

  it('keeps evidence timelines inspectable on narrow screens', () => {
    expect(styles).toMatch(/\.boundary-workbench \{ overflow-x: auto;/)
    expect(styles).toMatch(/\.distribution-workbench \{ overflow-x: auto;/)
    expect(styles).toMatch(/\.timing-workbench \{ overflow-x: auto;/)
    expect(styles).toMatch(/\.request-device-workbench \{ overflow-x: auto;/)
    expect(styles).toMatch(/\.batch-occupancy-workbench \{ overflow-x: auto;/)
    expect(styles).toMatch(/\.chapter-navigation \{ grid-template-columns: 1fr; margin-top: 84px; \}/)
  })
})
