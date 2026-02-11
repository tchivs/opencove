import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import type { AgentProviderId } from '../../../shared/types/api'
import { detectDoneSignalFromSessionLine } from './DoneSignalDetector'

interface SessionDoneWatcherOptions {
  provider: AgentProviderId
  sessionId: string
  filePath: string
  onDone: (sessionId: string) => void
  onError?: (error: unknown) => void
}

function isFileMissingError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false
  }

  const record = error as { code?: unknown }
  return record.code === 'ENOENT'
}

export class SessionDoneWatcher {
  private readonly provider: AgentProviderId
  private readonly sessionId: string
  private readonly filePath: string
  private readonly onDone: (sessionId: string) => void
  private readonly onError?: (error: unknown) => void

  private watcher: fs.FSWatcher | null = null
  private offset = 0
  private remainder = ''
  private disposed = false
  private processing = false
  private hasPendingRead = false
  private hasTriggeredDone = false

  public constructor(options: SessionDoneWatcherOptions) {
    this.provider = options.provider
    this.sessionId = options.sessionId
    this.filePath = options.filePath
    this.onDone = options.onDone
    this.onError = options.onError
  }

  public start(): void {
    if (this.disposed) {
      return
    }

    this.scheduleRead()

    try {
      this.watcher = fs.watch(this.filePath, () => {
        this.scheduleRead()
      })
    } catch (error) {
      if (isFileMissingError(error)) {
        return
      }

      this.onError?.(error)
    }
  }

  public dispose(): void {
    if (this.disposed) {
      return
    }

    this.disposed = true

    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
    }
  }

  private scheduleRead(): void {
    if (this.disposed || this.hasTriggeredDone) {
      return
    }

    if (this.processing) {
      this.hasPendingRead = true
      return
    }

    this.processing = true

    void this.readLoop()
  }

  private async readLoop(): Promise<void> {
    try {
      await this.readPendingChunks()
    } catch (error) {
      if (!isFileMissingError(error)) {
        this.onError?.(error)
      }
    } finally {
      this.processing = false
    }
  }

  private async readPendingChunks(): Promise<void> {
    this.hasPendingRead = false
    await this.readFileDelta()

    if (this.hasPendingRead && !this.disposed && !this.hasTriggeredDone) {
      await this.readPendingChunks()
    }
  }

  private async readFileDelta(): Promise<void> {
    const handle = await fsPromises.open(this.filePath, 'r')

    try {
      const stats = await handle.stat()

      if (stats.size < this.offset) {
        this.offset = 0
        this.remainder = ''
      }

      if (stats.size === this.offset) {
        return
      }

      const length = stats.size - this.offset
      const buffer = Buffer.alloc(length)
      await handle.read(buffer, 0, length, this.offset)
      this.offset = stats.size

      const chunk = buffer.toString('utf8')
      const merged = `${this.remainder}${chunk}`
      const lines = merged.split('\n')
      this.remainder = lines.pop() ?? ''

      for (const line of lines) {
        if (!detectDoneSignalFromSessionLine(this.provider, line)) {
          continue
        }

        this.hasTriggeredDone = true
        this.onDone(this.sessionId)
        this.dispose()
        return
      }
    } finally {
      await handle.close()
    }
  }
}
