import { useCallback, useEffect, useMemo, useState } from 'react'
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
import type { WorkspaceState } from './features/workspace/types'
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

function App(): JSX.Element {
  const [workspaces, setWorkspaces] = useState<WorkspaceState[]>([])
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null)
  const [agentSettings, setAgentSettings] = useState<AgentSettings>(DEFAULT_AGENT_SETTINGS)
  const [providerModelCatalog, setProviderModelCatalog] = useState<ProviderModelCatalog>(() =>
    createInitialModelCatalog(),
  )
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isHydrated, setIsHydrated] = useState(false)

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

    const restore = async (): Promise<void> => {
      const restoredWorkspaces = await Promise.all(
        persisted.workspaces.map(async workspace => {
          const runtimeNodes = toRuntimeNodes(workspace)

          const hydratedNodeResults = await Promise.allSettled(
            runtimeNodes.map(async node => {
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
                },
              }
            }),
          )

          const hydratedNodes = hydratedNodeResults
            .filter((result): result is PromiseFulfilledResult<(typeof runtimeNodes)[number]> => {
              return result.status === 'fulfilled'
            })
            .map(result => result.value)

          return {
            id: workspace.id,
            name: workspace.name,
            path: workspace.path,
            nodes: hydratedNodes,
          }
        }),
      )

      setWorkspaces(restoredWorkspaces)

      const hasActive = restoredWorkspaces.some(
        workspace => workspace.id === persisted.activeWorkspaceId,
      )
      setActiveWorkspaceId(
        hasActive ? persisted.activeWorkspaceId : (restoredWorkspaces[0]?.id ?? null),
      )
      setIsHydrated(true)
    }

    void restore().finally(() => {
      setIsHydrated(true)
    })
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
    }

    setWorkspaces(prev => [...prev, nextWorkspace])
    setActiveWorkspaceId(nextWorkspace.id)
  }

  const handleWorkspaceNodesChange = (nodes: WorkspaceState['nodes']): void => {
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
  }

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
              return (
                <button
                  type="button"
                  key={workspace.id}
                  className={`workspace-item ${isActive ? 'workspace-item--active' : ''}`}
                  onClick={() => setActiveWorkspaceId(workspace.id)}
                  title={workspace.path}
                >
                  <span className="workspace-item__name">{workspace.name}</span>
                  <span className="workspace-item__path">{workspace.path}</span>
                  <span className="workspace-item__meta">{workspace.nodes.length} terminals</span>
                </button>
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
              workspacePath={activeWorkspace.path}
              nodes={activeWorkspace.nodes}
              onNodesChange={handleWorkspaceNodesChange}
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
