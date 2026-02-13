export interface WorkspaceDirectory {
  id: string
  name: string
  path: string
}

export interface EnsureDirectoryInput {
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

export interface AttachTerminalInput {
  sessionId: string
}

export interface DetachTerminalInput {
  sessionId: string
}

export interface SnapshotTerminalInput {
  sessionId: string
}

export interface SnapshotTerminalResult {
  data: string
}

export interface TerminalDataEvent {
  sessionId: string
  data: string
}

export interface TerminalExitEvent {
  sessionId: string
  exitCode: number
}

export interface TerminalDoneEvent {
  sessionId: string
  signal: 'done'
}

export type AgentProviderId = 'claude-code' | 'codex'

export type AgentLaunchMode = 'new' | 'resume'

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
  source: 'claude-static' | 'codex-cli'
  fetchedAt: string
  models: AgentModelOption[]
  error: string | null
}

export interface LaunchAgentInput {
  provider: AgentProviderId
  cwd: string
  prompt: string
  mode?: AgentLaunchMode
  model?: string | null
  resumeSessionId?: string | null
  cols?: number
  rows?: number
}

export interface LaunchAgentResult {
  sessionId: string
  provider: AgentProviderId
  command: string
  args: string[]
  launchMode: AgentLaunchMode
  effectiveModel: string | null
  resumeSessionId: string | null
}

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface SuggestTaskTitleInput {
  provider: AgentProviderId
  cwd: string
  requirement: string
  model?: string | null
  availableTags?: string[]
}

export interface SuggestTaskTitleResult {
  title: string
  priority: TaskPriority
  tags: string[]
  provider: AgentProviderId
  effectiveModel: string | null
}
