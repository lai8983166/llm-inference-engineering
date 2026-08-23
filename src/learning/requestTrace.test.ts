import { runTrace } from './requestTrace'

describe('request cancellation trace', () => {
  it('suppresses output when cancellation wins before decode completion', () => {
    const frames = runTrace('cancel-first')
    expect(frames.map((frame) => frame.event)).toEqual(['cancel', 'decode-completes', 'emit-y2', 'cleanup'])
    expect(frames[1].state.preparedOutput).toBe('discarded')
    expect(frames.at(-1)?.state).toMatchObject({
      visibleTokens: ['y1'], terminalReason: 'cancelled', inFlight: false,
      kv: 'released', stream: 'closed', releaseCount: 1,
    })
  })

  it('keeps already committed output when sending wins first', () => {
    const frames = runTrace('send-first')
    expect(frames.at(-1)?.state).toMatchObject({
      visibleTokens: ['y1', 'y2'], terminalReason: 'cancelled', inFlight: false,
      kv: 'released', stream: 'closed', releaseCount: 1,
    })
  })

  it('never releases KV while device work is in flight', () => {
    for (const scenario of ['cancel-first', 'send-first'] as const) {
      for (const frame of runTrace(scenario)) {
        if (frame.state.inFlight) expect(frame.state.kv).toBe('held')
      }
    }
  })
})
