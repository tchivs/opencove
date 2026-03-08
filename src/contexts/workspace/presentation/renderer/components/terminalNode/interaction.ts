interface TerminalNodeInteraction {
  normalizeViewport: boolean
  selectNode: boolean
}

export function resolveTerminalNodeInteraction(
  target: EventTarget | null,
): TerminalNodeInteraction | null {
  if (!(target instanceof Element)) {
    return null
  }

  if (target.closest('.terminal-node__resizer, button, input, textarea, select, a')) {
    return null
  }

  if (target.closest('.terminal-node__selected-drag-overlay')) {
    return {
      normalizeViewport: false,
      selectNode: false,
    }
  }

  if (target.closest('.terminal-node__terminal')) {
    return {
      normalizeViewport: true,
      selectNode: false,
    }
  }

  return {
    normalizeViewport: false,
    selectNode: true,
  }
}
