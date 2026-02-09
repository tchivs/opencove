import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import type { AgentRuntimeStatus, WorkspaceNodeKind } from '../types'

interface TerminalNodeProps {
  sessionId: string
  title: string
  kind: WorkspaceNodeKind
  status: AgentRuntimeStatus | null
  lastError: string | null
  width: number
  height: number
  onClose: () => void
  onResize: (size: { width: number; height: number }) => void
  onStop?: () => void
  onRerun?: () => void
  onResume?: () => void
}

const MIN_WIDTH = 320
const MIN_HEIGHT = 220
const TERMINAL_LAYOUT_SYNC_EVENT = 'cove:terminal-layout-sync'

function getStatusLabel(status: AgentRuntimeStatus | null): string {
  switch (status) {
    case 'running':
      return 'Running'
    case 'exited':
      return 'Exited'
    case 'failed':
      return 'Failed'
    case 'stopped':
      return 'Stopped'
    case 'restoring':
      return 'Restoring'
    default:
      return 'Running'
  }
}

function getStatusClassName(status: AgentRuntimeStatus | null): string {
  switch (status) {
    case 'exited':
      return 'terminal-node__status--exited'
    case 'failed':
      return 'terminal-node__status--failed'
    case 'stopped':
      return 'terminal-node__status--stopped'
    case 'restoring':
      return 'terminal-node__status--restoring'
    case 'running':
    default:
      return 'terminal-node__status--running'
  }
}

