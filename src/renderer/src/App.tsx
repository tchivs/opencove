import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { SettingsPanel } from './features/settings/components/SettingsPanel'
import {
  AGENT_PROVIDERS,
  AGENT_PROVIDER_LABEL,
  DEFAULT_AGENT_SETTINGS,
  resolveAgentModel,
  type AgentProvider,
  type AgentSettings,
} from './features/settings/agentConfig'
import { WorkspaceCanvas } from './features/workspace/components/WorkspaceCanvas'
import type {
  PersistedWorkspaceState,
  TaskRuntimeStatus,
  TerminalNodeData,
  WorkspaceViewport,
  WorkspaceState,
} from './features/workspace/types'
import {
  DEFAULT_WORKSPACE_MINIMAP_VISIBLE,
  DEFAULT_WORKSPACE_VIEWPORT,
} from './features/workspace/types'
import {
  readPersistedState,
  toPersistedState,
  writePersistedState,
} from './features/workspace/utils/persistence'
import { toRuntimeNodes } from './features/workspace/utils/nodeTransform'

interface ProviderModelCatalogEntry {
  models: string[]
  source: string | null
  fetchedAt: string | null
  isLoading: boolean
  error: string | null
}

type ProviderModelCatalog = Record<AgentProvider, ProviderModelCatalogEntry>

interface FocusRequest {
  workspaceId: string
  nodeId: string
  sequence: number
}

function createInitialModelCatalog(): ProviderModelCatalog {
  return {
    'claude-code': {
      models: [],
      source: null,
      fetchedAt: null,
      isLoading: false,
      error: null,
    },
    codex: {
      models: [],
      source: null,
      fetchedAt: null,
      isLoading: false,
      error: null,
    },
  }
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (typeof error === 'string' && error.length > 0) {
    return error
  }

  return 'Unknown error'
}

function toAgentNodeTitle(provider: AgentProvider, model: string | null): string {
  const providerTitle = provider === 'codex' ? 'codex' : 'claude'
  return `${providerTitle} · ${model ?? 'default-model'}`
}

function toRelativeTime(iso: string | null): string {
  if (!iso) {
    return 'just now'
  }

  const timestamp = Date.parse(iso)
  if (Number.isNaN(timestamp)) {
    return 'just now'
  }

  const deltaSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000))
  if (deltaSeconds < 60) {
    return 'just now'
  }

  if (deltaSeconds < 3600) {
    return `${Math.floor(deltaSeconds / 60)}m ago`
  }

  if (deltaSeconds < 86400) {
    return `${Math.floor(deltaSeconds / 3600)}h ago`
  }

  return `${Math.floor(deltaSeconds / 86400)}d ago`
}

type SidebarAgentStatus = 'working' | 'standby'

type SidebarTaskStatus = TaskRuntimeStatus | 'none'

type SidebarStatusTone = 'working' | 'standby' | 'todo' | 'done' | 'done-strong'

const SIDEBAR_AGENT_STATUS_LABEL: Record<SidebarAgentStatus, string> = {
  working: 'Working',
  standby: 'Standby',
}

const SIDEBAR_TASK_STATUS_LABEL: Record<SidebarTaskStatus, string> = {
  todo: 'TODO',
  doing: 'DOING',
  ai_done: 'AI_DONE',
  done: 'DONE',
  none: 'N/A',
}

function resolveSidebarAgentStatus(runtimeStatus: TerminalNodeData['status']): SidebarAgentStatus {
  if (runtimeStatus === 'running' || runtimeStatus === 'restoring') {
    return 'working'
  }

  return 'standby'
}

function resolveSidebarTaskStatusTone(taskStatus: SidebarTaskStatus): SidebarStatusTone {
  switch (taskStatus) {
    case 'doing':
      return 'working'
    case 'ai_done':
      return 'done'
    case 'done':
      return 'done-strong'
    case 'todo':
    case 'none':
    default:
      return 'todo'
  }
}

function createDefaultWorkspaceViewport(): WorkspaceViewport {
  return {
    x: DEFAULT_WORKSPACE_VIEWPORT.x,
    y: DEFAULT_WORKSPACE_VIEWPORT.y,
    zoom: DEFAULT_WORKSPACE_VIEWPORT.zoom,
  }
}

