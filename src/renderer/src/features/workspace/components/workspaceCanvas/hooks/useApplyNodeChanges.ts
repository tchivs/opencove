import { useCallback, type MutableRefObject } from 'react'
import {
  applyNodeChanges,
  type Node,
  type NodeChange,
  type NodePositionChange,
} from '@xyflow/react'
import type { TerminalNodeData } from '../../../types'

interface UseApplyNodeChangesParams {
  nodesRef: MutableRefObject<Node<TerminalNodeData>[]>
  onNodesChange: (nodes: Node<TerminalNodeData>[]) => void
  clearAgentLaunchToken: (nodeId: string) => void
  normalizePosition: (
    nodeId: string,
    desired: { x: number; y: number },
    size: { width: number; height: number },
  ) => { x: number; y: number }
  applyPendingScrollbacks: (targetNodes: Node<TerminalNodeData>[]) => Node<TerminalNodeData>[]
  isNodeDraggingRef: MutableRefObject<boolean>
}

export function useWorkspaceCanvasApplyNodeChanges({
  nodesRef,
  onNodesChange,
  clearAgentLaunchToken,
  normalizePosition,
  applyPendingScrollbacks,
  isNodeDraggingRef,
}: UseApplyNodeChangesParams): (changes: NodeChange<Node<TerminalNodeData>>[]) => void {
  return useCallback(
    (changes: NodeChange<Node<TerminalNodeData>>[]) => {
      if (!changes.length) {
        return
      }

      const currentNodes = nodesRef.current
      const removedIds = new Set(
        changes.filter(change => change.type === 'remove').map(change => change.id),
      )

      if (removedIds.size > 0) {
        removedIds.forEach(removedId => {
          clearAgentLaunchToken(removedId)
        })

        currentNodes.forEach(node => {
          if (!removedIds.has(node.id)) {
            return
          }

          if (node.data.sessionId.length > 0) {
            void window.coveApi.pty.kill({ sessionId: node.data.sessionId }).catch(() => undefined)
          }
        })
      }

      const survivingNodes = currentNodes.filter(node => !removedIds.has(node.id))
      const nonRemoveChanges = changes.filter(change => change.type !== 'remove')

      let nextNodes = applyNodeChanges<Node<TerminalNodeData>>(nonRemoveChanges, survivingNodes)

      const settledPositionChanges: NodePositionChange[] = changes.filter(
        (change): change is NodePositionChange =>
          change.type === 'position' &&
          !change.dragging &&
          change.position !== undefined &&
          !removedIds.has(change.id),
      )

      if (settledPositionChanges.length > 0) {
        nextNodes = nextNodes.map(node => {
          const settledChange = settledPositionChanges.find(change => change.id === node.id)
          if (!settledChange || !settledChange.position) {
            return node
          }

          const resolved = normalizePosition(node.id, settledChange.position, {
            width: node.data.width,
            height: node.data.height,
          })

          return {
            ...node,
            position: resolved,
          }
        })
      }

      const positionChanges = changes.filter(change => change.type === 'position')
      if (positionChanges.length > 0) {
        isNodeDraggingRef.current = positionChanges.some(change => change.dragging)
      }

      if (!isNodeDraggingRef.current) {
        nextNodes = applyPendingScrollbacks(nextNodes)
      }

      if (removedIds.size > 0) {
        const now = new Date().toISOString()

        nextNodes = nextNodes.map(node => {
          if (
            node.data.kind === 'task' &&
            node.data.task &&
            node.data.task.linkedAgentNodeId &&
            removedIds.has(node.data.task.linkedAgentNodeId)
          ) {
            return {
              ...node,
              data: {
                ...node.data,
                task: {
                  ...node.data.task,
                  linkedAgentNodeId: null,
                  status: node.data.task.status === 'doing' ? 'todo' : node.data.task.status,
                  updatedAt: now,
                },
              },
            }
          }

          if (
            node.data.kind === 'agent' &&
            node.data.agent &&
            node.data.agent.taskId &&
            removedIds.has(node.data.agent.taskId)
          ) {
            return {
              ...node,
              data: {
                ...node.data,
                agent: {
                  ...node.data.agent,
                  taskId: null,
                },
              },
            }
          }

          return node
        })
      }

      const shouldSyncLayout = changes.some(change => {
        if (change.type === 'remove') {
          return true
        }

        if (change.type === 'position') {
          return !change.dragging
        }

        return change.type !== 'select'
      })

      nodesRef.current = nextNodes
      onNodesChange(nextNodes)
      if (shouldSyncLayout) {
        window.dispatchEvent(new Event('cove:terminal-layout-sync'))
      }
    },
    [
      applyPendingScrollbacks,
      clearAgentLaunchToken,
      isNodeDraggingRef,
      nodesRef,
      normalizePosition,
      onNodesChange,
    ],
  )
}
