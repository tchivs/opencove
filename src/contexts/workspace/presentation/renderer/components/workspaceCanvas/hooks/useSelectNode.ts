import { useCallback } from 'react'
import { useStoreApi, type Node } from '@xyflow/react'
import type { TerminalNodeData } from '../../../types'

type SetNodes = (
  updater: (prevNodes: Node<TerminalNodeData>[]) => Node<TerminalNodeData>[],
  options?: { syncLayout?: boolean },
) => void

export function useWorkspaceCanvasSelectNode({
  setNodes,
  setSelectedNodeIds,
  setSelectedSpaceIds,
  selectedNodeIdsRef,
  selectedSpaceIdsRef,
}: {
  setNodes: SetNodes
  setSelectedNodeIds: React.Dispatch<React.SetStateAction<string[]>>
  setSelectedSpaceIds: React.Dispatch<React.SetStateAction<string[]>>
  selectedNodeIdsRef: React.MutableRefObject<string[]>
  selectedSpaceIdsRef: React.MutableRefObject<string[]>
}): (nodeId: string, options?: { toggle?: boolean }) => void {
  const reactFlowStore = useStoreApi()

  return useCallback(
    (nodeId: string, options?: { toggle?: boolean }) => {
      const shouldToggle = options?.toggle === true
      let nextSelectedNodeIds = selectedNodeIdsRef.current

      setNodes(
        prevNodes => {
          let hasChanged = false

          if (shouldToggle) {
            const toggledSelectedIds: string[] = []

            const nextNodes = prevNodes.map(node => {
              let nextSelected = node.selected

              if (node.id === nodeId) {
                nextSelected = !node.selected
              }

              if (nextSelected) {
                toggledSelectedIds.push(node.id)
              }

              if (node.selected === nextSelected) {
                return node
              }

              hasChanged = true
              return {
                ...node,
                selected: nextSelected,
              }
            })

            nextSelectedNodeIds = toggledSelectedIds
            return hasChanged ? nextNodes : prevNodes
          }

          const isAlreadySelected = prevNodes.some(node => node.id === nodeId && node.selected)
          if (isAlreadySelected) {
            nextSelectedNodeIds = prevNodes.filter(node => node.selected).map(node => node.id)
            return prevNodes
          }

          nextSelectedNodeIds = [nodeId]
          const nextNodes = prevNodes.map(node => {
            const shouldSelect = node.id === nodeId
            if (node.selected === shouldSelect) {
              return node
            }

            hasChanged = true
            return {
              ...node,
              selected: shouldSelect,
            }
          })

          return hasChanged ? nextNodes : prevNodes
        },
        { syncLayout: false },
      )

      if (
        !shouldToggle &&
        nextSelectedNodeIds.includes(nodeId) &&
        nextSelectedNodeIds.length === 1
      ) {
        const shouldPreserveSelectedSpaces =
          selectedSpaceIdsRef.current.length > 0 && selectedNodeIdsRef.current.includes(nodeId)

        if (!shouldPreserveSelectedSpaces) {
          selectedSpaceIdsRef.current = []
          setSelectedSpaceIds([])
        }
      }

      selectedNodeIdsRef.current = nextSelectedNodeIds
      setSelectedNodeIds(nextSelectedNodeIds)
      reactFlowStore.setState({
        nodesSelectionActive: nextSelectedNodeIds.length > 0,
        coveDragSurfaceSelectionMode: shouldToggle && nextSelectedNodeIds.length > 0,
      } as unknown as Parameters<typeof reactFlowStore.setState>[0])
    },
    [
      reactFlowStore,
      selectedNodeIdsRef,
      selectedSpaceIdsRef,
      setNodes,
      setSelectedNodeIds,
      setSelectedSpaceIds,
    ],
  )
}
