export interface WorkspaceDirectory {
  id: string
  name: string
  path: string
}

export interface PseudoTerminalSession {
  sessionId: string
}

export interface SpawnTerminalInput {
  cwd: string
  shell?: string
  cols: number
  rows: number
}

export interface WriteTerminalInput {
  sessionId: string
  data: string
}

export interface ResizeTerminalInput {
  sessionId: string
  cols: number
  rows: number
}

export interface KillTerminalInput {
  sessionId: string
}

export interface TerminalDataEvent {
  sessionId: string
  data: string
}

export interface TerminalExitEvent {
  sessionId: string
  exitCode: number
}

export type AgentProviderId = 'claude-code' | 'codex'

export interface ListAgentModelsInput {
  provider: AgentProviderId
}

export interface AgentModelOption {
  id: string
  displayName: string
  description: string
  isDefault: boolean
}

export interface ListAgentModelsResult {
  provider: AgentProviderId
  source: 'claude-api' | 'codex-cli'
  fetchedAt: string
  models: AgentModelOption[]
  error: string | null
}
