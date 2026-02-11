import { describe, expect, it } from 'vitest'
import { detectDoneSignalFromSessionLine } from '../../../src/main/infrastructure/session/DoneSignalDetector'

describe('detectDoneSignalFromSessionLine', () => {
  it('detects DONE from completed claude assistant response', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: {
        stop_reason: 'end_turn',
        content: [
          {
            type: 'text',
            text: 'Implemented all requested changes. [[[COVE_DONE]]]',
          },
        ],
      },
    })

    expect(detectDoneSignalFromSessionLine('claude-code', line)).toBe(true)
  })

  it('ignores claude streaming chunks without stop reason', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: {
        stop_reason: null,
        content: [
          {
            type: 'text',
            text: 'Partial chunk [[[COVE_DONE]]]',
          },
        ],
      },
    })

    expect(detectDoneSignalFromSessionLine('claude-code', line)).toBe(false)
  })

  it('detects DONE from codex response_item assistant message', () => {
    const line = JSON.stringify({
      type: 'response_item',
      payload: {
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'output_text',
            text: 'All tasks complete [[[COVE_DONE]]]',
          },
        ],
      },
    })

    expect(detectDoneSignalFromSessionLine('codex', line)).toBe(true)
  })

  it('ignores codex assistant stream event without stop boundary', () => {
    const line = JSON.stringify({
      type: 'event_msg',
      payload: {
        type: 'agent_message',
        message: 'Thinking... [[[COVE_DONE]]]',
      },
    })

    expect(detectDoneSignalFromSessionLine('codex', line)).toBe(false)
  })

  it('returns false for invalid json lines', () => {
    expect(detectDoneSignalFromSessionLine('claude-code', '{invalid')).toBe(false)
  })
})
