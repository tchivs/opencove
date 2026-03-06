import { useCallback, useMemo, useState } from 'react'
import type { Node } from '@xyflow/react'
import { resolveAgentModel, type AgentSettings } from '../../../../settings/agentConfig'
import type { AgentNodeData, Point, TerminalNodeData, WorkspaceSpaceState } from '../../../types'
import { normalizeDirectoryPath, sanitizeSpaces, toErrorMessage } from '../helpers'
import type { AgentLauncherState, ContextMenuState, CreateNodeInput } from '../types'
import { expandSpaceToFitOwnedNodesAndPushAway } from '../../../utils/spaceAutoResize'

interface LaunchWorkspaceAgentInput {
  anchor: Point
  provider: AgentNodeData['provider']
  prompt: string
  model: string | null
  directoryMode: 'workspace' | 'custom'
  customDirectory: string | null
  shouldCreateDirectory: boolean
}

type LaunchWorkspaceAgentResult =
  | { ok: true }
  | { ok: false; error: string; alreadyHandled?: boolean }

interface UseAgentLauncherParams {
  agentSettings: AgentSettings
  workspacePath: string
  nodesRef: React.MutableRefObject<Node<TerminalNodeData>[]>
  setNodes: (
    updater: (prevNodes: Node<TerminalNodeData>[]) => Node<TerminalNodeData>[],
    options?: { syncLayout?: boolean },
  ) => void
  spacesRef: React.MutableRefObject<WorkspaceSpaceState[]>
  onSpacesChange: (spaces: WorkspaceSpaceState[]) => void
  onRequestPersistFlush?: () => void
  contextMenu: ContextMenuState | null
  setContextMenu: (next: ContextMenuState | null) => void
  createNodeForSession: (input: CreateNodeInput) => Promise<Node<TerminalNodeData> | null>
  buildAgentNodeTitle: (
    provider: AgentNodeData['provider'],
    effectiveModel: string | null,
  ) => string
}