export function TerminalNode({
  sessionId,
  title,
  kind,
  status,
  lastError,
  width,
  height,
  onClose,
  onResize,
  onStop,
  onRerun,
  onResume,
}: TerminalNodeProps): JSX.Element {
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const resizeStartRef = useRef<{
    x: number
    y: number
    width: number
    height: number
  } | null>(null)

  const [isResizing, setIsResizing] = useState(false)
  const sizeStyle = useMemo(() => ({ width, height }), [width, height])

  const syncTerminalSize = useCallback(() => {
    const terminal = terminalRef.current
    const fitAddon = fitAddonRef.current
    const container = containerRef.current

    if (!terminal || !fitAddon || !container) {
      return
    }

    if (container.clientWidth <= 2 || container.clientHeight <= 2) {
      return
    }

    fitAddon.fit()

    if (terminal.cols <= 0 || terminal.rows <= 0) {
      return
    }

    terminal.refresh(0, Math.max(0, terminal.rows - 1))

    void window.coveApi.pty.resize({
      sessionId,
      cols: terminal.cols,
      rows: terminal.rows,
    })
  }, [sessionId])

  useEffect(() => {
    const terminal = new Terminal({
      cursorBlink: true,
      fontFamily:
        'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      fontSize: 12,
      theme: {
        background: '#0a0f1d',
        foreground: '#d6e4ff',
      },
      allowProposedApi: true,
      convertEol: true,
      scrollback: 5000,
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    if (containerRef.current) {
      terminal.open(containerRef.current)
      requestAnimationFrame(syncTerminalSize)
    }

    const disposable = terminal.onData(data => {
      void window.coveApi.pty.write({ sessionId, data })
    })

    let unsubscribeData: (() => void) | null = null
    let unsubscribeExit: (() => void) | null = null
    let isDisposed = false

    const bindSessionEvents = () => {
      unsubscribeData = window.coveApi.pty.onData(event => {
        if (event.sessionId !== sessionId) {
          return
        }

        terminal.write(event.data)
      })

      unsubscribeExit = window.coveApi.pty.onExit(event => {
        if (event.sessionId !== sessionId) {
          return
        }

        terminal.writeln(`\r\n[process exited with code ${event.exitCode}]`)
      })
    }

    const hydrateFromSnapshot = async () => {
      try {
        const snapshot = await window.coveApi.pty.snapshot({ sessionId })
        if (!isDisposed && snapshot.data.length > 0) {
          terminal.write(snapshot.data)
        }
      } catch {
        // ignore snapshot read failures and continue with live stream
      }

      if (isDisposed) {
        return
      }

      bindSessionEvents()
      syncTerminalSize()
    }

    void hydrateFromSnapshot()

    const resizeObserver = new ResizeObserver(() => {
      syncTerminalSize()
    })

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncTerminalSize()
      }
    }

    const handleWindowFocus = () => {
      syncTerminalSize()
    }

    const handleLayoutSync = () => {
      syncTerminalSize()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleWindowFocus)
    window.addEventListener(TERMINAL_LAYOUT_SYNC_EVENT, handleLayoutSync)

    return () => {
      isDisposed = true
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleWindowFocus)
      window.removeEventListener(TERMINAL_LAYOUT_SYNC_EVENT, handleLayoutSync)
      resizeObserver.disconnect()
      disposable.dispose()
      unsubscribeData?.()
      unsubscribeExit?.()
      terminal.dispose()
      terminalRef.current = null
      fitAddonRef.current = null
    }
  }, [sessionId, syncTerminalSize])

  useEffect(() => {
    const frame = requestAnimationFrame(syncTerminalSize)
    return () => {
      cancelAnimationFrame(frame)
    }
  }, [height, syncTerminalSize, width])

  const handleResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.preventDefault()
      event.stopPropagation()
      event.currentTarget.setPointerCapture(event.pointerId)

      resizeStartRef.current = {
        x: event.clientX,
        y: event.clientY,
        width,
        height,
      }

      setIsResizing(true)
    },
    [height, width],
  )

  useEffect(() => {
    if (!isResizing) {
      return
    }

    const handlePointerMove = (event: PointerEvent) => {
      const start = resizeStartRef.current
      if (!start) {
        return
      }

      const nextWidth = Math.max(MIN_WIDTH, Math.round(start.width + (event.clientX - start.x)))
      const nextHeight = Math.max(MIN_HEIGHT, Math.round(start.height + (event.clientY - start.y)))

      onResize({ width: nextWidth, height: nextHeight })
    }

    const handlePointerUp = () => {
      setIsResizing(false)
      resizeStartRef.current = null
      syncTerminalSize()
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp, { once: true })

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [isResizing, onResize, syncTerminalSize])

  const isAgentNode = kind === 'agent'
  const canStop =
    isAgentNode &&
    (status === 'running' || status === 'restoring' || status === null) &&
    typeof onStop === 'function'

  return (
    <div
      className="terminal-node nowheel"
      style={sizeStyle}
      onWheel={event => {
        event.stopPropagation()
      }}
    >
      <div className="terminal-node__header" data-node-drag-handle="true">
        <span className="terminal-node__title">{title}</span>

        {isAgentNode ? (
          <div className="terminal-node__agent-controls nodrag">
            <span className={`terminal-node__status ${getStatusClassName(status)}`}>
              {getStatusLabel(status)}
            </span>
            <button
              type="button"
              className="terminal-node__action"
              disabled={!canStop}
              onClick={event => {
                event.stopPropagation()
                onStop?.()
              }}
            >
              Stop
            </button>
            <button
              type="button"
              className="terminal-node__action"
              disabled={typeof onRerun !== 'function'}
              onClick={event => {
                event.stopPropagation()
                onRerun?.()
              }}
            >
              Rerun
            </button>
            <button
              type="button"
              className="terminal-node__action"
              disabled={typeof onResume !== 'function'}
              onClick={event => {
                event.stopPropagation()
                onResume?.()
              }}
            >
              Resume
            </button>
          </div>
        ) : null}

        <button
          type="button"
          className="terminal-node__close nodrag"
          onClick={event => {
            event.stopPropagation()
            onClose()
          }}
        >
          ×
        </button>
      </div>

      {isAgentNode && lastError ? <div className="terminal-node__error">{lastError}</div> : null}

      <div ref={containerRef} className="terminal-node__terminal nodrag" />
      <button
        type="button"
        className="terminal-node__resizer nodrag"
        onPointerDown={handleResizePointerDown}
        aria-label="Resize terminal"
      />
    </div>
  )
}
