import { describe, expect, it, vi } from 'vitest'
import { IPC_CHANNELS } from '../../../src/shared/constants/ipc'

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void

  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })

  return { promise, resolve, reject }
}

describe('Pty runtime subscriptions', () => {
  it('cleans session subscriptions after exit', async () => {
    vi.useFakeTimers()
    vi.resetModules()

    const send = vi.fn()
    const destroyedHandlers: Array<() => void> = []

    const content = {
      isDestroyed: () => false,
      getType: () => 'window',
      send,
      once: (_event: string, handler: () => void) => {
        destroyedHandlers.push(handler)
      },
    }

    let onDataHandler: ((data: string) => void) | null = null
    let onExitHandler: ((event: { exitCode: number }) => void) | null = null

    const pty = {
      onData: (handler: (data: string) => void) => {
        onDataHandler = handler
      },
      onExit: (handler: (event: { exitCode: number }) => void) => {
        onExitHandler = handler
      },
    }

    class MockPtyManager {
      public appendSnapshotData(): void {}
      public snapshot(): string {
        return ''
      }
      public write(): void {}
      public resize(): void {}
      public kill(): void {}
      public delete(): void {}
      public disposeAll(): void {}

      public spawnSession(): { sessionId: string; pty: typeof pty } {
        return { sessionId: 'session-1', pty }
      }
    }

    vi.doMock('electron', () => ({
      webContents: {
        getAllWebContents: () => [content],
        fromId: (id: number) => (id === 1 ? content : null),
      },
    }))

    vi.doMock('../../../src/main/infrastructure/pty/PtyManager', () => ({
      PtyManager: MockPtyManager,
    }))

    const { createPtyRuntime } = await import('../../../src/main/modules/pty/ipc/runtime')

    const runtime = createPtyRuntime()
    runtime.spawnSession({ cwd: '/tmp', cols: 80, rows: 24 })
    runtime.attach(1, 'session-1')

    onDataHandler?.('hello')
    await vi.advanceTimersByTimeAsync(20)

    expect(send.mock.calls.filter(([channel]) => channel === IPC_CHANNELS.ptyData)).toEqual([
      [IPC_CHANNELS.ptyData, { sessionId: 'session-1', data: 'hello' }],
    ])

    onExitHandler?.({ exitCode: 0 })

    expect(send.mock.calls.some(([channel]) => channel === IPC_CHANNELS.ptyExit)).toBe(true)

    send.mockClear()

    onDataHandler?.('after-exit')
    await vi.advanceTimersByTimeAsync(20)

    expect(send.mock.calls.filter(([channel]) => channel === IPC_CHANNELS.ptyData)).toEqual([])

    runtime.dispose()
    vi.useRealTimers()
  })

  it('cleans session subscriptions when killed', async () => {
    vi.useFakeTimers()
    vi.resetModules()

    const send = vi.fn()
    const content = {
      isDestroyed: () => false,
      getType: () => 'window',
      send,
      once: vi.fn(),
    }

    let onDataHandler: ((data: string) => void) | null = null

    const pty = {
      onData: (handler: (data: string) => void) => {
        onDataHandler = handler
      },
      onExit: (_handler: (event: { exitCode: number }) => void) => {},
    }

    const killDeferred = createDeferred<void>()

    class MockPtyManager {
      public appendSnapshotData(): void {}
      public snapshot(): string {
        return ''
      }
      public write(): void {}
      public resize(): void {}
      public kill(): void {
        killDeferred.resolve()
      }
      public delete(): void {}
      public disposeAll(): void {}

      public spawnSession(): { sessionId: string; pty: typeof pty } {
        return { sessionId: 'session-1', pty }
      }
    }

    vi.doMock('electron', () => ({
      webContents: {
        getAllWebContents: () => [content],
        fromId: (id: number) => (id === 1 ? content : null),
      },
    }))

    vi.doMock('../../../src/main/infrastructure/pty/PtyManager', () => ({
      PtyManager: MockPtyManager,
    }))

    const { createPtyRuntime } = await import('../../../src/main/modules/pty/ipc/runtime')

    const runtime = createPtyRuntime()
    runtime.spawnSession({ cwd: '/tmp', cols: 80, rows: 24 })
    runtime.attach(1, 'session-1')

    onDataHandler?.('hello')
    await vi.advanceTimersByTimeAsync(20)

    expect(send.mock.calls.filter(([channel]) => channel === IPC_CHANNELS.ptyData).length).toBe(1)

    runtime.kill('session-1')
    await killDeferred.promise

    send.mockClear()

    onDataHandler?.('after-kill')
    await vi.advanceTimersByTimeAsync(20)

    expect(send.mock.calls.filter(([channel]) => channel === IPC_CHANNELS.ptyData)).toEqual([])

    runtime.dispose()
    vi.useRealTimers()
  })
})