export function useWorkspaceCanvasAgentLauncher({
  agentSettings,
  workspacePath,
  nodesRef,
  setNodes,
  spacesRef,
  onSpacesChange,
  onRequestPersistFlush,
  contextMenu,
  setContextMenu,
  createNodeForSession,
  buildAgentNodeTitle,
}: UseAgentLauncherParams): {
  agentLauncher: AgentLauncherState | null
  setAgentLauncher: React.Dispatch<React.SetStateAction<AgentLauncherState | null>>
  openAgentLauncher: () => void
  closeAgentLauncher: () => void
  launchAgentNode: () => Promise<void>
  launcherModelOptions: string[]
} {
  const [agentLauncher, setAgentLauncher] = useState<AgentLauncherState | null>(null)

  const launchWorkspaceAgent = useCallback(
    async (input: LaunchWorkspaceAgentInput): Promise<LaunchWorkspaceAgentResult> => {
      const normalizedPrompt = input.prompt.trim()
      const normalizedModel = input.model?.trim() ?? ''

      const anchorSpace =
        spacesRef.current.find(space => {
          if (!space.rect) {
            return false
          }

          return (
            input.anchor.x >= space.rect.x &&
            input.anchor.x <= space.rect.x + space.rect.width &&
            input.anchor.y >= space.rect.y &&
            input.anchor.y <= space.rect.y + space.rect.height
          )
        }) ?? null

      const anchorSpaceDirectory =
        anchorSpace && anchorSpace.directoryPath.trim().length > 0
          ? anchorSpace.directoryPath
          : workspacePath

      const executionDirectory =
        input.directoryMode === 'workspace'
          ? anchorSpaceDirectory
          : normalizeDirectoryPath(workspacePath, input.customDirectory ?? '')

      if (executionDirectory.trim().length === 0) {
        return {
          ok: false,
          error: '请填写有效的执行目录。',
        }
      }

      try {
        if (input.directoryMode === 'custom' && input.shouldCreateDirectory) {
          await window.coveApi.workspace.ensureDirectory({ path: executionDirectory })
        }

        const launched = await window.coveApi.agent.launch({
          provider: input.provider,
          cwd: executionDirectory,
          prompt: normalizedPrompt,
          mode: 'new',
          model: normalizedModel.length > 0 ? normalizedModel : null,
          agentFullAccess: agentSettings.agentFullAccess,
          cols: 80,
          rows: 24,
        })

        const modelLabel =
          launched.effectiveModel ?? (normalizedModel.length > 0 ? normalizedModel : null)
        const agentData: AgentNodeData = {
          provider: input.provider,
          prompt: normalizedPrompt,
          model: normalizedModel.length > 0 ? normalizedModel : null,
          effectiveModel: launched.effectiveModel,
          launchMode: launched.launchMode,
          resumeSessionId: launched.resumeSessionId,
          executionDirectory,
          expectedDirectory: anchorSpace ? anchorSpaceDirectory : executionDirectory,
          directoryMode: input.directoryMode,
          customDirectory:
            input.directoryMode === 'custom' ? (input.customDirectory?.trim() || null) : null,
          shouldCreateDirectory: input.shouldCreateDirectory,
          taskId: null,
        }

        const created = await createNodeForSession({
          sessionId: launched.sessionId,
          title: buildAgentNodeTitle(input.provider, modelLabel),
          anchor: input.anchor,
          kind: 'agent',
          agent: agentData,
        })

        if (!created) {
          return {
            ok: false,
            error: '终端窗口无法放置，请先整理画布后重试。',
            alreadyHandled: true,
          }
        }

        if (anchorSpace) {
          const targetSpace = anchorSpace
          const nextSpaces = sanitizeSpaces(
            spacesRef.current.map(space => {
              const filtered = space.nodeIds.filter(nodeId => nodeId !== created.id)

              if (space.id !== targetSpace.id) {
                return {
                  ...space,
                  nodeIds: filtered,
                }
              }

              return {
                ...space,
                nodeIds: [...new Set([...filtered, created.id])],
              }
            }),
          )

          const { spaces: pushedSpaces, nodePositionById } =
            expandSpaceToFitOwnedNodesAndPushAway({
              targetSpaceId: targetSpace.id,
              spaces: nextSpaces,
              nodeRects: nodesRef.current.map(node => ({
                id: node.id,
                rect: {
                  x: node.position.x,
                  y: node.position.y,
                  width: node.data.width,
                  height: node.data.height,
                },
              })),
              gap: 24,
            })

          if (nodePositionById.size > 0) {
            setNodes(
              prevNodes => {
                let hasChanged = false
                const next = prevNodes.map(node => {
                  const nextPosition = nodePositionById.get(node.id)
                  if (!nextPosition) {
                    return node
                  }

                  if (node.position.x === nextPosition.x && node.position.y === nextPosition.y) {
                    return node
                  }

                  hasChanged = true
                  return {
                    ...node,
                    position: nextPosition,
                  }
                })

                return hasChanged ? next : prevNodes
              },
              { syncLayout: false },
            )
          }

          onSpacesChange(pushedSpaces)
          onRequestPersistFlush?.()
        }

        return { ok: true }
      } catch (error) {
        return {
          ok: false,
          error: `Agent 启动失败：${toErrorMessage(error)}`,
        }
      }
    },
    [
      agentSettings.agentFullAccess,
      buildAgentNodeTitle,
      createNodeForSession,
      nodesRef,
      onSpacesChange,
      onRequestPersistFlush,
      setNodes,
      spacesRef,
      workspacePath,
    ],
  )

  const openAgentLauncher = useCallback(() => {
    if (!contextMenu || contextMenu.kind !== 'pane') {
      return
    }

    const anchor: Point = {
      x: contextMenu.flowX,
      y: contextMenu.flowY,
    }

    const provider = agentSettings.defaultProvider
    const model = resolveAgentModel(agentSettings, provider)

    setContextMenu(null)

    void launchWorkspaceAgent({
      anchor,
      provider,
      prompt: '',
      model,
      directoryMode: 'workspace',
      customDirectory: null,
      shouldCreateDirectory: false,
    }).then(result => {
      if (!result.ok && !result.alreadyHandled) {
        window.alert(result.error)
      }
    })
  }, [agentSettings, contextMenu, launchWorkspaceAgent, setContextMenu])

  const closeAgentLauncher = useCallback(() => {
    setAgentLauncher(prev => {
      if (!prev || prev.isLaunching) {
        return prev
      }

      return null
    })
  }, [])

  const launchAgentNode = useCallback(async () => {
    if (!agentLauncher) {
      return
    }

    setAgentLauncher(prev =>
      prev
        ? {
            ...prev,
            isLaunching: true,
            error: null,
          }
        : prev,
    )

    const result = await launchWorkspaceAgent({
      anchor: agentLauncher.anchor,
      provider: agentLauncher.provider,
      prompt: agentLauncher.prompt,
      model: agentLauncher.model,
      directoryMode: agentLauncher.directoryMode,
      customDirectory: agentLauncher.customDirectory,
      shouldCreateDirectory: agentLauncher.shouldCreateDirectory,
    })

    if (result.ok) {
      setAgentLauncher(null)
      return
    }

    setAgentLauncher(prev =>
      prev
        ? {
            ...prev,
            isLaunching: false,
            error: result.error,
          }
        : prev,
    )
  }, [agentLauncher, launchWorkspaceAgent])

  const launcherModelOptions = useMemo(() => {
    if (!agentLauncher) {
      return []
    }

    const provider = agentLauncher.provider
    const providerOptions = agentSettings.customModelOptionsByProvider[provider] ?? []
    const defaultModel = resolveAgentModel(agentSettings, provider)

    return [
      ...new Set([...providerOptions, defaultModel ?? '', agentLauncher.model].filter(Boolean)),
    ]
  }, [agentLauncher, agentSettings])

  return {
    agentLauncher,
    setAgentLauncher,
    openAgentLauncher,
    closeAgentLauncher,
    launchAgentNode,
    launcherModelOptions,
  }
}