function App(): React.JSX.Element {
  const [workspaces, setWorkspaces] = useState<WorkspaceState[]>([])
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null)
  const [agentSettings, setAgentSettings] = useState<AgentSettings>(DEFAULT_AGENT_SETTINGS)
  const [providerModelCatalog, setProviderModelCatalog] = useState<ProviderModelCatalog>(() =>
    createInitialModelCatalog(),
  )
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isHydrated, setIsHydrated] = useState(false)
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null)

  useEffect(() => {
    const persisted = readPersistedState()
    if (!persisted) {
      setIsHydrated(true)
      return
    }

    setAgentSettings(persisted.settings)

    if (persisted.workspaces.length === 0) {
      setIsHydrated(true)
      return
    }

    const hasActiveWorkspace = persisted.workspaces.some(
      workspace => workspace.id === persisted.activeWorkspaceId,
    )
    const resolvedActiveWorkspaceId = hasActiveWorkspace
      ? persisted.activeWorkspaceId
      : (persisted.workspaces[0]?.id ?? null)

    setWorkspaces(
      persisted.workspaces.map(workspace => ({
        id: workspace.id,
        name: workspace.name,
        path: workspace.path,
        nodes: [],
        viewport: {
          x: workspace.viewport.x,
          y: workspace.viewport.y,
          zoom: workspace.viewport.zoom,
        },
        isMinimapVisible: workspace.isMinimapVisible,
      })),
    )
    setActiveWorkspaceId(resolvedActiveWorkspaceId)

    let isCancelled = false

    const hydrateWorkspace = async (
      workspace: PersistedWorkspaceState,
    ): Promise<WorkspaceState> => {
      const runtimeNodes = toRuntimeNodes(workspace)

      const hydratedNodeResults = await Promise.allSettled(
        runtimeNodes.map(async node => {
          if (node.data.kind === 'task') {
            return {
              ...node,
              data: {
                ...node.data,
                sessionId: '',
                status: null,
                startedAt: null,
                endedAt: null,
                exitCode: null,
                lastError: null,
                scrollback: null,
                agent: null,
              },
            }
          }

          if (node.data.kind === 'agent' && node.data.agent) {
            try {
              const restoredAgent = await window.coveApi.agent.launch({
                provider: node.data.agent.provider,
                cwd: node.data.agent.executionDirectory,
                prompt: node.data.agent.prompt,
                mode: 'resume',
                model: node.data.agent.model,
                resumeSessionId: node.data.agent.resumeSessionId,
                cols: 80,
                rows: 24,
              })

              return {
                ...node,
                data: {
                  ...node.data,
                  sessionId: restoredAgent.sessionId,
                  title: toAgentNodeTitle(node.data.agent.provider, restoredAgent.effectiveModel),
                  status: 'running' as const,
                  endedAt: null,
                  exitCode: null,
                  lastError: null,
                  scrollback: node.data.scrollback,
                  startedAt: node.data.startedAt ?? new Date().toISOString(),
                  agent: {
                    ...node.data.agent,
                    effectiveModel: restoredAgent.effectiveModel,
                    launchMode: restoredAgent.launchMode,
                    resumeSessionId:
                      restoredAgent.resumeSessionId ?? node.data.agent.resumeSessionId,
                  },
                },
              }
            } catch (error) {
              const fallback = await window.coveApi.pty.spawn({
                cwd: workspace.path,
                cols: 80,
                rows: 24,
              })

              return {
                ...node,
                data: {
                  ...node.data,
                  sessionId: fallback.sessionId,
                  status: 'failed' as const,
                  endedAt: new Date().toISOString(),
                  exitCode: null,
                  lastError: `Resume failed: ${toErrorMessage(error)}`,
                  scrollback: node.data.scrollback,
                },
              }
            }
          }

          const spawned = await window.coveApi.pty.spawn({
            cwd: workspace.path,
            cols: 80,
            rows: 24,
          })

          return {
            ...node,
            data: {
              ...node.data,
              sessionId: spawned.sessionId,
              kind: 'terminal' as const,
              status: null,
              startedAt: null,
              endedAt: null,
              exitCode: null,
              lastError: null,
              scrollback: node.data.scrollback,
              agent: null,
              task: null,
            },
          }
        }),
      )

      const hydratedNodes = hydratedNodeResults
        .filter(result => result.status === 'fulfilled')
        .map(
          result =>
            (result as PromiseFulfilledResult<import('@xyflow/react').Node<TerminalNodeData>>)
              .value,
        )

      return {
        id: workspace.id,
        name: workspace.name,
        path: workspace.path,
        nodes: hydratedNodes,
        viewport: {
          x: workspace.viewport.x,
          y: workspace.viewport.y,
          zoom: workspace.viewport.zoom,
        },
        isMinimapVisible: workspace.isMinimapVisible,
      }
    }

    const applyHydratedWorkspace = (hydratedWorkspace: WorkspaceState): void => {
      if (isCancelled) {
        return
      }

      setWorkspaces(previous =>
        previous.map(workspace =>
          workspace.id === hydratedWorkspace.id ? hydratedWorkspace : workspace,
        ),
      )
    }

    const restore = async (): Promise<void> => {
      const activeWorkspace = resolvedActiveWorkspaceId
        ? (persisted.workspaces.find(workspace => workspace.id === resolvedActiveWorkspaceId) ??
          null)
        : null

      if (activeWorkspace) {
        const hydratedActiveWorkspace = await hydrateWorkspace(activeWorkspace)
        applyHydratedWorkspace(hydratedActiveWorkspace)
      }

      const remainingWorkspaces = persisted.workspaces.filter(
        workspace => workspace.id !== resolvedActiveWorkspaceId,
      )

      if (remainingWorkspaces.length === 0) {
        return
      }

      const hydratedRemainingWorkspaces = await Promise.all(
        remainingWorkspaces.map(workspace => hydrateWorkspace(workspace)),
      )

      if (isCancelled) {
        return
      }

      const hydratedWorkspaceById = new Map(
        hydratedRemainingWorkspaces.map(workspace => [workspace.id, workspace]),
      )
      setWorkspaces(previous =>
        previous.map(workspace => hydratedWorkspaceById.get(workspace.id) ?? workspace),
      )
    }

    void restore().finally(() => {
      if (!isCancelled) {
        setIsHydrated(true)
      }
    })

    return () => {
      isCancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isHydrated) {
      return
    }

    writePersistedState(toPersistedState(workspaces, activeWorkspaceId, agentSettings))
  }, [activeWorkspaceId, agentSettings, isHydrated, workspaces])

  const refreshProviderModels = useCallback(async (provider: AgentProvider): Promise<void> => {
    setProviderModelCatalog(prev => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        isLoading: true,
        error: null,
      },
    }))

    try {
      const result = await window.coveApi.agent.listModels({ provider })
      const nextModels = [...new Set(result.models.map(model => model.id))]

      setProviderModelCatalog(prev => ({
        ...prev,
        [provider]: {
          ...prev[provider],
          models: nextModels,
          source: result.source,
          fetchedAt: result.fetchedAt,
          error: result.error,
          isLoading: false,
        },
      }))
    } catch (error) {
      setProviderModelCatalog(prev => ({
        ...prev,
        [provider]: {
          ...prev[provider],
          isLoading: false,
          fetchedAt: new Date().toISOString(),
          error: toErrorMessage(error),
        },
      }))
    }
  }, [])

  useEffect(() => {
    if (!isSettingsOpen) {
      return
    }

    for (const provider of AGENT_PROVIDERS) {
      const entry = providerModelCatalog[provider]
      if (entry.fetchedAt !== null || entry.isLoading) {
        continue
      }

      void refreshProviderModels(provider)
    }
  }, [isSettingsOpen, providerModelCatalog, refreshProviderModels])

  const activeWorkspace = useMemo(
    () => workspaces.find(workspace => workspace.id === activeWorkspaceId) ?? null,
    [activeWorkspaceId, workspaces],
  )

  const activeProviderLabel = AGENT_PROVIDER_LABEL[agentSettings.defaultProvider]
  const activeProviderModel =
    resolveAgentModel(agentSettings, agentSettings.defaultProvider) ?? 'Default (Follow CLI)'

  const handleAddWorkspace = async (): Promise<void> => {
    const selected = await window.coveApi.workspace.selectDirectory()
    if (!selected) {
      return
    }

    const existing = workspaces.find(workspace => workspace.path === selected.path)
    if (existing) {
      setActiveWorkspaceId(existing.id)
      return
    }

    const nextWorkspace: WorkspaceState = {
      ...selected,
      nodes: [],
      viewport: createDefaultWorkspaceViewport(),
      isMinimapVisible: DEFAULT_WORKSPACE_MINIMAP_VISIBLE,
    }

    setWorkspaces(prev => [...prev, nextWorkspace])
    setActiveWorkspaceId(nextWorkspace.id)
    setFocusRequest(null)
  }

  const handleWorkspaceNodesChange = useCallback(
    (nodes: WorkspaceState['nodes']): void => {
      if (!activeWorkspace) {
        return
      }

      setWorkspaces(prev =>
        prev.map(workspace => {
          if (workspace.id !== activeWorkspace.id) {
            return workspace
          }

          return {
            ...workspace,
            nodes,
          }
        }),
      )
    },
    [activeWorkspace],
  )

  const handleWorkspaceViewportChange = useCallback(
    (viewport: WorkspaceViewport): void => {
      if (!activeWorkspace) {
        return
      }

      setWorkspaces(previous =>
        previous.map(workspace => {
          if (workspace.id !== activeWorkspace.id) {
            return workspace
          }

          if (
            workspace.viewport.x === viewport.x &&
            workspace.viewport.y === viewport.y &&
            workspace.viewport.zoom === viewport.zoom
          ) {
            return workspace
          }

          return {
            ...workspace,
            viewport: {
              x: viewport.x,
              y: viewport.y,
              zoom: viewport.zoom,
            },
          }
        }),
      )
    },
    [activeWorkspace],
  )

  const handleWorkspaceMinimapVisibilityChange = useCallback(
    (isVisible: boolean): void => {
      if (!activeWorkspace) {
        return
      }

      setWorkspaces(previous =>
        previous.map(workspace => {
          if (workspace.id !== activeWorkspace.id) {
            return workspace
          }

          if (workspace.isMinimapVisible === isVisible) {
            return workspace
          }

          return {
            ...workspace,
            isMinimapVisible: isVisible,
          }
        }),
      )
    },
    [activeWorkspace],
  )

  return (
    <>
      <div className="app-shell">
        <aside className="workspace-sidebar">
          <div className="workspace-sidebar__header">
            <h1>Workspaces</h1>
            <button type="button" onClick={() => void handleAddWorkspace()}>
              Add
            </button>
          </div>

          <div className="workspace-sidebar__agent">
            <span className="workspace-sidebar__agent-label">Default Agent</span>
            <strong className="workspace-sidebar__agent-provider">{activeProviderLabel}</strong>
            <span className="workspace-sidebar__agent-model">{activeProviderModel}</span>
          </div>

          <div className="workspace-sidebar__list">
            {workspaces.length === 0 ? (
              <p className="workspace-sidebar__empty">No workspace yet.</p>
            ) : null}

            {workspaces.map(workspace => {
              const isActive = workspace.id === activeWorkspaceId
              const workspaceAgents = workspace.nodes
                .filter(node => node.data.kind === 'agent')
                .sort((left, right) => {
                  const leftTime = left.data.startedAt ? Date.parse(left.data.startedAt) : 0
                  const rightTime = right.data.startedAt ? Date.parse(right.data.startedAt) : 0
                  return rightTime - leftTime
                })
              const terminalCount = workspace.nodes.filter(
                node => node.data.kind === 'terminal',
              ).length
              const agentCount = workspace.nodes.filter(node => node.data.kind === 'agent').length
              const taskCount = workspace.nodes.filter(node => node.data.kind === 'task').length
              const metaText = `${terminalCount} terminals · ${agentCount} agents · ${taskCount} tasks`

              return (
                <div className="workspace-item-group" key={workspace.id}>
                  <button
                    type="button"
                    className={`workspace-item ${isActive ? 'workspace-item--active' : ''}`}
                    onClick={() => {
                      setActiveWorkspaceId(workspace.id)
                      setFocusRequest(null)
                    }}
                    title={workspace.path}
                  >
                    <span className="workspace-item__name">{workspace.name}</span>
                    <span className="workspace-item__path">{workspace.path}</span>
                    <span className="workspace-item__meta">{metaText}</span>
                  </button>

                  {workspaceAgents.length > 0 ? (
                    <div className="workspace-item__agents">
                      {workspaceAgents.map(node => {
                        const provider = node.data.agent?.provider
                        const providerText = provider ? AGENT_PROVIDER_LABEL[provider] : 'Agent'
                        const linkedTaskNode =
                          (node.data.agent?.taskId
                            ? (workspace.nodes.find(
                                candidate =>
                                  candidate.id === node.data.agent?.taskId &&
                                  candidate.data.kind === 'task' &&
                                  candidate.data.task,
                              ) ?? null)
                            : null) ??
                          workspace.nodes.find(
                            candidate =>
                              candidate.data.kind === 'task' &&
                              candidate.data.task?.linkedAgentNodeId === node.id,
                          ) ??
                          null
                        const linkedTaskStatus =
                          linkedTaskNode && linkedTaskNode.data.kind === 'task'
                            ? (linkedTaskNode.data.task?.status ?? null)
                            : null
                        const sidebarAgentStatus = resolveSidebarAgentStatus(node.data.status)
                        const sidebarAgentStatusText =
                          SIDEBAR_AGENT_STATUS_LABEL[sidebarAgentStatus]
                        const sidebarAgentStatusTone: SidebarStatusTone =
                          sidebarAgentStatus === 'working' ? 'working' : 'standby'
                        const sidebarTaskStatus: SidebarTaskStatus = linkedTaskStatus ?? 'none'
                        const sidebarTaskStatusText = SIDEBAR_TASK_STATUS_LABEL[sidebarTaskStatus]
                        const sidebarTaskStatusTone =
                          resolveSidebarTaskStatusTone(sidebarTaskStatus)
                        const startedText = toRelativeTime(node.data.startedAt)
                        const fallbackTaskTitle =
                          node.data.agent?.prompt.trim().replace(/\s+/g, ' ') ?? ''
                        const taskTitle =
                          linkedTaskNode && linkedTaskNode.data.kind === 'task'
                            ? linkedTaskNode.data.title
                            : fallbackTaskTitle.length > 0
                              ? fallbackTaskTitle
                              : 'No linked task'

                        return (
                          <button
                            type="button"
                            key={`${workspace.id}:${node.id}`}
                            className="workspace-agent-item workspace-agent-item--nested"
                            data-testid={`workspace-agent-item-${workspace.id}-${node.id}`}
                            onClick={() => {
                              setActiveWorkspaceId(workspace.id)
                              setFocusRequest(prev => ({
                                workspaceId: workspace.id,
                                nodeId: node.id,
                                sequence: (prev?.sequence ?? 0) + 1,
                              }))
                            }}
                          >
                            <span className="workspace-agent-item__headline">
                              <span className="workspace-agent-item__title">{node.data.title}</span>
                            </span>
                            <span className="workspace-agent-item__meta">
                              <span className="workspace-agent-item__meta-text">
                                {providerText} · {startedText}
                              </span>
                              <span
                                className={`workspace-agent-item__status workspace-agent-item__status--agent workspace-agent-item__status--${sidebarAgentStatusTone}`}
                              >
                                {sidebarAgentStatusText}
                              </span>
                            </span>
                            <span className="workspace-agent-item__task" title={taskTitle}>
                              <span className="workspace-agent-item__task-text">{taskTitle}</span>
                              <span
                                className={`workspace-agent-item__status workspace-agent-item__status--task workspace-agent-item__status--${sidebarTaskStatusTone}`}
                              >
                                {sidebarTaskStatusText}
                              </span>
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>

          <div className="workspace-sidebar__footer">
            <button
              type="button"
              className="workspace-sidebar__settings"
              onClick={() => {
                setIsSettingsOpen(true)
              }}
            >
              Settings
            </button>
          </div>
        </aside>

        <main className="workspace-main">
          {activeWorkspace ? (
            <WorkspaceCanvas
              workspaceId={activeWorkspace.id}
              workspacePath={activeWorkspace.path}
              nodes={activeWorkspace.nodes}
              onNodesChange={handleWorkspaceNodesChange}
              viewport={activeWorkspace.viewport}
              isMinimapVisible={activeWorkspace.isMinimapVisible}
              onViewportChange={handleWorkspaceViewportChange}
              onMinimapVisibilityChange={handleWorkspaceMinimapVisibilityChange}
              agentSettings={agentSettings}
              focusNodeId={
                focusRequest && focusRequest.workspaceId === activeWorkspace.id
                  ? focusRequest.nodeId
                  : null
              }
              focusSequence={
                focusRequest && focusRequest.workspaceId === activeWorkspace.id
                  ? focusRequest.sequence
                  : 0
              }
            />
          ) : (
            <div className="workspace-empty-state">
              <h2>Add a workspace to start</h2>
              <p>Each workspace has its own infinite canvas and terminals.</p>
              <button type="button" onClick={() => void handleAddWorkspace()}>
                Add Workspace
              </button>
            </div>
          )}
        </main>
      </div>

      {isSettingsOpen ? (
        <SettingsPanel
          settings={agentSettings}
          modelCatalogByProvider={providerModelCatalog}
          onRefreshProviderModels={provider => {
            void refreshProviderModels(provider)
          }}
          onChange={next => {
            setAgentSettings(next)
          }}
          onClose={() => {
            setIsSettingsOpen(false)
          }}
        />
      ) : null}
    </>
  )
}

export default App
