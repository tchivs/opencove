import type { AgentLaunchMode, AgentProviderId } from '../../../shared/types/api'

interface BuildAgentLaunchCommandInput {
  provider: AgentProviderId
  mode: AgentLaunchMode
  prompt?: string
  model: string | null
  resumeSessionId: string | null
}

export interface AgentLaunchCommand {
  command: string
  args: string[]
  launchMode: AgentLaunchMode
  effectiveModel: string | null
  resumeSessionId: string | null
}

const CLAUDE_SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function normalizeOptionalValue(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function normalizeClaudeResumeSessionId(value: string | null): string | null {
  if (!value) {
    return null
  }

  return CLAUDE_SESSION_ID_PATTERN.test(value) ? value : null
}

function normalizePrompt(value: string | undefined): string {
  const normalized = typeof value === 'string' ? value.trim() : ''

  if (normalized.length === 0) {
    throw new Error('Agent prompt cannot be empty')
  }

  return normalized
}

export function buildAgentLaunchCommand(input: BuildAgentLaunchCommandInput): AgentLaunchCommand {
  const effectiveModel = normalizeOptionalValue(input.model)
  const normalizedResumeSessionId = normalizeOptionalValue(input.resumeSessionId)

  if (input.provider === 'claude-code') {
    const resumeSessionId = normalizeClaudeResumeSessionId(normalizedResumeSessionId)
    const args = ['--dangerously-skip-permissions']

    if (effectiveModel) {
      args.push('--model', effectiveModel)
    }

    if (input.mode === 'resume') {
      if (resumeSessionId) {
        args.push('--resume', resumeSessionId)
      } else {
        args.push('--continue')
      }

      return {
        command: 'claude',
        args,
        launchMode: 'resume',
        effectiveModel,
        resumeSessionId,
      }
    }

    args.push(normalizePrompt(input.prompt))

    return {
      command: 'claude',
      args,
      launchMode: 'new',
      effectiveModel,
      resumeSessionId: null,
    }
  }

  if (input.mode === 'resume') {
    const args = ['resume']

    if (normalizedResumeSessionId) {
      args.push(normalizedResumeSessionId)
    } else {
      args.push('--last')
    }

    if (effectiveModel) {
      args.push('--model', effectiveModel)
    }

    return {
      command: 'codex',
      args,
      launchMode: 'resume',
      effectiveModel,
      resumeSessionId: normalizedResumeSessionId,
    }
  }

  const args = ['--full-auto']

  if (effectiveModel) {
    args.push('--model', effectiveModel)
  }

  args.push(normalizePrompt(input.prompt))

  return {
    command: 'codex',
    args,
    launchMode: 'new',
    effectiveModel,
    resumeSessionId: null,
  }
}
