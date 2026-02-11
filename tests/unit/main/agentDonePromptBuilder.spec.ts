import { describe, expect, it } from 'vitest'
import { COVE_DONE_SIGNAL_MARKER } from '../../../src/shared/constants/signal'
import { buildDoneSignalPrompt } from '../../../src/main/infrastructure/agent/AgentDonePromptBuilder'

describe('buildDoneSignalPrompt', () => {
  it('embeds strict DONE marker protocol and user request', () => {
    const prompt = buildDoneSignalPrompt('Implement workspace switch persistence')

    expect(prompt).toContain('Completion protocol (strict):')
    expect(prompt).toContain(COVE_DONE_SIGNAL_MARKER)
    expect(prompt).toContain('User request:')
    expect(prompt).toContain('Implement workspace switch persistence')
  })

  it('trims user request text', () => {
    const prompt = buildDoneSignalPrompt('  Add retry with jitter  ')

    expect(prompt).toContain('Add retry with jitter')
    expect(prompt).not.toContain('  Add retry with jitter  ')
  })
})
