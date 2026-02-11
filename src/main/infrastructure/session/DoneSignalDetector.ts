import { COVE_DONE_SIGNAL_MARKER } from '../../../shared/constants/signal'
import type { AgentProviderId } from '../../../shared/types/api'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

function extractTextContentItems(content: unknown, expectedType: 'text' | 'output_text'): string[] {
  if (!Array.isArray(content)) {
    return []
  }

  return content
    .map(item => {
      if (!isRecord(item) || item.type !== expectedType) {
        return null
      }

      const text = item.text
      return typeof text === 'string' ? text : null
    })
    .filter((text): text is string => typeof text === 'string' && text.length > 0)
}

function detectClaudeDoneSignal(parsed: unknown): boolean {
  if (!isRecord(parsed) || parsed.type !== 'assistant') {
    return false
  }

  const message = parsed.message
  if (!isRecord(message)) {
    return false
  }

  const stopReason = message.stop_reason
  if (stopReason === null || typeof stopReason === 'undefined') {
    return false
  }

  const texts = extractTextContentItems(message.content, 'text')
  if (texts.length === 0) {
    return false
  }

  return texts.join('\n').includes(COVE_DONE_SIGNAL_MARKER)
}

function detectCodexDoneSignal(parsed: unknown): boolean {
  if (!isRecord(parsed) || parsed.type !== 'response_item') {
    return false
  }

  const payload = parsed.payload
  if (!isRecord(payload)) {
    return false
  }

  if (payload.type !== 'message' || payload.role !== 'assistant') {
    return false
  }

  const texts = extractTextContentItems(payload.content, 'output_text')
  if (texts.length === 0) {
    return false
  }

  return texts.join('\n').includes(COVE_DONE_SIGNAL_MARKER)
}

export function detectDoneSignalFromSessionRecord(
  provider: AgentProviderId,
  parsed: unknown,
): boolean {
  if (provider === 'claude-code') {
    return detectClaudeDoneSignal(parsed)
  }

  return detectCodexDoneSignal(parsed)
}

export function detectDoneSignalFromSessionLine(provider: AgentProviderId, line: string): boolean {
  const trimmed = line.trim()
  if (trimmed.length === 0) {
    return false
  }

  try {
    const parsed = JSON.parse(trimmed)
    return detectDoneSignalFromSessionRecord(provider, parsed)
  } catch {
    return false
  }
}
