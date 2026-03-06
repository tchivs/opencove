import React from 'react'
import { render, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

type DataEvent = { sessionId: string; data: string }
type ExitEvent = { sessionId: string; exitCode: number }

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void

  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })

  return { promise, resolve, reject }
}

declare global {
  interface Window {
    ResizeObserver: typeof ResizeObserver
  }
}

vi.mock('@xterm/xterm', () => {
  class MockTerminal {
    public static lastInstance: MockTerminal | null = null

    public cols = 80
    public rows = 24
    public options = { fontSize: 13 }
    public written: string[] = []
    private dataListener: ((data: string) => void) | null = null

    public constructor() {
      MockTerminal.lastInstance = this
    }

    public loadAddon(): void {}

    public open(): void {}

    public focus(): void {}

    public refresh(): void {}

    public dispose(): void {}

    public attachCustomKeyEventHandler(): void {}

    public onData(listener: (data: string) => void) {
      this.dataListener = listener
      return {
        dispose: () => {
          this.dataListener = null
        },
      }
    }

    public write(data: string, callback?: () => void): void {
      this.written.push(data)
      callback?.()
    }
  }

  return {
    Terminal: MockTerminal,
    __getLastTerminal: () => MockTerminal.lastInstance,
  }
})

vi.mock('@xterm/addon-fit', () => {
  class MockFitAddon {
    public fit(): void {}
  }

  return { FitAddon: MockFitAddon }
})

vi.mock('@xyflow/react', () => {
  return {
    Handle: () => null,
    Position: {
      Left: 'left',
      Right: 'right',
    },
  }
})

describe('TerminalNode hydration buffering', () => {
  it('subscribes before attach and flushes buffered output without duplication', async () => {
    if (typeof window.ResizeObserver === 'undefined') {
      window.ResizeObserver = class ResizeObserver {
        public observe(): void {}
        public disconnect(): void {}
        public unobserve(): void {}
      }
    }

    const callOrder: string[] = []

    const attachDeferred = createDeferred<void>()
    const snapshotDeferred = createDeferred<{ data: string }>()

    let dataListener: ((event: DataEvent) => void) | null = null
    let exitListener: ((event: ExitEvent) => void) | null = null

    Object.defineProperty(window, 'coveApi', {
      configurable: true,
      writable: true,
      value: {
        meta: {
          isTest: true,
        },
        pty: {
          attach: vi.fn(() => {
            callOrder.push('attach')
            return attachDeferred.promise
          }),
          detach: vi.fn(async () => undefined),
          snapshot: vi.fn(() => snapshotDeferred.promise),
          onData: vi.fn((listener: (event: DataEvent) => void) => {
            callOrder.push('onData')
            dataListener = listener
            return () => undefined
          }),
          onExit: vi.fn((listener: (event: ExitEvent) => void) => {
            callOrder.push('onExit')
            exitListener = listener
            return () => undefined
          }),
          write: vi.fn(async () => undefined),
          resize: vi.fn(async () => undefined),
        },
      },
    })

    const { TerminalNode } =
      await import('../../../src/renderer/src/features/workspace/components/TerminalNode')

    const { container } = render(
      <TerminalNode
        sessionId="session-1"
        title="t"
        kind="terminal"
        status={null}
        lastError={null}
        width={520}
        height={360}
        terminalFontSize={13}
        scrollback={null}
        onClose={() => undefined}
        onResize={() => undefined}
      />,
    )

    await waitFor(() => {
      expect(callOrder).toEqual(['onData', 'onExit', 'attach'])
    })

    expect(container.querySelector('.terminal-node__terminal')).toHaveClass(
      'terminal-node__terminal--hydrating',
    )
    expect(window.coveApi.pty.snapshot).not.toHaveBeenCalled()

    attachDeferred.resolve()

    await waitFor(() => {
      expect(window.coveApi.pty.snapshot).toHaveBeenCalledTimes(1)
    })

    dataListener?.({ sessionId: 'session-1', data: 'lo!!' })
    exitListener?.({ sessionId: 'session-1', exitCode: 0 })

    snapshotDeferred.resolve({ data: 'hello' })

    const { __getLastTerminal } = await import('@xterm/xterm')
    await waitFor(() => {
      expect(__getLastTerminal()?.written).toEqual([
        'hello',
        '!!',
        '\\r\\n[process exited with code 0]\\r\\n',
      ])
    })

    dataListener?.({ sessionId: 'session-1', data: 'after' })

    await waitFor(() => {
      expect(__getLastTerminal()?.written).toEqual([
        'hello',
        '!!',
        '\\r\\n[process exited with code 0]\\r\\n',
        'after',
      ])
    })
  })
})
