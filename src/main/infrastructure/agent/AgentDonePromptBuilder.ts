import { COVE_DONE_SIGNAL_MARKER } from '../../../shared/constants/signal'

function normalizePrompt(prompt: string): string {
  return prompt.trim()
}

export function buildDoneSignalPrompt(prompt: string): string {
  const normalizedPrompt = normalizePrompt(prompt)

  return [
    'You are an autonomous coding agent executing the user request below.',
    '',
    'Completion protocol (strict):',
    `1) Only when the request is fully completed, output \`${COVE_DONE_SIGNAL_MARKER}\` exactly once.`,
    `2) If anything is incomplete or clarification is needed, do NOT output \`${COVE_DONE_SIGNAL_MARKER}\`.`,
    '3) Place the marker on its own line as the final line of your response.',
    '',
    'User request:',
    normalizedPrompt,
  ].join('\n')
}
