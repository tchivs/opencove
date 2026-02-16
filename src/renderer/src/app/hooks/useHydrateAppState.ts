import type { Node } from '@xyflow/react'
import { useEffect, useState } from 'react'
import type { AgentSettings } from '../../features/settings/agentConfig'
import type {
  PersistedWorkspaceState,
  TerminalNodeData,
  WorkspaceState,
} from '../../features/workspace/types'
import { readPersistedState } from '../../features/workspace/utils/persistence'
import { toRuntimeNodes } from '../../features/workspace/utils/nodeTransform'
import { toAgentNodeTitle, toErrorMessage } from '../utils/format'
import { sanitizeWorkspaceSpaces } from '../utils/workspaceSpaces'

function isFulfilled<T>(result: PromiseSettledResult<T>): result is PromiseFulfilledResult<T> {
  return result.status === 'fulfilled'
}

function mergeHydratedWorkspaceState(
  current: WorkspaceState,
  hydrated: WorkspaceState,
): WorkspaceState {
  if (current.id !== hydrated.id) {
    return current
  }

  const existingNodeIds = new Set(current.nodes.map(node => node.id))
  const mergedNodes = current.nodes.concat(
    hydrated.nodes.filter(node => !existingNodeIds.has(node.id)),
  )

  const validNodeIds = new Set(mergedNodes.map(node => node.id))
  const nextSpaces = sanitizeWorkspaceSpaces(
    current.spaces.map(space => ({
      ...space,
      nodeIds: space.nodeIds.filter(nodeId => validNodeIds.has(nodeId)),
    })),
  )

  const nextActiveSpaceId =
    current.activeSpaceId !== null && nextSpaces.some(space => space.id === current.activeSpaceId)
      ? current.activeSpaceId
      : null

  return {
    ...current,
    nodes: mergedNodes,
    spaces: nextSpaces,
    activeSpaceId: nextActiveSpaceId,
  }
}

export function useHydrateAppState({
  setAgentSettings,
  setWorkspaces,
  setActiveWorkspaceId,
}: {
  setAgentSettings: React.Dispatch<React.SetStateAction<AgentSettings>>
  setWorkspaces: React.Dispatch<React.SetStateAction<WorkspaceState[]>>
  setActiveWorkspaceId: React.Dispatch<React.SetStateAction<string | null>>
}): { isHydrated: boolean } {
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

    const hasActiveWorkspace = persisted.workspaces.some(
      workspace => workspace.id === persisted.activeWorkspaceId,
    )
    const resolvedActiveWorkspaceId = hasActiveWorkspace
      ? persisted.activeWorkspaceId
      : (persisted.workspaces[0]?.id ?? null)

    setWorkspaces(
      persisted.workspaces.map(workspace => {
        const sanitizedSpaces = sanitizeWorkspaceSpaces(workspace.spaces)
        const hasActiveSpace =
          workspace.activeSpaceId !== null &&
          sanitizedSpaces.some(space => space.id === workspace.activeSpaceId)

        return {
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
          spaces: sanitizedSpaces,
          activeSpaceId: hasActiveSpace ? workspace.activeSpaceId : null,
        }
      }),
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
        .filter(isFulfilled)
        .map(result => result.value as Node<TerminalNodeData>)
      const hydratedNodeIds = new Set(hydratedNodes.map(node => node.id))
      const sanitizedSpaces = sanitizeWorkspaceSpaces(
        workspace.spaces.map(space => ({
          ...space,
          nodeIds: space.nodeIds.filter(nodeId => hydratedNodeIds.has(nodeId)),
        })),
      )
      const hasActiveSpace =
        workspace.activeSpaceId !== null &&
        sanitizedSpaces.some(space => space.id === workspace.activeSpaceId)

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
        spaces: sanitizedSpaces,
        activeSpaceId: hasActiveSpace ? workspace.activeSpaceId : null,
      }
    }

    const applyHydratedWorkspace = (hydratedWorkspace: WorkspaceState): void => {
      if (isCancelled) {
        return
      }

      setWorkspaces(previous =>
        previous.map(workspace =>
          workspace.id === hydratedWorkspace.id
            ? mergeHydratedWorkspaceState(workspace, hydratedWorkspace)
            : workspace,
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
        previous.map(workspace => {
          const hydratedWorkspace = hydratedWorkspaceById.get(workspace.id)
          if (!hydratedWorkspace) {
            return workspace
          }

          return mergeHydratedWorkspaceState(workspace, hydratedWorkspace)
        }),
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
  }, [setActiveWorkspaceId, setAgentSettings, setWorkspaces])

  return { isHydrated }
}
