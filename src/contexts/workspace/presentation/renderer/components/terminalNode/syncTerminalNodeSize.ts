import type { MutableRefObject } from 'react'
import type { FitAddon } from '@xterm/addon-fit'
import type { Terminal } from '@xterm/xterm'
import { resolveStablePtySize } from '../../utils/terminalResize'

export function syncTerminalNodeSize({
  terminalRef,
  fitAddonRef,
  containerRef,
  isPointerResizingRef,
  lastSyncedPtySizeRef,
  sessionId,
}: {
  terminalRef: MutableRefObject<Terminal | null>
  fitAddonRef: MutableRefObject<FitAddon | null>
  containerRef: MutableRefObject<HTMLElement | null>
  isPointerResizingRef: MutableRefObject<boolean>
  lastSyncedPtySizeRef: MutableRefObject<{ cols: number; rows: number } | null>
  sessionId: string
}): void {
  const terminal = terminalRef.current
  const fitAddon = fitAddonRef.current
  const container = containerRef.current

  if (!terminal || !fitAddon || !container) {
    return
  }

  if (container.clientWidth <= 2 || container.clientHeight <= 2) {
    return
  }

  if (isPointerResizingRef.current) {
    return
  }

  fitAddon.fit()

  if (terminal.cols <= 0 || terminal.rows <= 0) {
    return
  }

  terminal.refresh(0, Math.max(0, terminal.rows - 1))

  const nextPtySize = resolveStablePtySize({
    previous: lastSyncedPtySizeRef.current,
    measured: { cols: terminal.cols, rows: terminal.rows },
    preventRowShrink: false,
  })

  if (!nextPtySize) {
    return
  }

  lastSyncedPtySizeRef.current = nextPtySize

  void window.coveApi.pty.resize({
    sessionId,
    cols: nextPtySize.cols,
    rows: nextPtySize.rows,
  })
}
