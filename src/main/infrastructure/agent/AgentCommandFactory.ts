import type { AgentLaunchMode, AgentProviderId } from '../../../shared/types/api'

interface BuildAgentLaunchCommandInput {
  provider: AgentProviderId
  mode: AgentLaunchMode
  prompt?: string
  model: string | null
  resumeSessionId: string | null
  agentFullAccess?: boolean
}

export interface AgentLaunchCommand {
  command: string
  args: string[]
  launchMode: AgentLaunchMode
  effectiveModel: string | null
  resumeSessionId: string | null
}

function normalizeOptionalValue(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function normalizePrompt(value: string | undefined): string {
  return typeof value === 'string' ? value.trim() : ''
}

function maybeTerminateOptionParsing(args: string[], value: string): void {
  if (value.startsWith('-')) {
    args.push('--')
  }
}

export function buildAgentLaunchCommand(input: BuildAgentLaunchCommandInput): AgentLaunchCommand {
  const effectiveModel = normalizeOptionalValue(input.model)
  const resumeSessionId = normalizeOptionalValue(input.resumeSessionId)
  const agentFullAccess = input.agentFullAccess ?? true

  if (input.provider === 'claude-code') {
    const args: string[] = []

    if (agentFullAccess) {
      args.push('--dangerously-skip-permissions')
    }

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

    const prompt = normalizePrompt(input.prompt)
    if (prompt.length > 0) {
      maybeTerminateOptionParsing(args, prompt)
      args.push(prompt)
    }

    return {
      command: 'claude',
      args,
      launchMode: 'new',
      effectiveModel,
      resumeSessionId: null,
    }
  }

  if (input.mode === 'resume') {
    const args = [
      agentFullAccess ? '--dangerously-bypass-approvals-and-sandbox' : '--full-auto',
      'resume',
    ]

    if (resumeSessionId) {
      args.push(resumeSessionId)
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
      resumeSessionId,
    }
  }

  const args = [agentFullAccess ? '--dangerously-bypass-approvals-and-sandbox' : '--full-auto']

  if (effectiveModel) {
    args.push('--model', effectiveModel)
  }

  const prompt = normalizePrompt(input.prompt)
  if (prompt.length > 0) {
    maybeTerminateOptionParsing(args, prompt)
    args.push(prompt)
  }

  return {
    command: 'codex',
    args,
    launchMode: 'new',
    effectiveModel,
    resumeSessionId: null,
  }
}
